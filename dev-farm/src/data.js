// Game balance and static content. Everything tunable lives here.
// Money: zlatnici (zl) and srebrenjaci (sr), 1 zl = 100 sr. Prices are written in zlatnici
// here and kept as whole srebrenjaci in the game state (see zl()). The ratios follow real
// Croatian market prices, so 1 zl is roughly what 1 € buys at the market.

export const SAVE_VERSION = 5;
export const START_MONEY = 30; // zl
export const MAX_ENERGY = 100;

export const zl = (zlatnici) => Math.round(zlatnici * 100); // zl → sr

export const BAG_SIZE = 8;
export const CHEST_SIZE = 24;
export const STAND_SIZE = 6;
export const STACK_MAX = 99; // kg per slot

// Clock: minutes since midnight of the current day. A day runs 06:00 → 02:00 (26 * 60).
export const GAME_MIN_PER_SEC = 2; // 1 real second = 2 game minutes → a day lasts 10 real minutes
export const DAY_START = 6 * 60;
export const NIGHT_START = 22 * 60;
export const PASS_OUT = 26 * 60;
export const SLEEP_FROM = 18 * 60; // no napping through the day: crops grow per day
export const SHOP_OPEN = 8 * 60;
export const SHOP_CLOSE = 19 * 60;

export const WALK_SPEED = 5; // tiles per second
export const NPC_SPEED = 3;
export const DRONE_SPEED = 6;
export const DRONE_COOLDOWN = 3;

// Crops grow once per day, every morning: a full day if the plot was watered the day
// before, half a day if not. Soil dries overnight; sprinklers water at 06:00.
export const DRY_RATE = 0.5;
export const AUTO_WATER_CREDIT = 0.75; // sprinkler water counts less towards quality
export const CAN_SIZES = [12, 30]; // watering can capacity, normal / big

// A ripe crop is best on the day it ripens; every extra day costs quality, then it rots.
export const RIPE_PENALTY = [0, 10, 25, 40]; // quality points lost after 0, 1, 2, 3 days ripe
export const ROT_DAY = 4; // rotten on the 4th morning after ripening

export const ENERGY_COST = { plant: 2, water: 1, fertilize: 1, harvest: 1, clear: 1 };
export const COFFEE = { price: 1.5, energy: 35 };
export const EAT_ENERGY = [0, 6, 10, 15, 20]; // per kg eaten, by quality tier

// Quality tiers: 1 loše, 2 dobro, 3 odlično, 4 zlatno. The ★★ price is the market price;
// customers only take ★ produce (at half price) when there is nothing better on the stand.
export const TIER_NAMES = ['', 'loše', 'dobro', 'odlično', 'zlatno'];
export const TIER_PRICE = [0, 0.5, 1, 1.3, 1.6];
export const MACHINE_MAX_TIER = 3;

// Seeds are counted and never free: found, taken out of produce, or delivered.
export const SEEDS_FROM_FRUIT = [2, 10]; // 1 kg of produce gives 2–10 seeds, at random
export const SEED_PACK = 5; // a delivery pack holds 5 seeds (or seedlings)
export const HOUSE_SEEDS = { crop: 'radish', n: 6 }; // found in a drawer on the first visit
export const START_FINDS = [
  { x: 24, y: 7, crop: 'radish', n: 3, what: 'stara rotkvica' },
  { x: 5, y: 14, crop: 'carrot', n: 4, what: 'divlja mrkva' },
  { x: 39, y: 15, crop: 'potato', n: 2, what: 'divlji krumpir' },
];
export const DAILY_FIND_CHANCE = 0.6;
export const FERTILIZER_PRICE = 6; // zl per bag, ordered on the phone, delivered to the chest

