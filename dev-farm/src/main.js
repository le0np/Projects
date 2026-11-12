// Wires simulation, rendering, UI, input and saving together.
// Messages go two ways: what the farmer thinks or can't do appears in a speech bubble,
// everything else (customers, drone, deliveries, the stand) arrives on the phone.

import {
  createState, tick, advance, command, sleep, coffee, eat, moveItem, craft, cropById, recipeById,
  countWhere, extractSeeds, orderSeeds, startJob, upgradeIrrigation, orderItem, feedHens, acceptGig, sprinklerAt,
  goWork, goodById, forageById, shopItemById,
} from './sim.js';
import { TIER_NAMES, HOSE_PER_SPRINKLER } from './data.js';
import { SAVE_KEY, OLDER_KEYS, serialize, deserialize } from './save.js';
import { createRenderer } from './render.js';
import { createUI, itemName, stars, formatMoney, plots } from './ui.js';

const ZOOM_KEY = 'dev-farm/zoom';
const SETTINGS_KEY = 'dev-farm/settings';
const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

const loaded = deserialize([SAVE_KEY, ...OLDER_KEYS].map((k) => storage.get(k)).find((v) => v) ?? null);
let state = loaded.state;
let hoverTile = null;
let hoverCorner = null;

const canvas = document.getElementById('world');
const renderer = createRenderer(canvas);
const savedZoom = Number(storage.get(ZOOM_KEY));
if (savedZoom > 0) renderer.setZoom(savedZoom);

