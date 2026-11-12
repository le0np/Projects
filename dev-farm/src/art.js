// All game art, generated pixel by pixel: terrain, props, people, crops and icons.
// Every generator returns a Pix buffer (no DOM), so the art is deterministic and testable.

import { Pix, pick, sphere, hash01, rng, vnoise, fbm, rgba, withAlpha } from './pixel.js';
import { W, H, MAP, HOUSE, STAND } from './world.js';

export const TS = 32; // pixels per tile

// colour ramps, dark → light
export const RAMP = {
  grass: ['#2a5226', '#33622d', '#3d7234', '#48823b', '#569443', '#68a64d', '#82bb5e'],
  bank: ['#384628', '#44552e', '#526535', '#62763e'],
  dirt: ['#5f442c', '#735437', '#866442', '#99744e', '#ab855c', '#bd976c'],
  road: ['#5e584c', '#6e6758', '#7f7766', '#918875', '#a39a86'],
  water: ['#25558f', '#2c64a3', '#3574b5', '#4387c6', '#5a9dd4', '#93c9ec', '#dff1fa'],
  soil: ['#3d2718', '#4d321f', '#5f3e27', '#714b30', '#84593a', '#966846'],
  soilWet: ['#22160e', '#2c1c12', '#372418', '#432d1e', '#503726', '#5e422f'],
  leaf: ['#1c4423', '#265a2a', '#327032', '#40853a', '#549b45', '#6fb556', '#93cd6f'],
  pine: ['#12352a', '#184531', '#1f573a', '#296a44', '#357d50', '#4a945f'],
  bark: ['#2e1e14', '#432b1b', '#5a3a24', '#714a2e', '#89603c'],
  wood: ['#3a2416', '#52331f', '#6b4429', '#865634', '#a06a41', '#ba8152', '#d19b6a'],
  log: ['#3f2817', '#5a3a21', '#76502e', '#91663b', '#aa7c4b', '#c4965f'],
  stone: ['#3f4048', '#55575f', '#6c6f78', '#868a92', '#a2a6ad', '#c0c3c8'],
  roof: ['#4a1e1a', '#622823', '#7c332b', '#963f34', '#ae4e3f', '#c5634f', '#d97f66'],
  straw: ['#7a5a26', '#977233', '#b48c42', '#cfa754', '#e2c26e', '#f0dc98'],
  skin: ['#7d4f35', '#a06848', '#c4865e', '#dca476', '#efc196', '#f8dbbd'],
  denim: ['#1b2846', '#253762', '#31497f', '#40609d', '#5679b6', '#7395cb'],
  redShirt: ['#5e1f1c', '#7d2b25', '#9c3830', '#b9493c', '#d1634f', '#e3836b'],
  boot: ['#1f140d', '#2f1f14', '#42301f', '#57412b'],
  metal: ['#2c3036', '#40454d', '#585e67', '#737a84', '#959ca5', '#bcc2ca'],
  gold: ['#5a3f12', '#80601e', '#a8822e', '#cfa744', '#ebcb6c', '#f8e5a4'],
  glass: ['#2c4a63', '#3c6280', '#527d9c', '#6d9bb8', '#94bfd6', '#c9e4f2'],
  shutter: ['#20382d', '#2b4a3b', '#385f4b', '#47755d', '#5c8e73'],
  radish: ['#5a0f22', '#7f1a33', '#a52844', '#c93c5a', '#e2607a', '#f294a8', '#fbc9d3'],
  carrot: ['#7a3207', '#a1450c', '#c75e14', '#e27a22', '#f29a3f', '#fbbf6e'],
  potato: ['#5e4325', '#7a5a33', '#957243', '#ae8a56', '#c6a36d', '#dcbe8b'],
  tomato: ['#5c0f0d', '#851914', '#ad261c', '#d03a27', '#e85b3e', '#f58a68', '#fcc0a6'],
  pumpkin: ['#6b2c08', '#8f3f0d', '#b45512', '#d46d1a', '#ec8a2a', '#f7a84b', '#fcca7c'],
  rot: ['#241c12', '#33281a', '#443622', '#57472c', '#6c5a36'],
  cabbage: ['#25452a', '#356138', '#4d8049', '#6d9e5f', '#93bd80', '#bfdcaa', '#e2f0d2'],
  chard: ['#14301f', '#1d4229', '#285834', '#367041', '#4a8a52', '#66a466'],
  chardStem: ['#6e1420', '#94202c', '#bd3440', '#da5560', '#ee8a90'],
  sweetpotato: ['#3e1622', '#5c2232', '#7e3243', '#a04757', '#c06a74', '#da9298'],
  hen: ['#8a7f6e', '#b5ab98', '#d9d2c3', '#f2eee4', '#ffffff'],
  henBrown: ['#4a2a14', '#6e3f1e', '#94582a', '#b5733c', '#d19455'],
  mushroom: ['#3e2214', '#5e3520', '#83502f', '#a86e44', '#c98e5e'],
  stem: ['#a89a80', '#cdbf9f', '#e8dcbf', '#f6efdc'],
  berry: ['#14081c', '#26102e', '#3c1a46', '#5a2a66', '#80508c'],
  egg: ['#b59c78', '#d3bd98', '#e8d6b6', '#f5ead6', '#fffaf0'],
  stripeRed: ['#6a1a1f', '#8d2428', '#b03332', '#cc4a43', '#e06a5e'],
  stripeCream: ['#9a8b70', '#b8a888', '#d3c4a2', '#e8dcbf', '#f6efdc'],
  burlap: ['#5e4a2e', '#7a6340', '#957d55', '#ae966b', '#c7b085'],
  slate: ['#1d2124', '#272c30', '#30363b'],
};

const HAIR = [
  ['#1b1410', '#2a1f18', '#3b2c21', '#4e3b2c', '#634c39'],
  ['#5a3a17', '#7a5222', '#9b6c2e', '#b98a42', '#d4a95e'],
  ['#4a1c0e', '#6e2a13', '#923a1a', '#b24f26', '#cc6a3a'],
  ['#3a3a3e', '#56565b', '#727279', '#8f8f96', '#adadb3'],
];
const SHIRTS = [
  ['#24452e', '#2f5b3b', '#3c734a', '#4d8c5b', '#64a571'],
  ['#4a2a5e', '#5e3777', '#744791', '#8b5ba9', '#a477c0'],
  ['#6a4a12', '#8a6318', '#ab7e22', '#c99a35', '#ddb555'],
  ['#1e3a5a', '#284d75', '#346292', '#4579ad', '#5e93c4'],
];

// ------------------------------------------------------------------ shared shapes

// A tapered, shaded leaf from (x0, y0) in direction `angle`.
function leaf(p, x0, y0, angle, len, width, ramp, light = 0) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let t = 0; t <= len; t += 0.35) {
    const k = t / len;
    const w = Math.max(0.5, Math.sin(Math.PI * Math.min(1, k * 0.95 + 0.05)) * width);
    for (let s = -w; s <= w; s += 0.35) {
      const x = x0 + dx * t - dy * s;
      const y = y0 + dy * t + dx * s;
      const side = s / w;
      let tone = 0.5 + light + 0.28 * (side * (dy * 0.5 - dx * 0.7)) - k * 0.08 + (1 - Math.abs(side)) * 0.12;
      if (Math.abs(s) < 0.45 && k > 0.1 && k < 0.9) tone -= 0.22; // midrib
      p.set(x, y, pick(ramp, tone, Math.floor(x), Math.floor(y)));
    }
  }
}

function ball(p, cx, cy, rx, ry, ramp, base = 0.1, clip = null) {
  p.ellipse(cx, cy, rx, ry, (nx, ny, x, y) => (clip && clip(x, y) ? null : pick(ramp, base + sphere(nx, ny) * 0.95, x, y)));
}

function flower(p, x, y, petal, center = '#f2c14b') {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) p.set(x + dx, y + dy, petal);
  p.set(x, y, center);
}

// ------------------------------------------------------------------ terrain

const M_GRASS = 0;
const M_PATH = 1;
const M_ROAD = 2;
const M_WATER = 3;
const M_SOIL = 4;
const M_WILD = 5;

function material(ch, field2) {
  if (ch === ',') return M_PATH;
  if (ch === 'r') return M_ROAD;
  if (ch === '~') return M_WATER;
  if (ch === 'P') return M_SOIL;
  if (ch === 'Q') return field2 ? M_SOIL : M_WILD;
  return M_GRASS;
}

function chamfer(w, h, isSource) {
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = isSource(i) ? 0 : 64;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i];
      if (v === 0) continue;
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - w] + 1);
        if (x > 0) v = Math.min(v, d[i - w - 1] + 1.41);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + 1.41);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i];
      if (v === 0) continue;
      if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 1);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + 1.41);
        if (x > 0) v = Math.min(v, d[i + w - 1] + 1.41);
      }
      d[i] = v;
    }
  }
  return d;
}

// the pond is drawn as one rounded blob inside its tiles
const POND = (() => {
  let x0 = W; let y0 = H; let x1 = 0; let y1 = 0;
  MAP.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '~') { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }));
  return { cx: ((x0 + x1 + 1) / 2) * TS, cy: ((y0 + y1 + 1) / 2) * TS, r: ((x1 - x0 + 1) / 2) * TS - 6 };
})();

