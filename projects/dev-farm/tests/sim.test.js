import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createState, plant, water, harvest, clickTile, buyUpgrade, advance, tick,
  isActive, gridSize, summarize, isUnlocked,
} from '../src/sim.js';
import { serialize, deserialize } from '../src/save.js';
import { GRID_MAX, OFFLINE_CAP, WATER_DURATION, WATER_INTERVAL } from '../src/data.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);

test('fresh farm: 10 coins, 3×3 field, radish only', () => {
  const s = createState();
  assert.equal(s.coins, 10);
  assert.equal(gridSize(s), 3);
  assert.ok(isActive(s, 0) && isActive(s, 2 * GRID_MAX + 2));
  assert.ok(!isActive(s, 3) && !isActive(s, 3 * GRID_MAX));
  assert.ok(isUnlocked(s, 'radish') && !isUnlocked(s, 'carrot'));
});

test('planting costs coins and checks tile, lock and money', () => {
  const s = createState();
  assert.deepEqual(plant(s, 0), { ok: true });
  assert.equal(s.coins, 8);
  assert.equal(plant(s, 0).reason, 'occupied');
  assert.equal(plant(s, 3).reason, 'inactive');
  assert.equal(plant(s, 1, 'carrot').reason, 'locked');
  s.coins = 1;
  assert.equal(plant(s, 1).reason, 'coins');
});

test('dry crops grow at half speed, watered at full speed', () => {
  const dry = createState();
  plant(dry, 0);
  advance(dry, 10);
  near(dry.tiles[0].progress, 0.5);

  const wet = createState();
  plant(wet, 0);
  water(wet, 0);
  advance(wet, 10);
  assert.equal(wet.tiles[0].progress, 1);
});

test('water wears off after WATER_DURATION seconds', () => {
  const s = createState();
  s.totalEarned = 1000;
  s.coins = 1000;
  plant(s, 0, 'potato'); // 60 s
  water(s, 0);
  assert.equal(water(s, 0).reason, 'wet');
  advance(s, WATER_DURATION + 10);
  near(s.tiles[0].progress, (WATER_DURATION + 10 * 0.5) / 60);
  assert.equal(s.tiles[0].water, 0);
});

test('harvest pays, empties the tile and unlocks crops', () => {
  const s = createState();
  s.totalEarned = 58;
  plant(s, 0);
  water(s, 0);
  advance(s, 10);
  const events = [];
  const r = harvest(s, 0, 'hand', events);
  assert.ok(r.ok);
  assert.equal(s.coins, 8 + 5);
  assert.equal(s.tiles[0].crop, null);
  assert.ok(events.some((e) => e.type === 'unlock' && e.crop === 'carrot'));
  assert.equal(harvest(s, 0).ok, false);
});

test('clickTile plants, waters, then harvests', () => {
  const s = createState();
  assert.equal(clickTile(s, 0).action, 'plant');
  assert.equal(clickTile(s, 0).action, 'water');
  advance(s, 10);
  const r = clickTile(s, 0);
  assert.equal(r.action, 'harvest');
  assert.ok(r.ok);
  assert.equal(clickTile(s, 4).reason, 'inactive');
});

test('buying upgrades: cost, max level, not enough coins, never broke', () => {
  const s = createState();
  assert.equal(buyUpgrade(s, 'water').reason, 'coins');
  s.coins = 50;
  assert.equal(buyUpgrade(s, 'water').reason, 'broke'); // 0 coins and nothing planted
  s.coins = 52;
  assert.ok(buyUpgrade(s, 'water').ok);
  assert.equal(s.coins, 2);
  assert.equal(s.upgrades.water, 1);
  s.coins = 1e6;
  assert.ok(buyUpgrade(s, 'replant').ok);
  assert.equal(buyUpgrade(s, 'replant').reason, 'max');
});

test('water.sh waters a limited number of dry tiles every interval', () => {
  const s = createState();
  s.coins = 100;
  for (let i of [0, 1, 2, 5, 6]) plant(s, i);
  s.upgrades.water = 1; // 3 tiles per run
  const events = [];
  tick(s, WATER_INTERVAL - 1, events);
  assert.equal(events.length, 0);
  tick(s, 1, events);
  const run = events.find((e) => e.type === 'water');
  assert.equal(run.count, 3);
  assert.equal([0, 1, 2, 5, 6].filter((i) => s.tiles[i].water > 0).length, 3);
});

