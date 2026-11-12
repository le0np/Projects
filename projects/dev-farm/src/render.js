// Draws the world with a camera that follows the farmer.
// Art comes from art.js (generated once and cached as canvases); game state from sim.js.

import { W, H, MAP, HOUSE, STAND, xy } from './world.js';
import { plotUnlocked, parseItem } from './sim.js';
import { Pix, hash01, withAlpha } from './pixel.js';
import * as A from './art.js';

const TS = A.TS;

// ------------------------------------------------------------------ art cache

function toCanvas(pix) {
  const c = document.createElement('canvas');
  c.width = pix.w;
  c.height = pix.h;
  c.getContext('2d').putImageData(new ImageData(pix.d, pix.w, pix.h), 0, 0);
  return c;
}

const cache = new Map();
function art(key, make) {
  let c = cache.get(key);
  if (!c) {
    c = toCanvas(make());
    cache.set(key, c);
  }
  return c;
}

export function iconUrl(name) {
  const key = `url:${name}`;
  if (!cache.has(key)) cache.set(key, art(`icon:${name}`, () => A.icon(name)).toDataURL());
  return cache.get(key);
}

const shadowSprite = (w) => art(`shadow:${w}`, () => {
  const p = new Pix(w, 6);
  p.ellipse(w / 2, 3, w / 2 - 0.5, 2.6, withAlpha('#06100a', 0.28));
  return p;
});

// ------------------------------------------------------------------ static props (y-sorted with people)

function buildProps(field2, hasWell) {
  const list = [];
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? MAP[y][x] : '');
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const ch = MAP[ty][tx];
      if (ch === 't') {
        const h = hash01(tx, ty, 41);
        const pine = h < 0.3;
        const v = Math.floor(h * 1000) % 3;
        const img = pine ? art(`pine${v % 2}`, () => A.pineTree(40 + v)) : art(`tree${v}`, () => A.roundTree(10 + v * 7));
        const cx = pine ? 22 : 26;
        list.push({ img, x: tx * TS + 16 - cx, y: ty * TS + 31 - 61, base: ty * TS + 28 });
      } else if (ch === 'f') {
        const mask = (at(tx - 1, ty) === 'f' ? 1 : 0) | (at(tx + 1, ty) === 'f' ? 2 : 0)
          | (at(tx, ty - 1) === 'f' ? 4 : 0) | (at(tx, ty + 1) === 'f' ? 8 : 0);
        list.push({ img: art(`fence${mask}`, () => A.fence(mask)), x: tx * TS, y: ty * TS - 8, base: ty * TS + 30 });
      }
    }
  }
  const S = A.HOUSE_SPRITE;
  list.push({ img: art('house', A.house), x: S.x, y: S.y, base: (HOUSE.y + HOUSE.h) * TS - 1 });
  list.push({ img: art('stand', A.stand), x: A.STAND_SPRITE.x, y: A.STAND_SPRITE.y, base: (STAND.y + STAND.h) * TS - 1, stand: true });
  list.push({ img: art('chest', A.chest), x: 11 * TS, y: 8 * TS, base: 8 * TS + 30 });
  list.push(hasWell
    ? { img: art('well', A.well), x: 15 * TS - 4, y: 6 * TS - 20, base: 6 * TS + 30 }
    : { img: art('wellSite', A.wellSite), x: 15 * TS - 4, y: 6 * TS - 20, base: 6 * TS + 30 });
  list.push({ img: art('workbench', A.workbench), x: 3 * TS - 6, y: 8 * TS - 8, base: 8 * TS + 30 });
  if (!field2) list.push({ img: art('sign', A.sign), x: 21 * TS, y: 13 * TS - 8, base: 13 * TS + 30 });
  return list;
}

// ------------------------------------------------------------------ lighting

// 0 during the day, up to 0.62 at night
export function darkness(clock) {
  const h = (clock / 60) % 24;
  if (h >= 6 && h < 17) return 0;
  if (h >= 17 && h < 21) return ((h - 17) / 4) * 0.62;
  if (h >= 21 || h < 5) return 0.62;
  return (6 - h) * 0.62;
}

