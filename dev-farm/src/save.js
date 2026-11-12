// Turning state into a string and back. Anything unexpected falls back to safe values.

import { createState, cropById, parseItem, isSellable, TOOLS, canSize, forageById } from './sim.js';
import { SAVE_VERSION, MAX_ENERGY, DAY_START, PASS_OUT, STACK_MAX, IRRIGATION_RADII, COOP, FORAGE_MAX, GIGS } from './data.js';
import { W, H, isWalkable, isPlotTile } from './world.js';


export const SAVE_KEY = 'dev-farm/save-v4';
export const OLDER_KEYS = ['dev-farm/save-v3', 'dev-farm/save-v2'];

export function serialize(s) {
  return JSON.stringify({
    ...s,
    customers: [],
    farmer: { ...s.farmer, x: Math.round(s.farmer.x), y: Math.round(s.farmer.y), path: [], task: null, queue: [], job: null, busy: null },
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
  // Older farms are carried over. v2 had a well from the start and no counted seeds;
  // v2/v3 used plain coins (1 coin = 40 sr) and grew crops by the second.
  const fromV2 = d.version === 2;
  const legacy = d.version === 2 || d.version === 3;
  if (d.version !== SAVE_VERSION && !legacy) return fresh;

  const s = fresh.state;
  const big = Number.MAX_SAFE_INTEGER;
  s.day = int(d.day, 1, 1e6, 1);
  s.clock = num(d.clock, DAY_START, PASS_OUT - 1, DAY_START);
  s.money = legacy ? int(d.coins, 0, big / 40, 0) * 40 : int(d.money, 0, big, s.money);
  s.totalEarned = legacy ? int(d.totalEarned, 0, big / 40, 0) * 40 : int(d.totalEarned, 0, big, 0);
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
    s.orders = d.orders.slice(0, 10).filter((o) => o && (cropById[o.crop] || o.item === 'fertilizer'))
      .map((o) => (o.item ? { item: o.item, n: int(o.n, 1, 999, 1) } : { crop: o.crop, n: int(o.n, 1, 999, 5) }));
  }
  s.irrigation = int(d.irrigation, 1, IRRIGATION_RADII.length, 1);

  // the woods: keep the saved spots (older saves keep the fresh ones)
  if (Array.isArray(d.forage)) {
    s.forage = d.forage.slice(0, FORAGE_MAX).filter((f) => f && forageById[f.type] && isWalkable(f.x, f.y))
      .map((f) => ({ x: f.x, y: f.y, type: f.type }));
  }
  if (d.coop && typeof d.coop === 'object') {
    s.coop.built = d.coop.built === true;
    s.coop.hens = s.coop.built ? int(d.coop.hens, 0, COOP.maxHens, COOP.hens) : 0;
    s.coop.feed = int(d.coop.feed, 0, COOP.feedCap, 0);
    s.coop.eggs = int(d.coop.eggs, 0, COOP.eggCap, 0);
  }
  const titles = new Set(GIGS.map((g) => g.title));
  const gig = (g) => (g && titles.has(g.title) ? {
    id: int(g.id, 1, big, 1), title: g.title, hours: int(g.hours, 1, 8, 1),
    pay: int(g.pay, 0, 1e6, 0), energy: int(g.energy, 0, MAX_ENERGY, 0),
  } : null);
  if (d.gigs && typeof d.gigs === 'object') {
    s.gigs.offers = Array.isArray(d.gigs.offers) ? d.gigs.offers.slice(0, 5).map(gig).filter(Boolean) : [];
    const a = gig(d.gigs.active);
    s.gigs.active = a ? { ...a, left: num(d.gigs.active.left, 0, a.hours * 60, a.hours * 30) } : null;
    s.gigs.done = int(d.gigs.done, 0, big, 0);
  }
  if (fromV2) {
    s.upgrades.well = true;
    s.upgrades.wellPlan = true;
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
      const growDays = legacy ? (num(p.progress, 0, 1, 0) > 0 ? 1 : 0) : int(p.growDays, 0, 999, 0);
      s.plots[key] = {
        crop: p.crop,
        progress: num(p.progress, 0, 1, 0),
        wet: legacy ? false : p.wet === true,
        wetBy: p.wetBy === 'auto' ? 'auto' : p.wetBy === 'hand' ? 'hand' : null,
        wetDays: legacy ? growDays : num(p.wetDays, 0, growDays, 0),
        growDays,
        fert: p.fert === true,
        ripeDays: legacy ? 0 : int(p.ripeDays, 0, 99, 0),
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
      s.sprinklers.push({ x, y });
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
