/**
 * Sprint 5: content for "Life in chapters" (packages/content/chapters): `setup.json` (dreams, flaws,
 * careers, the cast, focus cards, titles) and `events/*.json`. Structural checks are the Zod schemas
 * in @lifesim/core; here are the cross-reference and coverage checks the sprint asks for.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAST_ROLES,
  ChapterSetupSchema,
  FOCUSES,
  LifeEventSchema,
  type ChapterContent,
  type LifeCond,
  type LifeEffect,
  type LifeEvent,
  type LifeOutcome,
  type LifeText,
} from "@lifesim/core";
import type { Issue } from "./validate";

export const DEFAULT_CHAPTERS_DIR = fileURLToPath(new URL("../chapters", import.meta.url));

/** Tokens a text may use: `{friend}`, `{friend.he}`, `{Friend.he}` (capitalised pronoun), `{money}`… */
const PLAIN_TOKENS = new Set(["name", "money", "fame", "rep", "job", "job2", "workplace", "home", "secret", "kids", "age"]);
const PERSON_TOKENS = new Set(["friend", "crush", "rival", "target", "about"]);
const PRONOUN_KEYS = new Set(["he", "him", "his"]);

export interface RawChapters {
  setup: { file: string; data: unknown };
  events: { file: string; data: unknown }[];
}

export function readChaptersDir(dir: string = DEFAULT_CHAPTERS_DIR): RawChapters {
  const read = (file: string) => ({ file, data: JSON.parse(readFileSync(join(dir, file), "utf8")) as unknown });
  const files = readdirSync(join(dir, "events"))
    .filter((f) => f.endsWith(".json"))
    .sort();
  return { setup: read("setup.json"), events: files.map((f) => read(join("events", f))) };
}

