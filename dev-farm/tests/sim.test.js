import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createState, command, plotAction, objectAction, advance, tick, sleep, craft, moveItem, eat,
  coffee, addItem, qualityScore, tierOf, cropItem, makePlot, isSellable, ripeCount, extractSeeds,
  orderSeeds, packPrice, salePrice, startJob, sprinklerReach, upgradeIrrigation, orderFertilizer,
  daysLeft,
} from '../src/sim.js';
import { serialize, deserialize } from '../src/save.js';
import {
  W, H, MAP, idx, isWalkable, OBJECTS, PLOTS_A, PLOTS_B, HOUSE_DOOR, SPAWNS, CUSTOMER_SPOT, xy,
} from '../src/world.js';
import { findPath } from '../src/path.js';
import {
  BAG_SIZE, DAY_START, PASS_OUT, SHOP_OPEN, MAX_ENERGY, CAN_SIZES, CROPS, START_FINDS, HOUSE_SEEDS,
  RECIPES, zl, ROT_DAY,
} from '../src/data.js';

const [AX, AY] = xy(PLOTS_A[0]);
const plotOf = (s, x = AX, y = AY) => s.plots[idx(x, y)];
const ripePlot = (crop, over = {}) => ({ ...makePlot(), crop, progress: 1, growDays: 3, wetDays: 3, ...over });
const walkTo = (s, x, y, mode) => {
  const events = [];
  const r = command(s, x, y, mode, events);
  for (let i = 0; i < 400 && s.farmer.path.length; i++) tick(s, 0.1, events);
  return { r, events };
};
const withSeeds = (n = 10, crop = 'radish') => {
  const s = createState();
  s.seeds[crop] = n;
  return s;
};
// go to bed in the evening and wake up the next morning
const nextDay = (s, events = []) => {
  s.clock = 20 * 60;
  assert.ok(sleep(s, events).ok);
  return events;
};
const START = zl(30);

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
  for (const f of START_FINDS) assert.ok(findPath(HOUSE_DOOR, [[f.x, f.y]], isWalkable), `find ${f.crop}`);
  for (const sp of SPAWNS) assert.ok(findPath(sp, [CUSTOMER_SPOT], isWalkable), 'customers reach the stand');
});

test('money is kept in srebrenjaci (1 zl = 100 sr); prices follow the market per kg', () => {
  const s = createState();
  assert.equal(s.money, 3000);
  assert.equal(salePrice('potato', 2), 100);
  assert.equal(salePrice('carrot', 2), 90);
  assert.equal(salePrice('radish', 2), 350);
  assert.equal(salePrice('cabbage', 2), 125);
  assert.equal(salePrice('pumpkin', 2), 160);
  assert.equal(salePrice('sweetpotato', 2), 330);
  assert.equal(salePrice('chard', 2), 390);
  assert.equal(salePrice('carrot', 1), 45, '★ goes for half');
  assert.equal(salePrice('carrot', 3), 117);
  assert.equal(salePrice('carrot', 4), 144);
});

test('a new farm has no seeds; the house drawer and finds on the map give some', () => {
  const s = createState();
  assert.ok(Object.values(s.seeds).every((n) => n === 0));
  s.tool = 'seed';
  assert.equal(plotAction(s, AX, AY).reason, 'noseeds');

  const { events } = walkTo(s, 8, 5); // click the house
  assert.ok(events.some((e) => e.type === 'found' && e.crop === HOUSE_SEEDS.crop));
  assert.equal(s.seeds.radish, HOUSE_SEEDS.n);
  walkTo(s, 8, 5);
  assert.equal(s.seeds.radish, HOUSE_SEEDS.n, 'the drawer is only full once');

  const carrot = START_FINDS.find((f) => f.crop === 'carrot');
  walkTo(s, carrot.x, carrot.y);
  assert.equal(s.seeds.carrot, carrot.n);
  assert.ok(!s.finds.some((f) => f.crop === 'carrot'));
});

test('farmer walks to a clicked plot and plants one counted seed there', () => {
  const s = withSeeds(5);
  s.tool = 'seed';
  const { r, events } = walkTo(s, AX, AY);
  assert.ok(r.ok);
  assert.deepEqual([s.farmer.x, s.farmer.y], [AX, AY]);
  assert.equal(plotOf(s).crop, 'radish');
  assert.equal(s.seeds.radish, 4);
  assert.equal(s.money, START, 'planting costs a seed, not money');
  assert.equal(s.energy, MAX_ENERGY - 2);
  assert.ok(events.some((e) => e.type === 'plant'));
});

