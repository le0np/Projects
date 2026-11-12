import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createState, command, plotAction, objectAction, advance, tick, sleep, craft, moveItem, eat,
  coffee, addItem, qualityScore, tierOf, cropItem, makePlot, isSellable, ripeCount,
} from '../src/sim.js';
import { serialize, deserialize } from '../src/save.js';
import {
  W, H, MAP, idx, isWalkable, OBJECTS, PLOTS_A, PLOTS_B, HOUSE_DOOR, SPAWNS, CUSTOMER_SPOT, xy,
} from '../src/world.js';
import { findPath } from '../src/path.js';
import {
  BAG_SIZE, DAY_START, PASS_OUT, SHOP_OPEN, MAX_ENERGY, CAN_SIZES, WATER_DURATION, CROPS,
} from '../src/data.js';

const [AX, AY] = xy(PLOTS_A[0]);
const plotOf = (s, x = AX, y = AY) => s.plots[idx(x, y)];
const ripePlot = (crop, over = {}) => ({ ...makePlot(), crop, progress: 1, growTime: 45, ...over });
const walkTo = (s, x, y, mode) => {
  const events = [];
  const r = command(s, x, y, mode, events);
  for (let i = 0; i < 400 && s.farmer.path.length; i++) tick(s, 0.1, events);
  return { r, events };
};

test('map: correct size, every place is reachable from the house door', () => {
  assert.equal(MAP.length, H);
  assert.ok(MAP.every((row) => row.length === W));
  assert.equal(PLOTS_A.length, 48);
  assert.equal(PLOTS_B.length, 48);
  for (const [id, o] of Object.entries(OBJECTS)) {
    assert.ok(o.access.length && o.access.every(([x, y]) => isWalkable(x, y)), id);
    assert.ok(findPath(HOUSE_DOOR, o.access, isWalkable), `no path to ${id}`);
  }
  for (const i of [...PLOTS_A, ...PLOTS_B]) assert.ok(findPath(HOUSE_DOOR, [xy(i)], isWalkable));
  for (const sp of SPAWNS) assert.ok(findPath(sp, [CUSTOMER_SPOT], isWalkable), 'customers reach the stand');
});

test('farmer walks to a clicked plot and plants there with the seed tool', () => {
  const s = createState();
  s.tool = 'seed';
  const { r, events } = walkTo(s, AX, AY);
  assert.ok(r.ok);
  assert.deepEqual([s.farmer.x, s.farmer.y], [AX, AY]);
  assert.equal(plotOf(s).crop, 'radish');
  assert.equal(s.coins, 40 - 3);
  assert.equal(s.energy, MAX_ENERGY - 2);
  assert.ok(events.some((e) => e.type === 'plant'));
});

test('clicking a tree does nothing; empty plot without seeds explains why', () => {
  const s = createState();
  assert.equal(command(s, 0, 0).ok, false);
  const events = [];
  plotAction(s, AX, AY, events);
  assert.equal(events[0].reason, 'needseed');
});

test('watering uses the can; well and pond refill it', () => {
  const s = createState();
  s.tool = 'seed';
  plotAction(s, AX, AY);
  s.tool = 'can';
  assert.ok(plotAction(s, AX, AY).ok);
  assert.equal(s.water, CAN_SIZES[0] - 1);
  assert.equal(plotAction(s, AX, AY).reason, 'wet');
  s.water = 0;
  plotOf(s).water = 0;
  assert.equal(plotAction(s, AX, AY).reason, 'canempty');
  walkTo(s, 15, 6); // click on the well
  assert.equal(s.water, CAN_SIZES[0]);
  s.water = 0;
  objectAction(s, 'pond');
  assert.equal(s.water, CAN_SIZES[0]);
});

test('quality: water, fertilizer and timely harvest decide the tier', () => {
  const dry = ripePlot('radish', { wetTime: 0 });
  const watered = ripePlot('radish', { wetTime: 45 });
  const cared = ripePlot('radish', { wetTime: 45, fert: true });
  assert.equal(tierOf(qualityScore(dry)), 1);
  assert.equal(tierOf(qualityScore(watered)), 3);
  assert.equal(tierOf(qualityScore(cared)), 4);
  const late = ripePlot('radish', { wetTime: 45, fert: true, ripe: 45 * 2.5 });
  assert.ok(tierOf(qualityScore(late)) < 4);
});