const ui = createUI({
  onTool, onSeed, onMove, onEat, onPlace, onSleep, onCoffee, onCraft, onReset, onExtract, onOrder, onZoom, onJob,
  onIrrigation, onOrderItem, onAcceptGig, onGoWork, onSetting,
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
    case 'placeplot': return 'Prskalica ide na križanje gdje se dodiruju parcele.';
    case 'nowell': return state.upgrades.wellPlan ? 'Prvo treba sazidati bunar.' : 'Za navodnjavanje trebam bunar. Plan ću skicirati na radnom stolu.';
    case 'nopump': return 'Treba mi vodena pumpa na bunaru. Naručit ću je na mobitelu (Dostava).';
    case 'nohose': return `Treba mi ${HOSE_PER_SPRINKLER} m crijeva po prskalici, a imam ${e.hose ?? 0} m.`;
    case 'nosprinkler': return 'Nemam prskalicu u torbi.';
    case 'full': return 'Energija mi je puna.';
    case 'nowell': return 'Ovdje bi bio dobar bunar. Mogu ga sazidati na radnom stolu.';
    case 'notfruit': return 'Iz toga nema sjemena.';
    case 'standfull': return 'Štand je pun.';
    case 'needtool': return 'Raste. Mogu je zaliti kantom (3) ili pognojiti (4).';
    case 'nofreeplots': return 'Nema slobodnih parcela.';
    case 'tooearly': return 'Još je rano za spavanje. Ima posla do večeri.';
    case 'nothingdry': return 'Sve je već zaliveno.';
    case 'coopbroken': return 'Kokoši mogu doći tek kad popravim kokošinjac.';
    case 'nomats': return e.mats ? `Za ovo trebam ${e.mats.wood} drva i ${e.mats.stone} kamena u torbi. Ima ih uz rub šume.` : 'Nemam dovoljno materijala.';
    case 'notfood': return 'To kokoši ne jedu.';
    case 'feederfull': return 'Hranilica je puna.';
    case 'nothingtofert': return 'Nema ništa za pognojiti.';
    case 'noplan': return e.what === 'coop' ? 'Stari kokošinjac. Za popravak trebam plan: skicirat ću ga na radnom stolu.' : 'Ovdje bi bio dobar bunar, ali treba mi plan. Skicirat ću ga na radnom stolu.';
    case 'coopfull': return 'U kokošinjcu ima mjesta za najviše 9 kokoši.';
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
        else if (e.reason === 'gigbusy') ui.notify('💼 Već radiš jedan posao.', 'err');
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
      case 'foraged': {
        const f = forageById[e.what];
        const what = { wood: `${e.n} drva`, stone: `${e.n} kamena`, hose: `${e.n} m crijeva`, sprinkler: 'cijela prskalica' }[e.item] ?? `${e.n} kg`;
        ui.say(`${f.name[0].toUpperCase()}${f.name.slice(1)}! +${what}.`, 'happy');
        break;
      }
      case 'forage':
        ui.notify(`🍄 U šumi je preko noći niknulo: ${e.n}.`, 'info');
        break;
      case 'laid':
        if (e.n) ui.notify(`🐔 Kokoši su snijele ${e.n} ${e.n === 1 ? 'jaje' : 'jaja'}.`, 'ok');
        if (e.hungry) ui.notify(`🐔 Gladnih kokoši: ${e.hungry}. Stavi plodove u hranilicu.`, 'err');
        break;
      case 'eggs':
        ui.say(`Jaja! +${e.n}`, 'happy');
        break;
      case 'fed':
        ui.say(`Hranilica: +${e.n} kg.`);
        break;
      case 'gigoffers':
        ui.notify(`💼 Novi poslovi: ${e.n}. Pogledaj karticu Poslovi.`, 'info');
        break;
      case 'gigaccepted':
        ui.say('Prihvaćeno. Idem doma za laptop.');
        break;
      case 'gigstart':
        ui.say('Kodiram… 💻');
        break;
      case 'gigpause':
        ui.say('Posao čeka, nastavit ću poslije.');
        break;
      case 'gigdone':
        ui.say(`Gotovo! +${formatMoney(e.pay)}`, 'happy');
        ui.notify(`💼 Plaćeno: ${e.title} · +${formatMoney(e.pay)}`, 'ok');
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
          : e.kind === 'water' ? `Idem zalijevati: ${e.total} ${plots(e.total)}.`
            : e.kind === 'fertilize' ? `Idem gnojiti: ${e.total} ${plots(e.total)}.` : `Idem brati, zrelih: ${e.total}.`);
        break;
      case 'jobcancel':
        jobTally = null;
        ui.say(`Dobro, prekidam ${{ plant: 'sadnju', harvest: 'berbu', water: 'zalijevanje', fertilize: 'gnojenje' }[e.kind]}.`);
        break;
      case 'jobend': {
        const what = `${{ plant: 'Posađeno', harvest: 'Ubrano', water: 'Zaliveno', fertilize: 'Pognojeno' }[e.kind]} ${e.done}`;
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
        ui.notify(`🛒 Kupac je kupio ${e.qty} ${goodById[e.crop].unit}: ${goodById[e.crop].name}${cropById[e.crop] ? ` ${stars(e.tier)}` : ''} · +${formatMoney(e.money)}`, 'ok');
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
          ? `📦 Naručeno: ${shopItemById[e.item].name.toLowerCase()} · ${e.n} ${shopItemById[e.item].unit} (−${formatMoney(e.price)}). Stiže sutra ujutro u škrinju.`
          : `📦 Naručeno: ${e.n}× sjeme, ${cropById[e.crop].name} (−${formatMoney(e.price)}). Stiže sutra ujutro.`);
        break;
      case 'delivered':
        if (e.item === 'hen') ui.notify(`🐔 Stigle su kokoši (${e.n}), već su u kokošinjcu.`, 'ok');
        else ui.notify(e.item ? `📦 Dostava je stigla u škrinju: ${shopItemById[e.item].name.toLowerCase()} · ${e.n} ${shopItemById[e.item].unit}.` : `📦 Dostava je stigla: ${e.n}× sjeme (${name(e.crop)}).`, 'ok');
        break;
      case 'buildstart':
        ui.say({ pump: 'Montiram pumpu na bunar…', coop: 'Popravljam kokošinjac…' }[e.what] ?? 'Plan je tu. Zidam bunar…');
        break;
      case 'buildcancel':
        ui.say('Bunar ću dovršiti drugi put.');
        break;
      case 'built':
        if (e.what === 'coop') {
          ui.say('Kokošinjac je popravljen! Sad još trebaju kokoši.', 'happy');
          ui.notify('🐔 Kokošinjac je popravljen. Kokoši naruči na mobitelu (Dostava), jednu po jednu.', 'ok');
        } else if (e.what === 'pump') {
          ui.say('Pumpa je na bunaru! Sad trebam crijevo i prskalice.', 'happy');
          ui.notify('💧 Pumpa je montirana. Prskalice stavi na križanja parcela (10 m crijeva po prskalici).', 'ok');
        } else {
          ui.say('Bunar je sazidan! Voda je sad blizu.', 'happy');
          ui.notify('🪣 Bunar je sazidan. Za navodnjavanje trebaju pumpa, crijevo i prskalice (Dostava na mobitelu).', 'ok');
        }
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
        ui.say('Prskalica postavljena. water.sh zalijeva svako jutro u 6 h.', 'happy');
        break;
      case 'pickup':
        ui.say(`Prskalica i ${HOSE_PER_SPRINKLER} m crijeva su u torbi.`);
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
  ui.notify('👋 Dobrodošlica na farmu! Klikni bilo gdje na mapi i farmer ode tamo. Klik na parcelu radi ono što farmer drži u ruci (tipke 1–4): ruke beru, sjeme sadi, kanta zalijeva, gnojivo gnoji. ▾ uz svaki alat radi to na svim parcelama ili samo za jednu vrstu. Kotačić miša mijenja zoom.', 'info');
  ui.notify(`🌱 Sjeme se broji: nađi ga na imanju, izvadi iz plodova na radnom stolu ili naruči ovdje, pod "Dostava".`, 'info');
  ui.notify('🌲 Dok usjevi rastu: uz rub šume skupljaj gljive, kupine, drva i kamenje, popravi stari kokošinjac kod kuće, a na mobitelu pod Poslovi uzmi koji honorarac.', 'info');
  ui.notify('🌙 Usjevi rastu preko noći: svako jutro jedan dan ako su dan prije bili zaliveni, pola dana ako nisu. Dovoljno je zaliti jednom dnevno.', 'info');
  ui.notify('🏪 Plodove stavi na štand uz cestu. Bolja kvaliteta, bolja cijena. Od 18 h možeš spavati u kući: tako se igra sprema.', 'info');
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
  const n = ui.state.moveN;
  if (to === 'coop') act((ev) => feedHens(state, slot, ev, n));
  else act((ev) => moveItem(state, from, slot, to, ev, n));
}

