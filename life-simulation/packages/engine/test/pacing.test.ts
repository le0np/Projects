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
