import { describe, expect, it } from "vitest";
import { Rng, VirtualClock, type Notice } from "@lifesim/core";
import { loadContent } from "@lifesim/content";
import { RandomController, Session, resolveConfig, runSession } from "../src";
import { scripted } from "./helpers";

const content = loadContent();
const clock = new VirtualClock();

function play(seed: string) {
  const notices: { id: string; n: Notice }[] = [];
  const result = runSession({
    content,
    config: { seed },
    participants: ["doctor", "teacher", "mechanic", "civilian", "journalist", "lawyer"].map((career, i) => ({
      career,
      isBot: true,
      controller: new RandomController(new Rng(`${seed}-${i}`), 0),
    })),
    onNotice: (id, n) => notices.push({ id, n }),
  });
  return { notices, result };
}

describe("T5: the event begins on the map", () => {
  it("announces an event while people walk there, at the tile where the card will open", () => {
    const { notices } = play("t5");
    const coming = notices.filter((x) => x.n.kind === "coming") as { id: string; n: Extract<Notice, { kind: "coming" }> }[];
    expect(coming.length).toBeGreaterThan(10);
    for (const c of coming.slice(0, 30)) {
      const offer = notices.find((x) => x.id === c.id && x.n.kind === "event" && x.n.view.offer.instanceId === c.n.instanceId);
      if (!offer || offer.n.kind !== "event") continue; // the session may have ended
      expect(offer.n.t).toBe(c.n.offerAt);
      expect(offer.n.t).toBeGreaterThan(c.n.t);
      expect(offer.n.view.offer.tile).toEqual(c.n.tile);
      expect(c.n.participants.map((p) => p.characterId)).toContain(c.id);
    }
  });

  it("the outcome tells who decided (cards turned over together) and how everyone reacts", () => {
    const { notices } = play("t5b");
    const shared = notices.filter((x) => x.n.kind === "resolved" && (x.n.deciders?.length ?? 0) >= 2) as { id: string; n: Extract<Notice, { kind: "resolved" }> }[];
    expect(shared.length).toBeGreaterThan(5);
    const reactions = new Set<string>();
    for (const { n } of shared) {
      const visible = n.participants.map((p) => p.characterId);
      for (const d of n.deciders!) expect(visible).toContain(d);
      expect(n.reactions!.map((r) => r.characterId).sort()).toEqual([...visible].sort());
      for (const r of n.reactions!) reactions.add(r.reaction);
    }
    expect(reactions.size).toBeGreaterThanOrEqual(3);
  });

  it("public events carry their tile (the place pulses for everyone)", () => {
    const session = new Session(content, resolveConfig({ seed: "t5c" }), ["doctor", "teacher", "mechanic"].map((career) => ({ career, isBot: true })), clock);
    const tiles: [number, number][] = [];
    session.onPublic = (e) => e.kind === "event" && tiles.push(e.tile);
    session.start();
    for (let i = 0; i < 200 && tiles.length < 3; i++) {
      clock.advanceTo(session.nextWakeAt() ?? clock.now() + 1000);
      session.processTimers();
    }
    expect(tiles.length).toBeGreaterThanOrEqual(3);
    for (const [x, y] of tiles) expect(content.map.isWalkable(x, y) || content.map.places.some((p) => p.door[0] === x && p.door[1] === y)).toBe(true);
  });

});

