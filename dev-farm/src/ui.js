// DOM side of the game: HUD, hotbar, seed pouch, bag, building panels, the phone,
// the farmer's speech bubble, the inspector line and the tab title.

import {
  CROPS, RECIPES, MAX_ENERGY, COFFEE, EAT_ENERGY, TIER_NAMES, SHOP_OPEN, SHOP_CLOSE, ROT_DAY,
  SEEDS_FROM_FRUIT, SEED_PACK, FERTILIZER_PRICE, WELL_BUILD, IRRIGATION_RADII, zl, SLEEP_FROM,
} from './data.js';
import {
  parseItem, isUnlocked, canSize, countWhere, canCraft, salePrice, isSellable, cropById,
  plotUnlocked, sprinklerAt, qualityScore, tierOf, ripeCount, shopOpen, packPrice, findAt, jobTargets,
  totalSeeds, sprinklerReach, irrigationCost, daysLeft,
} from './sim.js';
import { idx, objectAt, isPlotTile, OBJECTS } from './world.js';
import { iconUrl } from './render.js';

const numberFormat = new Intl.NumberFormat('hr-HR');
// srebrenjaci → "3 zl 50 sr" (1 zlatnik = 100 srebrenjaka)
export function formatMoney(sr) {
  const gold = Math.floor(sr / 100);
  const silver = Math.round(sr % 100);
  if (!gold) return `${silver} sr`;
  return silver ? `${numberFormat.format(gold)} zl ${silver} sr` : `${numberFormat.format(gold)} zl`;
}
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

export function itemName(id) {
  const p = parseItem(id);
  if (!p) return id;
  if (p.kind === 'fertilizer') return 'Gnojivo';
  if (p.kind === 'sprinkler') return 'Prskalica (water.sh)';
  return `${cropById[p.crop].name} ${stars(p.tier)}`;
}

const itemIcon = (id) => {
  const p = parseItem(id);
  return iconUrl(p.kind === 'crop' ? p.crop : p.kind);
};

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
    b.append(icon(p.kind === 'crop' ? p.crop : p.kind, ''), el('span', 'count', String(it.n)));
    if (p.kind === 'crop') b.append(el('span', `tier tier-${p.tier}`, stars(p.tier)));
    b.title = `${itemName(it.id)} · ${it.n}${p.kind === 'crop' ? ' kg' : ' kom'}${label ? ` · ${label}` : ''}`;
    b.setAttribute('aria-label', b.title);
  }
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

// Rebuild an element only when its content signature changed (keeps clicks reliable).
function renderIfChanged(node, sig, build) {
  if (node.dataset.sig === sig) return;
  node.dataset.sig = sig;
  node.replaceChildren(...build());
}

