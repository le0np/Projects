import type { CharacterView, Notice } from "@lifesim/core";
import { readContentDir, validateContent, type ContentBundle } from "@lifesim/content";
import type { Controller, Decision } from "../src";

/** Builds a validated bundle from the shipped careers/facts plus the given events. */
export function buildContent(events: Record<string, unknown>[]): ContentBundle {
  const { raw } = readContentDir();
  const { bundle, issues } = validateContent({
    careers: raw.careers,
    facts: raw.facts,
    map: raw.map,
    events: events.map((e) => ({ file: `${e.id as string}.json`, data: e })),
  });
  if (!bundle) {
    throw new Error(issues.filter((i) => i.severity === "error").map((i) => `${i.source} ${i.path}: ${i.message}`).join("\n"));
  }
  return bundle;
}

/** Minimal event definition with sensible defaults. */
export function event(def: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: 1,
    version: 1,
    title: String(def.id),
    category: "everyday",
    trigger: "director",
    importance: "simple",
    text: { public: "Something happens." },
    ...def,
  };
}

/** Controller driven by a function; `choice` may return null to stay silent. */
export function scripted(choice: (view: CharacterView) => string | null, thinkMs = 1000): Controller & { notices: Notice[] } {
  const notices: Notice[] = [];
  return {
    notices,
    observe: (n) => notices.push(n),
    decide: (view): Decision | null => {
      const id = choice(view);
      return id === null ? null : { choiceId: id, thinkMs };
    },
  };
}

export const pickDefault = (view: CharacterView) => view.offer.choices.find((c) => c.isDefault)!.id;
