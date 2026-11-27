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

// Refuse to run against a server that is already listening (it would be old code).
try {
  await fetch(`${BASE}/api/health`);
  console.error(`✗ port ${PORT} is already in use — stop the old server first`);
  process.exit(1);
} catch {
  // nothing listening: good
}

const server = spawn("npx", ["tsx", "packages/server/src/main.ts"], {
  detached: true, // own process group, so we can stop npx, tsx and node together
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
  page.on("console", (m) => m.type() === "error" && errors.push(`${m.text()} @ ${JSON.stringify(m.location())}`));
  page.on("requestfailed", (r) => errors.push(`request failed: ${r.url()} ${r.failure()?.errorText}`));
  page.on("response", (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  page.on("pageerror", (e) => errors.push(String(e)));
  const user = `e2e_${label}_${Date.now() % 100000}`;

  await page.goto(BASE);
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Username").fill(user);
  await page.getByLabel("Email").fill(`${user}@example.com`);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).last().click();

  await page.getByRole("radio", { name: /Doctor/ }).click();
  // B4: the character has its own name, not the username.
  const characterName = label === "desktop" ? "Mila" : "Oskar";
  await page.getByLabel("Your character's name").fill(characterName);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}-lobby.png`, fullPage: true });
  await page.getByRole("button", { name: /Find a life as Doctor/ }).click();

  // T5b R3: the header is complete from the first second (attributes, season), before any event.
  await page.locator(".game-header").waitFor({ timeout: 15_000 });
  const header = await page.evaluate(() => ({
    attrs: document.querySelectorAll(".game-header .attrs li").length,
    season: document.querySelector(".game-header .chip")?.textContent ?? "",
    offer: !!document.querySelector("button.choice"),
  }));
  if (!header.offer && (header.attrs !== 5 || !/year/.test(header.season))) throw new Error(`[${label}] empty header at the start: ${JSON.stringify(header)}`);

  // T8: plan a scheme (the odds show up, then the preparation with its boosts).
  await page.locator(".schemes .odds").waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Start planning" }).click();
  await page.locator(".schemes .scheme").first().waitFor({ timeout: 5_000 });
  await page.getByRole("button", { name: "Cover your tracks" }).click();
  await page.getByText("You covered your tracks.").waitFor({ timeout: 5_000 });

  // T9: click someone on the map → a card about them (positions come from the canvas' data-people).
  let personCard = "";
  for (let tries = 0; tries < 20 && !personCard; tries++) {
    if (await page.locator("button.choice").first().isVisible().catch(() => false)) await page.locator("button.choice").first().click().catch(() => {});
    const box = await page.locator("canvas.town").boundingBox();
    const people = JSON.parse((await page.locator("canvas.town").getAttribute("data-people")) ?? "{}");
    const other = Object.keys(people).find((id) => id !== "c1");
    if (box && other && !(await page.locator("button.choice").first().isVisible().catch(() => false))) {
      const [x, y] = people[other];
      await page.mouse.click(box.x + x, box.y + y);
      if (await page.locator(".person").isVisible().catch(() => false)) personCard = await page.locator(".person").innerText();
    }
    await page.waitForTimeout(200);
  }
  if (!/·/.test(personCard)) throw new Error(`[${label}] clicking someone on the map showed no card`);
  await page.getByRole("button", { name: "Close" }).click();

  // Play: answer every offer with the first choice until the recap appears.
  let decisions = 0;
  let checkedCards = 0;
  let shotTaken = false;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await page.getByText("Life Recap").isVisible().catch(() => false)) break;
    const choice = page.locator("button.choice").first();
    if (await choice.isVisible().catch(() => false)) {
      // B1: every choice is on screen and the card needs no scrolling to reach one.
      const fit = await page.evaluate(() => {
        const vh = window.innerHeight;
        const choices = [...document.querySelectorAll("button.choice")].map((b) => b.getBoundingClientRect());
        const overlay = document.querySelector(".overlay");
        const priv = document.querySelector(".card.event .private");
        const pr = priv?.getBoundingClientRect();
        return {
          // T6b M2: the public text is whole too (no scrolling inside the card).
          storyCut: (() => {
            const st = document.querySelector(".event-story");
            return st ? Math.max(0, st.scrollHeight - st.clientHeight - 1) : 0;
          })(),
          // T4b N1: what only you know is always whole.
          privateCut: priv && pr ? Math.max(0, priv.scrollHeight - priv.clientHeight) + (pr.bottom > vh + 0.5 || pr.top < -0.5 ? 1 : 0) : 0,
          offscreen: choices.filter((r) => r.top < -0.5 || r.bottom > vh + 0.5).length,
          overlayScroll: overlay ? overlay.scrollHeight - overlay.clientHeight : 0,
          title: document.querySelector("#event-title")?.textContent ?? "",
          me: document.querySelector(".game-header .who strong")?.textContent ?? "",
        };
      });
      if (fit.storyCut > 0) throw new Error(`[${label}] "${fit.title}": the public text is cut off by ${fit.storyCut}px`);
      if (fit.privateCut > 0) throw new Error(`[${label}] "${fit.title}": the private text is cut off`);
      if (fit.offscreen > 0 || fit.overlayScroll > 1) throw new Error(`[${label}] "${fit.title}": ${fit.offscreen} choice(s) off screen, card scrolls by ${fit.overlayScroll}px`);
      if (fit.me !== characterName) throw new Error(`[${label}] character is called "${fit.me}", expected "${characterName}"`);
      checkedCards++;
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
  if (checkedCards === 0) throw new Error(`[${label}] no event card was checked for fit`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}-recap.png`, fullPage: true });

  // T11: the life's title, the emoji years and "Copy my life" (the clipboard, or the text to copy by hand).
  const title = await page.locator(".life-title-label").innerText();
  const years = await page.locator(".years").innerText();
  if (!/^“.+”$/.test(title.trim()) || years.trim().length === 0) throw new Error(`[${label}] no life title or years in the recap: ${title} ${years}`);
  await page.getByRole("button", { name: "Copy my life" }).click();
  await page.locator(".copy-life .muted, .copy-life .share-text").first().waitFor({ timeout: 3000 });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) throw new Error(`[${label}] horizontal overflow of ${overflow}px`);

  await page.waitForTimeout(500); // results are persisted right after the end
  await page.getByRole("button", { name: "Show the full session log" }).click();
  await page.locator("pre.log").waitFor();
  const log = await page.locator("pre.log").innerText();
  if (!log.includes("Session completed")) throw new Error(`[${label}] session log incomplete`);

  await page.getByRole("button", { name: "Back to the lobby" }).click();
  await page.getByText("Previous lives").waitFor({ timeout: 5000 });
  // T11: and it is in the title collection.
  await page.getByText("Your titles").waitFor({ timeout: 5000 });
  if (!(await page.locator(".title-collection").innerText()).includes(title.trim())) throw new Error(`[${label}] ${title} is not in the title collection`);
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
  try {
    process.kill(-server.pid, "SIGTERM"); // the whole group: npx → tsx → node
  } catch {
    server.kill();
  }
}
process.exit(exitCode);
