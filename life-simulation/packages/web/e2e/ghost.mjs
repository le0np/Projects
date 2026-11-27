/**
 * T12: the ghost, made certain for testing (QA_GHOST=1: the player's story ends after 20 session
 * seconds). The player must get the ghost card, leave a will, and find it read out in the recap.
 *
 *   npm run web:build && node packages/web/e2e/ghost.mjs      (part of `npm run e2e`)
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
const PORT = 3397;
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
  env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", PGLITE_DIR: "", DATABASE_URL: "", TIME_SCALE: "8", SESSION_DURATION_SECONDS: "150", SESSION_SIZE: "4", MAX_HUMANS: "1", FILL_AFTER_SECONDS: "1", QA_GHOST: "1" },
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
  const user = `ghost_${Date.now() % 100000}`;
  await page.goto(BASE);
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Username").fill(user);
  await page.getByLabel("Email").fill(`${user}@example.com`);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).last().click();
  await page.getByRole("button", { name: /Find a life as/ }).click();

  // Answer events until the story ends; then the ghost card appears.
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline && !(await page.locator(".ghost-card").isVisible().catch(() => false))) {
    const choice = page.locator("button.choice").first();
    if (await choice.isVisible().catch(() => false)) await choice.click().catch(() => {});
    await page.waitForTimeout(150);
  }
  if (!(await page.locator(".ghost-card").isVisible())) throw new Error("no ghost card after the story ended");
  if (process.env.SCREENSHOTS) {
    await page.locator(".ghost-card").screenshot({ path: `${process.env.SCREENSHOTS}/ghost-card.png` });
    await page.waitForTimeout(3000);
    await page.locator("canvas.town").screenshot({ path: `${process.env.SCREENSHOTS}/ghost-map.png` });
  }
  const will = await page.getByLabel("Your will").inputValue();
  await page.getByRole("button", { name: "Leave this will" }).click();
  await page.getByText("(read out at the end)").waitFor({ timeout: 5_000 });

  await page.getByText("Life Recap").waitFor({ timeout: 60_000 });
  if (process.env.SCREENSHOTS) await page.locator(".recap").screenshot({ path: `${process.env.SCREENSHOTS}/ghost-recap.png` });
  const town = await page.locator(".wills").innerText();
  if (!town.includes(will)) throw new Error(`the will is not read out in the recap: ${town}`);
  if (errors.length) throw new Error(`console errors:\n${errors.join("\n")}`);
  console.log(`✓ ghost: card after death, will left and read out in the recap (“${will}”)`);
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
