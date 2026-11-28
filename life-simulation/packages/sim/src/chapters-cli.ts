/**
 * Sprint 5: bot lives in "Life in chapters".
 *   npm run sim:chapters -- [--lives 50] [--seed s5] [--show]
 * Plays `--lives` lives for every dream (random flaw and job), and reports what QA accepts 5a on:
 * how often each dream comes true (25–65 %), callbacks per life (≥ 2), no event twice in a life,
 * an estimated play time (6–10 min) and that a replay of the log gives the identical life.
 */
import { Rng } from "@lifesim/core";
import { loadChapters } from "@lifesim/content";
import { playBotLife, replayLife } from "@lifesim/engine";
import { estimateLifeSeconds } from "./chapters";

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? (args[i + 1] as string) : fallback;
};
const lives = Number(opt("lives", "50"));
const seed = opt("seed", "s5");
const show = args.includes("--show");

const content = loadChapters();
const rng = new Rng(`${seed}/setup`);
const rows: string[] = [];
let failures = 0;
const allCallbacks: number[] = [];
const allSeconds: number[] = [];
const titles = new Map<string, number>();
const eventsSeen = new Map<string, number>();
let repeats = 0;
let replayChecked = 0;

for (const dream of content.dreams) {
  let done = 0;
  for (let i = 0; i < lives; i++) {
    const setup = { name: "Bot", dream: dream.id, flaw: rng.pick(content.flaws).id, career: rng.pick(content.careers).id };
    const life = playBotLife(content, setup, `${seed}-${dream.id}-${i}`);
    const recap = life.view().step;
    if (recap.kind !== "done") throw new Error("not done");
    if (recap.recap.dream.done) done++;
    allCallbacks.push(recap.recap.callbacks);
    allSeconds.push(estimateLifeSeconds(content, life.log));
    titles.set(recap.recap.title.label, (titles.get(recap.recap.title.label) ?? 0) + 1);
    const used = life.state.usedEvents;
    if (new Set(used).size !== used.length) repeats++;
    for (const e of used) eventsSeen.set(e, (eventsSeen.get(e) ?? 0) + 1);
    if (i < 3) {
      const again = replayLife(content, life.log);
      if (JSON.stringify(again.state) !== JSON.stringify(life.state)) throw new Error(`replay differs for ${dream.id} #${i}`);
      replayChecked++;
    }
    if (show && i === 0) {
      console.log(`\n— ${dream.label} (${setup.flaw}, ${setup.career}): ${recap.recap.title.label}; ${recap.recap.years.join("")}`);
      for (const m of recap.recap.moments) console.log(`   ${m.age}: ${m.text}`);
    }
  }
  const pct = Math.round((done / lives) * 100);
  const ok = pct >= 25 && pct <= 65;
  if (!ok) failures++;
  rows.push(`| ${dream.icon} ${dream.label} | ${done}/${lives} | ${pct} % | ${ok ? "✓" : "✗ (25–65 %)"} |`);
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const withTwo = allCallbacks.filter((c) => c >= 2).length;
console.log(`\nLife in chapters — ${lives} bot lives per dream, seed "${seed}", content ${content.hash}\n`);
console.log("| Dream | Came true | % | 25–65 % |\n| --- | --- | --- | --- |");
console.log(rows.join("\n"));
console.log(`\nCallbacks per life: min ${Math.min(...allCallbacks)}, avg ${avg(allCallbacks).toFixed(1)}; lives with ≥ 2: ${withTwo}/${allCallbacks.length}`);
console.log(`Estimated play time: avg ${(avg(allSeconds) / 60).toFixed(1)} min (min ${(Math.min(...allSeconds) / 60).toFixed(1)}, max ${(Math.max(...allSeconds) / 60).toFixed(1)})`);
console.log(`Lives with an event twice: ${repeats}`);
console.log(`Replays identical: ${replayChecked}/${replayChecked}`);
const unseen = content.events.filter((e) => !eventsSeen.has(e.id)).map((e) => e.id);
console.log(`Events never played: ${unseen.length ? unseen.join(", ") : "none"}`);
console.log(`Titles: ${[...titles.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(", ")}`);
if (failures > 0 || withTwo < allCallbacks.length || repeats > 0) process.exitCode = 1;
