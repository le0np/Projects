// Wires simulation, rendering, UI, input and saving together.
// Messages go two ways: what the farmer thinks or can't do appears in a speech bubble,
// everything else (customers, drone, deliveries, the stand) arrives on the phone.

import {
  createState, tick, command, sleep, coffee, eat, moveItem, craft, cropById, recipeById,
  countWhere, extractSeeds, orderSeeds, startJob, upgradeIrrigation, orderFertilizer,
} from './sim.js';
import { TIER_NAMES } from './data.js';
import { SAVE_KEY, OLDER_KEYS, serialize, deserialize } from './save.js';
import { createRenderer } from './render.js';
import { createUI, itemName, stars, formatMoney, plots } from './ui.js';

const ZOOM_KEY = 'dev-farm/zoom';
const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

const loaded = deserialize([SAVE_KEY, ...OLDER_KEYS].map((k) => storage.get(k)).find((v) => v) ?? null);
let state = loaded.state;
let hoverTile = null;

const canvas = document.getElementById('world');
const renderer = createRenderer(canvas);
const savedZoom = Number(storage.get(ZOOM_KEY));
if (savedZoom > 0) renderer.setZoom(savedZoom);

const ui = createUI({
  onTool, onSeed, onMove, onEat, onPlace, onSleep, onCoffee, onCraft, onReset, onExtract, onOrder, onZoom, onJob,
  onIrrigation, onOrderFertilizer,
  onClosePanel: closePanel,
  onChange: refresh,
});

const save = () => storage.set(SAVE_KEY, serialize(state));

// ------------------------------------------------------------------ what the farmer says

const name = (crop) => cropById[crop].name.toLowerCase();

function farmerSays(e) {
  switch (e.reason) {
    case 'tired': return 'Nemam više snage… Kava, nešto za pojesti ili krevet.';
    case 'coins': return 'Nemam dovoljno novca za to.';
    case 'canempty': return state.upgrades.well ? 'Kanta je prazna. Idem po vodu na bunar ili ribnjak.' : 'Kanta je prazna. Moram po vodu na ribnjak.';
    case 'wet': return 'Ova je još dobro zalivena.';
    case 'bagfull': return 'Torba je puna. Nešto moram odložiti u škrinju ili na štand.';
    case 'nofert': return 'Nemam gnojiva. Mogu ga napraviti na radnom stolu.';
    case 'fertilized': return 'Ova je već pognojena.';
    case 'needseed': return 'Za sadnju moram uzeti sjeme u ruku (2).';
    case 'noseeds':
      if (!state.found.house) return 'Nemam sjemena… Možda u kući nešto ima?';
      return e.crop ? `Nemam više sjemena za ${name(e.crop)}. Izvadit ću ga iz ploda ili naručiti.` : 'Nemam sjemena.';
    case 'locked': return 'Sve je zaraslo. Za ovo treba plan: git clone polje.';
    case 'nopath': return 'Ne mogu doći do tamo.';
    case 'placeplot': return 'Prskalica ide samo na praznu parcelu.';
    case 'sprinklerhere': return 'Tu stoji prskalica. Rukama (1) je mogu pokupiti.';
    case 'full': return 'Energija mi je puna.';
    case 'nowell': return 'Ovdje bi bio dobar bunar. Mogu ga sazidati na radnom stolu.';
    case 'notfruit': return 'Iz toga nema sjemena.';
    case 'standfull': return 'Štand je pun.';
    case 'needtool': return 'Raste. Mogu je zaliti kantom (3) ili pognojiti (4).';
    case 'nofreeplots': return 'Nema slobodnih parcela.';
    case 'tooearly': return 'Još je rano za spavanje. Ima posla do večeri.';
    case 'nothingdry': return 'Sve je već zaliveno.';
    case 'noplan': return 'Ovdje bi bio dobar bunar, ali treba mi plan. Skicirat ću ga na radnom stolu.';
    case 'nothingripe': return 'Još ništa nije zrelo.';
    case 'chestfull': return null; // the drone's problem: goes to the phone
    default: return null;
  }
}

