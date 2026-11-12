// Pure game rules: no DOM, so all of it runs (and is tested) in Node.
// Functions mutate the state object and push what happened into an `events` array.

import {
  SAVE_VERSION, START_MONEY, MAX_ENERGY, BAG_SIZE, CHEST_SIZE, STAND_SIZE, STACK_MAX, zl,
  GAME_MIN_PER_SEC, DAY_START, NIGHT_START, PASS_OUT, SLEEP_FROM, SHOP_OPEN, SHOP_CLOSE,
  WALK_SPEED, NPC_SPEED, DRONE_SPEED, DRONE_COOLDOWN, DRY_RATE,
  AUTO_WATER_CREDIT, CAN_SIZES, ENERGY_COST, COFFEE, EAT_ENERGY,
  TIER_PRICE, MACHINE_MAX_TIER, CUSTOMER_INTERVAL, CUSTOMER_KG, SEO_BONUS,
  CROPS, RECIPES, RIPE_PENALTY, ROT_DAY, SEEDS_FROM_FRUIT, SEED_PACK, HOUSE_SEEDS, START_FINDS,
  DAILY_FIND_CHANCE, FERTILIZER_PRICE, WELL_BUILD, IRRIGATION_RADII, IRRIGATION_COSTS,
  GOODS, FORAGE, FORAGE_START, FORAGE_DAILY, FORAGE_MAX, COOP, GIGS, GIG_OFFERS, GIG_ENERGY_PER_HOUR,
} from './data.js';
import {
  idx, xy, charAt, isWalkable, isPlotTile, objectAt, OBJECTS, PLOTS_A, PLOTS_B, inFieldA,
  HOUSE_DOOR, DRONE_HOME, SPAWNS, CUSTOMER_SPOT, npcCost, FOREST_EDGE,
} from './world.js';
import { findPath } from './path.js';

export const cropById = Object.fromEntries(CROPS.map((c) => [c.id, c]));
// everything that can be sold: crops plus forage and eggs
export const goodById = Object.fromEntries([...CROPS, ...GOODS].map((g) => [g.id, { unit: 'kg', ...g }]));
export const forageById = Object.fromEntries(FORAGE.map((f) => [f.id, f]));
export const recipeById = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const TOOLS = ['hand', 'seed', 'can', 'fert'];
const EPS = 1e-9;

// ---------------------------------------------------------------- state

// progress: 0..1 towards ripe; wet: watered today; wetDays/growDays: how many of the days
// it grew it was watered (quality); ripeDays: days it has been waiting ripe.
export function makePlot() {
  return { crop: null, progress: 0, wet: false, wetBy: null, wetDays: 0, growDays: 0, fert: false, ripeDays: 0, rotten: false };
}

const emptySlots = (n) => Array(n).fill(null);

function baseState(seed) {
  const plots = {};
  for (const i of [...PLOTS_A, ...PLOTS_B]) plots[i] = makePlot();
  return {
    version: SAVE_VERSION,
    day: 1,
    clock: DAY_START,
    money: zl(START_MONEY), // srebrenjaci
    totalEarned: 0, // srebrenjaci
    energy: MAX_ENERGY,
    tool: 'hand',
    seed: CROPS[0].id,
    water: CAN_SIZES[0],
    seeds: Object.fromEntries(CROPS.map((c) => [c.id, 0])),
    found: { house: false },
    finds: START_FINDS.map((f) => ({ ...f })),
    orders: [],
    forage: [],
    coop: { built: false, hens: 0, feed: 0, eggs: 0 },
    gigs: { offers: [], active: null, done: 0 },
    upgrades: { wellPlan: false, well: false, bigCan: false, drone: false, replant: false, seo: false, field2: false },
    irrigation: 1,
    farmer: { x: HOUSE_DOOR[0], y: HOUSE_DOOR[1], dir: 'down', path: [], task: null, queue: [], job: null, busy: null },
    plots,
    bag: emptySlots(BAG_SIZE),
    chest: emptySlots(CHEST_SIZE),
    stand: emptySlots(STAND_SIZE),
    sprinklers: [],
    drone: { x: DRONE_HOME[0], y: DRONE_HOME[1], target: null, cool: 0, blocked: false },
    customers: [],
    customerTimer: 8,
    rng: seed,
    nextId: 1,
    stats: { harvested: 0, sold: 0 },
  };
}

export function createState(seed = 12345) {
  const s = baseState(seed);
  // a few things to pick close to the house, so the woods are discovered on day one
  const [hx, hy] = HOUSE_DOOR;
  const near = [...FOREST_EDGE].sort((a, b) => Math.hypot(a[0] - hx, a[1] - hy) - Math.hypot(b[0] - hx, b[1] - hy)).slice(0, 30);
  for (const type of ['branches', 'rocks', 'mushroom', 'branches']) {
    const free = near.filter(([x, y]) => forageAt(s, x, y) < 0);
    const [x, y] = free[Math.floor(rand(s) * free.length)];
    s.forage.push({ x, y, type });
  }
  spawnForage(s, FORAGE_START - 4);
  return s;
}

function rand(s) {
  s.rng = (s.rng * 16807) % 2147483647;
  return s.rng / 2147483647;
}

export const canSize = (s) => CAN_SIZES[s.upgrades.bigCan ? 1 : 0];
export const isNight = (clock) => clock >= NIGHT_START || clock < DAY_START;
export const shopOpen = (clock) => clock >= SHOP_OPEN && clock < SHOP_CLOSE;
// "unlocked" = available in the seed delivery catalogue
export const isUnlocked = (s, id) => Boolean(cropById[id]) && s.totalEarned >= zl(cropById[id].unlock);
export const findAt = (s, x, y) => s.finds.findIndex((f) => f.x === x && f.y === y);
export const plotUnlocked = (s, i) => inFieldA(i) || (s.upgrades.field2 && s.plots[i] !== undefined);
export const sprinklerAt = (s, x, y) => s.sprinklers.findIndex((p) => p.x === x && p.y === y);

// ---------------------------------------------------------------- items

export const cropItem = (crop, tier) => `crop:${crop}:${tier}`;

export function parseItem(id) {
  if (id === 'fertilizer' || id === 'sprinkler' || id === 'wood' || id === 'stone') return { kind: id };
  const m = /^crop:([a-z]+):([1-4])$/.exec(id ?? '');
  if (m && goodById[m[1]]) return { kind: 'crop', crop: m[1], tier: Number(m[2]) };
  return null;
}

