import type { Attribute, LifeRecap, OutcomeTag, Perceived, RelationType } from "@lifesim/core";

/** The public feed entries "Around town" shows (a structural subset of the server's `PublicEntry`). */
export type FeedEntry =
  | { kind: "event"; participants: unknown[] }
  | { kind: "ended" }
  | { kind: "upheaval"; active: boolean }
  | { kind: "phase"; phase: string }
  | { kind: "season" }
  | { kind: "move" }
  | { kind: "mood" }
  | { kind: "mark" }
  | { kind: "unmark" };

/**
 * B3: "Around town" is news, not a list of other people's errands: events with more than one person,
 * upheavals (when they start), deaths, hospital and prison, and the finale.
 */
export function isNewsworthy(entry: FeedEntry): boolean {
  switch (entry.kind) {
    case "event":
      return entry.participants.length >= 2;
    case "ended":
      return true;
    case "upheaval":
      return entry.active;
    case "phase":
      return entry.phase === "finale";
    default:
      return false;
  }
}

export const ATTR_LABELS: Record<Attribute, { label: string; icon: string }> = {
  health: { label: "Health", icon: "❤" },
  mental: { label: "Mind", icon: "☁" },
  money: { label: "Money", icon: "€" },
  reputation: { label: "Reputation", icon: "★" },
  career: { label: "Career", icon: "▲" },
};

/** T5b R1: a choice label in quotation marks, without doubling quotes the label already has. */
export function quoted(label: string | undefined): string {
  if (!label) return "";
  return /^["“„']/.test(label.trim()) ? label : `“${label}”`;
}

/** B4: suggestions for a character name (the player can type their own). */
export const NAME_SUGGESTIONS = [
  "Mila", "Oskar", "Nina", "Bruno", "Iris", "Teo", "Vera", "Leon", "Dora", "Max",
  "Lana", "Igor", "Sara", "Emil", "Nora", "Pavel", "Ruby", "Ivo", "Klara", "Dino",
];

export function randomName(except?: string): string {
  const pool = NAME_SUGGESTIONS.filter((n) => n !== except);
  return pool[Math.floor(Math.random() * pool.length)] as string;
}

export const AVATARS: Record<string, string> = {
  default: "🙂",
  fox: "🦊",
  owl: "🦉",
  cat: "🐱",
  bear: "🐻",
  frog: "🐸",
  rocket: "🚀",
  plant: "🌿",
};

export const OUTCOME_LABELS: Record<OutcomeTag, string> = {
  survived: "Survived",
  death: "Death",
  imprisonment: "Imprisoned",
  illness: "Illness",
  injury: "Injured",
  left: "Left town",
  career_advancement: "Career advancement",
  career_setback: "Career setback",
  financial_success: "Financial success",
  financial_failure: "Financial trouble",
  relationship_success: "New bonds",
  relationship_failure: "Broken bonds",
  saved_another: "Saved a life",
  personal_sacrifice: "Personal sacrifice",
};

export const GOOD_OUTCOMES = new Set<OutcomeTag>(["survived", "career_advancement", "financial_success", "relationship_success", "saved_another", "personal_sacrifice"]);

export const RELATION_LABELS: Record<RelationType, string> = {
  stranger: "Stranger",
  acquaintance: "Acquaintance",
  friend: "Friend",
  colleague: "Colleague",
  partner: "Partner",
  family: "Family",
  rival: "Rival",
  enemy: "Enemy",
};

export function arrows(level: number): string {
  if (level >= 2) return "↑↑";
  if (level === 1) return "↑";
  if (level === -1) return "↓";
  if (level <= -2) return "↓↓";
  return "–";
}

export interface Hint {
  text: string;
  tone: "good" | "bad" | "neutral" | "risk";
}

/**
 * The perceived consequences a choice shows — exactly the information bots use, so humans
 * and bots decide on equal terms. Unknown effects are simply not shown.
 */
export function hints(p: Perceived, nameOfRole: (role: string) => string): Hint[] {
  const out: Hint[] = [];
  const tone = (v: number): Hint["tone"] => (v > 0 ? "good" : v < 0 ? "bad" : "neutral");
  if (p.benefit !== undefined && p.benefit !== 0) out.push({ text: `Gain ${arrows(p.benefit)}`, tone: tone(p.benefit) });
  for (const a of ["health", "mental", "money", "reputation", "career"] as const) {
    const v = p[a];
    if (v !== undefined && v !== 0) out.push({ text: `${ATTR_LABELS[a].icon} ${ATTR_LABELS[a].label} ${arrows(v)}`, tone: tone(v) });
  }
  for (const [role, v] of Object.entries(p.relation ?? {})) {
    if (v !== 0) out.push({ text: `${nameOfRole(role)} ${arrows(v)}`, tone: tone(v) });
  }
  if (p.risk !== undefined && p.risk > 0) out.push({ text: p.risk >= 2 ? "Very risky" : "Risky", tone: "risk" });
  return out;
}

export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "police_officer" → "Police Officer" (the roster carries career ids). */
export function careerName(id: string): string {
  return id
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * T11: "Copy my life" — a spoiler-free line to share (an emoji per year, the title, career and age),
 * like Wordle's squares.
 */
export function lifeShareText(recap: Pick<LifeRecap, "years" | "ageAtEnd" | "title" | "career">): string {
  const years = recap.years ?? [];
  const from = Math.max(0, recap.ageAtEnd - years.length + 1);
  return [`🏘️ My life in Life Simulation`, years.join(""), `“${recap.title?.label ?? "A Life"}” · ${careerName(recap.career)} · age ${from}–${recap.ageAtEnd}`].join("\n");
}
