/**
 * Sprint 5 (T24): a whole "Life in chapters" in a real browser, on desktop and on a phone:
 * play as guest → create a character (name, dream, flaw, job) → intro → five chapters (focus card,
 * event, roll, "What changed") → the finale with its reasons → the recap (title, emoji years,
 * Copy my life, full log) → back in the lobby, the life is in the history. No horizontal scroll.
 *
 *   npm run web:build && node packages/web/e2e/life.mjs      (part of `npm run e2e`)
 *   SHOTS=dir node packages/web/e2e/life.mjs                   also saves screenshots of every step
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = createRequire("/opt/node-tools/")("playwright");
}
const root = fileURLToPath(new URL("../../..", import.meta.url));
const PORT = 3395;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
try {
  await fetch(`${BASE}/api/health`);
  console.error(`✗ port ${PORT} is already in use — stop the old server first`);
  process.exit(1);
} catch {
  // nothing listening: good
}
const server = spawn("npx", ["tsx", "packages/server/src/main.ts"], {
  detached: true,
  cwd: root,
  env: { ...process.env, LEGACY_TOWN: "", PORT: String(PORT), HOST: "127.0.0.1", PGLITE_DIR: "", DATABASE_URL: "" },
  stdio: "ignore",
});

async function noSideScroll(page, label) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 1) throw new Error(`[${label}] horizontal scroll of ${over}px`);
}

async function playLife(page, label, { dream, flaw, job }) {
  let shot = 0;
  const snap = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${label}-${String(++shot).padStart(2, "0")}-${name}.png`, fullPage: true });
  await page.goto(BASE);
  await page.getByLabel("Your character's name").fill("Maja");
  await page.getByRole("button", { name: "Play as guest" }).last().click();
  await page.getByRole("heading", { name: "Live a whole life, from 18 to 33" }).waitFor({ timeout: 15_000 });
  await page.getByRole("group", { name: "Your dream" }).getByRole("button", { name: dream }).click();
  await page.getByRole("group", { name: "Your flaw" }).getByRole("button", { name: flaw }).click();
  await page.getByRole("group", { name: "Your job" }).getByRole("button", { name: job }).click();
  await snap("create");
  await noSideScroll(page, `${label} create`);
  await page.getByRole("button", { name: "Start your life" }).click();
  await page.getByRole("heading", { name: "These three will be there the whole way." }).waitFor({ timeout: 10_000 });
  await snap("intro");
  await page.getByRole("button", { name: "Begin" }).click();

  const seen = { focus: 0, events: 0, rolls: 0, changes: 0, recall: 0, finale: false };
  const titles = [];
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(120);
    if (await page.getByRole("button", { name: "Copy my life" }).isVisible().catch(() => false)) break;
    await noSideScroll(page, `${label} step ${i}`);
    if (await page.getByText("What is this part of your life about?").isVisible().catch(() => false)) {
      seen.focus++;
      if (seen.focus === 1) await snap("focus");
      await page.locator(".lf-pick").first().click();
      continue;
    }
    const choices = page.locator(".lf-choice");
    if ((await choices.count()) > 0 && (await choices.first().isEnabled())) {
      seen.events++;
      const title = await page.locator(".lf-card h2").last().innerText();
      titles.push(title);
      if (await page.locator(".lf-recall").isVisible().catch(() => false)) seen.recall++;
      if (await page.getByText("Your whole life comes down to this").isVisible().catch(() => false)) {
        seen.finale = true;
        await snap("finale");
      } else if (seen.events === 1) await snap("event");
      await choices.first().click();
      continue;
    }
    if (await page.locator(".lf-roll").isVisible().catch(() => false)) {
      seen.rolls++;
      if (seen.rolls === 1) await snap("roll");
      await page.getByRole("button", { name: "Skip" }).click();
      continue;
    }
    const next = page.locator(".lf-card .lf-btn").filter({ hasText: /^(Go to age \d+|Continue|See your life)$/ });
    if (await next.isVisible().catch(() => false)) {
      if (await page.getByText("What changed").isVisible().catch(() => false)) seen.changes++;
      if (seen.changes === 1) await snap("outcome");
      await next.click();
    }
  }
  if (!(await page.getByRole("button", { name: "Copy my life" }).isVisible())) throw new Error(`[${label}] no recap (titles: ${titles.join(" | ")})`);
  await snap("recap");
  await noSideScroll(page, `${label} recap`);
  if (seen.focus !== 5) throw new Error(`[${label}] ${seen.focus} focus choices, expected 5`);
  if (!seen.finale) throw new Error(`[${label}] no finale with reasons`);
  if (new Set(titles).size !== titles.length) throw new Error(`[${label}] an event came twice: ${titles.join(" | ")}`);
  const title = await page.locator(".lf-title-big").innerText();
  const years = await page.locator(".lf-emoji-line").innerText();
  await page.getByRole("button", { name: "Show the full log" }).click();
  await page.getByRole("heading", { name: "Life log" }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Live another life" }).click();
  await page.getByRole("heading", { name: "Previous lives" }).waitFor({ timeout: 10_000 });
  await page.locator(".lives li", { hasText: title }).first().waitFor({ timeout: 10_000 });
  await page.getByRole("heading", { name: /Your titles/ }).waitFor();
  return { title, years, ...seen, events: seen.events };
}

let exitCode = 0;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  const browser = await playwright.chromium.launch();
  const errors = [];
  const runs = [
    { label: "desktop", context: { viewport: { width: 1280, height: 800 } }, pick: { dream: "Become mayor", flaw: "Hot-headed", job: "Teacher" } },
    { label: "mobile (iPhone 13)", context: playwright.devices["iPhone 13"], pick: { dream: "Start a family", flaw: "Can't say no", job: "Doctor" } },
  ];
  for (const run of runs) {
    const page = await (await browser.newContext(run.context)).newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("dialog", (d) => void d.accept());
    const r = await playLife(page, run.label.split(" ")[0], run.pick);
    console.log(`✓ ${run.label}: whole life in chapters — ${r.focus} focus choices, ${r.events} events (${r.rolls} rolls, ${r.recall} callbacks on cards), finale with reasons, recap “${r.title}” ${r.years}, log and lobby history OK, no horizontal scroll`);
  }
  if (errors.length) throw new Error(`console errors:\n${errors.join("\n")}`);
  await browser.close();
} catch (err) {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  exitCode = 1;
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill();
  }
}
process.exit(exitCode);
