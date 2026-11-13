/**
 * Content validation: structural checks (Zod schemas from @lifesim/core) plus
 * cross-reference and logic checks that a schema cannot express.
 *
 * Pure function over already-read JSON, so tests can feed it in-memory fixtures.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  CareersFileSchema,
  EventSchema,
  FactsFileSchema,
  SESSION_LIMITS,
  parseRef,
  refsOf,
  walkCondition,
  type Career,
  type Choice,
  type Condition,
  type Effect,
  type EventDefinition,
  type Fact,
  type FollowUp,
  type Perceived,
} from "@lifesim/core";

export type Severity = "error" | "warning";

export interface Issue {
  severity: Severity;
  /** File name (or "content" for global checks). */
  source: string;
  /** Location inside the file, e.g. `outcomes[2].effects[0].target`. */
  path: string;
  message: string;
}

export interface RawFile {
  file: string;
  data: unknown;
}

export interface RawContent {
  careers: RawFile;
  facts: RawFile;
  events: RawFile[];
}

export interface ContentBundle {
  careers: ReadonlyMap<string, Career>;
  facts: ReadonlyMap<string, Fact>;
  events: ReadonlyMap<string, EventDefinition>;
  /** sha256 of the raw content; recorded in session logs for replay. */
  hash: string;
}

export interface ValidationResult {
  /** Present only when there are no errors. */
  bundle: ContentBundle | null;
  issues: Issue[];
}

// ------------------------------------------------------------------ helpers

type Report = (severity: Severity, path: string, message: string) => void;

function formatZodIssues(error: z.ZodError, source: string, out: Issue[]): void {
  const visit = (issue: z.core.$ZodIssue, prefix: PropertyKey[]): void => {
    if (issue.code === "invalid_union" && issue.errors.length > 0) {
      // Report the branch that got furthest (deepest path) — usually the intended one.
      const depth = (branch: z.core.$ZodIssue[]) => Math.max(0, ...branch.map((i) => i.path.length));
      const best = issue.errors.reduce((a, b) => (depth(b) > depth(a) ? b : a));
      if (depth(best) > 0) {
        for (const sub of best) visit(sub, [...prefix, ...issue.path]);
        return;
      }
    }
    out.push({
      severity: "error",
      source,
      path: formatPath([...prefix, ...issue.path]),
      message: issue.message,
    });
  };
  for (const issue of error.issues) visit(issue, []);
}

function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((p, i) => (typeof p === "number" ? `[${p}]` : i === 0 ? String(p) : `.${String(p)}`))
    .join("");
}

function countRange(count: number | [number, number]): [number, number] {
  return typeof count === "number" ? [count, count] : count;
}

function delayRange(delay: FollowUp["delaySeconds"]): [number, number] {
  if (delay === undefined) return [0, 0];
  return typeof delay === "number" ? [delay, delay] : delay;
}

const PLACEHOLDER = /\{([^{}]*)\}/g;

// ------------------------------------------------------------------ validator

interface Registry {
  careers: Map<string, Career>;
  facts: Map<string, Fact>;
  events: Map<string, EventDefinition>;
  /** Facts referenced by conditions / set or removed by effects (for global checks). */
  factsChecked: Set<string>;
  factsSet: Set<string>;
  /** All follow-up edges: source event id → target event ids (reachability). */
  followUpEdges: Map<string, Set<string>>;
  /** Careers that have at least one special choice. */
  careersWithSpecials: Set<string>;
  /** Follow-up edges that fire immediately and unconditionally (loop detection). */
  immediateEdges: Map<string, Set<string>>;
}

interface Scope {
  roles: ReadonlySet<string>;
  allowSelf: boolean;
  allowSession: boolean;
}

interface ConditionScope extends Scope {
  /** Allow `chose` nodes; maps role → choice ids. */
  choices?: ReadonlyMap<string, ReadonlySet<string>>;
}

