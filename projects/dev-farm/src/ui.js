// DOM panels: wallet, seeds, shop, terminal and the tab title.

import { CROPS, UPGRADES } from './data.js';
import { isUnlocked, upgradeCost, gridSize, isMature, activeIndices } from './sim.js';
import { spriteCanvas } from './sprites.js';

const numberFormat = new Intl.NumberFormat('hr-HR');
export const formatCoins = (n) => numberFormat.format(Math.floor(n));

// Croatian plural forms: 1 parcela, 2–4 parcele, 5+ parcela (11–14 count as "many").
export function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function formatDuration(seconds) {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

const MAX_LINES = 80;

export function createUI({ onSelectCrop, onBuy, onReset }) {
  const $ = (id) => document.getElementById(id);
  const els = {
    coins: $('coins'), earned: $('earned'), size: $('field-size'),
    term: $('terminal'), seeds: $('seeds'), shop: $('shop'),
  };

  const seedEls = new Map();
  for (const c of CROPS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seed';
    const icon = new Image();
    icon.src = spriteCanvas(c.id).toDataURL();
    icon.alt = '';
    icon.className = 'seed-icon';
    const info = document.createElement('span');
    info.className = 'seed-info';
    info.innerHTML = `<span class="seed-name">${c.name}</span><span class="seed-meta"></span>`;
    btn.append(icon, info);
    btn.addEventListener('click', () => onSelectCrop(c.id));
    els.seeds.append(btn);
    seedEls.set(c.id, { btn, meta: info.querySelector('.seed-meta') });
  }

  const shopEls = new Map();
  for (const u of UPGRADES) {
    const row = document.createElement('div');
    row.className = 'upgrade';
    row.innerHTML = `
      <div class="up-head"><code>${u.name}</code><span class="lvl"></span></div>
      <p class="up-blurb">${u.blurb}</p>
      <p class="up-effect"></p>
      <button type="button" class="buy"></button>`;
    const buy = row.querySelector('.buy');
    buy.addEventListener('click', () => onBuy(u.id));
    els.shop.append(row);
    shopEls.set(u.id, { row, buy, lvl: row.querySelector('.lvl'), effect: row.querySelector('.up-effect') });
  }

  $('reset').addEventListener('click', onReset);

  const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };

  function update(s) {
    setText(els.coins, formatCoins(s.coins));
    setText(els.earned, formatCoins(s.totalEarned));
    const n = gridSize(s);
    setText(els.size, `${n}×${n}`);

    for (const c of CROPS) {
      const { btn, meta } = seedEls.get(c.id);
      const unlocked = isUnlocked(s, c.id);
      btn.disabled = !unlocked;
      btn.classList.toggle('locked', !unlocked);
      btn.classList.toggle('selected', s.selectedCrop === c.id);
      btn.setAttribute('aria-pressed', String(s.selectedCrop === c.id));
      setText(meta, unlocked
        ? `sjeme ${c.seed} · prodaja ${c.sell} · ${c.grow} s`
        : `🔒 kad ukupno zaradiš ${formatCoins(c.unlock)} 🪙`);
    }

    for (const u of UPGRADES) {
      const { row, buy, lvl, effect } = shopEls.get(u.id);
      const level = s.upgrades[u.id];
      const max = u.costs.length;
      const cost = upgradeCost(s, u.id);
      setText(lvl, `lvl ${level}/${max}`);
      setText(effect, cost === null
        ? `sada: ${u.effect(level)} (max)`
        : `sada: ${u.effect(level)} → ${u.effect(level + 1)}`);
      if (cost === null) {
        setText(buy, 'instalirano ✔');
        buy.disabled = true;
      } else {
        setText(buy, `${level === 0 ? 'instaliraj' : 'nadogradi'} · ${formatCoins(cost)} 🪙`);
        buy.disabled = s.coins < cost;
      }
      row.classList.toggle('affordable', cost !== null && s.coins >= cost);
    }

    const ripe = activeIndices(s).filter((i) => isMature(s.tiles[i])).length;
    const title = ripe ? `🌾 ${ripe} za berbu · dev-farm` : `dev-farm · ${formatCoins(s.coins)} 🪙`;
    if (document.title !== title) document.title = title;
  }

  function log(text, kind = '') {
    const atBottom = els.term.scrollHeight - els.term.scrollTop - els.term.clientHeight < 24;
    const line = document.createElement('div');
    line.className = `line ${kind}`;
    line.textContent = text;
    els.term.append(line);
    while (els.term.childElementCount > MAX_LINES) els.term.firstElementChild.remove();
    if (atBottom) els.term.scrollTop = els.term.scrollHeight;
  }

  function clear() {
    els.term.textContent = '';
  }

  return { update, log, clear };
}
