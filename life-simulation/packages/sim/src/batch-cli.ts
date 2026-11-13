/**
 * Batch simulation: run many bot-only sessions and write a balance report.
 *
 *   npm run sim:batch -- [--sessions 200] [--players 4-8] [--seed batch] [--duration 480]
 *                        [--out sim-output] [--logs] [--replay-check 5]
 */
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadContent } from "@lifesim/content";
import { runBatch } from "./batch";
import { replaySession } from "./replay";
import { aggregate, formatReport } from "./stats";

const { values } = parseArgs({
  options: {
    sessions: { type: "string", default: "200" },
    players: { type: "string", default: "4-8" },
    seed: { type: "string", default: "batch" },
    duration: { type: "string" },
    out: { type: "string", default: "sim-output" },
    logs: { type: "boolean", default: false },
    "replay-check": { type: "string", default: "3" },
  },
});

const [lo, hi] = values.players.split("-").map(Number) as [number, number?];
const content = loadContent();
mkdirSync(values.out, { recursive: true });
const logFile = join(values.out, `${values.seed}.sessions.jsonl`);
if (values.logs) writeFileSync(logFile, "");

const t0 = performance.now();
const runs = runBatch({
  content,
  seed: values.seed,
  sessions: Number(values.sessions),
  players: [lo, hi ?? lo],
  config: values.duration ? { durationSeconds: Number(values.duration) } : {},
  onSession: (run) => {
    if (values.logs) appendFileSync(logFile, JSON.stringify(run.result) + "\n");
  },
});
const elapsed = performance.now() - t0;

const stats = aggregate(runs, content);
const report = formatReport(stats, `Simulation report — ${runs.length} sessions, seed "${values.seed}", content ${content.hash}`);
const reportFile = join(values.out, `${values.seed}.report.md`);
writeFileSync(reportFile, report);

let replayOk = 0;
const checks = Math.min(Number(values["replay-check"]), runs.length);
for (let i = 0; i < checks; i++) if (replaySession(content, runs[i]!.result.log).identical) replayOk++;

console.log(report);
console.log(`Ran ${runs.length} sessions in ${(elapsed / 1000).toFixed(2)} s. Replay check: ${replayOk}/${checks} identical.`);
console.log(`Report: ${reportFile}${values.logs ? `\nLogs: ${logFile}` : ""}`);
if (replayOk !== checks) process.exit(1);
