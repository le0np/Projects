// Draws the world on a canvas with a camera that follows the farmer.
// Holds only visual effects; game state lives in sim.js.

import { W, H, MAP, HOUSE, STAND, idx, xy } from './world.js';
import { plotUnlocked, parseItem } from './sim.js';
import { spriteCanvas } from './sprites.js';

const TS = 16; // world pixels per tile

const C = {
  grass: '#5a8f3d', grassDark: '#4f8236', grassLight: '#68a047',
  path: '#b08a5a', pathDark: '#9c784b', pathLight: '#c19a68',
  road: '#9a8a74', roadDark: '#86775f',
  water: '#3d7fc4', waterLight: '#5f9bd6', foam: '#cfe6f7',
  soil: '#7a5030', soilLine: '#694427', wet: '#4b301d', wetLine: '#3e2717', soilEdge: '#5c3a22',
  overgrown: '#4c7a34', tuft: '#6aa34b',
  fence: '#8a6239', fenceTop: '#a77a4b',
  roof: '#9b4a3a', roofLine: '#7d3a2e', ridge: '#b85c48', eave: '#5e2a22',
  wall: '#c9a06a', wallLine: '#a8834f', post: '#8a6239',
  door: '#6b4226', doorLine: '#55331d', glass: '#8fc3e8', frame: '#5a3a22', gold: '#e8c35a',
  stone: '#8b8f96', stoneDark: '#5f636a',
};

const LOOKS = [
  { n: '#3b2a1c', c: '#c94f4f', C: '#9c3a3a' },
  { n: '#d9c38a', c: '#5fa36b', C: '#447a4f' },
  { n: '#26262a', c: '#9b6ad1', C: '#7450a3', p: '#3d4a63' },
  { n: '#b0582e', c: '#e0a03a', C: '#b37b22' },
];

const TIER_COLORS = ['', '#b0a99f', '#e8e3d8', '#9fe07a', '#ffd84a'];

// house windows, in world pixels (also used for the night glow)
const WINDOWS = [
  { x: HOUSE.x * TS + 10, y: HOUSE.y * TS + 52, w: 14, h: 12 },
  { x: HOUSE.x * TS + HOUSE.w * TS - 24, y: HOUSE.y * TS + 52, w: 14, h: 12 },
];

function drawHouse(g) {
  const hx = HOUSE.x * TS;
  const hy = HOUSE.y * TS;
  const hw = HOUSE.w * TS;
  // walls
  g.fillStyle = C.wall;
  g.fillRect(hx, hy + 44, hw, 36);
  g.fillStyle = C.wallLine;
  for (let y = hy + 48; y < hy + 80; y += 5) g.fillRect(hx, y, hw, 1);
  g.fillStyle = C.post;
  g.fillRect(hx, hy + 44, 3, 36);
  g.fillRect(hx + hw - 3, hy + 44, 3, 36);
  // roof
  g.fillStyle = C.roof;
  g.fillRect(hx - 2, hy + 2, hw + 4, 40);
  g.fillStyle = C.roofLine;
  for (let k = 0, y = hy + 6; y < hy + 40; y += 5, k++) {
    g.fillRect(hx - 2, y, hw + 4, 1);
    for (let x = hx + (k % 2) * 4; x < hx + hw; x += 8) g.fillRect(x, y - 4, 1, 4);
  }
  g.fillStyle = C.ridge;
  g.fillRect(hx - 2, hy + 2, hw + 4, 2);
  g.fillStyle = C.eave;
  g.fillRect(hx - 4, hy + 40, hw + 8, 4);
  // chimney
  g.fillStyle = C.stone;
  g.fillRect(hx + 70, hy - 6, 10, 12);
  g.fillStyle = C.stoneDark;
  g.fillRect(hx + 68, hy - 8, 14, 3);
  // door (tile x = 8)
  const dx = 8 * TS + 2;
  g.fillStyle = C.door;
  g.fillRect(dx, hy + 54, 12, 26);
  g.fillStyle = C.doorLine;
  g.fillRect(dx + 4, hy + 56, 1, 24);
  g.fillRect(dx + 8, hy + 56, 1, 24);
  g.fillStyle = C.gold;
  g.fillRect(dx + 10, hy + 68, 1, 2);
  // windows
  for (const w of WINDOWS) {
    g.fillStyle = C.frame;
    g.fillRect(w.x - 1, w.y - 1, w.w + 2, w.h + 2);
    g.fillStyle = C.glass;
    g.fillRect(w.x, w.y, w.w, w.h);
    g.fillStyle = C.frame;
    g.fillRect(w.x + w.w / 2, w.y, 1, w.h);
    g.fillRect(w.x, w.y + w.h / 2, w.w, 1);
  }
}