export function createUI(cb) {
  const $ = (id) => document.getElementById(id);
  const els = {
    day: $('hud-day'), clock: $('hud-clock'), shop: $('hud-shop'), money: $('hud-money'), gold: $('hud-gold'), silver: $('hud-silver'),
    energyBar: $('hud-energy-bar'), energy: $('hud-energy'), hotbar: $('hotbar'), seeds: $('seeds'),
    panel: $('panel'), bag: $('bag'), bagInfo: $('bag-info'), inspect: $('inspect'),
    bubble: $('bubble'), feed: $('phone-feed'), shopTab: $('phone-shop'), phoneTime: $('phone-time'),
    badge: $('phone-badge'), zoomIn: $('zoom-in'), zoomOut: $('zoom-out'),
  };
  const ui = { panel: null, selected: -1, placing: false, phoneTab: 'feed', unread: 0, clock: 360 };

  // ---- hotbar
  const tools = [
    { id: 'hand', key: '1', icon: 'hand', name: 'Ruke' },
    { id: 'seed', key: '2', icon: 'seeds', name: 'Sjeme' },
    { id: 'fert', key: '3', icon: 'fertilizer', name: 'Gnojivo' },
  ];
  const toolEls = new Map();
  for (const t of tools) {
    const b = button('', () => cb.onTool(t.id), { cls: 'tool' });
    b.append(el('kbd', '', t.key), icon(t.icon, 'tool-icon'), el('span', 'tool-name', t.name), el('span', 'tool-sub'));
    els.hotbar.append(b);
    toolEls.set(t.id, { b, sub: b.querySelector('.tool-sub') });
  }

  // bulk jobs: each button opens a menu — everything, or one kind of crop
  const jobs = [
    { kind: 'plant', key: 'P', icon: 'seeds', name: 'Posadi', all: 'Sve sjeme' },
    { kind: 'harvest', key: 'B', icon: 'hand', name: 'Poberi', all: 'Sve zrelo' },
    { kind: 'water', key: 'Z', icon: 'can', name: 'Zalij', all: 'Sve posađeno' },
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
    const unit = kind === 'harvest' ? 'zrelih' : kind === 'water' ? 'suhih' : 'parcela';
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
  for (const j of jobs) {
    const b = button('', () => (lastState?.farmer.job ? cb.onJob(j.kind) : openMenu(j.kind, b)), { cls: 'tool bulk' });
    b.append(el('kbd', '', j.key), icon(j.icon, 'tool-icon'), el('span', 'tool-name', `${j.name} ▾`), el('span', 'tool-sub'));
    els.hotbar.append(b);
    jobEls.set(j.kind, { b, name: b.querySelector('.tool-name'), sub: b.querySelector('.tool-sub'), j });
  }

  for (const [id, coin] of [['hud-gold-icon', 'gold'], ['hud-silver-icon', 'silver']]) $(id).src = iconUrl(coin);

  $('reset').addEventListener('click', cb.onReset);
  els.zoomIn.addEventListener('click', () => cb.onZoom(1));
  els.zoomOut.addEventListener('click', () => cb.onZoom(-1));
  for (const tab of document.querySelectorAll('.phone-tabs button')) {
    tab.addEventListener('click', () => {
      ui.phoneTab = tab.dataset.tab;
      cb.onChange();
    });
  }

  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };

  function hud(s) {
    setText(els.day, `Dan ${s.day}`);
    setText(els.clock, `${formatClock(s.clock)} ${s.clock >= 20 * 60 || s.clock < 6 * 60 ? '🌙' : '☀️'}`);
    setText(els.shop, shopOpen(s.clock) ? 'štand otvoren' : `štand zatvoren (${formatClock(SHOP_OPEN)}–${formatClock(SHOP_CLOSE)})`);
    setText(els.gold, numberFormat.format(Math.floor(s.money / 100)));
    setText(els.silver, String(Math.round(s.money % 100)));
    els.money.title = formatMoney(s.money);
    const pct = Math.round((s.energy / MAX_ENERGY) * 100);
    els.energyBar.style.width = `${pct}%`;
    els.energyBar.classList.toggle('low', pct < 20);
    setText(els.energy, `${Math.floor(s.energy)}/${MAX_ENERGY}`);

    for (const t of tools) {
      const { b, sub } = toolEls.get(t.id);
      b.classList.toggle('selected', s.tool === t.id && !ui.placing);
      const text = t.id === 'seed' ? `${cropById[s.seed].name} × ${s.seeds[s.seed]}`
        : t.id === 'fert' ? `× ${countWhere(s.bag, (id) => id === 'fertilizer')}` : 'bere, uzima';
      setText(sub, text);
    }

    lastState = s;
    const running = s.farmer.job;
    for (const [kind, { b, name, sub, j }] of jobEls) {
      const mine = running?.kind === kind;
      const n = jobTargets(s, kind).length;
      b.classList.toggle('running', mine);
      b.disabled = !mine && (Boolean(running) || n === 0);
      setText(name, mine ? 'Prekini' : `${j.name} ▾`);
      setText(sub, mine ? `${running.done}/${running.total} · Esc`
        : kind === 'plant' ? (totalSeeds(s) ? `${n} ${plots(n)}` : 'nema sjemena')
          : kind === 'water' ? `suhih: ${n} · 💧${s.water}/${canSize(s)}` : `zrelih: ${n}`);
    }
    if (running && !menu.hidden) closeMenu();
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
    const transfer = ui.panel === 'chest' || ui.panel === 'stand';
    const sig = JSON.stringify([s.bag, ui.selected, ui.panel]);
    renderIfChanged(els.bag, sig, () => s.bag.map((it, i) => {
      const b = slotButton(it, it ? () => (transfer ? cb.onMove('bag', i, ui.panel) : select(i)) : null);
      if (i === ui.selected) b.classList.add('selected');
      if (ui.panel === 'stand' && it && !isSellable(it.id)) b.classList.add('dim');
      return b;
    }));

    const it = s.bag[ui.selected];
    const infoSig = JSON.stringify([it, ui.panel, s.energy >= MAX_ENERGY]);
    renderIfChanged(els.bagInfo, infoSig, () => {
      if (ui.panel === 'chest') return [el('p', 'muted', 'Klik na stvar u torbi spremi je u škrinju.')];
      if (ui.panel === 'stand') return [el('p', 'muted', 'Klik na plod u torbi stavi ga na štand.')];
      if (!it) return [el('p', 'muted', 'Klikni stvar u torbi za detalje.')];
      const p = parseItem(it.id);
      const out = [el('p', 'item-title', `${itemName(it.id)} · ${it.n} kg`)];
      const row = el('div', 'row');
      if (p.kind === 'crop') {
        out.push(el('p', 'muted', `${TIER_NAMES[p.tier]} · na štandu ${formatMoney(salePrice(p.crop, p.tier))}/kg${p.tier === 1 ? ', i to samo kad nema boljeg' : ''}`));
        row.append(button(`Pojedi (+${EAT_ENERGY[p.tier]} ⚡)`, () => cb.onEat(ui.selected), { disabled: s.energy >= MAX_ENERGY }));
        if (ui.panel === 'workbench') row.append(button(`Izvadi sjeme (${SEEDS_FROM_FRUIT[0]}–${SEEDS_FROM_FRUIT[1]})`, () => cb.onExtract(ui.selected)));
      } else if (p.kind === 'sprinkler') {
        row.append(button('Postavi na parcelu', () => cb.onPlace()));
      } else if (p.kind === 'fertilizer') {
        row.append(button('Uzmi u ruku (3)', () => cb.onTool('fert')));
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
    if (!ui.panel) {
      renderIfChanged(els.panel, 'none', () => {
        const box = el('div', 'panel-empty');
        box.append(
          el('p', '', 'Klikni na mapu da farmer ode tamo.'),
          el('p', 'muted', 'Kuća, škrinja, štand, ribnjak i radni stol otvaraju se kad farmer dođe do njih. Kotačić miša ili + / − mijenjaju zoom.'),
        );
        return [box];
      });
      return;
    }
    const head = () => {
      const h = el('div', 'panel-head');
      h.append(el('h2', '', OBJECTS[ui.panel].name), button('✕', cb.onClosePanel, { cls: 'close', title: 'Zatvori (Esc)' }));
      return h;
    };

    if (ui.panel === 'house') {
      const canSleep = s.clock >= SLEEP_FROM;
      const sig = JSON.stringify(['house', s.money >= zl(COFFEE.price), s.energy >= MAX_ENERGY, canSleep]);
      renderIfChanged(els.panel, sig, () => [
        head(),
        el('p', 'muted', 'Spavanjem završavaš dan i spremaš igru. Usjevi rastu preko noći, a zreli te strpljivo čekaju. Ujutro stiže naručena dostava.'),
        button(canSleep ? 'Spavaj do 06:00 i spremi' : `Spava se od ${formatClock(SLEEP_FROM)}`, cb.onSleep, { cls: 'btn primary', disabled: !canSleep }),
        button(`Skuhaj kavu · ${formatMoney(zl(COFFEE.price))} · +${COFFEE.energy} ⚡`, cb.onCoffee, {
          disabled: s.money < zl(COFFEE.price) || s.energy >= MAX_ENERGY,
        }),
      ]);
    } else if (ui.panel === 'chest') {
      renderIfChanged(els.panel, JSON.stringify(['chest', s.chest]), () => {
        const grid = el('div', 'slots chest');
        s.chest.forEach((it, i) => grid.append(slotButton(it, it ? () => cb.onMove('chest', i, 'bag') : null)));
        return [head(), el('p', 'muted', 'Klik na stvar u škrinji vrati je u torbu.'), grid];
      });
    } else if (ui.panel === 'stand') {
      renderIfChanged(els.panel, JSON.stringify(['stand', s.stand, shopOpen(s.clock)]), () => {
        const grid = el('div', 'slots');
        s.stand.forEach((it, i) => {
          const p = it && parseItem(it.id);
          grid.append(slotButton(it, it ? () => cb.onMove('stand', i, 'bag') : null, { label: p ? `${formatMoney(salePrice(p.crop, p.tier))}/kg` : '' }));
        });
        return [
          head(),
          el('p', 'muted', `Kupci dolaze ${formatClock(SHOP_OPEN)}–${formatClock(SHOP_CLOSE)} i uvijek uzmu najbolje što vide. Cijena ovisi o kvaliteti: ★ ide za pola cijene i samo kad nema boljeg.`),
          grid,
          el('p', 'muted small', shopOpen(s.clock) ? 'Štand je otvoren.' : 'Štand je sada zatvoren.'),
        ];
      });
    } else if (ui.panel === 'workbench') {
      const fruits = s.bag.map((it, i) => [it, i]).filter(([it]) => it && parseItem(it.id).kind === 'crop');
      const sig = JSON.stringify(['wb', RECIPES.map((r) => canCraft(s, r.id)), fruits]);
      renderIfChanged(els.panel, sig, () => {
        const list = el('div', 'recipes');
        const seedBox = el('div', 'recipe');
        seedBox.append(el('div', 'recipe-head'));
        seedBox.firstChild.append(el('code', '', 'Sjeme iz plodova'), el('span', 'muted', `1 plod → ${SEEDS_FROM_FRUIT[0]}–${SEEDS_FROM_FRUIT[1]}`));
        if (!fruits.length) seedBox.append(el('p', 'small muted', 'Nemaš plodova u torbi. Neprodani plod je najbolji izvor sjemena.'));
        for (const [it, i] of fruits) {
          const row = el('div', 'row fruit-row');
          row.append(icon(parseItem(it.id).crop), el('span', 'small', `${itemName(it.id)} × ${it.n}`), button('Izvadi sjeme', () => cb.onExtract(i)));
          seedBox.append(row);
        }
        list.append(seedBox);
        for (const r of RECIPES) {
          const problem = canCraft(s, r.id);
          if (problem === 'owned') continue;
          const card = el('div', 'recipe');
          const top = el('div', 'recipe-head');
          top.append(el('code', '', r.name), el('span', 'muted', r.price ? formatMoney(zl(r.price)) : r.bad ? `${r.bad} kg ★` : ''));
          const why = {
            coins: 'nedovoljno novca', nobad: `treba ${r.bad} kg loših (★) plodova u torbi`,
            bagfull: 'torba je puna', requires: r.requires === 'well' ? 'prvo sazidaj bunar' : 'prvo izradi harvest-drone',
          }[problem];
          if (r.id === 'wellPlan') top.lastChild.textContent = `zidanje ${formatMoney(zl(WELL_BUILD.price))} · ${WELL_BUILD.energy} ⚡`;
          card.append(top, el('p', 'small', r.desc), button(why ?? (r.id === 'wellPlan' ? 'Skiciraj plan' : 'Izradi'), () => cb.onCraft(r.id), { disabled: Boolean(problem) }));
          list.append(card);
          if (r.id === 'sprinkler') list.append(irrigationCard(s));
        }
        return [head(), list];
      });
    }
  }

  function irrigationCard(s) {
    const card = el('div', 'recipe');
    const top = el('div', 'recipe-head');
    const level = s.irrigation;
    const cost = irrigationCost(s);
    const max = IRRIGATION_RADII.length;
    const now = sprinklerReach(level, 0, 0).length;
    top.append(el('code', '', `Navodnjavanje · water.sh v${level}`), el('span', 'muted', cost === null ? 'max' : formatMoney(cost)));
    const meter = el('div', 'meter');
    for (let l = 1; l <= max; l++) meter.append(el('span', l <= level ? 'on' : ''));
    const next = cost === null ? 'Najviša razina.' : `Sljedeća razina: ${sprinklerReach(level + 1, 0, 0).length} parcela po prskalici.`;
    card.append(top, meter, el('p', 'small', `Svaka prskalica sada zalijeva ${now} parcela oko sebe. ${next}`));
    if (cost !== null) {
      const why = !s.upgrades.well ? 'prvo sazidaj bunar' : s.money < cost ? 'nedovoljno novca' : null;
      card.append(button(why ?? `Nadogradi na v${level + 1}`, () => cb.onIrrigation(), { disabled: Boolean(why) }));
    }
    return card;
  }

  // ---- phone: notifications and deliveries
  function phone(s) {
    ui.clock = s.clock;
    setText(els.phoneTime, formatClock(s.clock));
    for (const tab of document.querySelectorAll('.phone-tabs button')) tab.classList.toggle('active', tab.dataset.tab === ui.phoneTab);
    els.feed.hidden = ui.phoneTab !== 'feed';
    els.shopTab.hidden = ui.phoneTab !== 'shop';
    if (ui.phoneTab === 'feed') ui.unread = 0;
    setText(els.badge, ui.unread ? String(Math.min(99, ui.unread)) : '');
    els.badge.hidden = !ui.unread;
    if (ui.phoneTab !== 'shop') return;
    const sig = JSON.stringify(['shop', s.money, s.totalEarned, s.orders]);
    renderIfChanged(els.shopTab, sig, () => {
      const out = [el('p', 'small muted', `Sve stiže sutra ujutro. Sjeme (paket od ${SEED_PACK}) ide u vrećicu, gnojivo u škrinju.`)];
      const fert = el('div', 'catalog-row');
      fert.append(icon('fertilizer'), el('span', 'grow', 'Gnojivo · 1 vreća'), button(formatMoney(zl(FERTILIZER_PRICE)), () => cb.onOrderFertilizer(), { disabled: s.money < zl(FERTILIZER_PRICE) }));
      out.push(fert);
      for (const c of CROPS) {
        const row = el('div', 'catalog-row');
        row.append(icon(c.id));
        if (isUnlocked(s, c.id)) {
          const price = packPrice(c.id);
          row.append(el('span', 'grow', `${c.name} · ${SEED_PACK} kom · ${formatMoney(zl(c.price))}/kg`), button(formatMoney(price), () => cb.onOrder(c.id), { disabled: s.money < price }));
        } else {
          row.classList.add('locked');
          row.append(el('span', 'grow', `${c.name} · 🔒 kad ukupno zaradiš ${formatMoney(zl(c.unlock))}`));
        }
        out.push(row);
      }
      if (s.orders.length) {
        out.push(el('p', 'small', `Stiže sutra: ${s.orders.map((o) => (o.item ? `${o.n}× gnojivo` : `${o.n}× ${cropById[o.crop].name}`)).join(', ')}`));
      }
      return out;
    });
  }

  function notify(text, kind = '') {
    const atBottom = els.feed.scrollHeight - els.feed.scrollTop - els.feed.clientHeight < 24;
    const line = el('div', `note ${kind}`);
    line.append(el('span', 'note-time', formatClock(ui.clock)), el('span', 'note-text', text));
    els.feed.append(line);
    while (els.feed.childElementCount > 120) els.feed.firstElementChild.remove();
    if (atBottom) els.feed.scrollTop = els.feed.scrollHeight;
    if (ui.phoneTab !== 'feed') ui.unread++;
  }

  // ---- the farmer's speech bubble
  let bubbleUntil = 0;
  function say(text, mood = '') {
    els.bubble.textContent = text;
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

  function inspect(s, tile) {
    let text = '';
    if (ui.placing) text = 'Postavljanje prskalice: klikni praznu parcelu (Esc za odustajanje).';
    else if (tile) {
      const [x, y] = tile;
      const obj = objectAt(x, y);
      const i = idx(x, y);
      const p = s.plots[i];
      const f = s.finds[findAt(s, x, y)];
      if (f) {
        text = `Ovdje nešto raste samo od sebe (${f.what}). Klik: farmer ode po sjeme.`;
      } else if (obj) {
        text = {
          house: s.found.house ? 'Kuća: spavanje (spremanje igre) i kava.' : 'Kuća. Tko zna što je ostalo u ladicama?',
          chest: 'Škrinja: spremi višak iz torbe. Ovamo dron nosi urod.',
          stand: 'Štand: stavi plodove, kupci dolaze cestom.',
          well: s.upgrades.well ? 'Bunar: napuni kantu. Izvor za navodnjavanje.'
            : s.upgrades.wellPlan ? `Gradilište bunara. Klik: farmer ga zida (${formatMoney(zl(WELL_BUILD.price))}, ${WELL_BUILD.energy} ⚡).`
              : 'Ovdje će biti bunar. Prvo treba skicirati plan na radnom stolu.',
          workbench: 'Radni stol: sjeme iz plodova, gnojivo, bunar, prskalice i ostali izumi.',
          pond: 'Ribnjak: ovdje se puni kanta.',
        }[obj];
      } else if (isPlotTile(x, y) && !plotUnlocked(s, i)) {
        text = 'Zaraslo polje. Otključava se na radnom stolu: git clone polje.';
      } else if (p && sprinklerAt(s, x, y) >= 0) {
        text = `Prskalica (water.sh v${s.irrigation}): zalijeva ${sprinklerReach(s.irrigation, 0, 0).length} parcela oko sebe. Rukama (1) je pokupiš.`;
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
        const care = [p.wet ? 'danas zalivena' : 'danas suha 💧', p.fert ? 'pognojena' : 'bez gnojiva'].join(', ');
        const left = daysLeft(p);
        text = `${cropById[p.crop].name}: još ${days(left)} uz zalijevanje · ${care}`;
      }
    }
    setText(els.inspect, text || 'Prijeđi mišem preko parcele za detalje.');
  }

  return {
    state: ui,
    update(s, tile, zoom) {
      hud(s);
      pouch(s);
      bag(s);
      panel(s);
      phone(s);
      title(s);
      inspect(s, tile);
      els.zoomIn.disabled = !zoom.canIn;
      els.zoomOut.disabled = !zoom.canOut;
    },
    notify,
    say,
    placeBubble,
    clear() { els.feed.textContent = ''; },
  };
}
