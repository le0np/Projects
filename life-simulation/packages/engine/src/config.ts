import type { Attribute, Importance } from "@lifesim/core";

export type StoryPhase = "intro" | "growth" | "climax" | "respite" | "finale";
export const STORY_PHASES: readonly StoryPhase[] = ["intro", "growth", "climax", "respite", "finale"];

/** When each phase starts, in session milliseconds. */
export function storyTimeline(config: Pick<SessionConfig, "durationSeconds" | "story">): Record<StoryPhase, number> {
  const d = config.durationSeconds * 1000;
  const { introShare, climaxShare, respiteSeconds, finaleSeconds } = config.story;
  const finale = Math.round(Math.max(0.8 * d, d - finaleSeconds * 1000));
  const respite = Math.round(finale - Math.min(respiteSeconds * 1000, 0.08 * d));
  const climax = Math.round(Math.min(climaxShare * d, respite));
  const growth = Math.round(Math.min(introShare * d, climax));
  return { intro: 0, growth, climax, respite, finale };
}

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
  /** Chaos (concept v2 §5): upheavals per session, pranks per character, follow-up chance multiplier. */
  chaos: { upheavals: [number, number]; mischiefCharges: number; followUpBoost: number };
  /** Movement on the town map (concept v2 §2). */
  walkTilesPerSecond: number;
  /**
   * Routine within each season: the first `night` share everyone sleeps at home,
   * until `workEnd` employed people are at work, the rest is free time.
   */
  routine: { night: number; workEnd: number; leisureStaySeconds: [number, number] };
  /**
   * Director preferences (T2): events with people you already have a relationship with are more likely
   * (`relationBoost` for colleagues/family/partners/friends/rivals/enemies, `acquaintanceBoost` for people you
   * have only met), related people are pulled `relatedPullTiles` closer when roles are filled,
   * and solo events weigh `soloFactor` as much.
   */
  director: { relationBoost: number; acquaintanceBoost: number; relatedPullTiles: number; soloFactor: number };
  /**
   * Tension curve (T3, after RimWorld's storytellers): intro (light events that bring people together),
   * growth, climax (an upheaval around `climaxUpheaval`), a respite, and a finale for everyone at the end.
   * Shares are of `durationSeconds`; the finale starts `finaleSeconds` before the end (at least at 80 %).
   */
  story: { introShare: number; climaxShare: number; climaxUpheaval: [number, number]; respiteSeconds: number; finaleSeconds: number };
  /** Pre-existing relationships at session start (decision D3). */
  startingRelationships: {
    /** Number of colleague pairs = round(participants × ratio). */
    colleaguePairRatio: number;
    familyChance: number;
    partnerChance: number;
  };
  /**
   * Pacing for human players in real (wall-clock) seconds. Set by the live server; unset in
   * simulations, so bot-only runs keep their speed. Events with a human decider get a deadline
   * that depends on the text length, and humans rest a little longer between events.
   */
  humanPacing?: HumanPacing;
}

export interface HumanPacing {
  /** Session milliseconds per wall-clock millisecond (the server's TIME_SCALE). */
  timeScale: number;
  /** Deadline = base + perWord × words (public + private text + choice labels), clamped, + bonus if several humans decide. */
  deadline: {
    baseSeconds: number;
    perWordSeconds: number;
    minSeconds: number;
    importantMinSeconds: number;
    maxSeconds: number;
    multiHumanBonusSeconds: number;
  };
  /** Breather after an event (wall seconds), and after an important one. */
  restSeconds: [number, number];
  restAfterImportantSeconds: [number, number];
  /** A human idle this long (wall seconds) gets any event, even a solo one (T3: never long without anything). */
  patienceSeconds: number;
  /** How often the director looks again for an idle human (wall seconds). */
  retrySeconds: number;
  /** T5b R2: after an event everyone stays at the spot this long (reveal, reactions, outcome) before moving on. */
  lingerSeconds: number;
}

export const DEFAULT_HUMAN_PACING: Omit<HumanPacing, "timeScale"> = {
  deadline: { baseSeconds: 8, perWordSeconds: 0.25, minSeconds: 15, importantMinSeconds: 25, maxSeconds: 35, multiHumanBonusSeconds: 10 },
  restSeconds: [6.5, 10],
  restAfterImportantSeconds: [11, 14],
  patienceSeconds: 10,
  retrySeconds: 2,
  lingerSeconds: 5,
};

/** Pacing for a live server running at `timeScale`; `scale` shortens every wall-clock duration (tests). */
export function humanPacing(timeScale: number, scale = 1): HumanPacing {
  const d = DEFAULT_HUMAN_PACING.deadline;
  const r = (x: [number, number]): [number, number] => [x[0] * scale, x[1] * scale];
  return {
    timeScale,
    deadline: {
      baseSeconds: d.baseSeconds * scale,
      perWordSeconds: d.perWordSeconds * scale,
      minSeconds: d.minSeconds * scale,
      importantMinSeconds: d.importantMinSeconds * scale,
      maxSeconds: d.maxSeconds * scale,
      multiHumanBonusSeconds: d.multiHumanBonusSeconds * scale,
    },
    restSeconds: r(DEFAULT_HUMAN_PACING.restSeconds),
    restAfterImportantSeconds: r(DEFAULT_HUMAN_PACING.restAfterImportantSeconds),
    patienceSeconds: DEFAULT_HUMAN_PACING.patienceSeconds * scale,
    retrySeconds: DEFAULT_HUMAN_PACING.retrySeconds * scale,
    lingerSeconds: DEFAULT_HUMAN_PACING.lingerSeconds * scale,
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
  director: { relationBoost: 3, acquaintanceBoost: 1.3, relatedPullTiles: 10, soloFactor: 0.5 },
  story: { introShare: 0.15, climaxShare: 0.6, climaxUpheaval: [0.62, 0.7], respiteSeconds: 30, finaleSeconds: 75 },
  chaos: { upheavals: [2, 3], mischiefCharges: 2, followUpBoost: 1.25 },
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
    chaos: { ...DEFAULT_CONFIG.chaos, ...partial.chaos },
    director: { ...DEFAULT_CONFIG.director, ...partial.director },
    story: { ...DEFAULT_CONFIG.story, ...partial.story },
  };
}
