import { describe, expect, it } from "vitest";
import { loadContent } from "@lifesim/content";
import { runBotSession } from "../src";

const content = loadContent();

describe("bot-only sessions", () => {
  const runs = Array.from({ length: 20 }, (_, i) => runBotSession({ content, seed: `bots-${i}`, players: 2 + (i % 7) }));

  it("complete without supervision and every bot decides before its deadline", () => {
    for (const { result } of runs) {
      expect(result.state).toBe("completed");
      expect(result.stats.decisionsRejected).toBe(0);
      expect(result.stats.decisionsDefaulted).toBe(0);
      expect(result.stats.eventsResolved).toBeGreaterThan(0);
    }
  });

  it("are reproducible from the seed", () => {
    const a = runBotSession({ content, seed: "repro", players: 6 });
    const b = runBotSession({ content, seed: "repro", players: 6 });
    expect(JSON.stringify(b.result.log)).toBe(JSON.stringify(a.result.log));
  });

  it("honour requested careers and archetypes", () => {
    const { bots } = runBotSession({ content, seed: "pick", players: 3, careers: ["doctor", "lawyer"], archetypes: ["naive"] });
    expect(bots.map((b) => b.career).slice(0, 2)).toEqual(["doctor", "lawyer"]);
    expect(bots[0]!.controller.profile.archetype).toBe("naive");
    expect(() => runBotSession({ content, seed: "x", players: 1 })).toThrow();
  });
});

import { aggregate, formatReport, replaySession, runBatch } from "../src";

describe("batch, statistics and replay", () => {
  const runs = runBatch({ content, seed: "batch-test", sessions: 15, players: [2, 8] });

  it("aggregates the statistics required by the spec", () => {
    const s = aggregate(runs, content);
    expect(s.sessions).toBe(15);
    expect(s.characters).toBe(runs.reduce((n, r) => n + r.result.recaps.length, 0));
    expect(s.eventsPerSession.mean).toBeGreaterThan(0);
    expect(Object.keys(s.career).length).toBeGreaterThan(3);
    expect(Object.keys(s.archetype).length).toBeGreaterThan(3);
    const report = formatReport(s);
    for (const section of ["Death rate", "Event repetition", "Follow-ups", "## Careers", "## Bot personalities", "## Events"]) {
      expect(report).toContain(section);
    }
  });

  it("replays sessions identically from the recorded log", () => {
    for (const run of runs.slice(0, 5)) expect(replaySession(content, run.result.log).identical).toBe(true);
  });

  it("detects a tampered log", () => {
    const log = structuredClone(runs[0]!.result.log);
    const decision = log.find((e) => e.type === "decision" && e.source === "player");
    if (decision?.type !== "decision") throw new Error("no decision");
    decision.t += 1; // the same decision, one millisecond later
    expect(replaySession(content, log).identical).toBe(false);
  });
});