// The static ground of the whole map (plots are drawn on top every frame).
export function terrain(field2) {
  const PW = W * TS;
  const PH = H * TS;
  const p = new Pix(PW, PH);
  const chAt = (tx, ty) => (tx >= 0 && ty >= 0 && tx < W && ty < H ? MAP[ty][tx] : 't');

  // 1) which material each pixel is; soft materials get wobbly borders
  const mat = new Uint8Array(PW * PH);
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      let base = material(chAt(x >> 5, y >> 5), field2);
      if (base === M_WATER) {
        const nx = (x - POND.cx) / POND.r;
        const ny = (y - POND.cy) / POND.r;
        if (nx * nx + ny * ny + (fbm(x / 28, y / 28, 31, 2) - 0.5) * 0.55 > 1) base = M_GRASS;
      }
      let m = base;
      if (base < M_WATER) {
        const jx = x + (vnoise(x * 0.09, y * 0.09, 11) - 0.5) * 11;
        const jy = y + (vnoise(x * 0.09, y * 0.09, 23) - 0.5) * 11;
        const j = material(chAt(Math.floor(jx / TS), Math.floor(jy / TS)), field2);
        if (j < M_WATER) m = j;
      }
      mat[y * PW + x] = m;
    }
  }
  const distLand = chamfer(PW, PH, (i) => mat[i] !== M_WATER);
  const distWater = chamfer(PW, PH, (i) => mat[i] === M_WATER);
  const distGreen = chamfer(PW, PH, (i) => mat[i] === M_GRASS || mat[i] === M_WILD);
  const distTrack = chamfer(PW, PH, (i) => mat[i] === M_PATH || mat[i] === M_ROAD);

  // 2) colour every pixel
  const d = p.d;
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      const i = y * PW + x;
      const big = fbm(x / 70, y / 70, 3, 3);
      const small = vnoise(x / 4.5, y / 4.5, 7);
      let c;
      switch (mat[i]) {
        case M_GRASS: {
          if (distWater[i] < 3.5) {
            c = pick(RAMP.bank, 0.25 + small * 0.6 + distWater[i] * 0.08, x, y);
            break;
          }
          const patch = fbm(x / 22, y / 22, 13, 2);
          let t = 0.2 + big * 0.5 + (patch - 0.5) * 0.35 + (small - 0.5) * 0.07;
          if (distTrack[i] < 3) t -= (3 - distTrack[i]) * 0.07;
          c = pick(RAMP.grass, t, x, y);
          break;
        }
        case M_WILD:
          c = pick(RAMP.grass, 0.08 + big * 0.45 + (small - 0.5) * 0.35, x, y);
          break;
        case M_PATH: {
          let t = 0.5 + (big - 0.5) * 0.45 + (small - 0.5) * 0.3;
          if (distGreen[i] < 3) t -= ((3 - distGreen[i]) / 3) * 0.35;
          c = pick(RAMP.dirt, t, x, y);
          break;
        }
        case M_ROAD: {
          let t = 0.5 + (big - 0.5) * 0.4 + (small - 0.5) * 0.3;
          const rx = x - 43 * TS;
          if (Math.abs(rx - 17) <= 1.5 || Math.abs(rx - 47) <= 1.5) t -= 0.28;
          if (distGreen[i] < 3) t -= ((3 - distGreen[i]) / 3) * 0.3;
          c = pick(RAMP.road, t, x, y);
          break;
        }
        case M_WATER: {
          const dl = distLand[i];
          if (dl <= 1.5) c = RAMP.water[6];
          else if (dl <= 3) c = RAMP.water[5];
          else {
            let t = 0.75 - Math.min(1, (dl - 3) / 12) * 0.6 + (big - 0.5) * 0.25;
            if (vnoise(x / 9, y / 2.2, 5) > 0.74) t += 0.22;
            c = pick(RAMP.water.slice(0, 5), t, x, y);
          }
          break;
        }
        default:
          c = pick(RAMP.soil, 0.45 + (small - 0.5) * 0.3, x, y);
      }
      const [r, g, b] = rgba(c);
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    }
  }

  // 3) shadows of things standing on the ground (light from the top left)
  const shadow = withAlpha('#0b1a0c', 0.3);
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) if (MAP[ty][tx] === 't') p.ellipse(tx * TS + 19, ty * TS + 29, 14, 5, shadow);
  }
  const hx = HOUSE.x * TS;
  const hy = HOUSE.y * TS;
  for (let y = hy + 80; y < hy + HOUSE.h * TS; y++) {
    const w = 4 + Math.round((y - hy - 80) * 0.1);
    p.rect(hx + HOUSE.w * TS - 4, y, w, 1, shadow);
  }
  p.ellipse(STAND.x * TS + 36, (STAND.y + 2) * TS - 2, 34, 5, shadow);
  p.ellipse(11 * TS + 18, 9 * TS - 3, 14, 4, shadow);
  p.ellipse(15 * TS + 19, 7 * TS - 3, 17, 5, shadow);
  p.ellipse(3 * TS + 18, 9 * TS - 2, 22, 4, shadow);

  // 4) small details: grass tufts, flowers, pebbles, weeds, lily pads
  const isMat = (x, y, m) => x >= 0 && y >= 0 && x < PW && y < PH && mat[Math.floor(y) * PW + Math.floor(x)] === m;
  const G = RAMP.grass;
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const ch = MAP[ty][tx];
      const r = rng(ty * 1000 + tx * 7 + 3);
      const ox = tx * TS;
      const oy = ty * TS;
      if (ch === '.' || ch === '*' || ch === 't') {
        const tufts = 3 + Math.floor(r() * 4);
        for (let k = 0; k < tufts; k++) {
          const x = ox + 3 + Math.floor(r() * 26);
          const y = oy + 4 + Math.floor(r() * 26);
          if (!isMat(x, y, M_GRASS) || distWater[y * PW + x] < 4) continue;
          p.set(x - 1, y, G[1]); p.set(x, y, G[1]); p.set(x + 1, y, G[1]);
          p.set(x - 1, y - 1, G[3]); p.set(x, y - 1, G[5]); p.set(x + 1, y - 1, G[4]);
          p.set(x, y - 2, G[6]); p.set(x - 2, y - 2, G[4]); p.set(x + 2, y - 2, G[5]);
        }
        if (r() < 0.07) {
          const x = ox + 6 + Math.floor(r() * 20);
          const y = oy + 8 + Math.floor(r() * 18);
          if (isMat(x, y, M_GRASS)) ball(p, x, y, 2.5, 1.8, RAMP.stone, 0.15);
        }
      }
      if (ch === '*') {
        const colors = ['#f4f1e6', '#f2d14b', '#f08cb0', '#8fb3f2', '#c49af0'];
        const n = 3 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const x = ox + 4 + Math.floor(r() * 24);
          const y = oy + 6 + Math.floor(r() * 22);
          p.set(x, y + 1, G[1]); p.set(x, y + 2, G[2]); p.set(x + 1, y + 2, G[3]);
          flower(p, x, y - 1, colors[Math.floor(r() * colors.length)], r() < 0.5 ? '#f2c14b' : '#e07b39');
        }
      }
      if (ch === ',' || ch === 'r') {
        const n = 3 + Math.floor(r() * 4);
        for (let k = 0; k < n; k++) {
          const x = ox + 2 + Math.floor(r() * 28);
          const y = oy + 2 + Math.floor(r() * 28);
          const ramp = ch === ',' ? RAMP.dirt : RAMP.road;
          if (r() < 0.5) {
            p.set(x, y, ramp[5 % ramp.length]); p.set(x + 1, y, ramp[4]); p.set(x, y + 1, ramp[1]); p.set(x + 1, y + 1, ramp[0]);
          } else {
            p.set(x, y, ramp[1]);
          }
        }
      }
      if (ch === 'Q' && !field2) {
        const n = 7 + Math.floor(r() * 5);
        for (let k = 0; k < n; k++) {
          const x = ox + 2 + Math.floor(r() * 28);
          const y = oy + 8 + Math.floor(r() * 22);
          const hgt = 4 + Math.floor(r() * 5);
          const dry = r() < 0.25;
          const lean = (r() - 0.5) * 3;
          p.line(x, y, x + lean, y - hgt, (px, py, t) => (dry ? pick(RAMP.straw, 0.3 + t * 0.5, px, py) : pick(G, 0.2 + t * 0.7, px, py)));
          if (r() < 0.12) flower(p, Math.floor(x + lean), y - hgt - 1, '#b07ad8', '#7a3fa8');
        }
      }
      if (ch === '~' || MAP[ty][tx] === '.') {
        for (let k = 0; k < 6; k++) {
          const x = ox + Math.floor(r() * 32);
          const y = oy + Math.floor(r() * 32);
          const dw = distWater[y * PW + x];
          if (mat[y * PW + x] !== M_GRASS || dw < 1 || dw > 3 || r() < 0.4) continue;
          const hgt = 6 + Math.floor(r() * 5);
          p.line(x, y, x, y - hgt, (px, py, t) => pick(RAMP.leaf, 0.25 + t * 0.5, px, py));
          if (r() < 0.6) p.rect(x, y - hgt - 2, 2, 4, (px, py) => pick(['#3d2414', '#5a3620', '#73482a'], py === y - hgt - 2 ? 0.9 : 0.4, px, py));
        }
      }
      if (ch === '~' && hash01(tx, ty, 9) < 0.3) {
        const x = ox + 8 + Math.floor(r() * 16);
        const y = oy + 8 + Math.floor(r() * 16);
        if (distLand[y * PW + x] > 7) {
          p.ellipse(x, y, 4.5, 3, (nx, ny, px, py) => (nx > 0.1 && Math.abs(ny) < 0.25 ? null : pick(RAMP.leaf, 0.35 + sphere(nx, ny) * 0.6, px, py)));
          if (r() < 0.5) flower(p, x - 1, y - 1, '#f6c6d8', '#f2d14b');
        }
      }
    }
  }
  return p;
}

// ------------------------------------------------------------------ trees and fences

export function roundTree(seed) {
  const p = new Pix(52, 66);
  const r = rng(seed);
  // trunk with roots
  for (let y = 38; y < 62; y++) {
    const flare = y > 54 ? (y - 54) * 0.7 : 0;
    for (let x = 22 - flare; x <= 29 + flare; x++) {
      const t = 0.75 - (x - 22 + flare) / (8 + flare * 2) * 0.6 + (vnoise(x * 0.7, y * 0.15, seed) - 0.5) * 0.35;
      p.set(x, y, pick(RAMP.bark, y < 44 ? t - 0.25 : t, x, y));
    }
  }
  // canopy: a cluster of shaded blobs
  const blobs = [[26, 25, 17, 15]];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + r() * 0.6;
    blobs.push([26 + Math.cos(a) * 10, 24 + Math.sin(a) * 8, 8 + r() * 3, 7 + r() * 3]);
  }
  for (let y = 2; y < 46; y++) {
    for (let x = 1; x < 51; x++) {
      let best = -1;
      let nx = 0;
      let ny = 0;
      for (const [cx, cy, rx, ry] of blobs) {
        const ax = (x + 0.5 - cx) / rx;
        const ay = (y + 0.5 - cy) / ry;
        const hgt = 1 - (ax * ax + ay * ay);
        if (hgt > best) { best = hgt; nx = ax; ny = ay; }
      }
      if (best < 0) continue;
      const leafy = vnoise(x / 2.6, y / 2.6, seed + 5) - 0.5;
      const t = 0.08 + sphere(nx, ny) * 0.55 + (1 - y / 46) * 0.25 + leafy * 0.32;
      p.set(x, y, pick(RAMP.leaf, t, x, y));
    }
  }
  return p.outline(0.45);
}

export function pineTree(seed) {
  const p = new Pix(44, 66);
  for (let y = 50; y < 62; y++) {
    for (let x = 19; x <= 24; x++) p.set(x, y, pick(RAMP.bark, 0.7 - (x - 19) * 0.12, x, y));
  }
  for (let tier = 0; tier < 4; tier++) {
    const top = 2 + tier * 11;
    const hgt = 20;
    for (let y = top; y < top + hgt; y++) {
      const k = (y - top) / hgt;
      const half = 3 + k * (8 + tier * 3.2);
      const jag = (Math.floor(y) % 3) * 0.8;
      for (let x = Math.floor(22 - half - jag); x <= 22 + half + jag; x++) {
        const side = (x - 22) / (half + 1);
        const t = 0.62 - side * 0.32 - k * 0.3 + (vnoise(x / 2, y / 2, seed) - 0.5) * 0.3;
        p.set(x, y, pick(RAMP.pine, t, x, y));
      }
    }
  }
  return p.outline(0.45);
}