test('growing for real: watered + fertilized radish harvested on time is gold', () => {
  const s = createState();
  addItem(s.bag, 'fertilizer');
  s.tool = 'seed';
  plotAction(s, AX, AY);
  s.tool = 'can';
  plotAction(s, AX, AY);
  s.tool = 'fert';
  plotAction(s, AX, AY);
  advance(s, 45);
  assert.equal(plotOf(s).progress, 1);
  const events = [];
  plotAction(s, AX, AY, events);
  assert.equal(events.find((e) => e.type === 'harvest').tier, 4);
  assert.equal(s.bag[0].id, cropItem('radish', 4));
});

test('ripe crops rot if left during the day, but wait overnight', () => {
  const s = createState();
  plotOf(s).crop = 'radish';
  plotOf(s).progress = 1;
  sleep(s);
  assert.equal(plotOf(s).ripe, 0);
  advance(s, 4 * 45 + 1);
  assert.ok(plotOf(s).rotten);
  const events = [];
  plotAction(s, AX, AY, events);
  assert.equal(events[0].type, 'clear');
  assert.equal(plotOf(s).crop, null);
});

test('no energy, no work; coffee and food help', () => {
  const s = createState();
  s.energy = 1;
  s.tool = 'seed';
  assert.equal(plotAction(s, AX, AY).reason, 'tired');
  assert.ok(coffee(s).ok);
  assert.equal(s.energy, 36);
  addItem(s.bag, cropItem('carrot', 1));
  eat(s, 0);
  assert.equal(s.energy, 42);
  assert.equal(s.bag[0], null);
});

test('full bag blocks harvesting', () => {
  const s = createState();
  for (let i = 0; i < BAG_SIZE; i++) s.bag[i] = { id: 'sprinkler', n: 99 };
  s.plots[idx(AX, AY)] = ripePlot('radish');
  assert.equal(plotAction(s, AX, AY).reason, 'bagfull');
});

test('stand only takes ★★ and better; customers buy during opening hours', () => {
  const s = createState();
  addItem(s.bag, cropItem('carrot', 1), 3);
  addItem(s.bag, cropItem('carrot', 3), 5);
  assert.equal(moveItem(s, 'bag', 0, 'stand').reason, 'notsellable');
  assert.ok(moveItem(s, 'bag', 1, 'stand').ok);
  assert.ok(isSellable(s.stand[0].id));

  const events = advance(s, 60); // 06:00 → 08:00, shop still closed
  assert.ok(!events.some((e) => e.type === 'sale'));
  assert.ok(s.clock >= SHOP_OPEN);
  const later = advance(s, 120);
  const sales = later.filter((e) => e.type === 'sale');
  assert.ok(sales.length >= 1, 'someone bought something');
  const sold = sales.reduce((a, e) => a + e.qty, 0);
  assert.equal(s.coins, 40 + sold * 27);
  assert.equal((s.stand[0]?.n ?? 0), 5 - sold);
});

test('sleeping skips to 06:00, refills energy and lets crops grow', () => {
  const s = createState();
  s.clock = 20 * 60;
  s.energy = 10;
  s.plots[idx(AX, AY)] = { ...makePlot(), crop: 'potato' };
  const events = [];
  sleep(s, events);
  assert.equal(s.day, 2);
  assert.equal(s.clock, DAY_START);
  assert.equal(s.energy, MAX_ENERGY);
  assert.ok(plotOf(s).progress > 0.9);
  assert.equal(events[0].type, 'slept');
});

test('staying up until 02:00 makes the farmer pass out with half energy', () => {
  const s = createState();
  s.clock = PASS_OUT - 1;
  const events = advance(s, 1);
  assert.ok(events.some((e) => e.type === 'passout'));
  assert.equal(s.day, 2);
  assert.equal(s.energy, MAX_ENERGY / 2);
  assert.deepEqual([s.farmer.x, s.farmer.y], HOUSE_DOOR);
});

test('sprinkler (water.sh) waters its neighbours, with less quality credit', () => {
  const s = createState();
  s.coins = 1000;
  assert.ok(craft(s, 'sprinkler').ok);
  const [x, y] = xy(PLOTS_A[9]); // has neighbours on all sides
  walkTo(s, x, y, 'place');
  assert.equal(s.sprinklers.length, 1);
  s.plots[idx(x + 1, y)] = { ...makePlot(), crop: 'carrot' };
  advance(s, 30);
  assert.equal(s.plots[idx(x + 1, y)].wetBy, 'auto');
  s.tool = 'seed';
  assert.equal(plotAction(s, x, y).reason, 'sprinklerhere');
});