function drawStand(g) {
  const sx = STAND.x * TS;
  const sy = STAND.y * TS;
  g.fillStyle = C.post;
  g.fillRect(sx + 2, sy + 4, 2, 28);
  g.fillRect(sx + 28, sy + 4, 2, 28);
  for (let k = 0; k < 8; k++) {
    g.fillStyle = k % 2 ? '#f4efe6' : '#d9534f';
    g.fillRect(sx + k * 4, sy, 4, 9);
    g.fillRect(sx + k * 4 + 1, sy + 9, 2, 1);
  }
  g.fillStyle = '#a8743f';
  g.fillRect(sx, sy + 20, 32, 12);
  g.fillStyle = '#c48a4c';
  g.fillRect(sx, sy + 20, 32, 3);
  g.fillStyle = '#8a5e33';
  for (let x = sx + 6; x < sx + 32; x += 7) g.fillRect(x, sy + 24, 1, 8);
}

function buildWorld(field2) {
  const c = document.createElement('canvas');
  c.width = W * TS;
  c.height = H * TS;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  let seed = 99;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? MAP[y][x] : 't');
  const specks = (px, py, colors, n) => {
    for (let k = 0; k < n; k++) {
      g.fillStyle = colors[k % colors.length];
      g.fillRect(px + Math.floor(rnd() * 15), py + Math.floor(rnd() * 15), 1, 2);
    }
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = MAP[y][x];
      const px = x * TS;
      const py = y * TS;
      if (ch === ',') {
        g.fillStyle = C.path;
        g.fillRect(px, py, TS, TS);
        specks(px, py, [C.pathDark, C.pathLight], 4);
      } else if (ch === 'r') {
        g.fillStyle = C.road;
        g.fillRect(px, py, TS, TS);
        specks(px, py, [C.roadDark], 3);
      } else if (ch === '~') {
        g.fillStyle = C.water;
        g.fillRect(px, py, TS, TS);
        g.fillStyle = C.waterLight;
        g.fillRect(px + Math.floor(rnd() * 10), py + Math.floor(rnd() * 14), 4, 1);
        for (const [dx, dy, rx, ry, rw, rh] of [[0, -1, 0, 0, 16, 2], [0, 1, 0, 14, 16, 2], [-1, 0, 0, 0, 2, 16], [1, 0, 14, 0, 2, 16]]) {
          if (at(x + dx, y + dy) !== '~') {
            g.fillStyle = C.foam;
            g.fillRect(px + rx, py + ry, rw, rh);
          }
        }
      } else if (ch === 'P' || (ch === 'Q' && field2)) {
        g.fillStyle = C.soil;
        g.fillRect(px, py, TS, TS);
      } else if (ch === 'Q') {
        g.fillStyle = C.overgrown;
        g.fillRect(px, py, TS, TS);
        g.fillStyle = C.tuft;
        for (let k = 0; k < 3; k++) {
          const tx = px + 2 + Math.floor(rnd() * 11);
          const ty = py + 3 + Math.floor(rnd() * 10);
          g.fillRect(tx, ty, 1, 3);
          g.fillRect(tx + 2, ty - 1, 1, 4);
        }
      } else {
        g.fillStyle = C.grass;
        g.fillRect(px, py, TS, TS);
        specks(px, py, [C.grassDark, C.grassLight], 3);
        if (ch === '*') {
          for (const col of ['#f4e04d', '#f28cb1', '#ffffff']) {
            g.fillStyle = col;
            g.fillRect(px + 2 + Math.floor(rnd() * 11), py + 2 + Math.floor(rnd() * 11), 2, 2);
          }
        } else if (ch === 't') {
          g.fillStyle = 'rgba(0,0,0,.18)';
          g.fillRect(px + 3, py + 12, 10, 3);
          g.drawImage(spriteCanvas('tree'), px, py);
        } else if (ch === 'f') {
          g.fillStyle = C.fence;
          if (at(x - 1, y) === 'f') { g.fillRect(px, py + 6, 8, 2); g.fillRect(px, py + 10, 8, 2); }
          if (at(x + 1, y) === 'f') { g.fillRect(px + 8, py + 6, 8, 2); g.fillRect(px + 8, py + 10, 8, 2); }
          if (at(x, y - 1) === 'f') g.fillRect(px + 7, py, 2, 8);
          if (at(x, y + 1) === 'f') g.fillRect(px + 7, py + 8, 2, 8);
          g.fillRect(px + 6, py + 3, 4, 12);
          g.fillStyle = C.fenceTop;
          g.fillRect(px + 6, py + 3, 4, 2);
        }
      }
    }
  }

  drawHouse(g);
  drawStand(g);
  g.drawImage(spriteCanvas('chest'), 11 * TS, 8 * TS);
  g.drawImage(spriteCanvas('well'), 15 * TS, 6 * TS);
  g.drawImage(spriteCanvas('workbench'), 3 * TS, 8 * TS);
  if (!field2) {
    // "git clone polje" sign at the overgrown field
    const px = 21 * TS;
    const py = 13 * TS;
    g.fillStyle = C.post;
    g.fillRect(px + 7, py + 6, 2, 10);
    g.fillStyle = C.wall;
    g.fillRect(px + 1, py + 1, 14, 8);
    g.fillStyle = C.frame;
    g.fillRect(px + 3, py + 3, 10, 1);
    g.fillRect(px + 3, py + 6, 7, 1);
  }
  return c;
}