// The well: a plan is sketched at the workbench, then the farmer builds it on site.
// Buildings: a plan is sketched at the workbench, then the farmer builds on site.
// Every future building follows the same pattern: add it here and give it a plan recipe.
export const BUILDINGS = {
  well: { name: 'Bunar', plan: 'wellPlan', price: 150, wood: 6, stone: 12, energy: 30, seconds: 6 },
  coop: { name: 'Kokošinjac', plan: 'coopPlan', price: 25, wood: 10, stone: 4, energy: 20, seconds: 6 },
};
export const WELL_BUILD = BUILDINGS.well;

// Irrigation is a system built from parts: a water pump on the well, hose (10 m per
// sprinkler) and sprinklers. Sprinklers stand on the crossing of four plots, so they take
// no plot away; each morning they water every plot whose centre lies within the radius
// (squared, in tiles) of that crossing. Levels 1–10 reach 4, 12, 16, 24, 32, 44, 52, 60, 68 and 80 plots.
export const IRRIGATION_R2 = [0.5, 2.5, 4.5, 6.5, 8.5, 12.5, 14.5, 18.5, 20.5, 24.5];
export const HOSE_PER_SPRINKLER = 10; // m
export const PUMP_INSTALL_SECONDS = 4;

// Delivered to the chest the next morning, ordered on the phone.
export const SHOP_ITEMS = [
  { id: 'fertilizer', name: 'Gnojivo', n: 1, unit: 'vreća', price: 6 },
  { id: 'pump', name: 'Vodena pumpa', n: 1, unit: 'kom', price: 70 },
  { id: 'hose', name: 'Crijevo', n: 10, unit: 'm', price: 9 },
  { id: 'sprinkler', name: 'Prskalica', n: 1, unit: 'kom', price: 8 },
  { id: 'hen', name: 'Kokoš nesilica', n: 1, unit: 'kom', price: 12 }, // goes straight into the coop
];
export const IRRIGATION_COSTS = [0, 25, 40, 60, 90, 130, 180, 250, 340, 450]; // zl to reach level i + 1

export const CUSTOMER_INTERVAL = [18, 36]; // seconds between customers
export const CUSTOMER_KG = [1, 4]; // a customer buys 1–4 kg
export const SEO_BONUS = 1.6;

// Prices follow Croatian market prices per kg (in €, autumn 2026), written as zlatnici.
// days  = days to ripen if watered every day
// yield = kg one plot gives
// price = zl per kg at ★★
// pack  = zl for a delivery pack of 5 seeds / seedlings
// unlock = zl earned in total before the crop shows up in the delivery catalogue
export const CROPS = [
  { id: 'radish', name: 'Rotkvica', days: 3, yield: 1, price: 3.5, pack: 1.5, unlock: 0 },
  { id: 'carrot', name: 'Mrkva', days: 3, yield: 4, price: 0.9, pack: 1.5, unlock: 0 },
  { id: 'potato', name: 'Krumpir', days: 4, yield: 5, price: 1.0, pack: 2.5, unlock: 15 },
  { id: 'cabbage', name: 'Kupus', days: 5, yield: 5, price: 1.25, pack: 2.0, unlock: 30 },
  { id: 'chard', name: 'Blitva', days: 4, yield: 2, price: 3.9, pack: 1.8, unlock: 50 },
  { id: 'tomato', name: 'Rajčica', days: 6, yield: 4, price: 3.0, pack: 2.5, unlock: 90 },
  { id: 'sweetpotato', name: 'Batat', days: 6, yield: 4, price: 3.3, pack: 4.0, unlock: 150 },
  { id: 'pumpkin', name: 'Bundeva', days: 7, yield: 9, price: 1.6, pack: 2.5, unlock: 220 },
];

// Other things sold at the stand: what grows in the woods, and eggs (price per unit at ★★).
export const GOODS = [
  { id: 'mushroom', name: 'Gljive', price: 6, unit: 'kg' },
  { id: 'blackberry', name: 'Kupine', price: 5, unit: 'kg' },
  { id: 'egg', name: 'Jaja', price: 0.4, unit: 'kom' },
];