test('harvest-drone brings crops to the chest, never above ★★★, and replants', () => {
  const s = createState();
  s.coins = 2000;
  assert.equal(craft(s, 'replant').reason, 'requires');
  assert.ok(craft(s, 'drone').ok);
  assert.ok(craft(s, 'replant').ok);
  assert.equal(craft(s, 'drone').reason, 'owned');
  s.plots[idx(AX, AY)] = ripePlot('radish', { wetTime: 45, fert: true });
  const events = advance(s, 10);
  const h = events.find((e) => e.type === 'harvest');
  assert.equal(h.by, 'drone');
  assert.equal(h.tier, 3);
  assert.equal(s.chest[0].id, cropItem('radish', 3));
  assert.equal(plotOf(s).crop, 'radish'); // replanted
});

test('compost turns bad produce into fertilizer; git clone polje opens field B', () => {
  const s = createState();
  assert.equal(craft(s, 'compost').reason, 'nobad');
  addItem(s.bag, cropItem('radish', 1), 2);
  assert.ok(craft(s, 'compost').ok);
  assert.equal(s.bag.find((it) => it?.id === 'fertilizer').n, 1);

  const [bx, by] = xy(PLOTS_B[0]);
  s.tool = 'seed';
  assert.equal(plotAction(s, bx, by).reason, 'locked');
  s.coins = 1000;
  assert.ok(craft(s, 'field2').ok);
  assert.ok(plotAction(s, bx, by).ok);
});

test('ripeCount counts ripe crops for the tab title', () => {
  const s = createState();
  s.plots[idx(AX, AY)] = ripePlot('radish');
  assert.equal(ripeCount(s), 1);
});

test('save round trip, and broken saves fall back safely', () => {
  const s = createState();
  s.tool = 'seed';
  walkTo(s, AX, AY);
  addItem(s.bag, cropItem('tomato', 4), 3);
  s.stand[2] = { id: cropItem('carrot', 3), n: 4 };
  s.sprinklers.push({ x: AX + 1, y: AY, t: 3 });
  const { state, restored } = deserialize(serialize(s));
  assert.ok(restored);
  assert.deepEqual(state, JSON.parse(serialize(s)));

  assert.equal(deserialize('{nope').restored, false);
  assert.equal(deserialize(JSON.stringify({ version: 1 })).restored, false);
  const evil = deserialize(JSON.stringify({
    version: 2, coins: -9, energy: 1e9, tool: 'chainsaw', seed: 'pumpkin', clock: 99999,
    farmer: { x: 0, y: 0 }, bag: [{ id: 'gold', n: 5 }, { id: 'crop:radish:4', n: 1e9 }],
    stand: [{ id: 'crop:radish:1', n: 3 }], sprinklers: [{ x: 0, y: 0 }],
    plots: { [PLOTS_A[0]]: { crop: 'banana' } },
  })).state;
  assert.equal(evil.coins, 0);
  assert.equal(evil.energy, MAX_ENERGY);
  assert.equal(evil.tool, 'hand');
  assert.equal(evil.seed, 'radish');
  assert.ok(evil.clock < PASS_OUT);
  assert.deepEqual([evil.farmer.x, evil.farmer.y], HOUSE_DOOR);
  assert.equal(evil.bag[0], null);
  assert.equal(evil.bag[1].n, 99);
  assert.equal(evil.stand[0], null);
  assert.equal(evil.sprinklers.length, 0);
  assert.equal(evil.plots[PLOTS_A[0]].crop, null);
  assert.ok(CROPS.length === 5 && WATER_DURATION > 0);
});

test('all art generates: correct sizes, nothing empty', async () => {
  const A = await import('../src/art.js');
  const check = (p, w, h, name) => {
    assert.equal(p.w, w, name);
    assert.equal(p.h, h, name);
    assert.ok(p.count() > 20, `${name} is empty`);
  };
  check(A.house(), 208, 192, 'house');
  check(A.stand(), 72, 72, 'stand');
  for (const dir of ['down', 'up', 'side']) {
    for (const frame of [0, 1, 2, 3]) {
      check(A.person({ dir, frame, farmer: true }), 24, 32, `farmer ${dir} ${frame}`);
      check(A.person({ dir, frame, ...A.VILLAGERS[frame] }), 24, 32, `villager ${dir} ${frame}`);
    }
  }
  for (const c of CROPS) {
    for (const stage of ['sprout', 'young', 'ripe', 'rotten']) check(A.crop(c.id, stage), 24, 28, `${c.id} ${stage}`);
    check(A.icon(c.id), 16, 16, `icon ${c.id}`);
  }
  for (const i of ['fertilizer', 'sprinkler', 'hand', 'seeds', 'can']) check(A.icon(i), 16, 16, i);
  // deterministic: same input, same pixels
  assert.deepEqual(A.roundTree(5).d, A.roundTree(5).d);
});
