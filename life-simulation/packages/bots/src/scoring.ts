/**
 * Utility scoring (BOT_SYSTEM §6). Every input comes from the CharacterView,
 * the bot's own profile and its own memory — never from hidden game state.
 *
 *   utility = w.self·personal + w.moral·moral + w.relation·relation + w.motive·motive − w.risk·risk
 *
 * All components are roughly in [-1, 1]; weights are configurable.
 */
import type { CharacterView, ChoiceTag, Perceived, VisibleChoice } from "@lifesim/core";
import type { BotMemory } from "./memory";
import type { BotProfile, Motive, Trait } from "./personality";

export interface ScoringWeights {
  self: number;
  moral: number;
  relation: number;
  motive: number;
  risk: number;
  /** Assumed risk (0..1) when a choice's risk is unknown. */
  unknownRisk: number;
  /** Softmax temperature = base + impulsiveness × span. */
  temperatureBase: number;
  temperatureSpan: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  self: 1,
  moral: 1,
  relation: 1,
  motive: 0.8,
  risk: 1,
  unknownRisk: 0.2,
  temperatureBase: 0.12,
  temperatureSpan: 0.45,
};

/** How each attitude tag resonates with traits (centered traits, -1..1). */
export const TAG_AFFINITY: Record<ChoiceTag, Partial<Record<Trait, number>>> = {
  help: { empathy: 0.8, selfishness: -0.4 },
  refuse: { selfishness: 0.5, empathy: -0.4 },
  negotiate: { ambition: 0.3, caution: 0.2, impulsiveness: -0.2 },
  lie: { honesty: -1, selfishness: 0.3 },
  truth: { honesty: 1 },
  ignore: { caution: 0.3, empathy: -0.3, impulsiveness: -0.2 },
  threaten: { aggression: 0.9, empathy: -0.4 },
  apologize: { empathy: 0.4, honesty: 0.3, aggression: -0.3 },
  take_responsibility: { honesty: 0.6, selfishness: -0.3 },
  avoid_responsibility: { selfishness: 0.5, honesty: -0.5 },
  risk: { riskTolerance: 0.6, caution: -0.6, impulsiveness: 0.2 },
  sacrifice: { empathy: 0.5, selfishness: -0.8, loyalty: 0.2 },
};

export interface ChoiceScore {
  choiceId: string;
  utility: number;
  parts: { personal: number; moral: number; relation: number; motive: number; risk: number };
}

const lvl = (v: number | undefined) => (v ?? 0) / 2;

