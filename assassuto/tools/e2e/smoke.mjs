// Smoke test: boots the dev server, plays through main menu -> character creator -> intro -> gameplay ->
// pause/save -> main menu -> continue, then checks movement in all four regions.
// Screenshots go to tools/e2e/out/. Fails on console errors or broken flows.
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
  for (const cache of [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), '.cache', 'ms-playwright')]) {
    if (!cache || !existsSync(cache)) continue;
    for (const dir of readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
        const p = join(cache, dir, sub);
        if (existsSync(p)) return p;
      }
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
const shot = (name) => page.screenshot({ path: `${out}${name}.png` });
const waitMode = (mode, timeout = 60000) => page.waitForFunction((m) => window.__fourfold?.debugState().mode === m, mode, { timeout });
let failed = false;
const check = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failed = true;
};
// Headless software rendering runs far below 60 fps, so poll instead of assuming real time.
async function poll(fn, tries = 40, ms = 200) {
  for (let i = 0; i < tries; i++) {
    if (await fn()) return true;
    await page.waitForTimeout(ms);
  }
  return false;
}

try {
  // ---- Main menu
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.main-menu .menu-item');
  await page.waitForTimeout(2000);
  await shot('01-menu');
  check(await page.locator('[data-menu=continue]').isDisabled(), 'menu: Continue is disabled without a save');
  await page.click('[data-menu=settings]');
  await page.waitForSelector('.modal:not([hidden]) h2');
  await shot('02-settings');
  await page.click('.modal:not([hidden]) .btn.primary');
  await page.click('[data-menu=credits]');
  check(await page.locator('.modal:not([hidden]) .credit').count() >= 3, 'menu: credits open');
  await page.click('.modal:not([hidden]) .btn.primary');

  // ---- Character creator
  await page.click('[data-menu=new]');
  await waitMode('creator');
  await poll(async () => (await state()).view !== null);
  await page.waitForTimeout(1500);
  await shot('03-creator-appearance');
  await page.click('.swatch[aria-label=Rose]');
  await page.locator('input[aria-label=Build]').fill('0.8');
  await page.waitForTimeout(1200);
  await shot('04-creator-hair-build');
  await page.click('.chip[data-value=masculine]');
  await page.waitForTimeout(1200);
  await shot('05-creator-masculine');
  await page.click('.chip[data-value=feminine]');
  await page.click('.swatch[aria-label=Honey]');
  await page.click('[data-next]');
  await page.click('[data-next]');
  check((await page.textContent('.form-error'))?.includes('at least 2'), 'creator: empty name is rejected');
  await page.fill('.creator-body input[type=text]', 'Aria');
  await page.click('[data-next]');
  await page.click('[data-element=water]');
  await page.waitForTimeout(1500);
  check((await state()).region === 'glacemere', 'creator: choosing Water previews Glacemere');
  await page.click('[data-next]');
  await page.fill('.creator-body input[type=text]', 'Dara');
  await page.click('.chip[data-value=Sister]');
  await page.click('.chip[data-value=playful]');
  await page.click('.chip[data-value=wolf]');
  await page.fill('.creator-body textarea', 'Laugh at the storm, then outrun it.');
  await page.waitForTimeout(1500);
  await shot('06-creator-echo');
  await page.click('[data-next]');
  await page.click('[data-next]');
  await page.waitForTimeout(800);
  await shot('07-creator-summary');
  check((await page.textContent('.creator-body'))?.includes('Dara'), 'creator: summary shows the Echo');
  await page.click('[data-next]');

  // ---- Intro
  await waitMode('intro');
  await page.waitForTimeout(6000);
  await shot('08-intro');
  check((await page.textContent('.intro-text'))?.length > 3, 'intro: subtitles show');
  await page.keyboard.press('Space');
  await waitMode('playing');
  await page.waitForTimeout(2000);
  const s0 = await state();
  check(s0.hasEcho && s0.saveName === 'Aria' && s0.region === 'glacemere', 'play: Aria starts in Glacemere with her Echo');
  await shot('09-play');

  // ---- Movement
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(3000);
  // Slow software rendering (about 10 fps here) runs game time behind real time: keep running a bit longer if needed.
  await poll(async () => { const s = await state(); return Math.hypot(s.position.x - s0.position.x, s.position.z - s0.position.z) > 4; }, 25, 200);
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(600);
  await shot('10-play-moved');
  const s1 = await state();
  const moved = Math.hypot(s1.position.x - s0.position.x, s1.position.z - s0.position.z);
  check(moved > 3, `play: player moved ${moved.toFixed(1)} m`);

  // ---- Pause, save, quit, continue
  await page.keyboard.press('Escape');
  await page.waitForSelector('.pause:not([hidden])');
  await shot('11-pause');
  await page.click('[data-action=save]');
  check(await poll(async () => (await page.locator('.toast').count()) > 0, 10, 100), 'pause: "Game saved" toast');
  const saved = await state();
  await page.click('[data-action=menu]');
  await waitMode('menu');
  check(!(await page.locator('[data-menu=continue]').isDisabled()), 'menu: Continue is enabled after saving');
  check((await page.textContent('[data-menu=continue] .menu-sub'))?.includes('Aria'), 'menu: Continue shows the character');
  await page.reload();
  await page.waitForSelector('.main-menu .menu-item');
  await page.click('[data-menu=continue]');
  await waitMode('playing');
  await page.waitForTimeout(1500);
  const s2 = await state();
  const drift = Math.hypot(s2.position.x - saved.position.x, s2.position.z - saved.position.z);
  check(drift < 0.5 && s2.region === 'glacemere', `continue: restored position after reload (drift ${drift.toFixed(2)} m)`);
  await shot('12-continued');

  // ---- Combat: walk into the raider camp, fight, then finish a broken enemy
  await page.goto(`${base}?element=earth&play`);
  await waitMode('playing');
  await page.evaluate(() => {
    const g = window.__fourfold;
    const c = g.region.camp.center;
    const p = g.player;
    const x = c.x + 6, z = c.z + 1;
    p.motor.teleport(x, g.region.terrain.heightAt(x, z), z);
    p.facing = Math.atan2(c.x - x, c.z - z);
    p.syncRender();
    g.rig.snapBehind(p.facing);
  });
  check(await poll(async () => (await state()).enemies.some((e) => e.brain !== 'idle'), 60, 250), 'combat: raiders notice the player');
  await page.keyboard.press('Tab');
  check(await poll(async () => (await state()).lock !== null, 20, 150), 'combat: Tab locks on to a raider');
  const hpBefore = (await state()).enemies.reduce((s, e) => s + e.hp, 0);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press(i % 3 === 2 ? 'KeyK' : 'KeyJ');
    await page.waitForTimeout(350);
  }
  await shot('13-combat');
  check(await poll(async () => (await state()).enemies.reduce((s, e) => s + e.hp, 0) < hpBefore, 40, 250), 'combat: attacks damage raiders');
  await page.evaluate(() => {
    const g = window.__fourfold;
    const e = g.director.enemies.find((x) => x.alive);
    const p = g.player;
    const x = p.motor.x + Math.sin(p.facing) * 2, z = p.motor.z + Math.cos(p.facing) * 2;
    e.motor.teleport(x, g.region.terrain.heightAt(x, z), z);
    e.syncRender();
    e.combatant.poise = 0;
    e.combatant.setState('vulnerable', 30);
    e.react('vulnerable');
  });
  check(await poll(async () => page.locator('.prompt:not([hidden])').count().then((n) => n > 0), 20, 200), 'combat: finisher prompt appears for a broken enemy');
  // Other enemies (archer arrows, the brute) can stagger the player; keep pressing F while the prompt shows.
  let finished = false;
  for (let i = 0; i < 8 && !finished; i++) {
    await page.keyboard.press('KeyF');
    finished = await poll(async () => (await state()).enemies.some((e) => e.state === 'dead'), 12, 250);
  }
  await shot('14-finisher');
  check(finished, 'combat: finisher kills the enemy');

  // ---- Combat expansion: weapons on 1/2/3, randomised combos, spear throw, timed parry, imbue, wind mobility
  await poll(() => page.evaluate(() => !window.__fourfold.player.busy && !window.__fourfold.player.scripted), 60, 200);
  await page.evaluate(() => {
    const g = window.__fourfold;
    for (const e of g.director.enemies) { e.combatant.setState('dead'); e.deadTime = 10; }
    g.player.combatant.revive();
  });
  await page.keyboard.press('Digit1');
  check(await poll(async () => (await state()).weapon === 'fists', 20, 150), 'weapons: 1 is unarmed');
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('KeyJ');
    await poll(async () => { const a = (await state()).attack; if (a) seen.add(a); return !!a; }, 10, 60);
    await poll(async () => (await state()).attack === null, 30, 100);
  }
  check([...seen].some((a) => /fi_(jab|cross|hook|upper)/.test(a)), `weapons: LMB unarmed throws punches (${[...seen].join(', ')})`);
  await page.keyboard.press('KeyK');
  let kick = null;
  await poll(async () => { kick = (await state()).attack; return !!kick; }, 20, 60);
  check(!!kick && /fi_(push|knee|round|spin|flip)/.test(kick), `weapons: RMB unarmed kicks (${kick})`);
  await shot('15a-kick');
  await poll(async () => (await state()).attack === null, 40, 100);
  await page.keyboard.press('Digit2');
  check(await poll(async () => (await state()).weapon === 'sword', 20, 150), 'weapons: 2 is the sword');
  await page.keyboard.press('Digit3');
  check(await poll(async () => (await state()).weapon === 'spear', 20, 150), 'weapons: 3 is the spear');

  // Spear throw (G), lands, is picked up by walking to it.
  await page.keyboard.press('KeyG');
  check(await poll(async () => (await state()).spear.away, 40, 100), 'spear: G throws it (weapon leaves the hand)');
  check((await state()).weapon === 'fists', 'spear: fighting unarmed while it is away');
  check(await poll(async () => (await state()).spear.state === 'grounded', 60, 100), 'spear: sticks in the ground');
  await shot('15b-spear-thrown');
  await page.evaluate(() => {
    const g = window.__fourfold; const sp = g.director.spear; const p = g.player;
    p.motor.teleport(sp.x + 0.5, g.region.terrain.heightAt(sp.x + 0.5, sp.z), sp.z);
    p.syncRender();
  });
  check(await poll(async () => { const s = await state(); return !s.spear.away && s.weapon === 'spear'; }, 40, 100), 'spear: walking over it picks it up and re-equips it');

  // Timed parry: Q just before a raider's hit parries and the player counters on their own.
  const parry = await page.evaluate(() => {
    const g = window.__fourfold;
    const p = g.player;
    const e = g.director.enemies.find((x) => x.def.id === 'raider');
    e.reset();
    const x = p.motor.x + Math.sin(p.facing) * 1.6, z = p.motor.z + Math.cos(p.facing) * 1.6;
    e.motor.teleport(x, g.region.terrain.heightAt(x, z), z);
    e.facing = p.facing + Math.PI;
    e.syncRender();
    const now = g.time.elapsed;
    p.combatant.blockPressedAt = now - 0.05;
    const res = g.director.damagePlayer(p, { instance: 990001, damage: 20, poise: 20, knockback: 3, kind: 'melee' }, e.motor, now, e);
    return { res, attack: p.runner.current?.def.id ?? null, enemy: e.id, max: e.def.maxHealth };
  });
  check(parry.res === 'parried' && parry.attack === 'sp_counter', `parry: tapped Q just before the hit parries and counters (${parry.res}, ${parry.attack})`);
  check(await poll(async () => (await state()).enemies.some((e) => e.id === parry.enemy && e.hp < parry.max), 60, 100), 'parry: the counter strikes the attacker');
  const late = await page.evaluate(() => {
    const g = window.__fourfold;
    const p = g.player;
    const e = g.director.enemies.find((x) => x.def.id === 'raider' && x.alive);
    p.runner.cancel();
    const now = g.time.elapsed;
    p.combatant.blockPressedAt = now - 1;
    return g.director.damagePlayer(p, { instance: 990002, damage: 5, poise: 1, knockback: 0, kind: 'melee' }, e.motor, now, e);
  });
  check(late === 'hit', `parry: pressing Q too early does not parry (${late})`);
  await page.evaluate(() => { const g = window.__fourfold; for (const e of g.director.enemies) { e.combatant.setState('dead'); e.deadTime = 10; } g.player.combatant.revive(); });

  // Weapon imbue (Z) with the starting element.
  await poll(() => page.evaluate(() => !window.__fourfold.player.busy), 40, 100);
  await page.keyboard.press('KeyZ');
  check(await poll(async () => (await state()).imbue === 'earth', 20, 150), 'imbue: Z coats the weapon in earth');
  await shot('15c-imbue');

  // Wind mobility: with air unlocked, Space in the air jumps again.
  await page.evaluate(() => window.__fourfold.player.abilities.unlock('air'));
  await page.keyboard.press('Space');
  await poll(async () => { const s = await state(); return !s.grounded && s.vy < 4; }, 60, 30);
  await page.keyboard.press('Space');
  check(await poll(async () => (await state()).jumpBurst === 'air', 30, 60), 'mobility: double jump in the air');
  await poll(async () => (await state()).grounded, 60, 100);

  // ---- Phase 4: camp roster, elemental ability, archer arrows, brute slam
  const roster = (await state()).enemyTypes;
  check(['raider', 'archer', 'brute'].every((t) => roster.includes(t)), `camp: raiders, an archer and a brute (${roster.join(', ')})`);
  await page.evaluate(() => {
    const g = window.__fourfold;
    g.player.combatant.revive();
    for (const e of g.director.enemies) e.reset();
  });
  // Let the finisher cinematic end before casting.
  await poll(() => page.evaluate(() => !window.__fourfold.player.busy && !window.__fourfold.player.scripted && window.__fourfold.player.motor.grounded), 60, 200);
  await page.keyboard.press('KeyR');
  check(await poll(async () => (await state()).ability.aegis > 0, 40, 150), 'ability: R raises Stone Aegis (earth)');
  check((await state()).ability.cooldowns['ability.earth'] > 0, 'ability: cooldown starts');
  await shot('15-stone-aegis');
  await page.evaluate(() => {
    const g = window.__fourfold;
    const ar = g.director.enemies.find((e) => e.def.id === 'archer');
    for (const e of g.director.enemies) if (e !== ar) { e.combatant.setState('dead'); e.deadTime = 10; }
    const p = g.player;
    const x = ar.motor.x + 9, z = ar.motor.z + 7;
    p.motor.teleport(x, g.region.terrain.heightAt(x, z), z);
    p.facing = Math.atan2(ar.motor.x - x, ar.motor.z - z);
    p.syncRender();
    g.rig.snapBehind(p.facing);
  });
  check(await poll(async () => (await state()).projectiles > 0, 80, 150), 'archer: looses an arrow at the player');
  await shot('16-archer-arrow');
  await page.evaluate(() => {
    const g = window.__fourfold;
    for (const e of g.director.enemies) e.reset();
    const br = g.director.enemies.find((e) => e.def.id === 'brute');
    for (const e of g.director.enemies) if (e !== br) { e.combatant.setState('dead'); e.deadTime = 10; }
    const p = g.player;
    p.combatant.revive();
    const x = br.motor.x + 3.5, z = br.motor.z + 1.5;
    p.motor.teleport(x, g.region.terrain.heightAt(x, z), z);
    p.syncRender();
  });
  check(
    await poll(() => page.evaluate(() => window.__fourfold.director.enemies.some((e) => e.def.id === 'brute' && e.attack)), 100, 150),
    'brute: attacks when the player is close',
  );
  await shot('17-brute');

  // ---- Phase 4: shrine attunement, waystone discovery, travel to another region
  await page.evaluate(() => {
    const g = window.__fourfold;
    for (const e of g.director.enemies) e.reset();
    const p = g.player;
    p.combatant.revive();
    const r = g.region;
    const x = r.landmark.x + 3.5, z = r.landmark.z + 3;
    p.motor.teleport(x, r.terrain.heightAt(x, z) + 0.7, z);
    p.syncRender();
  });
  check(await poll(async () => (await page.locator('.interact:not([hidden])').count()) > 0, 30, 150), 'shrine: interaction prompt near the shrine');
  await page.keyboard.press('KeyE');
  check(await poll(async () => (await state()).shrineOpen, 20, 150), 'shrine: E opens the shrine');
  await shot('18-shrine');
  await page.click('[data-shrine=attune]');
  check(await poll(async () => (await state()).discoveries.includes('shrine:thornwall'), 20, 150), 'shrine: attuning records the discovery');
  await page.evaluate(() => {
    const g = window.__fourfold;
    const w = g.region.waystones[0];
    const p = g.player;
    const x = w.pos.x + 1.5, z = w.pos.z + 1.5;
    p.motor.teleport(x, g.region.terrain.heightAt(x, z), z);
    p.syncRender();
  });
  check(await poll(async () => (await state()).discoveries.some((d) => d.startsWith('waystone:thornwall')), 30, 150), 'waystone: walking up to it lights it');
  await shot('19-waystone');
  await page.evaluate(() => {
    const g = window.__fourfold;
    const r = g.region;
    const p = g.player;
    const x = r.landmark.x + 3.5, z = r.landmark.z + 3;
    p.motor.teleport(x, r.terrain.heightAt(x, z) + 0.7, z);
    p.syncRender();
  });
  await poll(async () => (await page.locator('.interact:not([hidden])').count()) > 0, 30, 150);
  await page.keyboard.press('KeyE');
  await poll(async () => (await state()).shrineOpen, 20, 150);
  await page.click('[data-travel=emberreach]');
  await page.waitForFunction(() => window.__fourfold.debugState().region === 'emberreach' && window.__fourfold.debugState().mode === 'playing', null, { timeout: 60000 });
  await page.evaluate(() => {
    const g = window.__fourfold;
    const r = g.region;
    const p = g.player;
    const x = r.landmark.x + 3.5, z = r.landmark.z + 3;
    p.motor.teleport(x, r.terrain.heightAt(x, z) + 0.7, z);
    p.syncRender();
  });
  await poll(async () => (await page.locator('.interact:not([hidden])').count()) > 0, 30, 150);
  await page.keyboard.press('KeyE');
  await poll(async () => (await state()).shrineOpen, 20, 150);
  await page.click('[data-shrine=attune]');
  const af = await state();
  check(af.ability.unlocked.includes('fire') && af.ability.selected === 'fire', 'travel: Emberreach shrine teaches Ember Burst');
  await page.keyboard.press('KeyV');
  check(await poll(async () => (await state()).ability.selected === 'earth', 20, 150), 'ability: V switches element');
  check(af.discoveries.includes('shrine:thornwall') && af.discoveries.some((d) => d.startsWith('waystone:')), 'travel: discoveries survive the journey');

  // ---- All four regions (dev shortcut)
  for (const element of ['earth', 'fire', 'water', 'air']) {
    await page.goto(`${base}?element=${element}&play`);
    await waitMode('playing');
    await page.waitForTimeout(2000);
    const a = await state();
    check(a.grounded === true, `${element}: spawns grounded in ${a.region}`);
    await shot(`20-${element}`);
    await page.keyboard.press('Space');
    check(await poll(async () => (await state()).grounded === false, 40, 30), `${element}: jump leaves the ground`);
    check(await poll(async () => (await state()).grounded === true), `${element}: lands again`);
    await page.keyboard.down('KeyW');
    const moved = await poll(async () => {
      const b = await state();
      return Math.hypot(b.position.x - a.position.x, b.position.z - a.position.z) > 2;
    }, 40, 250);
    await page.keyboard.up('KeyW');
    check(moved, `${element}: moves`);
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
