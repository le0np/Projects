// Wires simulation, rendering, UI and saving together.

import { OFFLINE_CAP } from './data.js';
import {
  createState, advance, clickTile, buyUpgrade, cropById, upgradeById, isUnlocked, summarize,
} from './sim.js';
import { SAVE_KEY, serialize, deserialize } from './save.js';
import { createRenderer } from './render.js';
import { createUI, plural, formatDuration, formatCoins } from './ui.js';

const storage = {
  get() { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(SAVE_KEY, v); } catch { /* private mode: play without saving */ } },
  remove() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } },
};

const loaded = deserialize(storage.get(), Date.now());
let state = loaded.state;

const canvas = document.getElementById('field');
const renderer = createRenderer(canvas);
const ui = createUI({ onSelectCrop, onBuy, onReset });

const save = () => storage.set(serialize(state, Date.now()));

const wateredText = (n) =>
  plural(n, `${n} parcela zalivena`, `${n} parcele zalivene`, `${n} parcela zaliveno`);

let droneBatch = { count: 0, coins: 0 };

function report(events) {
  for (const e of events) {
    if (e.type === 'water' && e.by === 'cron') {
      ui.log(`$ ./water.sh → ${wateredText(e.count)}`, 'cmd');
    } else if (e.type === 'harvest' && e.by === 'drone') {
      droneBatch.count++;
      droneBatch.coins += e.coins;
    } else if (e.type === 'unlock') {
      ui.log(`✔ novo sjeme: ${cropById[e.crop].name}`, 'ok');
    }
  }
}

function flushDrone() {
  if (!droneBatch.count) return;
  ui.log(`$ harvest-drone → pobrano ${droneBatch.count}, +${formatCoins(droneBatch.coins)} 🪙`, 'cmd');
  droneBatch = { count: 0, coins: 0 };
}

function welcomeBack(seconds, events) {
  const sum = summarize(events);
  ui.log(`$ last login: prije ${formatDuration(seconds)}`, 'cmd');
  if (sum.harvested) {
    ui.log(`Dok te nije bilo: pobrano ${sum.harvested}, zarađeno ${formatCoins(sum.earned)} 🪙, `
      + `${wateredText(sum.watered)}.`, 'ok');
  } else if (state.upgrades.drone > 0) {
    ui.log('Dron nije imao što pobrati. Posadi nešto prije pauze.', 'info');
  } else {
    ui.log('Usjevi su rasli, ali ih nitko nije pobrao. Vrijeme je za harvest-drone?', 'info');
  }
  for (const id of sum.unlocked) ui.log(`✔ novo sjeme: ${cropById[id].name}`, 'ok');
}

function intro() {
  ui.log('$ ssh farma', 'cmd');
  ui.log('Spojeno. Klikni praznu parcelu da posadiš rotkvicu, suhu da je zaliješ, zrelu da je pobereš.', 'info');
  ui.log('Zaradu ulaži u skripte i izume desno: oni rade umjesto tebe, i dok si na sastanku.', 'info');
}

// --- simulation clock -------------------------------------------------------

let last = Date.now();
let away = null; // events collected while the tab is hidden

function step() {
  const now = Date.now();
  const dt = Math.min(OFFLINE_CAP, Math.max(0, (now - last) / 1000));
  last = now;
  if (dt === 0) return;
  const events = advance(state, dt, []);
  if (document.hidden) {
    away ??= { seconds: 0, events: [] };
    away.seconds += dt;
    for (const e of events) away.events.push(e);
  } else if (dt >= 60) {
    welcomeBack(dt, events); // e.g. the laptop was asleep
  } else {
    report(events);
    renderer.notify(events, state, performance.now());
  }
  ui.update(state);
}

function returnToTab() {
  step();
  if (!away) return;
  if (away.seconds >= 60) welcomeBack(away.seconds, away.events);
  else report(away.events);
  away = null;
  ui.update(state);
}

// --- player actions ---------------------------------------------------------

function onSelectCrop(id) {
  if (!isUnlocked(state, id)) return;
  state.selectedCrop = id;
  ui.update(state);
}

function onBuy(id) {
  step();
  const r = buyUpgrade(state, id);
  const u = upgradeById[id];
  if (r.ok) {
    const level = state.upgrades[id];
    ui.log(`$ ${u.cmd}`, 'cmd');
    ui.log(`✔ ${u.name} lvl ${level}: ${u.effect(level)}`, 'ok');
    save();
  } else if (r.reason === 'broke') {
    ui.log('✖ Nakon kupnje ne bi ostalo novca za sjeme. Prvo nešto posadi.', 'err');
  }
  ui.update(state);
}

function onReset() {
  if (!window.confirm('Obrisati farmu i krenuti ispočetka?')) return;
  storage.remove();
  state = createState();
  droneBatch = { count: 0, coins: 0 };
  ui.clear();
  intro();
  save();
  ui.update(state);
}

canvas.addEventListener('click', (e) => {
  step();
  const i = renderer.tileAt(e.clientX, e.clientY, state);
  if (i < 0) return;
  const events = [];
  const r = clickTile(state, i, events);
  if (!r.ok && r.reason === 'coins') {
    ui.log(`✖ Nedovoljno novčića: ${cropById[state.selectedCrop].name} košta ${r.need} 🪙`, 'err');
  }
  report(events);
  renderer.notify(events, state, performance.now());
  ui.update(state);
});

canvas.addEventListener('mousemove', (e) => {
  const i = renderer.tileAt(e.clientX, e.clientY, state);
  renderer.setHover(i);
  canvas.style.cursor = i >= 0 ? 'pointer' : 'default';
});
canvas.addEventListener('mouseleave', () => renderer.setHover(-1));

// --- start ------------------------------------------------------------------

if (loaded.restored) ui.log('$ ssh farma → spojeno, farma učitana', 'cmd');
else intro();

if (loaded.elapsed > 0) {
  const events = advance(state, loaded.elapsed, []);
  if (loaded.elapsed >= 60) welcomeBack(loaded.elapsed, events);
}

ui.update(state);
renderer.draw(state, performance.now());

setInterval(step, 200);
setInterval(flushDrone, 10_000);
setInterval(save, 10_000);
document.addEventListener('visibilitychange', () => (document.hidden ? save() : returnToTab()));
window.addEventListener('pagehide', save);

function frame(now) {
  renderer.draw(state, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
