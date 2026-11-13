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
