/**
 * Domain log: the append-only, chronological source of truth for a session.
 * Life Recap, statistics, replay checks and the human-readable log are built from it.
 */
import type { Attribute, RelationType, Status } from "@lifesim/core";
import type { SessionConfig } from "./config";

export type EndReason = "time_limit" | "all_ended" | "story_resolved" | "cancelled";

export type Change =
  | { kind: "attr"; characterId: string; attribute: Attribute; delta: number; value: number }
  | { kind: "relation"; from: string; to: string; affinity: number; trust: number; type: RelationType }
  | { kind: "fact"; target: string; key: string; about?: string; removed: boolean }
  | { kind: "status"; characterId: string; status: Status; cause: string };

export type LogEntry = { t: number } & (
  | {
      type: "session_started";
      sessionId: string;
      seed: string;
      contentHash: string;
      config: SessionConfig;
      characters: { id: string; name: string; career: string; isBot: boolean; attrs: Record<Attribute, number> }[];
      relations: { a: string; b: string; type: RelationType }[];
    }
  | {
      type: "event_started";
      instanceId: string;
      eventId: string;
      version: number;
      title: string;
      bindings: Record<string, string[]>;
      parentInstanceId?: string;
      deadlineAt: number;
    }
  | { type: "decision"; instanceId: string; characterId: string; choiceId: string; label: string; source: "player" | "default" }
  | { type: "decision_rejected"; instanceId: string; characterId: string; choiceId: string; reason: string }
  | { type: "event_resolved"; instanceId: string; eventId: string; outcomeId: string; changes: Change[] }
  | { type: "followup_scheduled"; sourceInstanceId: string; eventId: string; dueAt: number }
  | { type: "followup_activated"; sourceInstanceId: string; eventId: string; instanceId: string }
  | { type: "followup_dropped"; sourceInstanceId: string; eventId: string; reason: string }
  | { type: "character_ended"; characterId: string; status: Status; cause: string }
  | { type: "session_completed"; reason: EndReason }
);

export type LogEntryOf<T extends LogEntry["type"]> = Extract<LogEntry, { type: T }>;

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Human-readable chronological log in the style of TESTING_SIMULATION §4.
 */
export function formatLog(log: readonly LogEntry[]): string {
  const names = new Map<string, string>();
  const name = (id: string) => names.get(id) ?? id;
  const lines: string[] = [];
  for (const e of log) {
    const at = clock(e.t);
    switch (e.type) {
      case "session_started":
        for (const c of e.characters) names.set(c.id, c.name);
        lines.push(`Session: ${e.sessionId} (seed "${e.seed}", content ${e.contentHash})`);
        lines.push(`${at} - Session initialized: ${e.characters.map((c) => `${c.name} (${c.career}${c.isBot ? ", bot" : ""})`).join(", ")}`);
        for (const r of e.relations) lines.push(`${at} - ${name(r.a)} and ${name(r.b)} start as ${r.type}`);
        break;
      case "event_started": {
        const who = Object.entries(e.bindings)
          .map(([role, ids]) => `${role}: ${ids.map(name).join(", ")}`)
          .join("; ");
        lines.push(`${at} - Event [${e.instanceId}]: ${e.title} (${who})${e.parentInstanceId ? ` — follow-up of ${e.parentInstanceId}` : ""}`);
        break;
      }
      case "decision":
        lines.push(`${at} - ${name(e.characterId)} ${e.source === "default" ? "did not decide in time →" : "selected:"} ${e.label}`);
        break;
      case "decision_rejected":
        lines.push(`${at} - Rejected decision from ${name(e.characterId)} (${e.choiceId}): ${e.reason}`);
        break;
      case "event_resolved": {
        lines.push(`${at} - Event [${e.instanceId}] resolved: ${e.outcomeId}`);
        for (const c of e.changes) {
          if (c.kind === "attr") lines.push(`        ${name(c.characterId)} ${c.attribute} ${c.delta > 0 ? "+" : ""}${c.delta} → ${c.value}`);
          else if (c.kind === "relation") lines.push(`        relation ${name(c.from)} → ${name(c.to)}: ${c.type}, affinity ${c.affinity}, trust ${c.trust}`);
          else if (c.kind === "fact") lines.push(`        fact ${c.removed ? "removed" : "set"}: ${name(c.target)} ${c.key}${c.about ? ` (${name(c.about)})` : ""}`);
          else lines.push(`        ${name(c.characterId)} → ${c.status}: ${c.cause}`);
        }
        break;
      }
      case "followup_scheduled":
        lines.push(`${at} - Follow-up scheduled: ${e.eventId} at ${clock(e.dueAt)} (from ${e.sourceInstanceId})`);
        break;
      case "followup_activated":
        lines.push(`${at} - Follow-up event activated: ${e.eventId} [${e.instanceId}]`);
        break;
      case "followup_dropped":
        lines.push(`${at} - Follow-up dropped: ${e.eventId} (${e.reason})`);
        break;
      case "character_ended":
        lines.push(`${at} - ${name(e.characterId)}'s story ends: ${e.status} — ${e.cause}`);
        break;
      case "session_completed":
        lines.push(`${at} - Session completed (${e.reason})`);
        break;
    }
  }
  return lines.join("\n");
}