export function validateContent(raw: RawContent): ValidationResult {
  const issues: Issue[] = [];
  const reg: Registry = {
    careers: new Map(),
    facts: new Map(),
    events: new Map(),
    factsChecked: new Set(),
    factsSet: new Set(),
    followUpEdges: new Map(),
    careersWithSpecials: new Set(),
    immediateEdges: new Map(),
  };
  const reporter =
    (source: string): Report =>
    (severity, path, message) =>
      issues.push({ severity, source, path, message });

  // --- careers
  const careers = CareersFileSchema.safeParse(raw.careers.data);
  if (!careers.success) formatZodIssues(careers.error, raw.careers.file, issues);
  else {
    const report = reporter(raw.careers.file);
    careers.data.careers.forEach((c, i) => {
      if (reg.careers.has(c.id)) report("error", `careers[${i}].id`, `duplicate career id "${c.id}"`);
      reg.careers.set(c.id, c);
      const seen = new Set<string>();
      c.abilities.forEach((a, j) => {
        if (seen.has(a.id)) report("error", `careers[${i}].abilities[${j}].id`, `duplicate ability id "${a.id}"`);
        seen.add(a.id);
      });
    });
  }

  // --- facts
  const facts = FactsFileSchema.safeParse(raw.facts.data);
  if (!facts.success) formatZodIssues(facts.error, raw.facts.file, issues);
  else {
    const report = reporter(raw.facts.file);
    facts.data.facts.forEach((f, i) => {
      if (reg.facts.has(f.key)) report("error", `facts[${i}].key`, `duplicate fact key "${f.key}"`);
      if (f.setAtInit && f.scope !== "character") report("error", `facts[${i}]`, "only character facts can be set at init");
      if (f.recap?.about && f.scope !== "pair") report("error", `facts[${i}].recap.about`, "only pair facts have an `about` character");
      reg.facts.set(f.key, f);
    });
  }

  // --- events: structure first, so cross-references between events can be resolved
  const parsed: { file: string; event: EventDefinition }[] = [];
  for (const { file, data } of raw.events) {
    const result = EventSchema.safeParse(data);
    if (!result.success) {
      formatZodIssues(result.error, file, issues);
      continue;
    }
    const ev = result.data;
    const report = reporter(file);
    if (reg.events.has(ev.id)) {
      report("error", "id", `duplicate event id "${ev.id}"`);
      continue;
    }
    const base = file.split(/[\\/]/).pop() ?? file;
    if (base !== `${ev.id}.json`) report("error", "id", `file name must be "${ev.id}.json"`);
    reg.events.set(ev.id, ev);
    parsed.push({ file, event: ev });
  }

  for (const { file, event } of parsed) checkEvent(event, reg, reporter(file));

  // --- global checks
  const report = reporter("content");
  const reachable = reachableFromDirector(reg);
  for (const ev of reg.events.values()) {
    if (ev.trigger === "followup_only" && !reachable.has(ev.id)) {
      report("warning", ev.id, "followup_only event cannot be reached from any director event (unreachable)");
    }
    if (ev.trigger === "director" && ev.weight === 0) report("warning", ev.id, "director event has weight 0");
  }
  for (const [key, fact] of reg.facts) {
    if (!reg.factsChecked.has(key) && !reg.factsSet.has(key)) {
      report("warning", `facts.${key}`, "fact is registered but never used");
    } else if (reg.factsChecked.has(key) && !reg.factsSet.has(key) && !fact.setAtInit) {
      report("warning", `facts.${key}`, "fact is checked by conditions but never set — the condition can never be true");
    }
  }
  for (const id of reg.careers.keys()) {
    if (!reg.careersWithSpecials.has(id)) report("warning", `careers.${id}`, "career has no special choice in any event");
  }
  for (const cycle of findCycles(reg.immediateEdges)) {
    report("error", cycle[0] as string, `immediate unconditional follow-up loop: ${cycle.join(" → ")}`);
  }

  const hasErrors = issues.some((i) => i.severity === "error");
  return {
    issues,
    bundle: hasErrors
      ? null
      : { careers: reg.careers, facts: reg.facts, events: reg.events, hash: hashContent(raw) },
  };
}

export function hashContent(raw: RawContent): string {
  const events = [...raw.events].sort((a, b) => a.file.localeCompare(b.file)).map((e) => e.data);
  return createHash("sha256")
    .update(JSON.stringify([raw.careers.data, raw.facts.data, events]))
    .digest("hex")
    .slice(0, 16);
}

// ------------------------------------------------------------------ per-event checks

