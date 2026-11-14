import { parseRef, type ConditionContext, type Season } from "@lifesim/core";
import { factKey, type CharacterState, type Relations } from "./state";

export interface WorldView {
  characters: ReadonlyMap<string, CharacterState>;
  relations: Relations;
  sessionFacts: ReadonlySet<string>;
  progress(): number;
  age(characterId: string): number;
  season(): Season;
}

export type Bindings = Readonly<Record<string, readonly string[]>>;

/** ConditionContext over the live world for a given evaluation scope. */
export function makeContext(
  world: WorldView,
  bindings: Bindings,
  self?: string,
  choicesOf?: (role: string) => readonly string[],
): ConditionContext {
  const char = (id: string) => {
    const c = world.characters.get(id);
    if (!c) throw new Error(`unknown character ${id}`);
    return c;
  };
  return {
    resolve(ref) {
      const parsed = parseRef(ref);
      if (!parsed) return [];
      if (parsed.kind === "self") return self === undefined ? [] : [self];
      if (parsed.kind === "role") return bindings[parsed.role] ?? [];
      return [];
    },
    attr: (id, a) => char(id).attrs[a],
    career: (id) => char(id).career.id,
    status: (id) => char(id).status,
    hasFact: (id, key, about) => char(id).facts.has(factKey(key, about)),
    hasSessionFact: (key) => world.sessionFacts.has(key),
    relation: (a, b) => {
      const r = world.relations.get(a, b);
      return { type: r.type, affinity: r.affinity, trust: r.trust };
    },
    seenEvent: (id, eventId) => (char(id).seen.get(eventId) ?? 0) > 0,
    progress: () => world.progress(),
    age: (id) => world.age(id),
    season: () => world.season(),
    choicesOf,
  };
}