describe("T6: moods and ties on the map", () => {
  it("moods change after events and are published; everyone has one at any time", () => {
    // Nobody answers: every event resolves with its defaults, which still changes people's moods.
    const clock = new VirtualClock();
    const session = new Session(content, resolveConfig({ seed: "t6" }), ["doctor", "teacher", "mechanic", "civilian"].map((career) => ({ career, isBot: true })), clock);
    const moods: string[] = [];
    session.onPublic = (e) => e.kind === "mood" && moods.push(e.mood);
    session.start();
    for (let i = 0; i < 3000 && session.state === "active"; i++) {
      clock.advanceTo(session.nextWakeAt() ?? clock.now() + 1000);
      session.processTimers();
    }
    expect(moods.length).toBeGreaterThan(5);
    expect(new Set(moods).size).toBeGreaterThanOrEqual(3);
    expect(session.moods()).toHaveLength(4);
  });

  it("debts show up as a tie between the two characters (both ways)", () => {
    let ties: { viewer: string; other: string; debt: string | undefined }[] = [];
    for (let k = 0; k < 20 && ties.length === 0; k++) {
      const { notices } = play(`t6-debt-${k}`);
      ties = notices.flatMap((x) => (x.n.kind === "resolved" ? (x.n.others ?? []).filter((o) => o.debt).map((o) => ({ viewer: x.id, other: o.id, debt: o.debt })) : []));
    }
    expect(ties.length).toBeGreaterThan(0);
    // If A sees "you_owe" B, then B (at some point) sees "owes_you" A.
    const t = ties.find((x) => x.debt === "you_owe");
    if (t) expect(ties.some((x) => x.viewer === t.other && x.other === t.viewer && (x.debt === "owes_you" || x.debt === "both"))).toBe(true);
  });
});

describe("T5b R2: people stay at the spot while the cards are revealed", () => {
  it("after an event with a human, nobody in it walks away for the linger time (live pacing only)", async () => {
    const { humanPacing } = await import("../src");
    const pacing = humanPacing(6);
    const result = runSession({
      content,
      config: { seed: "linger", humanPacing: pacing },
      participants: [
        { career: "lawyer", isBot: false, controller: { decide: (v) => ({ choiceId: v.offer.choices[0]!.id, thinkMs: 3000 * 6 }) } },
        ...["doctor", "teacher", "mechanic", "civilian"].map((career, i) => ({ career, isBot: true, controller: new RandomController(new Rng(`l${i}`), 0) })),
      ],
    });
    const linger = pacing.lingerSeconds * 1000 * 6;
    const started = new Map<string, string[]>();
    let checked = 0;
    for (const e of result.log) {
      if (e.type === "event_started") started.set(e.instanceId, Object.values(e.bindings).flat());
      if (e.type !== "event_resolved") continue;
      const who = started.get(e.instanceId)!;
      if (!who.includes("c1")) continue;
      const early = result.log.filter((m) => m.type === "moved" && who.includes(m.characterId) && m.t > e.t && m.t < e.t + linger && m.reason !== "event");
      expect(early).toEqual([]);
      checked++;
    }
    expect(checked).toBeGreaterThan(3);
  });
});

