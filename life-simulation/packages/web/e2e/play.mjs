/**
 * End-to-end browser test: real server (accelerated time, in-memory PGlite) + Chromium.
 * Plays a complete session on a desktop and a mobile viewport:
 * register → lobby → pick career → matchmaking with bots → play → Life Recap → session log.
 *
 *   npm run web:build && npm run e2e            (SCREENSHOTS=<dir> to save screenshots)
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
const { chromium, devices } = playwright;

const root = fileURLToPath(new URL("../../..", import.meta.url));
const PORT = 3399;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.SCREENSHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const server = spawn("npx", ["tsx", "packages/server/src/main.ts"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(PORT),
    HOST: "127.0.0.1",
    PGLITE_DIR: "",
    DATABASE_URL: "",
    TIME_SCALE: "8",
    SESSION_DURATION_SECONDS: "150",
    SESSION_SIZE: "4",
    MAX_HUMANS: "1",
    FILL_AFTER_SECONDS: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", (d) => (serverOutput += d));
server.stderr.on("data", (d) => (serverOutput += d));

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not start:\n${serverOutput}`);
}

async function playOnce(browser, label, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  const user = `e2e_${label}_${Date.now() % 100000}`;

  await page.goto(BASE);
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Username").fill(user);
  await page.getByLabel("Email").fill(`${user}@example.com`);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).last().click();

  await page.getByRole("radio", { name: /Doctor/ }).click();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}-lobby.png`, fullPage: true });
  await page.getByRole("button", { name: /Find a life as Doctor/ }).click();

  // Play: answer every offer with the first choice until the recap appears.
  let decisions = 0;
  let shotTaken = false;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await page.getByText("Life Recap").isVisible().catch(() => false)) break;
    const choice = page.locator("button.choice").first();
    if (await choice.isVisible().catch(() => false)) {
      if (SHOTS && !shotTaken) {
        await page.screenshot({ path: `${SHOTS}/${label}-event.png`, fullPage: true });
        shotTaken = true;
      }
      await choice.click().catch(() => {});
      decisions++;
    }
    await page.waitForTimeout(150);
  }
  if (!(await page.getByText("Life Recap").isVisible())) throw new Error(`[${label}] no Life Recap after 60 s`);
  if (decisions === 0) throw new Error(`[${label}] never got a decision to make`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}-recap.png`, fullPage: true });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) throw new Error(`[${label}] horizontal overflow of ${overflow}px`);

  await page.waitForTimeout(500); // results are persisted right after the end
  await page.getByRole("button", { name: "Show the full session log" }).click();
  await page.locator("pre.log").waitFor();
  const log = await page.locator("pre.log").innerText();
  if (!log.includes("Session completed")) throw new Error(`[${label}] session log incomplete`);

  await page.getByRole("button", { name: "Back to the lobby" }).click();
  await page.getByText("Previous lives").waitFor({ timeout: 5000 });
  if (errors.length) throw new Error(`[${label}] console errors:\n${errors.join("\n")}`);
  await context.close();
  return decisions;
}

let exitCode = 0;
try {
  await waitForServer();
  const browser = await chromium.launch();
  const desktop = await playOnce(browser, "desktop", { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  console.log(`✓ desktop: full session played (${desktop} decisions), recap, log and lobby history OK`);
  const mobile = await playOnce(browser, "mobile", { ...devices["iPhone 13"] });
  console.log(`✓ mobile (iPhone 13): full session played (${mobile} decisions), recap, log and lobby history OK, no horizontal scroll`);
  await browser.close();
} catch (err) {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  exitCode = 1;
} finally {
  server.kill();
}
process.exit(exitCode);
