// Wires simulation, rendering, UI, input and saving together.

import {
  createState, tick, command, sleep, coffee, eat, moveItem, craft, isUnlocked, cropById, recipeById,
  countWhere,
} from './sim.js';
import { TIER_NAMES } from './data.js';
import { SAVE_KEY, serialize, deserialize } from './save.js';
import { createRenderer } from './render.js';
import { createUI, itemName, stars, formatCoins } from './ui.js';

const storage = {
  get() { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(SAVE_KEY, v); return true; } catch { return false; } },
  remove() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } },
};

const loaded = deserialize(storage.get());
let state = loaded.state;
let hoverTile = null;

const canvas = document.getElementById('world');
const renderer = createRenderer(canvas);
const ui = createUI({
  onTool, onSeed, onMove, onEat, onPlace, onSleep, onCoffee, onCraft, onReset,
  onClosePanel: closePanel,
  onChange: refresh,
});

const save = () => storage.set(serialize(state));

// ------------------------------------------------------------------ messages

const FAIL_TEXT = {
  tired: '✖ Nema energije. Popij kavu u kući, pojedi nešto iz torbe ili idi spavati.',
  coins: '✖ Nedovoljno novčića.',
  canempty: '✖ Kanta je prazna. Napuni je na bunaru ili ribnjaku.',
  wet: 'Parcela je još dobro zalivena.',
  bagfull: '✖ Torba je puna. Odloži stvari u škrinju ili na štand.',
  chestfull: '✖ Škrinja je puna, dron je stao. Isprazni je.',
  standfull: '✖ Štand je pun.',
  nofert: '✖ Nemaš gnojiva. Izradi ga na radnom stolu.',
  fertilized: 'Ova biljka je već pognojena.',
  needseed: 'Prazna parcela. Uzmi sjeme (tipka 2) pa klikni ponovno.',
  needtool: 'Biljka raste. Kanta (3) je zalijeva, gnojivo (4) je hrani.',
  locked: 'Ovo polje je zaraslo. Otključaj ga na radnom stolu: git clone polje.',
  nopath: 'Farmer ne može doći do tamo.',
  notsellable: '✖ Kupci ne žele loše (★) proizvode. Pojedi ih ili kompostiraj.',
  placeplot: '✖ Prskalica ide samo na praznu, otključanu parcelu.',
  sprinklerhere: 'Tu stoji prskalica. Rukama (1) je pokupiš.',
  full: 'Energija je već puna.',
  cropLocked: '✖ To sjeme još nije otključano.',
};

let droneBatch = 0;

function report(events) {
  for (const e of events) {
    switch (e.type) {
      case 'fail':
        if (FAIL_TEXT[e.reason]) ui.log(FAIL_TEXT[e.reason], e.reason.startsWith('need') || e.reason === 'wet' ? 'info' : 'err');
        break;
      case 'open':
        ui.state.panel = e.panel;
        ui.state.selected = -1;
        break;
      case 'harvest':
        if (e.by === 'drone') droneBatch++;
        else ui.log(`Ubrano: ${cropById[e.crop].name} ${stars(e.tier)} (${TIER_NAMES[e.tier]})`, e.tier >= 2 ? 'ok' : 'info');
        break;
      case 'sale':
        ui.log(`$ kupac@štand → ${e.qty}× ${cropById[e.crop].name} ${stars(e.tier)}, +${formatCoins(e.coins)} 🪙`, 'cmd');
        break;
      case 'nosale':
        ui.log('Kupac je došao do praznog štanda i otišao.', 'info');
        break;
      case 'refill':
        ui.log(`Kanta napunjena (${e.water}).`, 'info');
        break;
      case 'rot':
        ui.log(`✖ ${cropById[e.crop].name} je istrunula na parceli. Bere se na vrijeme!`, 'err');
        break;
      case 'unlock':
        ui.log(`✔ Novo sjeme: ${cropById[e.crop].name}`, 'ok');
        break;
      case 'craft': {
        const r = recipeById[e.recipe];
        ui.log(`$ make ${r.name.split(' ')[0].toLowerCase()} → gotovo: ${r.name}`, 'ok');
        break;
      }
      case 'placed':
        ui.log('$ ./water.sh --install → prskalica radi svakih 30 s', 'ok');
        break;
      case 'pickup':
        ui.log('Prskalica je u torbi.', 'info');
        break;
      case 'coffee':
        ui.log(`☕ Kava: +${e.gain} ⚡`, 'ok');
        break;
      case 'eat':
        ui.log(`Pojedeno: ${cropById[e.crop].name} (+${e.gain} ⚡)`, 'info');
        break;
      case 'shop':
        ui.log(e.open ? '$ systemctl start štand → kupci dolaze' : '$ systemctl stop štand → kupci idu kući', 'cmd');
        break;
      case 'slept':
      case 'passout':
        nightReport(e);
        break;
      default:
    }
  }
}