export function validateChapters(raw: RawChapters): { content: ChapterContent | null; issues: Issue[] } {
  const issues: Issue[] = [];
  const err = (source: string, path: string, message: string) => issues.push({ severity: "error", source, path, message });
  const warn = (source: string, path: string, message: string) => issues.push({ severity: "warning", source, path, message });

  const setupParsed = ChapterSetupSchema.safeParse(raw.setup.data);
  if (!setupParsed.success) for (const i of setupParsed.error.issues) err(raw.setup.file, i.path.join("."), i.message);
  const events: { file: string; event: LifeEvent }[] = [];
  for (const f of raw.events) {
    const list = Array.isArray(f.data) ? f.data : [f.data];
    list.forEach((e, idx) => {
      const p = LifeEventSchema.safeParse(e);
      if (!p.success) for (const i of p.error.issues) err(f.file, `[${idx}].${i.path.join(".")}`, i.message);
      else events.push({ file: f.file, event: p.data });
    });
  }
  if (!setupParsed.success) return { content: null, issues };
  const setup = setupParsed.data;

  const dreams = new Set(setup.dreams.map((d) => d.id));
  const flaws = new Set(setup.flaws.map((f) => f.id));
  const careers = new Set(setup.careers.map((c) => c.id));
  const unique = (ids: string[], what: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) err(raw.setup.file, what, `duplicate id "${id}"`);
      seen.add(id);
    }
  };
  unique(setup.dreams.map((d) => d.id), "dreams");
  unique(setup.flaws.map((d) => d.id), "flaws");
  unique(setup.careers.map((d) => d.id), "careers");
  unique(setup.cast.map((d) => d.id), "cast");
  unique(events.map((e) => e.event.id), "events");
  for (const role of CAST_ROLES) if (setup.cast.filter((c) => c.role === role).length < 2) err(raw.setup.file, "cast", `role "${role}" needs at least 2 characters`);
  for (const f of FOCUSES) if (!setup.focuses.some((d) => d.id === f)) err(raw.setup.file, "focuses", `no card for focus "${f}"`);

  const flagsSet = new Set<string>();
  const flagsRead = new Map<string, string>();
  const checkText = (src: string, path: string, t: LifeText | undefined, ctx: { kind?: string }) => {
    if (t === undefined) return;
    const variants = typeof t === "string" ? [{ text: t, when: undefined }] : t;
    variants.forEach((v, i) => {
      if (v.when) checkCond(src, `${path}[${i}].when`, v.when);
      for (const m of v.text.matchAll(/\{([A-Za-z0-9_.]+)\}/g)) {
        const tok = m[1] as string;
        const [head, sub] = tok.split(".");
        const lower = (head as string).toLowerCase();
        if (sub === undefined && PLAIN_TOKENS.has(tok)) {
          if (tok === "secret" && ctx.kind !== "damage") err(src, path, `{secret} only works in damage control events`);
          continue;
        }
        if (PERSON_TOKENS.has(lower) && (sub === undefined ? head === lower : PRONOUN_KEYS.has(sub))) {
          if (lower === "target" && ctx.kind !== "revenge" && ctx.kind !== "reveal") err(src, path, `{target} only works in revenge events`);
          if (lower === "about" && ctx.kind !== "damage" && ctx.kind !== "reveal") err(src, path, `{about} only works in damage control events`);
          continue;
        }
        err(src, path, `unknown token {${tok}}`);
      }
    });
    if (typeof t !== "string" && t[t.length - 1]?.when) warn(src, path, "the last variant has a condition; it may show no text");
  };
  const checkCond = (src: string, path: string, c: LifeCond) => {
    for (const d of c.dream ?? []) if (!dreams.has(d)) err(src, path, `unknown dream "${d}"`);
    for (const d of c.flaw ?? []) if (!flaws.has(d)) err(src, path, `unknown flaw "${d}"`);
    for (const d of c.career ?? []) if (!careers.has(d)) err(src, path, `unknown career "${d}"`);
    for (const f of [...(c.flags ?? []), ...(c.notFlags ?? [])]) if (!flagsRead.has(f)) flagsRead.set(f, `${src} ${path}`);
  };
  const checkEffects = (src: string, path: string, effects: LifeEffect[] | undefined, ctx: { kind?: string }) => {
    (effects ?? []).forEach((e, i) => {
      const p = `${path}[${i}]`;
      if ("flag" in e) flagsSet.add(e.flag);
      if ("rel" in e && e.rel === "target" && ctx.kind !== "revenge" && ctx.kind !== "reveal") err(src, p, `rel "target" only works in revenge events`);
      if ("rel" in e && e.rel === "about" && ctx.kind !== "damage" && ctx.kind !== "reveal") err(src, p, `rel "about" only works in damage control events`);
      if (("secretClear" in e || "secretDelay" in e || "secretRevealNow" in e) && ctx.kind !== "damage") err(src, p, "secret actions only work in damage control events");
      if ("secret" in e) {
        if (e.secret.about === "target" && ctx.kind !== "revenge") err(src, p, `secret about "target" only in revenge events`);
        if (e.secret.about === "about") err(src, p, `a new secret cannot be about "about"`);
        // A secret's texts are rendered when it is made (so {target} works in revenge); its reveal can use the person it is about.
        checkText(src, `${p}.secret.text`, e.secret.text, ctx);
        checkText(src, `${p}.secret.reveal.text`, e.secret.reveal.text, ctx);
        checkEffects(src, `${p}.secret.reveal.effects`, e.secret.reveal.effects, { kind: "reveal" });
      }
      if ("remember" in e) checkText(src, `${p}.remember`, e.remember, ctx);
    });
  };
  const checkOutcome = (src: string, path: string, o: LifeOutcome | undefined, ctx: { kind?: string }) => {
    if (!o) return;
    checkText(src, `${path}.text`, o.text, ctx);
    checkEffects(src, `${path}.effects`, o.effects, ctx);
    if (o.cast) checkText(src, `${path}.cast.did`, o.cast.did, ctx);
    for (const [flaw, fo] of Object.entries(o.byFlaw ?? {})) {
      if (!flaws.has(flaw)) err(src, `${path}.byFlaw`, `unknown flaw "${flaw}"`);
      checkText(src, `${path}.byFlaw.${flaw}.text`, fo.text, ctx);
      checkEffects(src, `${path}.byFlaw.${flaw}.effects`, fo.effects, ctx);
    }
  };

  for (const d of setup.dreams) {
    checkText(raw.setup.file, `dreams.${d.id}.finale.title`, d.finale.title, {});
    checkText(raw.setup.file, `dreams.${d.id}.finale.text`, d.finale.text, {});
    checkText(raw.setup.file, `dreams.${d.id}.finale.success`, d.finale.success.text, {});
    checkText(raw.setup.file, `dreams.${d.id}.finale.failure`, d.finale.failure.text, {});
    d.finale.factors.forEach((f, i) => {
      checkText(raw.setup.file, `dreams.${d.id}.finale.factors[${i}].label`, f.label, {});
      if (f.when) checkCond(raw.setup.file, `dreams.${d.id}.finale.factors[${i}].when`, f.when);
      if (f.add === undefined && f.per === undefined) err(raw.setup.file, `dreams.${d.id}.finale.factors[${i}]`, "a factor needs add or per");
    });
  }
  for (const f of setup.focuses) checkText(raw.setup.file, `focuses.${f.id}.hint`, f.hint, { kind: f.id });
  setup.titles.forEach((t, i) => {
    checkText(raw.setup.file, `titles[${i}].why`, t.why, {});
    if (t.when) checkCond(raw.setup.file, `titles[${i}].when`, t.when);
  });
  if (setup.titles[setup.titles.length - 1]?.when) err(raw.setup.file, "titles", "the last title must have no condition (fallback)");

  for (const { file, event: e } of events) {
    const ctx = { kind: e.kind };
    const at = (p: string) => `${e.id}.${p}`;
    if (e.when) checkCond(file, at("when"), e.when);
    checkText(file, at("title"), e.title, ctx);
    checkText(file, at("text"), e.text, ctx);
    checkText(file, at("private"), e.private, ctx);
    const ids = new Set<string>();
    for (const c of e.choices) {
      if (ids.has(c.id)) err(file, at(`choices.${c.id}`), "duplicate choice id");
      ids.add(c.id);
    }
    if (e.kind !== "finale" && e.choices.filter((c) => !c.career && !c.when).length < 2) err(file, at("choices"), "needs at least 2 choices everyone can take");
    for (const c of e.choices) {
      const cp = at(`choices.${c.id}`);
      checkText(file, `${cp}.label`, c.label, ctx);
      if (c.when) checkCond(file, `${cp}.when`, c.when);
      if (c.career && !careers.has(c.career)) err(file, cp, `unknown career "${c.career}"`);
      if (c.failTo && !ids.has(c.failTo)) err(file, cp, `failTo "${c.failTo}" is not a choice of this event`);
      if (c.failTo === c.id) err(file, cp, "failTo points to itself");
      if (c.cast && c.base !== undefined) err(file, cp, "a choice is decided either by a person (cast) or by odds (base), not both");
      if (c.cast === "target" && e.kind !== "revenge") err(file, cp, `cast "target" only in revenge events`);
      if (c.cast === "about" && e.kind !== "damage") err(file, cp, `cast "about" only in damage control events`);
      if ((c.base !== undefined || c.cast) && !c.fail && !c.failTo) err(file, cp, "a choice that can fail needs a fail outcome or failTo");
      for (const m of c.mods ?? []) checkCond(file, `${cp}.mods`, m.when);
      checkOutcome(file, `${cp}.ok`, c.ok, ctx);
      checkOutcome(file, `${cp}.fail`, c.fail, ctx);
    }
  }
  for (const [flag, where] of flagsRead) if (!flagsSet.has(flag)) err(where.split(" ")[0] as string, where.split(" ").slice(1).join(" "), `flag "${flag}" is read but never set`);

  // Coverage the sprint asks for (T21/T23).
  const evs = events.map((e) => e.event);
  for (const d of setup.dreams) {
    const n = evs.filter((e) => (d.focus as string[]).includes(e.kind)).length;
    if (n < 2) err(raw.setup.file, `dreams.${d.id}`, `only ${n} events feed this dream (needs 2)`);
  }
  const outcomesOf = (e: LifeEvent) => e.choices.flatMap((c) => [c.ok, c.fail].filter((o): o is LifeOutcome => !!o));
  for (const f of setup.flaws) {
    const byText = evs.some((e) => outcomesOf(e).some((o) => o.byFlaw?.[f.id]));
    if (!byText) err(raw.setup.file, `flaws.${f.id}`, "this flaw never changes an outcome's text (byFlaw)");
  }
  for (const c of setup.careers) {
    const n = new Set(evs.filter((e) => e.choices.some((ch) => ch.career === c.id)).map((e) => e.id)).size;
    if (n < 2) err(raw.setup.file, `careers.${c.id}`, `special choice in only ${n} events (needs 2)`);
  }
  for (const k of ["twist", "revenge", "damage"] as const) if (!evs.some((e) => e.kind === k)) err("events", "", `no "${k}" event`);
  for (const f of FOCUSES) if (f !== "revenge" && f !== "damage" && evs.filter((e) => e.kind === f).length === 0) err("events", "", `no events for focus "${f}"`);

  const hash = createHash("sha256")
    .update(JSON.stringify([raw.setup.data, raw.events.map((e) => e.data)]))
    .digest("hex")
    .slice(0, 12);
  const ok = !issues.some((i) => i.severity === "error");
  return { content: ok ? { ...setup, events: evs, hash } : null, issues };
}

export function loadChapters(dir: string = DEFAULT_CHAPTERS_DIR): ChapterContent {
  const { content, issues } = validateChapters(readChaptersDir(dir));
  const errors = issues.filter((i) => i.severity === "error");
  if (!content) {
    const lines = errors.slice(0, 10).map((e) => `  ${e.source} ${e.path}: ${e.message}`);
    throw new Error(`Chapters content is invalid (${errors.length} errors):\n${lines.join("\n")}`);
  }
  return content;
}
