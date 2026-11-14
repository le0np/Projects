/** Runs many bot-only sessions with varied sizes, careers and personalities. */
import { Rng } from "@lifesim/core";
import type { ContentBundle } from "@lifesim/content";
import type { SessionConfig } from "@lifesim/engine";
import { runBotSession, type BotSessionRun } from "./setup";

export interface BatchOptions {
  content: ContentBundle;
  seed: string;
  sessions: number;
  /** Inclusive range of bots per session. */
  players: [number, number];
  config?: Partial<SessionConfig>;
  onSession?: (run: BotSessionRun, index: number) => void;
}

export function runBatch(opts: BatchOptions): BotSessionRun[] {
  const rng = new Rng(opts.seed).fork("batch");
  const runs: BotSessionRun[] = [];
  for (let i = 0; i < opts.sessions; i++) {
    const run = runBotSession({
      content: opts.content,
      seed: `${opts.seed}-${i}`,
      players: rng.int(opts.players[0], opts.players[1]),
      config: opts.config,
    });
    opts.onSession?.(run, i);
    runs.push(run);
  }
  return runs;
}
