// Pure game rules: no DOM, so all of it runs (and is tested) in Node.
// Functions mutate the state object and push what happened into an `events` array.

import {
  SAVE_VERSION, START_MONEY, MAX_ENERGY, BAG_SIZE, CHEST_SIZE, STAND_SIZE, STACK_MAX, zl,
  GAME_MIN_PER_SEC, DAY_START, NIGHT_START, PASS_OUT, SLEEP_FROM, SHOP_OPEN, SHOP_CLOSE,
  WALK_SPEED, NPC_SPEED, DRONE_SPEED, DRONE_COOLDOWN, DRY_RATE,
  AUTO_WATER_CREDIT, CAN_SIZES, ENERGY_COST, COFFEE, EAT_ENERGY,
  TIER_PRICE, MACHINE_MAX_TIER, CUSTOMER_INTERVAL, CUSTOMER_KG, SEO_BONUS,
  CROPS, RECIPES, RIPE_PENALTY, ROT_DAY, SEEDS_FROM_FRUIT, SEED_PACK, HOUSE_SEEDS, START_FINDS,
  DAILY_FIND_CHANCE, FERTILIZER_PRICE, WELL_BUILD, IRRIGATION_R2, IRRIGATION_COSTS, HOSE_PER_SPRINKLER,
  PUMP_INSTALL_SECONDS, SHOP_ITEMS, BUILDINGS,
  GOODS, FORAGE, FORAGE_START, FORAGE_DAILY, FORAGE_MAX, COOP, GIGS, GIG_OFFERS, GIG_ENERGY_PER_HOUR, MARKET, FISH, FISHING,
  FERT_BONUS, TIER_AT, MAX_TIER, FERT_DOSES, COMPOST_KG, fertId,
  RAIN_CHANCE, RAIN_CUSTOMERS, MULCH_DAYS, CHEST_DECAY, REQUESTS, HIVES, DECOR, PETS, BUYBACK, DAY_NAMES, DAY_NAMES_GEN,
} from './data.js';
import {
  idx, xy, charAt, isWalkable, isPlotTile, objectAt, OBJECTS, PLOTS_A, PLOTS_B, inFieldA,
  HOUSE_DOOR, DRONE_HOME, SPAWNS, CUSTOMER_SPOT, npcCost, FOREST_EDGE, TOWN_EXIT, POND_CENTER, W, H,
} from './world.js';
import { findPath } from './path.js';

export const cropById = Object.fromEntries(CROPS.map((c) => [c.id, c]));
// everything that can be sold: crops plus forage and eggs
export const goodById = Object.fromEntries([...CROPS, ...GOODS].map((g) => [g.id, { unit: 'kg', ...g }]));
export const forageById = Object.fromEntries(FORAGE.map((f) => [f.id, f]));
export const recipeById = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const TOOLS = ['hand', 'seed', 'can', 'fert', 'rod'];
export const fishById = Object.fromEntries(FISH.map((f) => [f.id, f]));
const EPS = 1e-9;

// ---------------------------------------------------------------- state

// progress: 0..1 towards ripe; wet: watered today; wetDays/growDays: how many of the days
// it grew it was watered (quality); ripeDays: days it has been waiting ripe.
export function makePlot() {
  return { crop: null, progress: 0, wet: false, wetBy: null, wetDays: 0, growDays: 0, fert: 0, mulch: false, wetLeft: 0, ripeDays: 0, rotten: false };
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
    upgrades: { wellPlan: false, well: false, pump: false, coopPlan: false, bigCan: false, drone: false, replant: false, seo: false, field2: false, rod: false, coldroom: false },
    weather: 'sun', // today: 'sun' or 'rain'
    tomorrow: 'sun', // the forecast
    requests: [], // customers' orders at the stand
    hives: [], // { x, y, honey, days }
    decor: [], // { x, y, kind }
    pet: null, // { kind: 'dog' | 'cat', name, patted: day }
    pond: { fish: 0, caught: 0 }, // fish still to be caught today (the day's luck, not shown), caught today
    irrigation: 1,
    farmer: { x: HOUSE_DOOR[0], y: HOUSE_DOOR[1], dir: 'down', path: [], task: null, queue: [], job: null, busy: null },
    plots,
    bag: emptySlots(BAG_SIZE),
    chest: emptySlots(CHEST_SIZE),
    stand: emptySlots(STAND_SIZE),
    cargo: emptySlots(MARKET.vanSize), // what is loaded in the van
    // the town market: trips.farmer / trips.van are { phase: 'go' | 'sell' | 'back', left, timer, kg, money }
    market: { stall: false, van: false, worker: false, trips: { farmer: null, van: null } },
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
  s.pond.fish = rollPondLuck(s);
  s.tomorrow = rand(s) < RAIN_CHANCE ? 'rain' : 'sun';
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
// Sprinklers sit on grid crossings: (x, y) is the corner shared by tiles (x-1..x, y-1..y).
export const sprinklerAt = (s, x, y) => s.sprinklers.findIndex((p) => p.x === x && p.y === y);
const cornerTiles = (x, y) => [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]];
// Hives, fences and benches the player put down are in the way, like the buildings.
export const hiveAt = (s, x, y) => s.hives.findIndex((h) => h.x === x && h.y === y);
export const decorAt = (s, x, y) => s.decor.findIndex((d) => d.x === x && d.y === y);
function blockedSet(s) {
  const b = new Set(s.hives.map((h) => idx(h.x, h.y)));
  for (const d of s.decor) if (DECOR[d.kind]?.block) b.add(idx(d.x, d.y));
  return b;
}
export function walkFn(s, extra = null) {
  const b = blockedSet(s);
  if (extra !== null) b.add(extra);
  return (x, y) => isWalkable(x, y) && !b.has(idx(x, y));
}

// Everything that must stay reachable from the house door: every building, every plot,
// the road (customers, the way to town).
const MUST_REACH = [...Object.values(OBJECTS).map((o) => o.access), ...[...PLOTS_A, ...PLOTS_B].map((i) => [xy(i)]), [TOWN_EXIT], [CUSTOMER_SPOT], ...SPAWNS.map((sp) => [sp])];
function farmStaysOpen(s, extra) {
  const walk = walkFn(s, extra);
  const seen = new Uint8Array(W * H);
  const queue = [HOUSE_DOOR];
  seen[idx(...HOUSE_DOOR)] = 1;
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[idx(nx, ny)] || !walk(nx, ny)) continue;
      seen[idx(nx, ny)] = 1;
      queue.push([nx, ny]);
    }
  }
  return MUST_REACH.every((tiles) => tiles.some(([x, y]) => seen[idx(x, y)]));
}

