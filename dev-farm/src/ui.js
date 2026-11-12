// DOM side of the game: HUD, hotbar, seed pouch, bag, building panels, the phone,
// the farmer's speech bubble, the inspector line and the tab title.

import {
  CROPS, RECIPES, MAX_ENERGY, COFFEE, EAT_ENERGY, TIER_NAMES, SHOP_OPEN, SHOP_CLOSE, ROT_DAY,
  SEEDS_FROM_FRUIT, SEED_PACK, WELL_BUILD, zl, SLEEP_FROM, COOP, SHOP_ITEMS, HOSE_PER_SPRINKLER, BUILDINGS, MARKET,
  COMPOST_KG, FERT_DOSES, DECOR, PETS, REQUESTS, HIVES,
} from './data.js';
import {
  parseItem, isUnlocked, canSize, countWhere, canCraft, salePrice, isSellable, cropById,
  plotUnlocked, qualityScore, tierOf, ripeCount, shopOpen, packPrice, findAt, jobTargets,
  totalSeeds, sprinklerReach, irrigationCost, daysLeft, goodById, forageAt, forageById, matCount,
  IRRIGATION_LEVELS, irrigationMissing, fishById, fertDoses, requestHave, requestPay, dayName, dayNameGen,
  buybackList, hiveAt, decorAt, farmerTripProblem, vanTripProblem, pumpStatus, orderPack, shopItemById,
} from './sim.js';
import { idx, objectAt, isPlotTile, OBJECTS } from './world.js';
import { iconUrl } from './render.js';
import { guideTopics, searchGuide } from './guide.js';

