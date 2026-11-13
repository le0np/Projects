import type { Attribute, Importance } from "@lifesim/core";

/** Tunable session parameters. All times in seconds of session time. */
export interface SessionConfig {
  seed: string;
  /** Target session length; no new events start after it. */
  durationSeconds: number;
  /** Response deadline range per importance (EVENT_SYSTEM §8). */
  deadlines: Record<Importance, [number, number]>;
  /** Breather after an event before a character can get the next one. */
  restSeconds: [number, number];
  /** Staggered start so not everybody gets an event at second 0. */
  initialDelaySeconds: [number, number];
  /** When the director finds nothing for a free character, try again after this. */
  idleRetrySeconds: number;
  /** A due follow-up waits at most this long for its participants to become free. */
  followUpMaxWaitSeconds: number;
  /** Starting attributes before career bonuses, with ± variation. */
  baseAttributes: Record<Attribute, number>;
  attributeVariation: number;
  /** Pre-existing relationships at session start (decision D3). */
  startingRelationships: {
    /** Number of colleague pairs = round(participants × ratio). */
    colleaguePairRatio: number;
    familyChance: number;
    partnerChance: number;
  };
}

export const DEFAULT_CONFIG: Omit<SessionConfig, "seed"> = {
  durationSeconds: 480,
  deadlines: { simple: [10, 20], multi: [15, 30], important: [20, 40] },
  restSeconds: [4, 12],
  initialDelaySeconds: [1, 8],
  idleRetrySeconds: 6,
  followUpMaxWaitSeconds: 90,
  baseAttributes: { health: 75, mental: 70, money: 50, reputation: 50, career: 50 },
  attributeVariation: 8,
  startingRelationships: { colleaguePairRatio: 0.25, familyChance: 0.3, partnerChance: 0.25 },
};

export function resolveConfig(partial: Partial<SessionConfig> & { seed: string }): SessionConfig {
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    deadlines: { ...DEFAULT_CONFIG.deadlines, ...partial.deadlines },
    baseAttributes: { ...DEFAULT_CONFIG.baseAttributes, ...partial.baseAttributes },
    startingRelationships: { ...DEFAULT_CONFIG.startingRelationships, ...partial.startingRelationships },
  };
}