// mask bits: 1 left, 2 right, 4 up, 8 down
export function fence(mask) {
  const p = new Pix(32, 40);
  const W8 = RAMP.wood;
  const rail = (x0, x1, y) => {
    for (let x = x0; x <= x1; x++) {
      p.set(x, y, W8[5]); p.set(x, y + 1, pick(W8, 0.55, x, y + 1)); p.set(x, y + 2, W8[3]); p.set(x, y + 3, W8[1]);
    }
  };
  if (mask & 4) p.rect(14, 0, 4, 14, (x) => pick(W8, x === 14 ? 0.7 : 0.4, x, 0));
  if (mask & 8) p.rect(14, 30, 4, 10, (x) => pick(W8, x === 14 ? 0.7 : 0.4, x, 0));
  if (mask & 1) { rail(0, 13, 16); rail(0, 13, 26); }
  if (mask & 2) { rail(18, 31, 16); rail(18, 31, 26); }
  // post
  for (let y = 9; y < 38; y++) {
    for (let x = 13; x <= 18; x++) {
      let t = 0.8 - (x - 13) * 0.13 + (vnoise(x, y / 3, 4) - 0.5) * 0.2;
      if (y < 12) t += 0.15;
      p.set(x, y, pick(W8, t, x, y));
    }
  }
  p.set(13, 9, null);
  p.set(18, 9, null);
  return p.outline(0.45);
}

// ------------------------------------------------------------------ buildings

// House footprint is 6×5 tiles; the sprite adds an 8 px overhang left/right and 32 px of roof above.
export const HOUSE_SPRITE = { x: HOUSE.x * TS - 8, y: HOUSE.y * TS - 32, w: 208, h: 192 };
export const HOUSE_WINDOWS = [34, 146].map((wx) => ({ x: wx + 3, y: 129, w: 24, h: 22 }));
export const HOUSE_LANTERN = { x: 140, y: 140 };
export const HOUSE_CHIMNEY = { x: 159, y: 2 };

export function house() {
  const p = new Pix(208, 192);
  const r = rng(77);
  const L = RAMP.log;

  // log walls
  for (let y = 104; y < 182; y++) {
    const row = Math.floor((y - 104) / 8);
    const ry = (y - 104) % 8;
    for (let x = 12; x <= 196; x++) {
      const grain = vnoise(x / 13, y / 1.6 + row * 40, 3) - 0.5;
      let t = [0.9, 0.75, 0.6, 0.55, 0.5, 0.45, 0.3, 0.08][ry] + grain * 0.25;
      if (x < 18 || x > 190) t -= 0.12;
      p.set(x, y, pick(L, t, x, y));
    }
  }
  // corner posts
  for (const x0 of [12, 191]) p.rect(x0, 104, 6, 78, (x, y) => pick(L, 0.62 - (x - x0) * 0.1 + (vnoise(x, y / 4, 8) - 0.5) * 0.2, x, y));
  // knots
  for (let k = 0; k < 9; k++) {
    const x = 24 + Math.floor(r() * 160);
    const y = 112 + Math.floor(r() * 9) * 8 + 3;
    if ((x > 30 && x < 70) || (x > 98 && x < 134) || (x > 140 && x < 184)) continue;
    p.ellipse(x, y, 1.6, 1.2, L[1]);
  }

  // stone foundation
  let sx = 8;
  while (sx < 200) {
    const w = 9 + Math.floor(r() * 7);
    const tone = r() * 0.25;
    for (let y = 181; y < 192; y++) {
      for (let x = sx; x < Math.min(200, sx + w - 1); x++) {
        const edge = x === sx || y === 181;
        const t = 0.35 + tone + (y < 184 ? 0.25 : 0) - (y > 189 ? 0.2 : 0) + (edge ? 0.12 : 0) + (vnoise(x / 2, y / 2, 9) - 0.5) * 0.2;
        p.set(x, y, pick(RAMP.stone, t, x, y));
      }
      p.set(Math.min(200, sx + w - 1), y, RAMP.stone[0]);
    }
    sx += w;
  }

  // windows with shutters, sills and flower boxes
  for (const wx of [34, 146]) {
    for (let y = 126; y < 154; y++) {
      for (let x = wx - 7; x < wx; x++) p.set(x, y, pick(RAMP.shutter, (y % 3 === 0 ? 0.25 : 0.6) - (x - wx + 7) * 0.04, x, y));
      for (let x = wx + 30; x < wx + 37; x++) p.set(x, y, pick(RAMP.shutter, (y % 3 === 0 ? 0.2 : 0.5) - (x - wx - 30) * 0.04, x, y));
    }
    p.rect(wx, 126, 30, 28, (x, y) => pick(RAMP.wood, 0.75 - (y - 126) * 0.01 - (x - wx) * 0.008, x, y));
    p.rect(wx + 3, 129, 24, 22, (x, y) => {
      const diag = (x - wx) + (y - 129);
      let t = 0.85 - (y - 129) / 22 * 0.55;
      if (diag > 10 && diag < 14) t += 0.3;
      if (diag > 18 && diag < 20) t += 0.2;
      return pick(RAMP.glass, t, x, y);
    });
    p.rect(wx + 14, 129, 2, 22, RAMP.wood[4]);
    p.rect(wx + 3, 139, 24, 2, RAMP.wood[4]);
    p.rect(wx - 2, 154, 34, 3, (x, y) => pick(RAMP.wood, y === 154 ? 0.9 : 0.5, x, y));
    p.rect(wx, 157, 30, 7, (x, y) => pick(RAMP.wood, 0.4 - (y - 157) * 0.04, x, y));
    for (let k = 0; k < 10; k++) {
      const fx = wx + 2 + Math.floor(r() * 26);
      const fy = 151 + Math.floor(r() * 5);
      p.set(fx, fy + 1, RAMP.leaf[3]); p.set(fx + 1, fy + 1, RAMP.leaf[4]); p.set(fx - 1, fy + 2, RAMP.leaf[2]);
      if (k % 2) flower(p, fx, fy, ['#e8443a', '#f2d14b', '#f4f1e6', '#f08cb0'][k % 4]);
    }
  }

  // door with frame, planks, hinges and a stone step
  p.rect(101, 128, 30, 54, (x, y) => pick(RAMP.wood, 0.55 - (x > 127 ? 0.25 : 0) + (y < 131 ? 0.25 : 0), x, y));
  for (let y = 132; y < 182; y++) {
    for (let x = 104; x < 128; x++) {
      const plank = (x - 104) % 6;
      let t = 0.48 - plank * 0.035 + (vnoise(x / 2, y / 9, 12) - 0.5) * 0.18;
      if (plank === 5) t = 0.12;
      const brace = Math.abs((x - 104) - (181 - y) * 0.48);
      if ((y > 144 && y < 168 && brace < 1.5) || y === 144 || y === 145 || y === 168 || y === 169) t += 0.2;
      p.set(x, y, pick(RAMP.wood, t, x, y));
    }
  }
  for (const hy of [140, 170]) p.rect(104, hy, 7, 3, (x) => pick(RAMP.metal, x === 104 ? 0.7 : 0.35, x, hy));
  p.rect(122, 156, 2, 4, (x, y) => pick(RAMP.gold, y === 156 ? 0.95 : 0.55, x, y));
  p.rect(96, 182, 40, 10, (x, y) => pick(RAMP.stone, (y < 184 ? 0.85 : 0.6) - (y - 182) * 0.04 + (vnoise(x / 3, y / 2, 4) - 0.5) * 0.2, x, y));

  // lantern beside the door
  p.rect(136, 137, 7, 2, RAMP.metal[1]);
  p.rect(137, 139, 5, 8, (x, y) => (x === 137 || x === 141 || y === 146 ? RAMP.metal[1] : pick(RAMP.gold, 0.7, x, y)));
  p.rect(137, 136, 5, 1, RAMP.metal[2]);

  // roof: staggered shingles on a trapezoid, with moss here and there
  const left = (y) => 30 - ((y - 8) / 96) * 30;
  const right = (y) => 178 + ((y - 8) / 96) * 30;
  for (let y = 8; y < 108; y++) {
    const row = Math.floor((y - 10) / 8);
    const ry = (((y - 10) % 8) + 8) % 8;
    for (let x = Math.floor(left(y)); x <= right(y); x++) {
      const off = (row % 2) * 6;
      const col = Math.floor((x + off) / 12);
      const cx = (x + off) % 12;
      const h = hash01(row, col, 5);
      let t = 0.5 + (h - 0.5) * 0.28 + (1 - y / 108) * 0.12;
      if (ry === 0) t += 0.28;
      else if (ry === 1) t += 0.12;
      else if (ry === 6) t -= 0.15;
      else if (ry === 7) t = 0.04;
      if (cx === 0) t -= 0.32;
      if (h < 0.035 && ry > 2 && ry < 6 && vnoise(x / 2, y / 2, row) > 0.5) {
        p.set(x, y, pick(RAMP.leaf, 0.35 + (ry < 3 ? 0.2 : 0), x, y));
        continue;
      }
      p.set(x, y, pick(RAMP.roof, t, x, y));
    }
    // barge boards along the slanted edges
    for (let k = 0; k < 3; k++) {
      p.set(Math.floor(left(y)) + k, y, pick(RAMP.wood, 0.6 - k * 0.15, 0, y));
      p.set(Math.floor(right(y)) - k, y, pick(RAMP.wood, 0.35 - k * 0.1, 0, y));
    }
  }
  // ridge caps
  for (let x = 28; x <= 180; x++) {
    for (let y = 4; y < 11; y++) {
      const t = 0.75 - Math.abs(y - 6.5) * 0.14 - ((x - 28) % 10 === 0 ? 0.3 : 0);
      p.set(x, y, pick(RAMP.roof, t, x, y));
    }
  }
  // fascia board and the shadow it throws on the wall
  p.rect(0, 104, 208, 6, (x, y) => pick(RAMP.wood, y === 104 ? 0.85 : 0.5 - (y - 105) * 0.08, x, y));
  for (let y = 110; y < 118; y++) p.rect(12, y, 185, 1, withAlpha('#120804', 0.45 - (y - 110) * 0.055));

  // chimney
  for (let y = 0; y < 38; y++) {
    for (let x = 150; x < 168; x++) {
      const brickRow = Math.floor(y / 5);
      const off = (brickRow % 2) * 3;
      const mortar = y % 5 === 4 || (x + off) % 6 === 0;
      const t = mortar ? 0.12 : 0.55 - (x - 150) * 0.022 + (hash01(Math.floor((x + off) / 6), brickRow, 2) - 0.5) * 0.3;
      p.set(x, y, pick(RAMP.stone, t, x, y));
    }
  }
  p.rect(148, 0, 22, 4, (x, y) => pick(RAMP.stone, y === 0 ? 0.85 : 0.45, x, y));
  return p.outline(0.4);
}

export const STAND_SPRITE = { x: STAND.x * TS - 4, y: STAND.y * TS - 8, w: 72, h: 72 };
export const STAND_LANTERN = { x: 64, y: 22 };