const isBad = (id) => parseItem(id)?.tier === 1;
export const isSellable = (id) => parseItem(id)?.kind === 'crop';
// srebrenjaci per kg
export const salePrice = (crop, tier) => Math.round(zl(goodById[crop].price) * TIER_PRICE[tier]);

export function canAdd(slots, id) {
  return slots.some((it) => it === null || (it.id === id && it.n < STACK_MAX));
}

// How many units of `id` still fit.
export const spaceFor = (slots, id) =>
  slots.reduce((a, it) => a + (it === null ? STACK_MAX : it.id === id ? STACK_MAX - it.n : 0), 0);

// Adds up to n items, returns how many fitted.
export function addItem(slots, id, n = 1) {
  let left = n;
  for (const it of slots) {
    if (left && it && it.id === id && it.n < STACK_MAX) {
      const k = Math.min(left, STACK_MAX - it.n);
      it.n += k;
      left -= k;
    }
  }
  for (let i = 0; i < slots.length && left; i++) {
    if (slots[i] === null) {
      const k = Math.min(left, STACK_MAX);
      slots[i] = { id, n: k };
      left -= k;
    }
  }
  return n - left;
}

export const countWhere = (slots, pred) => slots.reduce((a, it) => a + (it && pred(it.id) ? it.n : 0), 0);

function takeWhere(slots, pred, n) {
  let left = n;
  for (let i = 0; i < slots.length && left; i++) {
    const it = slots[i];
    if (it && pred(it.id)) {
      const k = Math.min(left, it.n);
      it.n -= k;
      left -= k;
      if (it.n === 0) slots[i] = null;
    }
  }
  return n - left;
}

// ---------------------------------------------------------------- quality

export function qualityScore(p) {
  const waterFrac = p.growDays > 0 ? Math.min(1, p.wetDays / p.growDays) : 0;
  const care = 35 + 45 * waterFrac + (p.fert ? 20 : 0);
  const penalty = RIPE_PENALTY[Math.min(RIPE_PENALTY.length - 1, p.ripeDays)];
  return Math.max(0, Math.min(100, Math.round(care - penalty)));
}

// whole days still needed if watered every day
export const daysLeft = (p) => Math.max(0, Math.ceil((1 - p.progress) * cropById[p.crop].days - EPS));

export const tierOf = (q) => (q >= 85 ? 4 : q >= 65 ? 3 : q >= 40 ? 2 : 1);

// ---------------------------------------------------------------- helpers

function fail(events, reason, extra = {}) {
  events.push({ type: 'fail', reason, ...extra });
  return { ok: false, reason };
}

function spend(s, cost, events) {
  if (s.energy < cost) {
    fail(events, 'tired');
    return false;
  }
  s.energy -= cost;
  return true;
}

function addMoney(s, sr, events) {
  const before = s.totalEarned;
  s.money += sr;
  s.totalEarned += sr;
  for (const c of CROPS) {
    if (zl(c.unlock) > before && zl(c.unlock) <= s.totalEarned) events.push({ type: 'unlock', crop: c.id });
  }
}

// ---------------------------------------------------------------- farmer commands

// Player clicked tile (x, y). mode 'place' = placing a sprinkler.
export function command(s, x, y, mode = 'auto', events = []) {
  const f = s.farmer;
  if (f.job) {
    events.push({ type: 'jobcancel', kind: f.job.kind, done: f.job.done });
    f.job = null;
    f.queue = [];
  }
  if (f.busy) {
    events.push({ type: f.busy.what === 'gig' ? 'gigpause' : 'buildcancel', what: f.busy.what });
    f.busy = null;
  }
  let task = null;
  let goals;
  const obj = objectAt(x, y);
  if (mode !== 'place' && findAt(s, x, y) >= 0) {
    task = { type: 'find', x, y };
    goals = [[x, y]];
  } else if (mode !== 'place' && forageAt(s, x, y) >= 0) {
    task = { type: 'forage', x, y };
    goals = [[x, y]];
  } else if (mode === 'place') {
    if (!isPlotTile(x, y)) return fail(events, 'placeplot');
    task = { type: 'place', x, y };
    goals = [[x, y]];
  } else if (obj) {
    task = { type: 'object', id: obj };
    goals = OBJECTS[obj].access;
  } else if (isPlotTile(x, y)) {
    task = { type: 'plot', x, y };
    goals = [[x, y]];
  } else if (isWalkable(x, y)) {
    goals = [[x, y]];
  } else {
    return { ok: false, reason: 'blocked' };
  }
  const sx = Math.round(f.x);
  const sy = Math.round(f.y);
  const path = findPath([sx, sy], goals, isWalkable);
  if (!path) return fail(events, 'nopath');
  if (f.x !== sx || f.y !== sy) path.unshift([sx, sy]);
  f.path = path;
  f.task = task;
  if (!path.length) arrive(s, events);
  return { ok: true, task };
}

function arrive(s, events) {
  const t = s.farmer.task;
  s.farmer.task = null;
  if (!t) return;
  if (t.type === 'plot') plotAction(s, t.x, t.y, events);
  else if (t.type === 'object') objectAction(s, t.id, events);
  else if (t.type === 'place') placeSprinkler(s, t.x, t.y, events);
  else if (t.type === 'find') pickUpFind(s, t.x, t.y, events);
  else if (t.type === 'forage') pickForage(s, t.x, t.y, events);
  else if (t.type === 'gig') startGigWork(s, events);
  else if (t.type === 'jobplant') continueJob(s, jobPlant(s, t.x, t.y, events), events);
  else if (t.type === 'jobharvest') continueJob(s, jobHarvest(s, t.x, t.y, events), events);
  else if (t.type === 'jobwater') continueJob(s, jobWater(s, t.x, t.y, events), events);
  else if (t.type === 'jobfert') continueJob(s, jobFert(s, t.x, t.y, events), events);
  else if (t.type === 'jobrefill') {
    s.water = canSize(s);
    events.push({ type: 'refill', water: s.water });
    continueJob(s, null, events);
  }
}

// ---------------------------------------------------------------- "plant all" / "harvest all"

export const totalSeeds = (s) => Object.values(s.seeds).reduce((a, n) => a + n, 0);