export function scoreChoices(
  view: CharacterView,
  profile: BotProfile,
  memory: BotMemory,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): ChoiceScore[] {
  const P = profile.personality;
  const n = (t: Trait) => P[t] / 100; // 0..1
  const c = (t: Trait) => (P[t] - 50) / 50; // -1..1

  const roleMembers = new Map<string, string[]>();
  for (const p of view.offer.participants) {
    if (p.characterId === view.self.id) continue;
    roleMembers.set(p.role, [...(roleMembers.get(p.role) ?? []), p.characterId]);
  }

  /** How much this bot cares about another character's welfare, -1..1. */
  const care = (otherId: string): number => {
    const other = view.others.find((o) => o.id === otherId);
    const rel = other?.relation ?? { affinity: 0, trust: 40, type: "stranger" as const };
    const feeling = memory.feelingAbout(otherId);
    // Trusting bots give more weight to trust; feelings from memory shift affinity.
    const aff = Math.max(-1, Math.min(1, (rel.affinity + feeling + (rel.trust - 50) * n("trusting") * 0.5) / 100));
    const bonded = rel.type === "family" || rel.type === "partner" ? 0.4 : rel.type === "colleague" ? 0.1 : 0;
    return 0.3 * n("empathy") + n("loyalty") * (Math.max(0, aff) + bonded) - n("aggression") * Math.max(0, -aff);
  };

  const relationScore = (p: Perceived): number => {
    let total = 0;
    for (const [role, level] of Object.entries(p.relation ?? {})) {
      const members = roleMembers.get(role) ?? [];
      if (members.length === 0) continue;
      total += lvl(level) * (members.reduce((s, id) => s + care(id), 0) / members.length);
    }
    return total;
  };

  const personalScore = (p: Perceived): number =>
    lvl(p.benefit) * (0.5 + n("selfishness")) +
    lvl(p.money) * (0.4 + 0.6 * n("selfishness")) +
    lvl(p.career) * (0.3 + 0.9 * n("ambition")) +
    lvl(p.reputation) * (0.3 + 0.5 * n("ambition")) +
    lvl(p.health) * (0.5 + 0.5 * n("caution")) +
    lvl(p.mental) * 0.5;

  const moralScore = (tags: readonly ChoiceTag[]): number =>
    tags.reduce((sum, tag) => {
      let s = 0;
      for (const [trait, w] of Object.entries(TAG_AFFINITY[tag]) as [Trait, number][]) s += w * c(trait);
      return sum + s;
    }, 0) / Math.max(1, Math.sqrt(tags.length));

  const riskScore = (p: Perceived): number => {
    const risk = p.risk === undefined ? weights.unknownRisk : p.risk / 2;
    return risk * (0.3 + 0.8 * n("caution") - 0.7 * n("riskTolerance"));
  };

  const motiveScore = (choice: VisibleChoice): number =>
    profile.motives.reduce((sum, m) => sum + m.strength * motiveValue(m, choice, roleMembers), 0);

  return view.offer.choices.map((choice) => {
    const p = choice.perceived;
    const parts = {
      personal: personalScore(p),
      moral: moralScore(choice.tags),
      relation: relationScore(p),
      motive: motiveScore(choice),
      risk: riskScore(p),
    };
    const utility =
      weights.self * parts.personal +
      weights.moral * parts.moral +
      weights.relation * parts.relation +
      weights.motive * parts.motive -
      weights.risk * parts.risk;
    return { choiceId: choice.id, utility, parts };
  });
}

function motiveValue(m: Motive, choice: VisibleChoice, roleMembers: ReadonlyMap<string, string[]>): number {
  const p = choice.perceived;
  const has = (t: ChoiceTag) => choice.tags.includes(t);
  /** Perceived relation effect towards the motive's target, if the target is in this event. */
  const towardTarget = (): number | undefined => {
    if (!m.targetId) return undefined;
    for (const [role, ids] of roleMembers) if (ids.includes(m.targetId)) return lvl(p.relation?.[role]);
    return undefined;
  };
  switch (m.type) {
    case "advance_career":
      return 0.6 * lvl(p.career) + 0.2 * lvl(p.reputation);
    case "protect_finances":
      return 0.6 * lvl(p.money);
    case "hide_mistake":
      return (has("lie") || has("avoid_responsibility") ? 0.4 : 0) - (has("truth") || has("take_responsibility") ? 0.4 : 0);
    case "avoid_responsibility":
      return (has("avoid_responsibility") || has("ignore") ? 0.3 : 0) - (has("take_responsibility") ? 0.4 : 0);
    case "protect_friend": {
      const t = towardTarget();
      return t === undefined ? 0 : 0.8 * t + (has("help") ? 0.3 : 0);
    }
    case "gain_trust": {
      const t = towardTarget();
      return t === undefined ? 0 : 0.6 * t + (has("truth") || has("help") ? 0.2 : 0);
    }
    case "preserve_relationship": {
      const t = towardTarget();
      return t === undefined ? 0 : 0.7 * t;
    }
    case "revenge": {
      const t = towardTarget();
      return t === undefined ? 0 : -0.8 * t + (has("threaten") ? 0.3 : 0);
    }
  }
}

/** Softmax over utilities; returns probabilities in choice order. */
export function softmax(utilities: readonly number[], temperature: number): number[] {
  const max = Math.max(...utilities);
  const exps = utilities.map((u) => Math.exp((u - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