export function stand() {
  const p = new Pix(72, 72);
  // posts
  for (const x0 of [8, 60]) p.rect(x0, 12, 4, 58, (x, y) => pick(RAMP.wood, 0.7 - (x - x0) * 0.16 + (vnoise(x, y / 3, 3) - 0.5) * 0.2, x, y));
  // counter top and front planks
  p.rect(2, 44, 68, 6, (x, y) => pick(RAMP.wood, (y === 44 ? 0.95 : 0.72) - (y - 44) * 0.05 + (vnoise(x / 6, y, 4) - 0.5) * 0.15, x, y));
  for (let y = 50; y < 70; y++) {
    for (let x = 4; x < 68; x++) {
      const plank = (x - 4) % 8;
      let t = 0.5 - plank * 0.03 + (vnoise(x / 2, y / 8, 6) - 0.5) * 0.2 - (y - 50) * 0.008;
      if (plank === 7) t = 0.1;
      if (y === 50) t = 0.2;
      p.set(x, y, pick(RAMP.wood, t, x, y));
    }
  }
  // chalk sign on the front
  p.rect(25, 53, 22, 12, (x, y) => (x === 25 || x === 46 || y === 53 || y === 64 ? RAMP.wood[2] : pick(RAMP.slate, 0.5, x, y)));
  const chalk = '#d8dad2';
  for (const sx of [29, 37]) {
    p.set(sx + 2, 56, chalk); p.set(sx + 1, 57, chalk); p.set(sx + 2, 57, chalk); p.set(sx + 3, 57, chalk);
    p.set(sx, 58, chalk); p.set(sx + 4, 58, chalk); p.set(sx + 1, 59, chalk); p.set(sx + 3, 59, chalk);
  }
  p.rect(28, 61, 16, 1, withAlpha(chalk, 0.7));
  // awning: striped canvas with folds and a scalloped edge
  p.rect(2, 8, 68, 4, (x, y) => pick(RAMP.wood, y === 8 ? 0.85 : 0.45, x, y));
  for (let y = 12; y < 36; y++) {
    for (let x = 2; x < 70; x++) {
      const stripe = Math.floor((x - 2) / 8);
      const sxp = (x - 2) % 8;
      const scallopY = 31 + Math.sqrt(Math.max(0, 16 - (sxp - 3.5) ** 2));
      if (y > scallopY) continue;
      const ramp = stripe % 2 ? RAMP.stripeCream : RAMP.stripeRed;
      const t = 0.82 - sxp * 0.06 - (y - 12) * 0.012 + (y > 30 ? -0.12 : 0);
      p.set(x, y, pick(ramp, t, x, y));
    }
  }
  // lantern hanging from the right post
  p.set(64, 13, RAMP.metal[1]); p.set(64, 14, RAMP.metal[1]); p.set(64, 15, RAMP.metal[1]);
  p.rect(62, 16, 5, 7, (x, y) => (x === 62 || x === 66 || y === 22 ? RAMP.metal[1] : pick(RAMP.gold, 0.75, x, y)));
  return p.outline(0.4);
}

export function chest() {
  const p = new Pix(32, 32);
  for (let y = 14; y < 30; y++) {
    for (let x = 4; x < 28; x++) {
      const ry = (y - 14) % 5;
      let t = 0.62 - (x - 4) * 0.012 + (ry === 0 ? 0.18 : 0) - (ry === 4 ? 0.3 : 0) + (vnoise(x / 4, y, 2) - 0.5) * 0.15;
      if (y > 26) t -= 0.12;
      p.set(x, y, pick(RAMP.wood, t, x, y));
    }
  }
  p.ellipse(16, 14, 12.5, 8, (nx, ny, x, y) => (y > 14 ? null : pick(RAMP.wood, 0.35 + sphere(nx * 0.6, ny) * 0.6, x, y)));
  p.rect(4, 13, 24, 2, RAMP.wood[1]);
  for (const bx of [8, 21]) {
    for (let y = 6; y < 30; y++) {
      for (let x = bx; x < bx + 3; x++) if (p.alpha(x, y)) p.set(x, y, pick(RAMP.metal, 0.75 - (x - bx) * 0.22, x, y));
    }
    p.set(bx + 1, 18, RAMP.metal[5]); p.set(bx + 1, 25, RAMP.metal[5]);
  }
  p.rect(14, 12, 4, 6, (x, y) => pick(RAMP.gold, 0.9 - (x - 14) * 0.15 - (y - 12) * 0.05, x, y));
  p.set(15, 15, RAMP.gold[0]); p.set(16, 15, RAMP.gold[0]); p.set(15, 16, RAMP.gold[0]);
  return p.outline(0.4);
}

export function well() {
  const p = new Pix(40, 52);
  // posts and roof
  for (const x0 of [7, 30]) p.rect(x0, 9, 3, 26, (x, y) => pick(RAMP.wood, 0.7 - (x - x0) * 0.2, x, y));
  for (let y = 0; y < 12; y++) {
    const half = 8 + y * 1.25;
    for (let x = Math.floor(20 - half); x <= 20 + half; x++) {
      const t = 0.75 - (y % 3 === 2 ? 0.3 : 0) - Math.abs(x - 20) / half * 0.15 - (x > 20 ? 0.15 : 0);
      p.set(x, y, pick(RAMP.roof, t, x, y));
    }
  }
  p.rect(5, 11, 30, 2, RAMP.wood[2]);
  // crank, rope and bucket
  p.rect(10, 15, 20, 2, (x, y) => pick(RAMP.wood, y === 15 ? 0.6 : 0.3, x, y));
  p.rect(32, 13, 2, 6, RAMP.metal[3]);
  p.rect(19, 17, 1, 9, '#c9b07a');
  p.rect(16, 25, 8, 6, (x, y) => (y === 27 ? RAMP.metal[3] : pick(RAMP.wood, 0.7 - (x - 16) * 0.08, x, y)));
  // stone rim and body
  p.ellipse(20, 34, 15, 5.5, (nx, ny, x, y) => pick(RAMP.stone, 0.55 + sphere(nx * 0.4, ny) * 0.45, x, y));
  p.ellipse(20, 34, 11, 3.6, (nx, ny, x, y) => pick(RAMP.water, 0.15 + (nx < -0.2 && ny < 0 ? 0.4 : 0), x, y));
  for (let y = 35; y < 50; y++) {
    for (let x = 5; x < 36; x++) {
      const nx = (x - 20.5) / 15;
      if (Math.abs(nx) > 1) continue;
      if (y < 34 + Math.sqrt(1 - nx * nx) * 5.5) continue;
      const row = Math.floor((y - 35) / 5);
      const off = (row % 2) * 4;
      const mortar = (y - 35) % 5 === 4 || (x + off) % 8 === 0;
      const t = mortar ? 0.1 : 0.62 - nx * 0.3 - (y - 35) * 0.012 + (hash01(Math.floor((x + off) / 8), row, 4) - 0.5) * 0.3;
      p.set(x, y, pick(RAMP.stone, t, x, y));
    }
  }
  return p.outline(0.42);
}

// The chicken coop by the house (72 × 72 over a 2 × 2 tile footprint): broken or repaired.
export const COOP_SPRITE = { dx: -4, dy: -8 };
export function coop(broken) {
  const p = new Pix(72, 72);
  const r = rng(broken ? 31 : 30);
  const holes = broken ? [[14, 36, 5, 9], [50, 52, 6, 7], [22, 56, 4, 6]] : [];
  const inHole = (x, y) => holes.some(([hx, hy, w, h]) => x >= hx && x < hx + w && y >= hy && y < hy + h);
  // walls of vertical planks
  for (let y = 30; y < 68; y++) {
    for (let x = 10; x < 62; x++) {
      const plank = (x - 10) % 6;
      let t = 0.58 - plank * 0.04 + (vnoise(x / 2, y / 7, 3) - 0.5) * 0.22 - (x > 52 ? 0.08 : 0);
      if (plank === 5) t = 0.12;
      if (y > 64) t -= 0.12;
      p.set(x, y, inHole(x, y) ? '#1a120c' : pick(RAMP.wood, t, x, y));
    }
  }
  // door opening with straw, and a little ramp
  p.rect(30, 48, 12, 20, (x, y) => (y > 63 ? pick(RAMP.straw, 0.55 + (hash01(x, y, 4) - 0.5) * 0.4, x, y) : '#1f1610'));
  for (let y = 66; y < 72; y++) for (let x = 27; x < 45; x++) if ((y - 66) % 2 === 0 || x % 5) p.set(x, y, pick(RAMP.wood, 0.7 - (y - 66) * 0.06, x, y));
  // window with wire mesh
  p.rect(46, 38, 10, 8, (x, y) => ((x + y) % 3 === 0 ? RAMP.metal[3] : '#1f1610'));
  p.rect(45, 37, 12, 1, RAMP.wood[4]);
  p.rect(45, 46, 12, 1, RAMP.wood[2]);
  // roof
  for (let y = 10; y < 33; y++) {
    const k = (y - 10) / 22;
    const sag = broken ? Math.round(Math.sin((y - 10) / 3) * 1.2) : 0;
    const x0 = Math.round(16 - k * 12);
    const x1 = Math.round(56 + k * 12);
    for (let x = x0; x <= x1; x++) {
      const row = Math.floor((y - 10) / 5);
      const ry = (y - 10) % 5;
      const col = Math.floor((x + (row % 2) * 4) / 8);
      const missing = broken && hash01(row, col, 9) < 0.18;
      let t = 0.55 + (hash01(row, col, 2) - 0.5) * 0.25 + (ry === 0 ? 0.25 : ry === 4 ? -0.35 : 0);
      if ((x + (row % 2) * 4) % 8 === 0) t -= 0.25;
      p.set(x, y + sag, missing ? '#1a120c' : pick(broken ? RAMP.log : RAMP.roof, t, x, y));
    }
  }
  p.rect(4, 32, 64, 3, (x, y) => pick(RAMP.wood, y === 32 ? 0.75 : 0.35, x, y));
  if (broken) {
    // loose boards and weeds
    p.line(4, 66, 20, 70, (x, y) => pick(RAMP.wood, 0.5, x, y));
    p.line(50, 69, 66, 64, (x, y) => pick(RAMP.wood, 0.45, x, y));
    for (let k = 0; k < 9; k++) {
      const x = 8 + Math.floor(r() * 56);
      p.line(x, 67, x + (r() - 0.5) * 3, 60 - r() * 5, (px, py, t) => pick(RAMP.grass, 0.25 + t * 0.6, px, py));
    }
  } else {
    // straw peeking out of the window, a nest box sign
    for (const [x, y] of [[47, 45], [49, 45], [52, 45]]) p.set(x, y, RAMP.straw[4]);
    p.rect(14, 38, 10, 6, (x, y) => (x === 14 || x === 23 || y === 38 || y === 43 ? RAMP.wood[1] : pick(RAMP.wood, 0.85, x, y)));
    ball(p, 19, 41, 2.2, 1.6, RAMP.egg, 0.3);
  }
  return p.outline(0.42);
}

