/** Aggregated statistics over many simulated sessions (TESTING_SIMULATION §2). */
import type { ChoiceTag, OutcomeTag } from "@lifesim/core";
import type { ContentBundle } from "@lifesim/content";
import type { LogEntryOf } from "@lifesim/engine";
import type { BotSessionRun } from "./setup";

interface Counter {
  [key: string]: number;
}

const inc = (c: Counter, k: string, by = 1) => (c[k] = (c[k] ?? 0) + by);

export interface BatchStats {
  sessions: number;
  characters: number;
  endReasons: Counter;
  durationSeconds: { mean: number; min: number; max: number };
  eventsPerSession: { mean: number; min: number; max: number };
  eventsPerCharacter: number;
  /** Share of a character's lifetime spent inside events (pacing). */
  engagedShare: number;
  /** Mean seconds from session start to a character's last event ending. */
  lastActivitySeconds: number;
  deathRate: number;
  sessionsWithDeath: number;
  statusCounts: Counter;
  outcomeTags: Counter;
  /** eventId → occurrences. */
  eventCounts: Counter;
  /** eventId → choiceId → picks. */
  choiceCounts: Record<string, Counter>;
  /** eventId → outcomeId → occurrences. */
  outcomeCounts: Record<string, Counter>;
  neverSelected: string[];
  /** Share of a character's events that repeat a template they already had. */
  repetitionRate: number;
  followUps: { scheduled: number; activated: number; dropped: Counter };
  decisions: { submitted: number; defaulted: number; rejected: number };
  directorIdlePerSession: number;
  career: Record<string, { n: number; lifeScore: number; deaths: number; outcomes: Counter }>;
  archetype: Record<string, { n: number; lifeScore: number; deaths: number; tags: Counter; decisions: number }>;
}