// 0 during the day, up to 0.6 at night
export function darkness(clock) {
  const h = (clock / 60) % 24;
  if (h >= 6 && h < 17) return 0;
  if (h >= 17 && h < 21) return ((h - 17) / 4) * 0.6;
  if (h >= 21 || h < 5) return 0.6;
  return (6 - h) * 0.6;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let cssW = 0;
  let cssH = 0;
  let zoom = 3;
  let world = null;
  let worldField2 = null;
  const cam = { x: 0, y: 0 };
  const fx = { floats: [], splashes: [], hover: null };

  function resize() {
    const box = canvas.parentElement.getBoundingClientRect();
    cssW = Math.max(200, Math.floor(box.width));
    cssH = Math.max(240, Math.min(640, Math.floor(window.innerHeight - 230)));
    zoom = cssW < 640 ? 2 : 3;
    dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  resize();

  function updateCamera(s) {
    const viewW = cssW / zoom;
    const viewH = cssH / zoom;
    const fit = (center, view, size) =>
      (view >= size ? (size - view) / 2 : Math.min(size - view, Math.max(0, center - view / 2)));
    const unit = zoom * dpr;
    cam.x = Math.round(fit(s.farmer.x * TS + TS / 2, viewW, W * TS) * unit) / unit;
    cam.y = Math.round(fit(s.farmer.y * TS + TS / 2, viewH, H * TS) * unit) / unit;
  }

  function tileFromClient(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const wx = (clientX - r.left) / zoom + cam.x;
    const wy = (clientY - r.top) / zoom + cam.y;
    const x = Math.floor(wx / TS);
    const y = Math.floor(wy / TS);
    return x >= 0 && y >= 0 && x < W && y < H ? [x, y] : null;
  }

  const sprite = (name, x, y, w, h, colors) => ctx.drawImage(spriteCanvas(name, colors), x, y, w, h);

  function drawPlot(s, i, now) {
    const p = s.plots[i];
    const [x, y] = xy(i);
    const px = x * TS;
    const py = y * TS;
    const growing = p.crop && !p.rotten && p.progress < 1;
    const wet = growing && p.water > 0;
    ctx.fillStyle = wet ? C.wet : C.soil;
    ctx.fillRect(px, py, TS, TS);
    ctx.fillStyle = wet ? C.wetLine : C.soilLine;
    for (const ly of [4, 9, 13]) ctx.fillRect(px + 2, py + ly, 12, 1);
    ctx.fillStyle = C.soilEdge;
    ctx.fillRect(px + 15, py, 1, 16);
    ctx.fillRect(px, py + 15, 16, 1);
    if (p.fert) {
      ctx.fillStyle = '#e4dcb0';
      for (const [a, b] of [[3, 2], [12, 6], [5, 11], [10, 12]]) ctx.fillRect(px + a, py + b, 1, 1);
    }
    if (!p.crop) return;
    if (p.rotten) {
      sprite('rotten', px, py - 1, 16, 16);
      return;
    }
    if (p.progress >= 1) {
      const bob = Math.round(Math.sin(now / 320 + i) * 0.8);
      sprite(p.crop, px, py - 3 + bob, 16, 16);
      if (Math.floor(now / 450 + i) % 4 === 0) {
        ctx.fillStyle = '#fff8c4';
        ctx.fillRect(px + 13, py + 1, 1, 1);
      }
      return;
    }
    sprite(p.progress < 0.34 ? 'sprout' : 'young', px, py - 2, 16, 16);
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(px + 2, py + 14, 12, 1);
    ctx.fillStyle = wet ? '#6fd3ff' : '#e8c35a';
    ctx.fillRect(px + 2, py + 14, Math.max(1, Math.round(12 * p.progress)), 1);
    if (!wet) sprite('drop', px + 10, py + 1, 5, 5);
  }

  function drawPerson(e, now, look) {
    const moving = e.path?.length > 0;
    const frame = moving ? Math.floor(now / 140) % 2 : 0;
    const dir = e.dir === 'left' || e.dir === 'right' ? 'side' : e.dir;
    const name = `${look ? 'villager' : 'farmer'}-${dir}-${frame}`;
    const px = e.x * TS;
    const py = e.y * TS - 5;
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fillRect(px + 4, e.y * TS + 12, 8, 2);
    if (e.dir === 'left') {
      ctx.save();
      ctx.translate(px + TS, py);
      ctx.scale(-1, 1);
      sprite(name, 0, 0, 16, 16, look);
      ctx.restore();
    } else {
      sprite(name, px, py, 16, 16, look);
    }
  }

  function notify(events, s, now) {
    const float = (x, y, text, color) => fx.floats.push({ x: x * TS + 8, y: y * TS, text, color, t0: now });
    for (const e of events) {
      if (e.type === 'harvest') float(e.x, e.y, '★'.repeat(e.tier), TIER_COLORS[e.tier]);
      else if (e.type === 'sale') float(STAND.x + 0.5, STAND.y, `+${e.coins}`, '#ffe066');
      else if (e.type === 'water') fx.splashes.push({ x: e.x, y: e.y, t0: now });
      else if (e.type === 'sprinkle') for (const [x, y] of e.tiles) fx.splashes.push({ x, y, t0: now });
      else if (e.type === 'eat' || e.type === 'coffee') float(s.farmer.x, s.farmer.y - 1, `+${e.gain}⚡`, '#9fe07a');
      else if (e.type === 'refill') float(s.farmer.x, s.farmer.y - 1, `💧${e.water}`, '#9fd3ff');
    }
  }

  function draw(s, now) {
    if (worldField2 !== s.upgrades.field2) {
      world = buildWorld(s.upgrades.field2);
      worldField2 = s.upgrades.field2;
    }
    updateCamera(s);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#16171a';
    ctx.fillRect(0, 0, cssW, cssH);

    const u = zoom * dpr;
    ctx.setTransform(u, 0, 0, u, -cam.x * u, -cam.y * u);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(world, 0, 0);

    const x0 = Math.max(0, Math.floor(cam.x / TS));
    const y0 = Math.max(0, Math.floor(cam.y / TS));
    const x1 = Math.min(W - 1, Math.ceil((cam.x + cssW / zoom) / TS));
    const y1 = Math.min(H - 1, Math.ceil((cam.y + cssH / zoom) / TS));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = idx(x, y);
        if (s.plots[i] && plotUnlocked(s, i)) drawPlot(s, i, now);
      }
    }
    for (const sp of s.sprinklers) sprite('sprinkler', sp.x * TS, sp.y * TS - 2, 16, 16);

    // goods on the stand
    let k = 0;
    for (const it of s.stand) {
      const p = it && parseItem(it.id);
      if (!p || k >= 4) continue;
      sprite(p.crop, STAND.x * TS + 2 + k * 7, STAND.y * TS + 13, 8, 8);
      k++;
    }

    // where the farmer is heading, and the tile under the mouse
    const f = s.farmer;
    if (f.path.length) {
      const [tx, ty] = f.path[f.path.length - 1];
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.fillRect(tx * TS + 6, ty * TS + 7, 4, 2);
      ctx.fillRect(tx * TS + 7, ty * TS + 6, 2, 4);
    }
    if (fx.hover) {
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.lineWidth = 1 / zoom;
      ctx.strokeRect(fx.hover[0] * TS + 0.5, fx.hover[1] * TS + 0.5, TS - 1, TS - 1);
    }

    // people, back to front
    const people = [{ e: f, look: null }, ...s.customers.map((c) => ({ e: c, look: LOOKS[c.look % LOOKS.length] }))];
    people.sort((a, b) => a.e.y - b.e.y);
    for (const { e, look } of people) drawPerson(e, now, look);

    if (s.upgrades.drone) {
      const d = s.drone;
      sprite('drone', d.x * TS + 2, d.y * TS - 6 + Math.sin(now / 180) * 1.5, 12, 12);
    }

    // splashes and floating texts
    fx.splashes = fx.splashes.filter((sp) => now - sp.t0 < 600);
    for (const sp of fx.splashes) {
      const t = (now - sp.t0) / 600;
      ctx.globalAlpha = 1 - t;
      for (const [dx, dy] of [[3, 1], [9, -1], [12, 4]]) sprite('drop', sp.x * TS + dx, sp.y * TS + dy + t * 6, 4, 4);
    }
    ctx.globalAlpha = 1;
    fx.floats = fx.floats.filter((fl) => now - fl.t0 < 1100);
    ctx.font = 'bold 6px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 1.5;
    for (const fl of fx.floats) {
      const t = (now - fl.t0) / 1100;
      ctx.globalAlpha = 1 - t * t;
      ctx.strokeStyle = '#1b1b1b';
      ctx.strokeText(fl.text, fl.x, fl.y - t * 10);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, fl.x, fl.y - t * 10);
    }
    ctx.globalAlpha = 1;

    // night
    const dark = darkness(s.clock);
    if (dark > 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = `rgba(12,18,48,${dark})`;
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.setTransform(u, 0, 0, u, -cam.x * u, -cam.y * u);
      const glow = Math.min(1, dark / 0.4);
      for (const w of WINDOWS) {
        ctx.globalAlpha = 0.18 * glow;
        ctx.fillStyle = '#ffcf6b';
        ctx.fillRect(w.x - 6, w.y - 5, w.w + 12, w.h + 14);
        ctx.globalAlpha = glow;
        ctx.fillRect(w.x, w.y, w.w, w.h);
      }
      ctx.globalAlpha = 1;
    }
  }

  return {
    draw,
    resize,
    notify,
    tileFromClient,
    setHover(t) { fx.hover = t; },
  };
}
