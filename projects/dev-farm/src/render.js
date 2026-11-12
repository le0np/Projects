// Draws the field on a canvas. Holds only visual effects; game state comes from sim.js.

import { GRID_MAX } from './data.js';
import { gridSize, isMature, isGrowing } from './sim.js';
import { spriteCanvas } from './sprites.js';

export const VIEW = 400; // logical canvas size in CSS pixels
const TILE = 64;
const GAP = 4;
const CROP_SCALE = 6; // 8 px sprite → 48 px
const ICON_SCALE = 3; // 8 px sprite → 24 px

const COLORS = {
  grass: '#3f6b35', speck: '#4d7f41', plot: '#33572b',
  dry: '#8a5a33', dryLine: '#74492a', wet: '#5a3a22', wetLine: '#47301c',
  barBg: 'rgba(0,0,0,.45)', barWet: '#6fd3ff', barDry: '#e8c35a',
  hover: 'rgba(255,255,255,.75)', coin: '#ffe066', outline: '#1b1b1b',
};

const origin = (n) => (VIEW - (n * TILE + (n - 1) * GAP)) / 2;

function tilePos(i, n) {
  const o = origin(n);
  return { x: o + (i % GRID_MAX) * (TILE + GAP), y: o + Math.floor(i / GRID_MAX) * (TILE + GAP) };
}

function makeGrass() {
  const c = document.createElement('canvas');
  c.width = VIEW;
  c.height = VIEW;
  const ctx = c.getContext('2d');
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, VIEW, VIEW);
  ctx.fillStyle = COLORS.speck;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 700; i++) ctx.fillRect(Math.floor(rnd() * VIEW), Math.floor(rnd() * VIEW), 2, 2);
  return c;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = VIEW * dpr;
  canvas.height = VIEW * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const grass = makeGrass();
  const idle = { x: VIEW - 28, y: 4 };
  const fx = {
    floats: [],
    splashes: [],
    hover: -1,
    drone: { x: idle.x, y: idle.y, target: null, until: 0 },
    last: 0,
  };

  const sprite = (name, x, y, scale) => {
    const c = spriteCanvas(name);
    ctx.drawImage(c, Math.round(x), Math.round(y), c.width * scale, c.height * scale);
  };

  function tileAt(clientX, clientY, s) {
    const r = canvas.getBoundingClientRect();
    const px = ((clientX - r.left) * VIEW) / r.width;
    const py = ((clientY - r.top) * VIEW) / r.height;
    const n = gridSize(s);
    const o = origin(n);
    const gx = Math.floor((px - o) / (TILE + GAP));
    const gy = Math.floor((py - o) / (TILE + GAP));
    if (gx < 0 || gy < 0 || gx >= n || gy >= n) return -1;
    if (px - o - gx * (TILE + GAP) > TILE || py - o - gy * (TILE + GAP) > TILE) return -1;
    return gy * GRID_MAX + gx;
  }

  function notify(events, s, now) {
    const n = gridSize(s);
    for (const e of events) {
      if (e.type === 'harvest') {
        const p = tilePos(e.tile, n);
        fx.floats.push({ x: p.x + TILE / 2, y: p.y + 14, text: `+${e.coins}`, t0: now });
        if (e.by === 'drone') {
          fx.drone.target = { x: p.x + TILE / 2 - 12, y: p.y + 6 };
          fx.drone.until = now + 550;
        }
      } else if (e.type === 'water') {
        for (const i of e.tiles) fx.splashes.push({ tile: i, t0: now });
      }
    }
  }

  function drawTile(s, i, n, now) {
    const t = s.tiles[i];
    const { x, y } = tilePos(i, n);
    const wet = isGrowing(t) && t.water > 0;
    ctx.fillStyle = wet ? COLORS.wet : COLORS.dry;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = wet ? COLORS.wetLine : COLORS.dryLine;
    for (const ly of [14, 30, 46]) ctx.fillRect(x + 6, y + ly, TILE - 12, 3);

    if (t.crop) {
      if (isMature(t)) {
        const bob = Math.sin(now / 320 + i) * 1.5;
        sprite(t.crop, x + 8, y + 4 + bob, CROP_SCALE);
        if (Math.floor(now / 400 + i) % 3 === 0) {
          ctx.fillStyle = '#fff8c4';
          ctx.fillRect(x + TILE - 12, y + 6, 3, 3);
        }
      } else {
        sprite(t.progress < 0.34 ? 'sprout' : 'young', x + 8, y + 4, CROP_SCALE);
        ctx.fillStyle = COLORS.barBg;
        ctx.fillRect(x + 6, y + TILE - 8, TILE - 12, 4);
        ctx.fillStyle = wet ? COLORS.barWet : COLORS.barDry;
        ctx.fillRect(x + 6, y + TILE - 8, Math.round((TILE - 12) * t.progress), 4);
        if (!wet) sprite('drop', x + TILE - 14, y + 4, 2);
      }
    }

    if (fx.hover === i) {
      ctx.strokeStyle = COLORS.hover;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    }
  }

  function draw(s, now) {
    const dt = fx.last ? Math.min(0.1, (now - fx.last) / 1000) : 0;
    fx.last = now;
    const n = gridSize(s);
    const o = origin(n);
    const w = n * TILE + (n - 1) * GAP;

    ctx.drawImage(grass, 0, 0, VIEW, VIEW);
    ctx.fillStyle = COLORS.plot;
    ctx.fillRect(o - 6, o - 6, w + 12, w + 12);

    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) drawTile(s, y * GRID_MAX + x, n, now);

    // water splashes
    fx.splashes = fx.splashes.filter((sp) => now - sp.t0 < 600);
    for (const sp of fx.splashes) {
      const k = (now - sp.t0) / 600;
      const { x, y } = tilePos(sp.tile, n);
      ctx.globalAlpha = 1 - k;
      for (const [dx, dy] of [[14, 10], [34, 4], [46, 16]]) sprite('drop', x + dx, y + dy + k * 18, 2);
      ctx.globalAlpha = 1;
    }

    if (s.upgrades.water > 0) sprite('sprinkler', 2, 2, ICON_SCALE);
    if (s.upgrades.compost > 0) sprite('compost', 2, VIEW - 26, ICON_SCALE);

    if (s.upgrades.drone > 0) {
      const d = fx.drone;
      const goal = d.target && now < d.until ? d.target : idle;
      const k = 1 - Math.exp(-dt * 10);
      d.x += (goal.x - d.x) * k;
      d.y += (goal.y - d.y) * k;
      sprite('drone', d.x, d.y + Math.sin(now / 180) * 2, ICON_SCALE);
    }

    // floating "+coins"
    fx.floats = fx.floats.filter((f) => now - f.t0 < 900);
    ctx.font = 'bold 15px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    for (const f of fx.floats) {
      const k = (now - f.t0) / 900;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = COLORS.outline;
      ctx.strokeText(f.text, f.x, f.y - k * 24);
      ctx.fillStyle = COLORS.coin;
      ctx.fillText(f.text, f.x, f.y - k * 24);
    }
    ctx.globalAlpha = 1;
  }

  return {
    draw,
    tileAt,
    notify,
    setHover(i) { fx.hover = i; },
  };
}