const LIGHTS = [
  ...A.HOUSE_WINDOWS.map((w) => ({ x: A.HOUSE_SPRITE.x + w.x + w.w / 2, y: A.HOUSE_SPRITE.y + w.y + w.h / 2, r: 62 })),
  { x: A.HOUSE_SPRITE.x + A.HOUSE_LANTERN.x, y: A.HOUSE_SPRITE.y + A.HOUSE_LANTERN.y, r: 70 },
  { x: A.STAND_SPRITE.x + A.STAND_LANTERN.x, y: A.STAND_SPRITE.y + A.STAND_LANTERN.y, r: 58 },
];

const TIER_COLORS = ['', '#c9c2b6', '#f1ece0', '#a8ec7e', '#ffd84a'];

// ------------------------------------------------------------------ renderer

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const light = document.createElement('canvas');
  const lctx = light.getContext('2d');
  let dpr = 1;
  let cssW = 0;
  let cssH = 0;
  let zoom = 2;
  let userZoom = null; // chosen with the zoom buttons / wheel
  let ground = null;
  let props = [];
  let builtFor = null;
  const cam = { x: 0, y: 0, ready: false };
  const fx = { floats: [], splashes: [], sprays: [], smoke: [], hover: null, last: 0, smokeTimer: 0 };

  const waterTiles = [];
  const fireflyHomes = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (MAP[y][x] === '~') waterTiles.push([x, y]);
      if (MAP[y][x] === '.' && hash01(x, y, 61) < 0.05) fireflyHomes.push([x, y]);
    }
  }

  function resize() {
    const box = canvas.parentElement.getBoundingClientRect();
    cssW = Math.max(200, Math.floor(box.width));
    cssH = Math.max(260, Math.min(680, Math.floor(window.innerHeight - 230)));
    dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    zoom = closestZoom(userZoom ?? Math.max(32, Math.min(64, cssW / 16)) / TS);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    light.width = canvas.width;
    light.height = canvas.height;
    cam.ready = false;
  }
  resize();

  // zoom levels that map world pixels onto whole device pixels, so the art stays sharp
  function zoomLevels() {
    return [1, 1.5, 2, 2.5, 3, 4].filter((z) => Math.abs(z * dpr - Math.round(z * dpr)) < 1e-6);
  }
  function closestZoom(z) {
    return zoomLevels().reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a));
  }
  function stepZoom(dir) {
    const levels = zoomLevels();
    const i = levels.indexOf(zoom);
    const next = levels[Math.max(0, Math.min(levels.length - 1, i + dir))];
    userZoom = next * TS;
    zoom = next;
    return next;
  }

  function updateCamera(s, dt) {
    const viewW = cssW / zoom;
    const viewH = cssH / zoom;
    const fit = (center, view, size) =>
      (view >= size ? (size - view) / 2 : Math.min(size - view, Math.max(0, center - view / 2)));
    const tx = fit(s.farmer.x * TS + TS / 2, viewW, W * TS);
    const ty = fit(s.farmer.y * TS + TS / 2, viewH, H * TS);
    if (!cam.ready) {
      cam.x = tx;
      cam.y = ty;
      cam.ready = true;
    } else {
      const k = 1 - Math.exp(-dt * 7);
      cam.x += (tx - cam.x) * k;
      cam.y += (ty - cam.y) * k;
    }
  }

  function tileFromClient(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - r.left) / zoom + cam.x) / TS);
    const y = Math.floor(((clientY - r.top) / zoom + cam.y) / TS);
    return x >= 0 && y >= 0 && x < W && y < H ? [x, y] : null;
  }

  const img = (c, x, y) => ctx.drawImage(c, Math.round(x), Math.round(y));

  function drawPlot(s, i, now) {
    const p = s.plots[i];
    const [x, y] = xy(i);
    const px = x * TS;
    const py = y * TS;
    const growing = p.crop && !p.rotten && p.progress < 1;
    const wet = growing && p.water > 0;
    const v = (x * 7 + y * 3) % 3;
    img(art(`soil${wet ? 1 : 0}${v}`, () => A.soil(wet, v)), px, py);
    if (p.fert) img(art('fert', A.fertOverlay), px, py);
    if (!p.crop) return;
    const stage = p.rotten ? 'rotten' : p.progress >= 1 ? 'ripe' : p.progress < 0.34 ? 'sprout' : 'young';
    img(shadowSprite(18), px + 7, py + 26);
    const bob = stage === 'ripe' && Math.sin(now / 380 + i) > 0.7 ? -1 : 0;
    img(art(`crop:${p.crop}:${stage}`, () => A.crop(p.crop, stage)), px + 4, py + 2 + bob);
    if (stage === 'ripe' && Math.floor(now / 140 + i * 5) % 14 === 0) {
      ctx.fillStyle = '#fffbe0';
      ctx.fillRect(px + 24, py + 4, 1, 3);
      ctx.fillRect(px + 23, py + 5, 3, 1);
    }
    if (stage === 'rotten') {
      ctx.fillStyle = '#1b1712';
      for (let k = 0; k < 2; k++) {
        const a = now / (260 + k * 90) + k * 2;
        ctx.fillRect(Math.round(px + 16 + Math.cos(a) * 6), Math.round(py + 14 + Math.sin(a * 1.3) * 3), 1, 1);
      }
    }
    if (growing) {
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(px + 6, py + 29, 20, 2);
      ctx.fillStyle = wet ? '#7fd0ff' : '#e8c35a';
      ctx.fillRect(px + 6, py + 29, Math.max(1, Math.round(20 * p.progress)), 2);
      if (!wet) img(art('thirst', A.thirstDrop), px + 22, py + (Math.floor(now / 500) % 2));
    }
  }

  function personImage(kind, look, dir, frame) {
    const d = dir === 'left' || dir === 'right' ? 'side' : dir;
    return art(`${kind}:${look}:${d}:${frame}`, () => A.person({
      dir: d, frame, farmer: kind === 'farmer', ...(kind === 'villager' ? A.VILLAGERS[look % A.VILLAGERS.length] : {}),
    }));
  }

  function drawPerson(e, now, kind, look) {
    const moving = e.path?.length > 0;
    const frame = moving ? Math.floor(now / 120) % 4 : 0;
    const pic = personImage(kind, look, e.dir, frame);
    const px = Math.round(e.x * TS + 4);
    const py = Math.round(e.y * TS - 2);
    if (e.dir === 'left') {
      ctx.save();
      ctx.translate(px + pic.width, py);
      ctx.scale(-1, 1);
      ctx.drawImage(pic, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(pic, px, py);
    }
  }

  function notify(events, s, now) {
    const float = (x, y, text, color) => fx.floats.push({ x: x * TS + 16, y: y * TS, text, color, t0: now });
    for (const e of events) {
      if (e.type === 'harvest') float(e.x, e.y, '★'.repeat(e.tier), TIER_COLORS[e.tier]);
      else if (e.type === 'sale') float(STAND.x + 1, STAND.y, `+${e.coins}`, '#ffe066');
      else if (e.type === 'water') fx.splashes.push({ x: e.x, y: e.y, t0: now });
      else if (e.type === 'sprinkle') {
        fx.sprays.push({ x: e.x, y: e.y, t0: now });
        for (const [x, y] of e.tiles) fx.splashes.push({ x, y, t0: now + 250 });
      } else if (e.type === 'eat' || e.type === 'coffee') float(s.farmer.x, s.farmer.y - 0.6, `+${e.gain}⚡`, '#a8ec7e');
      else if (e.type === 'refill') float(s.farmer.x, s.farmer.y - 0.6, `💧${e.water}`, '#a9dcff');
    }
  }

  function draw(s, now) {
    const dt = fx.last ? Math.min(0.1, (now - fx.last) / 1000) : 0;
    fx.last = now;
    const key = `${s.upgrades.field2}|${s.upgrades.well}`;
    if (builtFor !== key) {
      if (!ground || !builtFor || builtFor.split('|')[0] !== String(s.upgrades.field2)) ground = toCanvas(A.terrain(s.upgrades.field2));
      props = buildProps(s.upgrades.field2, s.upgrades.well);
      builtFor = key;
    }
    updateCamera(s, dt);
    const u = zoom * dpr;
    const cx = Math.round(cam.x * u) / u;
    const cy = Math.round(cam.y * u) / u;
    const viewW = cssW / zoom;
    const viewH = cssH / zoom;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#16171a';
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.setTransform(u, 0, 0, u, -cx * u, -cy * u);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ground, 0, 0);

    // plots and sprinklers
    const x0 = Math.max(0, Math.floor(cx / TS) - 1);
    const y0 = Math.max(0, Math.floor(cy / TS) - 1);
    const x1 = Math.min(W - 1, Math.ceil((cx + viewW) / TS) + 1);
    const y1 = Math.min(H - 1, Math.ceil((cy + viewH) / TS) + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        if (s.plots[i] && plotUnlocked(s, i)) drawPlot(s, i, now);
      }
    }
    fx.sprays = fx.sprays.filter((sp) => now - sp.t0 < 1200);
    for (const sp of s.sprinklers) {
      const spraying = fx.sprays.some((f) => f.x === sp.x && f.y === sp.y);
      const frame = spraying ? Math.floor(now / 80) % 4 : 0;
      img(art(`sprinkler${frame}`, () => A.sprinkler(frame)), sp.x * TS, sp.y * TS - 4);
    }

    // places where seeds can be found
    for (const f of s.finds) {
      img(shadowSprite(14), f.x * TS + 9, f.y * TS + 26);
      img(art('find', A.findMarker), f.x * TS + 4, f.y * TS + 6);
      const ph = Math.floor(now / 160 + f.x * 3 + f.y) % 12;
      if (ph < 3) {
        ctx.fillStyle = '#fffbe0';
        const sx = f.x * TS + 8 + ((f.x * 5 + ph) % 16);
        const sy = f.y * TS + 6 + ((f.y * 3 + ph * 2) % 8);
        ctx.fillRect(sx, sy - 1, 1, 3);
        ctx.fillRect(sx - 1, sy, 3, 1);
      }
    }

    // shadows under people and the drone
    const people = [{ e: s.farmer, kind: 'farmer', look: 0 }, ...s.customers.map((c) => ({ e: c, kind: 'villager', look: c.look }))];
    for (const { e } of people) img(shadowSprite(18), e.x * TS + 7, e.y * TS + 27);
    if (s.upgrades.drone) img(shadowSprite(16), s.drone.x * TS + 8, s.drone.y * TS + 26);

    // props and people, back to front
    const inView = (p) => p.x < cx + viewW && p.x + p.img.width > cx && p.y < cy + viewH && p.y + p.img.height > cy;
    const items = props.filter(inView).map((p) => ({ base: p.base, p }));
    for (const person of people) items.push({ base: person.e.y * TS + 29, person });
    items.sort((a, b) => a.base - b.base);
    for (const it of items) {
      if (it.p) {
        img(it.p.img, it.p.x, it.p.y);
        if (it.p.stand) drawGoods(s);
      } else {
        drawPerson(it.person.e, now, it.person.kind, it.person.look);
      }
    }

    if (s.upgrades.drone) {
      const d = s.drone;
      const bob = Math.round(Math.sin(now / 220) * 1.5);
      const dx = Math.round(d.x * TS + 1);
      const dy = Math.round(d.y * TS - 20 + bob);
      img(art(`drone${Math.floor(now / 45) % 2}`, () => A.drone(Math.floor(now / 45) % 2)), dx, dy);
      if (Math.floor(now / 380) % 2) {
        ctx.fillStyle = '#7dff8a';
        ctx.fillRect(dx + 14, dy + 7, 2, 1);
      }
    }

    drawEffects(s, now, dt, cx, cy, viewW, viewH);
    drawMarkers(s, now);
    drawNight(s, now, cx, cy, u);
  }

  function drawGoods(s) {
    let k = 0;
    for (const it of s.stand) {
      const p = it && parseItem(it.id);
      if (!p) continue;
      const pic = art(`icon:${p.crop}`, () => A.icon(p.crop));
      img(pic, A.STAND_SPRITE.x + 6 + k * 10, A.STAND_SPRITE.y + 31 - (k % 2) * 2);
      if (++k >= 6) break;
    }
  }

  function drawEffects(s, now, dt, cx, cy, viewW, viewH) {
    // chimney smoke
    fx.smokeTimer -= dt;
    if (fx.smokeTimer <= 0) {
      fx.smokeTimer = 0.35;
      fx.smoke.push({ x: A.HOUSE_SPRITE.x + A.HOUSE_CHIMNEY.x, y: A.HOUSE_SPRITE.y + A.HOUSE_CHIMNEY.y, t0: now, seed: Math.random() });
    }
    fx.smoke = fx.smoke.filter((p) => now - p.t0 < 3600);
    for (const p of fx.smoke) {
      const age = (now - p.t0) / 1000;
      const size = Math.round(2 + age * 1.6);
      ctx.fillStyle = `rgba(214,214,220,${0.45 * (1 - age / 3.6)})`;
      ctx.fillRect(Math.round(p.x + age * 5 + Math.sin(age * 2 + p.seed * 6) * 2 - size / 2), Math.round(p.y - age * 10 - size / 2), size, size);
    }

    // water glints
    if (waterTiles.length) {
      for (let k = 0; k < 9; k++) {
        const cycle = Math.floor(now / 420) + k * 131;
        const t = waterTiles[Math.floor(hash01(cycle, k, 3) * waterTiles.length)];
        const gx = t[0] * TS + 4 + Math.floor(hash01(cycle, k, 4) * 24);
        const gy = t[1] * TS + 4 + Math.floor(hash01(cycle, k, 5) * 24);
        if (gx < cx || gy < cy || gx > cx + viewW || gy > cy + viewH) continue;
        ctx.fillStyle = 'rgba(240,250,255,.9)';
        ctx.fillRect(gx, gy, 1, 1);
        ctx.fillStyle = 'rgba(200,232,250,.6)';
        ctx.fillRect(gx - 1, gy, 3, 1);
      }
    }

    // sprinkler spray
    for (const sp of fx.sprays) {
      const t = (now - sp.t0) / 1200;
      const r = 6 + t * 30;
      ctx.fillStyle = `rgba(170,220,255,${0.75 * (1 - t)})`;
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2 + t * 4;
        ctx.fillRect(Math.round(sp.x * TS + 16 + Math.cos(a) * r), Math.round(sp.y * TS + 10 + Math.sin(a) * r * 0.55 + t * 8), 2, 2);
      }
    }

    // hand-watering splashes
    fx.splashes = fx.splashes.filter((sp) => now - sp.t0 < 700);
    for (const sp of fx.splashes) {
      const t = (now - sp.t0) / 700;
      if (t < 0) continue;
      ctx.fillStyle = `rgba(150,210,255,${1 - t})`;
      for (const [dx, dy] of [[8, 4], [16, 0], [23, 6], [12, 10], [20, 12]]) ctx.fillRect(sp.x * TS + dx, Math.round(sp.y * TS + dy + t * 12), 2, 3);
    }

    // floating texts
    fx.floats = fx.floats.filter((f) => now - f.t0 < 1300);
    ctx.font = 'bold 10px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    for (const f of fx.floats) {
      const t = (now - f.t0) / 1300;
      ctx.globalAlpha = 1 - t * t;
      const y = Math.round(f.y - t * 16);
      ctx.strokeStyle = '#1a140f';
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
    }
    ctx.globalAlpha = 1;
  }

  function corners(x, y, w, h, len, color) {
    ctx.fillStyle = color;
    for (const [ax, ay, sx, sy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]) {
      ctx.fillRect(sx > 0 ? ax : ax - len + 1, ay, len, 1);
      ctx.fillRect(ax, sy > 0 ? ay : ay - len + 1, 1, len);
    }
  }

  function drawMarkers(s, now) {
    const f = s.farmer;
    if (f.path.length) {
      const [tx, ty] = f.path[f.path.length - 1];
      const pulse = Math.floor(now / 200) % 2;
      corners(tx * TS + 6 - pulse, ty * TS + 6 - pulse, 20 + pulse * 2, 20 + pulse * 2, 4, 'rgba(255,240,180,.85)');
    }
    if (fx.hover) corners(fx.hover[0] * TS + 1, fx.hover[1] * TS + 1, TS - 2, TS - 2, 6, 'rgba(255,255,255,.85)');
  }

  function drawNight(s, now, cx, cy, u) {
    const dark = darkness(s.clock);
    if (dark <= 0) return;
    const glow = Math.min(1, dark / 0.4);
    const h = (s.clock / 60) % 24;
    const evening = h >= 17 && h < 21 ? 1 - (h - 17) / 4 : 0;
    const r = Math.round(10 + 50 * evening);
    const g = Math.round(14 + 14 * evening);
    const b = Math.round(42 - 6 * evening);

    // windows and lanterns light up
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#ffd77a';
    for (const w of A.HOUSE_WINDOWS) {
      const wx = A.HOUSE_SPRITE.x + w.x;
      const wy = A.HOUSE_SPRITE.y + w.y;
      for (const [ox, oy, ww, hh] of [[0, 0, 11, 10], [13, 0, 11, 10], [0, 12, 11, 10], [13, 12, 11, 10]]) ctx.fillRect(wx + ox, wy + oy, ww, hh);
    }
    ctx.fillRect(A.HOUSE_SPRITE.x + 138, A.HOUSE_SPRITE.y + 140, 3, 6);
    ctx.fillRect(A.STAND_SPRITE.x + 63, A.STAND_SPRITE.y + 17, 3, 5);
    ctx.globalAlpha = 1;

    // darkness with holes around the lights
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, light.width, light.height);
    lctx.fillStyle = `rgba(${r},${g},${b},${dark})`;
    lctx.fillRect(0, 0, light.width, light.height);
    lctx.globalCompositeOperation = 'destination-out';
    const toScreen = (wx, wy) => [(wx - cx) * u, (wy - cy) * u];
    for (const l of LIGHTS) {
      const [sx, sy] = toScreen(l.x, l.y);
      const rad = l.r * u;
      const grad = lctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
      grad.addColorStop(0, `rgba(0,0,0,${0.85 * glow})`);
      grad.addColorStop(0.5, `rgba(0,0,0,${0.45 * glow})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = grad;
      lctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(light, 0, 0);

    // warm glow and fireflies
    ctx.globalCompositeOperation = 'lighter';
    for (const l of LIGHTS) {
      const [sx, sy] = toScreen(l.x, l.y);
      const rad = l.r * 0.7 * u;
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
      grad.addColorStop(0, `rgba(255,170,70,${0.22 * glow})`);
      grad.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
    }
    if (dark > 0.3) {
      fireflyHomes.forEach(([fx0, fy0], k) => {
        if (Math.sin(now / 340 + k * 1.7) < 0.2) return;
        const wx = fx0 * TS + 16 + Math.sin(now / 1700 + k) * 18;
        const wy = fy0 * TS + 12 + Math.cos(now / 2300 + k * 1.3) * 10;
        const [sx, sy] = toScreen(Math.round(wx), Math.round(wy));
        if (sx < -20 || sy < -20 || sx > light.width + 20 || sy > light.height + 20) return;
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 6 * u);
        grad.addColorStop(0, 'rgba(220,255,120,.35)');
        grad.addColorStop(1, 'rgba(220,255,120,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx - 6 * u, sy - 6 * u, 12 * u, 12 * u);
        ctx.fillStyle = '#f4ffb0';
        ctx.fillRect(Math.round(sx), Math.round(sy), Math.ceil(u), Math.ceil(u));
      });
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  return {
    draw,
    resize,
    notify,
    tileFromClient,
    setHover(t) { fx.hover = t; },
    zoomIn: () => stepZoom(1),
    zoomOut: () => stepZoom(-1),
    setZoom(z) { userZoom = z * TS; zoom = closestZoom(z); },
    get zoom() { return zoom; },
    canZoom(dir) {
      const levels = zoomLevels();
      return dir > 0 ? zoom < levels[levels.length - 1] : zoom > levels[0];
    },
    // CSS position of a world pixel, relative to the canvas
    worldToCanvas(wx, wy) {
      const u = zoom * dpr;
      return { x: (wx - Math.round(cam.x * u) / u) * zoom, y: (wy - Math.round(cam.y * u) / u) * zoom };
    },
  };
}
