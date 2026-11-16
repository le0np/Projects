import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createState, command, plotAction, objectAction, advance, tick, sleep, craft, moveItem, eat,
  coffee, addItem, qualityScore, tierOf, cropItem, makePlot, isSellable, ripeCount, extractSeeds,
  orderSeeds, packPrice, salePrice, startJob, sprinklerReach, upgrade, upgradeProblem, fillTank, runningSprinklers, irrigationMissing, orderFertilizer,
  daysLeft, matCount, forageAt, feedHens, acceptGig, goWork, orderItem, countWhere,
  rentStall, buyVan, hireWorker, goToMarket, sendVan, comeBack, farmerTripProblem, cancelOrder, pumpStatus, makeCompost,
  matsText, stopFishing, placeItem, removeItem, fulfillRequest, sellBack, buybackList, adoptPet, patPet, walkFn, requestPay,
  owns, chestSize, hensMax, feederCap, levelValue, cropDays,
  buildOnline, onlineProblem, packOrder, goToPost, postTripProblem, parcelsReady, orderPay,
  tilesBetween, dragTargets, startJobOn,
} from '../src/sim.js';
import { serialize, deserialize } from '../src/save.js';
import {
  W, H, MAP, idx, isWalkable, OBJECTS, PLOTS_A, PLOTS_B, HOUSE_DOOR, SPAWNS, CUSTOMER_SPOT, xy, TOWN_EXIT, TAP,
} from '../src/world.js';
import { findPath } from '../src/path.js';
import {
  BAG_SIZE, DAY_START, PASS_OUT, SHOP_OPEN, MAX_ENERGY, CAN_SIZE, UPGRADES, CROPS, START_FINDS, HOUSE_SEEDS,
  RECIPES, zl, ROT_DAY, WALK_SPEED, NPC_SPEED, FORAGE_START, FORAGE_MAX, MARKET, FISHING, CHEST_SIZE, COOP, POLLEN_BONUS, ONLINE, GIG_ENERGY_PER_HOUR, REQUESTS,
} from '../src/data.js';

const [AX, AY] = xy(PLOTS_A[0]);
const plotOf = (s, x = AX, y = AY) => s.plots[idx(x, y)];
const ripePlot = (crop, over = {}) => ({ ...makePlot(), crop, progress: 1, growDays: 3, wetDays: 3, ...over });
const walkTo = (s, x, y, mode) => {
  const events = [];
  const r = command(s, x, y, mode, events);
  for (let i = 0; i < 2000 && (s.farmer.path.length || s.farmer.busy?.what === 'work'); i++) tick(s, 0.1, events);
  return { r, events };
};
const withSeeds = (n = 10, crop = 'radish') => {
  const s = createState();
  s.seeds[crop] = n;
  return s;
};
// go to bed in the evening and wake up the next morning
const nextDay = (s, events = []) => {
  s.tomorrow = 'sun'; // no surprise rain in tests that don't ask for it
  s.clock = 20 * 60;
  assert.ok(sleep(s, events).ok);
  return events;
};
const START = zl(30);
const recipeOf = (id) => RECIPES.find((r) => r.id === id);

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

test('the farmer walks as fast as the customers', () => {
  assert.equal(WALK_SPEED, NPC_SPEED);
  assert.equal(WALK_SPEED, 3);
});

test('a plot action takes its time; energy is spent when it is done', () => {
  const s = withSeeds(5);
  s.tool = 'seed';
  s.farmer.x = AX; s.farmer.y = AY; // already standing on the plot
  command(s, AX, AY);
  assert.equal(s.farmer.busy?.what, 'work');
  assert.equal(s.farmer.busy.act, 'plant');
  advance(s, 1.4);
  assert.equal(plotOf(s).crop, null, 'not planted yet');
  assert.equal(s.energy, MAX_ENERGY);
  advance(s, 0.2);
  assert.equal(plotOf(s).crop, 'radish');
  assert.equal(s.energy, MAX_ENERGY - 2);
  assert.equal(s.farmer.busy, null);
});

test('a new click interrupts the work and spends nothing', () => {
  const s = withSeeds(5);
  s.tool = 'seed';
  s.farmer.x = AX; s.farmer.y = AY;
  command(s, AX, AY);
  advance(s, 1);
  const events = [];
  command(s, HOUSE_DOOR[0], HOUSE_DOOR[1], 'auto', events);
  advance(s, 2);
  assert.equal(plotOf(s).crop, null);
  assert.equal(s.seeds.radish, 5);
  assert.equal(s.energy, MAX_ENERGY);
  assert.ok(!events.some((e) => e.type === 'buildcancel'));
});

test('if the plot changed during the work (drone, someone faster), it is skipped', () => {
  const s = createState();
  s.plots[idx(AX, AY)] = ripePlot('radish');
  s.farmer.x = AX; s.farmer.y = AY;
  const before = countWhere(s.bag, () => true);
  command(s, AX, AY);
  assert.equal(s.farmer.busy.act, 'harvest');
  s.plots[idx(AX, AY)] = makePlot(); // the drone took it
  advance(s, 2);
  assert.equal(s.energy, MAX_ENERGY);
  assert.equal(countWhere(s.bag, () => true), before);
});

test('sleep, passing out or leaving for town clears the work in progress', () => {
  const s = withSeeds(5);
  s.tool = 'seed';
  s.farmer.x = AX; s.farmer.y = AY;
  command(s, AX, AY);
  s.clock = PASS_OUT - 0.5; // passes out during the work
  advance(s, 2);
  assert.equal(s.farmer.busy, null);
  assert.equal(plotOf(s).crop, null);
});

test('clicking a tree does nothing; empty plot without the seed tool explains why', () => {
  const s = createState();
  assert.equal(command(s, 0, 0).ok, false);
  const events = [];
  plotAction(s, AX, AY, events);
  assert.equal(events[0].reason, 'needseed');
});

test('crops grow per day: cheap crops are quick, valuable ones take longer', () => {
  const days = Object.fromEntries(CROPS.map((c) => [c.id, c.days]));
  assert.equal(days.radish, 1, 'planted today, ripe tomorrow morning');
  assert.equal(days.carrot, 1);
  // the more one plot is worth, the longer it grows
  const byValue = [...CROPS].sort((a, b) => a.yield * a.price - b.yield * b.price);
  byValue.forEach((c, k) => { if (k) assert.ok(c.days >= byValue[k - 1].days, c.id); });
  assert.ok(days.pumpkin > days.potato);
});

