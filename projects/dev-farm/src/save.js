// Turning state into a string and back. Anything unexpected falls back to safe values.

import { createState, cropById, parseItem, isSellable, TOOLS, canSize } from './sim.js';
import { SAVE_VERSION, MAX_ENERGY, DAY_START, PASS_OUT, STACK_MAX, WATER_DURATION } from './data.js';
import { W, H, isWalkable, isPlotTile } from './world.js';

export const OLD_KEY = 'dev-farm/save-v2';

export const SAVE_KEY = 'dev-farm/save-v3';

export function serialize(s) {
  return JSON.stringify({
    ...s,
    customers: [],
    farmer: { ...s.farmer, x: Math.round(s.farmer.x), y: Math.round(s.farmer.y), path: [], task: null },
  });
}

const num = (v, min, max, fallback) =>
  (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
const int = (v, min, max, fallback) => Math.floor(num(v, min, max, fallback));

function slots(src, target, filter = () => true) {
  if (!Array.isArray(src)) return;
  for (let i = 0; i < target.length; i++) {
    const it = src[i];
    if (it && parseItem(it.id) && filter(it.id)) {
      const n = int(it.n, 0, STACK_MAX, 0);
      if (n > 0) target[i] = { id: it.id, n };
    }
  }
}

// Returns { state, restored }.
export function deserialize(raw) {
  const fresh = { state: createState(Date.now() % 2147483646 + 1), restored: false };
  if (typeof raw !== 'string' || raw === '') return fresh;
  let d;
  try {
    d = JSON.parse(raw);
  } catch {
    return fresh;
  }
  if (!d || typeof d !== 'object') return fresh;
  // v2 farms had a well from the start and bought seeds on planting: keep them playable
  const fromV2 = d.version === 2;
  if (d.version !== SAVE_VERSION && !fromV2) return fresh;

  const s = fresh.state;
  const big = Number.MAX_SAFE_INTEGER;
  s.day = int(d.day, 1, 1e6, 1);
  s.clock = num(d.clock, DAY_START, PASS_OUT - 1, DAY_START);
  s.coins = int(d.coins, 0, big, s.coins);
  s.totalEarned = int(d.totalEarned, 0, big, 0);
  s.energy = num(d.energy, 0, MAX_ENERGY, MAX_ENERGY);
  if (TOOLS.includes(d.tool)) s.tool = d.tool;
  for (const k of Object.keys(s.upgrades)) s.upgrades[k] = d.upgrades?.[k] === true;
  if (cropById[d.seed]) s.seed = d.seed;
  for (const k of Object.keys(s.seeds)) s.seeds[k] = int(d.seeds?.[k], 0, 99999, 0);
  s.found.house = d.found?.house === true;
  if (Array.isArray(d.finds)) {
    s.finds = d.finds.slice(0, 20).filter((f) => f && cropById[f.crop] && isWalkable(f.x, f.y))
      .map((f) => ({ x: f.x, y: f.y, crop: f.crop, n: int(f.n, 1, 99, 1), what: typeof f.what === 'string' ? f.what.slice(0, 40) : 'sjeme' }));
  }
  if (Array.isArray(d.orders)) {
    s.orders = d.orders.slice(0, 10).filter((o) => o && cropById[o.crop]).map((o) => ({ crop: o.crop, n: int(o.n, 1, 999, 5) }));
  }
  if (fromV2) {
    s.upgrades.well = true;
    s.found.house = true;
    s.seeds.radish = 10;
  }
  s.water = int(d.water, 0, canSize(s), canSize(s));

  const fx = int(d.farmer?.x, 0, W - 1, s.farmer.x);
  const fy = int(d.farmer?.y, 0, H - 1, s.farmer.y);
  if (isWalkable(fx, fy)) Object.assign(s.farmer, { x: fx, y: fy });
  if (['up', 'down', 'left', 'right'].includes(d.farmer?.dir)) s.farmer.dir = d.farmer.dir;

  if (d.plots && typeof d.plots === 'object') {
    for (const key of Object.keys(s.plots)) {
      const p = d.plots[key];
      if (!p || !cropById[p.crop]) continue;
      s.plots[key] = {
        crop: p.crop,
        progress: num(p.progress, 0, 1, 0),
        water: num(p.water, 0, WATER_DURATION, 0),
        wetBy: p.wetBy === 'auto' ? 'auto' : p.wetBy === 'hand' ? 'hand' : null,
        wetTime: num(p.wetTime, 0, 1e7, 0),
        growTime: num(p.growTime, 0, 1e7, 0),
        fert: p.fert === true,
        ripe: num(p.ripe, 0, 1e7, 0),
        rotten: p.rotten === true,
      };
    }
  }

  slots(d.bag, s.bag);
  slots(d.chest, s.chest);
  slots(d.stand, s.stand, isSellable);

  if (Array.isArray(d.sprinklers)) {
    const seen = new Set();
    for (const sp of d.sprinklers.slice(0, 200)) {
      const x = int(sp?.x, 0, W - 1, -1);
      const y = int(sp?.y, 0, H - 1, -1);
      if (x < 0 || y < 0 || !isPlotTile(x, y) || seen.has(`${x},${y}`)) continue;
      seen.add(`${x},${y}`);
      s.sprinklers.push({ x, y, t: num(sp.t, 0, 60, 0) });
    }
  }

  s.drone.x = num(d.drone?.x, 0, W - 1, s.drone.x);
  s.drone.y = num(d.drone?.y, 0, H - 1, s.drone.y);
  s.rng = int(d.rng, 1, 2147483646, s.rng);
  s.nextId = int(d.nextId, 1, big, 1);
  s.stats.harvested = int(d.stats?.harvested, 0, big, 0);
  s.stats.sold = int(d.stats?.sold, 0, big, 0);
  return { state: s, restored: true };
}