test('harvest-drone picks ripe crops and does not bank idle time', () => {
  const s = createState();
  s.upgrades.drone = 1; // every 8 s
  advance(s, 100); // nothing to harvest
  s.tiles[0] = { crop: 'radish', progress: 1, water: 0 };
  s.tiles[1] = { crop: 'radish', progress: 1, water: 0 };
  const events = advance(s, 0.1);
  assert.equal(summarize(events).harvested, 1);
  assert.equal(summarize(advance(s, 7.5)).harvested, 0);
  assert.equal(summarize(advance(s, 0.5)).harvested, 1);
});

test('replant.py plants the same crop again and pays for the seed', () => {
  const s = createState();
  s.upgrades.replant = 1;
  s.tiles[0] = { crop: 'radish', progress: 1, water: 0 };
  const events = [];
  harvest(s, 0, 'hand', events);
  assert.equal(s.tiles[0].crop, 'radish');
  assert.equal(s.tiles[0].progress, 0);
  assert.equal(s.coins, 10 + 5 - 2);
  assert.ok(events.some((e) => e.type === 'replant'));
});

test('compost-cache speeds up growth', () => {
  const s = createState();
  s.upgrades.compost = 2; // +50 %
  plant(s, 0);
  advance(s, 10);
  near(s.tiles[0].progress, 0.75);
});

test('git clone polje grows the field up to 5×5', () => {
  const s = createState();
  s.coins = 1e6;
  plant(s, 0);
  assert.ok(buyUpgrade(s, 'field').ok);
  assert.equal(gridSize(s), 4);
  assert.ok(isActive(s, 3) && isActive(s, 3 * GRID_MAX + 3));
  assert.ok(buyUpgrade(s, 'field').ok);
  assert.equal(gridSize(s), 5);
  assert.equal(buyUpgrade(s, 'field').reason, 'max');
});

test('offline: without automation crops only ripen, with it the farm earns', () => {
  const idle = createState();
  plant(idle, 0);
  const coins = idle.coins;
  advance(idle, 3600);
  assert.equal(idle.tiles[0].progress, 1);
  assert.equal(idle.coins, coins);

  const auto = createState();
  Object.assign(auto.upgrades, { water: 1, drone: 1, replant: 1 });
  for (let i of [0, 1, 2]) plant(auto, i);
  const sum = summarize(advance(auto, 3600));
  assert.ok(sum.harvested > 100, `harvested ${sum.harvested}`);
  assert.ok(auto.coins > 300);
});

test('save round trip keeps the farm and reports elapsed time', () => {
  const s = createState();
  plant(s, 0);
  s.upgrades.drone = 2;
  const raw = serialize(s, 1_000_000);
  const { state, elapsed, restored } = deserialize(raw, 1_000_000 + 90_000);
  assert.ok(restored);
  assert.equal(elapsed, 90);
  assert.deepEqual(state, s);
});

test('broken or hostile saves fall back safely', () => {
  assert.equal(deserialize('{nope', 0).restored, false);
  assert.equal(deserialize(null, 0).restored, false);
  assert.equal(deserialize(JSON.stringify({ version: 99 }), 0).restored, false);

  const weird = JSON.stringify({
    version: 1, coins: -5, totalEarned: 'lots', upgrades: { water: 99, field: -1 },
    tiles: [{ crop: 'banana', progress: 5 }, { crop: 'radish', progress: 7, water: 1e9 }],
    selectedCrop: 'pumpkin', savedAt: 0,
  });
  const { state, elapsed } = deserialize(weird, 1e12);
  assert.equal(state.coins, 0);
  assert.equal(state.totalEarned, 0);
  assert.equal(state.upgrades.water, 5);
  assert.equal(state.upgrades.field, 0);
  assert.equal(state.tiles[0].crop, null);
  assert.deepEqual(state.tiles[1], { crop: 'radish', progress: 1, water: WATER_DURATION });
  assert.equal(state.selectedCrop, 'radish');
  assert.equal(elapsed, OFFLINE_CAP);
  assert.equal(deserialize(serialize(state, 5000), 1000).elapsed, 0);
});