describe("T7: lasting traces on the map", () => {
  it("a mark effect puts a trace at the person's home, and it goes away after its time", async () => {
    const { buildContent, event } = await import("./helpers");
    const bundle = buildContent([
      event({
        id: "sale",
        cooldown: { maxPerSession: 1 },
        roles: { a: { count: 1 } },
        choices: { a: [{ id: "ok", label: "OK", tags: ["help"] }, { id: "no", label: "No", tags: ["refuse"], default: true }] },
        outcomes: [{ id: "done", effects: [{ type: "mark", target: "role:a", mark: "for_sale", seconds: 20 }, { type: "mark", target: "role:a", mark: "bandage" }] }],
      }),
    ]);
    const clock = new VirtualClock();
    const session = new Session(bundle, resolveConfig({ seed: "marks", durationSeconds: 120 }), [{ career: "civilian", isBot: true }], clock);
    const entries: { kind: string; t: number; mark?: { kind: string; placeId: string | null; until?: number } }[] = [];
    session.onPublic = (e) => (e.kind === "mark" || e.kind === "unmark") && entries.push(e as never);
    session.start();
    const home = (session.log[0] as { characters: { home: string }[] }).characters[0]!.home;
    for (let i = 0; i < 2000 && session.state === "active"; i++) {
      clock.advanceTo(session.nextWakeAt() ?? clock.now() + 1000);
      session.processTimers();
    }
    const sale = entries.find((e) => e.kind === "mark" && e.mark!.kind === "for_sale")!;
    expect(sale.mark!.placeId).toBe(home);
    expect(sale.mark!.until! - sale.t).toBe(20_000);
    expect(entries.some((e) => e.kind === "unmark" && e.t === sale.mark!.until)).toBe(true);
    const bandage = entries.find((e) => e.kind === "mark" && e.mark!.kind === "bandage")!;
    expect(bandage.mark!.placeId).toBeNull();
    expect(session.currentMarks().map((m) => m.kind)).toEqual(["bandage"]); // no end time: stays
  });

  it("death leaves flowers at home; at least 6 kinds of traces appear across sessions", () => {
    const kinds = new Set<string>();
    let deaths = 0;
    for (let k = 0; k < 40; k++) {
      runSession({
        content,
        config: { seed: `traces-${k}` },
        participants: ["doctor", "teacher", "mechanic", "civilian", "journalist", "lawyer"].map((career, i) => ({ career, isBot: true, controller: new RandomController(new Rng(`tr${k}-${i}`), 0) })),
        mischief: [{ t: 60_000, characterId: "c1", mischiefId: "flat_tyres", targetId: "c2" }],
        onPublic: (e) => {
          if (e.kind === "mark") kinds.add(e.mark.kind);
          if (e.kind === "ended" && e.status === "dead") deaths++;
        },
      });
    }
    if (deaths > 0) expect(kinds.has("flowers")).toBe(true);
    expect(kinds.size).toBeGreaterThanOrEqual(6);
  });
});