// A hen (14 × 12). Frame 1 pecks at the ground.
export function hen(brown, frame) {
  const p = new Pix(14, 12);
  const ramp = brown ? RAMP.henBrown : RAMP.hen;
  p.set(6, 11, RAMP.carrot[3]);
  p.set(8, 11, RAMP.carrot[3]);
  p.rect(6, 10, 1, 1, RAMP.carrot[2]);
  p.rect(8, 10, 1, 1, RAMP.carrot[2]);
  p.ellipse(6.5, 7, 5, 3.6, (nx, ny, x, y) => pick(ramp, 0.25 + sphere(nx, ny) * 0.75, x, y));
  for (const [x, y] of [[1, 4], [1, 5], [2, 3], [2, 4]]) p.set(x, y, ramp[1]);
  const [hx, hy] = frame ? [11, 7] : [10.5, 3.6];
  p.ellipse(hx, hy, 2.3, 2.2, (nx, ny, x, y) => pick(ramp, 0.4 + sphere(nx, ny) * 0.6, x, y));
  p.set(Math.floor(hx), Math.floor(hy) - 2, '#d23a2c');
  p.set(Math.floor(hx) + 1, Math.floor(hy) - 2, '#d23a2c');
  p.set(Math.floor(hx) + 2, Math.floor(hy), RAMP.carrot[4]);
  p.set(Math.floor(hx) + 3, Math.floor(hy), RAMP.carrot[3]);
  p.set(Math.floor(hx) + 1, Math.floor(hy) - 1, '#1b1410');
  p.set(Math.floor(hx), Math.floor(hy) + 2, '#d23a2c');
  return p.outline(0.45);
}

// The water pump mounted next to the well (20 × 20).
export function pumpProp() {
  const p = new Pix(20, 20);
  p.rect(3, 7, 12, 10, (x, y) => pick(['#5a1a1a', '#8a2626', '#b53a32', '#d4584a'], 0.85 - (y - 7) * 0.06 - (x - 3) * 0.03, x, y));
  p.ellipse(9, 12, 3.6, 3.6, (nx, ny, x, y) => pick(RAMP.metal, 0.3 + sphere(nx, ny) * 0.7, x, y));
  p.rect(15, 9, 4, 3, (x, y) => pick(RAMP.metal, y === 9 ? 0.8 : 0.4, x, y));
  p.rect(1, 9, 2, 3, RAMP.metal[2]);
  p.rect(6, 3, 3, 4, (x, y) => pick(RAMP.metal, x === 6 ? 0.8 : 0.4, x, y));
  p.rect(2, 17, 15, 2, (x, y) => pick(RAMP.stone, y === 17 ? 0.7 : 0.4, x, y));
  return p.outline(0.42);
}

// Things that grow in the woods (24 × 24).
export function forageSprite(type) {
  const p = new Pix(24, 24);
  const r = rng(type.length * 7);
  if (type === 'mushroom') {
    for (const [x, y, s] of [[8, 16, 1], [15, 18, 0.8], [12, 12, 0.65]]) {
      p.rect(x - 1.5 * s, y, 3 * s, 5 * s, (px, py) => pick(RAMP.stem, 0.8 - (px - x + 1.5 * s) * 0.15, px, py));
      p.ellipse(x, y, 5 * s, 3.4 * s, (nx, ny, px, py) => (ny > 0.35 ? null : pick(RAMP.mushroom, 0.15 + sphere(nx, ny) * 0.85, px, py)));
    }
  } else if (type === 'blackberry') {
    for (let k = 0; k < 9; k++) leaf(p, 12, 19, -Math.PI + (k / 8) * Math.PI, 7 + r() * 3, 2.6, RAMP.leaf, (k % 2) * 0.05);
    for (const [x, y] of [[7, 12], [11, 9], [16, 11], [13, 14], [9, 16], [17, 15]]) ball(p, x, y, 1.6, 1.6, RAMP.berry, 0.1);
  } else if (type === 'scrap') {
    for (let a = 0; a < Math.PI * 2; a += 0.15) {
      p.set(9 + Math.cos(a) * 5, 16 + Math.sin(a) * 3, pick(RAMP.leaf, 0.55 - Math.sin(a) * 0.2, 0, 0));
      p.set(9 + Math.cos(a) * 3, 16 + Math.sin(a) * 1.8, pick(RAMP.leaf, 0.35, 0, 0));
    }
    p.rect(14, 10, 6, 9, (x, y) => pick(RAMP.wood, 0.6 - (x - 14) * 0.08, x, y));
    p.rect(16, 7, 2, 4, RAMP.metal[3]);
    p.ellipse(17, 7, 2, 1.2, RAMP.metal[4]);
  } else if (type === 'branches') {
    for (const [x0, y0, x1, y1] of [[3, 19, 20, 14], [5, 13, 21, 20], [7, 21, 18, 10]]) {
      p.line(x0, y0, x1, y1, (x, y) => pick(RAMP.bark, 0.6, x, y));
      p.line(x0, y0 + 1, x1, y1 + 1, (x, y) => pick(RAMP.bark, 0.3, x, y));
    }
    leaf(p, 18, 11, -0.6, 4, 1.4, RAMP.leaf, 0);
  } else {
    for (const [x, y, rx, ry] of [[8, 16, 5, 3.6], [15, 17, 4.2, 3], [12, 12, 3.4, 2.6]]) ball(p, x, y, rx, ry, RAMP.stone, 0.12);
  }
  return p.outline(0.42);
}

// Where the well will be: stakes, string and a pile of stones (same frame as the well).
export function wellSite() {
  const p = new Pix(40, 52);
  const string = '#d8c9a0';
  const stakes = [[6, 34], [33, 34], [6, 49], [33, 49]];
  p.line(7, 33, 34, 33, string);
  p.line(7, 48, 34, 48, string);
  p.line(7, 33, 7, 48, string);
  p.line(34, 33, 34, 48, string);
  for (const [x, y] of stakes) p.rect(x, y - 7, 2, 8, (px, py) => pick(RAMP.wood, px === x ? 0.75 : 0.4, px, py));
  const r = rng(5);
  for (let k = 0; k < 9; k++) {
    const x = 13 + r() * 14;
    const y = 44 - (k > 5 ? 4 : 0) - (k > 7 ? 3 : 0) + r() * 3;
    ball(p, x, y, 3 + r() * 1.5, 2.2 + r(), RAMP.stone, 0.12);
  }
  p.rect(26, 38, 2, 9, (x, y) => pick(RAMP.wood, x === 26 ? 0.7 : 0.4, x, y));
  p.rect(23, 37, 8, 3, (x, y) => pick(RAMP.metal, 0.8 - (y - 37) * 0.2, x, y));
  return p.outline(0.42);
}

// A spot on the map where seeds can be found: a wild plant gone to seed.
export function findMarker() {
  const p = new Pix(24, 24);
  for (const [a, l] of [[-2.6, 7], [-1.9, 8], [-1.2, 8], [-0.5, 7]]) leaf(p, 12, 21, a, l, 1.8, RAMP.leaf, -0.05);
  p.line(12, 21, 12, 6, RAMP.leaf[2]);
  p.line(12, 12, 16, 7, RAMP.leaf[2]);
  p.line(12, 14, 7, 9, RAMP.leaf[2]);
  for (const [x, y] of [[12, 5], [16, 6], [7, 8]]) ball(p, x, y, 2.4, 2.2, RAMP.straw, 0.25);
  return p.outline(0.42);
}

export function workbench() {
  const p = new Pix(44, 40);
  for (const x0 of [6, 34]) p.rect(x0, 18, 4, 20, (x, y) => pick(RAMP.wood, 0.55 - (x - x0) * 0.12, x, y));
  p.rect(8, 30, 28, 2, RAMP.wood[2]);
  p.rect(2, 12, 40, 5, (x, y) => pick(RAMP.wood, 0.82 - (y - 12) * 0.08 + (vnoise(x / 7, y, 3) - 0.5) * 0.2, x, y));
  p.rect(2, 17, 40, 3, (x, y) => pick(RAMP.wood, 0.38 - (y - 17) * 0.08, x, y));
  // vise
  p.rect(2, 6, 7, 7, (x, y) => pick(RAMP.metal, 0.75 - (x - 2) * 0.06 - (y - 6) * 0.04, x, y));
  p.rect(0, 9, 3, 1, RAMP.metal[4]);
  // saw on the bench
  for (let x = 13; x < 30; x++) {
    const top = 8 + Math.floor((x - 13) * 0.12);
    for (let y = top; y < 12; y++) p.set(x, y, pick(RAMP.metal, 0.85 - (y - top) * 0.12, x, y));
    if (x % 2) p.set(x, 12, RAMP.metal[1]);
  }
  p.rect(30, 8, 5, 4, (x, y) => pick(RAMP.wood, 0.75 - (y - 8) * 0.1, x, y));
  // hammer
  p.rect(35, 5, 6, 3, (x, y) => pick(RAMP.metal, 0.8 - (y - 5) * 0.2, x, y));
  p.rect(37, 8, 2, 4, RAMP.wood[4]);
  // planks leaning on the side
  for (let k = 0; k < 2; k++) p.line(39 + k * 2, 14, 42 + k, 37, (x, y) => pick(RAMP.wood, 0.7 - k * 0.2, x, y));
  // shavings
  for (const [x, y] of [[14, 36], [16, 37], [24, 35], [27, 37], [20, 38]]) { p.set(x, y, '#e2c28c'); p.set(x + 1, y, '#c9a46a'); }
  return p.outline(0.42);
}

// tiny 3×5 font for carved signs
const GLYPHS = {
  g: ['111', '101', '111', '001', '111'],
  i: ['010', '000', '010', '010', '010'],
  t: ['010', '111', '010', '010', '011'],
};

export function sign() {
  const p = new Pix(32, 40);
  p.rect(14, 16, 4, 23, (x, y) => pick(RAMP.wood, 0.6 - (x - 14) * 0.12, x, y));
  p.rect(3, 4, 26, 15, (x, y) => pick(RAMP.wood, (y === 4 ? 0.85 : 0.62) - (y - 4) * 0.012 + (vnoise(x / 5, y, 2) - 0.5) * 0.15, x, y));
  let gx = 10;
  for (const ch of 'git') {
    GLYPHS[ch].forEach((row, y) => [...row].forEach((on, x) => { if (on === '1') p.set(gx + x, 9 + y, RAMP.wood[0]); }));
    gx += 4;
  }
  p.set(5, 6, RAMP.metal[2]); p.set(26, 6, RAMP.metal[2]);
  return p.outline(0.42);
}

// ------------------------------------------------------------------ machines