// ------------------------------------------------------------------ routing events

let droneBatch = 0;
let jobTally = null; // quality counts while "harvest all" runs

const tallyText = (t) => [4, 3, 2, 1].filter((k) => t[k]).map((k) => `${stars(k)} ${t[k]} kg`).join(', ');

function report(events) {
  for (const e of events) {
    switch (e.type) {
      case 'fail': {
        if (state.farmer.job || events.some((x) => x.type === 'jobend')) break; // the job summary says it
        const text = farmerSays(e);
        if (text) ui.say(text, ['needseed', 'needtool', 'wet', 'nowell', 'fertilized', 'full'].includes(e.reason) ? '' : 'sad');
        else if (e.reason === 'chestfull') ui.notify('🚁 Dron: škrinja je puna, stao sam s berbom.', 'err');
        else if (e.reason === 'notincatalog') ui.notify('📦 Toga još nema u katalogu.', 'err');
        break;
      }
      case 'open':
        ui.state.panel = e.panel;
        ui.state.selected = -1;
        break;
      case 'found':
        ui.say(e.what === 'ladica u kući'
          ? `U ladici je vrećica sjemena: ${e.n}× ${name(e.crop)}!`
          : `${e.what[0].toUpperCase()}${e.what.slice(1)}! ${e.n}× sjeme (${name(e.crop)}).`, 'happy');
        break;
      case 'newfind':
        ui.notify('🌱 Na imanju je nešto niknulo samo od sebe. Možda sjeme?', 'info');
        break;
      case 'extracted':
        ui.say(`${e.n} ${e.n < 5 ? 'sjemenke' : 'sjemenki'} (${name(e.crop)}).`, e.n >= 7 ? 'happy' : '');
        break;
      case 'jobstart':
        jobTally = e.kind === 'harvest' ? {} : null;
        ui.say(e.kind === 'plant' ? `Idem sijati: ${e.total} ${plots(e.total)}.`
          : e.kind === 'water' ? `Idem zalijevati: ${e.total} ${plots(e.total)}.` : `Idem brati, zrelih: ${e.total}.`);
        break;
      case 'jobcancel':
        jobTally = null;
        ui.say(`Dobro, prekidam ${{ plant: 'sadnju', harvest: 'berbu', water: 'zalijevanje' }[e.kind]}.`);
        break;
      case 'jobend': {
        const what = `${{ plant: 'Posađeno', harvest: 'Ubrano', water: 'Zaliveno' }[e.kind]} ${e.done}`;
        const detail = jobTally && e.done ? ` (${tallyText(jobTally)})` : '';
        jobTally = null;
        if (e.reason) ui.say(`${farmerSays(e)} ${what} od ${e.total}${detail}.`, 'sad');
        else ui.say(`Gotovo! ${what}${detail}.`, 'happy');
        break;
      }
      case 'harvest':
        if (e.by === 'drone') droneBatch++;
        else if (jobTally) jobTally[e.tier] = (jobTally[e.tier] ?? 0) + e.kg;
        else ui.say(`${cropById[e.crop].name} ${stars(e.tier)}, ${TIER_NAMES[e.tier]}! ${e.kg} kg.`, e.tier >= 3 ? 'happy' : e.tier === 1 ? 'sad' : '');
        break;
      case 'sale':
        ui.notify(`🛒 Kupac je kupio ${e.qty} kg: ${cropById[e.crop].name} ${stars(e.tier)} · +${formatMoney(e.money)}`, 'ok');
        break;
      case 'nosale':
        ui.notify('🛒 Kupac je došao do praznog štanda i otišao.', 'info');
        break;
      case 'refill':
        ui.say(`Kanta je puna (${e.water}).`);
        break;
      case 'rot':
        ui.notify(`⚠️ ${cropById[e.crop].name} je istrunula na polju.`, 'err');
        break;
      case 'unlock':
        ui.notify(`📦 Novo u katalogu dostave: ${cropById[e.crop].name}.`, 'ok');
        break;
      case 'ordered':
        ui.notify(e.item
          ? `📦 Naručeno: vreća gnojiva (−${formatMoney(e.price)}). Stiže sutra ujutro u škrinju.`
          : `📦 Naručeno: ${e.n}× sjeme, ${cropById[e.crop].name} (−${formatMoney(e.price)}). Stiže sutra ujutro.`);
        break;
      case 'delivered':
        ui.notify(e.item ? `📦 Dostava je stigla: ${e.n}× gnojivo, u škrinji.` : `📦 Dostava je stigla: ${e.n}× sjeme (${name(e.crop)}).`, 'ok');
        break;
      case 'buildstart':
        ui.say('Plan je tu. Zidam bunar…');
        break;
      case 'buildcancel':
        ui.say('Bunar ću dovršiti drugi put.');
        break;
      case 'built':
        ui.say('Bunar je sazidan! Voda je sad blizu, a može i navodnjavanje.', 'happy');
        ui.notify('🪣 Bunar je sazidan. Na radnom stolu sad možeš izraditi prskalice.', 'ok');
        break;
      case 'irrigation':
        ui.say(`water.sh v${e.level}: svaka prskalica sad zalijeva ${e.reach} parcela.`, 'happy');
        break;
      case 'craft': {
        const r = recipeById[e.recipe];
        ui.say(e.recipe === 'wellPlan' ? 'Plan bunara je skiciran. Sad idem zidati na gradilište kod kuće.' : `Gotovo: ${r.name}!`, 'happy');
        break;
      }
      case 'placed':
        ui.say('Prskalica postavljena. water.sh radi svakih 30 s.', 'happy');
        break;
      case 'pickup':
        ui.say('Prskalica je u torbi.');
        break;
      case 'coffee':
        ui.say(`Ahh, kava. +${e.gain} ⚡`, 'happy');
        break;
      case 'eat':
        ui.say(`Njam. +${e.gain} ⚡`);
        break;
      case 'shop':
        ui.notify(e.open ? '🏪 Štand je otvoren, kupci dolaze.' : '🏪 Štand je zatvoren za danas.', 'info');
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
  const saved = save();
  if (e.type === 'passout') ui.say('Zzz… Ovo je bio predug dan.', 'sad');
  else ui.say('Dobro jutro! Novi dan na farmi.', 'happy');
  const parts = [`🌙 Dan ${e.day}.`, saved ? 'Igra je spremljena.' : 'Spremanje nije uspjelo (browser ne dopušta).'];
  if (e.type === 'passout') parts.push('Farmer je zaspao na nogama: danas s pola energije.');
  if (e.summary.ripened) parts.push(`Preko noći sazrelo: ${e.summary.ripened}.`);
  if (e.summary.sprinkled) parts.push(`Prskalice su zalile ${e.summary.sprinkled} ${plots(e.summary.sprinkled)}.`);
  if (e.summary.rotted) parts.push(`Istrunulo: ${e.summary.rotted}.`);
  ui.notify(parts.join(' '), e.type === 'passout' ? 'err' : 'ok');
}

function flushDrone() {
  if (!droneBatch) return;
  ui.notify(`🚁 Dron je ubrao ${droneBatch} i odnio u škrinju.`, 'info');
  droneBatch = 0;
}

function intro() {
  ui.notify('👋 Dobrodošlica na farmu! Klikni bilo gdje na mapi i farmer ode tamo. Klik na parcelu radi ono što farmer drži u ruci (tipke 1–4): sjeme sadi, kanta zalijeva jednu biljku, gnojivo gnoji. ▾ uz sjeme posadi sve (tipka P), a ▾ uz kantu zalije sve (tipka Z), ili samo jednu vrstu.', 'info');
  ui.notify(`🌱 Sjeme se broji: nađi ga na imanju, izvadi iz plodova na radnom stolu ili naruči ovdje, pod "Dostava sjemena".`, 'info');
  ui.notify('🌙 Usjevi rastu preko noći: svako jutro jedan dan ako su dan prije bili zaliveni, pola dana ako nisu. Dovoljno je zaliti jednom dnevno.', 'info');
  ui.notify('🏪 Plodove stavi na štand ispred kuće. Bolja kvaliteta, bolja cijena. Od 18 h možeš spavati u kući: tako se igra sprema.', 'info');
  setTimeout(() => ui.say('Nova farma! Sjemena još nemam… Možda u kući nešto ima?'), 600);
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

function onExtract(slot) {
  act((ev) => extractSeeds(state, slot, ev));
  if (!state.bag[slot]) ui.state.selected = -1;
}

function onOrder(crop) {
  act((ev) => orderSeeds(state, crop, ev));
}

function onPlace() {
  if (!countWhere(state.bag, (id) => id === 'sprinkler')) return;
  ui.state.placing = true;
  ui.state.panel = null;
  ui.say('Gdje da je stavim? Klikni praznu parcelu.');
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

function onJob(kind, crop = null) {
  if (state.farmer.job) {
    cancelJob();
    return;
  }
  ui.state.panel = null;
  ui.state.placing = false;
  act((ev) => startJob(state, kind, crop, ev));
}

function onIrrigation() {
  act((ev) => upgradeIrrigation(state, ev));
}

function onOrderFertilizer() {
  act((ev) => orderFertilizer(state, ev));
}

function cancelJob() {
  const f = state.farmer;
  if (!f.job) return;
  report([{ type: 'jobcancel', kind: f.job.kind, done: f.job.done }]);
  f.job = null;
  f.queue = [];
  f.path = f.path.slice(0, 1); // finish the step in progress
  f.task = null;
  refresh();
}

function onZoom(dir) {
  const z = dir > 0 ? renderer.zoomIn() : renderer.zoomOut();
  storage.set(ZOOM_KEY, String(z));
  refresh();
}

function onReset() {
  if (!window.confirm('Obrisati farmu i krenuti ispočetka?')) return;
  storage.remove(SAVE_KEY);
  OLDER_KEYS.forEach((k) => storage.remove(k));
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
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  onZoom(e.deltaY < 0 ? 1 : -1);
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
  const tool = { 1: 'hand', 2: 'seed', 3: 'can', 4: 'fert' }[e.key];
  if (tool) onTool(tool);
  else if (e.key === 'p' || e.key === 'P') onJob('plant');
  else if (e.key === 'b' || e.key === 'B') onJob('harvest');
  else if (e.key === 'z' || e.key === 'Z') onJob('water');
  else if (e.key === '+' || e.key === '=') onZoom(1);
  else if (e.key === '-') onZoom(-1);
  else if (e.key === 'Escape') {
    cancelJob();
    ui.state.placing = false;
    closePanel();
  }
});

window.addEventListener('resize', () => renderer.resize());

// ------------------------------------------------------------------ loop

let lastFrame = performance.now();
let lastUi = 0;

function refresh() {
  ui.update(state, hoverTile, { canIn: renderer.canZoom(1), canOut: renderer.canZoom(-1) });
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
  renderer.draw(state, now, { placing: ui.state.placing });
  const head = renderer.worldToCanvas(state.farmer.x * 32 + 16, state.farmer.y * 32 - 4);
  ui.placeBubble(head.x, head.y, now);
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

if (loaded.restored) ui.notify(`👋 Dan ${state.day}: farma je tu gdje je i bila.`, 'info');
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
  say: (t) => ui.say(t),
  redraw() { refresh(); renderer.draw(state, performance.now()); },
};
