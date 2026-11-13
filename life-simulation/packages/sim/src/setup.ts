/** Builds bot-only sessions (TESTING_SIMULATION §1). */
import { ARCHETYPES, BotController, createBotProfile, type Archetype } from "@lifesim/bots";
import { Rng } from "@lifesim/core";
import type { ContentBundle } from "@lifesim/content";
import { runSession, type ParticipantSetup, type SessionConfig, type SessionResult } from "@lifesim/engine";

export interface BotSessionOptions {
  content: ContentBundle;
  seed: string;
  players: number;
  /** Careers per slot; missing slots get random careers. */
  careers?: string[];
  /** Archetypes per slot; missing slots get random archetypes. */
  archetypes?: Archetype[];
  config?: Partial<SessionConfig>;
}

export interface BotSessionRun {
  result: SessionResult;
  bots: { characterId: string; controller: BotController; career: string }[];
}

export function createBotParticipants(opts: Omit<BotSessionOptions, "config">): BotSessionRun["bots"] {
  if (opts.players < 2 || opts.players > 8) throw new RangeError("a simulation needs 2–8 bots");
  const rng = new Rng(opts.seed).fork("bots");
  const careerIds = [...opts.content.careers.keys()];
  return Array.from({ length: opts.players }, (_, i) => {
    const slot = rng.fork(`slot${i}`);
    const career = opts.careers?.[i] ?? slot.pick(careerIds);
    if (!opts.content.careers.has(career)) throw new Error(`unknown career "${career}"`);
    const archetype = opts.archetypes?.[i] ?? slot.pick(ARCHETYPES);
    const controller = new BotController(createBotProfile(slot.fork("profile"), archetype), slot.fork("decisions"));
    return { characterId: `c${i + 1}`, controller, career };
  });
}

export function runBotSession(opts: BotSessionOptions): BotSessionRun {
  const bots = createBotParticipants(opts);
  const participants: ParticipantSetup[] = bots.map((b) => ({ id: b.characterId, career: b.career, isBot: true, controller: b.controller }));
  const result = runSession({ content: opts.content, config: { ...opts.config, seed: opts.seed }, participants });
  return { result, bots };
}
