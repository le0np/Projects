/**
 * Replay (TESTING_SIMULATION §4): reconstructs a session from its recorded log —
 * seed, configuration, content version and every player decision with its time —
 * and checks that the re-run produces the identical log.
 */
import type { Controller } from "@lifesim/core";
import type { ContentBundle } from "@lifesim/content";
import { runSession, type LogEntry, type LogEntryOf, type SessionResult } from "@lifesim/engine";

export interface ReplayResult {
  result: SessionResult;
  identical: boolean;
  /** Index of the first differing log entry, if any. */
  firstDifference?: number;
}

export function replaySession(content: ContentBundle, log: readonly LogEntry[]): ReplayResult {
  const start = log[0];
  if (!start || start.type !== "session_started") throw new Error("log must start with session_started");
  if (start.contentHash !== content.hash) {
    throw new Error(`content version mismatch: log ${start.contentHash}, loaded ${content.hash}`);
  }
  const decisions = new Map<string, LogEntryOf<"decision">>();
  const leisure = new Map<string, string[]>();
  for (const e of log) {
    if (e.type === "decision" && e.source === "player") decisions.set(`${e.instanceId}/${e.characterId}`, e);
    if (e.type === "leisure") leisure.set(e.characterId, [...(leisure.get(e.characterId) ?? []), e.kind]);
  }

  const result = runSession({
    content,
    config: start.config,
    participants: start.characters.map((c) => {
      const controller: Controller = {
        decide(view) {
          const d = decisions.get(`${view.offer.instanceId}/${c.id}`);
          return d ? { choiceId: d.choiceId, thinkMs: d.t - view.now } : null;
        },
        chooseLeisure: () => leisure.get(c.id)?.shift(),
      };
      return { id: c.id, name: c.name, career: c.career, isBot: c.isBot, controller };
    }),
  });
  const a = log.map((e) => JSON.stringify(e));
  const b = result.log.map((e) => JSON.stringify(e));
  let firstDifference: number | undefined;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      firstDifference = i;
      break;
    }
  }
  return { result, identical: firstDifference === undefined, ...(firstDifference !== undefined ? { firstDifference } : {}) };
}
