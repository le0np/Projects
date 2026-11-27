/**
 * T6: one word or two next to a character's name, so players can "read" people (after RimWorld).
 * Bots get it from their personality, humans from their career.
 */
import type { Personality, Trait } from "./personality";

const LABELS: Record<Trait, [high: string, low: string]> = {
  empathy: ["Big Heart", "Cold Fish"],
  honesty: ["Straight Shooter", "Fibber"],
  selfishness: ["Cheapskate", "Generous"],
  ambition: ["Go-Getter", "Laid-Back"],
  aggression: ["Hothead", "Peacemaker"],
  trusting: ["Gullible", "Suspicious"],
  impulsiveness: ["Impulsive", "Deliberate"],
  riskTolerance: ["Daredevil", "Plays It Safe"],
  caution: ["Worrier", "Reckless"],
  loyalty: ["Loyal Friend", "Fair-Weather Friend"],
};

/** The trait that stands out most; a few combinations have names of their own. */
export function traitLabel(p: Personality): string {
  if (p.empathy >= 65 && p.riskTolerance >= 60) return "Hero Complex";
  if (p.honesty <= 35 && p.empathy <= 40 && p.trusting <= 45) return "Gossip";
  let best: Trait = "empathy";
  let dev = -1;
  for (const t of Object.keys(LABELS) as Trait[]) {
    const d = Math.abs(p[t] - 50);
    if (d > dev) {
      best = t;
      dev = d;
    }
  }
  const [high, low] = LABELS[best];
  return p[best] >= 50 ? high : low;
}

const CAREER_TRAITS: Record<string, string> = {
  doctor: "Calm Under Pressure",
  lawyer: "Silver Tongue",
  police_officer: "By the Book",
  teacher: "Patient",
  mechanic: "Handy",
  engineer: "Problem Solver",
  entrepreneur: "Go-Getter",
  psychologist: "Good Listener",
  journalist: "Nosy",
  civilian: "Good Neighbour",
};

export function careerTrait(career: string): string {
  return CAREER_TRAITS[career] ?? "Newcomer";
}
