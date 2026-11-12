// Turning state into a string and back. Anything unexpected falls back to safe values.

import { createState, shopItemById, cropById, parseItem, isSellable, TOOLS, canSize, forageById, isCornerSpot } from './sim.js';
import {
  SAVE_VERSION, MAX_ENERGY, DAY_START, PASS_OUT, STACK_MAX, IRRIGATION_R2, COOP, FORAGE_MAX, GIGS, MARKET, GAME_MIN_PER_SEC, FISHING,
  REQUESTS, HIVES, DECOR, PETS,
} from './data.js';
import { W, H, isWalkable, isPlotTile, OBJECTS, charAt } from './world.js';


export const SAVE_KEY = 'dev-farm/save-v4';
export const OLDER_KEYS = ['dev-farm/save-v3', 'dev-farm/save-v2'];

export function serialize(s) {
  return JSON.stringify({
    ...s,
    customers: [],
    farmer: {
      ...s.farmer, x: Math.round(s.farmer.x), y: Math.round(s.farmer.y), path: [], task: null, queue: [], job: null,
      // fishing is idle and goes on after a reload; anything else stops
      busy: s.farmer.busy?.what === 'fish' ? { what: 'fish', next: s.farmer.busy.next } : null,
    },
  });
}

const num = (v, min, max, fallback) =>
  (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
const int = (v, min, max, fallback) => Math.floor(num(v, min, max, fallback));

function slots(src, target, filter = () => true) {
  if (!Array.isArray(src)) return;
  for (let i = 0; i < target.length; i++) {
    const it = src[i];
    // before v23 fertilizer had no quality: it becomes ★★ (what the shop sells)
    const id = it?.id === 'fertilizer' ? 'fertilizer:2' : it?.id;
    if (it && parseItem(id) && filter(id)) {
      const n = int(it.n, 0, STACK_MAX, 0);
      if (n > 0) target[i] = { id, n };
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
  if (d.version !== SAVE_VERSION && d.version !== 4 && d.version !== 5 && !legacy) return fresh;

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
    s.orders = d.orders.slice(0, 20).filter((o) => o && (o.item ? shopItemById[o.item] : cropById[o.crop]))
      .map((o) => (o.item ? { item: o.item, n: int(o.n, 1, 999, 1) } : { crop: o.crop, n: int(o.n, 1, 999, 5) }));
  }
  s.irrigation = int(d.irrigation, 1, IRRIGATION_R2.length, 1);
  // before v5 sprinklers worked without a pump: keep old farms watering
  if (d.version < 5 && Array.isArray(d.sprinklers) && d.sprinklers.length) s.upgrades.pump = true;

  // the woods: keep the saved spots (older saves keep the fresh ones)
  if (Array.isArray(d.forage)) {
    s.forage = d.forage.slice(0, FORAGE_MAX).filter((f) => f && forageById[f.type] && isWalkable(f.x, f.y))
      .map((f) => ({ x: f.x, y: f.y, type: f.type }));
  }
  if (d.coop && typeof d.coop === 'object') {
    s.coop.built = d.coop.built === true;
    s.coop.hens = s.coop.built ? int(d.coop.hens, 0, COOP.maxHens, COOP.hens) : 0;
    s.coop.feed = Math.round(num(d.coop.feed, 0, COOP.feedCap, 0) * 10) / 10;
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
  if (d.pond && typeof d.pond === 'object') {
    s.pond.fish = int(d.pond.fish, 0, FISHING.daily.length - 1, s.pond.fish);
    s.pond.caught = int(d.pond.caught, 0, 99, 0);
  }
  if (s.tool === 'rod' && !s.upgrades.rod) s.tool = 'hand';

  const fx = int(d.farmer?.x, 0, W - 1, s.farmer.x);
  const fy = int(d.farmer?.y, 0, H - 1, s.farmer.y);
  if (isWalkable(fx, fy)) Object.assign(s.farmer, { x: fx, y: fy });
  if (['up', 'down', 'left', 'right'].includes(d.farmer?.dir)) s.farmer.dir = d.farmer.dir;
  const atPond = OBJECTS.pond.access.some(([x, y]) => x === s.farmer.x && y === s.farmer.y);
  if (d.farmer?.busy?.what === 'fish' && s.upgrades.rod && atPond) {
    s.farmer.busy = { what: 'fish', next: num(d.farmer.busy.next, 0, FISHING.every[1], FISHING.every[0]) };
  }

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
        fert: p.fert === true ? 2 : int(p.fert, 0, 3, 0),
        mulch: p.mulch === true,
        wetLeft: p.wetLeft === undefined ? (p.wet === true && !legacy ? 1 : 0) : int(p.wetLeft, 0, 3, 0),
        ripeDays: legacy ? 0 : int(p.ripeDays, 0, 99, 0),
        rotten: p.rotten === true,
      };
    }
  }

  slots(d.bag, s.bag);
  slots(d.chest, s.chest);
  slots(d.stand, s.stand, isSellable);

  // the town market (v6)
  if (d.market && typeof d.market === 'object') {
    for (const k of ['stall', 'van', 'worker']) s.market[k] = d.market[k] === true;
    s.market.worker = s.market.worker && s.market.van;
    const travel = MARKET.travel / GAME_MIN_PER_SEC;
    const trip = (t) => (t && ['go', 'sell', 'back'].includes(t.phase) ? {
      phase: t.phase, left: num(t.left, 0, travel, 0), timer: num(t.timer, 0, 60, 1),
      kg: int(t.kg, 0, big, 0), money: int(t.money, 0, big, 0),
    } : null);
    s.market.trips.farmer = s.market.stall ? trip(d.market.trips?.farmer) : null;
    s.market.trips.van = s.market.van ? trip(d.market.trips?.van) : null;
  }
  if (s.market.van) slots(d.cargo, s.cargo, isSellable);

  // weather, customers' orders, hives, decorations and the pet (v24)
  for (const k of ['weather', 'tomorrow']) if (d[k] === 'rain' || d[k] === 'sun') s[k] = d[k];
  if (Array.isArray(d.requests)) {
    s.requests = d.requests.slice(0, REQUESTS.max).filter((r) => r && cropById[r.crop]).map((r) => ({
      id: int(r.id, 1, big, 1), who: typeof r.who === 'string' ? r.who.slice(0, 40) : 'kupac', crop: r.crop,
      kg: int(r.kg, 1, 99, 1), tier: int(r.tier, 1, 5, 2), due: int(r.due, 1, 1e6, s.day),
    }));
  }
  const freeGrass = (x, y, taken) => ['.', '*'].includes(charAt(x, y)) && !taken.has(`${x},${y}`);
  const taken = new Set();
  if (Array.isArray(d.hives)) {
    for (const h of d.hives.slice(0, HIVES.max)) {
      const x = int(h?.x, 0, W - 1, -1);
      const y = int(h?.y, 0, H - 1, -1);
      if (!freeGrass(x, y, taken)) continue;
      taken.add(`${x},${y}`);
      s.hives.push({ x, y, honey: int(h.honey, 0, HIVES.cap, 0), days: int(h.days, 0, 1e6, 0) });
    }
  }
  if (Array.isArray(d.decor)) {
    for (const o of d.decor.slice(0, 500)) {
      const x = int(o?.x, 0, W - 1, -1);
      const y = int(o?.y, 0, H - 1, -1);
      if (!DECOR[o?.kind] || !freeGrass(x, y, taken)) continue;
      taken.add(`${x},${y}`);
      s.decor.push({ x, y, kind: o.kind });
    }
  }
  if (d.pet && PETS[d.pet.kind]) {
    s.pet = { kind: d.pet.kind, name: typeof d.pet.name === 'string' ? d.pet.name.slice(0, 20) : PETS[d.pet.kind].name, patted: int(d.pet.patted, 0, 1e6, 0) };
  }

  if (Array.isArray(d.sprinklers)) {
    const seen = new Set();
    for (const sp of d.sprinklers.slice(0, 200)) {
      const x = int(sp?.x, 0, W - 1, -1);
      const y = int(sp?.y, 0, H - 1, -1);
      if (x < 0 || y < 0 || !isCornerSpot(s, x, y) || seen.has(`${x},${y}`)) continue;
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