const unfertilized = (p) => Boolean(p.crop) && !p.rotten && p.progress < 1 && !p.fert;

function needsWater(p) {
  return Boolean(p.crop) && !p.rotten && p.progress < 1 && !p.wet;
}

function freePlots(s) {
  return Object.keys(s.plots).map(Number)
    .filter((i) => plotUnlocked(s, i) && !s.plots[i].crop && sprinklerAt(s, ...xy(i)) < 0 && findAt(s, ...xy(i)) < 0)
    .map(xy);
}

function ripePlots(s) {
  return Object.keys(s.plots).map(Number)
    .filter((i) => plotUnlocked(s, i) && s.plots[i].crop && !s.plots[i].rotten && s.plots[i].progress >= 1)
    .map(xy);
}

function thirstyPlots(s, crop) {
  return Object.keys(s.plots).map(Number)
    .filter((i) => plotUnlocked(s, i) && needsWater(s.plots[i]) && (!crop || s.plots[i].crop === crop))
    .map(xy);
}

// Plots a bulk job would visit; `crop` narrows it to one kind (null = everything).
export function jobTargets(s, kind, crop = null) {
  if (kind === 'fertilize') {
    const bags = countWhere(s.bag, (id) => id === 'fertilizer');
    return Object.keys(s.plots).map(Number)
      .filter((i) => plotUnlocked(s, i) && unfertilized(s.plots[i]) && (!crop || s.plots[i].crop === crop))
      .map(xy).slice(0, bags);
  }
  if (kind === 'plant') {
    const free = freePlots(s).length;
    return free ? freePlots(s).slice(0, crop ? s.seeds[crop] : totalSeeds(s)) : [];
  }
  if (kind === 'water') return thirstyPlots(s, crop);
  return ripePlots(s).filter(([x, y]) => !crop || s.plots[idx(x, y)].crop === crop);
}

// Visit tiles nearest-first from the farmer, which walks the field in tidy rows.
function route(s, tiles) {
  const left = [...tiles];
  const out = [];
  let cx = Math.round(s.farmer.x);
  let cy = Math.round(s.farmer.y);
  while (left.length) {
    let best = 0;
    let bestD = Infinity;
    left.forEach(([x, y], k) => {
      const d = Math.abs(x - cx) + Math.abs(y - cy) * 1.01;
      if (d < bestD) { bestD = d; best = k; }
    });
    const [t] = left.splice(best, 1);
    out.push(t);
    [cx, cy] = t;
  }
  return out;
}

const JOB_STOP = new Set(['tired', 'bagfull', 'noseeds', 'nofert']);
const JOB_TASK = { plant: 'jobplant', harvest: 'jobharvest', water: 'jobwater', fertilize: 'jobfert' };

export function startJob(s, kind, crop = null, events = []) {
  const f = s.farmer;
  let targets;
  if (kind === 'plant') {
    const seeds = crop ? s.seeds[crop] : totalSeeds(s);
    if (!seeds) return fail(events, 'noseeds', { crop });
    targets = freePlots(s);
    if (!targets.length) return fail(events, 'nofreeplots');
    targets = route(s, targets).slice(0, seeds);
  } else {
    if (kind === 'fertilize' && !countWhere(s.bag, (id) => id === 'fertilizer')) return fail(events, 'nofert');
    targets = jobTargets(s, kind, crop);
    if (!targets.length) return fail(events, { water: 'nothingdry', fertilize: 'nothingtofert' }[kind] ?? 'nothingripe');
    targets = route(s, targets);
  }
  f.busy = null;
  f.queue = targets.map(([x, y]) => ({ type: JOB_TASK[kind], x, y }));
  f.job = { kind, crop, done: 0, total: targets.length };
  f.task = null;
  events.push({ type: 'jobstart', kind, total: targets.length });
  continueJob(s, null, events);
  return { ok: true, total: targets.length };
}

function jobPlant(s, x, y, events) {
  const i = idx(x, y);
  if (!s.plots[i] || s.plots[i].crop || sprinklerAt(s, x, y) >= 0) return { ok: false, reason: 'skip' };
  const only = s.farmer.job?.crop;
  const crop = only ? (s.seeds[only] > 0 ? only : null)
    : s.seeds[s.seed] > 0 ? s.seed : CROPS.find((c) => s.seeds[c.id] > 0)?.id;
  if (!crop) return fail(events, 'noseeds');
  return plant(s, i, crop, events);
}

function jobFert(s, x, y, events) {
  const i = idx(x, y);
  if (!s.plots[i] || !unfertilized(s.plots[i])) return { ok: false, reason: 'skip' };
  return fertilize(s, i, events);
}

function jobHarvest(s, x, y, events) {
  const p = s.plots[idx(x, y)];
  if (!p || !p.crop || p.rotten || p.progress < 1) return { ok: false, reason: 'skip' };
  return harvestHand(s, idx(x, y), events);
}

function jobWater(s, x, y, events) {
  const i = idx(x, y);
  const p = s.plots[i];
  if (!p || !needsWater(p)) return { ok: false, reason: 'skip' };
  if (s.water <= 0) {
    // empty can: fetch water first, then come back to this plot
    s.farmer.queue.unshift({ type: 'jobrefill' }, { type: 'jobwater', x, y });
    return { ok: false, reason: 'refill' };
  }
  return waterPlot(s, i, events);
}

const waterSources = (s) => [...OBJECTS.pond.access, ...(s.upgrades.well ? OBJECTS.well.access : [])];

function continueJob(s, result, events) {
  const f = s.farmer;
  const job = f.job;
  if (!job) return;
  if (result?.ok) job.done++;
  const seedsLeft = job.crop ? s.seeds[job.crop] : totalSeeds(s);
  if ((result && JOB_STOP.has(result.reason)) || (job.kind === 'plant' && !seedsLeft && f.queue.length)) {
    events.push({ type: 'jobend', kind: job.kind, done: job.done, total: job.total, reason: result?.reason ?? 'noseeds' });
    f.job = null;
    f.queue = [];
    return;
  }
  while (f.queue.length) {
    const next = f.queue.shift();
    const goals = next.type === 'jobrefill' ? waterSources(s) : [[next.x, next.y]];
    const path = findPath([Math.round(f.x), Math.round(f.y)], goals, isWalkable);
    if (!path) continue;
    if (f.x !== Math.round(f.x) || f.y !== Math.round(f.y)) path.unshift([Math.round(f.x), Math.round(f.y)]);
    f.path = path;
    f.task = next;
    if (!path.length) arrive(s, events);
    return;
  }
  events.push({ type: 'jobend', kind: job.kind, done: job.done, total: job.total });
  f.job = null;
}