test('clicking a tree does nothing; empty plot without the seed tool explains why', () => {
  const s = createState();
  assert.equal(command(s, 0, 0).ok, false);
  const events = [];
  plotAction(s, AX, AY, events);
  assert.equal(events[0].reason, 'needseed');
});

test('crops grow per day: a watered radish is ripe on the third morning', () => {
  const s = withSeeds();
  addItem(s.bag, 'fertilizer');
  s.tool = 'seed';
  plotAction(s, AX, AY);
  s.tool = 'fert';
  plotAction(s, AX, AY);
  assert.equal(daysLeft(plotOf(s)), 3);
  for (let d = 0; d < 3; d++) {
    assert.equal(plotOf(s).progress < 1, true);
    s.tool = 'can';
    assert.ok(plotAction(s, AX, AY).ok, `watering on day ${d + 1}`);
    advance(s, 60); // the day goes by: nothing grows during the day
    nextDay(s);
  }
  assert.equal(plotOf(s).progress, 1);
  const events = [];
  plotAction(s, AX, AY, events);
  const h = events.find((e) => e.type === 'harvest');
  assert.equal(h.tier, 4, 'watered every day + fertilized + picked on time = gold');
  assert.equal(h.kg, 1);
  assert.deepEqual(s.bag.find((it) => it?.id === cropItem('radish', 4)), { id: cropItem('radish', 4), n: 1 });
});

test('dry crops grow at half speed and turn out poor', () => {
  const s = withSeeds();
  s.tool = 'seed';
  plotAction(s, AX, AY);
  for (let d = 0; d < 5; d++) nextDay(s);
  assert.ok(plotOf(s).progress < 1);
  nextDay(s);
  assert.equal(plotOf(s).progress, 1);
  assert.equal(tierOf(qualityScore(plotOf(s))), 1);
});

test('the soil dries overnight, so watering is once a day', () => {
  const s = withSeeds();
  s.tool = 'seed';
  plotAction(s, AX, AY);
  s.tool = 'hand';
  assert.equal(plotAction(s, AX, AY).reason, 'needtool', 'single plants are watered with the can');
  s.tool = 'can';
  assert.ok(plotAction(s, AX, AY).ok);
  assert.equal(plotAction(s, AX, AY).reason, 'wet');
  nextDay(s);
  assert.equal(plotOf(s).wet, false);
  assert.ok(plotAction(s, AX, AY).ok);
});

test('quality: watering, fertilizer and harvesting on time decide the tier', () => {
  assert.equal(tierOf(qualityScore(ripePlot('radish', { wetDays: 0 }))), 1);
  assert.equal(tierOf(qualityScore(ripePlot('radish'))), 3);
  assert.equal(tierOf(qualityScore(ripePlot('radish', { fert: true }))), 4);
  assert.equal(tierOf(qualityScore(ripePlot('radish', { fert: true, ripeDays: 2 }))), 3);
});

test('a ripe crop waits a few days, then rots', () => {
  const s = createState();
  s.plots[idx(AX, AY)] = ripePlot('radish');
  for (let d = 1; d < ROT_DAY; d++) {
    nextDay(s);
    assert.ok(!plotOf(s).rotten, `day ${d}`);
  }
  const events = nextDay(s);
  assert.ok(plotOf(s).rotten);
  assert.ok(events.some((e) => e.type === 'slept' && e.summary.rotted === 1));
  const ev = [];
  plotAction(s, AX, AY, ev);
  assert.equal(ev[0].type, 'clear');
  assert.equal(plotOf(s).crop, null);
});