function nightReport(e) {
  closePanel();
  if (e.type === 'passout') {
    ui.log('✖ U 2 sata ujutro farmer je zaspao na nogama. Novi dan s pola energije.', 'err');
  } else {
    ui.log('$ sudo shutdown -r 06:00', 'cmd');
  }
  const saved = save();
  const parts = [`Dan ${e.day}.`, saved ? 'Igra spremljena.' : 'Spremanje nije uspjelo (browser ne dopušta).'];
  if (e.summary.ripened) parts.push(`Preko noći sazrelo: ${e.summary.ripened}.`);
  if (e.summary.droneHarvested) parts.push(`Dron je ubrao ${e.summary.droneHarvested}.`);
  ui.log(parts.join(' '), 'ok');
}

function flushDrone() {
  if (!droneBatch) return;
  ui.log(`$ harvest-drone → ${droneBatch} u škrinju`, 'cmd');
  droneBatch = 0;
}

function intro() {
  ui.log('$ ssh farma', 'cmd');
  ui.log('Spojeno. Klikni na mapu i farmer ide tamo. Klik na parcelu radi ono što drži u ruci (tipke 1–4).', 'info');
  ui.log('Posadi (2), zalij (3), poberi kad sazrije. Što bolje paziš na biljku i što je prije ubereš, to je kvalitetnija.', 'info');
  ui.log('Robu ★★ i bolju stavi na štand ispred kuće. Navečer idi spavati u kuću: tako se igra sprema.', 'info');
}

// ------------------------------------------------------------------ actions

function act(fn) {
  const events = [];
  fn(events);
  report(events);
  renderer.notify(events, state, performance.now());
  refresh();
}

function closePanel() {
  ui.state.panel = null;
  refresh();
}

function onTool(tool) {
  ui.state.placing = false;
  state.tool = tool;
  refresh();
}

function onSeed(id) {
  if (!isUnlocked(state, id)) return;
  state.seed = id;
  state.tool = 'seed';
  ui.state.placing = false;
  refresh();
}

function onMove(from, slot, to) {
  act((ev) => moveItem(state, from, slot, to, ev));
}

function onEat(slot) {
  act((ev) => eat(state, slot, ev));
  if (!state.bag[slot]) ui.state.selected = -1;
}

function onPlace() {
  if (!countWhere(state.bag, (id) => id === 'sprinkler')) return;
  ui.state.placing = true;
  ui.state.panel = null;
  ui.log('Klikni praznu parcelu za prskalicu (Esc za odustajanje).', 'info');
  refresh();
}

function onSleep() {
  act((ev) => sleep(state, ev));
}

function onCoffee() {
  act((ev) => coffee(state, ev));
}

function onCraft(id) {
  act((ev) => craft(state, id, ev));
}

function onReset() {
  if (!window.confirm('Obrisati farmu i krenuti ispočetka?')) return;
  storage.remove();
  state = createState(Date.now() % 2147483646 + 1);
  Object.assign(ui.state, { panel: null, selected: -1, placing: false });
  ui.clear();
  intro();
  save();
  refresh();
}

// ------------------------------------------------------------------ input

canvas.addEventListener('click', (e) => {
  const t = renderer.tileFromClient(e.clientX, e.clientY);
  if (!t) return;
  const mode = ui.state.placing ? 'place' : 'auto';
  ui.state.placing = false;
  ui.state.panel = null;
  act((ev) => command(state, t[0], t[1], mode, ev));
});

canvas.addEventListener('mousemove', (e) => {
  hoverTile = renderer.tileFromClient(e.clientX, e.clientY);
  renderer.setHover(hoverTile);
});
canvas.addEventListener('mouseleave', () => {
  hoverTile = null;
  renderer.setHover(null);
});

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
  const tool = { 1: 'hand', 2: 'seed', 3: 'can', 4: 'fert' }[e.key];
  if (tool) onTool(tool);
  else if (e.key === 'Escape') {
    ui.state.placing = false;
    closePanel();
  }
});

window.addEventListener('resize', () => renderer.resize());

// ------------------------------------------------------------------ loop

let lastFrame = performance.now();
let lastUi = 0;

function refresh() {
  ui.update(state, hoverTile);
}

function frame(now) {
  // time only runs while the tab is visible; long gaps (sleeping laptop) are capped
  const dt = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  if (!document.hidden && dt > 0) {
    const events = tick(state, dt, []);
    if (events.length) {
      report(events);
      renderer.notify(events, state, now);
    }
  }
  renderer.draw(state, now);
  if (now - lastUi > 120) {
    lastUi = now;
    refresh();
  }
  requestAnimationFrame(frame);
}

// quiet autosave so closing the tab never loses much; sleeping is the "real" save
setInterval(save, 30_000);
setInterval(flushDrone, 10_000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  lastFrame = performance.now();
});
window.addEventListener('pagehide', save);

if (loaded.restored) ui.log(`$ ssh farma → Dan ${state.day}, nastavljamo gdje si stao.`, 'cmd');
else intro();
refresh();
renderer.draw(state, performance.now());
requestAnimationFrame(frame);

// for poking around in the browser console: devFarm.state, devFarm.redraw()
window.devFarm = {
  get state() { return state; },
  ui: ui.state,
  renderer,
  itemName,
  redraw() { refresh(); renderer.draw(state, performance.now()); },
};