describe("T8: a prank becomes a scheme in three steps", () => {
  /** A live-like session where `answer` decides for whoever gets an offer (null = let the deadline decide). */
  function world(
    seed: string,
    careers: string[],
    answer: (id: string, offer: Extract<Notice, { kind: "event" }>["view"]["offer"]) => string | null = () => null,
    { startAfter = 200, prep = 10 } = {},
  ) {
    const clock = new VirtualClock();
    const session = new Session(
      content,
      resolveConfig({
        seed,
        durationSeconds: 400,
        initialDelaySeconds: [startAfter, startAfter],
        startingRelationships: { colleaguePairRatio: 0, familyChance: 0, partnerChance: 0 },
        chaos: { upheavals: [0, 0], mischiefCharges: 2, followUpBoost: 1, schemePrepSeconds: [prep, prep] },
      }),
      careers.map((career) => ({ career, isBot: false })),
      clock,
    );
    const notices: { id: string; n: Notice }[] = [];
    const due: { at: number; id: string; instanceId: string; choiceId: string }[] = [];
    session.onNotice = (id, n) => {
      notices.push({ id, n });
      if (n.kind === "event" && n.view.offer.choices.length) {
        const choiceId = answer(id, n.view.offer);
        if (choiceId) due.push({ at: clock.now() + 500, id, instanceId: n.view.offer.instanceId, choiceId });
      }
    };
    session.start();
    const run = (until: number) => {
      for (let i = 0; i < 5000 && session.state === "active" && clock.now() < until; i++) {
        const next = Math.min(session.nextWakeAt() ?? Infinity, ...due.map((d) => d.at));
        if (next > until) break;
        clock.advanceTo(next);
        for (const d of due.filter((x) => x.at <= clock.now())) session.submitDecision(d.id, d.instanceId, d.choiceId);
        due.splice(0, due.length, ...due.filter((x) => x.at > clock.now()));
        session.processTimers();
      }
    };
    return { session, notices, run, clock };
  }

  it("previews the odds: career schemes for their careers only, friends see through you more easily", () => {
    const { session } = world("t8-preview", ["journalist", "teacher", "lawyer"]);
    expect(session.mischiefState("c1").options.map((o) => o.id)).toContain("fake_news");
    expect(session.mischiefState("c3").options.map((o) => o.id)).not.toContain("fake_news");
    expect(session.schemePreview("c3", "fake_news", "c2")).toEqual({ ok: false, reason: "only some careers can do this" });
    const news = session.schemePreview("c1", "fake_news", "c2");
    expect(news).toMatchObject({ ok: true, success: 0.75 }); // 0.6 + 0.15 for the journalist
    const stranger = session.schemePreview("c3", "rumour", "c2") as { success: number; risk: number };
    expect(stranger.risk).toBeLessThan(0.3); // strangers rarely suspect you
  });

  it("plan → prepare (one boost) → carry out; a caught culprit can be paid back with a free scheme", () => {
    let found = false;
    for (let k = 0; k < 80 && !found; k++) {
      // The victim (c2) answers with revenge whenever they can.
      const w = world(`t8-flow-${k}`, ["teacher", "doctor", "mechanic"], (id, offer) => (id === "c2" ? (offer.choices.find((c) => c.id === "revenge")?.id ?? null) : null), { startAfter: 0 });
      w.run(1000);
      expect(w.session.mischief("c1", "flat_tyres", "c2")).toEqual({ ok: true });
      const scheme = w.session.mischiefState("c1").schemes![0]!;
      expect(scheme).toMatchObject({ state: "preparing", readyAt: scheme.startedAt + 10_000 });
      expect(w.session.boostScheme("c1", scheme.id, "cover")).toEqual({ ok: true });
      expect(w.session.boostScheme("c1", scheme.id, "wait")).toEqual({ ok: false, reason: "you already did something for this one" });
      expect(Math.abs(w.session.mischiefState("c1").schemes![0]!.risk - scheme.risk / 2)).toBeLessThan(0.006); // rounded to whole percent
      w.run(60_000);
      const done = w.session.mischiefState("c1").schemes![0]!;
      expect(done.state).toBe("done");
      if (!(done.discovered && done.result === "worked")) continue;
      // The victim saw who it was: a clue, the "caught" choices, and revenge for free.
      const offer = w.notices.find((x) => x.id === "c2" && x.n.kind === "event" && x.n.view.offer.eventId === "mischief_flat_tyres");
      if (!offer || offer.n.kind !== "event") continue;
      expect(offer.n.view.offer.clue).toMatch(/camera/);
      expect(offer.n.view.offer.choices.map((c) => c.id)).toEqual(expect.arrayContaining(["confront", "report", "revenge"]));
      expect(w.session.mischiefState("c2").revengeOn).toEqual(["c1"]);
      expect(w.session.schemePreview("c2", "rumour", "c1")).toMatchObject({ ok: true, free: true });
      const charges = w.session.mischiefState("c2").charges;
      expect(w.session.mischief("c2", "rumour", "c1")).toEqual({ ok: true });
      expect(w.session.mischiefState("c2").charges).toBe(charges); // revenge did not use a charge
      found = true;
    }
    expect(found).toBe(true);
  });

  it("an accomplice who betrays you gives you away", () => {
    // Everyone is around from the start, so the accomplice is free to be asked during the 40 s of preparation.
    const w = world("t8-accomplice", ["teacher", "doctor", "mechanic"], (_id, offer) => (offer.eventId === "scheme_accomplice" ? "betray" : null), { startAfter: 0, prep: 40 });
    w.run(1000);
    expect(w.session.mischief("c1", "rumour", "c2")).toEqual({ ok: true });
    const id = w.session.mischiefState("c1").schemes![0]!.id;
    expect(w.session.boostScheme("c1", id, "accomplice", "c2")).toEqual({ ok: false, reason: "invalid accomplice" });
    expect(w.session.boostScheme("c1", id, "accomplice", "c3")).toEqual({ ok: true });
    w.run(60_000);
    const s = w.session.mischiefState("c1").schemes![0]!;
    expect(s).toMatchObject({ accomplice: "c3", accompliceAnswer: "betrayed", discovered: true });
    expect(w.notices.some((x) => x.id === "c1" && x.n.kind === "scheme" && /went straight to/.test(x.n.text))).toBe(true);
  });

  it("the Life Recap tells the whole scheme", () => {
    const w = world("t8-recap", ["teacher", "doctor", "mechanic"]);
    w.run(1000);
    w.session.mischief("c1", "rumour", "c2");
    const id = w.session.mischiefState("c1").schemes![0]!.id;
    w.session.boostScheme("c1", id, "wait");
    w.run(1_000_000);
    const recap = w.notices.find((x) => x.id === "c1" && x.n.kind === "session_completed");
    const played = recap?.n.kind === "session_completed" ? recap.n.recap.secrets.played[0] : undefined;
    expect(played).toMatchObject({ mischief: "Start a rumour", boost: "wait" });
    expect(["worked", "failed"]).toContain(played?.result);
  });
});

