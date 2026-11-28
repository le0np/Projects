/**
 * T8b S2: the victim's side of a scheme, made certain for testing (QA_FORCE_SCHEME_ON_HUMAN=1:
 * a bot schemes against the player right away; every scheme works and its culprit is caught).
 * The player must see the clue and the three "caught" choices, and get a free revenge.
 *
 *   npm run web:build && node packages/web/e2e/scheme-victim.mjs      (part of `npm run e2e`)
 */
import { spawn } from "node:child_process";
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
const PORT = 3398;
const BASE = `http://127.0.0.1:${PORT}`;
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
  env: { ...process.env, LEGACY_TOWN: "1", PORT: String(PORT), HOST: "127.0.0.1", PGLITE_DIR: "", DATABASE_URL: "", TIME_SCALE: "8", SESSION_DURATION_SECONDS: "300", SESSION_SIZE: "4", MAX_HUMANS: "1", FILL_AFTER_SECONDS: "1", QA_FORCE_SCHEME_ON_HUMAN: "1" },
  stdio: "ignore",
});

let exitCode = 0;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  const browser = await playwright.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const user = `victim_${Date.now() % 100000}`;
  await page.goto(BASE);
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Username").fill(user);
  await page.getByLabel("Email").fill(`${user}@example.com`);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).last().click();
  await page.getByRole("button", { name: /Find a life as/ }).click();

  // Answer every other event at once; wait for the flat tyres, with the clue.
  let clue = "";
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await page.locator(".card.event .clue-line").isVisible().catch(() => false)) {
      clue = await page.locator(".card.event .clue-line").innerText();
      break;
    }
    const choice = page.locator("button.choice").first();
    if (await choice.isVisible().catch(() => false)) await choice.click().catch(() => {});
    await page.waitForTimeout(150);
  }
  if (!clue) throw new Error("the victim never saw a clue");
  const labels = await page.locator("button.choice .choice-label").allInnerTexts();
  for (const want of [/^Confront \w+$/, /^Report \w+$/, /^Plan revenge on \w+$/]) {
    if (!labels.some((l) => want.test(l.trim()))) throw new Error(`missing choice ${want}: ${labels.join(" | ")}`);
  }
  // T8c V2: once you know who did it, there is nothing left to investigate.
  if (labels.some((l) => /doorbell camera/.test(l))) throw new Error("the camera choice is still offered after catching the culprit");
  await page.locator("button.choice", { hasText: "Plan revenge on" }).click();
  await page.locator(".schemes .revenge").waitFor({ timeout: 15_000 });
  const revenge = await page.locator(".schemes .revenge").innerText();
  if (!/revenge is free/.test(revenge)) throw new Error(`no free revenge: ${revenge}`);
  if (errors.length) throw new Error(`console errors:\n${errors.join("\n")}`);
  console.log(`✓ victim's side of a scheme: clue (“${clue.replace(/\s+/g, " ").slice(0, 70)}…”), three choices, free revenge`);
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
