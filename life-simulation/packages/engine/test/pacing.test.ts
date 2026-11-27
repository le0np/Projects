import { describe, expect, it } from "vitest";
import { Rng, type Notice } from "@lifesim/core";
import { loadContent } from "@lifesim/content";
import { RandomController, humanPacing, runSession } from "../src";
import { scripted } from "./helpers";

const content = loadContent();

/** One human (answers after 3 real seconds) with five random bots; returns what the human was offered. */
function playHuman(timeScale: number, seed: string) {
  const offers: Extract<Notice, { kind: "event" }>["view"]["offer"][] = [];
  const human = scripted((view) => {
    offers.push(view.offer);
    return view.offer.choices[0]!.id;
  }, 3000 * timeScale);
  const result = runSession({
    content,
    config: { seed, humanPacing: humanPacing(timeScale) },
    participants: [
      { career: "lawyer", isBot: false, controller: human },
      ...["doctor", "teacher", "mechanic", "civilian", "journalist"].map((career, i) => ({
        career,
        isBot: true,
        controller: new RandomController(new Rng(`${seed}-${i}`)),
      })),
    ],
  });
  return { offers, result };
}

describe("T1: human deadlines in real seconds", () => {
  for (const timeScale of [1, 6]) {
    it(`gives a human at least 15 s (important: 25 s) of real time at TIME_SCALE=${timeScale}`, () => {
      for (const seed of ["p1", "p2", "p3"]) {
        const { offers } = playHuman(timeScale, `${seed}-${timeScale}`);
        expect(offers.length).toBeGreaterThan(3);
        for (const o of offers) {
          const realSeconds = (o.deadlineAt - o.offeredAt) / timeScale / 1000;
          expect(realSeconds).toBeGreaterThanOrEqual(o.importance === "important" ? 25 : 15);
          expect(realSeconds).toBeLessThanOrEqual(45);
        }
      }
    });
  }

  it("leaves bot-only sessions untouched (sim speed)", () => {
    const run = (humanPacingOn: boolean) =>
      runSession({
        content,
        config: { seed: "bots", ...(humanPacingOn ? { humanPacing: humanPacing(6) } : {}) },
        participants: ["doctor", "teacher", "mechanic"].map((career, i) => ({ career, isBot: true, controller: new RandomController(new Rng(`b${i}`)) })),
      });
    const a = run(false).log.filter((e) => e.type === "event_started");
    const b = run(true).log.filter((e) => e.type === "event_started");
    expect(b.map((e) => [e.eventId, e.offerAt, e.deadlineAt])).toEqual(a.map((e) => [e.eventId, e.offerAt, e.deadlineAt]));
  });

  it("is deterministic (replay-safe): same seed, same session", () => {
    expect(JSON.stringify(playHuman(6, "det").result.log)).toBe(JSON.stringify(playHuman(6, "det").result.log));
  });
});

describe("T3: tension curve and finale", () => {
  /** Gaps (real seconds) between the end of a human's event and their next offer. */
  function gaps(timeScale: number, sessions: number) {
    const out: number[] = [];
    const results = [];
    for (let k = 0; k < sessions; k++) {
      let last: number | null = null;
      results.push(
        runSession({
          content,
          config: { seed: `gap-${timeScale}-${k}`, humanPacing: humanPacing(timeScale) },
          participants: [
            { career: "lawyer", isBot: false, controller: { decide: (v) => ({ choiceId: v.offer.choices[0]!.id, thinkMs: 4000 * timeScale }) } },
            ...["doctor", "teacher", "mechanic", "civilian", "journalist"].map((career, i) => ({ career, isBot: true, controller: new RandomController(new Rng(`g${k}${i}`)) })),
          ],
          onNotice: (id, n) => {
            if (id !== "c1") return;
            if (n.kind === "resolved" && n.myChoice) last = n.t;
            // The wait for the finale is measured live (server test): there the thinking bots answer at once.
            if (n.kind === "event" && n.view.offer.choices.length > 0 && last !== null && !n.view.offer.eventId.startsWith("finale_")) {
              out.push((n.t - last) / timeScale / 1000);
            }
          },
        }),
      );
    }
    return { gaps: out.sort((a, b) => a - b), results };
  }

  it("every session has its phases in order and ends with a finale for everyone alive", () => {
    for (let k = 0; k < 10; k++) {
      const result = runSession({
        content,
        config: { seed: `story-${k}` },
        participants: ["doctor", "teacher", "mechanic", "civilian", "journalist", "lawyer"].map((career, i) => ({ career, isBot: true, controller: new RandomController(new Rng(`s${k}${i}`)) })),
      });
      const phases = result.log.filter((e) => e.type === "phase_changed").map((e) => (e as { phase: string }).phase);
      expect(phases).toEqual(["intro", "growth", "climax", "respite", "finale"]);
      expect(result.endReason).toBe("finale");
      const finale = result.log.find((e) => e.type === "event_started" && e.eventId.startsWith("finale_")) as Extract<(typeof result.log)[number], { type: "event_started" }>;
      expect(finale.phase).toBe("finale");
      const ended = new Set(result.log.filter((e) => e.type === "character_ended" && e.t < finale.t).map((e) => (e as { characterId: string }).characterId));
      const alive = ["c1", "c2", "c3", "c4", "c5", "c6"].filter((id) => !ended.has(id));
      expect(Object.values(finale.bindings).flat().sort()).toEqual(alive);
      // Nothing else starts once the finale is due, and nothing critical in the intro.
      const timeline = result.log.filter((e) => e.type === "event_started") as Extract<(typeof result.log)[number], { type: "event_started" }>[];
      for (const e of timeline) {
        if (e.phase === "intro") expect(content.events.get(e.eventId)!.category).not.toBe("critical");
        if (e.phase === "finale") expect(e.eventId).toBe(finale.eventId);
      }
      // The climax upheaval comes at 60–70 % of the session.
      const upheavals = result.log.filter((e) => e.type === "upheaval_started");
      expect(upheavals.length).toBeGreaterThan(0);
      const lastAt = upheavals[upheavals.length - 1]!.t / 480_000;
      expect(lastAt).toBeGreaterThanOrEqual(0.6);
      expect(lastAt).toBeLessThanOrEqual(0.72);
    }
  });

  for (const timeScale of [1, 6]) {
    it(`a human waits 8–15 s between events (median), rarely more than 20 s, at TIME_SCALE=${timeScale}`, () => {
      const { gaps: g } = gaps(timeScale, 10);
      const median = g[Math.floor(g.length / 2)]!;
      expect(median).toBeGreaterThanOrEqual(8);
      expect(median).toBeLessThanOrEqual(15);
      expect(g.filter((x) => x > 20).length / g.length).toBeLessThanOrEqual(0.03);
      expect(g.filter((x) => x < 6).length / g.length).toBeLessThanOrEqual(0.03);
    });
  }
});