export const isCornerSpot = (s, x, y) => cornerTiles(x, y).some(([tx, ty]) => s.plots[idx(tx, ty)] && plotUnlocked(s, idx(tx, ty)));

// ---------------------------------------------------------------- items

export const cropItem = (crop, tier) => `crop:${crop}:${tier}`;

export function parseItem(id) {
  if (['sprinkler', 'wood', 'stone', 'hose', 'pump', 'mulch', 'hive'].includes(id)) return { kind: id };
  const d = /^deco:([a-z]+)$/.exec(id ?? '');
  if (d && DECOR[d[1]]) return { kind: 'deco', deco: d[1] };
  const f = /^fertilizer:([1-3])$/.exec(id ?? '');
  if (f) return { kind: 'fertilizer', tier: Number(f[1]) };
  const m = /^crop:([a-z]+):([1-5])$/.exec(id ?? '');
  if (m && goodById[m[1]]) return { kind: 'crop', crop: m[1], tier: Number(m[2]) };
  return null;
}

export const isSellable = (id) => parseItem(id)?.kind === 'crop';
export const isFert = (id) => parseItem(id)?.kind === 'fertilizer';
// doses of fertilizer in the bag (one dose = one plot)
export const fertDoses = (s) => countWhere(s.bag, isFert);
// the plot's fertilizer quality: 0 none, 1–3 (old saves stored true)
const fertTier = (p) => (p.fert === true ? 2 : Number(p.fert) || 0);
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
  const care = 35 + 45 * waterFrac + FERT_BONUS[fertTier(p)];
  const penalty = RIPE_PENALTY[Math.min(RIPE_PENALTY.length - 1, p.ripeDays)];
  return Math.max(0, Math.min(100, Math.round(care - penalty)));
}

// whole days still needed if watered every day
export const daysLeft = (p) => Math.max(0, Math.ceil((1 - p.progress) * cropById[p.crop].days - EPS));