function checkEvent(ev: EventDefinition, reg: Registry, report: Report): void {
  const roleNames = Object.keys(ev.roles);
  const roles = new Set(roleNames);
  const choiceIds = new Map<string, Set<string>>();
  for (const [role, list] of Object.entries(ev.choices)) choiceIds.set(role, new Set(list.map((c) => c.id)));

  // Roles
  const minTotal = roleNames.reduce((sum, r) => sum + countRange(ev.roles[r]!.count)[0], 0);
  if (roleNames.some((r) => ev.roles[r]!.aware === false) && !ev.hidden) {
    report("error", "hidden", "an event with unaware roles must be hidden, or its public text would tell them");
  }
  if (minTotal > SESSION_LIMITS.maxParticipants) {
    report("error", "roles", `needs at least ${minTotal} participants, a session has at most ${SESSION_LIMITS.maxParticipants}`);
  }
  roleNames.forEach((name, index) => {
    const role = ev.roles[name]!;
    checkCareers(role.careers, `roles.${name}.careers`, reg, report);
    if (role.conditions) {
      const earlier = new Set(roleNames.slice(0, index));
      checkCondition(role.conditions, `roles.${name}.conditions`, reg, report, {
        roles: earlier,
        allowSelf: true,
        allowSession: false,
      }, `role conditions may only reference roles declared before "${name}"`);
    }
  });

  if (ev.conditions) {
    checkCondition(ev.conditions, "conditions", reg, report, { roles, allowSelf: false, allowSession: false });
  }

  // Text
  checkPlaceholders(ev.title, "title", roles, report);
  checkPlaceholders(ev.text.public, "text.public", roles, report);
  for (const [role, text] of Object.entries(ev.text.private ?? {})) {
    if (!roles.has(role)) report("error", `text.private.${role}`, `unknown role "${role}"`);
    checkPlaceholders(text, `text.private.${role}`, roles, report);
  }

  // Choices
  const decidingRoles = Object.keys(ev.choices);
  if (decidingRoles.length === 0) report("error", "choices", "event has no choices for any role");
  for (const [role, list] of Object.entries(ev.choices)) {
    const path = `choices.${role}`;
    if (!roles.has(role)) {
      report("error", path, `choices for unknown role "${role}"`);
      continue;
    }
    if (ev.roles[role]!.aware === false) report("error", path, `role "${role}" is unaware and cannot have choices`);
    if (list.length < 2) report("error", path, "a deciding role needs at least two choices");
    const defaults = list.filter((c) => c.default);
    if (defaults.length !== 1) report("error", path, `exactly one default choice required, found ${defaults.length}`);
    for (const d of defaults) {
      if (d.careers || d.condition) report("error", `${path}.${d.id}`, "default choice must be available to everyone (no careers/condition)");
    }
    const seen = new Set<string>();
    list.forEach((choice, i) => {
      const cpath = `${path}[${i}]`;
      if (seen.has(choice.id)) report("error", `${cpath}.id`, `duplicate choice id "${choice.id}"`);
      seen.add(choice.id);
      checkChoice(choice, cpath, roles, reg, report);
    });
  }

  // Outcomes
  const outcomeIds = new Set<string>();
  const outcomeScope: ConditionScope = { roles, allowSelf: false, allowSession: false, choices: choiceIds };
  const effectScope: Scope = { roles, allowSelf: false, allowSession: true };
  ev.outcomes.forEach((outcome, i) => {
    const path = `outcomes[${i}]`;
    if (outcomeIds.has(outcome.id)) report("error", `${path}.id`, `duplicate outcome id "${outcome.id}"`);
    outcomeIds.add(outcome.id);
    const unconditional = outcome.when === undefined && outcome.chance === undefined;
    if (unconditional && i < ev.outcomes.length - 1) {
      report("error", path, `outcome "${outcome.id}" always matches, so the outcomes after it are unreachable`);
    }
    if (i === ev.outcomes.length - 1 && !unconditional) {
      report("error", path, "the last outcome must be an unconditional fallback (no `when`, no `chance`)");
    }
    if (outcome.when) checkCondition(outcome.when, `${path}.when`, reg, report, outcomeScope);
    checkEffects(outcome.effects ?? [], `${path}.effects`, reg, report, effectScope);
    for (const [role, text] of Object.entries(outcome.text ?? {})) {
      if (!roles.has(role)) report("error", `${path}.text.${role}`, `unknown role "${role}"`);
      checkPlaceholders(text, `${path}.text.${role}`, roles, report);
    }
    (outcome.followUps ?? []).forEach((fu, j) => checkFollowUp(ev, fu, `${path}.followUps[${j}]`, reg, report));
  });
}

function checkChoice(choice: Choice, path: string, roles: ReadonlySet<string>, reg: Registry, report: Report): void {
  checkPlaceholders(choice.label, `${path}.label`, roles, report);
  checkCareers(choice.careers, `${path}.careers`, reg, report);
  for (const c of choice.careers ?? []) reg.careersWithSpecials.add(c);
  checkCareers(choice.insight?.careers, `${path}.insight.careers`, reg, report);
  checkPerceived(choice.perceived, `${path}.perceived`, roles, report);
  checkPerceived(choice.insight?.perceived, `${path}.insight.perceived`, roles, report);
  if (choice.condition) {
    checkCondition(choice.condition, `${path}.condition`, reg, report, { roles, allowSelf: true, allowSession: false });
  }
  checkEffects(choice.effects ?? [], `${path}.effects`, reg, report, { roles, allowSelf: true, allowSession: true });
}