export function aggregate(runs: readonly BotSessionRun[], content: ContentBundle): BatchStats {
  const s: BatchStats = {
    sessions: runs.length,
    characters: 0,
    endReasons: {},
    durationSeconds: { mean: 0, min: Infinity, max: 0 },
    eventsPerSession: { mean: 0, min: Infinity, max: 0 },
    eventsPerCharacter: 0,
    engagedShare: 0,
    lastActivitySeconds: 0,
    deathRate: 0,
    sessionsWithDeath: 0,
    statusCounts: {},
    outcomeTags: {},
    eventCounts: {},
    choiceCounts: {},
    outcomeCounts: {},
    neverSelected: [],
    repetitionRate: 0,
    followUps: { scheduled: 0, activated: 0, dropped: {} },
    decisions: { submitted: 0, defaulted: 0, rejected: 0 },
    directorIdlePerSession: 0,
    career: {},
    archetype: {},
  };
  let engagedSum = 0;
  let lastActivitySum = 0;
  let repeats = 0;
  let charEvents = 0;
  let deaths = 0;

  for (const { result, bots } of runs) {
    const archetypeOf = new Map(bots.map((b) => [b.characterId, b.controller.profile.archetype]));
    inc(s.endReasons, result.endReason ?? "unknown");
    const dur = result.durationMs / 1000;
    s.durationSeconds.mean += dur;
    s.durationSeconds.min = Math.min(s.durationSeconds.min, dur);
    s.durationSeconds.max = Math.max(s.durationSeconds.max, dur);
    const ev = result.stats.eventsResolved;
    s.eventsPerSession.mean += ev;
    s.eventsPerSession.min = Math.min(s.eventsPerSession.min, ev);
    s.eventsPerSession.max = Math.max(s.eventsPerSession.max, ev);
    s.followUps.scheduled += result.stats.followUpsScheduled;
    s.followUps.activated += result.stats.followUpsActivated;
    for (const [k, v] of Object.entries(result.stats.followUpsDropped)) inc(s.followUps.dropped, k, v);
    s.decisions.submitted += result.stats.decisionsSubmitted;
    s.decisions.defaulted += result.stats.decisionsDefaulted;
    s.decisions.rejected += result.stats.decisionsRejected;
    s.directorIdlePerSession += result.stats.directorIdle;

    const started = new Map<string, LogEntryOf<"event_started">>();
    const busyMs = new Map<string, number>();
    const lastEnd = new Map<string, number>();
    const seenByChar = new Map<string, Set<string>>();
    for (const e of result.log) {
      if (e.type === "event_started") {
        started.set(e.instanceId, e);
        inc(s.eventCounts, e.eventId);
        for (const id of Object.values(e.bindings).flat()) {
          const seen = seenByChar.get(id) ?? new Set();
          if (seen.has(e.eventId)) repeats++;
          seen.add(e.eventId);
          seenByChar.set(id, seen);
          charEvents++;
        }
      } else if (e.type === "event_resolved") {
        const st = started.get(e.instanceId)!;
        (s.outcomeCounts[e.eventId] ??= {}) && inc(s.outcomeCounts[e.eventId]!, e.outcomeId);
        for (const id of Object.values(st.bindings).flat()) {
          busyMs.set(id, (busyMs.get(id) ?? 0) + (e.t - st.t));
          lastEnd.set(id, e.t);
        }
      } else if (e.type === "decision") {
        const st = started.get(e.instanceId)!;
        inc((s.choiceCounts[st.eventId] ??= {}), e.choiceId);
        const role = Object.entries(st.bindings).find(([, ids]) => ids.includes(e.characterId))?.[0];
        const tags: ChoiceTag[] = content.events.get(st.eventId)?.choices[role ?? ""]?.find((c) => c.id === e.choiceId)?.tags ?? [];
        const arch = archetypeOf.get(e.characterId);
        if (arch) {
          const a = (s.archetype[arch] ??= { n: 0, lifeScore: 0, deaths: 0, tags: {}, decisions: 0 });
          a.decisions++;
          for (const t of tags) inc(a.tags, t);
        }
      }
    }

    let sessionDeaths = 0;
    for (const r of result.recaps) {
      s.characters++;
      inc(s.statusCounts, r.finalStatus);
      for (const t of r.outcomes) inc(s.outcomeTags, t);
      if (r.finalStatus === "dead") sessionDeaths++;
      engagedSum += (busyMs.get(r.characterId) ?? 0) / Math.max(1, r.lifeDurationMs);
      lastActivitySum += (lastEnd.get(r.characterId) ?? 0) / 1000;
      const c = (s.career[r.career] ??= { n: 0, lifeScore: 0, deaths: 0, outcomes: {} });
      c.n++;
      c.lifeScore += r.lifeScore;
      if (r.finalStatus === "dead") c.deaths++;
      for (const t of r.outcomes) inc(c.outcomes, t);
      const arch = archetypeOf.get(r.characterId);
      if (arch) {
        const a = (s.archetype[arch] ??= { n: 0, lifeScore: 0, deaths: 0, tags: {}, decisions: 0 });
        a.n++;
        a.lifeScore += r.lifeScore;
        if (r.finalStatus === "dead") a.deaths++;
      }
    }
    deaths += sessionDeaths;
    if (sessionDeaths > 0) s.sessionsWithDeath++;
  }

  const n = Math.max(1, runs.length);
  s.durationSeconds.mean /= n;
  s.eventsPerSession.mean /= n;
  s.directorIdlePerSession /= n;
  s.eventsPerCharacter = charEvents / Math.max(1, s.characters);
  s.engagedShare = engagedSum / Math.max(1, s.characters);
  s.lastActivitySeconds = lastActivitySum / Math.max(1, s.characters);
  s.deathRate = deaths / Math.max(1, s.characters);
  s.repetitionRate = repeats / Math.max(1, charEvents);
  for (const c of Object.values(s.career)) c.lifeScore /= c.n;
  for (const a of Object.values(s.archetype)) a.lifeScore /= Math.max(1, a.n);
  s.neverSelected = [...content.events.keys()].filter((id) => !s.eventCounts[id]).sort();
  return s;
}

const pct = (x: number) => `${(x * 100).toFixed(1)} %`;
const top = (c: Counter, k = 5) =>
  Object.entries(c)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, k);

