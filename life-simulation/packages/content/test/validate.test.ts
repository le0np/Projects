import { describe, expect, it } from "vitest";
import { loadContent, readContentDir, validateContent, type RawContent } from "../src";

const { raw: original } = readContentDir();

/** Deep-cloned content with one event (or the whole content) mutated. */
function mutate(eventId: string | null, fn: (ev: any, raw: RawContent) => void): RawContent {
  const raw: RawContent = structuredClone(original);
  const ev = eventId === null ? null : raw.events.find((e) => (e.data as any).id === eventId)?.data;
  if (eventId !== null && !ev) throw new Error(`no event ${eventId}`);
  fn(ev, raw);
  return raw;
}

function errorsOf(raw: RawContent): string[] {
  return validateContent(raw)
    .issues.filter((i) => i.severity === "error")
    .map((i) => `${i.source} ${i.path}: ${i.message}`);
}

function expectError(raw: RawContent, fragment: string): void {
  const errors = errorsOf(raw);
  expect(errors.some((e) => e.includes(fragment)), `expected an error containing "${fragment}", got:\n${errors.join("\n")}`).toBe(true);
}

describe("shipped content", () => {
  it("has no errors and loads into a bundle", () => {
    const bundle = loadContent();
    expect(bundle.careers.size).toBe(10);
    expect(bundle.events.size).toBeGreaterThanOrEqual(6);
    expect(bundle.hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("content hash is stable and changes with content", () => {
    const a = validateContent(original).bundle!.hash;
    expect(validateContent(structuredClone(original)).bundle!.hash).toBe(a);
    const changed = mutate("everyday_missed_bus", (ev) => (ev.weight = 11));
    expect(validateContent(changed).bundle!.hash).not.toBe(a);
  });
});

describe("validator catches", () => {
  it("structural errors with a precise path", () => {
    expectError(mutate("everyday_missed_bus", (ev) => (ev.category = "sports")), "category");
    expectError(mutate("everyday_missed_bus", (ev) => (ev.choices.commuter[0].tagz = ["help"])), "choices.commuter[0]");
    expectError(mutate("everyday_missed_bus", (ev) => (ev.roles.commuter.conditions = { fact: "employed", of: "commuter" })), "roles.commuter.conditions.of");
  });

  it("missing choices", () => {
    expectError(mutate("everyday_missed_bus", (ev) => (ev.choices = {})), "no choices");
    expectError(mutate("everyday_missed_bus", (ev) => (ev.choices.commuter = ev.choices.commuter.slice(0, 1))), "at least two choices");
  });

  it("default choice problems", () => {
    expectError(mutate("everyday_missed_bus", (ev) => delete ev.choices.commuter[3].default), "exactly one default");
    expectError(mutate("everyday_missed_bus", (ev) => (ev.choices.commuter[0].default = true)), "exactly one default");
    expectError(
      mutate("everyday_missed_bus", (ev) => (ev.choices.commuter[3].careers = ["doctor"])),
      "default choice must be available to everyone",
    );
  });

  it("unknown careers, facts and roles", () => {
    expectError(mutate("health_collapse_street", (ev) => (ev.choices.bystander[4].careers = ["wizard"])), 'unknown career "wizard"');
    expectError(mutate("everyday_missed_bus", (ev) => (ev.roles.commuter.conditions = { fact: "employd" })), 'unknown fact "employd"');
    expectError(
      mutate("career_coworker_mistake", (ev) => (ev.outcomes[0].effects[0].target = "role:manager")),
      'unknown role "manager"',
    );
    expectError(mutate("everyday_missed_bus", (ev) => (ev.text.public = "{boss} is angry")), 'placeholder "{boss}"');
  });

  it("fact scope misuse", () => {
    expectError(mutate("financial_loan_due", (ev) => delete ev.conditions.about), 'pair fact "owes_money" needs "about"');
    expectError(
      mutate("everyday_missed_bus", (ev) => (ev.roles.commuter.conditions = { fact: "employed", about: "role:commuter" })),
      'not a pair fact',
    );
  });

  it("role conditions referencing roles declared later", () => {
    expectError(
      mutate("career_coworker_mistake", (ev) => {
        ev.roles = { witness: ev.roles.witness, requester: ev.roles.requester };
      }),
      "only reference roles declared before",
    );
  });

  it("self where no self exists, session in conditions", () => {
    expectError(mutate("career_coworker_mistake", (ev) => (ev.outcomes[0].effects[0].target = "self")), '"self" is not available');
    expectError(mutate("health_collapse_street", (ev) => (ev.conditions = { attr: "health", gte: 1 })), '"self" is not available');
  });

  it("chose outside outcomes and unknown choice ids", () => {
    expectError(mutate("everyday_missed_bus", (ev) => (ev.conditions = { chose: "run", role: "commuter" })), "only allowed in outcome");
    expectError(mutate("everyday_missed_bus", (ev) => (ev.outcomes[0].when = { chose: "fly", role: "commuter" })), 'no choice "fly"');
  });

  it("broken follow-up references", () => {
    expectError(mutate("financial_loan_request", (ev) => (ev.outcomes[1].followUps[0].event = "nope")), 'unknown follow-up event "nope"');
    expectError(
      mutate("financial_loan_request", (ev) => (ev.outcomes[1].followUps[0].roles = { debtor: "role:borrower", banker: "role:lender" })),
      'has no role "banker"',
    );
    expectError(
      mutate("financial_loan_request", (ev) => (ev.outcomes[1].followUps[0].roles = { debtor: "role:borrower", creditor: "role:borrower" })),
      "mapped to more than one target role",
    );
  });

  it("follow-up cardinality mismatch", () => {
    expectError(
      mutate("health_collapse_street", (ev) =>
        (ev.outcomes[0].followUps = [{ event: "financial_loan_due", roles: { debtor: "role:bystander", creditor: "role:patient" } }])),
      "accepts 1–1",
    );
  });

  it("immediate unconditional follow-up loops", () => {
    expectError(
      mutate("financial_loan_due", (ev) => {
        const fu = ev.outcomes[4].followUps[0];
        delete fu.delaySeconds;
      }),
      "immediate unconditional follow-up loop",
    );
  });

  it("impossible participant requirements", () => {
    expectError(mutate("health_collapse_street", (ev) => (ev.roles.bystander.count = [8, 9])), "at most 8");
    expectError(mutate("everyday_missed_bus", (ev) => (ev.roles.commuter.conditions = { attr: "health", gte: 80, lte: 20 })), "impossible bounds");
  });

  it("outcome ordering problems", () => {
    expectError(mutate("everyday_missed_bus", (ev) => delete ev.outcomes[2].when), "unreachable");
    expectError(mutate("everyday_missed_bus", (ev) => (ev.outcomes[4].when = { chose: "taxi", role: "commuter" })), "unconditional fallback");
  });

  it("conflicting outcomes", () => {
    expectError(
      mutate("financial_loan_due", (ev) =>
        ev.outcomes[0].effects.push({ type: "fact", target: "role:debtor", key: "owes_money", about: "role:creditor" })),
      "both set and removed",
    );
    expectError(
      mutate("health_collapse_street", (ev) =>
        ev.outcomes[3].effects.push({ type: "status", target: "role:patient", status: "hospitalized", cause: "x" })),
      "gets statuses",
    );
  });

  it("unaware roles cannot decide", () => {
    expectError(mutate("health_collapse_street", (ev) => (ev.roles.bystander.aware = false)), "is unaware and cannot have choices");
  });

  it("recap tags for the `about` character only on pair facts", () => {
    expectError(
      mutate(null, (_ev, raw) => ((raw.facts.data as any).facts[0].recap = { about: "saved_another" })),
      "only pair facts",
    );
  });

  it("duplicate ids and file name mismatch", () => {
    expectError(
      mutate(null, (_ev, raw) => raw.events.push({ file: "copy.json", data: structuredClone(raw.events[0]!.data) })),
      "duplicate event id",
    );
    expectError(mutate(null, (_ev, raw) => (raw.events[0]!.file = "wrong.json")), "file name must be");
  });

  it("warns about unreachable follow-up-only events", () => {
    const raw = mutate("financial_loan_request", (ev) => delete ev.outcomes[1].followUps);
    const warnings = validateContent(raw).issues.filter((i) => i.severity === "warning").map((i) => i.message);
    expect(warnings.some((w) => w.includes("unreachable"))).toBe(true);
  });
});
