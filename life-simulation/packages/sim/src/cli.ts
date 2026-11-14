/**
 * Developer simulation mode: run one bot-only session and print the log and Life Recaps.
 *
 *   npm run sim -- [--players 6] [--seed demo] [--careers doctor,lawyer] [--archetypes altruist,manipulator]
 *                  [--duration 480] [--explain] [--json out.json] [--quiet]
 */
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { ARCHETYPES, type Archetype } from "@lifesim/bots";
import { loadContent } from "@lifesim/content";
import { formatLog, formatRecap } from "@lifesim/engine";
import { runBotSession } from "./setup";

const { values } = parseArgs({
  options: {
    players: { type: "string", default: "6" },
    seed: { type: "string", default: "demo" },
    careers: { type: "string" },
    archetypes: { type: "string" },
    duration: { type: "string" },
    explain: { type: "boolean", default: false },
    json: { type: "string" },
    quiet: { type: "boolean", default: false },
  },
});

const list = (s: string | undefined) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined);
const archetypes = list(values.archetypes);
for (const a of archetypes ?? []) {
  if (!(ARCHETYPES as readonly string[]).includes(a)) {
    console.error(`Unknown archetype "${a}". Options: ${ARCHETYPES.join(", ")}`);
    process.exit(1);
  }
}

const content = loadContent();
const { result, bots } = runBotSession({
  content,
  seed: values.seed,
  players: Number(values.players),
  careers: list(values.careers),
  archetypes: archetypes as Archetype[] | undefined,
  config: values.duration ? { durationSeconds: Number(values.duration) } : {},
});

const names = new Map(result.recaps.map((r) => [r.characterId, r.name]));
if (!values.quiet) {
  console.log(formatLog(result.log));
  console.log("\nBots:");
  for (const b of bots) {
    const p = b.controller.profile;
    console.log(
      `  ${names.get(b.characterId)} — ${b.career}, ${p.archetype}; motives: ${p.motives.map((m) => `${m.type}${m.targetId ? `→${names.get(m.targetId)}` : ""}`).join(", ") || "none"}`,
    );
  }
  if (values.explain) {
    console.log("\nDecision traces:");
    for (const b of bots) {
      for (const tr of b.controller.traces) {
        const opts = tr.scores
          .map((s) => `${s.choiceId}=${s.utility.toFixed(2)} (${Math.round(s.probability * 100)}%)`)
          .join(", ");
        console.log(`  [${tr.instanceId}] ${names.get(b.characterId)}: ${opts} → ${tr.chosen}`);
      }
    }
  }
  console.log("\nLife Recaps:\n");
  console.log(result.recaps.map(formatRecap).join("\n\n"));
}
const s = result.stats;
console.log(
  `\nSession ${result.sessionId}: ${result.endReason} after ${(result.durationMs / 1000).toFixed(0)}s, ` +
    `${s.eventsResolved} events, ${s.followUpsActivated}/${s.followUpsScheduled} follow-ups, ` +
    `${s.decisionsDefaulted} defaulted decisions, ${result.recaps.filter((r) => r.finalStatus === "dead").length} deaths`,
);
if (values.json) {
  writeFileSync(values.json, JSON.stringify({ ...result, bots: bots.map((b) => ({ characterId: b.characterId, career: b.career, profile: b.controller.profile })) }, null, 2));
  console.log(`Full result written to ${values.json}`);
}