function moveFarmer(s, dt, events) {
  const f = s.farmer;
  if (!f.path.length) return;
  let move = WALK_SPEED * dt;
  while (move > 0 && f.path.length) {
    const [tx, ty] = f.path[0];
    const dx = tx - f.x;
    const dy = ty - f.y;
    const d = Math.hypot(dx, dy);
    if (d > EPS) {
      f.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    if (d <= move) {
      f.x = tx;
      f.y = ty;
      f.path.shift();
      move -= d;
    } else {
      f.x += (dx / d) * move;
      f.y += (dy / d) * move;
      move = 0;
    }
  }
  if (!f.path.length) arrive(s, events);
}

function pickUpFind(s, x, y, events) {
  const k = findAt(s, x, y);
  if (k < 0) return { ok: false };
  const f = s.finds[k];
  s.finds.splice(k, 1);
  s.seeds[f.crop] += f.n;
  events.push({ type: 'found', crop: f.crop, n: f.n, what: f.what });
  return { ok: true };
}

export function objectAction(s, id, events = []) {
  if (id === 'coop') {
    if (!s.coop.built) return fail(events, 'coopbroken');
    if (s.coop.eggs) {
      const n = addItem(s.bag, 'crop:egg:2', s.coop.eggs);
      s.coop.eggs -= n;
      if (n) events.push({ type: 'eggs', n });
      if (s.coop.eggs) fail(events, 'bagfull');
    }
    events.push({ type: 'open', panel: 'coop' });
    return { ok: true };
  }
  if (id === 'well' && !s.upgrades.well) {
    if (!s.upgrades.wellPlan) return fail(events, 'noplan');
    if (s.money < zl(WELL_BUILD.price)) return fail(events, 'coins', { need: zl(WELL_BUILD.price) });
    if (!hasMats(s, WELL_BUILD)) return fail(events, 'nomats', { mats: WELL_BUILD });
    if (s.energy < WELL_BUILD.energy) return fail(events, 'tired');
    s.farmer.busy = { what: 'well', left: WELL_BUILD.seconds, total: WELL_BUILD.seconds };
    s.farmer.dir = 'up';
    events.push({ type: 'buildstart', what: 'well' });
    return { ok: true };
  }
  if (id === 'house' && !s.found.house) {
    s.found.house = true;
    s.seeds[HOUSE_SEEDS.crop] += HOUSE_SEEDS.n;
    events.push({ type: 'found', crop: HOUSE_SEEDS.crop, n: HOUSE_SEEDS.n, what: 'ladica u kući' });
  }
  if (id === 'well' || id === 'pond') {
    s.water = canSize(s);
    events.push({ type: 'refill', water: s.water });
    return { ok: true };
  }
  events.push({ type: 'open', panel: id });
  return { ok: true };
}

export function plotAction(s, x, y, events = []) {
  const i = idx(x, y);
  if (!s.plots[i]) return fail(events, 'notplot');
  if (!plotUnlocked(s, i)) return fail(events, 'locked');
  const sp = sprinklerAt(s, x, y);
  if (sp >= 0) {
    if (s.tool !== 'hand') return fail(events, 'sprinklerhere');
    if (!canAdd(s.bag, 'sprinkler')) return fail(events, 'bagfull');
    addItem(s.bag, 'sprinkler');
    s.sprinklers.splice(sp, 1);
    events.push({ type: 'pickup', x, y });
    return { ok: true };
  }
  const p = s.plots[i];
  if (p.rotten) {
    if (!spend(s, ENERGY_COST.clear, events)) return { ok: false, reason: 'tired' };
    s.plots[i] = makePlot();
    events.push({ type: 'clear', x, y });
    return { ok: true };
  }
  if (p.crop && p.progress >= 1) return harvestHand(s, i, events);
  if (!p.crop) {
    if (s.tool !== 'seed') return fail(events, 'needseed');
    return plant(s, i, s.seed, events);
  }
  if (s.tool === 'can') return waterPlot(s, i, events);
  if (s.tool === 'fert') return fertilize(s, i, events);
  return fail(events, 'needtool');
}

function plant(s, i, cropId, events, by = 'hand') {
  if (!cropById[cropId]) return fail(events, 'noseeds');
  if (s.seeds[cropId] <= 0) return fail(events, 'noseeds', { crop: cropId });
  if (by === 'hand' && !spend(s, ENERGY_COST.plant, events)) return { ok: false, reason: 'tired' };
  s.seeds[cropId]--;
  s.plots[i] = { ...makePlot(), crop: cropId };
  const [x, y] = xy(i);
  events.push({ type: 'plant', crop: cropId, x, y, by });
  return { ok: true };
}

function waterPlot(s, i, events) {
  const p = s.plots[i];
  if (p.wet) return fail(events, 'wet');
  if (s.water <= 0) return fail(events, 'canempty');
  if (!spend(s, ENERGY_COST.water, events)) return { ok: false, reason: 'tired' };
  s.water--;
  p.wet = true;
  p.wetBy = 'hand';
  const [x, y] = xy(i);
  events.push({ type: 'water', x, y, by: 'hand' });
  return { ok: true };
}

function fertilize(s, i, events) {
  const p = s.plots[i];
  if (p.fert) return fail(events, 'fertilized');
  if (!countWhere(s.bag, (id) => id === 'fertilizer')) return fail(events, 'nofert');
  if (!spend(s, ENERGY_COST.fertilize, events)) return { ok: false, reason: 'tired' };
  takeWhere(s.bag, (id) => id === 'fertilizer', 1);
  p.fert = true;
  const [x, y] = xy(i);
  events.push({ type: 'fertilize', x, y });
  return { ok: true };
}

function harvestHand(s, i, events) {
  const p = s.plots[i];
  const tier = tierOf(qualityScore(p));
  const id = cropItem(p.crop, tier);
  const kg = cropById[p.crop].yield;
  if (spaceFor(s.bag, id) < kg) return fail(events, 'bagfull');
  if (!spend(s, ENERGY_COST.harvest, events)) return { ok: false, reason: 'tired' };
  addItem(s.bag, id, kg);
  s.stats.harvested++;
  s.plots[i] = makePlot();
  const [x, y] = xy(i);
  events.push({ type: 'harvest', crop: p.crop, tier, kg, x, y, by: 'hand' });
  return { ok: true, tier };
}

function placeSprinkler(s, x, y, events) {
  const i = idx(x, y);
  if (!s.plots[i] || !plotUnlocked(s, i) || s.plots[i].crop || sprinklerAt(s, x, y) >= 0) {
    return fail(events, 'placeplot');
  }
  if (!takeWhere(s.bag, (id) => id === 'sprinkler', 1)) return fail(events, 'nosprinkler');
  s.sprinklers.push({ x, y });
  events.push({ type: 'placed', x, y });
  return { ok: true };
}

// ---------------------------------------------------------------- house, bag, chest, stand, workbench

export function eat(s, slot, events = []) {
  const it = s.bag[slot];
  const p = it && parseItem(it.id);
  if (!p || p.kind !== 'crop') return fail(events, 'noteat');
  if (s.energy >= MAX_ENERGY) return fail(events, 'full');
  takeWhere([it], () => true, 1);
  if (it.n === 0) s.bag[slot] = null;
  const gain = EAT_ENERGY[p.tier];
  s.energy = Math.min(MAX_ENERGY, s.energy + gain);
  events.push({ type: 'eat', crop: p.crop, tier: p.tier, gain });
  return { ok: true };
}

export function coffee(s, events = []) {
  if (s.money < zl(COFFEE.price)) return fail(events, 'coins', { need: zl(COFFEE.price) });
  if (s.energy >= MAX_ENERGY) return fail(events, 'full');
  s.money -= zl(COFFEE.price);
  s.energy = Math.min(MAX_ENERGY, s.energy + COFFEE.energy);
  events.push({ type: 'coffee', gain: COFFEE.energy });
  return { ok: true };
}

// Move a whole stack between 'bag', 'chest' and 'stand'.
export function moveItem(s, from, slot, to, events = []) {
  const src = s[from];
  const it = src?.[slot];
  if (!it || !s[to] || from === to) return fail(events, 'noitem');
  if (to === 'stand' && !isSellable(it.id)) return fail(events, 'notsellable', { id: it.id });
  const added = addItem(s[to], it.id, it.n);
  if (!added) return fail(events, `${to}full`);
  it.n -= added;
  if (it.n === 0) src[slot] = null;
  events.push({ type: 'moved', from, to, id: it.id, n: added });
  return { ok: true };
}

export const matCount = (s, kind) => countWhere(s.bag, (id) => id === kind);
export const hasMats = (s, need) => matCount(s, 'wood') >= (need.wood ?? 0) && matCount(s, 'stone') >= (need.stone ?? 0);
function useMats(s, need) {
  takeWhere(s.bag, (id) => id === 'wood', need.wood ?? 0);
  takeWhere(s.bag, (id) => id === 'stone', need.stone ?? 0);
}
const owns = (s, key) => (key === 'coop' ? s.coop.built : s.upgrades[key]);

export function canCraft(s, id) {
  const r = recipeById[id];
  if (!r) return 'unknown';
  if (r.once && owns(s, r.once)) return 'owned';
  if (r.requires && !owns(s, r.requires)) return 'requires';
  if (id === 'hens' && s.coop.hens >= COOP.maxHens) return 'owned';
  if (r.mats && !hasMats(s, r.mats)) return 'nomats';
  if (s.money < zl(r.price)) return 'coins';
  if (r.bad && countWhere(s.bag, isBad) < r.bad) return 'nobad';
  if (r.gives && !canAdd(s.bag, r.gives)) return 'bagfull';
  return null;
}

export function craft(s, id, events = []) {
  const problem = canCraft(s, id);
  if (problem) return fail(events, problem, { recipe: id });
  const r = recipeById[id];
  s.money -= zl(r.price);
  if (r.mats) useMats(s, r.mats);
  if (r.bad) takeWhere(s.bag, isBad, r.bad);
  if (r.gives) addItem(s.bag, r.gives);
  if (r.once === 'coop') Object.assign(s.coop, { built: true, hens: COOP.hens });
  else if (r.once) s.upgrades[r.once] = true;
  if (id === 'hens') s.coop.hens = Math.min(COOP.maxHens, s.coop.hens + COOP.moreHens);
  if (r.once === 'bigCan') s.water = canSize(s);
  events.push({ type: 'craft', recipe: id });
  return { ok: true };
}

// ---------------------------------------------------------------- seeds

// Take one fruit from the bag and get 2–10 seeds out of it.
export function extractSeeds(s, slot, events = []) {
  const it = s.bag[slot];
  const p = it && parseItem(it.id);
  if (!p || p.kind !== 'crop' || !cropById[p.crop]) return fail(events, 'notfruit');
  takeWhere([it], () => true, 1);
  if (it.n === 0) s.bag[slot] = null;
  const [lo, hi] = SEEDS_FROM_FRUIT;
  const n = lo + Math.floor(rand(s) * (hi - lo + 1));
  s.seeds[p.crop] += n;
  events.push({ type: 'extracted', crop: p.crop, n });
  return { ok: true, n };
}

export const packPrice = (crop) => zl(cropById[crop].pack); // srebrenjaci

// Order a bag of fertilizer; it is delivered to the chest the next morning.
export function orderFertilizer(s, events = []) {
  if (s.money < zl(FERTILIZER_PRICE)) return fail(events, 'coins', { need: zl(FERTILIZER_PRICE) });
  s.money -= zl(FERTILIZER_PRICE);
  const o = s.orders.find((x) => x.item === 'fertilizer');
  if (o) o.n++;
  else s.orders.push({ item: 'fertilizer', n: 1 });
  events.push({ type: 'ordered', item: 'fertilizer', n: 1, price: zl(FERTILIZER_PRICE) });
  return { ok: true };
}

// Order a pack of seeds through the phone; it arrives the next morning.
export function orderSeeds(s, crop, events = []) {
  if (!isUnlocked(s, crop)) return fail(events, 'notincatalog');
  const price = packPrice(crop);
  if (s.money < price) return fail(events, 'coins', { need: price });
  s.money -= price;
  const o = s.orders.find((x) => x.crop === crop && !x.item);
  if (o) o.n += SEED_PACK;
  else s.orders.push({ crop, n: SEED_PACK });
  events.push({ type: 'ordered', crop, n: SEED_PACK, price });
  return { ok: true };
}

function morning(s, events) {
  const [lo, hi] = FORAGE_DAILY;
  const grown = spawnForage(s, lo + Math.floor(rand(s) * (hi - lo + 1)));
  if (grown) events.push({ type: 'forage', n: grown });
  if (s.coop.built) {
    const laid = Math.min(s.coop.hens, s.coop.feed);
    s.coop.feed -= laid;
    s.coop.eggs = Math.min(COOP.eggCap, s.coop.eggs + laid);
    events.push({ type: 'laid', n: laid, hungry: s.coop.hens - laid });
  }
  offerGigs(s, events);
  const waiting = [];
  for (const o of s.orders) {
    if (o.item) {
      const n = addItem(s.chest, o.item, o.n);
      if (n) events.push({ type: 'delivered', item: o.item, n });
      if (n < o.n) waiting.push({ item: o.item, n: o.n - n }); // chest full: the rest comes tomorrow
    } else {
      s.seeds[o.crop] += o.n;
      events.push({ type: 'delivered', crop: o.crop, n: o.n });
    }
  }
  s.orders = waiting;
  if (s.finds.length < 6 && rand(s) < DAILY_FIND_CHANCE) {
    for (let tries = 0; tries < 40; tries++) {
      const x = 2 + Math.floor(rand(s) * 40);
      const y = 2 + Math.floor(rand(s) * 27);
      if (charAt(x, y) !== '.' || findAt(s, x, y) >= 0) continue;
      const pool = CROPS.filter((c) => isUnlocked(s, c.id) || rand(s) < 0.25);
      const crop = pool[Math.floor(rand(s) * pool.length)] ?? CROPS[0];
      const f = { x, y, crop: crop.id, n: 1 + Math.floor(rand(s) * 3), what: 'samoniklo sjeme' };
      s.finds.push(f);
      events.push({ type: 'newfind', crop: f.crop });
      break;
    }
  }
}

// ---------------------------------------------------------------- world simulation

// Every morning: crops grow one day (half a day if they stayed dry), ripe ones age,
// the soil dries out, and then the sprinklers water what they reach.
function newDay(s, events) {
  for (const key of Object.keys(s.plots)) {
    const i = Number(key);
    const p = s.plots[i];
    if (!p.crop || p.rotten || !plotUnlocked(s, i)) continue;
    const [x, y] = xy(i);
    if (p.progress < 1) {
      p.progress = Math.min(1, p.progress + (p.wet ? 1 : DRY_RATE) / cropById[p.crop].days);
      p.growDays += 1;
      if (p.wet) p.wetDays += p.wetBy === 'auto' ? AUTO_WATER_CREDIT : 1;
      if (p.progress >= 1 - EPS) {
        p.progress = 1;
        events.push({ type: 'ripe', crop: p.crop, x, y });
      }
    } else {
      p.ripeDays += 1;
      if (p.ripeDays >= ROT_DAY) {
        p.rotten = true;
        events.push({ type: 'rot', crop: p.crop, x, y });
      }
    }
    p.wet = false;
    p.wetBy = null;
  }
  for (const sp of s.sprinklers) {
    const tiles = [];
    for (const [x, y] of sprinklerReach(s.irrigation, sp.x, sp.y)) {
      const i = idx(x, y);
      const p = s.plots[i];
      if (p && plotUnlocked(s, i) && needsWater(p)) {
        p.wet = true;
        p.wetBy = 'auto';
        tiles.push([x, y]);
      }
    }
    if (tiles.length) events.push({ type: 'sprinkle', x: sp.x, y: sp.y, tiles });
  }
}

// Tiles a sprinkler at (x, y) reaches at the given irrigation level (not its own tile).
export function sprinklerReach(level, x, y) {
  const r = IRRIGATION_RADII[Math.max(1, Math.min(IRRIGATION_RADII.length, level)) - 1];
  const out = [];
  const k = Math.ceil(r);
  for (let dy = -k; dy <= k; dy++) {
    for (let dx = -k; dx <= k; dx++) if ((dx || dy) && dx * dx + dy * dy <= r * r + 1e-6) out.push([x + dx, y + dy]);
  }
  return out;
}

export const irrigationCost = (s) => (s.irrigation >= IRRIGATION_RADII.length ? null : zl(IRRIGATION_COSTS[s.irrigation])); // srebrenjaci

export function upgradeIrrigation(s, events = []) {
  if (!s.upgrades.well) return fail(events, 'requires');
  const cost = irrigationCost(s);
  if (cost === null) return fail(events, 'owned');
  if (s.money < cost) return fail(events, 'coins', { need: cost });
  s.money -= cost;
  s.irrigation++;
  events.push({ type: 'irrigation', level: s.irrigation, reach: sprinklerReach(s.irrigation, 0, 0).length });
  return { ok: true };
}

function findDroneJob(s) {
  if (!s.chest.some((it) => it === null)) return null;
  let best = null;
  let bestD = Infinity;
  for (const key of Object.keys(s.plots)) {
    const i = Number(key);
    const p = s.plots[i];
    if (!p.crop || p.rotten || p.progress < 1 || !plotUnlocked(s, i)) continue;
    const [x, y] = xy(i);
    const d = Math.hypot(x - s.drone.x, y - s.drone.y);
    if (d < bestD) { bestD = d; best = [x, y]; }
  }
  return best;
}

function runDrone(s, dt, events) {
  if (!s.upgrades.drone) return;
  const d = s.drone;
  d.cool = Math.max(0, d.cool - dt);
  if (!d.target && d.cool <= 0) {
    d.target = findDroneJob(s);
    const blocked = !d.target && !s.chest.some((it) => it === null);
    if (blocked && !d.blocked) events.push({ type: 'fail', reason: 'chestfull' });
    d.blocked = blocked;
  }
  const [gx, gy] = d.target ?? DRONE_HOME;
  const dx = gx - d.x;
  const dy = gy - d.y;
  const dist = Math.hypot(dx, dy);
  const step = DRONE_SPEED * dt;
  if (dist > step) {
    d.x += (dx / dist) * step;
    d.y += (dy / dist) * step;
    return;
  }
  d.x = gx;
  d.y = gy;
  if (!d.target) return;
  const [x, y] = d.target;
  d.target = null;
  d.cool = DRONE_COOLDOWN;
  const i = idx(x, y);
  const p = s.plots[i];
  if (!p || !p.crop || p.rotten || p.progress < 1) return; // someone was faster
  const tier = Math.min(MACHINE_MAX_TIER, tierOf(qualityScore(p)));
  const id = cropItem(p.crop, tier);
  const kg = cropById[p.crop].yield;
  if (spaceFor(s.chest, id) < kg) return;
  addItem(s.chest, id, kg);
  s.stats.harvested++;
  const crop = p.crop;
  s.plots[i] = makePlot();
  events.push({ type: 'harvest', crop, tier, kg, x, y, by: 'drone' });
  if (s.upgrades.replant) plant(s, i, crop, [], 'drone');
}

function worldStep(s, dt, events) {
  runDrone(s, dt, events);
}

// ---------------------------------------------------------------- customers

const standHasStock = (s) => s.stand.some((it) => it !== null);

function moveAlong(c, speed, dt) {
  let move = speed * dt;
  while (move > 0 && c.path.length) {
    const [tx, ty] = c.path[0];
    const dx = tx - c.x;
    const dy = ty - c.y;
    const d = Math.hypot(dx, dy);
    if (d > EPS) c.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (d <= move) {
      c.x = tx;
      c.y = ty;
      c.path.shift();
      move -= d;
    } else {
      c.x += (dx / d) * move;
      c.y += (dy / d) * move;
      move = 0;
    }
  }
}

function buy(s, c, events) {
  const stocked = [];
  s.stand.forEach((it, i) => { if (it) stocked.push(i); });
  if (!stocked.length) {
    events.push({ type: 'nosale' });
    return;
  }
  // customers take the best quality on offer; ★ only when nothing better is left
  const best = Math.max(...stocked.map((i) => parseItem(s.stand[i].id).tier));
  const choice = stocked.filter((i) => parseItem(s.stand[i].id).tier === best);
  const slot = choice[Math.floor(rand(s) * choice.length)];
  const it = s.stand[slot];
  const { crop, tier } = parseItem(it.id);
  const [lo, hi] = CUSTOMER_KG;
  const qty = Math.min(it.n, lo + Math.floor(rand(s) * (hi - lo + 1)));
  const money = salePrice(crop, tier) * qty;
  it.n -= qty;
  if (it.n === 0) s.stand[slot] = null;
  s.stats.sold += qty;
  addMoney(s, money, events);
  events.push({ type: 'sale', crop, tier, qty, money, customer: c.id });
}

function runCustomers(s, dt, events) {
  if (shopOpen(s.clock) && standHasStock(s)) {
    s.customerTimer -= dt * (s.upgrades.seo ? SEO_BONUS : 1);
    if (s.customerTimer <= 0) {
      const [a, b] = CUSTOMER_INTERVAL;
      s.customerTimer = a + rand(s) * (b - a);
      const k = rand(s) < 0.5 ? 0 : 1;
      const [sx, sy] = SPAWNS[k];
      const path = findPath([sx, sy], [CUSTOMER_SPOT], isWalkable, npcCost);
      if (path) {
        s.customers.push({
          id: s.nextId++, x: sx, y: sy, path, dir: 'down', phase: 'in', wait: 0,
          look: Math.floor(rand(s) * 4), exit: SPAWNS[1 - k],
        });
      }
    }
  }
  for (const c of s.customers) {
    if (c.phase === 'wait') {
      c.wait -= dt;
      if (c.wait <= 0) {
        buy(s, c, events);
        c.phase = 'out';
        c.path = findPath([Math.round(c.x), Math.round(c.y)], [c.exit], isWalkable, npcCost) ?? [];
      }
      continue;
    }
    moveAlong(c, NPC_SPEED, dt);
    if (!c.path.length) {
      if (c.phase === 'in') {
        c.phase = 'wait';
        c.wait = 1.5;
        c.dir = 'up';
      } else {
        c.phase = 'gone';
      }
    }
  }
  s.customers = s.customers.filter((c) => c.phase !== 'gone');
}

// ---------------------------------------------------------------- the woods

export const forageAt = (s, x, y) => s.forage.findIndex((f) => f.x === x && f.y === y);

// Grow up to n new things along the forest edge; returns how many appeared.
function spawnForage(s, n) {
  let grown = 0;
  const total = FORAGE.reduce((a, f) => a + f.weight, 0);
  for (let tries = 0; grown < n && s.forage.length < FORAGE_MAX && tries < n * 20; tries++) {
    const [x, y] = FOREST_EDGE[Math.floor(rand(s) * FOREST_EDGE.length)];
    if (forageAt(s, x, y) >= 0 || findAt(s, x, y) >= 0) continue;
    let r = rand(s) * total;
    const f = FORAGE.find((k) => (r -= k.weight) < 0) ?? FORAGE[0];
    s.forage.push({ x, y, type: f.id });
    grown++;
  }
  return grown;
}

function pickForage(s, x, y, events) {
  const k = forageAt(s, x, y);
  if (k < 0) return { ok: false };
  const f = forageById[s.forage[k].type];
  const [lo, hi] = f.n;
  const n = lo + Math.floor(rand(s) * (hi - lo + 1));
  if (spaceFor(s.bag, f.item) < n) return fail(events, 'bagfull');
  if (!spend(s, 1, events)) return { ok: false, reason: 'tired' };
  addItem(s.bag, f.item, n);
  s.forage.splice(k, 1);
  events.push({ type: 'foraged', what: f.id, item: f.item, n, x, y });
  return { ok: true };
}

// ---------------------------------------------------------------- the chicken coop

// Put produce from the bag into the feeder (1 kg feeds one hen for a day).
export function feedHens(s, slot, events = []) {
  const it = s.bag[slot];
  const p = it && parseItem(it.id);
  if (!s.coop.built) return fail(events, 'coopbroken');
  if (!p || p.kind !== 'crop' || p.crop === 'egg') return fail(events, 'notfood');
  const room = COOP.feedCap - s.coop.feed;
  if (room <= 0) return fail(events, 'feederfull');
  const n = takeWhere([it], () => true, room);
  if (it.n === 0) s.bag[slot] = null;
  s.coop.feed += n;
  events.push({ type: 'fed', n, crop: p.crop });
  return { ok: true, n };
}

// ---------------------------------------------------------------- side gigs

const gigSeconds = (hours) => (hours * 60) / GAME_MIN_PER_SEC;

function offerGigs(s, events) {
  const [lo, hi] = GIG_OFFERS;
  const n = lo + Math.floor(rand(s) * (hi - lo + 1));
  const pool = [...GIGS];
  s.gigs.offers = [];
  for (let k = 0; k < n && pool.length; k++) {
    const g = pool.splice(Math.floor(rand(s) * pool.length), 1)[0];
    const [a, b] = g.pay;
    s.gigs.offers.push({
      id: s.nextId++, title: g.title, hours: g.hours,
      pay: zl(a + Math.floor(rand(s) * (b - a + 1))), energy: g.hours * GIG_ENERGY_PER_HOUR,
    });
  }
  if (s.gigs.offers.length) events.push({ type: 'gigoffers', n: s.gigs.offers.length });
}

// Take a gig from the phone; the farmer heads home to work on it.
export function acceptGig(s, id, events = []) {
  if (s.gigs.active) return fail(events, 'gigbusy');
  const k = s.gigs.offers.findIndex((g) => g.id === id);
  if (k < 0) return fail(events, 'nogig');
  const [g] = s.gigs.offers.splice(k, 1);
  s.gigs.active = { ...g, left: gigSeconds(g.hours) };
  events.push({ type: 'gigaccepted', title: g.title });
  return goWork(s, events);
}

// Walk home and work on the active gig.
export function goWork(s, events = []) {
  if (!s.gigs.active) return fail(events, 'nogig');
  const f0 = s.farmer;
  if (!f0.path.length && f0.x === HOUSE_DOOR[0] && f0.y === HOUSE_DOOR[1]) return startGigWork(s, events);
  const r = command(s, HOUSE_DOOR[0], HOUSE_DOOR[1] - 1, 'auto', events);
  if (!r.ok) return r;
  const f = s.farmer;
  if (f.path.length) f.task = { type: 'gig' };
  else startGigWork(s, events);
  return { ok: true };
}

function startGigWork(s, events) {
  const g = s.gigs.active;
  if (!g) return { ok: false };
  if (s.energy < g.energy) return fail(events, 'tired');
  s.farmer.busy = { what: 'gig', left: g.left, total: gigSeconds(g.hours) };
  s.farmer.dir = 'up';
  events.push({ type: 'gigstart', title: g.title });
  return { ok: true };
}

function finishGig(s, events) {
  const g = s.gigs.active;
  s.gigs.active = null;
  s.gigs.done++;
  s.energy = Math.max(0, s.energy - g.energy);
  addMoney(s, g.pay, events);
  events.push({ type: 'gigdone', title: g.title, pay: g.pay });
}

// ---------------------------------------------------------------- time

export function tick(s, dt, events = []) {
  const prev = s.clock;
  s.clock += dt * GAME_MIN_PER_SEC;
  if (prev < SHOP_OPEN && s.clock >= SHOP_OPEN) events.push({ type: 'shop', open: true });
  if (prev < SHOP_CLOSE && s.clock >= SHOP_CLOSE) events.push({ type: 'shop', open: false });
  if (s.clock >= PASS_OUT) {
    sleep(s, events, true);
    return events;
  }
  if (s.farmer.busy) build(s, dt, events);
  else moveFarmer(s, dt, events);
  worldStep(s, dt, events);
  runCustomers(s, dt, events);
  return events;
}

function build(s, dt, events) {
  const b = s.farmer.busy;
  b.left -= dt;
  if (b.what === 'gig' && s.gigs.active) s.gigs.active.left = Math.max(0, b.left);
  if (b.left > 0) return;
  s.farmer.busy = null;
  if (b.what === 'gig') {
    finishGig(s, events);
    return;
  }
  if (s.money < zl(WELL_BUILD.price) || s.energy < WELL_BUILD.energy || !hasMats(s, WELL_BUILD)) {
    fail(events, s.money < zl(WELL_BUILD.price) ? 'coins' : !hasMats(s, WELL_BUILD) ? 'nomats' : 'tired');
    return;
  }
  useMats(s, WELL_BUILD);
  s.money -= zl(WELL_BUILD.price);
  s.energy -= WELL_BUILD.energy;
  s.upgrades.well = true;
  events.push({ type: 'built', what: 'well' });
}

// Advance in small steps (used by tests and to catch up after a slow frame).
export function advance(s, seconds, events = []) {
  let left = seconds;
  while (left > EPS) {
    const dt = Math.min(0.25, left);
    tick(s, dt, events);
    left -= dt;
  }
  return events;
}

// Sleep until 06:00 next morning (allowed from SLEEP_FROM). That is when crops grow.
export function sleep(s, events = [], passedOut = false) {
  if (!passedOut && s.clock < SLEEP_FROM) return fail(events, 'tooearly');
  const night = [];
  newDay(s, night);
  s.day++;
  s.clock = DAY_START;
  s.energy = passedOut ? Math.round(MAX_ENERGY / 2) : MAX_ENERGY;
  s.customers = [];
  s.customerTimer = 8;
  Object.assign(s.farmer, { x: HOUSE_DOOR[0], y: HOUSE_DOOR[1], dir: 'down', path: [], task: null, queue: [], job: null, busy: null });
  const mornEvents = [];
  morning(s, mornEvents);
  const summary = {
    ripened: night.filter((e) => e.type === 'ripe').length,
    rotted: night.filter((e) => e.type === 'rot').length,
    sprinkled: night.filter((e) => e.type === 'sprinkle').reduce((a, e) => a + e.tiles.length, 0),
  };
  events.push({ type: passedOut ? 'passout' : 'slept', day: s.day, summary });
  events.push(...night.filter((e) => e.type === 'sprinkle'), ...mornEvents);
  return { ok: true };
}

export function ripeCount(s) {
  let n = 0;
  for (const key of Object.keys(s.plots)) {
    const p = s.plots[key];
    if (p.crop && p.progress >= 1 && !p.rotten && plotUnlocked(s, Number(key))) n++;
  }
  return n;
}