describe("T9: guessing while you wait", () => {
  it("others may guess once what a decider will choose, and hear how it turned out; the recap counts it", () => {
    const clock = new VirtualClock();
    const session = new Session(content, resolveConfig({ seed: "t9", durationSeconds: 200 }), ["doctor", "teacher", "mechanic", "civilian", "lawyer", "journalist"].map((career) => ({ career, isBot: false })), clock);
    const notices: { id: string; n: Notice }[] = [];
    const tried: string[] = [];
    session.onNotice = (id, n) => {
      notices.push({ id, n });
      if (n.kind === "guessable" && id === "c1" && !tried.includes(n.instanceId)) {
        tried.push(n.instanceId);
        const first = n.choices[0]!.id;
        expect(session.guess("c1", n.instanceId, n.deciderId, "no_such_choice")).toEqual({ ok: false, reason: "not one of their choices" });
        expect(session.guess("c1", n.instanceId, n.deciderId, first)).toEqual({ ok: true });
        expect(session.guess("c1", n.instanceId, n.deciderId, first)).toEqual({ ok: false, reason: "you already guessed" });
        expect(session.guess(n.deciderId, n.instanceId, n.deciderId, first)).toEqual({ ok: false, reason: "you are in it" });
      }
    };
    session.start();
    for (let i = 0; i < 20_000 && session.state === "active"; i++) {
      clock.advanceTo(session.nextWakeAt() ?? clock.now() + 1000);
      session.processTimers();
    }
    const offers = notices.filter((x) => x.n.kind === "guessable");
    // Never offered to someone who is in that event.
    for (const { id, n } of offers) {
      if (n.kind !== "guessable") continue;
      const started = session.log.find((e) => e.type === "event_started" && e.instanceId === n.instanceId) as { bindings: Record<string, string[]> };
      expect(Object.values(started.bindings).flat()).not.toContain(id);
    }
    const results = notices.filter((x) => x.id === "c1" && x.n.kind === "guess_result");
    expect(tried.length).toBeGreaterThan(3);
    expect(results.length).toBeGreaterThan(3);
    const recap = notices.find((x) => x.id === "c1" && x.n.kind === "session_completed");
    const oracle = recap?.n.kind === "session_completed" ? recap.n.recap.oracle : undefined;
    expect(oracle?.guesses).toBe(tried.length);
    expect(oracle?.correct).toBe(results.filter((x) => x.n.kind === "guess_result" && x.n.correct).length);
  });

  it("guesses replay identically", () => {
    const run = () =>
      runSession({
        content,
        config: { seed: "t9-replay", durationSeconds: 120 },
        participants: ["doctor", "teacher", "mechanic"].map((career, i) => ({ career, isBot: true, controller: new RandomController(new Rng(`g${i}`), 0) })),
        guesses: [{ t: 30_000, characterId: "c1", instanceId: "E2", deciderId: "c2", choiceId: "x" }],
      });
    expect(JSON.stringify(run().log)).toBe(JSON.stringify(run().log));
  });
});

