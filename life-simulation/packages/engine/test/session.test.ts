import { describe, expect, it } from "vitest";
import { Rng, VirtualClock, type Notice } from "@lifesim/core";
import { loadContent } from "@lifesim/content";
import { RandomController, Session, formatLog, resolveConfig, runSession, type LogEntryOf, type SessionResult } from "../src";
import { buildContent, event, pickDefault, scripted } from "./helpers";

const shipped = loadContent();
const CAREERS = [...shipped.careers.keys()];

function randomRun(seed: string, size: number): SessionResult {
  const rng = new Rng(`players/${seed}`);
  return runSession({
    content: shipped,
    config: { seed },
    participants: Array.from({ length: size }, (_, i) => ({
      career: rng.pick(CAREERS),
      isBot: true,
      controller: new RandomController(rng.fork(`c${i}`)),
    })),
  });
}

const entries = <T extends SessionResult["log"][number]["type"]>(r: SessionResult, type: T) =>
  r.log.filter((e): e is LogEntryOf<T> => e.type === type);

describe("determinism", () => {
  it("same seed and decisions produce an identical log", () => {
    const a = randomRun("det-1", 6);
    const b = randomRun("det-1", 6);
    expect(JSON.stringify(b.log)).toBe(JSON.stringify(a.log));
    expect(JSON.stringify(randomRun("det-2", 6).log)).not.toBe(JSON.stringify(a.log));
  });
});

