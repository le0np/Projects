import { describe, expect, it } from "vitest";
import { ConditionSchema, evaluate, type Condition, type ConditionContext, type RelationView } from "../src";

interface Char {
  career: string;
  health: number;
  money: number;
  status?: "active" | "dead";
  facts?: string[];
  seen?: string[];
}

function makeContext(
  chars: Record<string, Char>,
  bindings: Record<string, string[]>,
  extra: { relations?: Record<string, RelationView>; choices?: Record<string, string[]>; progress?: number; sessionFacts?: string[] } = {},
): ConditionContext {
  return {
    resolve: (ref) => (ref === "self" ? (bindings.self ?? []) : (bindings[ref.slice(5)] ?? [])),
    attr: (id, a) => (a === "health" ? chars[id]!.health : a === "money" ? chars[id]!.money : 50),
    career: (id) => chars[id]!.career,
    status: (id) => chars[id]!.status ?? "active",
    hasFact: (id, key, about) => (chars[id]!.facts ?? []).includes(about ? `${key}:${about}` : key),
    hasSessionFact: (key) => (extra.sessionFacts ?? []).includes(key),
    relation: (a, b) => extra.relations?.[`${a}>${b}`] ?? { type: "stranger", affinity: 0, trust: 50 },
    seenEvent: (id, ev) => (chars[id]!.seen ?? []).includes(ev),
    progress: () => extra.progress ?? 0,
    choicesOf: extra.choices ? (role) => extra.choices![role] ?? [] : undefined,
  };
}

const chars: Record<string, Char> = {
  ana: { career: "doctor", health: 40, money: 80, facts: ["employed", "owes_money:ben"], seen: ["intro"] },
  ben: { career: "lawyer", health: 90, money: 20, facts: ["employed"] },
  cid: { career: "civilian", health: 60, money: 50, status: "dead" },
};

describe("evaluate", () => {
  const ctx = makeContext(chars, { self: ["ana"], patient: ["ana"], helpers: ["ben", "cid"], lender: ["ben"] }, {
    relations: { "ana>ben": { type: "friend", affinity: 40, trust: 70 } },
    choices: { helpers: ["cpr", "walk_away"], lender: ["lend"] },
    progress: 0.5,
    sessionFacts: ["storm"],
  });
  const t = (c: Condition) => evaluate(ConditionSchema.parse(c), ctx);

  it("attribute bounds default to self", () => {
    expect(t({ attr: "health", lte: 40 })).toBe(true);
    expect(t({ attr: "health", gte: 41 })).toBe(false);
    expect(t({ attr: "money", of: "role:lender", lte: 20 })).toBe(true);
  });

  it("multi-member roles require every member to match", () => {
    expect(t({ attr: "health", of: "role:helpers", gte: 60 })).toBe(true);
    expect(t({ attr: "health", of: "role:helpers", gte: 61 })).toBe(false);
    expect(t({ statusIn: ["active"], of: "role:helpers" })).toBe(false);
  });

  it("empty refs make leaves false", () => {
    expect(t({ attr: "health", of: "role:nobody", gte: 0 })).toBe(false);
  });

  it("careers, facts, pair facts, session facts, seen events", () => {
    expect(t({ careerIn: ["doctor", "engineer"] })).toBe(true);
    expect(t({ fact: "employed", of: "role:lender" })).toBe(true);
    expect(t({ fact: "owes_money", about: "role:lender" })).toBe(true);
    expect(t({ fact: "owes_money", of: "role:lender", about: "role:patient" })).toBe(false);
    expect(t({ fact: "owes_money", about: "role:lender", present: false })).toBe(false);
    expect(t({ sessionFact: "storm" })).toBe(true);
    expect(t({ seenEvent: "intro" })).toBe(true);
    expect(t({ seenEvent: "intro", of: "role:lender", present: false })).toBe(true);
  });

  it("relations are directional and never match a character with itself", () => {
    expect(t({ relation: { to: "role:lender", typeIn: ["friend"], trustGte: 60 } })).toBe(true);
    expect(t({ relation: { from: "role:lender", to: "role:patient", typeIn: ["friend"] } })).toBe(false);
    expect(t({ relation: { to: "role:patient" } })).toBe(false);
  });

  it("chose counts", () => {
    expect(t({ chose: "cpr", role: "helpers" })).toBe(true);
    expect(t({ chose: "cpr", role: "helpers", count: "all" })).toBe(false);
    expect(t({ chose: "lend", role: "lender", count: "all" })).toBe(true);
    expect(t({ chose: "refuse", role: "lender", count: "none" })).toBe(true);
  });

  it("combinators and progress", () => {
    expect(t({ all: [{ progress: { gte: 0.4, lte: 0.6 } }, { not: { careerIn: ["lawyer"] } }] })).toBe(true);
    expect(t({ any: [{ careerIn: ["lawyer"] }, { attr: "health", gte: 99 }] })).toBe(false);
  });

  it("chose outside resolution throws", () => {
    const noChoices = makeContext(chars, { self: ["ana"] });
    expect(() => evaluate({ chose: "x", role: "y" }, noChoices)).toThrow();
  });
});

describe("ConditionSchema", () => {
  it("rejects unknown keys and bad refs", () => {
    expect(ConditionSchema.safeParse({ attr: "health", gte: 1, typo: true }).success).toBe(false);
    expect(ConditionSchema.safeParse({ attr: "health", of: "witness" }).success).toBe(false);
    expect(ConditionSchema.safeParse({ attr: "luck", gte: 1 }).success).toBe(false);
  });
});