const numberFormat = new Intl.NumberFormat('hr-HR');
// srebrenjaci → "3 zl 50 sr" (1 zlatnik = 100 srebrenjaka)
export function formatMoney(sr) {
  const gold = Math.floor(sr / 100);
  const silver = Math.round(sr % 100);
  if (!gold) return `${silver} sr`;
  return silver ? `${numberFormat.format(gold)} zl ${silver} sr` : `${numberFormat.format(gold)} zl`;
}
// 3.4 → "3,4"
export const kgText = (kg) => new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 1 }).format(kg);
export const days = (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'dan' : 'dana'}`;
export const stars = (tier) => '★'.repeat(tier);

// Croatian plural: 1 parcela, 2–4 parcele, 5+ parcela (11–14 count as many)
export function plots(n) {
  const m10 = n % 10;
  const m100 = n % 100;
  return m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'parcele' : 'parcela';
}

export function formatClock(clock) {
  const m = Math.floor(clock) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// produce with a quality (crops and fish), as opposed to forage and eggs
const tiered = (good) => Boolean(cropById[good] || fishById[good]);

export function itemName(id) {
  const p = parseItem(id);
  if (!p) return id;
  if (p.kind === 'fertilizer') return `Gnojivo ${stars(p.tier)}`;
  if (p.kind === 'mulch') return 'Malč';
  if (p.kind === 'hive') return 'Košnica';
  if (p.kind === 'deco') return DECOR[p.deco].name;
  if (p.kind === 'sprinkler') return 'Prskalica (water.sh)';
  if (p.kind === 'wood') return 'Drva';
  if (p.kind === 'hose') return 'Crijevo';
  if (p.kind === 'pump') return 'Vodena pumpa';
  if (p.kind === 'stone') return 'Kamenje';
  return tiered(p.crop) ? `${goodById[p.crop].name} ${stars(p.tier)}` : goodById[p.crop].name;
}

// "kg" for produce sold by weight, "kom" for pieces
export const unitOf = (id) => {
  const p = parseItem(id);
  return p?.kind === 'crop' ? goodById[p.crop].unit : p?.kind === 'hose' ? 'm' : p?.kind === 'fertilizer' || p?.kind === 'mulch' ? 'doza' : 'kom';
};

// the icon of an item: produce by its crop, decorations by their kind
const iconName = (p) => (p.kind === 'crop' ? p.crop : p.kind === 'deco' ? `deco:${p.deco}` : p.kind);
const itemIcon = (id) => iconUrl(iconName(parseItem(id)));

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

const icon = (name, cls = 'px-icon') => {
  const img = new Image();
  img.src = iconUrl(name);
  img.alt = '';
  img.className = cls;
  return img;
};

const button = (label, onClick, { disabled = false, cls = 'btn', title = '' } = {}) => {
  const b = el('button', cls, label);
  b.type = 'button';
  b.disabled = disabled;
  if (title) b.title = title;
  b.addEventListener('click', onClick);
  return b;
};

function slotButton(it, onClick, { label = '' } = {}) {
  const b = el('button', 'slot');
  b.type = 'button';
  if (!it) {
    b.classList.add('empty');
    b.disabled = !onClick;
    b.setAttribute('aria-label', 'prazno');
  } else {
    const p = parseItem(it.id);
    b.append(icon(iconName(p), ''), el('span', 'count', String(it.n)));
    if ((p.kind === 'crop' && tiered(p.crop)) || p.kind === 'fertilizer') b.append(el('span', `tier tier-${p.tier}`, stars(p.tier)));
    b.title = `${itemName(it.id)} · ${it.n} ${unitOf(it.id)}${label ? ` · ${label}` : ''}`;
    b.setAttribute('aria-label', b.title);
  }
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

// 0 → '', 7 → '7', 150 → '99+'
const badgeText = (n) => (!n ? '' : n > 99 ? '99+' : String(n));

// Rebuild an element only when its content signature changed (keeps clicks reliable).
function renderIfChanged(node, sig, build) {
  if (node.dataset.sig === sig) return;
  node.dataset.sig = sig;
  node.replaceChildren(...build());
  coinify(node);
}

// Prices are shown with coins instead of "zl" and "sr": "3 zl 50 sr" → 3 (gold coin) 50 (silver coin).
// Works on any finished piece of DOM, so every text that mentions money gets coins.
const MONEY = /(\d[\d.]*) (zl|sr)(?![\p{L}\d])/gu;
const coinImg = (kind) => {
  const img = new Image();
  img.src = iconUrl(kind === 'zl' ? 'gold' : 'silver');
  img.alt = kind;
  img.className = 'coin-i';
  return img;
};
export function coinify(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    MONEY.lastIndex = 0;
    if (MONEY.test(n.nodeValue) && !n.parentElement?.closest('input, textarea, .no-coins')) hits.push(n);
  }
  for (const n of hits) {
    const frag = document.createDocumentFragment();
    const text = n.nodeValue;
    let at = 0;
    MONEY.lastIndex = 0;
    for (let m = MONEY.exec(text); m; m = MONEY.exec(text)) {
      if (m.index > at) frag.append(text.slice(at, m.index));
      const span = document.createElement('span');
      span.className = 'money';
      span.append(m[1], coinImg(m[2]));
      frag.append(span);
      at = m.index + m[0].length;
    }
    if (at < text.length) frag.append(text.slice(at));
    n.replaceWith(frag);
  }
}

export function createUI(cb) {
  const $ = (id) => document.getElementById(id);
  const els = {
    day: $('hud-day'), clock: $('hud-clock'), shop: $('hud-shop'), money: $('hud-money'), gold: $('hud-gold'), silver: $('hud-silver'),
    energyBar: $('hud-energy-bar'), energy: $('hud-energy'), hotbar: $('hotbar'), seeds: $('seeds'),
    panel: $('panel'), bag: $('bag'), bagInfo: $('bag-info'), inspect: $('inspect'),
    bubble: $('bubble'), feed: $('phone-feed'), shopTab: $('phone-shop'), phoneTime: $('phone-time'),
    badge: $('phone-badge'), zoomIn: $('zoom-in'), zoomOut: $('zoom-out'), gigsTab: $('phone-gigs'), gigBadge: $('gig-badge'),
    trip: $('hud-trip'),
    bagCard: $('bag-card'), bagBtn: $('bag-btn'), phone: $('phone'), phoneBtn: $('phone-btn'), phoneBtnBadge: $('phone-btn-badge'),
    toasts: $('toasts'), guideTab: $('phone-guide'), guideList: $('guide-list'), guideSearch: $('guide-search'),
  };
  els.trip.addEventListener('click', () => cb.onComeBack());
  const ui = {
    panel: null, selected: -1, placing: false, phoneTab: 'feed', unread: 0, clock: 360, moveN: 1,
    bagOpen: false, phoneOpen: false, // the bag and the phone float over the map when open
  };
  // buildings where the bag is needed next to the panel (moving things, seeds from fruit)
  const BAG_PANELS = new Set(['chest', 'stand', 'coop', 'market', 'workbench']);
  const bagShown = () => ui.bagOpen || BAG_PANELS.has(ui.panel);
  function toggle(which, open) {
    const key = which === 'bag' ? 'bagOpen' : 'phoneOpen';
    if (which === 'bag' && open === undefined && !ui.bagOpen && bagShown()) {
      // the bag is already shown next to a building: the button closes the building instead
      ui.panel = null;
    } else {
      ui[key] = open ?? !ui[key];
    }
    cb.onChange();
  }
  $('bag-btn-icon').src = iconUrl('bag');
  $('phone-btn-icon').src = iconUrl('phone');
  els.bagBtn.addEventListener('click', () => toggle('bag'));
  els.phoneBtn.addEventListener('click', () => toggle('phone'));
  $('bag-close').addEventListener('click', () => { ui.bagOpen = false; if (BAG_PANELS.has(ui.panel)) ui.panel = null; cb.onChange(); });
  $('phone-close').addEventListener('click', () => toggle('phone', false));

  // ---- the handbook (phone → Priručnik)
  const topics = guideTopics();
  const openTopics = new Set();
  function guideList(query) {
    const found = searchGuide(query, topics);
    renderIfChanged(els.guideList, JSON.stringify([query, [...openTopics]]), () => {
      if (!found.length) return [el('p', 'guide-empty', `Ništa za „${query}“. Probaj drugu riječ.`)];
      return found.map((t, k) => {
        const d = el('details', 'guide-topic');
        // a search opens the best match; otherwise topics stay as the player left them
        d.open = openTopics.has(t.id) || (query.trim() !== '' && k === 0);
        d.append(el('summary', '', `${t.icon} ${t.title}`));
        for (const b of t.body) {
          if (typeof b === 'string') d.append(el('p', '', b));
          else {
            const ul = el('ul');
            for (const line of b.list) ul.append(el('li', '', line));
            d.append(ul);
          }
        }
        d.addEventListener('toggle', () => { if (d.open) openTopics.add(t.id); else openTopics.delete(t.id); });
        return d;
      });
    });
  }
  els.guideSearch.addEventListener('input', () => guideList(els.guideSearch.value));
  // open the handbook at a topic, e.g. from what the farmer says
  function openGuide(id) {
    ui.phoneOpen = true;
    ui.phoneTab = 'guide';
    els.guideSearch.value = '';
    openTopics.clear();
    openTopics.add(id);
    cb.onChange();
    guideList('');
    els.guideList.querySelector('details[open]')?.scrollIntoView({ block: 'nearest' });
  }

  // ---- hotbar
  const tools = [
    { id: 'hand', key: '1', icon: 'hand', name: 'Ruke' },
    { id: 'seed', key: '2', icon: 'seeds', name: 'Sjeme' },
    { id: 'can', key: '3', icon: 'can', name: 'Kanta' },
    { id: 'fert', key: '4', icon: 'fertilizer', name: 'Gnojivo' },
    { id: 'rod', key: '5', icon: 'rod', name: 'Pecaljka' }, // shown once it is made
    { id: 'mulch', key: '6', icon: 'mulch', name: 'Malč' }, // shown when there is mulch in the bag
  ];
  // Seeds and the can are split buttons: the tool itself works plant by plant,
  // the ▾ next to it runs the bulk job (everything, or one kind of crop).
  const SPLIT = { hand: 'harvest', seed: 'plant', can: 'water', fert: 'fertilize', mulch: 'mulch' };
  const toolEls = new Map();
  const moreBtns = new Map();
  for (const t of tools) {
    const b = button('', () => cb.onTool(t.id), { cls: 'tool' });
    b.append(el('kbd', '', t.key), icon(t.icon, 'tool-icon'), el('span', 'tool-name', t.name), el('span', 'tool-sub'));
    const kind = SPLIT[t.id];
    if (kind) {
      const wrap = el('div', 'tool-split');
      const more = button('▾', () => (lastState?.farmer.job?.kind === kind ? cb.onJob(kind) : openMenu(kind, wrap)), { cls: 'tool-more bulk' });
      wrap.append(b, more);
      els.hotbar.append(wrap);
      moreBtns.set(kind, { more, tool: t.id });
    } else {
      els.hotbar.append(b);
    }
    toolEls.set(t.id, { b, sub: b.querySelector('.tool-sub') });
  }

  // bulk jobs: each button opens a menu — everything, or one kind of crop
  const jobs = [
    { kind: 'plant', key: 'P', icon: 'seeds', name: 'Posadi', all: 'Sve sjeme' },
    { kind: 'harvest', key: 'B', icon: 'hand', name: 'Poberi', all: 'Sve zrelo' },
    { kind: 'fertilize', key: 'G', icon: 'fertilizer', name: 'Pognoji', all: 'Sve posađeno' },
    { kind: 'water', key: 'Z', icon: 'can', name: 'Zalij', all: 'Sve posađeno' },
    { kind: 'mulch', key: '6', icon: 'mulch', name: 'Malčiraj', all: 'Sve posađeno' },
  ];
  const jobEls = new Map();
  let lastState = null;
  const menu = el('div', 'job-menu');
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  document.body.append(menu);
  const closeMenu = () => { menu.hidden = true; menu.dataset.kind = ''; };
  function openMenu(kind, anchor) {
    const s = lastState;
    if (!s) return;
    if (menu.dataset.kind === kind && !menu.hidden) { closeMenu(); return; }
    const j = jobs.find((x) => x.kind === kind);
    const count = (crop) => jobTargets(s, kind, crop).length;
    const options = [{ crop: null, label: j.all, n: count(null) }];
    for (const c of CROPS) {
      const n = count(c.id);
      if (n > 0 || (kind === 'plant' && s.seeds[c.id] > 0)) options.push({ crop: c.id, label: c.name, n });
    }
    const unit = { harvest: 'zrelih', water: 'suhih', fertilize: 'za gnojivo', plant: 'parcela', mulch: 'bez malča' }[kind];
    menu.replaceChildren(el('div', 'job-menu-title', `${j.name} sve…`), ...options.map((o) => {
      const b = button('', () => { closeMenu(); cb.onJob(kind, o.crop); }, { cls: 'job-option', disabled: o.n === 0 });
      if (o.crop) b.append(icon(o.crop, 'px-icon small-icon'));
      b.append(el('span', 'grow', o.label), el('span', 'muted', `${o.n} ${unit}`));
      b.setAttribute('role', 'menuitem');
      return b;
    }));
    menu.dataset.kind = kind;
    menu.hidden = false;
    const r = anchor.getBoundingClientRect();
    menu.style.left = `${r.left + window.scrollX}px`;
    menu.style.top = `${r.top + window.scrollY - menu.offsetHeight - 6}px`;
  }
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && !e.target.closest('.bulk')) closeMenu();
  });
  for (const j of jobs) jobEls.set(j.kind, { b: moreBtns.get(j.kind).more, j, tool: moreBtns.get(j.kind).tool });

  for (const [id, kind] of [['hud-gold-icon', 'gold'], ['hud-silver-icon', 'silver']]) $(id).src = iconUrl(kind);

  $('reset').addEventListener('click', cb.onReset);
  const settingsBox = $('settings');
  $('settings-btn').addEventListener('click', () => { settingsBox.hidden = !settingsBox.hidden; });
  document.addEventListener('click', (e) => {
    if (!settingsBox.hidden && !e.target.closest('.settings-wrap')) settingsBox.hidden = true;
  });
  $('set-bgtime').addEventListener('change', (e) => cb.onSetting('bgTime', e.target.checked));
  $('set-notify').addEventListener('change', (e) => cb.onNotifySetting(e.target.checked));

  els.zoomIn.addEventListener('click', () => cb.onZoom(1));
  els.zoomOut.addEventListener('click', () => cb.onZoom(-1));
  for (const tab of document.querySelectorAll('.phone-tabs button')) {
    tab.addEventListener('click', () => {
      ui.phoneTab = tab.dataset.tab;
      cb.onChange();
    });
  }

  const setText = (node, text) => {
    if (node.dataset.raw === text) return;
    node.dataset.raw = text;
    node.textContent = text;
    coinify(node);
  };

  function hud(s) {
    setText(els.day, `Dan ${s.day} · ${dayName(s.day).slice(0, 3)}`);
    const night = s.clock >= 20 * 60 || s.clock < 6 * 60;
    setText(els.clock, `${formatClock(s.clock)} ${night ? '🌙' : s.weather === 'rain' ? '🌧️' : '☀️'}`);
    els.clock.title = `Danas: ${s.weather === 'rain' ? 'kiša (sve je zaliveno)' : 'sunčano'}. Sutra: ${s.tomorrow === 'rain' ? 'kiša' : 'sunčano'}.`;
    setText(els.shop, shopOpen(s.clock) ? '🏪 otvoreno' : `🏪 ${formatClock(SHOP_OPEN).slice(0, 2)}–${formatClock(SHOP_CLOSE).slice(0, 2)} h`);
    els.shop.title = shopOpen(s.clock) ? 'Štand je otvoren' : `Štand radi od ${formatClock(SHOP_OPEN)} do ${formatClock(SHOP_CLOSE)}`;
    setText(els.gold, numberFormat.format(Math.floor(s.money / 100)));
    setText(els.silver, String(Math.round(s.money % 100)));
    els.money.title = formatMoney(s.money);
    const pct = Math.round((s.energy / MAX_ENERGY) * 100);
    els.energyBar.style.width = `${pct}%`;
    els.energyBar.classList.toggle('low', pct < 20);
    setText(els.energy, `${Math.floor(s.energy)}/${MAX_ENERGY}`);

    // who is on the way to / at / back from the town market
    const { farmer: tf, van: tv } = s.market.trips;
    const tripText = (t) => (t.phase === 'go' ? 'putuje u grad'
      : t.phase === 'sell' ? (s.clock < MARKET.open ? 'čeka otvaranje tržnice' : `na tržnici · ${t.kg} kg · ${formatMoney(t.money)}`)
        : `se vraća · ${t.kg} kg · ${formatMoney(t.money)}`);
    els.trip.hidden = !tf && !tv;
    setText(els.trip, [tf && `🧺 Farmer ${tripText(tf)}${tf.phase !== 'back' ? ' · ↩' : ''}`, tv && `🚐 ${MARKET.worker} ${tripText(tv)}`].filter(Boolean).join('  ·  '));
    els.trip.disabled = !tf || tf.phase === 'back';
    els.trip.title = tf && tf.phase !== 'back' ? 'Klik: farmer spakira robu i vrati se kući' : 'Kombi se vraća oko 14 h';

    for (const t of tools) {
      const { b, sub } = toolEls.get(t.id);
      b.classList.toggle('selected', s.tool === t.id && !ui.placing);
      const mulchDoses = countWhere(s.bag, (id) => id === 'mulch');
      const hide = (t.id === 'rod' && !s.upgrades.rod) || (t.id === 'mulch' && !mulchDoses && s.tool !== 'mulch');
      (b.parentElement.classList.contains('tool-split') ? b.parentElement : b).hidden = hide;
      const fishing = s.farmer.busy?.what === 'fish' ? s.farmer.busy : null;
      const text = t.id === 'rod' ? `${fishing ? 'peca… ' : ''}ulov danas: ${s.pond.caught}`
        : t.id === 'mulch' ? `${mulchDoses} doza`
        : t.id === 'seed' ? `${cropById[s.seed].name} × ${s.seeds[s.seed]}`
        : t.id === 'can' ? `💧 ${s.water}/${canSize(s)}`
          : t.id === 'fert' ? fertSub(s) : `zrelih: ${jobTargets(s, 'harvest').length}`;
      setText(sub, text);
    }

    lastState = s;
    const running = s.farmer.job;
    for (const [kind, { b, j, tool }] of jobEls) {
      const mine = running?.kind === kind;
      const n = jobTargets(s, kind).length;
      b.classList.toggle('running', mine);
      b.disabled = !mine && (Boolean(running) || n === 0);
      {
        // the ▾ next to each tool: ■ stops the running bulk job
        const verb = {
          plant: { stop: 'sadnju', do: 'Posadi', what: `parcela za sadnju: ${n}`, none: 'Nema sjemena ili slobodnih parcela', ing: 'sadi' },
          water: { stop: 'zalijevanje', do: 'Zalij', what: `suhih: ${n}`, none: 'Ništa nije suho', ing: 'zalijeva' },
          harvest: { stop: 'berbu', do: 'Poberi', what: `zrelih: ${n}`, none: 'Ništa nije zrelo', ing: 'bere' },
          fertilize: { stop: 'gnojenje', do: 'Pognoji', what: `za gnojivo: ${n}`, none: 'Nema gnojiva ili nepognojenih biljaka', ing: 'gnoji' },
          mulch: { stop: 'malčiranje', do: 'Malčiraj', what: `bez malča: ${n}`, none: 'Nema malča ili parcela bez malča', ing: 'malčira' },
        }[kind];
        setText(b, mine ? '■' : '▾');
        b.title = mine ? `Prekini ${verb.stop} (Esc)` : n ? `${verb.do} sve ili jednu vrstu · ${verb.what} (${j.key})` : verb.none;
        b.parentElement.classList.toggle('running', mine);
        if (mine) setText(toolEls.get(tool).sub, `${verb.ing} ${running.done}/${running.total}`);
      }
    }
    if (running && !menu.hidden) closeMenu();
  }

  // the fertilizer tool: how many doses, and the best quality (it is used first)
  function fertSub(s) {
    const doses = fertDoses(s);
    if (!doses) return 'nema gnojiva';
    const best = Math.max(...s.bag.filter((it) => it && parseItem(it.id).kind === 'fertilizer').map((it) => parseItem(it.id).tier));
    return `${stars(best)} · ${doses} ${doses === 1 ? 'doza' : doses % 10 >= 2 && doses % 10 <= 4 && (doses % 100 < 12 || doses % 100 > 14) ? 'doze' : 'doza'}`;
  }

  // ---- seed pouch: only what you actually have, with counts
  function pouch(s) {
    const owned = CROPS.filter((c) => s.seeds[c.id] > 0 || c.id === s.seed);
    const sig = JSON.stringify([s.seeds, s.seed]);
    renderIfChanged(els.seeds, sig, () => {
      if (!Object.values(s.seeds).some((n) => n > 0)) {
        return [el('span', 'pouch-empty', 'Vrećica sa sjemenom je prazna. Potraži ga po imanju ili naruči dostavu na mobitelu.')];
      }
      return owned.map((c) => {
        const n = s.seeds[c.id];
        const b = button('', () => cb.onSeed(c.id), { cls: 'seed', disabled: n <= 0 });
        b.classList.toggle('selected', s.seed === c.id);
        b.title = `${c.name}: ${n} ${n === 1 ? 'sjemenka' : 'sjemenki'} · raste ${days(c.days)} · ${c.yield} kg po parceli`;
        b.append(icon(c.id, ''), el('span', 'seed-name', c.name), el('span', 'seed-count', `× ${n}`));
        return b;
      });
    });
  }

  // ---- bag
  function bag(s) {
    const loading = ui.panel === 'market' && s.market.van && !s.market.trips.van; // loading the van
    const transfer = ui.panel === 'chest' || ui.panel === 'stand' || ui.panel === 'coop' || loading;
    const sig = JSON.stringify([s.bag, ui.selected, ui.panel, loading]);
    renderIfChanged(els.bag, sig, () => s.bag.map((it, i) => {
      const b = slotButton(it, it ? () => (transfer ? cb.onMove('bag', i, ui.panel) : select(i)) : null);
      if (i === ui.selected) b.classList.add('selected');
      if (((ui.panel === 'stand' || loading) && it && !isSellable(it.id)) || (ui.panel === 'coop' && it && (parseItem(it.id).kind !== 'crop' || parseItem(it.id).crop === 'egg'))) b.classList.add('dim');
      return b;
    }));

    const it = s.bag[ui.selected];
    const infoSig = JSON.stringify([it, ui.panel, s.energy >= MAX_ENERGY, ui.moveN, loading]);
    const amount = () => {
      const row = el('div', 'amount');
      row.append(el('span', 'small muted', 'Klik prebacuje:'));
      for (const [n, label] of [[1, 'po 1'], [5, 'po 5'], [Infinity, 'sve']]) {
        const b = button(label, () => { ui.moveN = n; cb.onChange(); }, { cls: `btn${ui.moveN === n ? ' on' : ''}` });
        row.append(b);
      }
      return row;
    };
    renderIfChanged(els.bagInfo, infoSig, () => {
      if (ui.panel === 'chest') return [amount(), el('p', 'muted', 'Klik na stvar u torbi spremi je u škrinju, klik u škrinji vrati je u torbu.')];
      if (ui.panel === 'stand') return [amount(), el('p', 'muted', 'Klik na plod u torbi stavi ga na štand.')];
      if (ui.panel === 'coop') return [amount(), el('p', 'muted', 'Klik na plod u torbi stavi ga u hranilicu. Najbolje za to je škart (★).')];
      if (loading) return [amount(), el('p', 'muted', 'Klik na plod u torbi utovari ga u kombi.')];
      if (!it) return [el('p', 'muted', 'Klikni stvar u torbi za detalje.')];
      const p = parseItem(it.id);
      const unit = unitOf(it.id);
      const out = [el('p', 'item-title', `${itemName(it.id)} · ${it.n} ${unit}`)];
      const row = el('div', 'row');
      if (p.kind === 'wood' || p.kind === 'stone') {
        out.push(el('p', 'muted', 'Materijal za radni stol: kokošinjac, bunar i drugo.'));
      } else if (p.kind === 'crop') {
        const tier = tiered(p.crop) ? `${TIER_NAMES[p.tier]} · ` : '';
        out.push(el('p', 'muted', `${tier}na štandu ${formatMoney(salePrice(p.crop, p.tier))}/${unit}${p.tier === 1 ? ', i to samo kad nema boljeg' : ''}`));
        row.append(button(`Pojedi (+${EAT_ENERGY[p.tier]} ⚡)`, () => cb.onEat(ui.selected), { disabled: s.energy >= MAX_ENERGY }));
        if (ui.panel === 'workbench' && cropById[p.crop]) row.append(button(`Izvadi sjeme (${SEEDS_FROM_FRUIT[0]}–${SEEDS_FROM_FRUIT[1]})`, () => cb.onExtract(ui.selected)));
      } else if (p.kind === 'sprinkler') {
        out.push(el('p', 'muted', `Stoji na križanju parcela i troši ${HOSE_PER_SPRINKLER} m crijeva. Radi s pumpom na bunaru.`));
        row.append(button('Postavi na križanje', () => cb.onPlace()));
      } else if (p.kind === 'hose') {
        out.push(el('p', 'muted', `Svaka prskalica treba ${HOSE_PER_SPRINKLER} m crijeva.`));
      } else if (p.kind === 'pump') {
        out.push(el('p', 'muted', s.upgrades.well ? 'Klikni bunar: farmer će je montirati.' : 'Ide na bunar, a bunar se prvo mora sazidati.'));
      } else if (p.kind === 'mulch') {
        out.push(el('p', 'muted', 'Malčirana zemlja ostaje vlažna dva dana: dovoljno je zalijevati svaki drugi dan. Jedna doza = jedna parcela, a malč ostaje do berbe.'));
        row.append(button('Uzmi u ruku (6)', () => cb.onTool('mulch')));
      } else if (p.kind === 'hive' || p.kind === 'deco') {
        const d = p.kind === 'deco' ? DECOR[p.deco] : null;
        out.push(el('p', 'muted', p.kind === 'hive' ? `Ide na travu. Svaki drugi dan 1 kg meda (najviše ${HIVES.cap} kg), najviše ${HIVES.max} košnica.` : d.block ? 'Ide na travu i zaprečuje prolaz (ne smije zatvoriti put).' : 'Ide na travu; preko njega se može hodati.'));
        row.append(button('Postavi na travu', () => cb.onPlaceItem(it.id)));
      } else if (p.kind === 'fertilizer') {
        out.push(el('p', 'muted', `Jedna doza pognoji jednu parcelu; vreća ima ${FERT_DOSES} doza. ${p.tier === 3 ? 'Samo ovo gnojivo može dati plod ★★★★★.' : 'Za plod ★★★★★ treba ★★★ gnojivo (kompost od I. klase ili boljeg).'}`));
        row.append(button('Uzmi u ruku (4)', () => cb.onTool('fert')));
      }
      out.push(row);
      return out;
    });
  }

  function select(i) {
    ui.selected = ui.selected === i ? -1 : i;
    cb.onChange();
  }

  // ---- building panels
  function panel(s) {
    els.panel.hidden = !ui.panel; // only shown when a building is open
    if (!ui.panel) return;
    const head = () => {
      const h = el('div', 'panel-head');
      h.append(el('h2', '', OBJECTS[ui.panel].name), button('✕', cb.onClosePanel, { cls: 'close', title: 'Zatvori (Esc)' }));
      return h;
    };

    if (ui.panel === 'house') {
      const canSleep = s.clock >= SLEEP_FROM;
      const gig = s.gigs.active;
      const sig = JSON.stringify(['house', s.money >= zl(COFFEE.price), s.energy >= MAX_ENERGY, canSleep, gig?.title, Boolean(s.farmer.busy)]);
      renderIfChanged(els.panel, sig, () => [
        head(),
        ...(gig && !s.farmer.busy ? [button(`💻 Nastavi posao: ${gig.title}`, cb.onGoWork, { cls: 'btn' })] : []),
        el('p', 'muted', 'Spavanjem završavaš dan i spremaš igru. Usjevi rastu preko noći, a zreli te strpljivo čekaju. Ujutro stiže naručena dostava.'),
        button(canSleep ? 'Spavaj do 06:00 i spremi' : `Spava se od ${formatClock(SLEEP_FROM)}`, cb.onSleep, { cls: 'btn primary', disabled: !canSleep }),
        button(`Skuhaj kavu · ${formatMoney(zl(COFFEE.price))} · +${COFFEE.energy} ⚡`, cb.onCoffee, {
          disabled: s.money < zl(COFFEE.price) || s.energy >= MAX_ENERGY,
        }),
      ]);
    } else if (ui.panel === 'coop') {
      const c = s.coop;
      renderIfChanged(els.panel, JSON.stringify(['coop', c]), () => [
        head(),
        el('p', '', `🐔 Kokoši: ${c.hens}/${COOP.maxHens} · 🥚 čeka: ${c.eggs}`),
        ...(c.hens ? [] : [el('p', 'small', 'Kokošinjac je prazan. Kokoši se naručuju na mobitelu (Dostava → Kokoš nesilica), jedna po jedna.')]),
        (() => {
          const daily = c.hens * COOP.feedPerHen;
          const left = daily ? Math.floor(c.feed / daily + 1e-9) : 0;
          return el('p', '', `Hranilica: ${kgText(c.feed)} kg${!c.hens ? '' : left < 1 ? ' · premalo za sutra!' : ` · dosta za ${days(left)}`}`);
        })(),
        el('p', 'muted small', `Kokoš pojede oko ${COOP.feedPerHen * 1000} g na dan: 1 kg ploda nahrani ${Math.round(1 / COOP.feedPerHen)} kokoši. Svaka nahranjena kokoš ujutro snese jaje. Jaja se skupe klikom na kokošinjac. Hranilica drži najviše ${COOP.feedCap} kg.`),
      ]);
    } else if (ui.panel === 'chest') {
      renderIfChanged(els.panel, JSON.stringify(['chest', s.chest, s.upgrades.coldroom]), () => {
        const grid = el('div', 'slots chest');
        s.chest.forEach((it, i) => grid.append(slotButton(it, it ? () => cb.onMove('chest', i, 'bag') : null)));
        return [head(), el('p', 'muted', 'Klik na stvar u škrinji vrati je u torbu.'), grid,
          el('p', 'small muted', s.upgrades.coldroom ? '❄️ Hladnjača: plodovi u njoj ne gube kvalitetu.' : 'Plodovi u škrinji polako gube kvalitetu (klasu na otprilike svako drugo jutro). Hladnjača s radnog stola ih čuva.')];
      });
    } else if (ui.panel === 'stand') {
      const reqSig = s.requests.map((r) => [r.id, requestHave(s, r)]);
      renderIfChanged(els.panel, JSON.stringify(['stand', s.stand, shopOpen(s.clock), reqSig, s.day]), () => {
        const grid = el('div', 'slots');
        s.stand.forEach((it, i) => {
          const p = it && parseItem(it.id);
          grid.append(slotButton(it, it ? () => cb.onMove('stand', i, 'bag') : null, { label: p ? `${formatMoney(salePrice(p.crop, p.tier))}/${unitOf(it.id)}` : '' }));
        });
        return [
          head(),
          el('p', 'muted', `Kupci dolaze ${formatClock(SHOP_OPEN)}–${formatClock(SHOP_CLOSE)} i uvijek uzmu najbolje što vide. Cijena ovisi o kvaliteti: ★ ide za pola cijene i samo kad nema boljeg.`),
          grid,
          el('p', 'muted small', shopOpen(s.clock) ? 'Štand je otvoren.' : 'Štand je sada zatvoren.'),
          ...requestCards(s),
        ];
      });
    } else if (ui.panel === 'market') {
      marketPanel(s, head);
    } else if (ui.panel === 'workbench') {
      const fruits = s.bag.map((it, i) => [it, i]).filter(([it]) => it && parseItem(it.id).kind === 'crop' && cropById[parseItem(it.id).crop]);
      const pending = Object.entries(BUILDINGS).filter(([id, b]) => s.upgrades[b.plan] && !(id === 'coop' ? s.coop.built : s.upgrades[id]));
      const have = [Math.floor(s.money / 100), matCount(s, 'wood'), matCount(s, 'stone'), Math.floor(s.energy)];
      const sig = JSON.stringify(['wb', RECIPES.map((r) => canCraft(s, r.id)), fruits, pending.map(([id]) => id), have]);
      renderIfChanged(els.panel, sig, () => {
        const list = el('div', 'recipes');
        // plans already sketched: what the build needs and what is still missing
        for (const [id, b] of pending) {
          const card = el('div', 'recipe');
          const top = el('div', 'recipe-head');
          top.append(el('code', '', `${b.name} · plan je gotov`), el('span', 'muted', id === 'well' ? 'gradilište kod kuće' : 'stari kokošinjac'));
          const parts = el('ul', 'parts');
          for (const [ok, text] of [
            [s.money >= zl(b.price), `novac: ${formatMoney(zl(b.price))} (imaš ${formatMoney(s.money)})`],
            [matCount(s, 'wood') >= b.wood, `drva: ${b.wood} u torbi (imaš ${matCount(s, 'wood')})`],
            [matCount(s, 'stone') >= b.stone, `kamen: ${b.stone} u torbi (imaš ${matCount(s, 'stone')})`],
            [s.energy >= b.energy, `snaga: ${b.energy} ⚡ (imaš ${Math.floor(s.energy)})`],
          ]) parts.append(el('li', ok ? 'ok' : '', `${ok ? '✔' : '○'} ${text}`));
          card.append(top, parts, el('p', 'small muted', 'Plaća se tek kad je gradnja gotova. Klikni gradilište na mapi i farmer počne.'));
          list.append(card);
        }
        const seedBox = el('div', 'recipe');
        seedBox.append(el('div', 'recipe-head'));
        seedBox.firstChild.append(el('code', '', 'Sjeme i kompost iz plodova'));
        seedBox.append(
          el('p', 'small', `Sjeme: 1 plod → ${SEEDS_FROM_FRUIT[0]}–${SEEDS_FROM_FRUIT[1]} sjemenki.`),
          el('p', 'small', `Kompost: ${COMPOST_KG} kg ploda → vreća gnojiva (${FERT_DOSES} doza) iste kvalitete, najviše ★★★.`),
          el('p', 'small', 'Samo ★★★ gnojivo daje plod ★★★★★.'),
        );
        if (!fruits.length) seedBox.append(el('p', 'small muted', 'Nemaš plodova u torbi. Neprodani plod je najbolji izvor sjemena i komposta.'));
        for (const [it, i] of fruits) {
          const row = el('div', 'row fruit-row');
          const ct = Math.min(3, parseItem(it.id).tier);
          row.append(icon(parseItem(it.id).crop), el('span', 'small', `${itemName(it.id)} × ${it.n}`), button('Sjeme', () => cb.onExtract(i), { title: `1 plod → ${SEEDS_FROM_FRUIT[0]}–${SEEDS_FROM_FRUIT[1]} sjemenki` }),
            button(`Kompost ${stars(ct)}`, () => cb.onCompost(i), { disabled: it.n < COMPOST_KG, title: it.n < COMPOST_KG ? `Za kompost treba ${COMPOST_KG} kg` : `${COMPOST_KG} kg → vreća gnojiva ${stars(ct)} (${FERT_DOSES} doza)` }));
          seedBox.append(row);
        }
        list.append(seedBox);
        for (const r of RECIPES) {
          const problem = canCraft(s, r.id);
          if (problem === 'owned') continue;
          const card = el('div', 'recipe');
          const top = el('div', 'recipe-head');
          top.append(el('code', '', r.name), el('span', 'muted', [r.price ? formatMoney(zl(r.price)) : '', matsText(r.mats)].filter(Boolean).join(' · ')));
          const why = {
            coins: 'nedovoljno novca', nomats: `u torbi treba ${matsText(r.mats)}`,
            bagfull: 'torba je puna',
            requires: { well: 'prvo sazidaj bunar', drone: 'prvo izradi harvest-drone', coop: 'prvo popravi kokošinjac' }[r.requires],
          }[problem];
          const bld = Object.values(BUILDINGS).find((b) => b.plan === r.id);
          if (bld) top.lastChild.textContent = `gradnja ${formatMoney(zl(bld.price))} · ${matsText(bld)} · ${bld.energy} ⚡`;
          card.append(top, el('p', 'small', r.desc), button(why ?? (bld ? 'Skiciraj plan' : 'Izradi'), () => cb.onCraft(r.id), { disabled: Boolean(problem) }));
          list.append(card);
          if (r.id === 'sprinkler') list.append(irrigationCard(s));
        }
        return [head(), button('📖 Kako se što radi (priručnik)', () => openGuide('workbench'), { cls: 'btn guide-link' }), list];
      });
    }
  }

  // Customers' orders: what, by when, the extra pay, and a button to hand it over from the bag.
  function requestCards(s) {
    if (!s.requests.length) return [el('p', 'small muted', 'Narudžbi kupaca trenutno nema. Ponekad se jave ujutro.')];
    const out = [el('p', 'small catalog-head', 'Narudžbe kupaca')];
    for (const r of s.requests) {
      const have = requestHave(s, r);
      const card = el('div', 'recipe');
      const when = r.due === s.day ? 'danas' : `do ${dayNameGen(r.due)} (dan ${r.due})`;
      card.append(
        el('div', 'small', `${r.who}: ${r.kg} kg ${cropById[r.crop].gen} ${stars(r.tier)} ili bolje, ${when}`),
        el('div', 'small muted', `Plaća ${formatMoney(requestPay(r))} (+${Math.round(REQUESTS.bonus * 100)} %). U torbi: ${have} kg.`),
        button(have >= r.kg ? 'Predaj iz torbe' : `Fali još ${r.kg - have} kg`, () => cb.onFulfill(r.id), { disabled: have < r.kg }),
      );
      out.push(card);
    }
    return out;
  }

  // the parking lot by the road: the stall at the town market, the van and the hired hand
  function marketPanel(s, head) {
    const m = s.market;
    const tv = m.trips.van;
    const fp = farmerTripProblem(s);
    const vp = vanTripProblem(s);
    const goods = countWhere(s.bag, isSellable);
    const sig = JSON.stringify(['market', m.stall, m.van, m.worker, tv && [tv.phase, tv.kg, tv.money], s.cargo, fp, vp, goods,
      s.money >= zl(MARKET.van), s.money >= zl(MARKET.stall)]);
    renderIfChanged(els.panel, sig, () => {
      const out = [head(), el('p', 'muted', `Cesta na sjever vodi u grad, ${MARKET.travel / 60} h vožnje. Tržnica radi ${formatClock(MARKET.open)}–${formatClock(MARKET.close)}: kupaca je puno više nego na štandu uz cestu i uzimaju po ${MARKET.kg[0]}–${MARKET.kg[1]} kg. Cijene su iste.`)];
      out.push(el('p', 'small catalog-head', '🧺 Klupa na tržnici'));
      if (!m.stall) {
        out.push(el('p', 'small', 'Klupa se zakupljuje jednom, za cijelu sezonu.'));
        out.push(button(`Zakupi klupu · ${formatMoney(zl(MARKET.stall))}`, cb.onRentStall, { cls: 'btn primary', disabled: s.money < zl(MARKET.stall) }));
      } else {
        const why = {
          nothingtosell: 'U torbi nema ničega za prodaju', intown: 'Farmer je na tržnici',
          toolate: `Prekasno: tržnica se zatvara u ${formatClock(MARKET.close)}`,
        }[fp];
        out.push(el('p', 'small', `Farmer nosi robu iz torbe (sad ${goods} za prodaju). Prodaje do zatvaranja ili dok sve ne proda, pa se vraća. Za to vrijeme farma radi bez njega.`));
        out.push(button(why ?? 'Idi na tržnicu s torbom', cb.onGoMarket, { cls: 'btn primary', disabled: Boolean(fp) }));
      }

      out.push(el('p', 'small catalog-head', '🚐 Kombi i zaposlenik'));
      if (!m.van) {
        out.push(el('p', 'small', `S kombijem i zaposlenikom roba sama ide na tržnicu: ${MARKET.worker} svako jutro u 6 h odveze ono što je utovareno i vrati se oko 14 h s novcem.`));
        out.push(button(`Kupi rabljeni kombi · ${formatMoney(zl(MARKET.van))}`, cb.onBuyVan, { disabled: s.money < zl(MARKET.van) }));
        return out;
      }
      if (tv) {
        const where = { go: 'je na putu u grad', sell: 'je na tržnici', back: 'se vraća' }[tv.phase];
        out.push(el('p', '', `🚐 ${MARKET.worker} ${where} · prodano ${tv.kg} kg · ${formatMoney(tv.money)}`));
      } else {
        const grid = el('div', 'slots');
        s.cargo.forEach((it, i) => grid.append(slotButton(it, it ? () => cb.onMove('cargo', i, 'bag') : null)));
        out.push(el('p', 'small muted', 'U kombiju (klik vraća u torbu):'), grid);
      }
      if (!m.worker) {
        out.push(el('p', 'small', `Dnevnica je ${formatMoney(zl(MARKET.wage))} i plaća se samo na dane kad vozi.`));
        out.push(button(`Zaposli: ${MARKET.worker}`, () => cb.onHire(true), { cls: 'btn primary' }));
      } else {
        out.push(el('p', 'small', `${MARKET.worker} vozi svako jutro u 6 h ako u kombiju ima robe. Dnevnica ${formatMoney(zl(MARKET.wage))}, samo na dane kad vozi.${m.stall ? '' : ' Prvo treba zakupiti klupu.'}`));
        const row = el('div', 'row');
        if (!tv) {
          const why = { nothingtosell: 'Kombi je prazan', toolate: 'Danas je prekasno', coins: 'Nema novca za dnevnicu', nostall: 'Nema klupe' }[vp];
          row.append(button(why ?? `Pošalji sad · ${formatMoney(zl(MARKET.wage))}`, cb.onSendVan, { disabled: Boolean(vp) }));
        }
        row.append(button('Otpusti', () => cb.onHire(false)));
        out.push(row);
      }
      return out;
    });
  }

  const matsText = (m) => (m ? [m.wood && `${m.wood} drva`, m.stone && `${m.stone} kamena`].filter(Boolean).join(', ') : '');

  function irrigationCard(s) {
    const card = el('div', 'recipe');
    const top = el('div', 'recipe-head');
    const level = s.irrigation;
    const cost = irrigationCost(s);
    const max = IRRIGATION_LEVELS;
    const hose = matCount(s, 'hose');
    const parts = el('ul', 'parts');
    for (const [ok, text] of [
      [s.upgrades.well, 'bunar'],
      [s.upgrades.pump, 'vodena pumpa na bunaru'],
      [hose >= HOSE_PER_SPRINKLER, `crijevo: ${hose} m u torbi (${HOSE_PER_SPRINKLER} m po prskalici)`],
      [matCount(s, 'sprinkler') > 0 || s.sprinklers.length > 0, `prskalice: ${matCount(s, 'sprinkler')} u torbi, ${s.sprinklers.length} postavljeno`],
    ]) parts.append(el('li', ok ? 'ok' : '', `${ok ? '✔' : '○'} ${text}`));
    const now = sprinklerReach(level, 0, 0).length;
    top.append(el('code', '', `Navodnjavanje · water.sh v${level}`), el('span', 'muted', cost === null ? 'max' : formatMoney(cost)));
    const meter = el('div', 'meter');
    for (let l = 1; l <= max; l++) meter.append(el('span', l <= level ? 'on' : ''));
    const next = cost === null ? 'Najviša razina.' : `Sljedeća razina: ${sprinklerReach(level + 1, 0, 0).length} parcela po prskalici.`;
    card.append(top, el('p', 'small', 'Sustav se slaže od dijelova: pumpa, crijevo i prskalice (Dostava na mobitelu, ponešto se nađe u šumi). Prskalica stoji na križanju četiri parcele, pa ne zauzima nijednu.'), parts, meter,
      el('p', 'small', `Svaka prskalica sada zalijeva ${now} parcela oko sebe. ${next}`));
    if (cost !== null) {
      const why = !s.upgrades.well ? 'prvo sazidaj bunar' : s.money < cost ? 'nedovoljno novca' : null;
      card.append(button(why ?? `Nadogradi na v${level + 1}`, () => cb.onIrrigation(), { disabled: Boolean(why) }));
    }
    return card;
  }

  // ---- phone: notifications and deliveries
  function phone(s) {
    ui.clock = s.clock;
    els.phone.hidden = !ui.phoneOpen;
    els.phoneBtn.classList.toggle('on', ui.phoneOpen);
    if (ui.phoneOpen && ui.phoneTab === 'feed' && ui.unread) {
      ui.unread = 0;
      els.feed.scrollTop = els.feed.scrollHeight;
    }
    setText(els.phoneBtnBadge, badgeText(ui.unread));
    els.phoneBtnBadge.hidden = !ui.unread;
    els.bagCard.hidden = !bagShown();
    els.bagBtn.classList.toggle('on', bagShown());
    if (!ui.phoneOpen) return;
    setText(els.phoneTime, formatClock(s.clock));
    for (const tab of document.querySelectorAll('.phone-tabs button')) tab.classList.toggle('active', tab.dataset.tab === ui.phoneTab);
    els.feed.hidden = ui.phoneTab !== 'feed';
    els.shopTab.hidden = ui.phoneTab !== 'shop';
    els.gigsTab.hidden = ui.phoneTab !== 'gigs';
    els.guideTab.hidden = ui.phoneTab !== 'guide';
    if (ui.phoneTab === 'gigs') gigsTab(s);
    if (ui.phoneTab === 'guide') guideList(els.guideSearch.value);
    setText(els.badge, badgeText(ui.unread));
    const offers = s.gigs.offers.length;
    setText(els.gigBadge, offers && ui.phoneTab !== 'gigs' ? String(offers) : '');
    els.gigBadge.hidden = !offers || ui.phoneTab === 'gigs';
    els.badge.hidden = !ui.unread;
    if (ui.phoneTab !== 'shop') return;
    const pump = pumpStatus(s);
    const sig = JSON.stringify(['shop', s.money, s.totalEarned, s.orders, s.coop.built, pump, buybackList(s), s.pet, ui.placing === 'remove']);
    renderIfChanged(els.shopTab, sig, () => {
      const out = [];
      // what is already on its way, first: so nothing gets ordered twice by mistake
      const ordered = (o) => (o.item ? `${o.n} ${shopItemById[o.item].unit} · ${shopItemById[o.item].name}` : `${o.n}× sjeme · ${cropById[o.crop].name}`);
      if (s.orders.length) {
        const box = el('div', 'orders');
        box.append(el('p', 'small orders-head', '📦 Stiže sutra ujutro'));
        s.orders.forEach((o, k) => {
          const row = el('div', 'catalog-row');
          const pack = orderPack(o);
          row.append(icon(o.item ? (o.item === 'hen' ? 'egg' : o.item) : o.crop), el('span', 'grow', ordered(o)),
            button(`Otkaži ${pack.n < o.n ? '1 paket' : ''}`.trim(), () => cb.onCancelOrder(k), { title: `Vrati ${formatMoney(pack.price)}` }));
          box.append(row);
        });
        box.append(el('p', 'small muted', 'Do jutra se svaka narudžba može otkazati, novac se vraća u cijelosti.'));
        out.push(box);
      }
      out.push(el('p', 'small muted', `Sve stiže sutra ujutro. Sjeme (paket od ${SEED_PACK}) ide u vrećicu, kokoši u kokošinjac, ostalo u škrinju.`));
      const onWay = (match) => s.orders.filter(match).reduce((a, o) => a + o.n, 0);
      const tag = (n, unit) => (n ? el('span', 'ordered-tag', `naručeno ${n}${unit ? ` ${unit}` : ''}`) : '');
      const shopRow = (it) => {
        const row = el('div', 'catalog-row');
        const why = it.id === 'hen' && !s.coop.built ? 'treba kokošinjac'
          : it.id === 'pump' && pump ? { installed: 'već je na bunaru', ordered: 'već naručena', have: 'već je imaš' }[pump] : '';
        const name = el('span', 'grow', `${it.name} · ${it.n} ${it.unit}${why ? ` · ${why}` : ''}`);
        row.append(icon(it.id === 'hen' ? 'egg' : it.id), name, tag(onWay((o) => o.item === it.id), it.unit === 'kom' ? '' : it.unit),
          button(formatMoney(zl(it.price)), () => cb.onOrderItem(it.id), { disabled: Boolean(why) || s.money < zl(it.price) }));
        return row;
      };
      const group = (title, ids) => {
        out.push(el('p', 'small catalog-head', title));
        for (const id of ids) out.push(shopRow(shopItemById[id]));
      };
      group('Vrt', ['fertilizer', 'mulch']);
      group('Navodnjavanje', ['pump', 'hose', 'sprinkler']);
      group('Kokošinjac', ['hen']);
      out.push(el('p', 'small catalog-head', `Sjeme (paket od ${SEED_PACK} sjemenki)`));
      for (const c of CROPS) {
        const row = el('div', 'catalog-row');
        row.append(icon(c.id));
        if (isUnlocked(s, c.id)) {
          const price = packPrice(c.id);
          // what the crop sells for next to what the seeds cost, so they can be compared
          const name = el('span', 'grow');
          name.append(el('span', 'catalog-name', c.name), el('span', 'catalog-sub', `plod ${formatMoney(zl(c.price))}/kg · ${c.yield} kg po parceli`));
          row.append(name, tag(onWay((o) => !o.item && o.crop === c.id)),
            button(formatMoney(price), () => cb.onOrder(c.id), { disabled: s.money < price, title: `Paket od ${SEED_PACK} sjemenki` }));
        } else {
          row.classList.add('locked');
          row.append(el('span', 'grow', `${c.name} · 🔒 kad ukupno zaradiš ${formatMoney(zl(c.unlock))}`));
        }
        out.push(row);
      }

      // decorating the farm: order, then put down from the bag; take back with "Ukloni"
      group('Uređenje farme', SHOP_ITEMS.filter((it) => it.decor).map((it) => it.id));
      out.push(el('p', 'small muted', 'Ukrasi stižu u škrinju; iz torbe se postave na travu. Ograda i klupa zaprečuju prolaz, ali nikad ne smiju zatvoriti put.'));
      out.push(button(ui.placing === 'remove' ? 'Uklanjanje je uključeno (Esc za kraj)' : '🧹 Ukloni košnicu ili ukras', () => cb.onRemoveMode(), { cls: 'btn' }));

      // a pet from the shelter
      out.push(el('p', 'small catalog-head', 'Ljubimac'));
      if (s.pet) {
        out.push(el('p', 'small', `${s.pet.kind === 'dog' ? '🐕' : '🐈'} ${s.pet.name} te prati po farmi. Klik na ${s.pet.kind === 'dog' ? 'njega' : 'nju'}: maženje (jednom na dan +${PETS.pat} ⚡).`));
      } else {
        const row = el('div', 'row');
        for (const kind of ['dog', 'cat']) row.append(button(`Udomi: ${PETS[kind].species} (${PETS[kind].name}) · ${formatMoney(zl(PETS.adopt))}`, () => cb.onAdopt(kind), { disabled: s.money < zl(PETS.adopt) }));
        out.push(el('p', 'small muted', 'Iz skloništa, uz cijepljenje. Prati farmera i veseli se maženju.'), row);
      }

      // selling back what is no longer needed: half the price, from the chest first
      out.push(el('p', 'small catalog-head', 'Otkup (prodaja viška)'));
      const extra = buybackList(s);
      if (!extra.length) out.push(el('p', 'small muted', 'Nemaš ništa za otkup. Otkupljuju se dijelovi, gnojivo, malč i ukrasi iz škrinje i torbe, za pola cijene.'));
      for (const b of extra) {
        const row = el('div', 'catalog-row');
        row.append(icon(iconName(parseItem(b.id))), el('span', 'grow', `${itemName(b.id)} · imaš ${b.n} ${unitOf(b.id)}`),
          button(`Prodaj ${b.pack} · ${formatMoney(b.price * b.pack)}`, () => cb.onSellBack(b.id), { title: `${formatMoney(b.price)} po ${unitOf(b.id)}` }));
        out.push(row);
      }
      return out;
    });
  }

  function gigsTab(s) {
    const g = s.gigs.active;
    const sig = JSON.stringify(['gigs', s.gigs.offers, g && [g.title, Math.round(g.left)], s.farmer.busy?.what, s.energy >= (g?.energy ?? 0), s.requests, s.day]);
    renderIfChanged(els.gigsTab, sig, () => {
      const out = [el('p', 'small muted', 'Honorarci za susjede i lokalne firme. Farmer ih radi kod kuće za laptopom: troše vrijeme i energiju, a plaćaju odmah.')];
      if (g) {
        const total = (g.hours * 60) / 2;
        const pct = Math.round((1 - g.left / total) * 100);
        const row = el('div', 'gig active');
        row.append(el('span', 'grow', `💻 ${g.title} · ${pct} %`), el('span', 'muted', formatMoney(g.pay)));
        out.push(row);
        out.push(s.farmer.busy?.what === 'gig' ? el('p', 'small', 'Farmer radi u kući…') : button('Nastavi raditi', cb.onGoWork, { cls: 'btn' }));
      }
      if (!s.gigs.offers.length) out.push(el('p', 'small muted', 'Nema novih ponuda. Nove stižu svako jutro.'));
      for (const o of s.gigs.offers) {
        const row = el('div', 'gig');
        const info = el('span', 'grow');
        info.append(el('span', '', o.title), el('span', 'muted small', ` · ${o.hours} h · ${o.energy} ⚡`));
        row.append(info, button(`${formatMoney(o.pay)}`, () => cb.onAcceptGig(o.id), { disabled: Boolean(g), title: g ? 'Prvo dovrši posao koji radiš' : 'Prihvati posao' }));
        out.push(row);
      }
      // customers' orders are handed over at the stand; here is the list to plan by
      out.push(el('p', 'small catalog-head', 'Narudžbe kupaca (predaju se na štandu)'));
      if (!s.requests.length) out.push(el('p', 'small muted', 'Trenutno nema narudžbi.'));
      for (const r of s.requests) {
        const row = el('div', 'gig');
        const when = r.due === s.day ? 'danas' : `do ${dayNameGen(r.due)}`;
        row.append(icon(r.crop, 'px-icon small-icon'), el('span', 'grow', `${r.who}: ${r.kg} kg ${stars(r.tier)}+ · ${when}`), el('span', 'muted', formatMoney(requestPay(r))));
        out.push(row);
      }
      return out;
    });
  }

  function notify(text, kind = '') {
    const atBottom = els.feed.scrollHeight - els.feed.scrollTop - els.feed.clientHeight < 24;
    const line = el('div', `note ${kind}`);
    line.append(el('span', 'note-time', formatClock(ui.clock)), el('span', 'note-text', text));
    coinify(line);
    els.feed.append(line);
    while (els.feed.childElementCount > 120) els.feed.firstElementChild.remove();
    if (atBottom) els.feed.scrollTop = els.feed.scrollHeight;
    if (!ui.phoneOpen || ui.phoneTab !== 'feed') ui.unread++;
    if (!ui.phoneOpen) toast(text, kind);
  }

  // While the phone is closed, new messages pop up briefly in the corner of the map.
  function toast(text, kind) {
    const t = el('div', `toast ${kind}`, text);
    coinify(t);
    els.toasts.append(t);
    while (els.toasts.childElementCount > 3) els.toasts.firstElementChild.remove();
    setTimeout(() => t.classList.add('gone'), 4200 + Math.min(4000, text.length * 25));
    setTimeout(() => t.remove(), 4800 + Math.min(4000, text.length * 25));
  }

  // ---- the farmer's speech bubble
  let bubbleUntil = 0;
  function say(text, mood = '') {
    els.bubble.textContent = text;
    coinify(els.bubble);
    els.bubble.className = `bubble ${mood}`;
    els.bubble.hidden = false;
    bubbleUntil = performance.now() + 2200 + text.length * 45;
  }
  function placeBubble(x, y, now) {
    if (els.bubble.hidden) return;
    if (now > bubbleUntil) {
      els.bubble.hidden = true;
      return;
    }
    const wrap = els.bubble.parentElement.getBoundingClientRect();
    const half = els.bubble.offsetWidth / 2;
    const cx = Math.max(half + 6, Math.min(wrap.width - half - 6, x));
    els.bubble.style.left = `${cx}px`;
    els.bubble.style.top = `${Math.max(els.bubble.offsetHeight + 8, y)}px`;
    els.bubble.style.setProperty('--tail', `${x - cx}px`);
  }

  // ---- tab title, zoom buttons and inspector
  function title(s) {
    const ripe = ripeCount(s);
    const t = ripe ? `🌾 ${ripe} za berbu · dev-farm` : `dev-farm · Dan ${s.day} ${formatClock(s.clock)}`;
    if (document.title !== t) document.title = t;
  }

  function inspect(s, tile, corner) {
    let text = '';
    if (ui.placing === true) {
      const missing = irrigationMissing(s);
      text = missing === 'nopump' || missing === 'nowell' ? 'Prskalica se postavlja tek kad je pumpa na bunaru.'
        : 'Postavljanje prskalice: klikni križanje gdje se dodiruju četiri parcele (Esc za odustajanje).';
    } else if (ui.placing === 'remove') {
      text = 'Uklanjanje: klikni košnicu ili ukras i vratit će se u torbu (Esc za kraj).';
    } else if (ui.placing && ui.placing !== true) {
      text = `Postavljanje: ${itemName(ui.placing)} (imaš ${countWhere(s.bag, (k) => k === ui.placing)}). Klikni travu; zeleno može, crveno ne. Esc za kraj.`;
    } else if (corner?.near && s.sprinklers.some((p) => p.x === corner.x && p.y === corner.y)) {
      text = `Prskalica (water.sh v${s.irrigation}): svako jutro zalije ${sprinklerReach(s.irrigation, 0, 0).length} parcela oko sebe${s.upgrades.pump ? '' : ' (kad pumpa bude na bunaru)'}. Klik: farmer je pokupi s crijevom.`;
    } else if (tile) {
      const [x, y] = tile;
      const obj = objectAt(x, y);
      const i = idx(x, y);
      const p = s.plots[i];
      const f = s.finds[findAt(s, x, y)];
      const fo = s.forage[forageAt(s, x, y)];
      const hv = s.hives[hiveAt(s, x, y)];
      const dc = s.decor[decorAt(s, x, y)];
      if (hv) {
        text = `Košnica: ${hv.honey} kg meda${hv.honey ? '. Klik: farmer ga skupi.' : '. Pčele rade, med je za dan-dva.'}`;
      } else if (dc && dc.kind !== 'path') {
        text = `${DECOR[dc.kind].name}. Ukloniti se može na mobitelu (Dostava → Uređenje → Ukloni).`;
      } else if (fo) {
        text = `U šumi: ${forageById[fo.type].name}. Klik: farmer ode ubrati.`;
      } else if (f) {
        text = `Ovdje nešto raste samo od sebe (${f.what}). Klik: farmer ode po sjeme.`;
      } else if (obj) {
        text = {
          house: s.found.house ? 'Kuća: spavanje (spremanje igre), kava i honorarci za laptopom.' : 'Kuća. Tko zna što je ostalo u ladicama?',
          coop: s.coop.built ? `Kokošinjac: ${s.coop.hens} kokoši, ${s.coop.eggs} jaja čeka, ${kgText(s.coop.feed)} kg u hranilici.`
            : s.upgrades.coopPlan ? `Stari kokošinjac. Klik: farmer ga popravlja (${formatMoney(zl(BUILDINGS.coop.price))}, ${matsText(BUILDINGS.coop)}).`
              : 'Stari kokošinjac. Plan popravka skicira se na radnom stolu.',
          chest: 'Škrinja: spremi višak iz torbe. Ovamo dron nosi urod.',
          stand: 'Štand: stavi plodove, kupci dolaze cestom.',
          well: s.upgrades.well ? 'Bunar: napuni kantu. Izvor za navodnjavanje.'
            : s.upgrades.wellPlan ? `Gradilište bunara. Klik: farmer ga zida (${formatMoney(zl(WELL_BUILD.price))}, ${matsText(WELL_BUILD)}, ${WELL_BUILD.energy} ⚡).`
              : 'Ovdje će biti bunar. Prvo treba skicirati plan na radnom stolu.',
          workbench: 'Radni stol: sjeme iz plodova, gnojivo, bunar, prskalice i ostali izumi.',
          pond: !s.upgrades.rod ? 'Ribnjak: ovdje se puni kanta. S pecaljkom (radni stol) ovdje se i peca.'
            : s.tool === 'rod' ? `Ribnjak: klik i farmer peca sam do mraka (sporo troši energiju). Klik drugdje ga zove natrag. Ulov danas: ${s.pond.caught}.`
              : 'Ribnjak: ovdje se puni kanta. Za pecanje uzmi pecaljku (5).',
          market: s.market.van ? 'Parkiralište: kombi, utovar robe i put u grad na tržnicu.' : 'Put u grad: tržnica (zakup klupe), kasnije kombi i zaposlenik.',
        }[obj];
      } else if (isPlotTile(x, y) && !plotUnlocked(s, i)) {
        text = 'Zaraslo polje. Otključava se na radnom stolu: git clone polje.';
      } else if (p && !p.crop) {
        text = s.tool === 'seed' ? `Prazna parcela: klik posadi ${cropById[s.seed].name} (imaš ${s.seeds[s.seed]}).`
          : 'Prazna parcela. Uzmi sjeme (2) za sadnju.';
      } else if (p?.rotten) {
        text = `${cropById[p.crop].name} je istrunula. Klik očisti parcelu.`;
      } else if (p && p.progress >= 1) {
        const tier = tierOf(qualityScore(p));
        const late = p.ripeDays > 0;
        text = `${cropById[p.crop].name} je zrela: sad bi bila ${stars(tier)} (${TIER_NAMES[tier]})${late ? ' i gubi kvalitetu' : ''}. Istrune za ${days(ROT_DAY - p.ripeDays)}.`;
      } else if (p) {
        const care = [p.wet ? (p.wetLeft > 1 ? 'vlažna još sutra (malč)' : 'danas zalivena') : 'danas suha 💧', p.fert ? `pognojena (${stars(p.fert === true ? 2 : p.fert)})` : 'bez gnojiva', ...(p.mulch ? ['malč'] : [])].join(', ');
        const left = daysLeft(p);
        text = `${cropById[p.crop].name}: još ${days(left)} uz zalijevanje · ${care}`;
      }
    }
    setText(els.inspect, text || 'Prijeđi mišem preko parcele za detalje.');
  }

  return {
    state: ui,
    update(s, tile, zoom, corner) {
      hud(s);
      pouch(s);
      bag(s);
      panel(s);
      phone(s);
      title(s);
      inspect(s, tile, corner);
      els.zoomIn.disabled = !zoom.canIn;
      els.zoomOut.disabled = !zoom.canOut;
    },
    notify,
    say,
    placeBubble,
    toggle,
    openGuide,
    // Esc: close whatever floats over the map
    closeAll() { ui.panel = null; ui.bagOpen = false; ui.phoneOpen = false; },
    clear() { els.feed.textContent = ''; },
    setSettings(set) {
      $('set-bgtime').checked = Boolean(set.bgTime);
      $('set-notify').checked = Boolean(set.notify);
    },
  };
}
