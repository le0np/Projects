import { describe, expect, it } from "vitest";
import { Rng, VirtualClock, type Notice } from "@lifesim/core";
import { loadContent } from "@lifesim/content";
import { RandomController, Session, resolveConfig, runSession } from "../src";

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