export function sprinkler(frame) {
  const p = new Pix(32, 32);
  p.ellipse(16, 27, 6, 2.5, (nx, ny, x, y) => pick(RAMP.metal, 0.3 + sphere(nx, ny) * 0.5, x, y));
  p.rect(15, 12, 3, 15, (x, y) => pick(RAMP.metal, 0.85 - (x - 15) * 0.25, x, y));
  const a = (frame / 4) * Math.PI;
  for (const s of [1, -1]) {
    const ex = 16.5 + Math.cos(a) * 6 * s;
    const ey = 11 + Math.sin(a) * 2.2 * s;
    p.line(16.5, 11, ex, ey, RAMP.metal[3]);
    p.set(ex, ey, '#4fa3e0');
  }
  p.ellipse(16.5, 11, 2.2, 1.8, (nx, ny, x, y) => pick(RAMP.metal, 0.3 + sphere(nx, ny) * 0.7, x, y));
  return p.outline(0.42);
}

export function drone(frame) {
  const p = new Pix(30, 18);
  for (const [x, y] of [[5, 4], [24, 4], [5, 13], [24, 13]]) p.line(15, 9, x, y, RAMP.metal[2]);
  p.rect(10, 6, 10, 6, (x, y) => pick(RAMP.metal, 0.55 - (y - 6) * 0.09 - (x - 10) * 0.02, x, y));
  p.rect(10, 8, 10, 1, '#e07b2a');
  p.ellipse(15, 12, 2, 1.2, RAMP.metal[0]);
  p.outline(0.45);
  for (const [x, y] of [[5, 4], [24, 4], [5, 13], [24, 13]]) {
    p.ellipse(x, y, 4.5, 1.6, withAlpha('#d8dde3', 0.45));
    if (frame) p.line(x - 4, y, x + 4, y, withAlpha('#f4f6f8', 0.8));
    else p.line(x - 2, y - 1, x + 2, y + 1, withAlpha('#f4f6f8', 0.8));
  }
  return p;
}

// ------------------------------------------------------------------ people (24 × 32, feet at the bottom)

const WALK = { legLift: [0, 1, 0, 1], side: [0, 1, 0, -1] };

export function person({ dir = 'down', frame = 0, farmer = false, hair = HAIR[0], shirt = RAMP.redShirt, pants = RAMP.denim, style = 'short' }) {
  const p = new Pix(24, 32);
  const S = RAMP.skin;
  const side = dir === 'side';
  const step = [0, 1, 0, 2][frame];
  const swing = [0, 1, 0, -1][frame];

  // legs and boots
  const leg = (x, lift, dark = 0) => {
    const end = 30 - lift;
    for (let y = 23; y < end - 1; y++) for (let k = 0; k < 3; k++) p.set(x + k, y, pick(pants, 0.55 - k * 0.15 - dark, x + k, y));
    for (let y = end - 1; y <= end; y++) for (let k = -1; k < 3; k++) p.set(x + k, y, pick(RAMP.boot, 0.6 - (k + 1) * 0.12 - dark, x + k, y));
  };
  if (side) {
    leg(10 - swing * 2, 0, 0.18);
    leg(10 + swing * 2, swing ? 1 : 0);
  } else {
    leg(8, step === 1 ? 1 : 0);
    leg(13, step === 2 ? 1 : 0);
  }

  // body
  const x0 = side ? 8 : 7;
  const x1 = side ? 15 : 16;
  for (let y = 14; y <= 24; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = 0.72 - ((x - x0) / (x1 - x0)) * 0.42 + (y === 14 ? 0.12 : 0) - (y > 22 ? 0.1 : 0);
      p.set(x, y, pick(shirt, t, x, y));
    }
  }
  if (farmer) {
    // overalls bib and straps
    const bx0 = side ? 10 : 9;
    const bx1 = side ? 15 : 14;
    for (let y = 17; y <= 24; y++) for (let x = bx0; x <= bx1; x++) p.set(x, y, pick(RAMP.denim, 0.68 - (x - bx0) * 0.08, x, y));
    if (dir !== 'up') {
      for (let y = 14; y < 17; y++) { p.set(bx0, y, RAMP.denim[3]); if (!side) p.set(bx1, y, RAMP.denim[2]); }
      p.set(bx0, 17, RAMP.gold[4]);
      if (!side) { p.set(bx1, 17, RAMP.gold[3]); p.rect(11, 20, 2, 2, RAMP.denim[2]); }
    } else {
      p.line(9, 14, 14, 18, RAMP.denim[2]);
      p.line(14, 14, 9, 18, RAMP.denim[3]);
    }
  } else {
    for (let x = x0; x <= x1; x++) p.set(x, 23, RAMP.boot[2]);
    if (!side && dir === 'down') p.rect(11, 23, 2, 1, RAMP.gold[3]);
  }

  // arms
  const arm = (x, dy, dark = 0) => {
    for (let y = 15 + dy; y < 21 + dy; y++) for (let k = 0; k < 2; k++) p.set(x + k, y, pick(shirt, 0.55 - k * 0.2 - dark, x + k, y));
    for (let y = 21 + dy; y < 23 + dy; y++) for (let k = 0; k < 2; k++) p.set(x + k, y, pick(S, 0.6 - k * 0.2 - dark, x + k, y));
  };
  if (side) arm(11 + swing, 0);
  else {
    arm(5, -swing);
    arm(17, swing, 0.15);
  }

  // head
  const hcx = side ? 12.5 : 11.5;
  p.rect(10, 13, 4, 2, S[2]);
  p.ellipse(hcx, 9.5, 5.3, 5.3, (nx, ny, x, y) => pick(S, 0.2 + sphere(nx, ny) * 0.85, x, y));
  if (dir === 'down') {
    p.rect(9, 9, 1, 2, '#2a1d17'); p.rect(14, 9, 1, 2, '#2a1d17');
    p.set(8, 8, S[1]); p.set(9, 8, S[1]); p.set(14, 8, S[1]); p.set(15, 8, S[1]);
    p.set(8, 12, '#e39a86'); p.set(15, 12, '#d98c78');
    p.rect(11, 13, 2, 1, S[1]);
  } else if (side) {
    p.rect(15, 9, 1, 2, '#2a1d17');
    p.set(18, 10, S[3]); p.set(18, 11, S[2]);
    p.set(11, 10, S[1]); p.set(11, 11, S[1]);
  }

  // hair
  const hairPixel = (x, y, t) => p.set(x, y, pick(hair, t, x, y));
  if (dir === 'up') {
    p.ellipse(hcx, 9, 5.5, 5.6, (nx, ny, x, y) => (y > 13 ? null : pick(hair, 0.2 + sphere(nx, ny) * 0.7, x, y)));
  } else if (!farmer) {
    p.ellipse(hcx, 7.4, 5.6, 3.8, (nx, ny, x, y) => (y > 8 ? null : pick(hair, 0.25 + sphere(nx, ny) * 0.75, x, y)));
    if (side) for (let y = 7; y < 13; y++) for (let x = 7; x < 11; x++) hairPixel(x, y, 0.35 - (x - 7) * 0.03);
    else for (let y = 8; y < 11; y++) { hairPixel(6, y, 0.45); hairPixel(7, y, 0.5); hairPixel(16, y, 0.3); hairPixel(17, y, 0.25); }
    if (dir === 'down') { hairPixel(9, 8, 0.6); hairPixel(10, 8, 0.55); hairPixel(13, 8, 0.4); }
  }
  if (!farmer && style === 'long' && dir !== 'up') {
    for (let y = 9; y < 18; y++) {
      if (side) { hairPixel(7, y, 0.3); hairPixel(8, y, 0.35); } else { hairPixel(5, y, 0.4); hairPixel(6, y, 0.45); hairPixel(17, y, 0.25); hairPixel(18, y, 0.2); }
    }
  }
  if (!farmer && style === 'bun') p.ellipse(hcx - (side ? 3 : 0), 3, 2.4, 2.2, (nx, ny, x, y) => pick(hair, 0.25 + sphere(nx, ny) * 0.7, x, y));
  if (!farmer && style === 'long' && dir === 'up') for (let y = 13; y < 18; y++) for (let x = 7; x < 17; x++) hairPixel(x, y, 0.4 - Math.abs(x - 11.5) * 0.03);

  // straw hat
  if (farmer) {
    if (dir !== 'up') for (let y = 8; y < 11; y++) { hairPixel(side ? 8 : 6, y, 0.4); if (!side) hairPixel(17, y, 0.3); }
    else for (let y = 8; y < 12; y++) for (let x = 7; x < 17; x++) if (p.alpha(x, y)) hairPixel(x, y, 0.35 + (x < 10 ? 0.15 : 0));
    const straw = (nx, ny, x, y) => pick(RAMP.straw, 0.25 + sphere(nx, ny) * 0.8 + (hash01(x, y, 3) - 0.5) * 0.25, x, y);
    p.ellipse(side ? 12.5 : 11.5, 6.4, 10, 2.3, straw);
    p.ellipse(side ? 11.8 : 11.5, 3.6, 4.9, 3.4, (nx, ny, x, y) => (y > 6 ? null : straw(nx, ny, x, y)));
    for (let x = 7; x <= 16; x++) if (p.alpha(x, 5)) p.set(x, 5, pick(RAMP.redShirt, 0.55 - (x - 7) * 0.04, x, 5));
  }
  return p.outline(0.38);
}

export const VILLAGERS = [
  { hair: HAIR[0], shirt: SHIRTS[0], pants: RAMP.denim, style: 'short' },
  { hair: HAIR[1], shirt: SHIRTS[1], pants: RAMP.boot, style: 'long' },
  { hair: HAIR[2], shirt: SHIRTS[2], pants: RAMP.denim, style: 'bun' },
  { hair: HAIR[3], shirt: SHIRTS[3], pants: RAMP.log, style: 'short' },
];

// ------------------------------------------------------------------ crops (24 × 28, standing on the bottom)

function seedling(p) {
  p.line(12, 27, 12, 22, RAMP.leaf[3]);
  leaf(p, 12, 22, -2.5, 5, 1.7, RAMP.leaf, 0.1);
  leaf(p, 12, 22, -0.65, 5, 1.7, RAMP.leaf, 0.1);
}

function frond(p, x0, y0, angle, len) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let t = 0; t <= len; t += 0.5) {
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    p.set(x, y, pick(RAMP.leaf, 0.35 + (t / len) * 0.2, x, y));
    if (t > 2 && Math.round(t * 2) % 4 === 0) {
      for (const s of [-1, 1]) {
        for (let k = 1; k <= 2; k++) {
          const lx = x - dy * s * k + dx * k * 0.6;
          const ly = y + dx * s * k + dy * k * 0.6;
          p.set(lx, ly, pick(RAMP.leaf, 0.5 + (s < 0 ? 0.2 : 0) - k * 0.05, lx, ly));
        }
      }
    }
  }
}

const tomatoBall = (p, x, y, r, ripe) => {
  ball(p, x, y, r, r, ripe ? RAMP.tomato : RAMP.leaf, ripe ? 0.05 : 0.3);
  p.set(x - 1, y - r + 0.5, RAMP.leaf[2]); p.set(x, y - r, RAMP.leaf[3]); p.set(x + 1, y - r + 0.5, RAMP.leaf[2]);
};

