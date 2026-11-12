// Game balance and static content. Everything tunable lives here.
// Money: zlatnici (zl) and srebrenjaci (sr), 1 zl = 100 sr. Prices are written in zlatnici
// here and kept as whole srebrenjaci in the game state (see zl()). The ratios follow real
// Croatian market prices, so 1 zl is roughly what 1 € buys at the market.

export const SAVE_VERSION = 4;
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
export const WELL_BUILD = { price: 150, wood: 6, stone: 12, energy: 30, seconds: 6 };

// Irrigation: every sprinkler waters the plots within this radius (in tiles), each morning.
// Levels 1–10 cover 4, 8, 12, 20, 24, 28, 36, 44, 48 and 56 plots.
export const IRRIGATION_RADII = [1, 1.42, 2, 2.24, 2.83, 3, 3.17, 3.61, 4, 4.13];
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
];
export const FORAGE_START = 8;
export const FORAGE_DAILY = [3, 5];
export const FORAGE_MAX = 14;

// The old chicken coop by the house: repaired at the workbench, then hens lay one egg
// each morning if there is food (1 kg of produce feeds one hen for a day).
export const COOP = { hens: 3, moreHens: 3, maxHens: 9, eggCap: 30, feedCap: 60 };

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
    id: 'coop', name: 'Popravak kokošinjca', once: 'coop', price: 25, mats: { wood: 10, stone: 4 },
    desc: 'Popravi stari kokošinjac kod kuće: 3 kokoši nesu jaja svako jutro ako imaju hrane.',
  },
  {
    id: 'hens', name: 'Još kokoši', price: 15, requires: 'coop',
    desc: `+${COOP.moreHens} kokoši (najviše ${COOP.maxHens}).`,
  },
  {
    id: 'wellPlan', name: 'Plan bunara', once: 'wellPlan', price: 0,
    desc: 'Skiciraj bunar. Zida se na gradilištu kod kuće: farmer ode tamo i zida.',
  },
  {
    id: 'sprinkler', name: 'Prskalica · water.sh', gives: 'sprinkler', price: 35, requires: 'well',
    desc: 'Navodnjavanje iz bunara: postavi je na praznu parcelu, svako jutro u 6 h zalije parcele oko sebe.',
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
