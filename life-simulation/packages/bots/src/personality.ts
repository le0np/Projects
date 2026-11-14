/** Bot personality model (BOT_SYSTEM §3–5). Values are 0–100. */
import type { Rng } from "@lifesim/core";

export const TRAITS = [
  "empathy",
  "honesty",
  "selfishness",
  "ambition",
  "aggression",
  /** "Trust" in the spec: willingness to believe others. Renamed to avoid clashing with relationship trust (plan K2). */
  "trusting",
  "impulsiveness",
  "riskTolerance",
  "caution",
  "loyalty",
] as const;
export type Trait = (typeof TRAITS)[number];
export type Personality = Record<Trait, number>;

export const MOTIVE_TYPES = [
  "protect_friend",
  "advance_career",
  "hide_mistake",
  "avoid_responsibility",
  "gain_trust",
  "protect_finances",
  "revenge",
  "preserve_relationship",
] as const;
export type MotiveType = (typeof MOTIVE_TYPES)[number];

/** Motives that are about a specific other character. */
export const TARGETED_MOTIVES: ReadonlySet<MotiveType> = new Set(["protect_friend", "gain_trust", "revenge", "preserve_relationship"]);

export interface Motive {
  type: MotiveType;
  /** 0.3–1: how strongly it pulls; never strong enough to fully override personality. */
  strength: number;
  /** Bound lazily from what the bot sees (targeted motives only). */
  targetId?: string;
}

export const ARCHETYPES = [
  "altruist",
  "opportunist",
  "ambitious",
  "manipulator",
  "impulsive",
  "cautious",
  "skeptic",
  "naive",
  "authoritarian",
  "principled",
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

interface ArchetypeDef {
  /** Mean trait values in TRAITS order. */
  means: [number, number, number, number, number, number, number, number, number, number];
  motives: MotiveType[];
}

//                                emp hon sel amb agg tru imp risk cau loy
export const ARCHETYPE_DEFS: Record<Archetype, ArchetypeDef> = {
  altruist: { means: [85, 75, 15, 40, 15, 70, 40, 45, 50, 75], motives: ["protect_friend", "preserve_relationship", "gain_trust"] },
  opportunist: { means: [35, 35, 75, 65, 40, 40, 55, 60, 40, 30], motives: ["protect_finances", "advance_career"] },
  ambitious: { means: [45, 50, 60, 90, 50, 45, 45, 60, 45, 45], motives: ["advance_career"] },
  manipulator: { means: [25, 15, 80, 70, 45, 25, 35, 55, 60, 25], motives: ["gain_trust", "hide_mistake", "protect_finances"] },
  impulsive: { means: [50, 50, 50, 50, 60, 55, 90, 80, 15, 50], motives: ["revenge", "advance_career"] },
  cautious: { means: [55, 65, 45, 35, 20, 40, 15, 15, 90, 60], motives: ["avoid_responsibility", "protect_finances"] },
  skeptic: { means: [45, 70, 50, 50, 45, 10, 30, 35, 70, 45], motives: ["protect_finances", "preserve_relationship"] },
  naive: { means: [70, 75, 25, 35, 15, 95, 60, 50, 30, 65], motives: ["gain_trust", "preserve_relationship"] },
  authoritarian: { means: [35, 55, 55, 75, 80, 35, 40, 55, 50, 60], motives: ["advance_career", "revenge"] },
  principled: { means: [65, 95, 30, 50, 35, 50, 25, 35, 60, 60], motives: ["protect_friend", "gain_trust"] },
};

export interface BotProfile {
  archetype: Archetype;
  personality: Personality;
  motives: Motive[];
}

/** Approximately normal sample (sum of uniforms). */
function gaussian(rng: Rng, mean: number, sd: number): number {
  let s = 0;
  for (let i = 0; i < 4; i++) s += rng.next();
  return mean + (s - 2) * sd * Math.sqrt(3);
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/**
 * Archetype = starting profile, not a script: every trait gets individual variation,
 * so each bot has a unique combination (BOT_SYSTEM §4).
 */
export function createBotProfile(rng: Rng, archetype?: Archetype, variation = 10): BotProfile {
  const type = archetype ?? rng.pick(ARCHETYPES);
  const def = ARCHETYPE_DEFS[type];
  const personality = {} as Personality;
  TRAITS.forEach((t, i) => (personality[t] = clamp(gaussian(rng, def.means[i] as number, variation))));
  const count = rng.int(1, Math.min(2, def.motives.length));
  const motives = rng
    .shuffle(def.motives)
    .slice(0, count)
    .map((m) => ({ type: m, strength: Math.round(rng.range(0.4, 0.9) * 100) / 100 }));
  return { archetype: type, personality, motives };
}