function checkPerceived(p: Perceived | undefined, path: string, roles: ReadonlySet<string>, report: Report): void {
  for (const role of Object.keys(p?.relation ?? {})) {
    if (!roles.has(role)) report("error", `${path}.relation.${role}`, `unknown role "${role}"`);
  }
}

function checkCareers(ids: readonly string[] | undefined, path: string, reg: Registry, report: Report): void {
  for (const id of ids ?? []) if (!reg.careers.has(id)) report("error", path, `unknown career "${id}"`);
}

function checkPlaceholders(text: string, path: string, roles: ReadonlySet<string>, report: Report): void {
  for (const m of text.matchAll(PLACEHOLDER)) {
    if (!roles.has(m[1] as string)) report("error", path, `placeholder "{${m[1]}}" is not a role of this event`);
  }
}

function checkRef(ref: string, path: string, scope: Scope, report: Report, roleHint?: string): void {
  const parsed = parseRef(ref);
  if (!parsed) return report("error", path, `invalid reference "${ref}"`);
  if (parsed.kind === "self" && !scope.allowSelf) report("error", path, `"self" is not available here`);
  if (parsed.kind === "session" && !scope.allowSession) report("error", path, `"session" is not available here`);
  if (parsed.kind === "role" && !scope.roles.has(parsed.role)) {
    report("error", path, roleHint ? `${roleHint} (got "${parsed.role}")` : `unknown role "${parsed.role}"`);
  }
}

function checkFactUse(key: string, hasAbout: boolean, path: string, reg: Registry, report: Report, targetIsSession = false): void {
  const fact = reg.facts.get(key);
  if (!fact) return report("error", path, `unknown fact "${key}" (register it in facts.json)`);
  if (fact.scope === "session" && !targetIsSession) report("error", path, `"${key}" is a session fact`);
  if (fact.scope !== "session" && targetIsSession) report("error", path, `"${key}" is not a session fact`);
  if (fact.scope === "pair" && !hasAbout) report("error", path, `pair fact "${key}" needs "about"`);
  if (fact.scope !== "pair" && hasAbout) report("error", path, `fact "${key}" is not a pair fact; remove "about"`);
}

function checkCondition(
  cond: Condition,
  path: string,
  reg: Registry,
  report: Report,
  scope: ConditionScope,
  roleHint?: string,
): void {
  walkCondition(cond, (node) => {
    for (const ref of refsOf(node)) {
      if (parseRef(ref)?.kind === "session") report("error", path, `"session" cannot be used in conditions`);
      else checkRef(ref, path, scope, report, roleHint);
    }
    if ("careerIn" in node) checkCareers(node.careerIn, path, reg, report);
    if ("fact" in node) {
      reg.factsChecked.add(node.fact);
      checkFactUse(node.fact, node.about !== undefined, path, reg, report);
    }
    if ("sessionFact" in node) {
      reg.factsChecked.add(node.sessionFact);
      checkFactUse(node.sessionFact, false, path, reg, report, true);
    }
    if ("seenEvent" in node && !reg.events.has(node.seenEvent)) report("error", path, `unknown event "${node.seenEvent}"`);
    if ("attr" in node && node.gte !== undefined && node.lte !== undefined && node.gte > node.lte) {
      report("error", path, `impossible bounds: gte ${node.gte} > lte ${node.lte}`);
    }
    if ("progress" in node) {
      const { gte, lte } = node.progress;
      if (gte !== undefined && lte !== undefined && gte > lte) report("error", path, `impossible progress bounds`);
    }
    if ("chose" in node) {
      if (!scope.choices) report("error", path, "`chose` is only allowed in outcome conditions");
      else {
        const ids = scope.choices.get(node.role);
        if (!ids) report("error", path, `role "${node.role}" has no choices`);
        else if (!ids.has(node.chose)) report("error", path, `role "${node.role}" has no choice "${node.chose}"`);
      }
    }
  });
}