/** Markdown balance report. */
export function formatReport(s: BatchStats, title = "Simulation report"): string {
  const lines: string[] = [`# ${title}`, ""];
  lines.push(
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Sessions / characters | ${s.sessions} / ${s.characters} |`,
    `| End reasons | ${top(s.endReasons).map(([k, v]) => `${k} ${v}`).join(", ")} |`,
    `| Session duration (s) | mean ${s.durationSeconds.mean.toFixed(0)}, min ${s.durationSeconds.min.toFixed(0)}, max ${s.durationSeconds.max.toFixed(0)} |`,
    `| Events per session | mean ${s.eventsPerSession.mean.toFixed(1)}, min ${s.eventsPerSession.min}, max ${s.eventsPerSession.max} |`,
    `| Events per character | ${s.eventsPerCharacter.toFixed(1)} |`,
    `| Time spent in events | ${pct(s.engagedShare)} of lifetime |`,
    `| Last activity (mean) | ${s.lastActivitySeconds.toFixed(0)} s after start |`,
    `| Death rate | ${pct(s.deathRate)} of characters, ${pct(s.sessionsWithDeath / Math.max(1, s.sessions))} of sessions |`,
    `| Event repetition | ${pct(s.repetitionRate)} of a character's events repeat a template |`,
    `| Follow-ups | ${s.followUps.activated}/${s.followUps.scheduled} activated; dropped: ${top(s.followUps.dropped).map(([k, v]) => `${k} ${v}`).join(", ") || "none"} |`,
    `| Decisions | ${s.decisions.submitted} submitted, ${s.decisions.defaulted} defaulted, ${s.decisions.rejected} rejected |`,
    `| Director found nothing | ${s.directorIdlePerSession.toFixed(0)} times per session |`,
    "",
  );
  lines.push("## Final status and outcomes", "");
  lines.push(`Status: ${top(s.statusCounts, 10).map(([k, v]) => `${k} ${pct(v / s.characters)}`).join(", ")}`, "");
  lines.push(`Outcomes: ${top(s.outcomeTags, 20).map(([k, v]) => `${k} ${pct(v / s.characters)}`).join(", ")}`, "");

  lines.push("## Careers", "", "| Career | n | Life score | Death rate | Top outcomes |", "| --- | --- | --- | --- | --- |");
  for (const [id, c] of Object.entries(s.career).sort((a, b) => b[1].lifeScore - a[1].lifeScore)) {
    const outs = top(c.outcomes, 4).filter(([k]) => k !== "survived").map(([k, v]) => `${k} ${pct(v / c.n)}`).join(", ");
    lines.push(`| ${id} | ${c.n} | ${c.lifeScore.toFixed(1)} | ${pct(c.deaths / c.n)} | ${outs} |`);
  }
  lines.push("", "## Bot personalities", "", "| Archetype | n | Life score | Death rate | Most frequent attitudes |", "| --- | --- | --- | --- | --- |");
  for (const [id, a] of Object.entries(s.archetype).sort((x, y) => x[0].localeCompare(y[0]))) {
    const tags = top(a.tags, 4).map(([k, v]) => `${k} ${pct(v / Math.max(1, a.decisions))}`).join(", ");
    lines.push(`| ${id} | ${a.n} | ${a.lifeScore.toFixed(1)} | ${pct(a.deaths / Math.max(1, a.n))} | ${tags} |`);
  }
  lines.push("", "## Events", "", "| Event | Occurrences | Choices | Outcomes |", "| --- | --- | --- | --- |");
  for (const [id, count] of top(s.eventCounts, 1000)) {
    const choices = top(s.choiceCounts[id] ?? {}, 6).map(([k, v]) => `${k} ${v}`).join(", ");
    const outcomes = top(s.outcomeCounts[id] ?? {}, 6).map(([k, v]) => `${k} ${v}`).join(", ");
    lines.push(`| ${id} | ${count} | ${choices} | ${outcomes} |`);
  }
  if (s.neverSelected.length) lines.push("", `**Never selected:** ${s.neverSelected.join(", ")}`);
  return lines.join("\n") + "\n";
}

export type { OutcomeTag };