describe("T8b: QA can make the victim's side certain", () => {
  it("with chaos.qaForceSchemes every scheme works and its culprit is caught", () => {
    const clock = new VirtualClock();
    const session = new Session(
      content,
      resolveConfig({ seed: "qa-force", chaos: { upheavals: [0, 0], mischiefCharges: 2, followUpBoost: 1, schemePrepSeconds: [5, 5], qaForceSchemes: true } }),
      ["teacher", "doctor", "mechanic"].map((career) => ({ career, isBot: false })),
      clock,
    );
    session.start();
    expect(session.mischief("c1", "rumour", "c2")).toEqual({ ok: true });
    expect(session.mischief("c3", "flat_tyres", "c2")).toEqual({ ok: true });
    for (let i = 0; i < 200 && clock.now() < 20_000; i++) {
      clock.advanceTo(session.nextWakeAt() ?? clock.now() + 1000);
      session.processTimers();
    }
    const results = session.log.filter((e) => e.type === "scheme_result");
    expect(results).toHaveLength(2);
    for (const r of results) expect(r).toMatchObject({ result: "worked", discovered: true });
  });
});

describe("T10: personal goals", () => {
  it("everyone gets two goals that go together; bots never get a goal they cannot pursue", () => {
    for (let k = 0; k < 30; k++) {
      const s = new Session(content, resolveConfig({ seed: `goals-${k}` }), [{ career: "lawyer", isBot: false }, ...["doctor", "teacher", "mechanic"].map((career) => ({ career, isBot: true }))], new VirtualClock());
      for (const id of ["c1", "c2", "c3", "c4"]) {
        const goals = s.goalsOf(id);
        expect(goals).toHaveLength(2);
        expect(goals[0]!.id).not.toBe(goals[1]!.id);
        const defs = goals.map((g) => content.goals.get(g.id)!);
        expect(defs[0]!.conflicts ?? []).not.toContain(defs[1]!.id);
        if (id !== "c1") expect(defs.some((d) => d.humansOnly)).toBe(false);
        expect(goals.every((g) => g.state === "open")).toBe(true);
      }
    }
  });

  it("a 'never' goal breaks the moment you do it, the owner is told, and the recap settles every goal", () => {
    // Find a life with "Never tell a lie" and make that player lie at the first chance.
    for (let k = 0; k < 200; k++) {
      const seed = `honest-${k}`;
      const probe = new Session(content, resolveConfig({ seed }), ["lawyer", "doctor", "teacher", "mechanic"].map((career) => ({ career, isBot: false })), new VirtualClock());
      if (!probe.goalsOf("c1").some((g) => g.id === "honest")) continue;
      const notices: Notice[] = [];
      let lied = false;
      runSession({
        content,
        config: { seed },
        participants: [
          { career: "lawyer", isBot: false, controller: scripted((v) => {
            const lie = v.offer.choices.find((c) => c.tags.includes("lie"));
            if (lie && !lied) {
              lied = true;
              return lie.id;
            }
            return v.offer.choices.find((c) => !c.tags.includes("lie"))?.id ?? v.offer.choices[0]!.id;
          }) },
          ...["doctor", "teacher", "mechanic"].map((career, i) => ({ career, isBot: false, controller: new RandomController(new Rng(`h${i}`), 0) })),
        ],
        onNotice: (id, n) => id === "c1" && notices.push(n),
      });
      if (!lied) continue;
      const update = notices.find((n) => n.kind === "goals" && n.goals.some((g) => g.id === "honest" && g.state === "broken"));
      expect(update).toBeDefined();
      const recap = notices.find((n) => n.kind === "session_completed");
      const goals = recap?.kind === "session_completed" ? recap.recap.goals : [];
      expect(goals).toHaveLength(2);
      expect(goals.find((g) => g.id === "honest")?.done).toBe(false);
      return;
    }
    throw new Error("no life with the honesty goal and a chance to lie");
  });
});

