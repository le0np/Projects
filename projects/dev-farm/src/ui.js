// DOM side of the game: HUD, hotbar, bag, building panels, inspector, terminal, tab title.

import {
  CROPS, RECIPES, MAX_ENERGY, COFFEE, EAT_ENERGY, TIER_NAMES, SHOP_OPEN, SHOP_CLOSE, ripeWindow,
} from './data.js';
import {
  parseItem, isUnlocked, canSize, countWhere, canCraft, salePrice, isSellable, cropById,
  plotUnlocked, sprinklerAt, qualityScore, tierOf, ripeCount, shopOpen,
} from './sim.js';
import { idx, objectAt, isPlotTile, OBJECTS } from './world.js';
import { spriteUrl } from './sprites.js';

const numberFormat = new Intl.NumberFormat('hr-HR');
export const formatCoins = (n) => numberFormat.format(Math.floor(n));
export const stars = (tier) => '★'.repeat(tier);

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
  return spriteUrl(p.kind === 'crop' ? p.crop : p.kind);
};

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
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
    const img = new Image();
    img.src = itemIcon(it.id);
    img.alt = '';
    b.append(img, el('span', 'count', String(it.n)));
    if (p.kind === 'crop') {
      const st = el('span', `tier tier-${p.tier}`, stars(p.tier));
      b.append(st);
    }
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
    panel: $('panel'), bag: $('bag'), bagInfo: $('bag-info'), inspect: $('inspect'), term: $('terminal'),
  };
  const ui = { panel: null, selected: -1, placing: false };

  // hotbar
  const tools = [
    { id: 'hand', key: '1', icon: '✋', name: 'Ruke' },
    { id: 'seed', key: '2', icon: '🌱', name: 'Sjeme' },
    { id: 'can', key: '3', icon: '🪣', name: 'Kanta' },
    { id: 'fert', key: '4', icon: '🧪', name: 'Gnojivo' },
  ];
  const toolEls = new Map();
  for (const t of tools) {
    const b = button('', () => cb.onTool(t.id), { cls: 'tool' });
    b.innerHTML = `<kbd>${t.key}</kbd><span class="tool-icon">${t.icon}</span><span class="tool-name">${t.name}</span><span class="tool-sub"></span>`;
    els.hotbar.append(b);
    toolEls.set(t.id, { b, sub: b.querySelector('.tool-sub') });
  }

  // seed picker
  const seedEls = new Map();
  for (const c of CROPS) {
    const b = button('', () => cb.onSeed(c.id), { cls: 'seed' });
    const img = new Image();
    img.src = spriteUrl(c.id);
    img.alt = '';
    b.append(img, el('span', 'seed-name', c.name), el('span', 'seed-cost', `${c.seed} 🪙`));
    els.seeds.append(b);
    seedEls.set(c.id, b);
  }

  $('reset').addEventListener('click', cb.onReset);

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
      const text = t.id === 'seed' ? cropById[s.seed].name
        : t.id === 'can' ? `${s.water}/${canSize(s)}`
          : t.id === 'fert' ? `× ${countWhere(s.bag, (id) => id === 'fertilizer')}` : 'bere, uzima';
      setText(sub, text);
    }
    for (const c of CROPS) {
      const b = seedEls.get(c.id);
      const open = isUnlocked(s, c.id);
      b.disabled = !open;
      b.classList.toggle('selected', s.seed === c.id);
      b.title = open ? `${c.name}: sjeme ${c.seed} 🪙, raste ${c.grow} s, prodaja od ${c.price} 🪙`
        : `Otključava se kad ukupno zaradiš ${formatCoins(c.unlock)} 🪙`;
    }
  }

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
      if (ui.panel === 'stand') return [el('p', 'muted', 'Klik na stvar u torbi stavi je na štand (samo ★★ i bolje).')];
      if (!it) return [el('p', 'muted', 'Klikni stvar u torbi za detalje.')];
      const p = parseItem(it.id);
      const out = [el('p', 'item-title', `${itemName(it.id)} × ${it.n}`)];
      const row = el('div', 'row');
      if (p.kind === 'crop') {
        out.push(el('p', 'muted', p.tier >= 2
          ? `${TIER_NAMES[p.tier]} · na štandu ${salePrice(p.crop, p.tier)} 🪙 po komadu`
          : 'loše kvalitete: kupci to ne žele. Pojedi ili kompostiraj na radnom stolu.'));
        row.append(button(`Pojedi (+${EAT_ENERGY[p.tier]} ⚡)`, () => cb.onEat(ui.selected), { disabled: s.energy >= 100 }));
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

  function panel(s) {
    if (!ui.panel) {
      renderIfChanged(els.panel, 'none', () => {
        const box = el('div', 'panel-empty');
        box.append(
          el('p', '', 'Klikni na mapu da farmer ode tamo.'),
          el('p', 'muted', 'Kuća, škrinja, štand, bunar i radni stol otvaraju se kad farmer dođe do njih.'),
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
        el('p', 'muted', 'Spavanjem završavaš dan i spremaš igru. Usjevi rastu preko noći, a zreli te strpljivo čekaju.'),
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
          const price = it ? `${salePrice(parseItem(it.id).crop, parseItem(it.id).tier)} 🪙/kom` : '';
          grid.append(slotButton(it, it ? () => cb.onMove('stand', i, 'bag') : null, { label: price }));
        });
        return [
          head(),
          el('p', 'muted', `Kupci dolaze ${formatClock(SHOP_OPEN)}–${formatClock(SHOP_CLOSE)} i kupuju samo ★★ i bolje. Bolja kvaliteta, bolja cijena.`),
          grid,
          el('p', 'muted small', shopOpen(s.clock) ? 'Štand je otvoren.' : 'Štand je sada zatvoren.'),
        ];
      });
    } else if (ui.panel === 'workbench') {
      const sig = JSON.stringify(['wb', RECIPES.map((r) => canCraft(s, r.id))]);
      renderIfChanged(els.panel, sig, () => {
        const list = el('div', 'recipes');
        for (const r of RECIPES) {
          const problem = canCraft(s, r.id);
          if (problem === 'owned') continue;
          const card = el('div', 'recipe');
          const top = el('div', 'recipe-head');
          top.append(el('code', '', r.name), el('span', 'muted', r.coins ? `${r.coins} 🪙` : `${r.bad}× ★`));
          const why = {
            coins: 'nedovoljno novčića', nobad: `treba ${r.bad} loša (★) proizvoda u torbi`,
            bagfull: 'torba je puna', requires: 'prvo izradi harvest-drone',
          }[problem];
          card.append(top, el('p', 'small', r.desc), button(why ?? 'Izradi', () => cb.onCraft(r.id), { disabled: Boolean(problem), cls: 'btn' }));
          list.append(card);
        }
        return [head(), list];
      });
    }
  }

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
      if (obj) {
        text = {
          house: 'Kuća: spavanje (spremanje igre) i kava.',
          chest: 'Škrinja: spremi višak iz torbe. Ovamo dron nosi urod.',
          stand: 'Štand: stavi robu, kupci dolaze cestom.',
          well: 'Bunar: napuni kantu.',
          workbench: 'Radni stol: gnojivo, prskalice, dron i ostali izumi.',
          pond: 'Ribnjak: i ovdje možeš napuniti kantu.',
        }[obj];
      } else if (isPlotTile(x, y) && !plotUnlocked(s, i)) {
        text = 'Zaraslo polje. Otključava se na radnom stolu: git clone polje.';
      } else if (p && sprinklerAt(s, x, y) >= 0) {
        text = 'Prskalica (water.sh). Rukama (1) je pokupiš natrag u torbu.';
      } else if (p && !p.crop) {
        text = s.tool === 'seed' ? `Prazna parcela: klik posadi ${cropById[s.seed].name} (${cropById[s.seed].seed} 🪙).`
          : 'Prazna parcela. Uzmi sjeme (2) za sadnju.';
      } else if (p?.rotten) {
        text = `${cropById[p.crop].name} je istrunula. Klik očisti parcelu.`;
      } else if (p && p.progress >= 1) {
        const tier = tierOf(qualityScore(p));
        const late = p.ripe > ripeWindow(cropById[p.crop]);
        text = `${cropById[p.crop].name} je zrela: sad bi bila ${stars(tier)} (${TIER_NAMES[tier]})${late ? ', i gubi kvalitetu' : ''}.`;
      } else if (p) {
        const care = [
          p.water > 0 ? 'zalivena' : 'suha 💧',
          p.fert ? 'pognojena' : 'bez gnojiva',
        ].join(', ');
        text = `${cropById[p.crop].name}: ${Math.floor(p.progress * 100)} % · ${care}`;
      }
    }
    setText(els.inspect, text || 'Prijeđi mišem preko parcele za detalje.');
  }

  function log(text, kind = '') {
    const atBottom = els.term.scrollHeight - els.term.scrollTop - els.term.clientHeight < 24;
    const line = el('div', `line ${kind}`, text);
    els.term.append(line);
    while (els.term.childElementCount > 120) els.term.firstElementChild.remove();
    if (atBottom) els.term.scrollTop = els.term.scrollHeight;
  }

  return {
    state: ui,
    update(s, tile) {
      hud(s);
      bag(s);
      panel(s);
      title(s);
      inspect(s, tile);
    },
    log,
    clear() { els.term.textContent = ''; },
  };
}