export const tierOf = (q) => {
  for (let t = MAX_TIER; t > 1; t--) if (q >= TIER_AT[t]) return t;
  return 1;
};

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
// mode: 'auto' (go there and do what fits), 'place'/'pickup' (a sprinkler on a crossing),
// 'placeitem' (put item `itemId` from the bag on the grass) or 'removeitem' (take it back).
export function command(s, x, y, mode = 'auto', events = [], itemId = null) {
  const f = s.farmer;
  if (s.market.trips.farmer) return fail(events, 'intown');
  if (f.job) {
    events.push({ type: 'jobcancel', kind: f.job.kind, done: f.job.done });
    f.job = null;
    f.queue = [];
  }
  if (f.busy) {
    events.push(f.busy.what === 'fish' ? { type: 'fishstop', reason: 'stop', caught: s.pond.caught }
      : { type: f.busy.what === 'gig' ? 'gigpause' : 'buildcancel', what: f.busy.what });
    f.busy = null;
  }
  let task = null;
  let goals;
  const obj = objectAt(x, y);
  const around = () => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([tx, ty]) => walkFn(s)(tx, ty));
  if (mode === 'placeitem') {
    const problem = placeProblem(s, x, y, itemId);
    if (problem) return fail(events, problem);
    task = { type: 'placeitem', x, y, id: itemId };
    goals = around();
  } else if (mode === 'removeitem') {
    if (hiveAt(s, x, y) < 0 && decorAt(s, x, y) < 0) return fail(events, 'noremove');
    task = { type: 'removeitem', x, y };
    goals = around();
  } else if (mode === 'auto' && hiveAt(s, x, y) >= 0) {
    task = { type: 'hive', x, y };
    goals = around();
  } else if (mode !== 'place' && findAt(s, x, y) >= 0) {
    task = { type: 'find', x, y };
    goals = [[x, y]];
  } else if (mode !== 'place' && forageAt(s, x, y) >= 0) {
    task = { type: 'forage', x, y };
    goals = [[x, y]];
  } else if (mode === 'place' || mode === 'pickup') {
    // (x, y) is a crossing; stand on one of the four tiles around it
    if (mode === 'place' && !isCornerSpot(s, x, y)) return fail(events, 'placeplot');
    if (mode === 'pickup' && sprinklerAt(s, x, y) < 0) return { ok: false, reason: 'blocked' };
    task = { type: mode, x, y };
    goals = cornerTiles(x, y).filter(([tx, ty]) => walkFn(s)(tx, ty));
  } else if (obj) {
    task = { type: 'object', id: obj };
    goals = OBJECTS[obj].access;
  } else if (isPlotTile(x, y)) {
    task = { type: 'plot', x, y };
    goals = [[x, y]];
  } else if (walkFn(s)(x, y)) {
    goals = [[x, y]];
  } else {
    return { ok: false, reason: 'blocked' };
  }
  if (!goals.length) return fail(events, 'nopath');
  const sx = Math.round(f.x);
  const sy = Math.round(f.y);
  const path = findPath([sx, sy], goals, walkFn(s));
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
  else if (t.type === 'pickup') pickUpSprinkler(s, t.x, t.y, events);
  else if (t.type === 'find') pickUpFind(s, t.x, t.y, events);
  else if (t.type === 'forage') pickForage(s, t.x, t.y, events);
  else if (t.type === 'gig') startGigWork(s, events);
  else if (t.type === 'town') leaveForTown(s, events);
  else if (t.type === 'placeitem') placeItem(s, t.x, t.y, t.id, events);
  else if (t.type === 'removeitem') removeItem(s, t.x, t.y, events);
  else if (t.type === 'hive') collectHoney(s, t.x, t.y, events);
  else if (t.type === 'jobmulch') continueJob(s, jobMulch(s, t.x, t.y, events), events);
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
    .filter((i) => plotUnlocked(s, i) && !s.plots[i].crop && findAt(s, ...xy(i)) < 0)
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
  if (kind === 'mulch') {
    const doses = countWhere(s.bag, (id) => id === 'mulch');
    return Object.keys(s.plots).map(Number)
      .filter((i) => plotUnlocked(s, i) && unmulched(s.plots[i]) && (!crop || s.plots[i].crop === crop))
      .map(xy).slice(0, doses);
  }
  if (kind === 'fertilize') {
    const bags = fertDoses(s);
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

const JOB_STOP = new Set(['tired', 'bagfull', 'noseeds', 'nofert', 'nomulch']);
const JOB_TASK = { plant: 'jobplant', harvest: 'jobharvest', water: 'jobwater', fertilize: 'jobfert', mulch: 'jobmulch' };
const unmulched = (p) => Boolean(p.crop) && !p.rotten && p.progress < 1 && !p.mulch;

function jobMulch(s, x, y, events) {
  const i = idx(x, y);
  if (!s.plots[i] || !unmulched(s.plots[i])) return { ok: false, reason: 'skip' };
  return mulchPlot(s, i, events);
}

export function startJob(s, kind, crop = null, events = []) {
  const f = s.farmer;
  if (s.market.trips.farmer) return fail(events, 'intown');
  let targets;
  if (kind === 'plant') {
    const seeds = crop ? s.seeds[crop] : totalSeeds(s);
    if (!seeds) return fail(events, 'noseeds', { crop });
    targets = freePlots(s);
    if (!targets.length) return fail(events, 'nofreeplots');
    targets = route(s, targets).slice(0, seeds);
  } else {
    if (kind === 'fertilize' && !fertDoses(s)) return fail(events, 'nofert');
    if (kind === 'mulch' && !countWhere(s.bag, (id) => id === 'mulch')) return fail(events, 'nomulch');
    targets = jobTargets(s, kind, crop);
    if (!targets.length) return fail(events, { water: 'nothingdry', fertilize: 'nothingtofert', mulch: 'nothingtomulch' }[kind] ?? 'nothingripe');
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
  if (!s.plots[i] || s.plots[i].crop) return { ok: false, reason: 'skip' };
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
    const path = findPath([Math.round(f.x), Math.round(f.y)], goals, walkFn(s));
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

// Buildings (well, coop, …): needs the plan from the workbench, then the farmer builds on site.
function startBuilding(s, id, events) {
  const b = BUILDINGS[id];
  if (!s.upgrades[b.plan]) return fail(events, 'noplan', { what: id });
  // say everything that is missing at once, not just the first thing
  if (s.money < zl(b.price) || !hasMats(s, b) || s.energy < b.energy) {
    return fail(events, s.money < zl(b.price) ? 'coins' : !hasMats(s, b) ? 'nomats' : 'tired', { need: zl(b.price), what: id, mats: b });
  }
  s.farmer.busy = { what: id, left: b.seconds, total: b.seconds };
  s.farmer.dir = 'up';
  events.push({ type: 'buildstart', what: id });
  return { ok: true };
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
  if ((id === 'well' && !s.upgrades.well) || (id === 'coop' && !s.coop.built)) return startBuilding(s, id, events);
  if (id === 'coop') {
    if (s.coop.eggs) {
      const n = addItem(s.bag, 'crop:egg:2', s.coop.eggs);
      s.coop.eggs -= n;
      if (n) events.push({ type: 'eggs', n });
      if (s.coop.eggs) fail(events, 'bagfull');
    }
    events.push({ type: 'open', panel: 'coop' });
    return { ok: true };
  }
  if (id === 'house' && !s.found.house) {
    s.found.house = true;
    s.seeds[HOUSE_SEEDS.crop] += HOUSE_SEEDS.n;
    events.push({ type: 'found', crop: HOUSE_SEEDS.crop, n: HOUSE_SEEDS.n, what: 'ladica u kući' });
  }
  if (id === 'well' && !s.upgrades.pump && countWhere(s.bag, (k) => k === 'pump')) {
    s.farmer.busy = { what: 'pump', left: PUMP_INSTALL_SECONDS, total: PUMP_INSTALL_SECONDS };
    s.farmer.dir = 'up';
    events.push({ type: 'buildstart', what: 'pump' });
    return { ok: true };
  }
  if (id === 'pond' && s.tool === 'rod' && s.upgrades.rod) return startFishing(s, events);
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
  if (s.tool === 'mulch') return mulchPlot(s, i, events);
  return fail(events, 'needtool');
}

function plant(s, i, cropId, events, by = 'hand') {
  if (!cropById[cropId]) return fail(events, 'noseeds');
  if (s.seeds[cropId] <= 0) return fail(events, 'noseeds', { crop: cropId });
  if (by === 'hand' && !spend(s, ENERGY_COST.plant, events)) return { ok: false, reason: 'tired' };
  s.seeds[cropId]--;
  s.plots[i] = { ...makePlot(), crop: cropId };
  if (s.weather === 'rain') wetPlot(s.plots[i], 'rain');
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
  wetPlot(p, 'hand');
  const [x, y] = xy(i);
  events.push({ type: 'water', x, y, by: 'hand' });
  return { ok: true };
}

// Water a plot: it stays wet for the day, or two days under mulch.
function wetPlot(p, by) {
  p.wet = true;
  p.wetBy = by;
  p.wetLeft = Math.max(p.wetLeft ?? 0, p.mulch ? MULCH_DAYS : 1);
}

function mulchPlot(s, i, events) {
  const p = s.plots[i];
  if (p.mulch) return fail(events, 'mulched');
  if (!countWhere(s.bag, (id) => id === 'mulch')) return fail(events, 'nomulch');
  if (!spend(s, ENERGY_COST.fertilize, events)) return { ok: false, reason: 'tired' };
  takeWhere(s.bag, (id) => id === 'mulch', 1);
  p.mulch = true;
  if (p.wet) p.wetLeft = Math.max(p.wetLeft ?? 1, MULCH_DAYS);
  const [x, y] = xy(i);
  events.push({ type: 'mulch', x, y });
  return { ok: true };
}

function fertilize(s, i, events) {
  const p = s.plots[i];
  if (p.fert) return fail(events, 'fertilized');
  if (!fertDoses(s)) return fail(events, 'nofert');
  if (!spend(s, ENERGY_COST.fertilize, events)) return { ok: false, reason: 'tired' };
  // the best fertilizer in the bag goes first
  const tier = Math.max(...s.bag.filter((it) => it && isFert(it.id)).map((it) => parseItem(it.id).tier));
  takeWhere(s.bag, (id) => id === fertId(tier), 1);
  p.fert = tier;
  const [x, y] = xy(i);
  events.push({ type: 'fertilize', x, y, tier });
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

// What is still missing before a sprinkler can go in: null when everything is ready.
export function irrigationMissing(s) {
  if (!s.upgrades.well) return 'nowell';
  if (!s.upgrades.pump) return 'nopump';
  if (!countWhere(s.bag, (id) => id === 'sprinkler')) return 'nosprinkler';
  if (countWhere(s.bag, (id) => id === 'hose') < HOSE_PER_SPRINKLER) return 'nohose';
  return null;
}

function placeSprinkler(s, x, y, events) {
  if (!isCornerSpot(s, x, y) || sprinklerAt(s, x, y) >= 0) return fail(events, 'placeplot');
  const missing = irrigationMissing(s);
  if (missing) return fail(events, missing, { hose: countWhere(s.bag, (id) => id === 'hose') });
  takeWhere(s.bag, (id) => id === 'sprinkler', 1);
  takeWhere(s.bag, (id) => id === 'hose', HOSE_PER_SPRINKLER);
  s.sprinklers.push({ x, y });
  events.push({ type: 'placed', x, y });
  return { ok: true };
}

function pickUpSprinkler(s, x, y, events) {
  const k = sprinklerAt(s, x, y);
  if (k < 0) return { ok: false };
  if (!canAdd(s.bag, 'sprinkler') || spaceFor(s.bag, 'hose') < HOSE_PER_SPRINKLER) return fail(events, 'bagfull');
  s.sprinklers.splice(k, 1);
  addItem(s.bag, 'sprinkler');
  addItem(s.bag, 'hose', HOSE_PER_SPRINKLER);
  events.push({ type: 'pickup', x, y });
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
export function moveItem(s, from, slot, to, events = [], amount = Infinity) {
  const src = s[from];
  const it = src?.[slot];
  if (!it || !s[to] || from === to) return fail(events, 'noitem');
  if (s.market.trips.farmer && (from === 'bag' || to === 'bag')) return fail(events, 'intown');
  if ((from === 'cargo' || to === 'cargo') && (!s.market.van || s.market.trips.van)) return fail(events, 'novan');
  if ((to === 'stand' || to === 'cargo') && !isSellable(it.id)) return fail(events, 'notsellable', { id: it.id });
  const added = addItem(s[to], it.id, Math.min(it.n, amount));
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
  if (r.mats && !hasMats(s, r.mats)) return 'nomats';
  if (s.money < zl(r.price)) return 'coins';
  if (r.gives && spaceFor(s.bag, r.gives) < (r.n ?? 1)) return 'bagfull';
  return null;
}

export function craft(s, id, events = []) {
  const problem = canCraft(s, id);
  if (problem) return fail(events, problem, { recipe: id });
  const r = recipeById[id];
  s.money -= zl(r.price);
  if (r.mats) useMats(s, r.mats);
  if (r.gives) addItem(s.bag, r.gives, r.n ?? 1);
  if (r.once) s.upgrades[r.once] = true;
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

// Compost: 5 kg of one kind of produce from the bag make one bag of fertilizer (10 doses)
// of the same quality, ★★★ at most.
export function makeCompost(s, slot, events = []) {
  const it = s.bag[slot];
  const p = it && parseItem(it.id);
  if (!p || p.kind !== 'crop' || !cropById[p.crop]) return fail(events, 'notcompost');
  if (it.n < COMPOST_KG) return fail(events, 'compostkg', { have: it.n });
  const tier = Math.min(3, p.tier);
  // the produce leaves the bag first, so its slot can take the fertilizer
  const before = it.n;
  it.n -= COMPOST_KG;
  if (it.n === 0) s.bag[slot] = null;
  if (spaceFor(s.bag, fertId(tier)) < FERT_DOSES) {
    if (s.bag[slot]) s.bag[slot].n = before;
    else s.bag[slot] = { id: it.id, n: before };
    return fail(events, 'bagfull');
  }
  addItem(s.bag, fertId(tier), FERT_DOSES);
  events.push({ type: 'composted', crop: p.crop, from: p.tier, tier, doses: FERT_DOSES });
  return { ok: true, tier };
}

export const packPrice = (crop) => zl(cropById[crop].pack); // srebrenjaci

export const shopItemById = Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, i]));

// Order fertilizer or irrigation parts; they are delivered to the chest the next morning.
export function orderItem(s, id, events = []) {
  const it = shopItemById[id];
  if (!it) return fail(events, 'notincatalog');
  if (id === 'hen') {
    if (!s.coop.built) return fail(events, 'coopbroken');
    const coming = s.orders.filter((o) => o.item === 'hen').reduce((a, o) => a + o.n, 0);
    if (s.coop.hens + coming >= COOP.maxHens) return fail(events, 'coopfull');
  }
  // the well takes one pump: no second one by mistake
  if (id === 'pump' && pumpStatus(s)) return fail(events, 'pump' + pumpStatus(s));
  if (s.money < zl(it.price)) return fail(events, 'coins', { need: zl(it.price) });
  s.money -= zl(it.price);
  const o = s.orders.find((x) => x.item === id);
  if (o) o.n += it.n;
  else s.orders.push({ item: id, n: it.n });
  events.push({ type: 'ordered', item: id, n: it.n, price: zl(it.price) });
  return { ok: true };
}

export const orderFertilizer = (s, events = []) => orderItem(s, 'fertilizer', events);

// Where the pump already is, if anywhere: 'installed', 'ordered', 'have' (bag or chest), or null.
export function pumpStatus(s) {
  if (s.upgrades.pump) return 'installed';
  if (s.orders.some((o) => o.item === 'pump')) return 'ordered';
  if (countWhere(s.bag, (id) => id === 'pump') + countWhere(s.chest, (id) => id === 'pump')) return 'have';
  return null;
}

// What one pack of an order costs and holds (refunds go back pack by pack).
export function orderPack(o) {
  if (o.item) return { n: shopItemById[o.item].n, price: zl(shopItemById[o.item].price) };
  return { n: SEED_PACK, price: packPrice(o.crop) };
}

// Changed your mind before the morning: cancel one pack of order k, money back in full.
export function cancelOrder(s, k, events = []) {
  const o = s.orders[k];
  if (!o) return fail(events, 'noorder');
  const pack = orderPack(o);
  const n = Math.min(o.n, pack.n); // a leftover from a full chest can be less than a pack
  const price = Math.round((pack.price * n) / pack.n);
  o.n -= n;
  if (o.n <= 0) s.orders.splice(k, 1);
  s.money += price;
  events.push({ type: 'cancelled', item: o.item, crop: o.crop, n, price });
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
  // the weather: today is what was forecast yesterday; the rain waters everything planted
  s.weather = s.tomorrow;
  s.tomorrow = rand(s) < RAIN_CHANCE ? 'rain' : 'sun';
  if (s.weather === 'rain') {
    let n = 0;
    for (const key of Object.keys(s.plots)) {
      const p = s.plots[key];
      if (plotUnlocked(s, Number(key)) && needsWater(p)) { wetPlot(p, 'rain'); n++; }
    }
    events.push({ type: 'rain', n });
  }
  events.push({ type: 'forecast', today: s.weather, tomorrow: s.tomorrow });
  agingChest(s, events);
  customerRequests(s, events);
  for (const h of s.hives) {
    h.days = (h.days ?? 0) + 1;
    if (h.days % HIVES.every === 0) h.honey = Math.min(HIVES.cap, (h.honey ?? 0) + 1);
  }
  const [lo, hi] = FORAGE_DAILY;
  const grown = spawnForage(s, lo + Math.floor(rand(s) * (hi - lo + 1)));
  if (grown) events.push({ type: 'forage', n: grown });
  if (s.coop.built) {
    const laid = Math.min(s.coop.hens, Math.floor(s.coop.feed / COOP.feedPerHen + EPS));
    s.coop.feed = Math.max(0, Math.round((s.coop.feed - laid * COOP.feedPerHen) * 10) / 10); // kg, to 100 g
    s.coop.eggs = Math.min(COOP.eggCap, s.coop.eggs + laid);
    events.push({ type: 'laid', n: laid, hungry: s.coop.hens - laid });
  }
  offerGigs(s, events);
  s.pond.fish = rollPondLuck(s);
  s.pond.caught = 0;
  if (s.market.van && s.market.worker) {
    // the hired hand drives whatever is loaded to the market; an empty van stays home (no wage)
    if (countWhere(s.cargo, isSellable)) sendVan(s, events);
    else events.push({ type: 'vanidle' });
  }
  const waiting = [];
  for (const o of s.orders) {
    if (o.item === 'hen') {
      s.coop.hens = Math.min(COOP.maxHens, s.coop.hens + o.n);
      events.push({ type: 'delivered', item: 'hen', n: o.n });
    } else if (o.item) {
      const n = addItem(s.chest, shopItemById[o.item]?.give ?? o.item, o.n);
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
      if (charAt(x, y) !== '.' || findAt(s, x, y) >= 0 || hiveAt(s, x, y) >= 0 || decorAt(s, x, y) >= 0) continue;
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
    // the soil dries overnight; under mulch it stays moist one more day
    p.wetLeft = Math.max(0, (p.wetLeft ?? (p.wet ? 1 : 0)) - 1);
    p.wet = p.wetLeft > 0;
    if (!p.wet) p.wetBy = null;
  }
  for (const sp of s.upgrades.pump ? s.sprinklers : []) {
    const tiles = [];
    for (const [x, y] of sprinklerReach(s.irrigation, sp.x, sp.y)) {
      const i = idx(x, y);
      const p = s.plots[i];
      if (p && plotUnlocked(s, i) && needsWater(p)) {
        wetPlot(p, 'auto');
        tiles.push([x, y]);
      }
    }
    if (tiles.length) events.push({ type: 'sprinkle', x: sp.x, y: sp.y, tiles });
  }
}

// Tiles a sprinkler on crossing (x, y) reaches at the given level: plot centres within the radius.
export function sprinklerReach(level, x, y) {
  const r2 = IRRIGATION_R2[Math.max(1, Math.min(IRRIGATION_R2.length, level)) - 1];
  const out = [];
  const k = Math.ceil(Math.sqrt(r2));
  for (let ty = y - k; ty < y + k; ty++) {
    for (let tx = x - k; tx < x + k; tx++) {
      if ((tx + 0.5 - x) ** 2 + (ty + 0.5 - y) ** 2 <= r2 + 1e-6) out.push([tx, ty]);
    }
  }
  return out;
}

export const IRRIGATION_LEVELS = IRRIGATION_R2.length;
export const irrigationCost = (s) => (s.irrigation >= IRRIGATION_LEVELS ? null : zl(IRRIGATION_COSTS[s.irrigation])); // srebrenjaci

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

// One customer buys from these slots: the best quality on offer, ★ only when nothing
// better is left. Returns what was sold, or null when there is nothing to sell.
function sellOne(s, slots, [lo, hi], events) {
  const stocked = [];
  slots.forEach((it, i) => { if (it && isSellable(it.id)) stocked.push(i); });
  if (!stocked.length) return null;
  const best = Math.max(...stocked.map((i) => parseItem(slots[i].id).tier));
  const choice = stocked.filter((i) => parseItem(slots[i].id).tier === best);
  const slot = choice[Math.floor(rand(s) * choice.length)];
  const it = slots[slot];
  const { crop, tier } = parseItem(it.id);
  const qty = Math.min(it.n, lo + Math.floor(rand(s) * (hi - lo + 1)));
  const money = salePrice(crop, tier) * qty;
  it.n -= qty;
  if (it.n === 0) slots[slot] = null;
  s.stats.sold += qty;
  addMoney(s, money, events);
  return { crop, tier, qty, money };
}

function buy(s, c, events) {
  const sale = sellOne(s, s.stand, CUSTOMER_KG, events);
  if (!sale) {
    events.push({ type: 'nosale' });
    return;
  }
  events.push({ type: 'sale', ...sale, customer: c.id });
  if (!standHasStock(s)) events.push({ type: 'standempty' });
}

function runCustomers(s, dt, events) {
  if (shopOpen(s.clock) && standHasStock(s)) {
    s.customerTimer -= dt * (s.upgrades.seo ? SEO_BONUS : 1) * (s.weather === 'rain' ? RAIN_CUSTOMERS : 1);
    if (s.customerTimer <= 0) {
      const [a, b] = CUSTOMER_INTERVAL;
      s.customerTimer = a + rand(s) * (b - a);
      const k = rand(s) < 0.5 ? 0 : 1;
      const [sx, sy] = SPAWNS[k];
      const path = findPath([sx, sy], [CUSTOMER_SPOT], walkFn(s), npcCost);
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
        c.path = findPath([Math.round(c.x), Math.round(c.y)], [c.exit], walkFn(s), npcCost) ?? [];
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
    if (forageAt(s, x, y) >= 0 || findAt(s, x, y) >= 0 || hiveAt(s, x, y) >= 0 || decorAt(s, x, y) >= 0) continue;
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
  let loot = f;
  if (f.loot) {
    let r = rand(s) * f.loot.reduce((a, l) => a + l.weight, 0);
    loot = f.loot.find((l) => (r -= l.weight) < 0) ?? f.loot[0];
  }
  const [lo, hi] = loot.n;
  const n = lo + Math.floor(rand(s) * (hi - lo + 1));
  if (spaceFor(s.bag, loot.item) < n) return fail(events, 'bagfull');
  if (!spend(s, 1, events)) return { ok: false, reason: 'tired' };
  addItem(s.bag, loot.item, n);
  s.forage.splice(k, 1);
  events.push({ type: 'foraged', what: f.id, item: loot.item, n, x, y });
  return { ok: true };
}

// ---------------------------------------------------------------- the chicken coop

// Put produce from the bag into the feeder (1 kg feeds one hen for a day).
export function feedHens(s, slot, events = [], amount = Infinity) {
  const it = s.bag[slot];
  const p = it && parseItem(it.id);
  if (!s.coop.built) return fail(events, 'coopbroken');
  if (!p || p.kind !== 'crop' || p.crop === 'egg') return fail(events, 'notfood');
  const room = Math.floor(COOP.feedCap - s.coop.feed + EPS);
  if (room <= 0) return fail(events, 'feederfull');
  const n = takeWhere([it], () => true, Math.min(room, amount));
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
  if (s.market.trips.farmer) return fail(events, 'intown');
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

// ---------------------------------------------------------------- fishing

// Fishing is idle: the farmer sits by the pond and fishes until called away or until dark.
// The pond's luck for the day (how many fish can be caught) is rolled every morning.
const pickWeighted = (s, weights) => {
  let r = rand(s) * weights.reduce((a, w) => a + w, 0);
  return Math.max(0, weights.findIndex((w) => (r -= w) < 0));
};
function rollPondLuck(s) {
  return pickWeighted(s, FISHING.daily);
}
const nextBite = (s) => FISHING.every[0] + rand(s) * (FISHING.every[1] - FISHING.every[0]);

// busy = { what: 'fish', next }: seconds until something may bite
function startFishing(s, events) {
  if (s.clock >= FISHING.until || s.clock < DAY_START) return fail(events, 'fishdark');
  if (s.energy < 1) return fail(events, 'tired');
  s.farmer.busy = { what: 'fish', next: nextBite(s) };
  // face the middle of the pond
  const dx = POND_CENTER[0] - (s.farmer.x + 0.5);
  const dy = POND_CENTER[1] - (s.farmer.y + 0.5);
  s.farmer.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  events.push({ type: 'cast' });
  return { ok: true };
}

function endFishing(s, events, reason) {
  s.farmer.busy = null;
  events.push({ type: 'fishstop', reason, caught: s.pond.caught });
}

function fishStep(s, dt, events) {
  const b = s.farmer.busy;
  // sitting by the water is light work: a little energy every hour
  s.energy = Math.max(0, s.energy - (FISHING.energyPerHour * dt * GAME_MIN_PER_SEC) / 60);
  if (s.clock >= FISHING.until) return endFishing(s, events, 'dark');
  if (s.energy <= 0) return endFishing(s, events, 'tired');
  b.next -= dt;
  if (b.next > 0) return;
  b.next = nextBite(s);
  if (s.pond.fish <= 0) return; // no luck today
  const fish = FISH[pickWeighted(s, FISH.map((f) => f.weight))];
  const tier = 1 + pickWeighted(s, FISHING.tiers);
  const kg = fish.kg[0] + Math.floor(rand(s) * (fish.kg[1] - fish.kg[0] + 1));
  const id = cropItem(fish.id, tier);
  if (spaceFor(s.bag, id) < kg) {
    fail(events, 'bagfull');
    return endFishing(s, events, 'bagfull');
  }
  addItem(s.bag, id, kg);
  s.pond.fish--;
  s.pond.caught++;
  events.push({ type: 'caught', fish: fish.id, tier, kg });
}

export function stopFishing(s, events = []) {
  if (s.farmer.busy?.what !== 'fish') return { ok: false };
  endFishing(s, events, 'stop');
  return { ok: true };
}

// ---------------------------------------------------------------- hives and decorations

// Why item `id` can't go on tile (x, y) (null = it can).
export function placeProblem(s, x, y, id) {
  const p = parseItem(id);
  if (!p || (p.kind !== 'hive' && p.kind !== 'deco')) return 'notplaceable';
  if (!countWhere(s.bag, (k) => k === id)) return 'noitem';
  if (!['.', '*'].includes(charAt(x, y))) return 'placegrass';
  if (hiveAt(s, x, y) >= 0 || decorAt(s, x, y) >= 0 || forageAt(s, x, y) >= 0 || findAt(s, x, y) >= 0) return 'placetaken';
  if (Math.round(s.farmer.x) === x && Math.round(s.farmer.y) === y) return 'placetaken';
  if (p.kind === 'hive' && s.hives.length >= HIVES.max) return 'hivemax';
  const blocks = p.kind === 'hive' || DECOR[p.deco].block;
  if (blocks && !farmStaysOpen(s, idx(x, y))) return 'placeblocks';
  return null;
}

export function placeItem(s, x, y, id, events = []) {
  const problem = placeProblem(s, x, y, id);
  if (problem) return fail(events, problem);
  takeWhere(s.bag, (k) => k === id, 1);
  const p = parseItem(id);
  if (p.kind === 'hive') s.hives.push({ x, y, honey: 0, days: 0 });
  else s.decor.push({ x, y, kind: p.deco });
  events.push({ type: 'placeditem', id, x, y });
  return { ok: true };
}

export function removeItem(s, x, y, events = []) {
  const h = hiveAt(s, x, y);
  const d = decorAt(s, x, y);
  if (h < 0 && d < 0) return fail(events, 'noremove');
  const id = h >= 0 ? 'hive' : `deco:${s.decor[d].kind}`;
  if (h >= 0 && s.hives[h].honey) {
    const r = collectHoney(s, x, y, events);
    if (!r.ok) return r;
  }
  if (!canAdd(s.bag, id)) return fail(events, 'bagfull');
  addItem(s.bag, id);
  if (h >= 0) s.hives.splice(h, 1);
  else s.decor.splice(d, 1);
  events.push({ type: 'removeditem', id, x, y });
  return { ok: true };
}

function collectHoney(s, x, y, events) {
  const h = s.hives[hiveAt(s, x, y)];
  if (!h) return { ok: false };
  if (!h.honey) return fail(events, 'nohoney');
  const n = addItem(s.bag, 'crop:honey:2', h.honey);
  h.honey -= n;
  if (!n) return fail(events, 'bagfull');
  events.push({ type: 'honey', n });
  return { ok: true, n };
}

// ---------------------------------------------------------------- the pet

export function adoptPet(s, kind, events = []) {
  if (s.pet) return fail(events, 'haspet');
  if (!PETS[kind]) return fail(events, 'nopet');
  if (s.money < zl(PETS.adopt)) return fail(events, 'coins', { need: zl(PETS.adopt) });
  s.money -= zl(PETS.adopt);
  s.pet = { kind, name: PETS[kind].name, patted: 0 };
  events.push({ type: 'adopted', kind, name: s.pet.name });
  return { ok: true };
}

// A pat once a day gives a little energy (and the pet is happy every time).
export function patPet(s, events = []) {
  if (!s.pet) return { ok: false };
  const first = s.pet.patted !== s.day;
  if (first) {
    s.pet.patted = s.day;
    s.energy = Math.min(MAX_ENERGY, s.energy + PETS.pat);
  }
  events.push({ type: 'patted', kind: s.pet.kind, name: s.pet.name, gain: first ? PETS.pat : 0 });
  return { ok: true };
}

// ---------------------------------------------------------------- chest and cold room

// Produce in the chest loses a class now and then, unless the chest is a cold room.
function agingChest(s, events) {
  if (s.upgrades.coldroom) return;
  const moved = [];
  s.chest.forEach((it, k) => {
    const p = it && parseItem(it.id);
    if (!p || p.kind !== 'crop' || p.tier <= 1 || rand(s) >= CHEST_DECAY) return;
    moved.push({ id: cropItem(p.crop, p.tier - 1), n: it.n });
    s.chest[k] = null;
  });
  for (const m of moved) addItem(s.chest, m.id, m.n);
  if (moved.length) events.push({ type: 'chestdecay', n: moved.length });
}

// ---------------------------------------------------------------- customers' orders at the stand

export const dayName = (day) => DAY_NAMES[(day - 1) % 7];
export const dayNameGen = (day) => DAY_NAMES_GEN[(day - 1) % 7];
export const requestPay = (r) => Math.round(salePrice(r.crop, r.tier) * r.kg * (1 + REQUESTS.bonus));

function customerRequests(s, events) {
  const missed = s.requests.filter((r) => r.due < s.day);
  s.requests = s.requests.filter((r) => r.due >= s.day);
  for (const r of missed) events.push({ type: 'requestmissed', ...r });
  if (s.requests.length >= REQUESTS.max || rand(s) >= REQUESTS.chance) return;
  const crops = CROPS.filter((c) => isUnlocked(s, c.id));
  const crop = crops[Math.floor(rand(s) * crops.length)];
  const pick = (arr) => arr[Math.floor(rand(s) * arr.length)];
  const between = ([a, b]) => a + Math.floor(rand(s) * (b - a + 1));
  const r = {
    id: s.nextId++, who: pick(REQUESTS.who), crop: crop.id, kg: between(REQUESTS.kg),
    tier: pick(REQUESTS.minTier), due: s.day + between(REQUESTS.days),
  };
  s.requests.push(r);
  events.push({ type: 'request', ...r });
}

// What in the bag would fill the order: produce of that crop in that class or better.
export const requestHave = (s, r) => countWhere(s.bag, (id) => {
  const p = parseItem(id);
  return p?.kind === 'crop' && p.crop === r.crop && p.tier >= r.tier;
});

// Hand an order over at the stand: takes the worst produce that is good enough, pays extra.
export function fulfillRequest(s, id, events = []) {
  const k = s.requests.findIndex((r) => r.id === id);
  if (k < 0) return fail(events, 'norequest');
  const r = s.requests[k];
  if (requestHave(s, r) < r.kg) return fail(events, 'requestshort', { request: r });
  let left = r.kg;
  for (let t = r.tier; t <= MAX_TIER && left; t++) left -= takeWhere(s.bag, (x) => x === cropItem(r.crop, t), left);
  s.requests.splice(k, 1);
  const pay = requestPay(r);
  addMoney(s, pay, events);
  events.push({ type: 'requestdone', ...r, pay });
  return { ok: true, pay };
}

// ---------------------------------------------------------------- selling back (otkup)

// What can be sold back on the phone, and for how much per unit (half of new).
export function buybackPrice(id) {
  const p = parseItem(id);
  if (!p) return null;
  if (p.kind === 'fertilizer') return Math.round((zl(shopItemById.fertilizer.price) / shopItemById.fertilizer.n) * BUYBACK);
  if (p.kind === 'deco') return Math.round((zl(DECOR[p.deco].price) / DECOR[p.deco].n) * BUYBACK);
  const it = shopItemById[p.kind];
  return it && it.id !== 'hen' ? Math.round((zl(it.price) / it.n) * BUYBACK) : null;
}
// how much one click sells: a shop pack's worth (10 m of hose, a bag of fertilizer…)
const buybackPack = (id) => {
  const p = parseItem(id);
  if (p.kind === 'fertilizer') return FERT_DOSES;
  if (p.kind === 'deco') return DECOR[p.deco].n;
  return shopItemById[p.kind]?.n ?? 1;
};

// Things you have (chest + bag) that can be sold back, as [{ id, n, price }]
export function buybackList(s) {
  const out = new Map();
  for (const it of [...s.chest, ...s.bag]) {
    if (!it || buybackPrice(it.id) === null) continue;
    out.set(it.id, (out.get(it.id) ?? 0) + it.n);
  }
  return [...out].map(([id, n]) => ({ id, n, price: buybackPrice(id), pack: Math.min(n, buybackPack(id)) }));
}

export function sellBack(s, id, events = []) {
  const price = buybackPrice(id);
  if (price === null) return fail(events, 'nobuyback');
  const have = countWhere(s.chest, (x) => x === id) + countWhere(s.bag, (x) => x === id);
  if (!have) return fail(events, 'noitem');
  const n = Math.min(have, buybackPack(id));
  let left = n - takeWhere(s.chest, (x) => x === id, n); // the chest first, then the bag
  left -= takeWhere(s.bag, (x) => x === id, left);
  s.money += price * n; // not earnings: it is money back
  events.push({ type: 'soldback', id, n, money: price * n });
  return { ok: true };
}

// ---------------------------------------------------------------- the town market

const travelSeconds = () => MARKET.travel / GAME_MIN_PER_SEC;
const tripSlots = (s, who) => (who === 'farmer' ? s.bag : s.cargo);
// the trip has to reach the market before it closes
const tooLate = (s) => s.clock + MARKET.travel >= MARKET.close;

export function rentStall(s, events = []) {
  if (s.market.stall) return fail(events, 'owned');
  if (s.money < zl(MARKET.stall)) return fail(events, 'coins', { need: zl(MARKET.stall) });
  s.money -= zl(MARKET.stall);
  s.market.stall = true;
  events.push({ type: 'stallrented' });
  return { ok: true };
}

export function buyVan(s, events = []) {
  if (s.market.van) return fail(events, 'owned');
  if (s.money < zl(MARKET.van)) return fail(events, 'coins', { need: zl(MARKET.van) });
  s.money -= zl(MARKET.van);
  s.market.van = true;
  events.push({ type: 'vanbought' });
  return { ok: true };
}

export function hireWorker(s, hire = true, events = []) {
  if (!s.market.van) return fail(events, 'novan');
  s.market.worker = hire;
  events.push({ type: hire ? 'hired' : 'fired' });
  return { ok: true };
}

// Why the farmer can't take the bag to the market right now (null = he can).
export function farmerTripProblem(s) {
  if (!s.market.stall) return 'nostall';
  if (s.market.trips.farmer) return 'intown';
  if (!countWhere(s.bag, isSellable)) return 'nothingtosell';
  if (tooLate(s)) return 'toolate';
  return null;
}

// Why the van can't go now (null = it can).
export function vanTripProblem(s) {
  if (!s.market.van) return 'novan';
  if (!s.market.worker) return 'noworker';
  if (!s.market.stall) return 'nostall';
  if (s.market.trips.van) return 'vanaway';
  if (!countWhere(s.cargo, isSellable)) return 'nothingtosell';
  if (tooLate(s)) return 'toolate';
  if (s.money < zl(MARKET.wage)) return 'coins';
  return null;
}

// The farmer walks up the road with the bag; the trip starts where the road leaves the map.
export function goToMarket(s, events = []) {
  const problem = farmerTripProblem(s);
  if (problem) return fail(events, problem, { need: zl(MARKET.wage) });
  const r = command(s, TOWN_EXIT[0], TOWN_EXIT[1], 'auto', events);
  if (!r.ok) return r;
  if (s.farmer.path.length) s.farmer.task = { type: 'town' };
  else leaveForTown(s, events);
  return { ok: true };
}

const newTrip = () => ({ phase: 'go', left: travelSeconds(), timer: 1, kg: 0, money: 0 });

function leaveForTown(s, events) {
  const problem = farmerTripProblem(s);
  if (problem) return fail(events, problem);
  s.market.trips.farmer = newTrip();
  events.push({ type: 'tripstart', who: 'farmer' });
  return { ok: true };
}

export function sendVan(s, events = []) {
  const problem = vanTripProblem(s);
  if (problem) return fail(events, problem, { need: zl(MARKET.wage), who: 'van' });
  s.money -= zl(MARKET.wage);
  s.market.trips.van = newTrip();
  events.push({ type: 'tripstart', who: 'van', wage: zl(MARKET.wage) });
  return { ok: true };
}

// Pack up and head home now (the way back still takes the full trip).
export function comeBack(s, who = 'farmer', events = []) {
  const t = s.market.trips[who];
  if (!t || t.phase === 'back') return { ok: false };
  t.left = t.phase === 'go' ? travelSeconds() - t.left : travelSeconds();
  t.phase = 'back';
  events.push({ type: 'tripback', who, kg: t.kg, money: t.money, early: true });
  return { ok: true };
}

function endTrip(s, who, events) {
  const t = s.market.trips[who];
  s.market.trips[who] = null;
  const left = countWhere(tripSlots(s, who), isSellable);
  events.push({ type: 'tripdone', who, kg: t.kg, money: t.money, left });
  if (who === 'farmer') {
    // back on the farm where the road comes in, then down to the parking lot
    const f = s.farmer;
    Object.assign(f, { x: TOWN_EXIT[0], y: TOWN_EXIT[1], dir: 'down', task: null, queue: [], job: null, busy: null });
    f.path = findPath(TOWN_EXIT, OBJECTS.market.access, walkFn(s)) ?? [];
  }
}

function runTrips(s, dt, events) {
  for (const who of ['farmer', 'van']) {
    const t = s.market.trips[who];
    if (!t) continue;
    if (t.phase === 'go') {
      t.left -= dt;
      if (t.left <= 0) {
        t.phase = 'sell';
        t.left = 0;
        events.push({ type: 'triparrive', who });
      }
    } else if (t.phase === 'sell') {
      const slots = tripSlots(s, who);
      if (s.clock >= MARKET.close || !countWhere(slots, isSellable)) {
        t.phase = 'back';
        t.left = travelSeconds();
        events.push({ type: 'tripback', who, kg: t.kg, money: t.money, soldOut: s.clock < MARKET.close });
        continue;
      }
      if (s.clock < MARKET.open) continue;
      t.timer -= dt;
      if (t.timer > 0) continue;
      const [a, b] = MARKET.interval;
      t.timer = a + rand(s) * (b - a);
      const sale = sellOne(s, slots, MARKET.kg, events);
      if (sale) {
        t.kg += sale.qty;
        t.money += sale.money;
        events.push({ type: 'marketsale', who, ...sale });
      }
    } else {
      t.left -= dt;
      if (t.left <= 0) endTrip(s, who, events);
    }
  }
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
  else if (!s.market.trips.farmer) moveFarmer(s, dt, events);
  worldStep(s, dt, events);
  runTrips(s, dt, events);
  runCustomers(s, dt, events);
  return events;
}

function build(s, dt, events) {
  const b = s.farmer.busy;
  if (b.what === 'fish') {
    fishStep(s, dt, events);
    return;
  }
  b.left -= dt;
  if (b.what === 'gig' && s.gigs.active) s.gigs.active.left = Math.max(0, b.left);
  if (b.left > 0) return;
  s.farmer.busy = null;
  if (b.what === 'gig') {
    finishGig(s, events);
    return;
  }
  const bld = BUILDINGS[b.what];
  if (bld) {
    if (s.money < zl(bld.price) || s.energy < bld.energy || !hasMats(s, bld)) {
      fail(events, s.money < zl(bld.price) ? 'coins' : !hasMats(s, bld) ? 'nomats' : 'tired', { need: zl(bld.price), what: b.what, mats: bld });
      return;
    }
    useMats(s, bld);
    s.money -= zl(bld.price);
    s.energy -= bld.energy;
    if (b.what === 'coop') s.coop.built = true;
    else s.upgrades[b.what] = true;
    events.push({ type: 'built', what: b.what });
    return;
  }
  if (b.what === 'pump') {
    if (!takeWhere(s.bag, (id) => id === 'pump', 1)) return;
    s.upgrades.pump = true;
    events.push({ type: 'built', what: 'pump' });
    return;
  }
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
  // nobody stays in town overnight
  for (const who of ['farmer', 'van']) if (s.market.trips[who]) endTrip(s, who, events);
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
