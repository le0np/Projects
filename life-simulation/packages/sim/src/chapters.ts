/** Sprint 5: helpers for bot lives in "Life in chapters". */
import type { ChapterContent, LifeStep } from "@lifesim/core";
import { ChapterLife, type LifeLogEntry } from "@lifesim/engine";

const WORDS_PER_SECOND = 3.5;
const words = (...texts: (string | undefined)[]) => texts.filter(Boolean).join(" ").split(/\s+/).filter(Boolean).length;

/** Seconds a person needs for one screen: reading time plus thinking and clicking. */
export function stepSeconds(step: LifeStep): number {
  switch (step.kind) {
    case "intro":
      return 15;
    case "focus":
      return 6 + words(...step.cards.map((c) => `${c.label} ${c.hint}`)) / WORDS_PER_SECOND;
    case "event":
      return 6 + words(step.title, step.text, step.private, ...step.choices.map((c) => c.label), ...(step.factors ?? []).map((f) => f.label)) / WORDS_PER_SECOND;
    case "outcome":
      return 3 + (step.roll ? 2.5 : 0) + words(step.text, step.cast?.did, ...step.changes.map((c) => c.text)) / WORDS_PER_SECOND;
    case "done":
      return 45;
  }
}

/** Estimated real play time of a life (replays its log and adds up every screen, plus 60 s to create the character). */
export function estimateLifeSeconds(content: ChapterContent, log: LifeLogEntry[]): number {
  const start = log[0];
  if (!start || start.t !== "start") return 0;
  const life = new ChapterLife(content, start.setup, start.seed);
  let total = 60 + stepSeconds(life.view().step);
  for (const e of log.slice(1)) {
    if (e.t === "start") break;
    life.act(e.t === "next" ? { t: "next" } : { t: e.t, id: e.id });
    total += stepSeconds(life.view().step);
  }
  return total;
}