export function crop(id, stage) {
  const p = new Pix(24, 28);
  if (stage === 'sprout') {
    seedling(p);
    return p.outline(0.42);
  }
  const big = stage === 'ripe';
  if (stage === 'rotten') {
    for (const [a, l] of [[-2.9, 8], [-0.25, 8], [-2.4, 6], [-0.7, 6]]) leaf(p, 12, 22, a + 0.35, l, 2, RAMP.rot, -0.05);
    p.ellipse(12, 24, 6.5, 3.2, (nx, ny, x, y) => pick(RAMP.rot, 0.1 + sphere(nx, ny) * 0.5, x, y));
    for (const [x, y] of [[9, 23], [14, 24], [12, 22]]) p.set(x, y, '#8a9a52');
    return p.outline(0.42);
  }
  switch (id) {
    case 'radish': {
      const angles = [-2.75, -2.2, -1.6, -1.0, -0.42];
      angles.forEach((a, k) => leaf(p, 12, big ? 20 : 22, a, (big ? 11 : 8) - Math.abs(k - 2), 2.7, RAMP.leaf, k === 2 ? 0.08 : 0));
      if (big) {
        p.ellipse(12, 26, 6.5, 1.6, RAMP.soil[1]);
        ball(p, 12, 22.5, 5.5, 5, RAMP.radish, 0.08, (x, y) => y > 25);
      }
      break;
    }
    case 'carrot': {
      const angles = big ? [-2.45, -2.05, -1.7, -1.4, -1.05, -0.7] : [-2.25, -1.8, -1.3, -0.9];
      angles.forEach((a, k) => frond(p, 12, 24, a, (big ? 17 : 11) - Math.abs(k - angles.length / 2) * 1.5));
      if (big) {
        p.ellipse(12, 25.6, 5, 1.5, RAMP.soil[1]);
        p.ellipse(12, 24.5, 4.2, 2.4, (nx, ny, x, y) => pick(RAMP.carrot, 0.2 + sphere(nx, ny) * 0.85, x, y));
        p.set(10, 24, RAMP.carrot[1]); p.set(14, 25, RAMP.carrot[1]);
      }
      break;
    }
    case 'potato': {
      const angles = [-3.0, -2.55, -2.1, -1.57, -1.05, -0.6, -0.15];
      angles.forEach((a, k) => leaf(p, 12, big ? 18 : 21, a, (big ? 9 : 7) - Math.abs(k - 3) * 0.6, 3, RAMP.leaf, (k % 2) * 0.06));
      if (big) {
        for (const [x, y] of [[7, 9], [13, 6], [18, 11], [10, 13]]) flower(p, x, y, '#f3efe6', '#f0c23a');
        ball(p, 6.5, 24.5, 3.6, 2.4, RAMP.potato, 0.1);
        ball(p, 17.5, 25, 4, 2.5, RAMP.potato, 0.1);
        p.set(6, 24, RAMP.potato[1]); p.set(18, 24, RAMP.potato[1]); p.set(16, 26, RAMP.potato[1]);
      }
      break;
    }
    case 'tomato': {
      p.rect(17, big ? 2 : 8, 2, big ? 25 : 19, (x, y) => pick(RAMP.wood, x === 17 ? 0.7 : 0.35, x, y));
      p.line(12, 27, 12, big ? 6 : 12, RAMP.leaf[2]);
      const leaves = big
        ? [[12, 22, -2.7, 6], [12, 18, -0.35, 6], [12, 14, -2.6, 6], [12, 10, -0.45, 5], [12, 7, -2.2, 4]]
        : [[12, 22, -2.7, 5], [12, 18, -0.4, 5], [12, 15, -2.5, 4]];
      for (const [x, y, a, l] of leaves) leaf(p, x, y, a, l, 2.2, RAMP.leaf);
      p.set(17, 12, '#d8c49a'); p.set(18, 12, '#d8c49a'); p.set(17, 20, '#d8c49a');
      if (big) for (const [x, y, r] of [[8, 19, 3.2], [15, 15, 3.1], [8, 11, 2.8], [14, 22, 3.4], [15, 8, 2.5]]) tomatoBall(p, x, y, r, true);
      else tomatoBall(p, 9, 19, 1.8, false);
      break;
    }
    case 'pumpkin': {
      p.line(1, 25, 22, 22, (x, y) => pick(RAMP.leaf, 0.35, x, y));
      const bigLeaf = (cx, cy, rx, ry) => {
        p.ellipse(cx, cy, rx, ry, (nx, ny, x, y) => pick(RAMP.leaf, 0.15 + sphere(nx, ny) * 0.75 - (Math.abs(nx) < 0.12 ? 0.15 : 0), x, y));
      };
      bigLeaf(5, 18, 4.5, 3.6);
      bigLeaf(19, 16, 4.8, 3.8);
      if (big) {
        p.ellipse(13, 21, 9.5, 6.5, (nx, ny, x, y) => {
          const rib = Math.cos(nx * Math.PI * 2.6);
          let t = 0.08 + sphere(nx, ny) * 0.9;
          if (rib < -0.7) t -= 0.28;
          else if (rib > 0.9) t += 0.06;
          return pick(RAMP.pumpkin, t, x, y);
        });
        p.rect(12, 12, 3, 3, (x, y) => pick(['#3d4a1d', '#566526', '#6f8031', '#8a9a42'], 0.7 - (x - 12) * 0.2, x, y));
        p.set(15, 12, RAMP.leaf[3]); p.set(16, 11, RAMP.leaf[3]); p.set(17, 12, RAMP.leaf[3]);
      } else {
        flower(p, 12, 21, '#f2c23a', '#e07b2a');
        ball(p, 12, 24, 2.4, 1.8, RAMP.leaf, 0.3);
      }
      break;
    }
    case 'cabbage': {
      // broad outer leaves, a tight round head when ripe
      const outer = big ? [[-2.9, 9], [-2.2, 8], [-0.9, 8], [-0.25, 9], [-1.57, 6]] : [[-2.7, 7], [-1.9, 6], [-1.2, 6], [-0.45, 7]];
      for (const [a, l] of outer) leaf(p, 12, 22, a, l, 3.6, RAMP.cabbage, 0.05);
      if (big) {
        p.ellipse(12, 20.5, 6.8, 6, (nx, ny, x, y) => {
          const vein = Math.abs(Math.sin((nx * 2.2 + ny) * 3.2)) < 0.12;
          return pick(RAMP.cabbage, 0.3 + sphere(nx, ny) * 0.7 - (vein ? 0.18 : 0), x, y);
        });
      }
      break;
    }
    case 'chard': {
      const leaves = big ? [[-2.55, 15], [-2.05, 17], [-1.57, 18], [-1.1, 17], [-0.6, 15]] : [[-2.3, 9], [-1.6, 11], [-0.9, 9]];
      for (const [a, l] of leaves) {
        const sx = 12 + Math.cos(a) * l * 0.45;
        const sy = 26 + Math.sin(a) * l * 0.45;
        p.line(12, 26, sx, sy, (x, y, t) => pick(RAMP.chardStem, 0.65 - t * 0.2, x, y));
        leaf(p, sx, sy, a, l * 0.6, big ? 3.4 : 2.6, RAMP.chard, 0.08);
        p.line(sx, sy, sx + Math.cos(a) * l * 0.45, sy + Math.sin(a) * l * 0.45, RAMP.chardStem[2]);
      }
      break;
    }
    case 'sweetpotato': {
      // trailing vine with heart-shaped leaves; tubers show at the soil when ripe
      p.line(1, 24, 23, 21, (x, y) => pick(RAMP.leaf, 0.3, x, y));
      const heart = (cx, cy, r) => {
        p.ellipse(cx - r * 0.45, cy, r * 0.65, r * 0.6, (nx, ny, x, y) => pick(RAMP.leaf, 0.2 + sphere(nx, ny) * 0.7, x, y));
        p.ellipse(cx + r * 0.45, cy, r * 0.65, r * 0.6, (nx, ny, x, y) => pick(RAMP.leaf, 0.15 + sphere(nx, ny) * 0.65, x, y));
        p.ellipse(cx, cy + r * 0.45, r * 0.55, r * 0.55, (nx, ny, x, y) => pick(RAMP.leaf, 0.1 + sphere(nx, ny) * 0.6, x, y));
        p.set(cx, cy - r * 0.2, RAMP.sweetpotato[2]);
      };
      for (const [x, y, r] of big ? [[5, 18, 4], [12, 14, 4.5], [19, 17, 4], [9, 9, 3.5], [16, 8, 3.2]] : [[7, 19, 3.2], [14, 16, 3.6], [19, 20, 3]]) heart(x, y, r);
      if (big) {
        p.ellipse(9, 25, 4.6, 2.3, (nx, ny, x, y) => pick(RAMP.sweetpotato, 0.15 + sphere(nx, ny) * 0.85, x, y));
        p.ellipse(16.5, 25.5, 4, 2.1, (nx, ny, x, y) => pick(RAMP.sweetpotato, 0.15 + sphere(nx, ny) * 0.85, x, y));
      }
      break;
    }
    default:
      seedling(p);
  }
  return p.outline(0.42);
}

// ------------------------------------------------------------------ icons (16 × 16)

