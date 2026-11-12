// Game balance and static content. Everything tunable lives here.
// Times are in real seconds unless the name says minutes.

export const SAVE_VERSION = 3;
export const START_COINS = 40;
export const MAX_ENERGY = 100;

export const BAG_SIZE = 8;
export const CHEST_SIZE = 24;
export const STAND_SIZE = 6;
export const STACK_MAX = 99;

// Clock: minutes since midnight of the current day. A day runs 06:00 → 02:00 (26 * 60).
export const GAME_MIN_PER_SEC = 2; // 1 real second = 2 game minutes → a day lasts 10 real minutes
export const DAY_START = 6 * 60;
export const NIGHT_START = 22 * 60;
export const PASS_OUT = 26 * 60;
export const SHOP_OPEN = 8 * 60;
export const SHOP_CLOSE = 19 * 60;

export const WALK_SPEED = 5; // tiles per second
export const NPC_SPEED = 3;
export const DRONE_SPEED = 6;
export const DRONE_COOLDOWN = 3;

export const WATER_DURATION = 150; // a watered plot stays wet this long
export const DRY_RATE = 0.5; // dry plots grow at half speed
export const AUTO_WATER_CREDIT = 0.75; // sprinkler water counts less towards quality
export const CAN_SIZES = [12, 30]; // watering can capacity, normal / big
export const SPRINKLER_INTERVAL = 30;

export const ENERGY_COST = { plant: 2, water: 1, fertilize: 1, harvest: 1, clear: 1 };
export const COFFEE = { price: 15, energy: 35 };
export const EAT_ENERGY = [0, 6, 10, 15, 20]; // by quality tier

// Quality tiers: 1 loše, 2 dobro, 3 odlično, 4 zlatno. Price follows quality;
// customers only take ★ produce when there is nothing better on the stand.
export const TIER_NAMES = ['', 'loše', 'dobro', 'odlično', 'zlatno'];
export const TIER_PRICE = [0, 0.5, 1, 1.5, 2.2];
export const MACHINE_MAX_TIER = 3;

// Seeds are counted and never free: found, taken out of produce, or delivered.
export const SEEDS_FROM_FRUIT = [2, 10]; // one fruit gives 2–10 seeds, at random
export const SEED_PACK = 5; // a delivery pack holds 5 seeds and costs 5 × seed price
export const HOUSE_SEEDS = { crop: 'radish', n: 6 }; // found in a drawer on the first visit
export const START_FINDS = [
  { x: 24, y: 7, crop: 'radish', n: 3, what: 'stara rotkvica' },
  { x: 5, y: 14, crop: 'carrot', n: 4, what: 'divlja mrkva' },
  { x: 39, y: 15, crop: 'potato', n: 2, what: 'divlji krumpir' },
];
export const DAILY_FIND_CHANCE = 0.6;

export const CUSTOMER_INTERVAL = [18, 36]; // seconds between customers
export const SEO_BONUS = 1.6;

// seed = price of one seed in a delivery; grow = seconds to ripen if kept watered;
// price = stand price at ★★; unlock = total earnings before the crop appears in the delivery catalogue
export const CROPS = [
  { id: 'radish', name: 'Rotkvica', seed: 3, grow: 45, price: 8, unlock: 0 },
  { id: 'carrot', name: 'Mrkva', seed: 6, grow: 90, price: 18, unlock: 80 },
  { id: 'potato', name: 'Krumpir', seed: 12, grow: 150, price: 35, unlock: 300 },
  { id: 'tomato', name: 'Rajčica', seed: 25, grow: 240, price: 70, unlock: 900 },
  { id: 'pumpkin', name: 'Bundeva', seed: 60, grow: 420, price: 170, unlock: 2500 },
];

// A ripe crop keeps full quality for ripeWindow seconds, then loses it, then rots.
export const ripeWindow = (crop) => Math.max(45, crop.grow * 0.5);
export const ROT_AFTER = 4; // × ripeWindow

export const RECIPES = [
  {
    id: 'compost', name: 'Gnojivo (kompost)', gives: 'fertilizer', coins: 0, bad: 2,
    desc: '2 loša (★) proizvoda → 1 gnojivo.',
  },
  {
    id: 'fertilizer', name: 'Gnojivo (kupovno)', gives: 'fertilizer', coins: 12,
    desc: 'Vreća gnojiva. Pognojena biljka je kvalitetnija.',
  },
  {
    id: 'well', name: 'Bunar', once: 'well', coins: 120,
    desc: 'Sazidaj bunar kod kuće: voda blizu polja i izvor za navodnjavanje.',
  },
  {
    id: 'sprinkler', name: 'Prskalica · water.sh', gives: 'sprinkler', coins: 120, requires: 'well',
    desc: 'Navodnjavanje iz bunara: postavi je na praznu parcelu, svakih 30 s zalije 8 parcela oko sebe.',
  },
  {
    id: 'bigCan', name: 'Velika kanta', once: 'bigCan', coins: 150,
    desc: `Kanta drži ${CAN_SIZES[1]} umjesto ${CAN_SIZES[0]} zalijevanja.`,
  },
  {
    id: 'drone', name: 'harvest-drone', once: 'drone', coins: 400,
    desc: 'Bere zrele usjeve i nosi ih u škrinju. Najviše ★★★.',
  },
  {
    id: 'replant', name: 'replant.py', once: 'replant', requires: 'drone', coins: 300,
    desc: 'Dron nakon berbe posadi isto sjeme, ako ga imaš.',
  },
  {
    id: 'seo', name: 'SEO ploča za štand', once: 'seo', coins: 250,
    desc: 'Kupci dolaze 60 % češće.',
  },
  {
    id: 'field2', name: 'git clone polje', once: 'field2', coins: 600,
    desc: 'Raščisti zaraslo polje južno od staze: još 48 parcela.',
  },
];
