/**
 * Session memory (BOT_SYSTEM §7), built only from the bot's own notices.
 * It records how others treated this bot and turns that into feelings that
 * colour future decisions on top of the engine's relationship values.
 */
import type { ChoiceTag, Notice } from "@lifesim/core";

export interface MemoryEntry {
  t: number;
  instanceId: string;
  eventId: string;
  otherId?: string;
  kind: "encounter" | "helped_me" | "betrayed_me" | "threatened_me" | "harmed_me" | "my_choice";
  detail?: string;
}

const POSITIVE: ChoiceTag[] = ["help", "sacrifice", "apologize", "take_responsibility"];
const BETRAYAL: ChoiceTag[] = ["lie", "avoid_responsibility"];

export class BotMemory {
  readonly entries: MemoryEntry[] = [];
  /** Other id → accumulated gratitude minus grudge, roughly -100..100. */
  private readonly feelings = new Map<string, number>();
  private readonly encounters = new Map<string, number>();

  feelingAbout(id: string): number {
    return this.feelings.get(id) ?? 0;
  }

  encountersWith(id: string): number {
    return this.encounters.get(id) ?? 0;
  }

  /** Others this bot holds the biggest grudge against, worst first. */
  grudges(threshold: number): string[] {
    return [...this.feelings.entries()].filter(([, v]) => v <= -threshold).sort((a, b) => a[1] - b[1]).map(([id]) => id);
  }

  observe(notice: Notice, selfId: string | undefined): void {
    if (notice.kind !== "resolved") return;
    const base = { t: notice.t, instanceId: notice.instanceId, eventId: notice.eventId };
    for (const p of notice.participants) {
      if (p.characterId === selfId) continue;
      this.encounters.set(p.characterId, this.encountersWith(p.characterId) + 1);
      this.entries.push({ ...base, kind: "encounter", otherId: p.characterId });
    }
    if (notice.myChoice) this.entries.push({ ...base, kind: "my_choice", detail: notice.myChoice.id });

    for (const r of notice.revealed) {
      if (r.tags.some((t) => POSITIVE.includes(t))) this.add(r.characterId, +15, { ...base, kind: "helped_me", otherId: r.characterId, detail: r.choiceId });
      if (r.tags.includes("threaten")) this.add(r.characterId, -25, { ...base, kind: "threatened_me", otherId: r.characterId, detail: r.choiceId });
      else if (r.tags.some((t) => BETRAYAL.includes(t))) this.add(r.characterId, -20, { ...base, kind: "betrayed_me", otherId: r.characterId, detail: r.choiceId });
    }
    // Hurt without knowing who decided what: mild suspicion of everyone else involved.
    const loss = Object.values(notice.selfChanges).reduce((s, v) => s + Math.min(0, v ?? 0), 0);
    if (loss <= -10 && notice.revealed.length === 0) {
      for (const p of notice.participants) {
        if (p.characterId !== selfId) this.add(p.characterId, -5, { ...base, kind: "harmed_me", otherId: p.characterId });
      }
    }
  }

  private add(id: string, delta: number, entry: MemoryEntry): void {
    this.feelings.set(id, Math.max(-100, Math.min(100, this.feelingAbout(id) + delta)));
    this.entries.push(entry);
  }
}