describe("bot-only sessions with random decisions (invariants over many seeds)", () => {
  const runs = Array.from({ length: 40 }, (_, i) => randomRun(`inv-${i}`, 2 + (i % 7)));

  it("always complete, and only for allowed reasons", () => {
    for (const r of runs) {
      expect(r.state).toBe("completed");
      expect(["time_limit", "all_ended", "story_resolved"]).toContain(r.endReason);
      expect(r.recaps).toHaveLength(entries(r, "session_started")[0]!.characters.length);
    }
  });

  it("every started event is resolved exactly once", () => {
    for (const r of runs) {
      const started = entries(r, "event_started").map((e) => e.instanceId);
      const resolved = entries(r, "event_resolved").map((e) => e.instanceId);
      expect([...resolved].sort()).toEqual([...started].sort());
      expect(new Set(resolved).size).toBe(resolved.length);
    }
  });

  it("each character decides at most once per event and never gets rejected", () => {
    for (const r of runs) {
      const keys = entries(r, "decision").map((d) => `${d.instanceId}/${d.characterId}`);
      expect(new Set(keys).size).toBe(keys.length);
      expect(r.stats.decisionsRejected).toBe(0);
    }
  });

  it("no character is ever in two events at once, and ended characters get no new events", () => {
    for (const r of runs) {
      const busy = new Map<string, string>();
      const ended = new Set<string>();
      for (const e of r.log) {
        if (e.type === "event_started") {
          for (const id of Object.values(e.bindings).flat()) {
            expect(busy.has(id), `${id} double-booked at ${e.t}`).toBe(false);
            expect(ended.has(id), `${id} got an event after their story ended`).toBe(false);
            busy.set(id, e.instanceId);
          }
        } else if (e.type === "event_resolved") {
          for (const [id, inst] of [...busy]) if (inst === e.instanceId) busy.delete(id);
        } else if (e.type === "character_ended") {
          ended.add(e.characterId);
        }
      }
    }
  });

  it("no events start after the time limit, attributes stay in range", () => {
    for (const r of runs) {
      const limit = entries(r, "session_started")[0]!.config.durationSeconds * 1000;
      for (const e of entries(r, "event_started")) expect(e.t).toBeLessThan(limit);
      for (const recap of r.recaps) {
        for (const v of Object.values(recap.finalAttrs)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("death is possible but not mandatory", () => {
    const deaths = runs.map((r) => r.recaps.filter((c) => c.finalStatus === "dead").length);
    expect(deaths.some((d) => d === 0)).toBe(true);
  });

  it("produces a readable log", () => {
    const text = formatLog(runs[5]!.log);
    expect(text).toMatch(/^Session: S-/);
    expect(text).toContain("Session initialized");
    expect(text).toContain("Session completed");
    expect(text).not.toMatch(/\{[a-z_]+\}/); // all placeholders interpolated
  });
});

describe("information hiding", () => {
  it("unaware participants are not told about the event, only about its outcome", () => {
    const content = buildContent([
      event({
        id: "talk",
        hidden: true,
        roles: { subject: { count: 1, aware: false }, talker: { count: 1 } },
        cooldown: { maxPerSession: 1 },
        choices: { talker: [{ id: "gossip", label: "Gossip", tags: ["threaten"] }, { id: "no", label: "No", tags: ["ignore"], default: true }] },
        outcomes: [{ id: "done", effects: [{ type: "attr", target: "role:subject", delta: { reputation: -5 } }], text: { subject: "People look at you oddly." } }],
      }),
    ]);
    const seen: { id: string; n: Notice }[] = [];
    const r = runSession({
      content,
      config: { seed: "unaware" },
      participants: ["mechanic", "mechanic"].map((career) => ({ career, isBot: true, controller: scripted(() => "gossip") })),
      onNotice: (id, n) => seen.push({ id, n }),
    });
    const subject = entries(r, "event_started")[0]!.bindings.subject![0]!;
    const mine = seen.filter((s) => s.id === subject).map((s) => s.n);
    expect(mine.some((n) => n.kind === "event")).toBe(false);
    const resolved = mine.find((n) => n.kind === "resolved") as Extract<Notice, { kind: "resolved" }>;
    expect(resolved.outcomeText).toBe("People look at you oddly.");
    expect(resolved.selfChanges).toEqual({ reputation: -5 });
  });

  it("each participant sees only their own private information", () => {
    const seen: { id: string; n: Notice }[] = [];
    // Force the coworker event: two colleagues, only that event enabled.
    const content = buildContent([
      ...["career_coworker_mistake", "career_retaliation"].map((id) => structuredClone(shipped.events.get(id)) as unknown as Record<string, unknown>),
    ]);
    for (let i = 0; i < 10 && !seen.some((s) => s.n.kind === "event"); i++) {
      seen.length = 0;
      runSession({
        content,
        config: { seed: `priv-${i}`, startingRelationships: { colleaguePairRatio: 0.5, familyChance: 0, partnerChance: 0 } },
        participants: [
          { career: "civilian", isBot: true, controller: scripted(pickDefault) },
          { career: "teacher", isBot: true, controller: scripted(pickDefault) },
        ],
        onNotice: (id, n) => seen.push({ id, n }),
      });
    }
    const offers = seen.filter((s) => s.n.kind === "event").map((s) => (s.n as Extract<Notice, { kind: "event" }>).view);
    const requester = offers.find((v) => v.offer.role === "requester")!;
    const witness = offers.find((v) => v.offer.role === "witness")!;
    expect(requester.offer.privateText).toContain("You know you made the mistake");
    expect(witness.offer.privateText).toContain("You saw what actually happened");
    expect(JSON.stringify(witness)).not.toContain("You know you made the mistake");
    expect(JSON.stringify(requester)).not.toContain("You saw what actually happened");
    // Views never contain real effects or outcome rules.
    expect(JSON.stringify(requester)).not.toMatch(/"effects"|"outcomes"|"when"/);
  });
});

// ---------------------------------------------------------------- scripted scenarios

const solo = (extra: Record<string, unknown> = {}) =>
  event({
    id: "solo",
    roles: { me: { count: 1 } },
    cooldown: { maxPerSession: 1 },
    choices: {
      me: [
        { id: "a", label: "A", tags: ["help"] },
        { id: "b", label: "B", tags: ["ignore"], default: true },
        { id: "doc", label: "Doctor only", tags: ["help"], careers: ["doctor"] },
      ],
    },
    outcomes: [{ id: "chose_a", when: { chose: "a", role: "me" } }, { id: "other" }],
    ...extra,
  });

function newSession(content: ReturnType<typeof buildContent>, careers: string[], seed = "s") {
  const clock = new VirtualClock();
  const session = new Session(content, resolveConfig({ seed, initialDelaySeconds: [0, 0] }), careers.map((career) => ({ career, isBot: true })), clock);
  const notices: { id: string; n: Notice }[] = [];
  session.onNotice = (id, n) => notices.push({ id, n });
  return { clock, session, notices };
}

describe("decision intake", () => {
  it("validates decisions and accepts each at most once", () => {
    const { session, notices } = newSession(buildContent([solo()]), ["civilian"]);
    session.start();
    session.processTimers();
    const offer = notices.find((x) => x.n.kind === "event")!.n as Extract<Notice, { kind: "event" }>;
    const inst = offer.view.offer.instanceId;
    expect(offer.view.offer.choices.map((c) => c.id)).toEqual(["a", "b"]); // no doctor-only choice
    expect(session.submitDecision("c1", inst, "doc")).toEqual({ ok: false, reason: "choice not available" });
    expect(session.submitDecision("c1", "E999", "a")).toEqual({ ok: false, reason: "unknown event" });
    expect(session.submitDecision("c2", inst, "a")).toEqual({ ok: false, reason: "character does not decide in this event" });
    expect(session.submitDecision("c1", inst, "a")).toEqual({ ok: true });
    expect(session.submitDecision("c1", inst, "b")).toEqual({ ok: false, reason: "event already resolved" });
    expect(session.stats.decisionsRejected).toBe(4);
  });

  it("career-exclusive choices are offered to that career", () => {
    const { session, notices } = newSession(buildContent([solo()]), ["doctor"]);
    session.start();
    session.processTimers();
    const offer = notices.find((x) => x.n.kind === "event")!.n as Extract<Notice, { kind: "event" }>;
    const doc = offer.view.offer.choices.find((c) => c.id === "doc")!;
    expect(doc.special).toBe(true);
    expect(session.submitDecision("c1", offer.view.offer.instanceId, "doc")).toEqual({ ok: true });
  });

  it("applies the default choice when the deadline passes", () => {
    const r = runSession({
      content: buildContent([solo()]),
      config: { seed: "timeout" },
      participants: [{ career: "civilian", isBot: true, controller: scripted(() => null) }],
    });
    const d = r.log.find((e) => e.type === "decision") as LogEntryOf<"decision">;
    expect(d).toMatchObject({ choiceId: "b", source: "default" });
    expect((r.log.find((e) => e.type === "event_resolved") as LogEntryOf<"event_resolved">).outcomeId).toBe("other");
    expect(r.stats.decisionsDefaulted).toBe(1);
  });
});

describe("resolution", () => {
  const duo = event({
    id: "duo",
    category: "health",
    roles: { a: { count: 1 }, b: { count: 1 } },
    cooldown: { maxPerSession: 1 },
    choices: {
      a: [{ id: "help", label: "Help", tags: ["help"] }, { id: "no", label: "No", tags: ["refuse"], default: true }],
      b: [{ id: "help", label: "Help", tags: ["help"] }, { id: "no", label: "No", tags: ["refuse"], default: true }],
    },
    outcomes: [
      {
        id: "both",
        when: { all: [{ chose: "help", role: "a" }, { chose: "help", role: "b" }] },
        revealChoices: true,
        effects: [{ type: "relation", from: "role:a", to: "role:b", affinity: 50, mutual: true }],
      },
      { id: "betrayed", when: { chose: "help", role: "a" }, effects: [{ type: "attr", target: "role:a", delta: { health: -20 } }] },
      { id: "nobody" },
    ],
  });

  const play = (aChoice: string, bChoice: string, careers = ["civilian", "civilian"]) =>
    runSession({
      content: buildContent([duo]),
      config: { seed: "duo" },
      participants: careers.map((career, i) => ({ career, isBot: true, controller: scripted(() => (i === 0 ? aChoice : bChoice)) })),
    });

  const outcomeOf = (r: SessionResult) => (r.log.find((e) => e.type === "event_resolved") as LogEntryOf<"event_resolved">).outcomeId;

  it("outcomes depend on the combination of simultaneous decisions", () => {
    // Role assignment is random, so map choices by role instead of character.
    const byRole = (a: string, b: string) =>
      runSession({
        content: buildContent([duo]),
        config: { seed: "duo" },
        participants: [0, 1].map(() => ({ career: "civilian", isBot: true, controller: scripted((v) => (v.offer.role === "a" ? a : b)) })),
      });
    expect(outcomeOf(byRole("help", "help"))).toBe("both");
    expect(outcomeOf(byRole("help", "no"))).toBe("betrayed");
    expect(outcomeOf(byRole("no", "help"))).toBe("nobody");
    const both = byRole("help", "help");
    const rel = (both.log.find((e) => e.type === "event_resolved") as LogEntryOf<"event_resolved">).changes.filter((c) => c.kind === "relation");
    expect(rel).toHaveLength(2);
    expect(rel.every((c) => c.kind === "relation" && c.type === "friend")).toBe(true); // affinity 50 → derived friend
  });

  it("reveals other participants' choices only when the outcome says so", () => {
    const shown = scripted(() => "help");
    runSession({
      content: buildContent([duo]),
      config: { seed: "duo" },
      participants: [{ career: "civilian", isBot: true, controller: shown }, { career: "civilian", isBot: true, controller: scripted(() => "help") }],
    });
    const resolved = shown.notices.find((n) => n.kind === "resolved") as Extract<Notice, { kind: "resolved" }>;
    expect(resolved.revealed).toHaveLength(1);
    const hidden = scripted(() => "no");
    runSession({
      content: buildContent([duo]),
      config: { seed: "duo" },
      participants: [{ career: "civilian", isBot: true, controller: hidden }, { career: "civilian", isBot: true, controller: scripted(() => "no") }],
    });
    expect((hidden.notices.find((n) => n.kind === "resolved") as Extract<Notice, { kind: "resolved" }>).revealed).toHaveLength(0);
  });

  it("career abilities scale attribute changes", () => {
    const loss = (career: string) => {
      const r = runSession({
        content: buildContent([duo]),
        config: { seed: "duo" },
        participants: [career, "civilian"].map((c, i) => ({
          id: `p${i}`,
          career: c,
          isBot: true,
          controller: scripted((v) => (v.offer.role === "a" ? "help" : "no")),
        })),
      });
      const started = r.log.find((e) => e.type === "event_started") as LogEntryOf<"event_started">;
      const victim = started.bindings.a![0]!;
      const change = (r.log.find((e) => e.type === "event_resolved") as LogEntryOf<"event_resolved">).changes.find(
        (c) => c.kind === "attr" && c.characterId === victim,
      );
      return { victim, delta: change?.kind === "attr" ? change.delta : 0 };
    };
    // Doctor: health losses ×0.6 in health events; civilian: unscaled.
    const doc = loss("doctor");
    expect(doc.delta).toBe(doc.victim === "p0" ? -12 : -20);
  });
});

describe("follow-ups, endings and recap", () => {
  const chain = [
    event({
      id: "first",
      roles: { x: { count: 1 } },
      cooldown: { maxPerSession: 1 },
      choices: { x: [{ id: "go", label: "Go", tags: ["risk"] }, { id: "stay", label: "Stay", tags: ["ignore"], default: true }] },
      outcomes: [
        {
          id: "went",
          when: { chose: "go", role: "x" },
          followUps: [{ event: "second", delaySeconds: 10, roles: { y: "role:x" } }],
        },
        { id: "stayed" },
      ],
    }),
    event({
      id: "second",
      trigger: "followup_only",
      roles: { y: { count: 1 } },
      choices: { y: [{ id: "ok", label: "Ok", tags: ["truth"], default: true }, { id: "die", label: "Die", tags: ["risk"] }] },
      outcomes: [
        {
          id: "died",
          when: { chose: "die", role: "y" },
          important: true,
          effects: [{ type: "status", target: "role:y", status: "dead", cause: "Took one risk too many" }],
        },
        { id: "fine", endsSession: true },
      ],
    }),
  ];

  it("delayed follow-ups keep their participants and causal link", () => {
    const r = runSession({
      content: buildContent(chain),
      config: { seed: "chain" },
      participants: [{ career: "civilian", isBot: true, controller: scripted((v) => (v.offer.eventId === "first" ? "go" : "ok")) }],
    });
    const [first, second] = entries(r, "event_started");
    const firstResolved = entries(r, "event_resolved")[0]!;
    expect(second).toMatchObject({ eventId: "second", parentInstanceId: first!.instanceId, bindings: { y: ["c1"] } });
    expect(second!.t).toBeGreaterThanOrEqual(firstResolved.t + 10_000);
    expect(r.stats).toMatchObject({ followUpsScheduled: 1, followUpsActivated: 1 });
    expect(r.endReason).toBe("story_resolved");
  });

  it("death ends the character's story and, when everyone has ended, the session", () => {
    const r = runSession({
      content: buildContent(chain),
      config: { seed: "chain" },
      participants: [{ career: "civilian", isBot: true, controller: scripted((v) => (v.offer.eventId === "first" ? "go" : "die")) }],
    });
    expect(r.endReason).toBe("all_ended");
    expect(entries(r, "character_ended")[0]).toMatchObject({ characterId: "c1", status: "dead" });
    const recap = r.recaps[0]!;
    expect(recap.finalStatus).toBe("dead");
    expect(recap.outcomes).toContain("death");
    expect(recap.keyMoments[0]).toMatchObject({ choiceLabel: "Die" });
    expect(recap.lifeDurationMs).toBeLessThan(r.durationMs + 1);
  });

  it("follow-ups for characters who are no longer active are dropped", () => {
    const killer = event({
      id: "first",
      roles: { x: { count: 1 } },
      cooldown: { maxPerSession: 1 },
      choices: { x: [{ id: "go", label: "Go", tags: ["risk"] }, { id: "stay", label: "Stay", tags: ["ignore"], default: true }] },
      outcomes: [
        {
          id: "went",
          effects: [{ type: "status", target: "role:x", status: "imprisoned", cause: "Caught" }],
          followUps: [{ event: "second", delaySeconds: 5, roles: { y: "role:x" } }],
        },
      ],
    });
    const r = runSession({
      content: buildContent([killer, chain[1]!]),
      config: { seed: "drop" },
      participants: ["civilian", "civilian"].map((career) => ({ career, isBot: true, controller: scripted(() => "go") })),
    });
    expect(r.stats.followUpsDropped.participant_unavailable).toBeGreaterThanOrEqual(1);
    expect(r.recaps.some((c) => c.outcomes.includes("imprisonment"))).toBe(true);
  });

  it("health reaching zero kills; facts grant recap tags to the right character", () => {
    const rescue = event({
      id: "rescue",
      category: "critical",
      roles: { victim: { count: 1 }, hero: { count: 1 } },
      cooldown: { maxPerSession: 1 },
      choices: { hero: [{ id: "save", label: "Save", tags: ["help", "sacrifice"] }, { id: "leave", label: "Leave", tags: ["ignore"], default: true }] },
      outcomes: [
        {
          id: "saved",
          when: { chose: "save", role: "hero" },
          important: true,
          effects: [
            { type: "fact", target: "role:victim", key: "saved_by", about: "role:hero" },
            { type: "attr", target: "role:hero", delta: { health: -100 } },
          ],
        },
        { id: "left" },
      ],
    });
    const r = runSession({
      content: buildContent([rescue]),
      config: { seed: "hero" },
      participants: ["civilian", "civilian"].map((career) => ({ career, isBot: true, controller: scripted(() => "save") })),
    });
    const started = entries(r, "event_started")[0]!;
    const hero = r.recaps.find((c) => c.characterId === started.bindings.hero![0])!;
    const victim = r.recaps.find((c) => c.characterId === started.bindings.victim![0])!;
    expect(hero.finalStatus).toBe("dead");
    expect(hero.outcomes).toEqual(expect.arrayContaining(["death", "saved_another", "personal_sacrifice"]));
    expect(victim.outcomes).not.toContain("saved_another");
    expect(victim.influencedBy).toEqual([]); // hero's choice changed only the hero's attributes
  });
});

describe("setup", () => {
  it("creates starting relationships and applies career start bonuses", () => {
    const r = randomRun("setup", 8);
    const start = entries(r, "session_started")[0]!;
    expect(start.relations.filter((x) => x.type === "colleague")).toHaveLength(2);
    const { session } = newSession(shipped, ["entrepreneur", "teacher"], "bonus");
    session.start();
    const chars = (session.log[0] as LogEntryOf<"session_started">).characters;
    // entrepreneur +20 money, teacher -10 money, base 50 ± 8
    expect(chars[0]!.attrs.money).toBeGreaterThanOrEqual(62);
    expect(chars[1]!.attrs.money).toBeLessThanOrEqual(48);
  });

  it("rejects unknown careers and invalid participant counts", () => {
    expect(() => newSession(shipped, ["astronaut"])).toThrow(/unknown career/);
    expect(() => newSession(shipped, [])).toThrow();
  });
});

describe("life calendar (concept v2)", () => {
  const quiet = event({
    id: "quiet",
    roles: { me: { count: 1 } },
    cooldown: { maxPerSession: 1 },
    choices: { me: [{ id: "a", label: "A", tags: ["help"] }, { id: "b", label: "B", tags: ["ignore"], default: true }] },
    outcomes: [{ id: "done" }],
  });

  it("logs every season, ages characters and reports the age at the end", () => {
    const seen: Notice[] = [];
    const r = runSession({
      content: buildContent([quiet]),
      config: { seed: "calendar", durationSeconds: 120, yearSeconds: 30, startAge: 40, aging: { fromAge: 40, healthPerYear: 5 } },
      participants: [{ career: "mechanic", isBot: true, controller: scripted(pickDefault) }],
      onNotice: (_id, n) => seen.push(n),
    });
    const seasons = entries(r, "season_changed");
    expect(seasons.map((e) => e.season)).toEqual(["summer", "autumn", "winter", "spring", "summer", "autumn", "winter", "spring", "summer", "autumn", "winter", "spring", "summer", "autumn", "winter"]);
    expect(seasons.filter((e) => e.season === "spring").map((e) => e.year)).toEqual([1, 2, 3]);
    const recap = r.recaps[0]!;
    expect(recap.ageAtEnd).toBe(44);
    // ages 41, 42, 43 are past fromAge → 3 × 5 health lost (mechanic: health losses ×0.85 do not apply to aging)
    expect(recap.startAttrs.health - recap.finalAttrs.health).toBe(15);
    const offer = seen.find((n) => n.kind === "event") as Extract<Notice, { kind: "event" }>;
    expect(offer.view.self.age).toBe(40);
    expect(offer.view.calendar).toEqual({ year: 0, season: "spring" });
  });

  it("events can depend on age and season", () => {
    const winterOnly = event({ ...quiet, id: "winter_only", conditions: undefined, roles: { me: { count: 1, conditions: { all: [{ age: { gte: 19 } }] } } } });
    const content = buildContent([{ ...winterOnly, conditions: { seasonIn: ["winter"] } }]);
    const r = runSession({
      content,
      config: { seed: "season-gate", durationSeconds: 60, yearSeconds: 40 },
      participants: [{ career: "civilian", isBot: true, controller: scripted(pickDefault) }],
    });
    const started = entries(r, "event_started")[0];
    // 18 until 40 s, winter of year 0 starts at 30 s → must wait for age 19 (≥ 40 s), and season winter is over by then
    expect(started).toBeUndefined();
    const r2 = runSession({
      content,
      config: { seed: "season-gate", durationSeconds: 100, yearSeconds: 40 },
      participants: [{ career: "civilian", isBot: true, controller: scripted(pickDefault) }],
    });
    const s2 = entries(r2, "event_started")[0]!;
    expect(s2.t).toBeGreaterThanOrEqual(70_000); // winter of year 1: 70–80 s, age 19
    expect(s2.t).toBeLessThan(80_000);
  });
});
