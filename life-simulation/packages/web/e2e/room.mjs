/**
 * T14: a private room with two real browsers — the host creates a room, a friend opens the link,
 * both see each other in the waiting room, the host starts, and both play the same life (with bots)
 * to the Life Recap.
 *
 *   npm run web:build && node packages/web/e2e/room.mjs      (part of `npm run e2e`)
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
const PORT = 3396;
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
  env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", PGLITE_DIR: "", DATABASE_URL: "", TIME_SCALE: "8", SESSION_DURATION_SECONDS: "150", SESSION_SIZE: "4", MAX_HUMANS: "1", FILL_AFTER_SECONDS: "60" },
  stdio: "ignore",
});

async function signUp(page, user) {
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Username").fill(user);
  await page.getByLabel("Email").fill(`${user}@example.com`);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).last().click();
}

async function playToRecap(page, label) {
  const deadline = Date.now() + 90_000;
  let decisions = 0;
  while (Date.now() < deadline) {
    if (await page.getByText("Life Recap").isVisible().catch(() => false)) return decisions;
    const choice = page.locator("button.choice").first();
    if (await choice.isVisible().catch(() => false)) {
      await choice.click().catch(() => {});
      decisions++;
    }
    await page.waitForTimeout(150);
  }
  throw new Error(`[${label}] no Life Recap`);
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
  const open = async () => {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    return page;
  };
  const stamp = Date.now() % 100000;

  // The host creates a room.
  const host = await open();
  await host.goto(BASE);
  await signUp(host, `host_${stamp}`);
  await host.getByLabel("Your character's name").fill("Mila");
  await host.getByRole("button", { name: "Create a room for friends" }).click();
  const link = await host.getByLabel("Room link").inputValue();
  if (!/\/r\/[A-Z0-9]{4}$/.test(link)) throw new Error(`no room link: ${link}`);
  if (!host.url().endsWith(link.slice(link.indexOf("/r/")))) throw new Error(`the address bar does not show the room: ${host.url()}`);

  // A friend opens the link (and signs up on the way).
  const friend = await open();
  await friend.goto(link.replace("http://localhost", BASE));
  await signUp(friend, `friend_${stamp}`);
  await friend.locator(".room-members").waitFor({ timeout: 10_000 });
  await host.locator(".room-members li", { hasText: "Guest" }).waitFor({ timeout: 10_000 });
  const seen = await host.locator(".room-members li").allInnerTexts();
  if (seen.length !== 2) throw new Error(`the host sees ${seen.length} people: ${seen.join(" | ")}`);
  if (await friend.getByRole("button", { name: "Start the life" }).isVisible()) throw new Error("the friend can start the life");

  // The host starts; both play the same life.
  await host.getByRole("button", { name: "Start the life" }).click();
  // Same life: the host has the friend among the people in town (and the friend has the host).
  await host.locator(".people li", { hasText: "Guest" }).waitFor({ timeout: 15_000 });
  await friend.locator(".people li", { hasText: "Mila" }).waitFor({ timeout: 15_000 });
  const [d1, d2] = await Promise.all([playToRecap(host, "host"), playToRecap(friend, "friend")]);
  if (errors.length) throw new Error(`console errors:\n${errors.join("\n")}`);
  console.log(`✓ private room: host + friend via the link played one life together (${d1} + ${d2} decisions), with bots`);
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