function checkEffects(effects: readonly Effect[], path: string, reg: Registry, report: Report, scope: Scope): void {
  const factOps = new Map<string, Set<"set" | "remove">>();
  const statuses = new Map<string, Set<string>>();
  const nonFactScope = { ...scope, allowSession: false };
  effects.forEach((effect, i) => {
    const p = `${path}[${i}]`;
    switch (effect.type) {
      case "attr":
        checkRef(effect.target, `${p}.target`, nonFactScope, report);
        break;
      case "status": {
        checkRef(effect.target, `${p}.target`, nonFactScope, report);
        const set = statuses.get(effect.target) ?? new Set();
        set.add(effect.status);
        statuses.set(effect.target, set);
        break;
      }
      case "relation":
        checkRef(effect.from, `${p}.from`, nonFactScope, report);
        checkRef(effect.to, `${p}.to`, nonFactScope, report);
        if (effect.from === effect.to) report("error", p, "relation effect from a ref to itself");
        if (effect.affinity === undefined && effect.trust === undefined && effect.setType === undefined) {
          report("error", p, "relation effect changes nothing");
        }
        break;
      case "fact": {
        checkRef(effect.target, `${p}.target`, scope, report);
        if (effect.about) checkRef(effect.about, `${p}.about`, nonFactScope, report);
        checkFactUse(effect.key, effect.about !== undefined, p, reg, report, effect.target === "session");
        if (!effect.remove) reg.factsSet.add(effect.key);
        else reg.factsChecked.add(effect.key);
        const k = `${effect.target}|${effect.key}|${effect.about ?? ""}`;
        const ops = factOps.get(k) ?? new Set();
        ops.add(effect.remove ? "remove" : "set");
        factOps.set(k, ops);
        break;
      }
    }
  });
  for (const [k, ops] of factOps) {
    if (ops.size > 1) report("error", path, `conflicting effects: fact "${k.split("|")[1]}" is both set and removed`);
  }
  for (const [target, set] of statuses) {
    if (set.size > 1) report("error", path, `conflicting effects: ${target} gets statuses ${[...set].join(", ")}`);
  }
}

function checkFollowUp(source: EventDefinition, fu: FollowUp, path: string, reg: Registry, report: Report): void {
  const out = reg.followUpEdges.get(source.id) ?? new Set();
  out.add(fu.event);
  reg.followUpEdges.set(source.id, out);
  const target = reg.events.get(fu.event);
  const sourceRoles = new Set(Object.keys(source.roles));
  if (fu.condition) {
    checkCondition(fu.condition, `${path}.condition`, reg, report, { roles: sourceRoles, allowSelf: false, allowSession: false });
  }
  if (!target) return report("error", `${path}.event`, `unknown follow-up event "${fu.event}"`);

  const mapped = Object.entries(fu.roles);
  if (mapped.length === 0) report("error", `${path}.roles`, "a follow-up must carry over at least one participant");
  const usedSources = new Set<string>();
  for (const [targetRole, ref] of mapped) {
    const rp = `${path}.roles.${targetRole}`;
    const targetDef = target.roles[targetRole];
    if (!targetDef) {
      report("error", rp, `event "${target.id}" has no role "${targetRole}"`);
      continue;
    }
    const parsed = parseRef(ref);
    if (parsed?.kind !== "role" || !sourceRoles.has(parsed.role)) {
      report("error", rp, `must map to a role of "${source.id}" (got "${ref}")`);
      continue;
    }
    if (usedSources.has(parsed.role)) report("error", rp, `role "${parsed.role}" is mapped to more than one target role`);
    usedSources.add(parsed.role);
    const [smin, smax] = countRange(source.roles[parsed.role]!.count);
    const [tmin, tmax] = countRange(targetDef.count);
    if (smin < tmin || smax > tmax) {
      report("error", rp, `"${parsed.role}" has ${smin}–${smax} members but "${target.id}.${targetRole}" accepts ${tmin}–${tmax}`);
    }
  }

  const [dmin] = delayRange(fu.delaySeconds);
  if (dmin === 0 && fu.chance === undefined && fu.condition === undefined) {
    const edges = reg.immediateEdges.get(source.id) ?? new Set();
    edges.add(target.id);
    reg.immediateEdges.set(source.id, edges);
  }
}

function reachableFromDirector(reg: Registry): Set<string> {
  const seen = new Set<string>();
  const queue = [...reg.events.values()].filter((e) => e.trigger === "director").map((e) => e.id);
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of reg.followUpEdges.get(id) ?? []) queue.push(next);
  }
  return seen;
}

function findCycles(edges: ReadonlyMap<string, ReadonlySet<string>>): string[][] {
  const cycles: string[][] = [];
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const visit = (node: string): void => {
    state.set(node, "visiting");
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      const s = state.get(next);
      if (s === "visiting") cycles.push([...stack.slice(stack.indexOf(next)), next]);
      else if (s === undefined) visit(next);
    }
    stack.pop();
    state.set(node, "done");
  };
  for (const node of edges.keys()) if (!state.has(node)) visit(node);
  return cycles;
}