describe("T11: a title for a life, and a year in an emoji", async () => {
  const { titleFor, yearEmoji, TITLES } = await import("../src/titles");
  const base = {
    characterId: "c1", name: "Ana", career: "lawyer", isBot: false, sessionDurationMs: 480_000, lifeDurationMs: 480_000, ageAtEnd: 34, eventsCount: 12,
    finalStatus: "active" as const, outcomes: [], startAttrs: { health: 70, mental: 70, money: 50, reputation: 50, career: 50 },
    finalAttrs: { health: 70, mental: 70, money: 50, reputation: 50, career: 50 }, keyMoments: [], relationshipsGained: [], relationshipsLost: [],
    influencedBy: [], secrets: { played: [], suffered: [] }, oracle: { guesses: 0, correct: 0 }, goals: [], lifeScore: 60,
  };
  const facts = (over: Partial<Parameters<typeof titleFor>[0]> = {}) => ({
    recap: base, tags: new Map(), choices: new Map(), sharedEvents: 10, owedBy: 0, owes: 0, savedSomeone: false, married: false, revengeWorked: false, minHealth: 70, lifeShare: 1, ...over,
  });

  it("has at least 15 titles, all different, with a fallback", () => {
    expect(TITLES.length).toBeGreaterThanOrEqual(15);
    expect(new Set(TITLES.map((t) => t.label)).size).toBe(TITLES.length);
    expect(titleFor(facts()).label).toBe("A Quiet Life");
  });

  it("picks the title that fits the life", () => {
    expect(titleFor(facts({ recap: { ...base, finalStatus: "dead", lifeDurationMs: 100_000 }, lifeShare: 0.2 })).label).toBe("Gone Too Soon");
    expect(titleFor(facts({ recap: { ...base, secrets: { played: [{ mischief: "a", on: "Kim", result: "worked" }, { mischief: "b", on: "Ben", result: "worked" }], suffered: [] } } })).label).toBe("Never Caught");
    expect(titleFor(facts({ recap: { ...base, secrets: { played: [{ mischief: "a", on: "Kim", result: "worked", discovered: true }, { mischief: "b", on: "Ben", result: "worked" }], suffered: [] } } })).label).not.toBe("Never Caught");
    expect(titleFor(facts({ choices: new Map([["report", 2]]) })).label).toBe("The Town Snitch");
    expect(titleFor(facts({ savedSomeone: true })).label).toBe("Hero of the Town");
    expect(titleFor(facts({ married: true })).label).toBe("Married by the Finale");
    expect(titleFor(facts({ tags: new Map([["help", 6]]), recap: { ...base, finalAttrs: { ...base.finalAttrs, money: 20 } } })).label).toBe("Bailed Everyone Out, Died Broke");
  });

  it("a year's emoji is its biggest change (a wedding and a death win)", () => {
    expect(yearEmoji({ money: 12, health: -3 }, {})).toBe("💰");
    expect(yearEmoji({ health: -20 }, {})).toBe("🤕");
    expect(yearEmoji({ money: 30 }, { partner: true })).toBe("💍");
    expect(yearEmoji({}, { died: true })).toBe("🪦");
    expect(yearEmoji({ career: 1 }, {})).toBe("🙂");
  });

  it("every recap has a title and one emoji per year of life", () => {
    const { result } = play("t11-recap");
    for (const r of result.recaps) {
      expect(r.title.label.length).toBeGreaterThan(0);
      expect(r.years.length).toBeGreaterThanOrEqual(1);
      expect(r.years.length).toBeLessThanOrEqual(r.ageAtEnd - 18 + 1);
    }
  });
});

