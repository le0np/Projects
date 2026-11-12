// Pure game rules. No DOM access, so everything here runs (and is tested) in Node.
// Every action takes an optional `events` array and pushes what happened into it.

import {
  CROPS, UPGRADES, GRID_MAX, BASE_GRID, START_COINS, SAVE_VERSION,
  WATER_DURATION, DRY_RATE, COMPOST_BONUS, WATER_INTERVAL, WATER_PER_RUN,
  DRONE_INTERVALS, MAX_STEP,
} from './data.js';

export const cropById = Object.fromEntries(CROPS.map((c) => [c.id, c]));
export const upgradeById = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

const EPS = 1e-9;

export function emptyTile() {
  return { crop: null, progress: 0, water: 0 };
}

export function createState() {
  return {
    version: SAVE_VERSION,
    coins: START_COINS,
    totalEarned: 0,
    selectedCrop: CROPS[0].id,
    upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])),
    timers: { water: 0, drone: 0 },
    tiles: Array.from({ length: GRID_MAX * GRID_MAX }, emptyTile),
    stats: { harvested: 0, planted: 0 },
  };
}

export const gridSize = (s) => BASE_GRID + s.upgrades.field;

export function isActive(s, i) {
  const n = gridSize(s);
  return Number.isInteger(i) && i >= 0 && i < GRID_MAX * GRID_MAX
    && i % GRID_MAX < n && Math.floor(i / GRID_MAX) < n;
}

export function activeIndices(s) {
  const n = gridSize(s);
  const out = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out.push(y * GRID_MAX + x);
  return out;
}

export const isMature = (t) => t.crop !== null && t.progress >= 1;
export const isGrowing = (t) => t.crop !== null && t.progress < 1;
export const isUnlocked = (s, id) => Boolean(cropById[id]) && s.totalEarned >= cropById[id].unlock;
export const growthMultiplier = (s) => 1 + COMPOST_BONUS * s.upgrades.compost;

export function upgradeCost(s, id) {
  const u = upgradeById[id];
  const level = s.upgrades[id];
  return level >= u.costs.length ? null : u.costs[level];
}

function addCoins(s, amount, events) {
  const before = s.totalEarned;
  s.coins += amount;
  s.totalEarned += amount;
  for (const c of CROPS) {
    if (c.unlock > before && c.unlock <= s.totalEarned) events.push({ type: 'unlock', crop: c.id });
  }
}

export function plant(s, i, cropId = s.selectedCrop, events = []) {
  if (!isActive(s, i)) return { ok: false, reason: 'inactive' };
  if (s.tiles[i].crop) return { ok: false, reason: 'occupied' };
  const crop = cropById[cropId];
  if (!crop || !isUnlocked(s, cropId)) return { ok: false, reason: 'locked' };
  if (s.coins < crop.seed) return { ok: false, reason: 'coins', need: crop.seed };
  s.coins -= crop.seed;
  s.tiles[i] = { crop: cropId, progress: 0, water: 0 };
  s.stats.planted++;
  events.push({ type: 'plant', crop: cropId, tile: i });
  return { ok: true };
}

export function water(s, i, events = []) {
  if (!isActive(s, i)) return { ok: false, reason: 'inactive' };
  const t = s.tiles[i];
  if (!t.crop) return { ok: false, reason: 'empty' };
  if (isMature(t)) return { ok: false, reason: 'mature' };
  if (t.water > 0) return { ok: false, reason: 'wet' };
  t.water = WATER_DURATION;
  events.push({ type: 'water', by: 'hand', tiles: [i], count: 1 });
  return { ok: true };
}

export function harvest(s, i, by = 'hand', events = []) {
  if (!isActive(s, i) || !isMature(s.tiles[i])) return { ok: false, reason: 'not-ready' };
  const crop = cropById[s.tiles[i].crop];
  s.tiles[i] = emptyTile();
  s.stats.harvested++;
  addCoins(s, crop.sell, events);
  events.push({ type: 'harvest', by, crop: crop.id, coins: crop.sell, tile: i });
  if (s.upgrades.replant > 0 && plant(s, i, crop.id).ok) {
    events.push({ type: 'replant', crop: crop.id, tile: i });
  }
  return { ok: true, coins: crop.sell, crop: crop.id };
}

