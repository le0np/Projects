/**
 * Declarative condition language used by event content (activation conditions,
 * role requirements, choice visibility, outcome rules, follow-up activation).
 * Conditions are plain JSON data; there is no `eval`.
 *
 * Multi-character semantics: when a ref resolves to several characters (a role
 * with count > 1), a leaf condition holds only if it holds for every one of them.
 * A ref resolving to no characters makes the leaf false.
 */
import type { Attribute, RelationType, Season, Status } from "./constants";
import type { Ref } from "./refs";

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  /** Attribute bounds, inclusive. */
  | { attr: Attribute; of?: Ref; gte?: number; lte?: number }
  | { careerIn: string[]; of?: Ref }
  | { statusIn: Status[]; of?: Ref }
  /** Character fact (or pair fact when `about` is given). `present: false` negates. */
  | { fact: string; of?: Ref; about?: Ref; present?: boolean }
  | { sessionFact: string; present?: boolean }
  | {
      relation: {
        from?: Ref;
        to: Ref;
        typeIn?: RelationType[];
        affinityGte?: number;
        affinityLte?: number;
        trustGte?: number;
        trustLte?: number;
      };
    }
  /** Whether the character has already taken part in an event template this session. */
  | { seenEvent: string; of?: Ref; present?: boolean }
  /** Character age in years, inclusive bounds. */
  | { age: { gte?: number; lte?: number }; of?: Ref }
  /** Current season of the town. */
  | { seasonIn: Season[] }
  /** Session progress as a fraction of the configured duration, 0..1. */
  | { progress: { gte?: number; lte?: number } }
  /** Only valid in outcome rules: how many members of `role` picked `choice`. */
  | { chose: string; role: string; count?: "any" | "all" | "none" };

export interface RelationView {
  type: RelationType;
  affinity: number;
  trust: number;
}

/** What the evaluator needs from the game state. Implemented by the engine. */
export interface ConditionContext {
  /** Characters a ref points to in the current evaluation scope. */
  resolve(ref: Ref): readonly string[];
  attr(characterId: string, attribute: Attribute): number;
  career(characterId: string): string;
  status(characterId: string): Status;
  hasFact(characterId: string, key: string, aboutId?: string): boolean;
  hasSessionFact(key: string): boolean;
  relation(fromId: string, toId: string): RelationView;
  seenEvent(characterId: string, eventId: string): boolean;
  progress(): number;
  age(characterId: string): number;
  season(): Season;
  /** Choice ids selected by the members of a role; only available during resolution. */
  choicesOf?(role: string): readonly string[];
}

function every(ids: readonly string[], pred: (id: string) => boolean): boolean {
  return ids.length > 0 && ids.every(pred);
}

function inBounds(v: number, gte?: number, lte?: number): boolean {
  return (gte === undefined || v >= gte) && (lte === undefined || v <= lte);
}

export function evaluate(cond: Condition, ctx: ConditionContext): boolean {
  if ("all" in cond) return cond.all.every((c) => evaluate(c, ctx));
  if ("any" in cond) return cond.any.some((c) => evaluate(c, ctx));
  if ("not" in cond) return !evaluate(cond.not, ctx);

  if ("attr" in cond) {
    return every(ctx.resolve(cond.of ?? "self"), (id) =>
      inBounds(ctx.attr(id, cond.attr), cond.gte, cond.lte),
    );
  }
  if ("careerIn" in cond) {
    return every(ctx.resolve(cond.of ?? "self"), (id) => cond.careerIn.includes(ctx.career(id)));
  }
  if ("statusIn" in cond) {
    return every(ctx.resolve(cond.of ?? "self"), (id) => cond.statusIn.includes(ctx.status(id)));
  }
  if ("fact" in cond) {
    const want = cond.present ?? true;
    const subjects = ctx.resolve(cond.of ?? "self");
    if (cond.about === undefined) {
      return every(subjects, (id) => ctx.hasFact(id, cond.fact) === want);
    }
    const objects = ctx.resolve(cond.about);
    return every(subjects, (id) => every(objects, (about) => ctx.hasFact(id, cond.fact, about) === want));
  }
  if ("sessionFact" in cond) {
    return ctx.hasSessionFact(cond.sessionFact) === (cond.present ?? true);
  }
  if ("relation" in cond) {
    const r = cond.relation;
    const froms = ctx.resolve(r.from ?? "self");
    const tos = ctx.resolve(r.to);
    return every(froms, (a) =>
      every(tos, (b) => {
        if (a === b) return false;
        const rel = ctx.relation(a, b);
        return (
          (r.typeIn === undefined || r.typeIn.includes(rel.type)) &&
          inBounds(rel.affinity, r.affinityGte, r.affinityLte) &&
          inBounds(rel.trust, r.trustGte, r.trustLte)
        );
      }),
    );
  }
  if ("seenEvent" in cond) {
    const want = cond.present ?? true;
    return every(ctx.resolve(cond.of ?? "self"), (id) => ctx.seenEvent(id, cond.seenEvent) === want);
  }
  if ("age" in cond) {
    return every(ctx.resolve(cond.of ?? "self"), (id) => inBounds(ctx.age(id), cond.age.gte, cond.age.lte));
  }
  if ("seasonIn" in cond) return cond.seasonIn.includes(ctx.season());
  if ("progress" in cond) {
    return inBounds(ctx.progress(), cond.progress.gte, cond.progress.lte);
  }
  if ("chose" in cond) {
    if (!ctx.choicesOf) throw new Error("`chose` condition evaluated outside of event resolution");
    const picks = ctx.choicesOf(cond.role);
    const hits = picks.filter((c) => c === cond.chose).length;
    switch (cond.count ?? "any") {
      case "any":
        return hits > 0;
      case "all":
        return picks.length > 0 && hits === picks.length;
      case "none":
        return hits === 0;
    }
  }
  const unknown: never = cond;
  throw new Error(`Unknown condition: ${JSON.stringify(unknown)}`);
}

/** Visits every node of a condition tree (depth-first, parents first). */
export function walkCondition(cond: Condition, visit: (node: Condition) => void): void {
  visit(cond);
  if ("all" in cond) cond.all.forEach((c) => walkCondition(c, visit));
  else if ("any" in cond) cond.any.forEach((c) => walkCondition(c, visit));
  else if ("not" in cond) walkCondition(cond.not, visit);
}

/** All character refs mentioned by a single (non-composite) condition node. */
export function refsOf(node: Condition): Ref[] {
  if ("attr" in node || "careerIn" in node || "statusIn" in node || "seenEvent" in node || "age" in node) {
    return [node.of ?? "self"];
  }
  if ("fact" in node) return node.about ? [node.of ?? "self", node.about] : [node.of ?? "self"];
  if ("relation" in node) return [node.relation.from ?? "self", node.relation.to];
  return [];
}
