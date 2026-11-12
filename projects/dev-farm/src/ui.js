// DOM side of the game: HUD, hotbar, seed pouch, bag, building panels, the phone,
// the farmer's speech bubble, the inspector line and the tab title.

import {
  CROPS, RECIPES, MAX_ENERGY, COFFEE, EAT_ENERGY, TIER_NAMES, SHOP_OPEN, SHOP_CLOSE, ripeWindow,
  SEEDS_FROM_FRUIT, SEED_PACK,
} from './data.js';
import {
  parseItem, isUnlocked, canSize, countWhere, canCraft, salePrice, isSellable, cropById,
  plotUnlocked, sprinklerAt, qualityScore, tierOf, ripeCount, shopOpen, packPrice, findAt, jobTargets,
  totalSeeds,
} from './sim.js';
import { idx, objectAt, isPlotTile, OBJECTS } from './world.js';
import { iconUrl } from './render.js';

const numberFormat = new Intl.NumberFormat('hr-HR');
export const formatCoins = (n) => numberFormat.format(Math.floor(n));
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
    b.title = `${itemName(it.id)} × ${it.n}${label ? ` · ${label}` : ''}`;
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
    day: $('hud-day'), clock: $('hud-clock'), shop: $('hud-shop'), coins: $('hud-coins'),
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
    { id: 'can', key: '3', icon: 'can', name: 'Kanta' },
    { id: 'fert', key: '4', icon: 'fertilizer', name: 'Gnojivo' },
  ];
  const toolEls = new Map();
  for (const t of tools) {
    const b = button('', () => cb.onTool(t.id), { cls: 'tool' });
    b.append(el('kbd', '', t.key), icon(t.icon, 'tool-icon'), el('span', 'tool-name', t.name), el('span', 'tool-sub'));
    els.hotbar.append(b);
    toolEls.set(t.id, { b, sub: b.querySelector('.tool-sub') });
  }

  // bulk jobs: plant every seed / harvest everything ripe
  const jobs = [
    { kind: 'plant', key: 'P', icon: 'seeds', name: 'Posadi sve' },
    { kind: 'harvest', key: 'B', icon: 'hand', name: 'Poberi sve' },
  ];
  const jobEls = new Map();
  for (const j of jobs) {
    const b = button('', () => cb.onJob(j.kind), { cls: 'tool bulk' });
    b.append(el('kbd', '', j.key), icon(j.icon, 'tool-icon'), el('span', 'tool-name', j.name), el('span', 'tool-sub'));
    els.hotbar.append(b);
    jobEls.set(j.kind, { b, name: b.querySelector('.tool-name'), sub: b.querySelector('.tool-sub') });
  }

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
    setText(els.coins, formatCoins(s.coins));
    const pct = Math.round((s.energy / MAX_ENERGY) * 100);
    els.energyBar.style.width = `${pct}%`;
    els.energyBar.classList.toggle('low', pct < 20);
    setText(els.energy, `${Math.floor(s.energy)}/${MAX_ENERGY}`);

    for (const t of tools) {
      const { b, sub } = toolEls.get(t.id);
      b.classList.toggle('selected', s.tool === t.id && !ui.placing);
      const text = t.id === 'seed' ? `${cropById[s.seed].name} × ${s.seeds[s.seed]}`
        : t.id === 'can' ? `${s.water}/${canSize(s)}`
          : t.id === 'fert' ? `× ${countWhere(s.bag, (id) => id === 'fertilizer')}` : 'bere, uzima';
      setText(sub, text);
    }

    const running = s.farmer.job;
    for (const [kind, { b, name, sub }] of jobEls) {
      const mine = running?.kind === kind;
      const targets = jobTargets(s, kind).length;
      const n = kind === 'plant' ? Math.min(targets, totalSeeds(s)) : targets;
      b.classList.toggle('running', mine);
      b.disabled = !mine && (Boolean(running) || n === 0);
      setText(name, mine ? 'Prekini' : kind === 'plant' ? 'Posadi sve' : 'Poberi sve');
      setText(sub, mine ? `${running.done}/${running.total} · Esc`
        : kind === 'plant' ? (totalSeeds(s) ? `${n} ${plots(n)}` : 'nema sjemena') : `zrelih: ${n}`);
    }
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
        b.title = `${c.name}: ${n} ${n === 1 ? 'sjemenka' : 'sjemenki'}, raste ${c.grow} s`;
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
      const out = [el('p', 'item-title', `${itemName(it.id)} × ${it.n}`)];
      const row = el('div', 'row');
      if (p.kind === 'crop') {
        out.push(el('p', 'muted', `${TIER_NAMES[p.tier]} · na štandu ${salePrice(p.crop, p.tier)} 🪙 po komadu${p.tier === 1 ? ', i to samo kad nema boljeg' : ''}`));
        row.append(button(`Pojedi (+${EAT_ENERGY[p.tier]} ⚡)`, () => cb.onEat(ui.selected), { disabled: s.energy >= MAX_ENERGY }));
        if (ui.panel === 'workbench') row.append(button(`Izvadi sjeme (${SEEDS_FROM_FRUIT[0]}–${SEEDS_FROM_FRUIT[1]})`, () => cb.onExtract(ui.selected)));
      } else if (p.kind === 'sprinkler') {
        row.append(button('Postavi na parcelu', () => cb.onPlace()));
      } else if (p.kind === 'fertilizer') {
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
      const sig = JSON.stringify(['house', s.coins >= COFFEE.price, s.energy >= MAX_ENERGY, s.clock >= 18 * 60]);
      renderIfChanged(els.panel, sig, () => [
        head(),
        el('p', 'muted', 'Spavanjem završavaš dan i spremaš igru. Usjevi rastu preko noći, a zreli te strpljivo čekaju. Ujutro stiže naručena dostava.'),
        button(s.clock >= 18 * 60 ? 'Spavaj do 06:00 i spremi' : 'Odspavaj do sutra i spremi', cb.onSleep, { cls: 'btn primary' }),
        button(`Skuhaj kavu · ${COFFEE.price} 🪙 · +${COFFEE.energy} ⚡`, cb.onCoffee, {
          disabled: s.coins < COFFEE.price || s.energy >= MAX_ENERGY,
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
          grid.append(slotButton(it, it ? () => cb.onMove('stand', i, 'bag') : null, { label: p ? `${salePrice(p.crop, p.tier)} 🪙/kom` : '' }));
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
          top.append(el('code', '', r.name), el('span', 'muted', r.coins ? `${r.coins} 🪙` : `${r.bad}× ★`));
          const why = {
            coins: 'nedovoljno novčića', nobad: `treba ${r.bad} loša (★) ploda u torbi`,
            bagfull: 'torba je puna', requires: r.requires === 'well' ? 'prvo sazidaj bunar' : 'prvo izradi harvest-drone',
          }[problem];
          card.append(top, el('p', 'small', r.desc), button(why ?? (r.id === 'well' ? 'Sazidaj' : 'Izradi'), () => cb.onCraft(r.id), { disabled: Boolean(problem) }));
          list.append(card);
        }
        return [head(), list];
      });
    }
  }

  // ---- phone: notifications and seed delivery
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
    const sig = JSON.stringify(['shop', s.coins, s.totalEarned, s.orders]);
    renderIfChanged(els.shopTab, sig, () => {
      const out = [el('p', 'small muted', `Paket od ${SEED_PACK} sjemenki stiže sutra ujutro, ravno u vrećicu.`)];
      for (const c of CROPS) {
        const row = el('div', 'catalog-row');
        row.append(icon(c.id));
        if (isUnlocked(s, c.id)) {
          const price = packPrice(c.id);
          row.append(el('span', 'grow', `${c.name} · ${SEED_PACK} kom`), button(`${price} 🪙`, () => cb.onOrder(c.id), { disabled: s.coins < price }));
        } else {
          row.classList.add('locked');
          row.append(el('span', 'grow', `${c.name} · 🔒 kad zaradiš ${formatCoins(c.unlock)} 🪙`));
        }
        out.push(row);
      }
      if (s.orders.length) {
        out.push(el('p', 'small', `Stiže sutra: ${s.orders.map((o) => `${o.n}× ${cropById[o.crop].name}`).join(', ')}`));
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
          well: s.upgrades.well ? 'Bunar: napuni kantu. Izvor za navodnjavanje.' : 'Ovdje će biti bunar. Zida se na radnom stolu.',
          workbench: 'Radni stol: sjeme iz plodova, gnojivo, bunar, prskalice i ostali izumi.',
          pond: 'Ribnjak: ovdje se puni kanta.',
        }[obj];
      } else if (isPlotTile(x, y) && !plotUnlocked(s, i)) {
        text = 'Zaraslo polje. Otključava se na radnom stolu: git clone polje.';
      } else if (p && sprinklerAt(s, x, y) >= 0) {
        text = 'Prskalica (water.sh). Rukama (1) je pokupiš natrag u torbu.';
      } else if (p && !p.crop) {
        text = s.tool === 'seed' ? `Prazna parcela: klik posadi ${cropById[s.seed].name} (imaš ${s.seeds[s.seed]}).`
          : 'Prazna parcela. Uzmi sjeme (2) za sadnju.';
      } else if (p?.rotten) {
        text = `${cropById[p.crop].name} je istrunula. Klik očisti parcelu.`;
      } else if (p && p.progress >= 1) {
        const tier = tierOf(qualityScore(p));
        const late = p.ripe > ripeWindow(cropById[p.crop]);
        text = `${cropById[p.crop].name} je zrela: sad bi bila ${stars(tier)} (${TIER_NAMES[tier]})${late ? ', i gubi kvalitetu' : ''}.`;
      } else if (p) {
        const care = [p.water > 0 ? 'zalivena' : 'suha 💧', p.fert ? 'pognojena' : 'bez gnojiva'].join(', ');
        text = `${cropById[p.crop].name}: ${Math.floor(p.progress * 100)} % · ${care}`;
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