// One click on a tile does whatever makes sense for its state.
export function clickTile(s, i, events = []) {
  if (!isActive(s, i)) return { action: 'none', ok: false, reason: 'inactive' };
  const t = s.tiles[i];
  if (!t.crop) return { action: 'plant', ...plant(s, i, s.selectedCrop, events) };
  if (isMature(t)) return { action: 'harvest', ...harvest(s, i, 'hand', events) };
  return { action: 'water', ...water(s, i, events) };
}

const hasAnyCrop = (s) => activeIndices(s).some((i) => s.tiles[i].crop !== null);

export function buyUpgrade(s, id, events = []) {
  const cost = upgradeCost(s, id);
  if (cost === null) return { ok: false, reason: 'max' };
  if (s.coins < cost) return { ok: false, reason: 'coins', need: cost };
  // Never let a purchase leave the farm with no crops and no money for seeds.
  if (s.coins - cost < CROPS[0].seed && !hasAnyCrop(s)) return { ok: false, reason: 'broke' };
  s.coins -= cost;
  s.upgrades[id]++;
  events.push({ type: 'upgrade', id, level: s.upgrades[id] });
  return { ok: true };
}

function runWaterCron(s, limit) {
  const tiles = [];
  for (const i of activeIndices(s)) {
    if (tiles.length >= limit) break;
    const t = s.tiles[i];
    if (isGrowing(t) && t.water <= 0) {
      t.water = WATER_DURATION;
      tiles.push(i);
    }
  }
  return tiles;
}

export function tick(s, dt, events = []) {
  const mult = growthMultiplier(s);
  for (const i of activeIndices(s)) {
    const t = s.tiles[i];
    if (!isGrowing(t)) continue;
    const wet = Math.min(t.water, dt);
    const effective = (wet + (dt - wet) * DRY_RATE) * mult;
    t.progress += effective / cropById[t.crop].grow;
    if (t.progress >= 1 - EPS) {
      t.progress = 1;
      t.water = 0;
    } else {
      t.water = Math.max(0, t.water - dt);
    }
  }

  const wl = s.upgrades.water;
  if (wl > 0) {
    s.timers.water += dt;
    while (s.timers.water >= WATER_INTERVAL - EPS) {
      s.timers.water = Math.max(0, s.timers.water - WATER_INTERVAL);
      const tiles = runWaterCron(s, WATER_PER_RUN[wl - 1]);
      if (tiles.length) events.push({ type: 'water', by: 'cron', tiles, count: tiles.length });
    }
  }

  const dl = s.upgrades.drone;
  if (dl > 0) {
    const interval = DRONE_INTERVALS[dl - 1];
    s.timers.drone += dt;
    while (s.timers.drone >= interval - EPS) {
      const i = activeIndices(s).find((j) => isMature(s.tiles[j]));
      if (i === undefined) {
        s.timers.drone = interval; // ready to fly as soon as something ripens
        break;
      }
      s.timers.drone = Math.max(0, s.timers.drone - interval);
      harvest(s, i, 'drone', events);
    }
  }
  return events;
}

// Advance the farm by any amount of time in small steps.
export function advance(s, seconds, events = []) {
  let left = seconds;
  while (left > EPS) {
    const dt = Math.min(MAX_STEP, left);
    tick(s, dt, events);
    left -= dt;
  }
  return events;
}

export function summarize(events) {
  const sum = { harvested: 0, earned: 0, watered: 0, replanted: 0, unlocked: [] };
  for (const e of events) {
    if (e.type === 'harvest') { sum.harvested++; sum.earned += e.coins; }
    else if (e.type === 'water' && e.by === 'cron') sum.watered += e.count;
    else if (e.type === 'replant') sum.replanted++;
    else if (e.type === 'unlock') sum.unlocked.push(e.crop);
  }
  return sum;
}