export function icon(name) {
  const p = new Pix(16, 16);
  switch (name) {
    case 'radish':
      for (const a of [-2.3, -1.57, -0.85]) leaf(p, 8, 7, a, 6, 1.8, RAMP.leaf);
      ball(p, 8, 10, 4.6, 4.3, RAMP.radish, 0.08);
      p.set(8, 15, RAMP.radish[5]);
      break;
    case 'carrot':
      for (const a of [-1.9, -1.2, -0.6]) frond(p, 11, 5, a, 5);
      leaf(p, 11, 4, 2.2, 13, 2.6, RAMP.carrot, 0.1);
      p.set(8, 8, RAMP.carrot[1]); p.set(6, 11, RAMP.carrot[1]);
      break;
    case 'potato':
      ball(p, 8, 9, 6.2, 4.7, RAMP.potato, 0.08);
      for (const [x, y] of [[6, 8], [10, 10], [8, 12], [11, 7]]) p.set(x, y, RAMP.potato[1]);
      break;
    case 'tomato':
      ball(p, 8, 9.5, 5.8, 5.3, RAMP.tomato, 0.05);
      for (const [x, y] of [[7, 4], [8, 3], [9, 4], [6, 5], [10, 5], [8, 4]]) p.set(x, y, RAMP.leaf[3]);
      break;
    case 'pumpkin':
      p.ellipse(8, 10, 7.2, 5.2, (nx, ny, x, y) => {
        const rib = Math.cos(nx * Math.PI * 2.4);
        return pick(RAMP.pumpkin, 0.08 + sphere(nx, ny) * 0.9 - (rib < -0.7 ? 0.28 : 0), x, y);
      });
      p.rect(7, 3, 2, 3, (x) => pick(['#3d4a1d', '#566526', '#6f8031'], x === 7 ? 0.9 : 0.4, x, 3));
      break;
    case 'cabbage':
      for (const a of [-2.6, -0.5, 2.4, 0.7]) leaf(p, 8, 9, a, 6.5, 2.6, RAMP.cabbage, 0.05);
      p.ellipse(8, 9, 5.4, 5, (nx, ny, x, y) => pick(RAMP.cabbage, 0.3 + sphere(nx, ny) * 0.7 - (Math.abs(Math.sin((nx * 2 + ny) * 3)) < 0.14 ? 0.18 : 0), x, y));
      break;
    case 'chard':
      for (const [a, l] of [[-2.0, 12], [-1.45, 13], [-0.95, 12]]) {
        p.line(8, 15, 8 + Math.cos(a) * 5, 15 + Math.sin(a) * 5, RAMP.chardStem[2]);
        leaf(p, 8 + Math.cos(a) * 5, 15 + Math.sin(a) * 5, a, l * 0.55, 2.6, RAMP.chard, 0.1);
      }
      break;
    case 'sweetpotato':
      leaf(p, 2.5, 12.5, -0.55, 13, 3.4, RAMP.sweetpotato, 0.12);
      p.set(6, 10, RAMP.sweetpotato[1]); p.set(10, 8, RAMP.sweetpotato[1]);
      p.line(13, 5, 15, 3, RAMP.leaf[3]);
      break;
    case 'fertilizer':
      p.rect(6, 2, 4, 3, (x, y) => pick(RAMP.burlap, 0.7 - (x - 6) * 0.1, x, y));
      p.rect(5, 4, 6, 1, '#7a3a24');
      p.ellipse(8, 10, 5.6, 5.4, (nx, ny, x, y) => pick(RAMP.burlap, 0.15 + sphere(nx, ny) * 0.8 + ((x + y) % 2 ? 0.05 : -0.05), x, y));
      leaf(p, 7, 12, -1.0, 4, 1.3, RAMP.leaf, 0.15);
      leaf(p, 8, 12, -2.1, 3, 1.1, RAMP.leaf, 0.1);
      break;
    case 'sprinkler':
      p.ellipse(8, 13.5, 4, 1.6, RAMP.metal[2]);
      p.rect(7, 5, 2, 9, (x) => pick(RAMP.metal, x === 7 ? 0.85 : 0.45, x, 0));
      p.line(3, 4, 13, 4, RAMP.metal[3]);
      p.set(2, 4, '#4fa3e0'); p.set(14, 4, '#4fa3e0');
      p.ellipse(8, 4, 1.8, 1.4, RAMP.metal[4]);
      break;
    case 'hand':
      p.ellipse(8, 10, 4.6, 4.4, (nx, ny, x, y) => pick(RAMP.log, 0.3 + sphere(nx, ny) * 0.7, x, y));
      for (const fx of [5, 7, 9, 11]) p.rect(fx, 3 + Math.abs(fx - 8) * 0.5, 2, 6, (x, y) => pick(RAMP.log, x === fx ? 0.75 : 0.5, x, y));
      p.ellipse(3.5, 10, 1.8, 2.6, RAMP.log[3]);
      p.rect(4, 14, 8, 2, RAMP.log[1]);
      break;
    case 'seeds':
      p.ellipse(8, 10, 5.5, 5, (nx, ny, x, y) => pick(RAMP.burlap, 0.2 + sphere(nx, ny) * 0.75, x, y));
      p.rect(6, 3, 4, 3, RAMP.burlap[2]);
      p.rect(5, 5, 6, 1, '#3d6e2e');
      for (const [x, y] of [[6, 9], [9, 11], [8, 8], [10, 9], [7, 12]]) p.set(x, y, '#e8d38c');
      break;
    case 'can': {
      p.ellipse(7, 10, 5.2, 4.6, (nx, ny, x, y) => pick(RAMP.shutter, 0.2 + sphere(nx, ny) * 0.85, x, y));
      p.line(11, 9, 15, 4, RAMP.shutter[2]);
      p.line(11, 10, 15, 5, RAMP.shutter[3]);
      p.rect(14, 3, 2, 2, RAMP.metal[4]);
      for (let a = 0; a <= Math.PI; a += 0.15) p.set(7 + Math.cos(a) * 3.5, 5 - Math.sin(a) * 3.2, RAMP.metal[3]);
      break;
    }
    case 'gold':
    case 'silver': {
      const ramp = name === 'gold' ? RAMP.gold : RAMP.metal;
      p.ellipse(8, 8.5, 6.5, 6.5, (nx, ny, x, y) => pick(ramp, 0.2 + sphere(nx, ny) * 0.8, x, y));
      p.ellipse(8, 8.5, 4.4, 4.4, (nx, ny, x, y) => pick(ramp, 0.65 - sphere(nx, ny) * 0.35, x, y));
      for (const [x, y] of [[8, 6], [7, 7], [8, 7], [9, 7], [8, 8], [8, 9], [7, 10], [8, 10], [9, 10], [8, 11]]) p.set(x, y, ramp[1]);
      p.set(5, 5, ramp[5]);
      p.set(6, 4, ramp[5]);
      break;
    }
    case 'hose':
      for (const [r, t] of [[6, 0.75], [4.4, 0.55], [2.8, 0.4]]) {
        for (let a = 0; a < Math.PI * 2; a += 0.12) p.set(8 + Math.cos(a) * r, 8.5 + Math.sin(a) * r * 0.8, pick(RAMP.leaf, t - Math.sin(a) * 0.15, 0, 0));
      }
      p.rect(13, 12, 2, 3, RAMP.metal[4]);
      break;
    case 'pump':
      p.rect(3, 6, 9, 8, (x, y) => pick(['#5a1a1a', '#8a2626', '#b53a32', '#d4584a'], 0.8 - (y - 6) * 0.08 - (x - 3) * 0.04, x, y));
      p.ellipse(7.5, 10, 3, 3, (nx, ny, x, y) => pick(RAMP.metal, 0.3 + sphere(nx, ny) * 0.7, x, y));
      p.rect(12, 8, 3, 2, RAMP.metal[3]);
      p.rect(5, 3, 2, 3, RAMP.metal[2]);
      p.rect(2, 14, 12, 1, RAMP.metal[1]);
      break;
    case 'egg':
      ball(p, 8, 9, 4.6, 5.8, RAMP.egg, 0.15);
      break;
    case 'mushroom':
      p.rect(6.5, 8, 4, 6, (x, y) => pick(RAMP.stem, 0.8 - (x - 6.5) * 0.15, x, y));
      p.ellipse(8.5, 8, 7, 4.6, (nx, ny, x, y) => (ny > 0.3 ? null : pick(RAMP.mushroom, 0.15 + sphere(nx, ny) * 0.85, x, y)));
      break;
    case 'blackberry':
      leaf(p, 9, 6, -0.9, 6, 2, RAMP.leaf, 0.1);
      for (const [x, y] of [[6, 9], [9, 10], [7, 12], [10, 13], [5, 12], [8, 8]]) ball(p, x, y, 1.7, 1.7, RAMP.berry, 0.15);
      break;
    case 'wood':
      for (const [x, y] of [[5, 11], [11, 11], [8, 6]]) {
        p.rect(x - 4, y - 2, 8, 4, (px, py) => pick(RAMP.bark, 0.6 - (py - y + 2) * 0.12, px, py));
        p.ellipse(x + 3, y, 2.2, 2.4, (nx, ny, px, py) => pick(RAMP.wood, 0.85 - Math.hypot(nx, ny) * 0.4, px, py));
      }
      break;
    case 'stone':
      ball(p, 6, 10, 4.6, 3.6, RAMP.stone, 0.12);
      ball(p, 11, 8, 3.8, 3.2, RAMP.stone, 0.12);
      break;
    case 'phone':
      p.rect(4, 1, 8, 14, (x, y) => (x === 4 || x === 11 || y === 1 || y === 14 ? RAMP.metal[1] : null));
      p.rect(5, 2, 6, 12, (x, y) => pick(RAMP.glass, 0.95 - (y - 2) * 0.05 + (x + y === 12 ? 0.2 : 0), x, y));
      p.rect(7, 13, 2, 1, RAMP.metal[3]);
      p.rect(6, 4, 4, 1, '#e8c35a');
      p.rect(6, 6, 3, 1, '#9fe07a');
      p.rect(6, 8, 4, 1, '#f1ece0');
      break;
    case 'drop':
      for (let y = 2; y < 15; y++) {
        const w = y < 8 ? (y - 2) * 0.75 : Math.sqrt(Math.max(0, 25 - (y - 9.5) ** 2));
        for (let x = Math.floor(8 - w); x <= 8 + w; x++) p.set(x, y, pick(RAMP.water, 0.95 - (x - 8 + w) / (2 * w + 1) * 0.5 - (y - 2) * 0.02, x, y));
      }
      p.set(6, 10, RAMP.water[6]); p.set(6, 11, RAMP.water[6]);
      break;
    default:
      return icon('potato');
  }
  return p.outline(0.4);
}

// small drop shown on thirsty plots (7 × 9)
export function thirstDrop() {
  const p = new Pix(9, 11);
  for (let y = 1; y < 10; y++) {
    const w = y < 5 ? (y - 1) * 0.6 : Math.sqrt(Math.max(0, 9 - (y - 6.5) ** 2));
    for (let x = Math.floor(4.5 - w); x <= 4.5 + w; x++) p.set(x, y, pick(RAMP.water, 0.9 - (y - 1) * 0.04 - (x > 4 ? 0.2 : 0), x, y));
  }
  p.set(3, 6, RAMP.water[6]);
  return p.outline(0.4);
}

// ------------------------------------------------------------------ plot soil textures (32 × 32)

export function soil(wet, variant) {
  const p = new Pix(32, 32);
  const ramp = wet ? RAMP.soilWet : RAMP.soil;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const n = vnoise(x / 2.5 + variant * 13, y / 2.5, 21) - 0.5;
      const wob = Math.round((vnoise(x / 5 + variant * 7, y / 9, 22) - 0.5) * 2);
      let t = 0.36 + n * 0.25;
      for (const cy of [7, 16, 25]) {
        const dy = y - cy - wob;
        if (Math.abs(dy) <= 3) t = 0.55 - dy * 0.075 + n * 0.22;
      }
      if (x === 0 || y === 0) t += 0.08;
      if (x === 31 || y === 31) t -= 0.16;
      p.set(x, y, pick(ramp, t, x, y));
    }
  }
  const r = rng(variant * 31 + (wet ? 7 : 3));
  for (let k = 0; k < 7; k++) {
    const x = 2 + Math.floor(r() * 28);
    const y = 2 + Math.floor(r() * 28);
    p.set(x, y, ramp[5]);
    if (wet && k < 4) p.set(x + 1, y, '#6f8fa6');
  }
  return p;
}

export function fertOverlay() {
  const p = new Pix(32, 32);
  const r = rng(99);
  for (let k = 0; k < 26; k++) p.set(2 + Math.floor(r() * 28), 2 + Math.floor(r() * 28), k % 3 ? '#d9cf9f' : '#a5c27a');
  return p;
}