// ---- settings, and time passing while the game is not on screen
const settings = (() => { try { return { bgTime: false, ...JSON.parse(storage.get(SETTINGS_KEY) ?? '{}') }; } catch { return { bgTime: false }; } })();
function onSetting(key, value) {
  settings[key] = value;
  storage.set(SETTINGS_KEY, JSON.stringify(settings));
  lastReal = Date.now();
}

let lastReal = Date.now();
function catchUp() {
  const now = Date.now();
  const gap = (now - lastReal) / 1000;
  lastReal = now;
  if (!settings.bgTime || gap < 0.5) return;
  const events = advance(state, Math.min(gap, 3 * 3600), []);
  const sales = events.filter((e) => e.type === 'sale');
  const quiet = new Set(['sale', 'harvest', 'sprinkle', 'water', 'refill', 'shop', 'plant']);
  report(events.filter((e) => !quiet.has(e.type)));
  if (gap >= 60) {
    const earned = sales.reduce((a, e) => a + e.money, 0);
    ui.notify(`⏱ Dok igra nije bila na ekranu (${Math.round(gap / 60)} min): kupaca ${sales.length}, zarada ${formatMoney(earned)}.`, 'info');
  }
  refresh();
}

function onAcceptGig(id) {
  ui.state.panel = null;
  act((ev) => acceptGig(state, id, ev));
}

function onGoWork() {
  ui.state.panel = null;
  act((ev) => goWork(state, ev));
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
  ui.say('Gdje da je stavim? Klikni križanje parcela.');
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

function onOrderItem(id) {
  act((ev) => orderItem(state, id, ev));
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
  const c = renderer.cornerFromClient(e.clientX, e.clientY);
  if (ui.state.placing) {
    // sprinklers go on the crossing of four plots
    ui.state.placing = false;
    ui.state.panel = null;
    act((ev) => command(state, c.x, c.y, 'place', ev));
    return;
  }
  if (c.near && sprinklerAt(state, c.x, c.y) >= 0) {
    ui.state.panel = null;
    act((ev) => command(state, c.x, c.y, 'pickup', ev));
    return;
  }
  const t = renderer.tileFromClient(e.clientX, e.clientY);
  if (!t) return;
  ui.state.panel = null;
  act((ev) => command(state, t[0], t[1], 'auto', ev));
});

canvas.addEventListener('mousemove', (e) => {
  hoverTile = renderer.tileFromClient(e.clientX, e.clientY);
  hoverCorner = renderer.cornerFromClient(e.clientX, e.clientY);
  renderer.setHover(hoverTile);
  renderer.setCorner(hoverCorner);
});
canvas.addEventListener('mouseleave', () => {
  hoverTile = null;
  hoverCorner = null;
  renderer.setHover(null);
  renderer.setCorner(null);
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
  else if (e.key === 'g' || e.key === 'G') onJob('fertilize');
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
  ui.update(state, hoverTile, { canIn: renderer.canZoom(1), canOut: renderer.canZoom(-1) }, hoverCorner);
}

function frame(now) {
  // time only runs while the tab is visible; long gaps (sleeping laptop) are capped
  const dt = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  if (!document.hidden && Date.now() - lastReal > 1500) catchUp();
  lastReal = Date.now();
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
  else catchUp();
  lastFrame = performance.now();
});
setInterval(() => { if (document.hidden) catchUp(); }, 5000);
window.addEventListener('pagehide', save);

if (loaded.restored) ui.notify(`👋 Dan ${state.day}: farma je tu gdje je i bila.`, 'info');
else intro();
ui.setSettings(settings);
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
