/**
 * T11: a title for a whole life ("The Town Snitch", "Bailed Everyone Out, Died Broke"), worked out
 * from what happened, and a row of emoji (one per year of life) to share without spoilers.
 */
import type { Attribute, LifeRecap } from "@lifesim/core";

export interface TitleFacts {
  recap: Omit<LifeRecap, "title" | "years">;
  tags: ReadonlyMap<string, number>;
  choices: ReadonlyMap<string, number>;
  sharedEvents: number;
  owedBy: number;
  owes: number;
  savedSomeone: boolean;
  married: boolean;
  revengeWorked: boolean;
  minHealth: number;
  /** Fraction of the session the life lasted (1 = to the end). */
  lifeShare: number;
}

interface TitleRule {
  id: string;
  label: string;
  why: string;
  when: (f: TitleFacts) => boolean;
}

const delta = (f: TitleFacts, a: Attribute) => f.recap.finalAttrs[a] - f.recap.startAttrs[a];
const tag = (f: TitleFacts, t: string) => f.tags.get(t) ?? 0;
const played = (f: TitleFacts) => f.recap.secrets.played;
const friends = (f: TitleFacts) => f.recap.relationshipsGained.filter((r) => r.type === "friend").length;

/** In order: the first that fits is the title (the more unusual lives come first). */
export const TITLES: readonly TitleRule[] = [
  { id: "gone_too_soon", label: "Gone Too Soon", why: "Your story ended early.", when: (f) => f.recap.finalStatus === "dead" && f.lifeShare < 0.6 },
  { id: "bailed_out_died_broke", label: "Bailed Everyone Out, Died Broke", why: "You kept helping, and it cost you.", when: (f) => tag(f, "help") >= 6 && (delta(f, "money") <= -20 || (f.recap.finalStatus === "dead" && f.recap.finalAttrs.money < 35)) },
  { id: "never_caught", label: "Never Caught", why: "Your schemes worked and nobody ever knew.", when: (f) => played(f).filter((p) => p.result === "worked").length >= 2 && !played(f).some((p) => p.discovered) },
  { id: "revenge_cold", label: "Revenge, Served Cold", why: "Someone wronged you, and you paid them back.", when: (f) => f.revengeWorked },
  { id: "caught_red_handed", label: "Caught Red-Handed", why: "Your schemes kept getting you caught.", when: (f) => played(f).filter((p) => p.discovered).length >= 2 },
  { id: "town_snitch", label: "The Town Snitch", why: "You reported people. More than once.", when: (f) => (f.choices.get("report") ?? 0) + (f.choices.get("report_it") ?? 0) >= 2 || (tag(f, "truth") >= 6 && (f.choices.get("report") ?? 0) >= 1) },
  { id: "hero", label: "Hero of the Town", why: "Someone owes you their life.", when: (f) => f.savedSomeone },
  { id: "town_oracle", label: "Town Oracle", why: "You knew what people would do before they did.", when: (f) => f.recap.oracle.correct >= 3 },
  { id: "just_married", label: "Married by the Finale", why: "It ended with a wedding. Yours.", when: (f) => f.married },
  { id: "heartbreaker", label: "Heartbreaker", why: "Love came and went.", when: (f) => f.recap.relationshipsLost.some((r) => r.from === "partner") },
  { id: "debt_collector", label: "The Debt Collector", why: "People owed you money, and you remembered.", when: (f) => f.owedBy >= 1 },
  { id: "in_over_head", label: "In Over Their Head", why: "You ended up owing people money.", when: (f) => f.owes >= 1 },
  { id: "survivor", label: "Survived Everything", why: "You nearly did not make it. You made it.", when: (f) => f.minHealth < 25 && f.recap.finalStatus !== "dead" },
  { id: "smooth_talker", label: "Smooth Talker", why: "The truth was always negotiable.", when: (f) => tag(f, "lie") >= 6 },
  { id: "honest_to_a_fault", label: "Honest to a Fault", why: "You never told a single lie.", when: (f) => tag(f, "lie") === 0 && tag(f, "truth") >= 4 },
  { id: "workaholic", label: "Workaholic", why: "Your career took off.", when: (f) => delta(f, "career") >= 20 },
  { id: "self_made", label: "Self-Made", why: "You ended much richer than you started.", when: (f) => delta(f, "money") >= 25 },
  { id: "social_butterfly", label: "Social Butterfly", why: "Everybody knew you, and liked you.", when: (f) => friends(f) >= 3 || f.sharedEvents >= 16 },
  { id: "lone_wolf", label: "Lone Wolf", why: "You kept to yourself.", when: (f) => f.sharedEvents <= 4 },
  { id: "town_drama", label: "Town Drama", why: "Rivals everywhere you looked.", when: (f) => f.recap.relationshipsLost.filter((r) => r.to === "rival" || r.to === "enemy").length >= 1 },
  { id: "quiet_life", label: "A Quiet Life", why: "Nothing dramatic. Maybe that is the secret.", when: () => true },
];

export function titleFor(f: TitleFacts): LifeRecap["title"] {
  const rule = TITLES.find((t) => t.when(f)) as TitleRule;
  return { id: rule.id, label: rule.label, why: rule.why };
}

/** One emoji per year of life: the biggest thing that happened in it. */
export function yearEmoji(changes: Partial<Record<Attribute, number>>, extra: { partner?: boolean; rival?: boolean; died?: boolean; schemed?: boolean }): string {
  if (extra.died) return "🪦";
  if (extra.partner) return "💍";
  const top = (Object.entries(changes) as [Attribute, number][]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  if (extra.schemed && (!top || Math.abs(top[1]) < 8)) return "🤫";
  if (extra.rival && (!top || Math.abs(top[1]) < 8)) return "😤";
  if (!top || Math.abs(top[1]) < 4) return "🙂";
  const [a, d] = top;
  const up: Record<Attribute, string> = { health: "💪", mental: "😌", money: "💰", reputation: "⭐", career: "💼" };
  const down: Record<Attribute, string> = { health: "🤕", mental: "😵", money: "💸", reputation: "📉", career: "🗂️" };
  return d > 0 ? up[a] : down[a];
}