describe("T12: a ghost after death", async () => {
  const { buildContent, event } = await import("./helpers");
  const choices = [
    { id: "ok", label: "OK", tags: ["help"] },
    { id: "no", label: "No", tags: ["refuse"], default: true },
  ];

  it("a dead human gets ghost powers: one push per decade, a vote and a will, all in everyone's recap", () => {
    const clock = new VirtualClock();
    const session = new Session(content, resolveConfig({ seed: "ghost", qaEndFirstHumanAtSeconds: 10 }), [{ career: "lawyer", isBot: false }, ...["doctor", "teacher", "mechanic"].map((career) => ({ career, isBot: true }))], clock);
    const notices: Notice[] = [];
    let pushed = false;
    let voted = false;
    session.onNotice = (id, n) => {
      if (id !== "c1") return;
      notices.push(n);
      if (n.kind === "guessable" && session.ghostState("c1").isGhost) {
        if (!pushed) {
          expect(session.ghostNudge("c1", n.instanceId)).toEqual({ ok: true });
          expect(session.ghostNudge("c1", n.instanceId)).toEqual({ ok: false, reason: "wait for the next decade" });
          pushed = true;
        }
      }
    };
    session.onPublic = (e) => {
      if (e.kind === "event" && e.participants.length >= 2 && session.ghostState("c1").isGhost && !voted) voted = session.ghostVote("c1", e.instanceId).ok;
    };
    session.start();
    expect(session.ghostState("c1").isGhost).toBe(false);
    expect(session.ghostWill("c1", content.wills[0]!)).toEqual({ ok: false, reason: "only ghosts can do that" });
    for (let i = 0; i < 20_000 && session.state === "active"; i++) {
      if (session.ghostState("c1").isGhost && !session.ghostState("c1").will) {
        expect(session.ghostWill("c1", "made up")).toEqual({ ok: false, reason: "not one of the sentences" });
        expect(session.ghostWill("c1", content.wills[1]!)).toEqual({ ok: true });
      }
      clock.advanceTo(session.nextWakeAt() ?? clock.now() + 1000);
      session.processTimers();
    }
    expect(notices.some((n) => n.kind === "ghost" && n.state.isGhost)).toBe(true);
    expect(pushed && voted).toBe(true);
    const recaps = session.result().recaps;
    for (const r of recaps) {
      expect(r.town?.gossipOfTheYear?.votes).toBe(1);
      expect(r.town?.wills.some((w) => w.text === content.wills[1])).toBe(true);
    }
    expect(recaps.find((r) => r.characterId === "c1")?.ghost).toEqual({ nudges: 1 });
  });

  it("a push adds 10 % to the first outcome left to chance", () => {
    const bundle = buildContent([event({ id: "dice", cooldown: { maxPerSession: 1 }, roles: { a: { count: 1 } }, choices: { a: choices }, outcomes: [{ id: "lucky", chance: 0.9 }, { id: "plain" }] })]);
    let plainWithout = 0;
    let plainWith = 0;
    for (let k = 0; k < 40; k++) {
      for (const nudge of [false, true]) {
        const clock = new VirtualClock();
        const s = new Session(bundle, resolveConfig({ seed: `dice-${k}`, durationSeconds: 60, ...(nudge ? { qaEndFirstHumanAtSeconds: 0 } : {}) }), [{ career: "lawyer", isBot: false }, { career: "doctor", isBot: true }], clock);
        if (nudge) s.onNotice = (id, n) => id === "c1" && n.kind === "guessable" && s.ghostNudge("c1", n.instanceId);
        s.start();
        for (let i = 0; i < 2000 && s.state === "active"; i++) {
          clock.advanceTo(s.nextWakeAt() ?? clock.now() + 1000);
          s.processTimers();
        }
        // With a push, the human is a ghost from the start and pushes the bot's roll.
        for (const r of s.log.filter((e) => e.type === "event_resolved" && e.eventId === "dice") as { outcomeId: string }[]) {
          if (r.outcomeId === "plain") {
            if (nudge) plainWith++;
            else plainWithout++;
          }
        }
      }
    }
    expect(plainWithout).toBeGreaterThan(0); // 10 % of the time without a push
    expect(plainWith).toBe(0); // 0.9 + 0.1 = certain
  });

  it("bots sometimes leave a will too", () => {
    const wills = new Set<string>();
    for (let k = 0; k < 60 && wills.size === 0; k++) {
      const { result } = play(`bot-wills-${k}`);
      for (const w of result.recaps[0]?.town?.wills ?? []) wills.add(w.text);
    }
    expect(wills.size).toBeGreaterThan(0);
  });
});
