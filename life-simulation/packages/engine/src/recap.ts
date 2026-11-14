/** Life Recap (GDD §9): derived at session end from character state and tracked history. */
import { ATTRIBUTES, type Fact, type KeyMoment, type LifeRecap, type OutcomeTag, type RelationType } from "@lifesim/core";
import type { CharacterState, Relations } from "./state";

export interface CharacterTracking {
  keyMoments: KeyMoment[];
  /** Other character id → events in which they decided and this character's attributes changed. */
  influence: Map<string, { events: number; impact: number }>;
  startTypes: Map<string, RelationType>;
  played: { mischief: string; on: string }[];
  suffered: { mischief: string; by: string }[];
}

const POSITIVE = new Set<RelationType>(["friend", "partner", "family"]);
const NEGATIVE = new Set<RelationType>(["rival", "enemy"]);

export function computeRecaps(input: {
  characters: CharacterState[];
  relations: Relations;
  tracking: ReadonlyMap<string, CharacterTracking>;
  facts: ReadonlyMap<string, Fact>;
  sessionDurationMs: number;
  /** Age at a given session time. */
  ageAt: (timeMs: number) => number;
}): LifeRecap[] {
  const { characters, relations, tracking, facts, sessionDurationMs, ageAt } = input;
  const byId = new Map(characters.map((c) => [c.id, c]));

  // Outcome tags granted by facts (content-driven, e.g. saved_by → "saved_another" for the rescuer).
  const factTags = new Map<string, Set<OutcomeTag>>();
  const grant = (id: string, tag: OutcomeTag) => {
    const set = factTags.get(id) ?? new Set();
    set.add(tag);
    factTags.set(id, set);
  };
  for (const c of characters) {
    for (const entry of c.facts) {
      const [key, about] = entry.split(":") as [string, string | undefined];
      const fact = facts.get(key);
      if (fact?.recap?.holder) grant(c.id, fact.recap.holder);
      if (fact?.recap?.about && about) grant(about, fact.recap.about);
    }
  }

  return characters.map((c) => {
    const track = tracking.get(c.id) as CharacterTracking;
    const gained: LifeRecap["relationshipsGained"] = [];
    const lost: LifeRecap["relationshipsLost"] = [];
    let positiveNow = 0;
    for (const other of characters) {
      if (other.id === c.id) continue;
      const from = track.startTypes.get(other.id) ?? "stranger";
      const to = relations.get(c.id, other.id).type;
      if (POSITIVE.has(to)) positiveNow++;
      if (POSITIVE.has(to) && !POSITIVE.has(from)) gained.push({ characterId: other.id, name: other.name, type: to });
      if ((NEGATIVE.has(to) && !NEGATIVE.has(from)) || (POSITIVE.has(from) && !POSITIVE.has(to))) {
        lost.push({ characterId: other.id, name: other.name, from, to });
      }
    }

    const outcomes = new Set<OutcomeTag>();
    const statusTag = { active: "survived", dead: "death", imprisoned: "imprisonment", hospitalized: "illness", left: "left" } as const;
    outcomes.add(statusTag[c.status]);
    const diff = (a: "career" | "money" | "health") => c.attrs[a] - c.startAttrs[a];
    if (c.status === "active" && (c.attrs.health <= 35 || diff("health") <= -30)) outcomes.add("injury");
    if (diff("career") >= 15) outcomes.add("career_advancement");
    if (diff("career") <= -15) outcomes.add("career_setback");
    if (diff("money") >= 15) outcomes.add("financial_success");
    if (diff("money") <= -15) outcomes.add("financial_failure");
    if (gained.length > 0 || positiveNow >= 2) outcomes.add("relationship_success");
    if (lost.length > 0) outcomes.add("relationship_failure");
    if (track.keyMoments.some((m) => m.choiceTags?.includes("sacrifice"))) outcomes.add("personal_sacrifice");
    for (const tag of factTags.get(c.id) ?? []) outcomes.add(tag);

    const mean = ATTRIBUTES.reduce((s, a) => s + c.attrs[a], 0) / ATTRIBUTES.length;
    const penalty = { active: 0, dead: 30, imprisoned: 20, hospitalized: 10, left: 5 }[c.status];
    const lifeScore = Math.round(
      mean - penalty + 3 * gained.length - 3 * lost.length + (outcomes.has("saved_another") ? 5 : 0),
    );

    const influencedBy = [...track.influence.entries()]
      .map(([id, v]) => ({ characterId: id, name: byId.get(id)?.name ?? id, ...v }))
      .sort((a, b) => b.impact - a.impact || a.characterId.localeCompare(b.characterId));

    return {
      characterId: c.id,
      name: c.name,
      career: c.career.id,
      isBot: c.isBot,
      sessionDurationMs,
      lifeDurationMs: c.endedAt ?? sessionDurationMs,
      ageAtEnd: ageAt(c.endedAt ?? sessionDurationMs),
      eventsCount: c.eventsCompleted,
      finalStatus: c.status,
      ...(c.cause ? { cause: c.cause } : {}),
      outcomes: [...outcomes],
      startAttrs: { ...c.startAttrs },
      finalAttrs: { ...c.attrs },
      keyMoments: [...track.keyMoments],
      relationshipsGained: gained,
      relationshipsLost: lost,
      influencedBy,
      secrets: {
        played: track.played.map((p) => ({ mischief: p.mischief, on: byId.get(p.on)?.name ?? p.on })),
        suffered: track.suffered.map((p) => ({ mischief: p.mischief, by: byId.get(p.by)?.name ?? p.by })),
      },
      lifeScore,
    };
  });
}

/** Plain-text Life Recap for logs and the CLI. */
export function formatRecap(r: LifeRecap): string {
  const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
  const lines = [
    `${r.name} (${r.career}${r.isBot ? ", bot" : ""}), age ${r.ageAtEnd} — ${r.finalStatus}${r.cause ? `: ${r.cause}` : ""}`,
    `  Outcomes: ${r.outcomes.join(", ")}`,
    `  Lived ${mmss(r.lifeDurationMs)} of ${mmss(r.sessionDurationMs)}, ${r.eventsCount} events, life score ${r.lifeScore}`,
    `  ${ATTRIBUTES.map((a) => `${a} ${r.startAttrs[a]}→${r.finalAttrs[a]}`).join(", ")}`,
  ];
  for (const m of r.keyMoments) {
    lines.push(`  • ${m.eventTitle}${m.choiceLabel ? ` — chose "${m.choiceLabel}"` : ""}${m.text ? `: ${m.text}` : ""}`);
  }
  if (r.relationshipsGained.length) lines.push(`  Gained: ${r.relationshipsGained.map((g) => `${g.name} (${g.type})`).join(", ")}`);
  if (r.relationshipsLost.length) lines.push(`  Lost: ${r.relationshipsLost.map((l) => `${l.name} (${l.from}→${l.to})`).join(", ")}`);
  for (const p of r.secrets.played) lines.push(`  Secretly played "${p.mischief}" on ${p.on}`);
  for (const p of r.secrets.suffered) lines.push(`  Was pranked with "${p.mischief}" by ${p.by}`);
  if (r.influencedBy.length) lines.push(`  Influenced by: ${r.influencedBy.map((i) => `${i.name} (${i.events}×)`).join(", ")}`);
  return lines.join("\n");
}
