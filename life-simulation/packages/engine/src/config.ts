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
  /** Life calendar (concept v2 §3): session seconds per year, and everyone's starting age. */
  yearSeconds: number;
  startAge: number;
  /** From this age on, health drops by `healthPerYear` at every new year. */
  aging: { fromAge: number; healthPerYear: number };
  /** Movement on the town map (concept v2 §2). */
  walkTilesPerSecond: number;
  /**
   * Routine within each season: the first `night` share everyone sleeps at home,
   * until `workEnd` employed people are at work, the rest is free time.
   */
  routine: { night: number; workEnd: number; leisureStaySeconds: [number, number] };
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
  restSeconds: [6, 15],
  initialDelaySeconds: [1, 8],
  idleRetrySeconds: 6,
  followUpMaxWaitSeconds: 90,
  baseAttributes: { health: 75, mental: 70, money: 50, reputation: 50, career: 50 },
  attributeVariation: 8,
  startingRelationships: { colleaguePairRatio: 0.25, familyChance: 0.3, partnerChance: 0.25 },
  walkTilesPerSecond: 4,
  routine: { night: 0.15, workEnd: 0.6, leisureStaySeconds: [3, 8] },
  yearSeconds: 30,
  startAge: 18,
  aging: { fromAge: 30, healthPerYear: 1 },
};

export function resolveConfig(partial: Partial<SessionConfig> & { seed: string }): SessionConfig {
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    deadlines: { ...DEFAULT_CONFIG.deadlines, ...partial.deadlines },
    baseAttributes: { ...DEFAULT_CONFIG.baseAttributes, ...partial.baseAttributes },
    startingRelationships: { ...DEFAULT_CONFIG.startingRelationships, ...partial.startingRelationships },
    aging: { ...DEFAULT_CONFIG.aging, ...partial.aging },
    routine: { ...DEFAULT_CONFIG.routine, ...partial.routine },
  };
}