test('a watered radish is ripe the morning after planting', () => {
  const RADISH = CROPS.find((c) => c.id === 'radish').days;
  const s = withSeeds();
  addItem(s.bag, 'fertilizer:3', 10);
  s.tool = 'seed';
  plotAction(s, AX, AY);
  s.tool = 'fert';
  plotAction(s, AX, AY);
  assert.equal(daysLeft(plotOf(s)), RADISH);
  for (let d = 0; d < RADISH; d++) {
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
  assert.equal(h.tier, 5, 'watered every day + ★★★ fertilizer + picked on time = za sajam');
  assert.equal(h.kg, 1);
  assert.deepEqual(s.bag.find((it) => it?.id === cropItem('radish', 5)), { id: cropItem('radish', 5), n: 1 });
  assert.equal(s.bag.find((it) => it?.id === 'fertilizer:3').n, 9, 'one dose used, nine left in the bag');
});

test('dry crops grow at half speed and turn out poor', () => {
  const s = withSeeds(10, 'potato');
  s.seed = 'potato';
  s.tool = 'seed';
  plotAction(s, AX, AY);
  const dryDays = 2 * CROPS.find((c) => c.id === 'potato').days;
  for (let d = 0; d < dryDays - 1; d++) nextDay(s);
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
  assert.equal(tierOf(qualityScore(ripePlot('radish'))), 3, 'watered, no fertilizer: I. klasa');
  assert.equal(tierOf(qualityScore(ripePlot('radish', { fert: 1 }))), 4, '★ fertilizer: ekstra');
  assert.equal(tierOf(qualityScore(ripePlot('radish', { fert: 2 }))), 4, '★★ fertilizer: still ekstra');
  assert.equal(tierOf(qualityScore(ripePlot('radish', { fert: 3 }))), 5, 'only ★★★ fertilizer gives za sajam');
  assert.equal(tierOf(qualityScore(ripePlot('radish', { fert: 3, ripeDays: 1 }))), 4, 'a day late: no longer for the fair');
  assert.equal(tierOf(qualityScore(ripePlot('radish', { fert: 3, wetDays: 2 }))), 4, 'one dry day: no longer for the fair');
  assert.equal(tierOf(qualityScore(ripePlot('radish', { fert: true }))), 4, 'old saves: fertilized = ★★');
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
  assert.equal(plotOf(s).progress, 1 / CROPS.find((c) => c.id === 'potato').days);
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

test('fertilizer is ordered on the phone: a ★★ bag of 10 doses arrives in the chest', () => {
  const s = createState();
  assert.ok(orderFertilizer(s).ok);
  assert.ok(orderFertilizer(s).ok);
  assert.equal(s.money, START - 2 * zl(6));
  nextDay(s);
  assert.deepEqual(s.chest[0], { id: 'fertilizer:2', n: 20 });
});

test('watering uses the can; the pond refills it, the well only once it is built', () => {
  const s = withSeeds();
  s.tool = 'seed';
  plotAction(s, AX, AY);
  s.tool = 'can';
  assert.ok(plotAction(s, AX, AY).ok);
  assert.equal(s.water, CAN_SIZE - 1);
  s.water = 0;
  plotOf(s).wet = false;
  assert.equal(plotAction(s, AX, AY).reason, 'canempty');

  const { events } = walkTo(s, 15, 6); // the well site
  assert.ok(events.some((e) => e.reason === 'noplan'), 'no well yet, and no plan');
  assert.equal(s.water, 0);
  objectAction(s, 'pond');
  assert.equal(s.water, CAN_SIZE);

  s.water = 0;
  s.money = zl(500);
  assert.ok(craft(s, 'wellPlan').ok);
  assert.ok(!s.upgrades.well, 'the workbench only sketches the plan');
  assert.ok(walkTo(s, 15, 6).events.some((e) => e.reason === 'nomats'), 'stone and wood are needed');
  addItem(s.bag, 'wood', 6);
  addItem(s.bag, 'stone', 12);
  assert.ok(walkTo(s, 15, 6).events.some((e) => e.type === 'buildstart'));
  assert.ok(advance(s, 7).some((e) => e.type === 'built'));
  assert.ok(s.upgrades.well);
  assert.equal(s.money, zl(350));
  assert.equal(matCount(s, 'stone') + matCount(s, 'wood'), 0, 'materials used up');
  walkTo(s, 15, 6);
  assert.equal(s.water, CAN_SIZE);
});

test('walking away stops the building, nothing is paid', () => {
  const s = createState();
  s.money = zl(500);
  craft(s, 'wellPlan');
  addItem(s.bag, 'wood', 6);
  addItem(s.bag, 'stone', 12);
  walkTo(s, 15, 6);
  advance(s, 2);
  const events = [];
  command(s, 8, 12, 'auto', events);
  assert.ok(events.some((e) => e.type === 'buildcancel'));
  advance(s, 10);
  assert.ok(!s.upgrades.well);
  assert.equal(s.money, zl(500));
});

test('irrigation: the pump drives a limited number of sprinklers, the nozzles decide how much their water counts', () => {
  assert.equal(sprinklerReach(20, 7).length, 4, 'a sprinkler waters the four plots around its crossing');
  const s = createState();
  s.money = zl(1e5);
  assert.equal(upgradeProblem(s, 'pump'), 'requires', 'no upgrades before the pump is on the well');
  s.upgrades.well = true;
  s.upgrades.pump = true;
  // 7 sprinklers on the crossings of field A (x 19–26, y 5–10), but the first pump drives 6
  const spots = [20, 22, 24, 26].flatMap((x) => [6, 8, 10].map((y) => ({ x, y })));
  s.sprinklers.push(...spots.slice(0, 7));
  assert.equal(runningSprinklers(s).length, 6);
  addItem(s.bag, 'sprinkler', 1);
  addItem(s.bag, 'hose', 10);
  assert.equal(irrigationMissing(s), 'pumpfull');
  assert.equal(upgrade(s, 'pump').reason, 'nomats', 'the stronger pump needs iron');
  addItem(s.bag, 'iron', 12);
  addItem(s.bag, 'plastic', 14);
  assert.ok(upgrade(s, 'pump').ok);
  assert.equal(runningSprinklers(s).length, 7);
  assert.equal(irrigationMissing(s), null);

  // sprinkler water counts 50 %, then 80 %, then like watering by hand
  // a freshly planted pumpkin, watered by the sprinkler that morning, then two nights
  const credit = () => {
    const p = s.plots[idx(19, 5)] = { ...makePlot(), crop: 'pumpkin' };
    nextDay(s);
    assert.equal(p.wetBy, 'auto');
    nextDay(s);
    nextDay(s);
    return Math.round(p.wetDays * 10) / 10;
  };
  assert.equal(credit(), 1, '0.5 per watered day');
  assert.ok(upgrade(s, 'nozzles').ok);
  assert.equal(credit(), 1.6);
  assert.ok(upgrade(s, 'nozzles').ok);
  assert.equal(credit(), 2);
});

test('fertigation: nozzles at level 4 feed the plots from a tank filled with fertilizer from the bag', () => {
  const s = createState();
  s.money = zl(1e5);
  Object.assign(s.upgrades, { well: true, pump: true });
  s.sprinklers.push({ x: 20, y: 7 });
  addItem(s.bag, 'plastic', 14);
  assert.equal(fillTank(s).reason, 'requires');
  for (let l = 2; l <= 4; l++) assert.ok(upgrade(s, 'nozzles').ok);
  assert.equal(upgrade(s, 'nozzles').reason, 'max');
  assert.equal(fillTank(s).reason, 'nofert');
  addItem(s.bag, 'fertilizer:3', 2);
  addItem(s.bag, 'fertilizer:1', 5);
  assert.ok(fillTank(s).ok);
  assert.deepEqual(s.tank, { 1: 5, 2: 0, 3: 2 });
  assert.equal(countWhere(s.bag, (id) => id.startsWith('fertilizer')), 0);
  for (const [x, y] of [[19, 6], [20, 6], [19, 7]]) s.plots[idx(x, y)] = { ...makePlot(), crop: 'carrot' };
  s.plots[idx(20, 7)] = { ...makePlot(), crop: 'carrot', fert: 2 };
  s.plots[idx(25, 6)] = { ...makePlot(), crop: 'carrot' }; // out of reach
  const events = nextDay(s);
  assert.equal(events.find((e) => e.type === 'fertigated').n, 3);
  assert.deepEqual([[19, 6], [20, 6], [19, 7], [20, 7]].map(([x, y]) => s.plots[idx(x, y)].fert), [3, 3, 1, 2], 'the best first; fed plots are left alone');
  assert.equal(s.plots[idx(25, 6)].fert, 0);
  assert.deepEqual(s.tank, { 1: 4, 2: 0, 3: 0 });
});

test('irrigation is built from parts: pump on the well, hose and sprinklers', () => {
  const s = withSeeds();
  const [cx, cy] = [20, 7]; // crossing of plots (19..20, 6..7) in field A
  assert.equal(walkTo(s, cx, cy, 'place').events.find((e) => e.type === 'fail').reason, 'nowell');
  s.upgrades.well = true;
  assert.equal(walkTo(s, cx, cy, 'place').events.find((e) => e.type === 'fail').reason, 'nopump');

  // the pump is ordered, delivered to the chest and installed on the well
  s.money = zl(200);
  for (const id of ['pump', 'hose', 'sprinkler', 'sprinkler']) assert.ok(orderItem(s, id).ok);
  nextDay(s);
  assert.deepEqual(s.chest.filter(Boolean).map((it) => [it.id, it.n]), [['pump', 1], ['hose', 10], ['sprinkler', 2]]);
  for (let i = 0; i < 3; i++) moveItem(s, 'chest', i, 'bag');
  assert.ok(walkTo(s, 15, 6).events.some((e) => e.type === 'buildstart' && e.what === 'pump'));
  assert.ok(advance(s, 5).some((e) => e.type === 'built' && e.what === 'pump'));
  assert.ok(s.upgrades.pump);

  // a sprinkler stands on the crossing and takes no plot
  assert.ok(walkTo(s, cx, cy, 'place').events.some((e) => e.type === 'placed'));
  assert.equal(s.sprinklers.length, 1);
  assert.equal(matCount(s, 'hose'), 0, '10 m of hose per sprinkler');
  assert.equal(walkTo(s, 22, 7, 'place').events.find((e) => e.type === 'fail').reason, 'nohose');
  s.tool = 'seed';
  for (const [x, y] of [[19, 6], [20, 6], [19, 7], [20, 7]]) assert.ok(plotAction(s, x, y).ok, 'all four plots can still be planted');

  // and it waters them every morning, with less quality credit than by hand
  const events = nextDay(s);
  assert.ok(events.some((e) => e.type === 'sprinkle' && e.tiles.length === 4));
  assert.equal(s.plots[idx(19, 6)].wetBy, 'auto');
  nextDay(s);
  assert.equal(s.plots[idx(19, 6)].wetDays, UPGRADES.nozzles.values[0]);

  // picking it up gives back the sprinkler and the hose
  assert.ok(walkTo(s, cx, cy, 'pickup').events.some((e) => e.type === 'pickup'));
  assert.equal(s.sprinklers.length, 0);
  assert.equal(matCount(s, 'hose'), 10);
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

test('harvest-drone picks only what its camera allows, leaves the best for the farmer, carries the load to the chest', () => {
  const s = withSeeds(1);
  s.money = zl(5000);
  assert.equal(craft(s, 'replant').reason, 'requires');
  assert.equal(craft(s, 'drone').reason, 'nomats', 'a drone needs iron and plastic');
  addItem(s.bag, 'iron', 3);
  addItem(s.bag, 'plastic', 3);
  assert.ok(craft(s, 'drone').ok);
  assert.equal(matCount(s, 'iron') + matCount(s, 'plastic'), 0);
  assert.equal(craft(s, 'drone').reason, 'owned');
  const two = { wetDays: 1 }; // 35 + 15 = 50 → ★★
  s.plots[idx(AX, AY)] = ripePlot('carrot', { fert: 3 }); // ★★★★★
  s.plots[idx(AX + 1, AY)] = ripePlot('carrot', two);
  s.plots[idx(AX + 2, AY)] = ripePlot('carrot', two);
  // basket of 1: the drone takes one plot to the chest, then flies out for the next
  let events = advance(s, 2.5);
  const first = events.find((e) => e.type === 'harvest');
  assert.equal(first.by, 'drone');
  assert.equal(first.tier, 2);
  assert.equal(s.drone.carried, 1);
  assert.equal(s.chest[0], null, 'still in the basket');
  events = advance(s, 20);
  assert.deepEqual(s.chest[0], { id: cropItem('carrot', 2), n: 8 }, 'both ★★ plots end up in the chest');
  assert.deepEqual(s.drone.load, []);
  assert.equal(plotOf(s).crop, 'carrot', 'the ★★★★★ crop is left for the farmer');
  events = nextDay(s);
  assert.deepEqual(events.find((e) => e.type === 'droneleft'), { type: 'droneleft', n: 1, tier: 2 });

  // a better camera: up to ★★★★★
  assert.equal(upgrade(s, 'droneTier').reason, 'nomats');
  addItem(s.bag, 'plastic', 19);
  for (let k = 0; k < 3; k++) assert.ok(upgrade(s, 'droneTier').ok);
  assert.equal(upgrade(s, 'droneTier').reason, 'max');
  s.plots[idx(AX, AY)] = ripePlot('carrot', { fert: 3 });
  advance(s, 20);
  assert.equal(s.chest.find((it) => it?.id === cropItem('carrot', 5))?.n, 4);

  // faster engines and a bigger basket
  addItem(s.bag, 'iron', 3);
  assert.ok(upgrade(s, 'droneSpeed').ok);
  addItem(s.bag, 'wood', 4);
  assert.ok(upgrade(s, 'droneLoad').ok);
  assert.deepEqual([s.levels.droneSpeed, s.levels.droneLoad], [2, 2]);
});

test('replant.py plants the same seed again; v2 also waters, v3 also feeds from the chest', () => {
  const s = withSeeds(3);
  s.money = zl(5000);
  addItem(s.bag, 'iron', 3);
  addItem(s.bag, 'plastic', 3);
  assert.ok(craft(s, 'drone').ok);
  assert.ok(craft(s, 'replant').ok);
  s.plots[idx(AX, AY)] = ripePlot('carrot', { wetDays: 1 });
  advance(s, 10);
  assert.equal(s.seeds.radish, 3, 'no carrot seeds, so no replanting');
  assert.equal(plotOf(s).crop, null);
  s.plots[idx(AX + 1, AY)] = ripePlot('radish', { wetDays: 1 });
  advance(s, 10);
  assert.equal(plotOf(s, AX + 1, AY).crop, 'radish', 'replanted');
  assert.ok(!plotOf(s, AX + 1, AY).wet);
  assert.equal(s.seeds.radish, 2);

  assert.ok(upgrade(s, 'replant').ok);
  assert.ok(upgrade(s, 'replant').ok);
  addItem(s.chest, 'fertilizer:3', 1);
  s.plots[idx(AX + 2, AY)] = ripePlot('radish', { wetDays: 1 });
  advance(s, 10);
  const p = plotOf(s, AX + 2, AY);
  assert.deepEqual([p.crop, p.wet, p.wetBy, p.fert], ['radish', true, 'hand', 3]);
  assert.equal(countWhere(s.chest, (id) => id === 'fertilizer:3'), 0);
});

test('iron and plastic: ordered on the phone, delivered to the chest, sold back, named in the needs', () => {
  const s = createState();
  s.money = zl(100);
  assert.ok(orderItem(s, 'iron').ok);
  assert.ok(orderItem(s, 'plastic').ok);
  nextDay(s);
  assert.equal(countWhere(s.chest, (id) => id === 'iron'), 5);
  assert.equal(countWhere(s.chest, (id) => id === 'plastic'), 5);
  assert.ok(isSellable('iron') === false, 'materials are not produce');
  assert.ok(buybackList(s).some((b) => b.id === 'iron'));
  assert.equal(matsText({ iron: 4, plastic: 3, price: 9 }), '4 željeza, 3 plastike');
});

test('the big watering can grows with upgrades', () => {
  const s = createState();
  s.money = zl(500);
  assert.equal(upgrade(s, 'can').reason, 'requires');
  assert.ok(craft(s, 'bigCan').ok);
  assert.equal(s.water, 30);
  assert.equal(upgrade(s, 'can').reason, 'nomats');
  addItem(s.bag, 'iron', 6);
  assert.ok(upgrade(s, 'can').ok);
  assert.equal(s.water, 50, 'filled up');
  assert.ok(upgrade(s, 'can').ok);
  assert.equal(s.water, 80);
});

test('compost: 5 kg of produce make a bag (10 doses) of the same quality, ★★★ at most; git clone polje opens field B', () => {
  const s = withSeeds();
  addItem(s.bag, cropItem('carrot', 1), 4);
  assert.equal(makeCompost(s, 0).reason, 'compostkg', 'needs 5 kg');
  addItem(s.bag, cropItem('carrot', 1), 6);
  assert.ok(makeCompost(s, 0).ok);
  assert.equal(s.bag[0].n, 5);
  assert.equal(s.bag.find((it) => it?.id === 'fertilizer:1').n, 10, 'škart makes ★ compost');
  addItem(s.bag, cropItem('tomato', 3), 5);
  assert.equal(makeCompost(s, s.bag.findIndex((it) => it?.id === cropItem('tomato', 3))).tier, 3);
  addItem(s.bag, cropItem('potato', 5), 5);
  assert.equal(makeCompost(s, s.bag.findIndex((it) => it?.id === cropItem('potato', 5))).tier, 3, 'never better than ★★★');
  addItem(s.bag, 'crop:egg:2', 10);
  assert.equal(makeCompost(s, s.bag.findIndex((it) => it?.id === 'crop:egg:2')).reason, 'notcompost');
  // the best fertilizer goes on the plot first
  s.plots[idx(AX, AY)] = { ...makePlot(), crop: 'radish' };
  s.tool = 'fert';
  plotAction(s, AX, AY);
  assert.equal(plotOf(s).fert, 3);

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
  for (let i = 0; i < 3000 && s.farmer.job; i++) tick(s, 0.1, events);
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
  for (let i = 0; i < 3000 && s.farmer.job; i++) tick(s, 0.1, events);
  assert.equal(ripeCount(s), 0);
  assert.equal(s.bag[0].n, 5);

  const full = createState();
  for (let i = 0; i < BAG_SIZE; i++) full.bag[i] = { id: 'sprinkler', n: 99 };
  for (const i of PLOTS_A.slice(0, 3)) full.plots[i] = ripePlot('radish');
  const ev = [];
  startJob(full, 'harvest', null, ev);
  for (let i = 0; i < 3000 && full.farmer.job; i++) tick(full, 0.1, ev);
  assert.equal(ev.find((e) => e.type === 'jobend').reason, 'bagfull');
  assert.equal(ripeCount(full), 3);
  assert.equal(startJob(createState(), 'harvest').reason, 'nothingripe');
});

test('bulk jobs can be narrowed to one crop', () => {
  const s = withSeeds(5);
  s.seeds.carrot = 3;
  startJob(s, 'plant', 'carrot');
  for (let i = 0; i < 3000 && s.farmer.job; i++) tick(s, 0.1);
  const crops = Object.values(s.plots).filter((p) => p.crop).map((p) => p.crop);
  assert.deepEqual([...new Set(crops)], ['carrot']);
  assert.equal(crops.length, 3);
  assert.equal(s.seeds.radish, 5);

  s.plots[PLOTS_A[20]] = ripePlot('radish');
  s.plots[PLOTS_A[21]] = ripePlot('carrot');
  startJob(s, 'harvest', 'radish');
  for (let i = 0; i < 3000 && s.farmer.job; i++) tick(s, 0.1);
  assert.equal(ripeCount(s), 1);
  assert.equal(s.plots[PLOTS_A[21]].crop, 'carrot');
});

test('tilesBetween fills the gap a fast mouse leaves', () => {
  assert.deepEqual(tilesBetween([0, 0], [3, 0]), [[0, 0], [1, 0], [2, 0], [3, 0]]);
  assert.equal(tilesBetween([0, 0], [3, 3]).length >= 4, true);
  assert.deepEqual(tilesBetween([2, 2], [2, 2]), [[2, 2]]);
});

test('dragging over the field marks only plots where the tool has work', () => {
  const s = withSeeds(2);
  const row = PLOTS_A.slice(0, 4).map(xy);
  s.plots[PLOTS_A[1]] = ripePlot('radish');
  assert.deepEqual(dragTargets(s, 'plant', row), [row[0], row[2]], 'two seeds, the ripe plot is skipped');
  assert.deepEqual(dragTargets(s, 'harvest', [...row, [0, 0], xy(PLOTS_B[0])]), [row[1]], 'trees and the locked field are ignored');
});

test('drag-planting: the farmer works the marked plots; a second drag adds to the same job', () => {
  const s = withSeeds(6);
  s.tool = 'seed';
  const events = [];
  assert.equal(startJobOn(s, 'plant', PLOTS_A.slice(0, 2).map(xy), events).total, 2);
  startJobOn(s, 'plant', PLOTS_A.slice(1, 4).map(xy), events);
  assert.equal(s.farmer.job.total, 4, 'the overlap is not counted twice');
  assert.equal(events.filter((e) => e.type === 'jobstart').length, 1);
  for (let i = 0; i < 3000 && s.farmer.job; i++) tick(s, 0.1, events);
  assert.equal(PLOTS_A.slice(0, 4).filter((i) => s.plots[i].crop === 'radish').length, 4);
});

test('a drag with another tool replaces the running job; in town it is refused', () => {
  const s = withSeeds(6);
  s.plots[PLOTS_A[10]] = { ...makePlot(), crop: 'radish', progress: 0.3 };
  startJobOn(s, 'plant', PLOTS_A.slice(0, 3).map(xy));
  const events = [];
  startJobOn(s, 'water', [xy(PLOTS_A[10])], events);
  assert.equal(s.farmer.job.kind, 'water');
  assert.ok(events.some((e) => e.type === 'jobcancel'));
  const t = createState();
  t.market.trips.farmer = { phase: 'sell' };
  assert.equal(startJobOn(t, 'plant', [xy(PLOTS_A[0])]).reason, 'intown');
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

test('fertilize all uses the doses in the bag and stops when they run out', () => {
  const s = createState();
  assert.equal(startJob(s, 'fertilize').reason, 'nofert');
  addItem(s.bag, 'fertilizer:2', 3);
  for (const i of PLOTS_A.slice(0, 5)) s.plots[i] = { ...makePlot(), crop: 'carrot', progress: 0.2 };
  s.plots[PLOTS_A[5]] = { ...makePlot(), crop: 'carrot', progress: 0.2, fert: true };
  const events = [];
  assert.equal(startJob(s, 'fertilize', null, events).total, 3, 'only as many as there are doses');
  for (let i = 0; i < 3000 && s.farmer.job; i++) tick(s, 0.1, events);
  assert.equal(PLOTS_A.slice(0, 6).filter((i) => s.plots[i].fert).length, 4);
  assert.equal(events.find((e) => e.type === 'jobend').done, 3);
  assert.equal(startJob(s, 'fertilize').reason, 'nofert');
});

test('the woods: things to pick along the forest edge, new ones every morning', () => {
  const s = createState();
  assert.equal(s.forage.length, FORAGE_START);
  const spot = s.forage.find((f) => f.type === 'rocks') ?? s.forage[0];
  const { events } = walkTo(s, spot.x, spot.y);
  const picked = events.find((e) => e.type === 'foraged');
  assert.ok(picked, 'picked something');
  assert.equal(forageAt(s, spot.x, spot.y), -1);
  assert.ok(s.bag.some((it) => it?.id === picked.item && it.n === picked.n));
  const before = s.forage.length;
  nextDay(s);
  assert.ok(s.forage.length > before, 'more grew overnight');
  assert.ok(s.forage.length <= FORAGE_MAX);
});

test('forage food sells at the stand; wood and stone do not', () => {
  assert.ok(isSellable(cropItem('mushroom', 2)));
  assert.equal(salePrice('mushroom', 2), 600);
  assert.equal(salePrice('egg', 2), 40);
  assert.ok(!isSellable('wood'));
  const s = createState();
  addItem(s.bag, cropItem('mushroom', 2), 1);
  assert.equal(extractSeeds(s, 0).reason, 'notfruit', 'no seeds from mushrooms');
});

test('the coop is built like the well, hens are bought one by one and lay when fed', () => {
  const s = createState();
  assert.equal(walkTo(s, 12, 3).events.find((e) => e.type === 'fail').reason, 'noplan');
  s.money = zl(100);
  assert.ok(craft(s, 'coopPlan').ok);
  assert.ok(!s.coop.built, 'the workbench only sketches the plan');
  assert.equal(walkTo(s, 12, 3).events.find((e) => e.type === 'fail').reason, 'nomats');
  addItem(s.bag, 'wood', 10);
  addItem(s.bag, 'stone', 4);
  assert.ok(walkTo(s, 12, 3).events.some((e) => e.type === 'buildstart' && e.what === 'coop'));
  assert.ok(advance(s, 7).some((e) => e.type === 'built' && e.what === 'coop'));
  assert.ok(s.coop.built);
  assert.equal(s.coop.hens, 0, 'a repaired coop is empty');
  assert.equal(s.money, zl(75));

  assert.ok(orderItem(s, 'hen').ok);
  assert.ok(orderItem(s, 'hen').ok);
  nextDay(s);
  assert.equal(s.coop.hens, 2, 'hens arrive in the morning, straight into the coop');
  for (let i = 2; i < 9; i++) s.coop.hens = i + 1;
  assert.equal(orderItem(s, 'hen').reason, 'coopfull');
  s.coop.hens = 3;

  // a hen eats about 200 g a day: 1 kg feeds five hens
  s.coop.hens = 9;
  addItem(s.bag, cropItem('radish', 1), 2);
  const slot = s.bag.findIndex((it) => it?.id === cropItem('radish', 1));
  assert.ok(feedHens(s, slot, [], 1).ok, 'feed one kg at a time');
  assert.equal(s.coop.feed, 1);
  const events = nextDay(s);
  assert.equal(s.coop.eggs, 5, '1 kg fed five of the nine hens');
  assert.ok(events.some((e) => e.type === 'laid' && e.hungry === 4));
  assert.equal(s.coop.feed, 0);
  feedHens(s, slot);
  nextDay(s);
  assert.equal(s.coop.eggs, 5 + 5);
  assert.equal(s.coop.feed, 0, 'what is left over stays in the feeder, to 100 g');
  s.coop.feed = 1.3;
  s.coop.hens = 3;
  nextDay(s);
  assert.equal(s.coop.feed, 0.7);
  const ev = walkTo(s, 12, 3).events;
  assert.ok(ev.some((e) => e.type === 'eggs' && e.n === 13));
});

test('moving part of a stack', () => {
  const s = createState();
  addItem(s.bag, cropItem('carrot', 3), 10);
  assert.ok(moveItem(s, 'bag', 0, 'stand', [], 1).ok);
  assert.ok(moveItem(s, 'bag', 0, 'stand', [], 5).ok);
  assert.equal(s.bag[0].n, 4);
  assert.equal(s.stand[0].n, 6);
  assert.ok(moveItem(s, 'bag', 0, 'chest').ok, 'no amount = everything');
  assert.equal(s.bag[0], null);
  assert.equal(s.chest[0].n, 4);
});

test('side gigs: offered each morning, worked at home, paid when done', () => {
  const s = createState();
  nextDay(s);
  assert.ok(s.gigs.offers.length >= 1 && s.gigs.offers.length <= 3);
  const g = s.gigs.offers[0];
  const events = [];
  assert.ok(acceptGig(s, g.id, events).ok);
  assert.equal(acceptGig(s, s.gigs.offers[0]?.id ?? -1).reason, s.gigs.offers.length ? 'gigbusy' : 'gigbusy');
  for (let i = 0; i < 600 && !s.farmer.busy; i++) tick(s, 0.1, events);
  assert.equal(s.farmer.busy.what, 'gig', 'working at home');

  // stepping away keeps the progress
  advance(s, 10);
  const left = s.gigs.active.left;
  command(s, 8, 12, 'auto', events);
  assert.ok(events.some((e) => e.type === 'gigpause'));
  assert.ok(s.gigs.active.left <= left + 1e-9);

  const money = s.money;
  goWork(s, events);
  for (let i = 0; i < 4000 && s.gigs.active; i++) tick(s, 0.1, events);
  assert.equal(s.gigs.active, null);
  assert.equal(s.money, money + g.pay);
  assert.ok(events.some((e) => e.type === 'gigdone'));
});

test('the stand is by the road', () => {
  assert.ok(OBJECTS.stand.access.every(([x]) => x >= 38), 'next to the road on the east side');
  const fromRoad = findPath(SPAWNS[0], [CUSTOMER_SPOT], isWalkable);
  const fromDoor = findPath(HOUSE_DOOR, [CUSTOMER_SPOT], isWalkable);
  assert.ok(fromRoad.length < fromDoor.length, 'closer to the road than to the house');
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

  // v6: nobody loses anything to the new upgrades
  const sprinklers = [20, 22, 24, 26].flatMap((x) => [6, 8].map((y) => ({ x, y })));
  const v6 = deserialize(JSON.stringify({ version: 6, upgrades: { drone: true, well: true, pump: true }, irrigation: 6, sprinklers })).state;
  assert.equal(v6.sprinklers.length, 8);
  assert.deepEqual([v6.levels.droneTier, v6.levels.nozzles, v6.levels.pump], [2, 3, 2], '★★★ drone, 100 % nozzles, a pump for 8');
  const v6b = deserialize(JSON.stringify({ version: 6, upgrades: { well: true, pump: true }, irrigation: 1 })).state;
  assert.deepEqual([v6b.levels.droneTier, v6b.levels.nozzles, v6b.levels.pump], [1, 2, 1], '80 % beats the old 75 %');

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
    // working poses: drawn, and not just the standing farmer
    const stand = A.person({ dir, farmer: true }).d.join();
    for (const [pose, frame] of [['bend', 0], ['bend', 1], ['pour', 0]]) {
      const pic = A.person({ dir, frame, farmer: true, pose });
      check(pic, 24, 32, `farmer ${dir} ${pose} ${frame}`);
      assert.notEqual(pic.d.join(), stand, `farmer ${dir} ${pose} looks like standing`);
    }
  }
  for (const c of CROPS) {
    for (const stage of ['sprout', 'young', 'ripe', 'rotten']) check(A.crop(c.id, stage), 24, 28, `${c.id} ${stage}`);
    check(A.icon(c.id), 16, 16, `icon ${c.id}`);
  }
  for (const i of ['fertilizer', 'sprinkler', 'hand', 'seeds', 'can', 'phone', 'gold', 'silver', 'egg', 'mushroom', 'blackberry', 'wood', 'stone', 'iron', 'plastic', 'jar', 'honey']) check(A.icon(i), 16, 16, i);
  check(A.tap(), 20, 30, 'tap');
  check(A.coop(true), 72, 72, 'broken coop');
  check(A.coop(false), 72, 72, 'coop');
  for (const f of ['mushroom', 'blackberry', 'branches', 'rocks']) check(A.forageSprite(f), 24, 24, f);
  check(A.hen(true, 1), 14, 12, 'hen');
  assert.deepEqual(A.roundTree(5).d, A.roundTree(5).d, 'art is deterministic');
});

// ---------------------------------------------------------------- the town market

const marketReady = () => {
  const s = createState();
  s.money = zl(2000);
  assert.ok(rentStall(s).ok);
  return s;
};

test('market: rent a stall once, then the farmer takes the bag to town and sells far more than the stand', () => {
  const s = createState();
  assert.equal(farmerTripProblem(s), 'nostall');
  assert.equal(goToMarket(s).reason, 'nostall');
  assert.ok(rentStall(s).ok);
  assert.equal(s.money, START - zl(MARKET.stall));
  assert.equal(rentStall(s).reason, 'owned');
  assert.equal(goToMarket(s).reason, 'nothingtosell');

  addItem(s.bag, 'crop:potato:2', 60);
  addItem(s.bag, 'wood', 5);
  const events = [];
  assert.ok(goToMarket(s, events).ok);
  for (let i = 0; i < 400 && s.farmer.path.length; i++) tick(s, 0.1, events);
  assert.deepEqual([s.farmer.x, s.farmer.y], TOWN_EXIT);
  assert.ok(s.market.trips.farmer, 'left for town at the end of the road');
  assert.ok(events.some((e) => e.type === 'tripstart' && e.who === 'farmer'));

  // in town: the farmer can't be ordered around, and the bag is with him
  assert.equal(command(s, ...HOUSE_DOOR).reason, 'intown');
  assert.equal(startJob(s, 'water').reason, 'intown');
  assert.equal(moveItem(s, 'bag', 0, 'chest').reason, 'intown');

  const before = s.money;
  for (let i = 0; i < 400 && !events.some((e) => e.type === 'tripdone'); i++) advance(s, 1, events);
  const done = events.find((e) => e.type === 'tripdone');
  assert.ok(done, 'came back');
  assert.equal(s.market.trips.farmer, null);
  assert.ok(done.kg >= 40, `sold ${done.kg} kg`);
  assert.equal(s.money - before, done.money);
  for (const e of events.filter((x) => x.type === 'marketsale')) {
    assert.equal(e.money, Math.round(salePrice('potato', 2) * e.qty * (1 + MARKET.markup)), 'the market pays more than the stand');
  }
  assert.ok(MARKET.markup > REQUESTS.bonus && ONLINE.markup > MARKET.markup, 'price ladder: stand order < market < online');
  assert.equal(matCount(s, 'wood'), 5, 'only produce is sold');
  assert.ok(s.clock <= MARKET.close + MARKET.walk + 1, 'home by 14:00');
  // walks down the road from where it leaves the map
  for (let i = 0; i < 400 && s.farmer.path.length; i++) tick(s, 0.1, events);
  assert.ok(OBJECTS.market.access.some(([x, y]) => x === s.farmer.x && y === s.farmer.y));
});

test('market: the farmer only goes while he can still make it before closing, and can come back early', () => {
  const s = marketReady();
  addItem(s.bag, 'crop:carrot:3', 20);
  s.clock = MARKET.close - MARKET.walk + 1;
  assert.equal(goToMarket(s).reason, 'toolate');
  s.clock = DAY_START;
  s.farmer.x = TOWN_EXIT[0];
  s.farmer.y = TOWN_EXIT[1];
  assert.ok(goToMarket(s).ok);
  assert.ok(s.market.trips.farmer);
  const events = [];
  advance(s, 10, events);
  assert.ok(comeBack(s, 'farmer', events).ok);
  assert.equal(s.market.trips.farmer.phase, 'back');
  advance(s, 11, events);
  assert.ok(events.some((e) => e.type === 'tripdone'));
  assert.equal(matCount(s, 'crop:carrot:3'), 20, 'turned back before the market: nothing sold');
});

test('market: the van with a hired hand drives the load to town every morning and is paid only on those days', () => {
  const s = marketReady();
  assert.equal(hireWorker(s).reason, 'novan');
  assert.ok(buyVan(s).ok);
  assert.ok(hireWorker(s).ok);
  addItem(s.bag, 'crop:tomato:3', 80);
  assert.ok(moveItem(s, 'bag', 0, 'cargo').ok);
  assert.equal(s.cargo[0].n, 80);
  addItem(s.bag, 'stone', 3);
  assert.equal(moveItem(s, 'bag', 0, 'cargo').reason, 'notsellable');

  const money = s.money;
  const events = nextDay(s);
  assert.ok(events.some((e) => e.type === 'tripstart' && e.who === 'van'), 'left at 6');
  assert.equal(s.money, money - zl(MARKET.wage));
  assert.equal(moveItem(s, 'bag', 0, 'cargo').reason, 'novan', 'nothing goes in while the van is away');

  // the farmer is free meanwhile
  assert.ok(command(s, ...HOUSE_DOOR).ok);
  advance(s, 260, events);
  const done = events.find((e) => e.type === 'tripdone' && e.who === 'van');
  assert.ok(done && done.kg > 0);
  assert.equal(s.market.trips.van, null);

  // an empty van stays home and costs nothing
  s.cargo.fill(null);
  const before = s.money;
  const ev2 = nextDay(s);
  assert.ok(ev2.some((e) => e.type === 'vanidle'));
  assert.equal(s.market.trips.van, null);
  assert.equal(s.money, before);
});

test('market: the van can be sent during the day; no van without the stall, the worker or the wage', () => {
  const s = marketReady();
  assert.equal(sendVan(s).reason, 'novan');
  buyVan(s);
  assert.equal(sendVan(s).reason, 'noworker');
  hireWorker(s);
  assert.equal(sendVan(s).reason, 'nothingtosell');
  addItem(s.cargo, 'crop:egg:2', 30);
  s.money = 0;
  assert.equal(sendVan(s).reason, 'coins');
  s.money = zl(100);
  assert.ok(sendVan(s).ok);
  assert.equal(sendVan(s).reason, 'vanaway');
});

test('market: the van gets to town faster than the farmer on foot, so it can still leave later', () => {
  const s = marketReady();
  buyVan(s);
  hireWorker(s);
  addItem(s.cargo, 'crop:carrot:2', 30);
  addItem(s.bag, 'crop:carrot:2', 30);
  s.farmer.x = TOWN_EXIT[0];
  s.farmer.y = TOWN_EXIT[1];
  assert.ok(MARKET.drive < MARKET.walk);
  assert.ok(goToMarket(s).ok);
  assert.ok(sendVan(s).ok);
  const arrived = {};
  const events = [];
  for (let i = 0; i < 200 && Object.keys(arrived).length < 2; i++) {
    events.length = 0;
    advance(s, 0.5, events);
    for (const e of events) if (e.type === 'triparrive') arrived[e.who] ??= s.clock;
  }
  assert.ok(arrived.van < arrived.farmer, `van ${arrived.van}, farmer ${arrived.farmer}`);

  // too late to walk there before closing, but the van still makes it
  const t = marketReady();
  buyVan(t);
  hireWorker(t);
  addItem(t.cargo, 'crop:carrot:2', 30);
  addItem(t.bag, 'crop:carrot:2', 30);
  t.clock = MARKET.close - MARKET.walk + 5;
  assert.equal(farmerTripProblem(t), 'toolate');
  assert.ok(sendVan(t).ok);
});

test('market: a trip survives saving, and nobody stays in town overnight', () => {
  const s = marketReady();
  buyVan(s);
  hireWorker(s);
  addItem(s.cargo, 'crop:pumpkin:2', 40);
  addItem(s.bag, 'crop:mushroom:2', 4);
  assert.ok(sendVan(s).ok);
  advance(s, 40);
  const { state: t, restored } = deserialize(serialize(s));
  assert.ok(restored);
  assert.ok(t.market.van && t.market.worker && t.market.stall);
  assert.equal(t.market.trips.van.phase, s.market.trips.van.phase);
  assert.deepEqual(t.cargo, s.cargo);

  // old v5 farms load with an empty market
  const old = JSON.parse(serialize(createState()));
  old.version = 5;
  delete old.market;
  delete old.cargo;
  const r = deserialize(JSON.stringify(old));
  assert.ok(r.restored);
  assert.equal(r.state.market.stall, false);

  s.clock = 20 * 60;
  const events = [];
  sleep(s, events);
  assert.ok(events.some((e) => e.type === 'tripdone'), 'the evening trip is ended');
  // the unsold load goes again the next morning
  assert.equal(s.market.trips.van.phase, 'go');
  assert.equal(events.filter((e) => e.type === 'tripstart').length, 1);
});

// ---------------------------------------------------------------- deliveries and buildings

test('deliveries: no second pump by mistake, orders can be cancelled until morning and survive a reload', () => {
  const s = createState();
  s.money = zl(500);
  assert.ok(orderItem(s, 'pump').ok);
  assert.equal(pumpStatus(s), 'ordered');
  assert.equal(orderItem(s, 'pump').reason, 'pumpordered');
  assert.equal(s.money, zl(500 - 70));
  assert.ok(orderItem(s, 'hose').ok);
  assert.ok(orderItem(s, 'hose').ok);
  assert.ok(orderSeeds(s, 'radish').ok);

  // every kind of order is still there after saving and loading
  const { state: t } = deserialize(serialize(s));
  assert.deepEqual(t.orders, s.orders);

  // cancel one pack of hose, then the pump: money back in full
  const k = s.orders.findIndex((o) => o.item === 'hose');
  assert.ok(cancelOrder(s, k).ok);
  assert.equal(s.orders[k].n, 10);
  assert.ok(cancelOrder(s, s.orders.findIndex((o) => o.item === 'pump')).ok);
  assert.equal(pumpStatus(s), null);
  assert.equal(s.money, zl(500 - 9) - packPrice('radish'));
  assert.equal(cancelOrder(s, 99).reason, 'noorder');

  // delivered pumps count too, and so does one on the well
  assert.ok(orderItem(s, 'pump').ok);
  nextDay(s);
  assert.equal(pumpStatus(s), 'have');
  assert.equal(orderItem(s, 'pump').reason, 'pumphave');
});

test('buildings: a failed build says what it needs, not only that money is short', () => {
  const s = createState();
  s.upgrades.wellPlan = true;
  const events = [];
  const r = objectAction(s, 'well', events);
  assert.equal(r.reason, 'coins');
  const e = events.find((x) => x.type === 'fail');
  assert.equal(e.what, 'well');
  assert.equal(e.need, zl(150));
  assert.ok(e.mats.wood && e.mats.stone);
  // enough money but no materials: still the full picture
  s.money = zl(200);
  const ev2 = [];
  objectAction(s, 'well', ev2);
  assert.equal(ev2[0].reason, 'nomats');
  assert.equal(ev2[0].what, 'well');
});

// ---------------------------------------------------------------- fishing and eggs

const fisher = (seed = 12345) => {
  const s = createState(seed);
  addItem(s.bag, 'wood', 2);
  assert.ok(craft(s, 'rod').ok, 'the rod is made at the workbench from 2 wood');
  assert.equal(matCount(s, 'wood'), 0);
  s.tool = 'rod';
  const [px, py] = OBJECTS.pond.access[0];
  Object.assign(s.farmer, { x: px, y: py });
  return s;
};
const fishTill = (s, clock, events = []) => {
  while (s.clock < clock && s.farmer.busy?.what === 'fish') advance(s, 5, events);
  return events;
};
const caughtKg = (s) => countWhere(s.bag, (id) => /^crop:(carp|tench|pike):/.test(id));

test('fishing is idle: the farmer fishes all day by himself, slowly tiring, until dark', () => {
  const s0 = createState();
  s0.tool = 'rod';
  objectAction(s0, 'pond');
  assert.equal(s0.farmer.busy, null, 'without a rod the pond just fills the can');

  const s = fisher();
  s.pond.fish = 3; // a lucky day
  const events = [];
  assert.ok(objectAction(s, 'pond', events).ok);
  assert.equal(s.farmer.busy.what, 'fish');
  fishTill(s, 26 * 60, events);
  const caught = events.filter((e) => e.type === 'caught');
  assert.equal(caught.length, 3, 'caught all of the day\'s fish, nobody had to click');
  assert.equal(s.pond.caught, 3);
  assert.ok(caughtKg(s) >= 3);
  assert.ok(caught.every((e) => e.tier >= 1 && e.tier <= 3));
  const stop = events.find((e) => e.type === 'fishstop');
  assert.equal(stop.reason, 'dark', 'packs up when it gets dark');
  assert.ok(s.clock >= FISHING.until && s.clock < FISHING.until + 10);
  // 06:00 → 22:00 is 16 hours at 1 ⚡ an hour
  assert.ok(Math.abs(s.energy - (MAX_ENERGY - 16 * FISHING.energyPerHour)) < 0.5, `energy ${s.energy}`);
  assert.equal(objectAction(s, 'pond').reason, 'fishdark');
});

test('fishing: some days nothing bites; the pond\'s luck is new every morning', () => {
  const s = fisher();
  s.pond.fish = 0;
  objectAction(s, 'pond');
  const events = fishTill(s, 26 * 60);
  assert.equal(events.filter((e) => e.type === 'caught').length, 0);
  assert.equal(events.find((e) => e.type === 'fishstop').caught, 0);

  const luck = [];
  for (let d = 0; d < 60; d++) {
    nextDay(s);
    luck.push(s.pond.fish);
    assert.equal(s.pond.caught, 0);
  }
  assert.ok(luck.includes(0), 'days without fish');
  assert.ok(luck.some((n) => n >= 3), 'and lucky days');
  assert.ok(Math.max(...luck) < FISHING.daily.length);
});

test('fishing: called away, tired or a full bag stops it; it goes on after a reload', () => {
  const s = fisher();
  objectAction(s, 'pond');
  const ev = [];
  command(s, ...HOUSE_DOOR, 'auto', ev);
  assert.equal(s.farmer.busy, null);
  assert.ok(ev.some((e) => e.type === 'fishstop'));

  const t = fisher();
  objectAction(t, 'pond');
  assert.ok(stopFishing(t).ok);
  t.energy = 0.2;
  objectAction(t, 'pond');
  assert.equal(t.farmer.busy, null, 'too tired to start');
  t.energy = 1.5;
  objectAction(t, 'pond');
  const e2 = fishTill(t, 26 * 60);
  assert.equal(e2.find((e) => e.type === 'fishstop').reason, 'tired');

  const u = fisher();
  u.pond.fish = 5;
  for (let i = 0; i < u.bag.length; i++) if (!u.bag[i]) u.bag[i] = { id: 'stone', n: 99 };
  objectAction(u, 'pond');
  const e3 = fishTill(u, 26 * 60);
  assert.equal(e3.find((e) => e.type === 'fishstop').reason, 'bagfull');

  const v = fisher();
  objectAction(v, 'pond');
  const { state: w } = deserialize(serialize(v));
  assert.equal(w.farmer.busy?.what, 'fish', 'still fishing after a reload');
});

test('eggs can be eaten', () => {
  const s = createState();
  s.energy = 50;
  addItem(s.bag, 'crop:egg:2', 2);
  assert.ok(eat(s, 0).ok);
  assert.ok(s.energy > 50);
  assert.equal(s.bag[0].n, 1);
});

test('seeds never cost more than the crop: a pack is cheaper than 1 kg, and every crop pays about the same per day', () => {
  const perDay = [];
  for (const c of CROPS) {
    assert.ok(c.pack < c.price, `${c.name}: pack ${c.pack} zl < 1 kg ${c.price} zl`);
    const plot = c.yield * c.price;
    const seed = c.pack / 5;
    assert.ok(seed <= plot / 10, `${c.name}: one seed is at most a tenth of the plot`);
    perDay.push((plot - seed) / c.days);
  }
  assert.ok(Math.max(...perDay) / Math.min(...perDay) < 1.5, `per plot per day: ${perDay.map((x) => x.toFixed(2)).join(', ')}`);
});

// ---------------------------------------------------------------- weather, mulch, chest, orders, otkup, bees, decor, pet

test('rain: a rainy morning waters everything planted, and new plants that day; the forecast is known a day ahead', () => {
  const s = withSeeds(5);
  s.plots[PLOTS_A[0]] = { ...makePlot(), crop: 'potato', progress: 0.2 };
  s.tomorrow = 'rain';
  s.clock = 20 * 60;
  const events = [];
  sleep(s, events);
  assert.equal(s.weather, 'rain');
  assert.ok(['rain', 'sun'].includes(s.tomorrow));
  assert.ok(events.some((e) => e.type === 'rain' && e.n === 1));
  assert.ok(s.plots[PLOTS_A[0]].wet);
  s.tool = 'seed';
  plotAction(s, ...xy(PLOTS_A[1]));
  assert.ok(s.plots[PLOTS_A[1]].wet, 'planted in the rain: watered');
  // rain counts like hand watering for quality
  const p = s.plots[PLOTS_A[0]];
  nextDay(s);
  assert.equal(p.wetDays, 1);
  let rainy = 0;
  for (let d = 0; d < 100; d++) { s.clock = 20 * 60; sleep(s); if (s.weather === 'rain') rainy++; }
  assert.ok(rainy > 5 && rainy < 50, `rainy days: ${rainy}/100`);
});

test('mulch: made at the workbench from wood, keeps the soil wet for two days', () => {
  const s = withSeeds(5);
  addItem(s.bag, 'wood', 2);
  assert.ok(craft(s, 'mulch').ok);
  assert.equal(matCount(s, 'mulch'), 10);
  const i = PLOTS_A[0];
  s.plots[i] = { ...makePlot(), crop: 'potato' };
  const [x, y] = xy(i);
  s.tool = 'mulch';
  assert.ok(plotAction(s, x, y).ok);
  assert.ok(s.plots[i].mulch);
  assert.equal(matCount(s, 'mulch'), 9);
  assert.equal(plotAction(s, x, y).reason, 'mulched');
  s.tool = 'can';
  plotAction(s, x, y);
  nextDay(s);
  assert.ok(s.plots[i].wet, 'still moist the next morning');
  assert.equal(s.plots[i].wetDays, 1);
  nextDay(s);
  assert.equal(s.plots[i].wetDays, 2, 'the second day counted as watered too');
  assert.ok(!s.plots[i].wet, 'dry on the third morning');
  // mulch everything with the bulk job
  s.plots[PLOTS_A[1]] = { ...makePlot(), crop: 'carrot' };
  const events = [];
  assert.equal(startJob(s, 'mulch', null, events).total, 1);
});

test('the chest: produce slowly loses quality, the cold room keeps it', () => {
  const s = createState();
  addItem(s.chest, cropItem('tomato', 4), 10);
  for (let d = 0; d < 12; d++) nextDay(s);
  const t = s.chest.find(Boolean);
  assert.ok(Number(t.id.split(':')[2]) < 4, 'lost some quality');
  assert.equal(t.n, 10);
  const c = createState();
  c.money = zl(500);
  addItem(c.bag, 'stone', 8);
  assert.equal(craft(c, 'coldroom').reason, 'nomats', 'a cold room is made of iron and plastic, not stone');
  addItem(c.bag, 'iron', 6);
  addItem(c.bag, 'plastic', 4);
  assert.ok(craft(c, 'coldroom').ok);
  addItem(c.chest, cropItem('tomato', 4), 10);
  for (let d = 0; d < 12; d++) nextDay(c);
  assert.equal(c.chest.find(Boolean).id, cropItem('tomato', 4));
});

test('customers order ahead: hand it over at the stand for extra pay, or it is missed', () => {
  const s = createState();
  let tries = 0;
  while (!s.requests.length && tries++ < 30) nextDay(s);
  assert.ok(s.requests.length, 'an order came in');
  const r = s.requests[0];
  assert.ok(r.due > s.day - 1 && r.kg >= 3 && r.tier >= 2);
  assert.equal(fulfillRequest(s, r.id).reason, 'requestshort');
  const better = Math.min(5, r.tier + 1);
  addItem(s.bag, cropItem(r.crop, better), r.kg);
  const money = s.money;
  assert.ok(fulfillRequest(s, r.id).ok);
  assert.equal(s.money - money, Math.round(salePrice(r.crop, better) * r.kg * (1 + REQUESTS.bonus)), 'a better class is paid at its own price plus the bonus');
  assert.ok(requestPay(r) > salePrice(r.crop, r.tier) * r.kg, 'pays more than the stand');
  // a mix: the worst good-enough goes first, each unit paid at its class
  s.requests = [{ id: 998, who: 'test', crop: 'carrot', kg: 4, tier: 2, due: s.day + 1 }];
  addItem(s.bag, cropItem('carrot', 2), 1);
  addItem(s.bag, cropItem('carrot', 5), 5);
  const m2 = s.money;
  assert.ok(fulfillRequest(s, 998).ok);
  assert.equal(s.money - m2, Math.round((salePrice('carrot', 2) + 3 * salePrice('carrot', 5)) * (1 + REQUESTS.bonus)));
  // a missed order disappears with a message
  s.requests = [{ id: 999, who: 'test', crop: 'carrot', kg: 5, tier: 2, due: s.day }];
  const events = nextDay(s);
  assert.ok(events.some((e) => e.type === 'requestmissed' && e.id === 999));
  assert.ok(!s.requests.some((x) => x.id === 999));
});

test('otkup: parts, fertilizer and decorations sell back for half, from the chest first', () => {
  const s = createState();
  addItem(s.chest, 'pump', 1);
  addItem(s.bag, 'pump', 1);
  addItem(s.bag, 'hose', 25);
  const list = buybackList(s);
  assert.equal(list.find((b) => b.id === 'pump').n, 2);
  const money = s.money;
  assert.ok(sellBack(s, 'pump').ok);
  assert.equal(s.money - money, zl(70) / 2);
  assert.equal(s.chest.filter(Boolean).length, 0, 'the chest went first');
  assert.ok(sellBack(s, 'hose').ok);
  assert.equal(matCount(s, 'hose'), 15, 'hose sells 10 m at a time');
  assert.equal(sellBack(s, 'wood').reason, 'nobuyback');
});

test('bees and decorations go on the grass, never closing off the farm; hives fill with honey', () => {
  const s = createState();
  s.money = zl(200);
  addItem(s.bag, 'wood', 6);
  assert.ok(craft(s, 'hive').ok);
  const spot = [30, 9];
  assert.ok(placeItem(s, ...spot, 'hive').ok);
  assert.equal(walkFn(s)(...spot), false, 'a hive is in the way');
  assert.equal(placeItem(s, AX, AY, 'deco:fence').reason, 'noitem');
  addItem(s.bag, 'deco:fence', 50);
  assert.equal(placeItem(s, AX, AY, 'deco:fence').reason, 'placegrass', 'not on a plot');
  assert.ok(placeItem(s, 30, 10, 'deco:fence').ok);
  assert.equal(placeItem(s, 30, 10, 'deco:fence').reason, 'placetaken');
  // honey every second morning, collected into jars
  nextDay(s);
  nextDay(s);
  assert.equal(s.hives[0].honey, 1);
  assert.ok(walkTo(s, ...spot).events.some((e) => e.reason === 'nojars'), 'no jars, the honey stays in the hive');
  assert.equal(s.hives[0].honey, 1);
  addItem(s.bag, 'jar', 3);
  const { events } = walkTo(s, ...spot);
  assert.ok(events.some((e) => e.type === 'honey' && e.n === 1));
  assert.equal(matCount(s, 'jar'), 2, 'one jar per kg');
  assert.equal(countWhere(s.bag, (id) => id === 'crop:honey:2'), 1);
  assert.ok(removeItem(s, ...spot).ok);
  assert.equal(s.hives.length, 0);
  assert.equal(matCount(s, 'hive'), 1);
});

test('a fence or bench may not close anything off; paths and flowers can go anywhere on grass', () => {
  const s = createState();
  addItem(s.bag, 'deco:fence', 9);
  addItem(s.bag, 'deco:path', 5);
  // the only spot in front of the workbench: a fence there would shut it off
  const [wx, wy] = OBJECTS.workbench.access[0];
  assert.equal(placeItem(s, wx, wy, 'deco:fence').reason, 'placeblocks');
  assert.ok(placeItem(s, wx, wy, 'deco:path').ok, 'a stone path is walked on');
  assert.ok(walkFn(s)(wx, wy));
  // the farm is still open: every building is reachable from the door
  for (const [id, o] of Object.entries(OBJECTS)) assert.ok(findPath(HOUSE_DOOR, o.access, walkFn(s)), id);
});

test('the pet: adopted from the shelter, a pat once a day gives energy', () => {
  const s = createState();
  s.energy = 50;
  assert.ok(adoptPet(s, 'cat').ok);
  assert.equal(adoptPet(s, 'dog').reason, 'haspet');
  assert.equal(s.pet.name, 'Maca');
  patPet(s);
  assert.equal(s.energy, 55);
  patPet(s);
  assert.equal(s.energy, 55, 'only once a day');
  nextDay(s);
  s.energy = 50;
  patPet(s);
  assert.equal(s.energy, 55);
  const { state: t } = deserialize(serialize(s));
  assert.equal(t.pet.kind, 'cat');
});

// ---------------------------------------------------------------- upgrades, step 2

test('upgrades step 2: every line belongs to something that can be owned, and buildings must be there first', () => {
  const s = createState();
  s.money = zl(5000);
  for (const [line, u] of Object.entries(UPGRADES)) {
    assert.equal(u.steps.length, u.values.length - 1, line);
    assert.ok(u.values.every((v, k) => typeof u.text(v, k + 1) === 'string'), line);
  }
  // the fields, mulch and hives can be upgraded from the start; the coop and the well once they stand
  assert.ok(owns(s, 'field') && owns(s, 'mulch') && owns(s, 'hive'));
  assert.equal(upgradeProblem(s, 'coopHens'), 'requires');
  assert.equal(upgradeProblem(s, 'tap'), 'requires');
  assert.equal(upgradeProblem(s, 'ads'), 'requires', 'advertising needs the poster first');
  assert.equal(upgradeProblem(s, 'mulchDays'), 'nomats');
  addItem(s.bag, 'wood', 4);
  assert.ok(upgrade(s, 'mulchDays').ok);
  assert.equal(upgrade(s, 'mulchDays').reason, 'max');
});

test('fishing upgrades: a better rod lands more ★★★, bait makes fish bite sooner, a net stretches lucky days to 7', () => {
  const share = (rodLevel) => {
    let top = 0;
    let all = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = fisher(seed * 7919);
      s.levels.rodTier = rodLevel;
      s.pond.fish = 5;
      objectAction(s, 'pond');
      for (const e of fishTill(s, 26 * 60).filter((x) => x.type === 'caught')) {
        all++;
        if (e.tier === 3) top++;
      }
    }
    return top / all;
  };
  const base = share(1);
  const best = share(3);
  assert.ok(base > 0.15 && base < 0.45, `plain rod ${base}`);
  assert.ok(best > 0.55, `best rod ${best}`);

  const bites = (bait) => {
    const s = fisher(99);
    s.levels.rodBait = bait;
    s.pond.fish = 0;
    objectAction(s, 'pond');
    return s.farmer.busy.next;
  };
  assert.ok(Math.abs(bites(3) - bites(1) * UPGRADES.rodBait.values[2]) < 1e-9, 'the same wait, halved');

  const s = fisher();
  const luck = (net) => {
    s.levels.rodNet = net;
    const out = [];
    for (let d = 0; d < 80; d++) out.push(nextDay(s) && s.pond.fish);
    return out;
  };
  assert.ok(Math.max(...luck(1)) <= FISHING.daily.length - 1);
  const big = luck(2);
  assert.ok(Math.max(...big) === 7 && big.includes(0), 'up to 7 fish, and bad days stay bad');
  s.pond.fish = 7;
  const { state: t } = deserialize(serialize(s));
  assert.equal(t.pond.fish, 7, 'the net\'s catch survives a reload');
});

test('mulch upgrades: the shredder makes 20 doses from 2 wood, bark keeps the soil moist for 3 days', () => {
  const s = withSeeds(5);
  s.levels.mulchMaker = 2;
  s.levels.mulchDays = 2;
  addItem(s.bag, 'wood', 2);
  assert.ok(craft(s, 'mulch').ok);
  assert.equal(matCount(s, 'mulch'), 20);
  const i = PLOTS_A[0];
  s.plots[i] = { ...makePlot(), crop: 'pumpkin' };
  const [x, y] = xy(i);
  s.tool = 'mulch';
  assert.ok(plotAction(s, x, y).ok);
  assert.equal(s.plots[i].mulch, 3);
  s.tool = 'can';
  plotAction(s, x, y);
  nextDay(s);
  nextDay(s);
  assert.ok(s.plots[i].wet, 'still moist on the third day');
  assert.equal(s.plots[i].wetDays, 2);
  nextDay(s);
  assert.equal(s.plots[i].wetDays, 3, 'three days of growth from one watering');
  assert.ok(!s.plots[i].wet);
  // a plot mulched before v8 (mulch: true) keeps its two days
  const old = JSON.parse(serialize(s));
  old.version = 7;
  old.plots[i].mulch = true;
  assert.equal(deserialize(JSON.stringify(old)).state.plots[i].mulch, 2);
});

test('hive upgrades: a bigger hive, honey every day, and bees that pollinate the plots nearby', () => {
  const s = createState();
  s.hives.push({ x: 17, y: 6, honey: 0, days: 0 });
  s.levels.hiveRate = 2;
  s.levels.hiveCap = 2;
  for (let d = 0; d < 12; d++) nextDay(s);
  assert.equal(s.hives[0].honey, 10, 'one kg every morning, up to 10');
  // a jar per kg: with 4 jars only 4 kg come out, the rest waits
  addItem(s.bag, 'jar', 4);
  const { events } = walkTo(s, 17, 6);
  assert.ok(events.some((e) => e.type === 'honey' && e.n === 4 && e.left === 6));
  assert.equal(matCount(s, 'jar'), 0);

  // pollination: a perfect plot with ★★ fertilizer near the hive reaches ★★★★★
  const grow = (pollen) => {
    const f = createState();
    f.hives.push({ x: 17, y: 6, honey: 0, days: 0 });
    f.levels.hivePollen = pollen;
    const near = idx(19, 6);
    f.plots[near] = { ...makePlot(), crop: 'radish', fert: 2 };
    f.plots[near].wet = true;
    f.plots[near].wetLeft = 1;
    nextDay(f);
    return f.plots[near];
  };
  const plain = grow(1);
  const bees = grow(2);
  assert.ok(!plain.pollen && bees.pollen);
  assert.equal(qualityScore(bees), qualityScore(plain) + POLLEN_BONUS);
  assert.equal(tierOf(qualityScore(plain)), 4);
  assert.equal(tierOf(qualityScore(bees)), 5);
  const far = createState();
  far.hives.push({ x: 17, y: 6, honey: 0, days: 0 });
  far.levels.hivePollen = 2;
  const i = idx(26, 10); // 9 tiles away
  far.plots[i] = { ...makePlot(), crop: 'radish' };
  nextDay(far);
  assert.ok(!far.plots[i].pollen, 'too far for the bees');
});

test('cold room shelves: the chest grows to 36 and 48 slots and stays that big after a reload', () => {
  const s = createState();
  s.money = zl(1000);
  addItem(s.bag, 'iron', 16);
  addItem(s.bag, 'plastic', 10);
  assert.equal(upgradeProblem(s, 'coldSize'), 'requires');
  assert.ok(craft(s, 'coldroom').ok);
  assert.equal(s.chest.length, CHEST_SIZE);
  assert.ok(upgrade(s, 'coldSize').ok);
  assert.equal(s.chest.length, 36);
  assert.ok(upgrade(s, 'coldSize').ok);
  assert.equal(s.chest.length, 48);
  assert.equal(chestSize(s), 48);
  s.chest[47] = { id: cropItem('tomato', 3), n: 5 };
  const { state: t } = deserialize(serialize(s));
  assert.equal(t.chest.length, 48);
  assert.deepEqual(t.chest[47], { id: cropItem('tomato', 3), n: 5 });
});

test('coop upgrades: room for 15 hens, a 60 kg feeder, and an incubator that hatches an egg into a hen', () => {
  const s = createState();
  s.coop.built = true;
  s.money = zl(2000);
  s.coop.hens = COOP.maxHens;
  assert.equal(orderItem(s, 'hen').reason, 'coopfull');
  s.levels.coopHens = 3;
  s.levels.coopFeeder = 3;
  assert.equal(hensMax(s), 15);
  assert.equal(feederCap(s), 60);
  assert.ok(orderItem(s, 'hen').ok);
  addItem(s.bag, cropItem('carrot', 1), 80);
  const slot = s.bag.findIndex((it) => it?.id === cropItem('carrot', 1));
  assert.equal(feedHens(s, slot).n, 60);

  s.levels.incubator = 2;
  const events = [];
  nextDay(s, events); // the hen arrives (10), eggs are laid, one goes into the incubator
  assert.equal(s.coop.hens, 10);
  assert.equal(s.coop.hatch, 1);
  nextDay(s, events);
  nextDay(s, events);
  assert.ok(events.some((e) => e.type === 'hatched'));
  assert.equal(s.coop.hens, 11);
  // full coop: the incubator waits
  s.coop.hens = 15;
  nextDay(s);
  assert.equal(s.coop.hatch, 0);
  const { state: t } = deserialize(serialize(s));
  assert.equal(t.coop.hens, 15, 'saved hens are kept up to the bigger coop');
});

test('the tap on the field fence: the can is filled right by the plots, also during "water all"', () => {
  const s = createState();
  s.upgrades.well = true;
  s.money = zl(200);
  addItem(s.bag, 'iron', 3);
  addItem(s.bag, 'plastic', 2);
  assert.ok(upgrade(s, 'tap').ok);
  s.water = 0;
  const { events } = walkTo(s, ...TAP);
  assert.ok(events.some((e) => e.type === 'refill'));
  assert.equal(s.water, CAN_SIZE);
  assert.ok(OBJECTS.tap.access.some(([x, y]) => x === s.farmer.x && y === s.farmer.y), 'stands by the tap');
  // no tap without the upgrade: the fence is just a fence
  const n = createState();
  assert.equal(command(n, ...TAP).reason, 'blocked');
  // water all: the farmer refills at the tap, not at the well
  for (const i of PLOTS_A.slice(0, 20)) s.plots[i] = { ...makePlot(), crop: 'potato' };
  s.farmer.x = TAP[0];
  s.farmer.y = TAP[1] + 1;
  s.water = 1;
  s.energy = MAX_ENERGY;
  const ev = [];
  startJob(s, 'water', null, ev);
  let refilledAt = null;
  for (let k = 0; k < 4000 && s.farmer.job; k++) {
    const e = [];
    tick(s, 0.1, e);
    if (e.some((x) => x.type === 'refill') && !refilledAt) refilledAt = [s.farmer.x, s.farmer.y];
  }
  assert.ok(refilledAt && OBJECTS.tap.access.some(([x, y]) => x === refilledAt[0] && y === refilledAt[1]), `refilled at ${refilledAt}`);
});

test('the greenhouse: everything ripens a day sooner, but nothing in less than a day', () => {
  const s = createState();
  assert.equal(cropDays(s, 'tomato'), 3);
  s.money = zl(500);
  addItem(s.bag, 'wood', 10);
  addItem(s.bag, 'plastic', 12);
  assert.ok(upgrade(s, 'greenhouse').ok);
  assert.equal(cropDays(s, 'tomato'), 2);
  assert.equal(cropDays(s, 'radish'), 1);
  const i = PLOTS_A[0];
  s.plots[i] = { ...makePlot(), crop: 'tomato', wet: true, wetLeft: 1 };
  assert.equal(daysLeft(s.plots[i], s), 2);
  nextDay(s);
  s.plots[i].wet = true;
  s.plots[i].wetLeft = 1;
  nextDay(s);
  assert.equal(s.plots[i].progress, 1, 'a tomato in two days');
});

test('advertising replaces the SEO board: +10 % customers a level; an old SEO board becomes the jumbo poster', () => {
  const s = createState();
  s.money = zl(1000);
  assert.ok(craft(s, 'ads').ok);
  assert.equal(levelValue(s, 'ads'), 1.1);
  for (let k = 0; k < 4; k++) assert.ok(upgrade(s, 'ads').ok);
  assert.equal(levelValue(s, 'ads'), 1.5);
  const old = JSON.parse(serialize(createState()));
  old.version = 7;
  old.upgrades.seo = true;
  delete old.upgrades.ads;
  delete old.levels.ads;
  const { state: t, restored } = deserialize(JSON.stringify(old));
  assert.ok(restored);
  assert.ok(t.upgrades.ads);
  assert.equal(t.levels.ads, 5);
  assert.equal(recipeOf('seo'), undefined, 'the SEO board is gone from the workbench');
});

test('warnings for the phone: the drone out of seeds or fertilizer, the fertigation tank empty; the unload is reported for the map', () => {
  const run = (seeds, fert) => {
    const s = createState();
    s.upgrades.drone = true;
    s.upgrades.replant = true;
    s.levels.replant = 3;
    s.seeds.radish = seeds;
    if (fert) addItem(s.chest, 'fertilizer:2', 5);
    s.plots[PLOTS_A[0]] = ripePlot('radish', { wetDays: 1 }); // ★★: what the drone's first camera picks
    const events = [];
    for (let k = 0; k < 600 && !events.some((e) => e.type === 'unloaded'); k++) tick(s, 0.1, events);
    return events;
  };
  const noSeeds = run(0, false);
  assert.ok(noSeeds.some((e) => e.type === 'droneshort' && e.what === 'seeds' && e.crop === 'radish'));
  const unload = noSeeds.find((e) => e.type === 'unloaded');
  assert.equal(unload.plots, 1);
  assert.equal(unload.kg, CROPS.find((c) => c.id === 'radish').yield);
  const noFert = run(3, false);
  assert.ok(noFert.some((e) => e.type === 'droneshort' && e.what === 'fert'));
  assert.ok(!noFert.some((e) => e.what === 'seeds'));
  assert.ok(!run(3, true).some((e) => e.type === 'droneshort'), 'nothing missing, nothing to say');

  const s = createState();
  Object.assign(s.upgrades, { well: true, pump: true });
  s.levels.nozzles = 4;
  const [x, y] = xy(PLOTS_A[0]);
  s.sprinklers.push({ x: x + 1, y: y + 1 });
  s.plots[PLOTS_A[0]] = { ...makePlot(), crop: 'potato' };
  assert.ok(nextDay(s).some((e) => e.type === 'tankempty'));
  s.tank[2] = 10;
  assert.ok(!nextDay(s).some((e) => e.type === 'tankempty'), 'fed from the tank instead');
});

// ---------------------------------------------------------------- selling online

// work at the laptop until the farmer is done (he walks home first)
const workDone = (s, events = []) => {
  for (let k = 0; k < 6000 && s.gigs.active; k++) tick(s, 0.1, events);
  return events;
};
const withShop = () => {
  const s = createState();
  assert.ok(buildOnline(s, 'webshop').ok);
  workDone(s);
  return s;
};

test('web shop: built on the laptop at home like an unpaid gig; the other channels need it first', () => {
  const s = createState();
  assert.equal(onlineProblem(s, 'seo'), 'nowebshop');
  const money = s.money;
  const events = [];
  assert.ok(buildOnline(s, 'webshop', events).ok);
  assert.equal(onlineProblem(s, 'google'), 'nowebshop');
  workDone(s, events);
  assert.ok(events.some((e) => e.type === 'onlinebuilt' && e.channel === 'webshop'));
  assert.ok(s.online.channels.webshop);
  assert.equal(s.money, money, 'own work: nothing paid');
  assert.equal(s.energy, MAX_ENERGY - ONLINE.channels[0].hours * GIG_ENERGY_PER_HOUR);
  assert.equal(s.gigs.done, 0, 'not counted as a gig for someone else');
  assert.equal(onlineProblem(s, 'webshop'), 'owned');
  assert.equal(onlineProblem(s, 'google'), null);
});

test('web shop: orders come in the morning, more with every channel, and pay 30 % more than the stand', () => {
  const count = (channels) => {
    const s = createState(4242);
    s.totalEarned = zl(1000);
    for (const c of channels) s.online.channels[c] = true;
    let n = 0;
    for (let d = 0; d < 40; d++) {
      n += nextDay(s).filter((e) => e.type === 'onlineorder').length;
      s.online.orders = []; // keep room for new ones
    }
    return n;
  };
  assert.equal(count([]), 0, 'no web shop, no orders');
  const one = count(['webshop']);
  const all = count(['webshop', 'google', 'seo', 'social']);
  assert.ok(one > 10 && one < 40, `web shop alone ${one}`);
  assert.ok(all > one * 2, `all channels ${all}`);

  const s = withShop();
  for (let d = 0; d < 30 && !s.online.orders.length; d++) nextDay(s);
  const o = s.online.orders[0];
  assert.ok(o);
  assert.equal(o.pay, Math.round(salePrice(o.crop, o.tier) * o.kg * (1 + ONLINE.markup)));
  assert.ok(o.due > s.day - 1 && !o.packed);
});

test('web shop: pack from the bag into the parcel box, take it to the post office, get paid; late orders are lost', () => {
  const s = withShop();
  s.energy = MAX_ENERGY;
  const o = { id: 900, who: 'test', crop: 'carrot', kg: 4, tier: 3, due: s.day + 2, packed: false, items: [] };
  o.pay = orderPay(o);
  s.online.orders.push(o);
  assert.equal(postTripProblem(s), 'noparcels');
  addItem(s.bag, cropItem('carrot', 2), 10);
  assert.equal(packOrder(s, 900).reason, 'requestshort', '★★ is not good enough');
  addItem(s.bag, cropItem('carrot', 3), 3);
  addItem(s.bag, cropItem('carrot', 4), 5);
  assert.ok(packOrder(s, 900).ok);
  assert.equal(countWhere(s.bag, (id) => id === cropItem('carrot', 3)), 0, 'the worst good-enough produce goes first');
  assert.equal(countWhere(s.bag, (id) => id === cropItem('carrot', 4)), 4);
  assert.equal(parcelsReady(s), 1);
  assert.equal(o.pay, Math.round((3 * salePrice('carrot', 3) + salePrice('carrot', 4)) * (1 + ONLINE.markup)), 'the parcel is paid for what is in it');
  assert.equal(packOrder(s, 900).reason, 'packed');

  s.clock = 16 * 60 + 10;
  assert.equal(postTripProblem(s), 'posttoolate', 'the post office closes at 17 h');
  s.clock = 9 * 60;
  const money = s.money;
  const events = [];
  assert.ok(goToPost(s, events).ok);
  for (let k = 0; k < 8000 && (s.farmer.task || s.farmer.path.length || s.market.trips.farmer); k++) tick(s, 0.1, events);
  const posted = events.find((e) => e.type === 'posted');
  assert.ok(posted && posted.n === 1);
  assert.equal(s.money - money, o.pay);
  assert.equal(s.online.orders.length, 0);
  assert.ok(events.some((e) => e.type === 'tripdone'), 'and back home');

  // a packed parcel that missed its day goes back to the chest; an unpacked order is just lost
  const late = { id: 901, who: 'x', crop: 'carrot', kg: 2, tier: 2, due: s.day, packed: false, items: [] };
  late.pay = orderPay(late);
  s.online.orders.push(late);
  assert.ok(packOrder(s, 901).ok);
  s.online.orders.push({ ...late, id: 902, packed: false, items: [] });
  const missed = nextDay(s).filter((e) => e.type === 'onlinemissed');
  assert.equal(missed.length, 2);
  assert.ok(countWhere(s.chest, (id) => id.startsWith('crop:carrot:')) >= 2);
});

test('web shop: a market trip takes the parcels along; everything survives a reload', () => {
  const s = withShop();
  s.market.stall = true;
  const o = { id: 950, who: 'test', crop: 'radish', kg: 1, tier: 2, due: s.day + 3, packed: false, items: [] };
  o.pay = orderPay(o);
  s.online.orders.push(o, { ...o, id: 951 });
  addItem(s.bag, cropItem('radish', 5), 1);
  assert.ok(packOrder(s, 950).ok);
  addItem(s.bag, cropItem('radish', 2), 5); // something to sell at the market
  assert.deepEqual(o.items, [{ id: cropItem('radish', 5), n: 1 }]);
  const { state: t } = deserialize(serialize(s));
  assert.equal(t.online.orders[0].pay, o.pay, 'a parcel of better produce keeps its higher pay');
  assert.ok(t.online.orders[0].pay > t.online.orders[1].pay);
  assert.ok(t.online.channels.webshop);
  assert.equal(t.online.orders.length, 2);
  assert.ok(t.online.orders[0].packed);
  assert.deepEqual(t.online.orders[0].items, [{ id: cropItem('radish', 5), n: 1 }]);
  // to the market with the bag: the parcel is posted on arrival
  t.clock = 6 * 60 + 30;
  const events = [];
  assert.ok(goToMarket(t, events).ok);
  for (let k = 0; k < 4000 && !events.some((e) => e.type === 'posted'); k++) tick(t, 0.1, events);
  assert.equal(events.find((e) => e.type === 'posted')?.n, 1);
  assert.equal(t.online.orders.length, 1, 'the unpacked order waits');
  // building a channel survives a reload half done
  const u = withShop();
  assert.ok(buildOnline(u, 'seo').ok);
  const { state: v } = deserialize(serialize(u));
  assert.equal(v.gigs.active.online, 'seo');
  assert.equal(v.gigs.active.pay, 0);
});