test('sleeping is only possible from 18:00; it starts the next day', () => {
  const s = createState();
  s.clock = 10 * 60;
  assert.equal(sleep(s).reason, 'tooearly');
  s.energy = 10;
  s.plots[idx(AX, AY)] = { ...makePlot(), crop: 'potato', wet: true, wetBy: 'hand' };
  const events = nextDay(s);
  assert.equal(s.day, 2);
  assert.equal(s.clock, DAY_START);
  assert.equal(s.energy, MAX_ENERGY);
  assert.equal(plotOf(s).progress, 1 / 4);
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

test('1 kg of produce gives 2–10 seeds at the workbench', () => {
  const s = createState();
  addItem(s.bag, cropItem('radish', 1), 30);
  const counts = new Set();
  for (let i = 0; i < 30; i++) {
    const before = s.seeds.radish;
    assert.ok(extractSeeds(s, 0).ok);
    const n = s.seeds.radish - before;
    assert.ok(n >= 2 && n <= 10, `got ${n}`);
    counts.add(n);
  }
  assert.ok(counts.size > 3, 'the amount is random');
  assert.equal(s.bag[0], null);
  assert.equal(extractSeeds(s, 0).reason, 'notfruit');
});

test('seed delivery: only catalogue crops, paid now, delivered next morning', () => {
  const s = createState();
  assert.equal(orderSeeds(s, 'potato').reason, 'notincatalog');
  assert.ok(orderSeeds(s, 'radish').ok);
  assert.equal(packPrice('radish'), 150);
  assert.equal(s.money, START - 150);
  assert.equal(s.seeds.radish, 0, 'not here yet');
  const events = nextDay(s);
  assert.equal(s.seeds.radish, 5);
  assert.ok(events.some((e) => e.type === 'delivered'));
  assert.equal(s.orders.length, 0);
});

test('fertilizer is ordered on the phone and arrives in the chest', () => {
  const s = createState();
  assert.ok(!RECIPES.some((r) => r.id === 'fertilizer'), 'not sold at the workbench');
  assert.ok(orderFertilizer(s).ok);
  assert.ok(orderFertilizer(s).ok);
  assert.equal(s.money, START - 2 * zl(6));
  nextDay(s);
  assert.deepEqual(s.chest[0], { id: 'fertilizer', n: 2 });
});

test('watering uses the can; the pond refills it, the well only once it is built', () => {
  const s = withSeeds();
  s.tool = 'seed';
  plotAction(s, AX, AY);
  s.tool = 'can';
  assert.ok(plotAction(s, AX, AY).ok);
  assert.equal(s.water, CAN_SIZES[0] - 1);
  s.water = 0;
  plotOf(s).wet = false;
  assert.equal(plotAction(s, AX, AY).reason, 'canempty');

  const { events } = walkTo(s, 15, 6); // the well site
  assert.ok(events.some((e) => e.reason === 'noplan'), 'no well yet, and no plan');
  assert.equal(s.water, 0);
  objectAction(s, 'pond');
  assert.equal(s.water, CAN_SIZES[0]);

  s.water = 0;
  s.money = zl(500);
  assert.equal(craft(s, 'sprinkler').reason, 'requires', 'irrigation needs the well');
  assert.ok(craft(s, 'wellPlan').ok);
  assert.ok(!s.upgrades.well, 'the workbench only sketches the plan');
  assert.ok(walkTo(s, 15, 6).events.some((e) => e.type === 'buildstart'));
  assert.ok(advance(s, 7).some((e) => e.type === 'built'));
  assert.ok(s.upgrades.well);
  assert.equal(s.money, zl(250));
  walkTo(s, 15, 6);
  assert.equal(s.water, CAN_SIZES[0]);
  assert.ok(craft(s, 'sprinkler').ok);
});

test('walking away stops the building, nothing is paid', () => {
  const s = createState();
  s.money = zl(500);
  craft(s, 'wellPlan');
  walkTo(s, 15, 6);
  advance(s, 2);
  const events = [];
  command(s, 8, 12, 'auto', events);
  assert.ok(events.some((e) => e.type === 'buildcancel'));
  advance(s, 10);
  assert.ok(!s.upgrades.well);
  assert.equal(s.money, zl(500));
});

test('irrigation has 10 levels, each reaching more plots', () => {
  const reach = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => sprinklerReach(l, 0, 0).length);
  assert.deepEqual(reach, [4, 8, 12, 20, 24, 28, 36, 44, 48, 56]);
  const s = createState();
  s.money = zl(1e5);
  assert.equal(upgradeIrrigation(s).reason, 'requires');
  s.upgrades.well = true;
  for (let l = 2; l <= 10; l++) assert.ok(upgradeIrrigation(s).ok);
  assert.equal(s.irrigation, 10);
  assert.equal(upgradeIrrigation(s).reason, 'owned');
});

test('sprinklers water their reach every morning, with less quality credit', () => {
  const s = withSeeds();
  s.money = zl(1000);
  s.upgrades.well = true;
  s.irrigation = 2; // 3 × 3
  assert.ok(craft(s, 'sprinkler').ok);
  const [x, y] = xy(PLOTS_A[9]);
  walkTo(s, x, y, 'place');
  assert.equal(s.sprinklers.length, 1);
  s.plots[idx(x + 1, y)] = { ...makePlot(), crop: 'carrot' };
  const events = nextDay(s);
  assert.ok(events.some((e) => e.type === 'sprinkle'));
  assert.equal(s.plots[idx(x + 1, y)].wetBy, 'auto');
  nextDay(s);
  assert.equal(s.plots[idx(x + 1, y)].wetDays, 0.75);
  s.tool = 'seed';
  assert.equal(plotAction(s, x, y).reason, 'sprinklerhere');
});

test('no energy, no work; coffee and food help', () => {
  const s = withSeeds();
  s.energy = 1;
  s.tool = 'seed';
  assert.equal(plotAction(s, AX, AY).reason, 'tired');
  assert.ok(coffee(s).ok);
  assert.equal(s.energy, 36);
  assert.equal(s.money, START - 150);
  addItem(s.bag, cropItem('carrot', 1));
  eat(s, 0);
  assert.equal(s.energy, 42);
  assert.equal(s.bag[0], null);
});

test('a harvest brings in kilograms and needs room for all of them', () => {
  const s = createState();
  s.plots[idx(AX, AY)] = ripePlot('pumpkin');
  for (let i = 0; i < BAG_SIZE - 1; i++) s.bag[i] = { id: 'sprinkler', n: 99 };
  s.bag[BAG_SIZE - 1] = { id: cropItem('pumpkin', 3), n: 95 };
  assert.equal(plotAction(s, AX, AY).reason, 'bagfull', '9 kg do not fit in 4 kg of space');
  s.bag[BAG_SIZE - 1].n = 90;
  assert.ok(plotAction(s, AX, AY).ok);
  assert.equal(s.bag[BAG_SIZE - 1].n, 99);
});

test('customers take the best on the stand; ★ only when nothing better is left', () => {
  const s = createState();
  addItem(s.bag, cropItem('carrot', 1), 6);
  addItem(s.bag, cropItem('carrot', 3), 4);
  assert.ok(isSellable(cropItem('carrot', 1)));
  assert.ok(moveItem(s, 'bag', 0, 'stand').ok);
  assert.ok(moveItem(s, 'bag', 1, 'stand').ok);

  const early = advance(s, 60); // 06:00 → 08:00, still closed
  assert.ok(!early.some((e) => e.type === 'sale'));
  assert.ok(s.clock >= SHOP_OPEN);
  const sales = advance(s, 300).filter((e) => e.type === 'sale');
  assert.ok(sales.length >= 2, `only ${sales.length} sales`);
  assert.ok(sales.every((e) => e.qty >= 1 && e.qty <= 4));
  const firstBad = sales.findIndex((e) => e.tier === 1);
  if (firstBad >= 0) {
    assert.equal(sales.slice(0, firstBad).reduce((a, e) => a + e.qty, 0), 4, '★ only after the ★★★ ran out');
  }
  for (const e of sales) assert.equal(e.money, salePrice('carrot', e.tier) * e.qty);
  assert.equal(s.money, START + sales.reduce((a, e) => a + e.money, 0));
});

test('harvest-drone brings crops to the chest, never above ★★★, and replants from seeds', () => {
  const s = withSeeds(1);
  s.money = zl(2000);
  assert.equal(craft(s, 'replant').reason, 'requires');
  assert.ok(craft(s, 'drone').ok);
  assert.ok(craft(s, 'replant').ok);
  assert.equal(craft(s, 'drone').reason, 'owned');
  s.plots[idx(AX, AY)] = ripePlot('carrot', { fert: true });
  const events = advance(s, 10);
  const h = events.find((e) => e.type === 'harvest');
  assert.equal(h.by, 'drone');
  assert.equal(h.tier, 3);
  assert.deepEqual(s.chest[0], { id: cropItem('carrot', 3), n: 4 });
  assert.equal(s.seeds.radish, 1, 'no carrot seeds, so no replanting');
  s.plots[idx(AX + 1, AY)] = ripePlot('radish');
  advance(s, 10);
  assert.equal(plotOf(s, AX + 1, AY).crop, 'radish', 'replanted');
  assert.equal(s.seeds.radish, 0);
});

test('compost turns bad produce into fertilizer; git clone polje opens field B', () => {
  const s = withSeeds();
  assert.equal(craft(s, 'compost').reason, 'nobad');
  addItem(s.bag, cropItem('radish', 1), 2);
  assert.ok(craft(s, 'compost').ok);
  assert.equal(s.bag.find((it) => it?.id === 'fertilizer').n, 1);

  const [bx, by] = xy(PLOTS_B[0]);
  s.tool = 'seed';
  assert.equal(plotAction(s, bx, by).reason, 'locked');
  s.money = zl(1000);
  assert.ok(craft(s, 'field2').ok);
  assert.ok(plotAction(s, bx, by).ok);
});

test('plant all: the farmer walks the field and plants every seed he has', () => {
  const s = withSeeds(4);
  s.seeds.carrot = 2;
  s.seed = 'carrot';
  const events = [];
  assert.ok(startJob(s, 'plant', null, events).ok);
  for (let i = 0; i < 400 && s.farmer.job; i++) tick(s, 0.1, events);
  const planted = Object.values(s.plots).filter((p) => p.crop);
  assert.equal(planted.length, 6);
  assert.equal(planted.filter((p) => p.crop === 'carrot').length, 2, 'the chosen seed goes first');
  assert.equal(events.find((e) => e.type === 'jobend').done, 6);
  assert.equal(startJob(s, 'plant').reason, 'noseeds');
  const find = START_FINDS.find((f) => f.crop === 'radish');
  assert.equal(s.plots[idx(find.x, find.y)].crop, null, 'the wild radish spot is left alone');
});

test('harvest all picks every ripe crop and stops when the bag is full', () => {
  const s = createState();
  for (const i of PLOTS_A.slice(0, 5)) s.plots[i] = ripePlot('radish');
  const events = [];
  startJob(s, 'harvest', null, events);
  for (let i = 0; i < 400 && s.farmer.job; i++) tick(s, 0.1, events);
  assert.equal(ripeCount(s), 0);
  assert.equal(s.bag[0].n, 5);

  const full = createState();
  for (let i = 0; i < BAG_SIZE; i++) full.bag[i] = { id: 'sprinkler', n: 99 };
  for (const i of PLOTS_A.slice(0, 3)) full.plots[i] = ripePlot('radish');
  const ev = [];
  startJob(full, 'harvest', null, ev);
  for (let i = 0; i < 400 && full.farmer.job; i++) tick(full, 0.1, ev);
  assert.equal(ev.find((e) => e.type === 'jobend').reason, 'bagfull');
  assert.equal(ripeCount(full), 3);
  assert.equal(startJob(createState(), 'harvest').reason, 'nothingripe');
});

test('bulk jobs can be narrowed to one crop', () => {
  const s = withSeeds(5);
  s.seeds.carrot = 3;
  startJob(s, 'plant', 'carrot');
  for (let i = 0; i < 400 && s.farmer.job; i++) tick(s, 0.1);
  const crops = Object.values(s.plots).filter((p) => p.crop).map((p) => p.crop);
  assert.deepEqual([...new Set(crops)], ['carrot']);
  assert.equal(crops.length, 3);
  assert.equal(s.seeds.radish, 5);

  s.plots[PLOTS_A[20]] = ripePlot('radish');
  s.plots[PLOTS_A[21]] = ripePlot('carrot');
  startJob(s, 'harvest', 'radish');
  for (let i = 0; i < 400 && s.farmer.job; i++) tick(s, 0.1);
  assert.equal(ripeCount(s), 1);
  assert.equal(s.plots[PLOTS_A[21]].crop, 'carrot');
});

test('water all: waters every dry plant and refills the can when it runs dry', () => {
  const s = createState();
  s.water = 2;
  for (const i of PLOTS_A.slice(0, 5)) s.plots[i] = { ...makePlot(), crop: 'radish', progress: 0.3 };
  const events = [];
  assert.ok(startJob(s, 'water', null, events).ok);
  for (let i = 0; i < 3000 && s.farmer.job; i++) tick(s, 0.1, events);
  assert.ok(PLOTS_A.slice(0, 5).every((i) => s.plots[i].wet), 'all watered');
  assert.ok(events.some((e) => e.type === 'refill'), 'went to fetch water');
  assert.equal(events.find((e) => e.type === 'jobend').done, 5);
  assert.equal(startJob(s, 'water').reason, 'nothingdry');
});

test('clicking somewhere else cancels a running job', () => {
  const s = withSeeds(20);
  startJob(s, 'plant');
  tick(s, 0.5);
  const events = [];
  command(s, 8, 12, 'auto', events);
  assert.equal(s.farmer.job, null);
  assert.ok(events.some((e) => e.type === 'jobcancel'));
});

test('ripeCount counts ripe crops for the tab title', () => {
  const s = createState();
  s.plots[idx(AX, AY)] = ripePlot('radish');
  assert.equal(ripeCount(s), 1);
});

test('save round trip, older farms carried over, broken saves fall back safely', () => {
  const s = withSeeds(7);
  s.tool = 'seed';
  walkTo(s, AX, AY);
  plotOf(s).wet = true;
  addItem(s.bag, cropItem('tomato', 4), 3);
  s.stand[2] = { id: cropItem('carrot', 1), n: 4 };
  s.sprinklers.push({ x: AX + 1, y: AY });
  s.orders.push({ crop: 'radish', n: 5 }, { item: 'fertilizer', n: 2 });
  const { state, restored } = deserialize(serialize(s));
  assert.ok(restored);
  assert.deepEqual(state, JSON.parse(serialize(s)));

  const v3 = deserialize(JSON.stringify({
    version: 3, coins: 300, totalEarned: 1000, plots: { [PLOTS_A[0]]: { crop: 'carrot', progress: 0.5, water: 20, wetTime: 9 } },
  })).state;
  assert.equal(v3.money, 300 * 40, 'old coins become euros');
  assert.equal(v3.totalEarned, 1000 * 40);
  assert.equal(v3.plots[PLOTS_A[0]].progress, 0.5);
  assert.equal(v3.plots[PLOTS_A[0]].growDays, 1);

  const v2 = deserialize(JSON.stringify({ version: 2, coins: 300, upgrades: { drone: true } })).state;
  assert.ok(v2.upgrades.well && v2.upgrades.drone, 'old farms keep their well');
  assert.equal(v2.seeds.radish, 10);

  assert.equal(deserialize('{nope').restored, false);
  assert.equal(deserialize(JSON.stringify({ version: 1 })).restored, false);
  const evil = deserialize(JSON.stringify({
    version: 4, money: -9, energy: 1e9, tool: 'chainsaw', seed: 'banana', clock: 99999,
    farmer: { x: 0, y: 0 }, bag: [{ id: 'gold', n: 5 }, { id: 'crop:radish:4', n: 1e9 }],
    stand: [{ id: 'fertilizer', n: 3 }], sprinklers: [{ x: 0, y: 0 }], seeds: { radish: -4, carrot: 'x' },
    finds: [{ x: 0, y: 0, crop: 'radish', n: 5 }], orders: [{ crop: 'banana', n: 5 }],
    plots: { [PLOTS_A[0]]: { crop: 'banana' }, [PLOTS_A[1]]: { crop: 'radish', wetDays: 50, growDays: 2, ripeDays: -3 } },
  })).state;
  assert.equal(evil.money, 0);
  assert.equal(evil.energy, MAX_ENERGY);
  assert.equal(evil.tool, 'hand');
  assert.equal(evil.seed, 'radish');
  assert.ok(evil.clock < PASS_OUT);
  assert.deepEqual([evil.farmer.x, evil.farmer.y], HOUSE_DOOR);
  assert.equal(evil.bag[0], null);
  assert.equal(evil.bag[1].n, 99);
  assert.equal(evil.stand[0], null);
  assert.equal(evil.sprinklers.length, 0);
  assert.deepEqual([evil.seeds.radish, evil.seeds.carrot], [0, 0]);
  assert.equal(evil.finds.length, 0);
  assert.equal(evil.orders.length, 0);
  assert.equal(evil.plots[PLOTS_A[0]].crop, null);
  assert.equal(evil.plots[PLOTS_A[1]].wetDays, 2);
  assert.equal(evil.plots[PLOTS_A[1]].ripeDays, 0);
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
  check(A.wellSite(), 40, 52, 'well site');
  check(A.findMarker(), 24, 24, 'find');
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
  for (const i of ['fertilizer', 'sprinkler', 'hand', 'seeds', 'can', 'phone', 'gold', 'silver']) check(A.icon(i), 16, 16, i);
  assert.deepEqual(A.roundTree(5).d, A.roundTree(5).d, 'art is deterministic');
});
