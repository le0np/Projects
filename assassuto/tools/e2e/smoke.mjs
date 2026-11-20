// Smoke test: boots the dev server, opens the game in headless Chromium, enters each region,
// walks forward and saves screenshots to tools/e2e/out/. Fails on console errors or if the player cannot move.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const out = new URL('./out/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

function findChromium() {
  const def = chromium.executablePath();
  if (existsSync(def)) return undefined;
  // Fall back to any Chromium already downloaded by another Playwright version.
  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(cache)) return undefined;
  for (const dir of readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
    for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const p = join(cache, dir, sub);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const base = 'http://localhost:5199/';
const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const state = () => page.evaluate(() => window.__fourfold.debugState());
let failed = false;
const check = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failed = true;
};

try {
  await page.goto(base);
  await page.waitForSelector('.title .el-card');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}title.png` });
  check((await state()).mode === 'title', 'title screen shows');

  for (const element of ['earth', 'fire', 'water', 'air']) {
    await page.goto(`${base}?element=${element}&play`);
    await page.waitForFunction(() => window.__fourfold?.debugState().mode === 'playing', null, { timeout: 30000 });
    await page.waitForTimeout(2500);
    const s0 = await state();
    check(s0.grounded === true, `${element}: player spawns grounded in ${s0.region}`);
    await page.screenshot({ path: `${out}${element}-spawn.png` });
    // Jump on the flat spawn clearing and sample until airborne.
    await page.keyboard.press('Space');
    let airborne = false;
    for (let i = 0; i < 12 && !airborne; i++) {
      await page.waitForTimeout(40);
      airborne = (await state()).grounded === false;
    }
    check(airborne, `${element}: jump leaves the ground`);
    // Headless software rendering runs far below 60 fps, so poll instead of assuming real-time.
    let landed = false;
    for (let i = 0; i < 40 && !landed; i++) {
      await page.waitForTimeout(200);
      landed = (await state()).grounded === true;
    }
    check(landed, `${element}: player lands again`);
    await page.keyboard.down('KeyW');
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${out}${element}-sprint.png` });
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.press('Space');
    await page.waitForTimeout(120);
    await page.screenshot({ path: `${out}${element}-jump.png` });
    await page.waitForTimeout(900);
    await page.keyboard.up('KeyW');
    const s1 = await state();
    const moved = Math.hypot(s1.position.x - s0.position.x, s1.position.z - s0.position.z);
    check(moved > 3, `${element}: player moved ${moved.toFixed(1)} m`);
    check(s1.stamina < 100, `${element}: sprint and jump use stamina (${s1.stamina.toFixed(0)})`);
    console.log(`      fps (headless software GL): ${s1.fps}`);
  }
  check(errors.length === 0, `no console errors${errors.length ? ':\n  ' + errors.join('\n  ') : ''}`);
} catch (e) {
  console.error(e);
  failed = true;
} finally {
  await browser.close();
  await server.close();
}
console.log(`Screenshots in ${out}`);
process.exit(failed ? 1 : 0);