// The woods: a few of these appear along the forest edge every morning.
export const FORAGE = [
  { id: 'mushroom', name: 'gljive', item: 'crop:mushroom:2', n: [1, 1], weight: 2 },
  { id: 'blackberry', name: 'kupine', item: 'crop:blackberry:2', n: [1, 2], weight: 2 },
  { id: 'branches', name: 'grane', item: 'wood', n: [2, 3], weight: 3 },
  { id: 'rocks', name: 'kamenje', item: 'stone', n: [2, 3], weight: 3 },
  // somebody's old garden things: a piece of hose or, rarely, a whole sprinkler
  { id: 'scrap', name: 'odbačeni dijelovi', loot: [{ item: 'hose', n: [3, 6], weight: 7 }, { item: 'sprinkler', n: [1, 1], weight: 3 }], weight: 1 },
];
export const FORAGE_START = 8;
export const FORAGE_DAILY = [3, 5];
export const FORAGE_MAX = 14;

// The old chicken coop by the house: repaired at the workbench, then hens lay one egg
// each morning if there is food (1 kg of produce feeds one hen for a day).
export const COOP = { maxHens: 9, eggCap: 30, feedCap: 60 }; // hens are bought one by one

// Side gigs on the phone: the farmer works from home on the laptop (game hours).
export const GIGS = [
  { title: 'Susjedi Mari ne radi WiFi', pay: [4, 7], hours: 1 },
  { title: 'Instaliraj printer u općini', pay: [5, 8], hours: 1 },
  { title: 'Backup fotografija s krstitki', pay: [5, 9], hours: 1 },
  { title: 'Excel tablica za lovačko društvo', pay: [8, 12], hours: 2 },
  { title: 'Bug u aplikaciji za apartmane', pay: [10, 16], hours: 3 },
  { title: 'Migracija servera za vinariju', pay: [14, 22], hours: 3 },
  { title: 'Web stranica za OPG Horvat', pay: [15, 25], hours: 4 },
  { title: 'Webshop za domaći med', pay: [18, 28], hours: 4 },
];
export const GIG_OFFERS = [1, 3]; // new offers each morning
export const GIG_ENERGY_PER_HOUR = 6;

export const RECIPES = [
  {
    id: 'compost', name: 'Gnojivo (kompost)', gives: 'fertilizer', price: 0, bad: 2,
    desc: '2 kg loših (★) plodova → 1 gnojivo.',
  },
  {
    id: 'coopPlan', name: 'Plan popravka kokošinjca', once: 'coopPlan', price: 0,
    desc: 'Skiciraj popravak starog kokošinjca. Farmer ga zatim popravlja na licu mjesta; kokoši se naručuju na mobitelu.',
  },
  {
    id: 'wellPlan', name: 'Plan bunara', once: 'wellPlan', price: 0,
    desc: 'Skiciraj bunar. Zida se na gradilištu kod kuće: farmer ode tamo i zida.',
  },
  {
    id: 'bigCan', name: 'Velika kanta', once: 'bigCan', price: 15,
    desc: `Kanta drži ${CAN_SIZES[1]} umjesto ${CAN_SIZES[0]} zalijevanja.`,
  },
  {
    id: 'drone', name: 'harvest-drone', once: 'drone', price: 600,
    desc: 'Bere zrele usjeve i nosi ih u škrinju. Najviše ★★★.',
  },
  {
    id: 'replant', name: 'replant.py', once: 'replant', requires: 'drone', price: 150,
    desc: 'Dron nakon berbe posadi isto sjeme, ako ga imaš.',
  },
  {
    id: 'seo', name: 'SEO ploča za štand', once: 'seo', price: 80,
    desc: 'Kupci dolaze 60 % češće.',
  },
  {
    id: 'field2', name: 'git clone polje', once: 'field2', price: 400,
    desc: 'Raščisti zaraslo polje južno od staze: još 48 parcela.',
  },
];
