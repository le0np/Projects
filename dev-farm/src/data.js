// Game balance and static content. Everything tunable lives here.
// Money: zlatnici (zl) and srebrenjaci (sr), 1 zl = 100 sr. Prices are written in zlatnici
// here and kept as whole srebrenjaci in the game state (see zl()). The ratios follow real
// Croatian market prices, so 1 zl is roughly what 1 € buys at the market.

export const SAVE_VERSION = 9;
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

export const NPC_SPEED = 3; // tiles per second
export const WALK_SPEED = NPC_SPEED; // owner: the farmer walks like everyone else on the map
export const DRONE_COOLDOWN = [3, 2, 1]; // seconds the drone rests after each plot, by engine level

// Crops grow once per day, every morning: a full day if the plot was watered the day
// before, half a day if not. Soil dries overnight; sprinklers water at 06:00.
export const DRY_RATE = 0.5;
export const CAN_SIZE = 12; // the old watering can; the big can and its upgrades are in UPGRADES.can

// A ripe crop is best on the day it ripens; every extra day costs quality, then it rots.
export const RIPE_PENALTY = [0, 10, 25, 40]; // quality points lost after 0, 1, 2, 3 days ripe
export const ROT_DAY = 4; // rotten on the 4th morning after ripening

export const ENERGY_COST = { plant: 2, water: 1, fertilize: 1, harvest: 1, clear: 1 };
// Work on a plot takes time (real seconds; 1 s = 2 game minutes). Energy is spent when it is done.
export const WORK_SECONDS = { plant: 1.5, harvest: 1.5, clear: 1.5, refill: 2, water: 1, fertilize: 1, mulch: 1 };
export const COFFEE = { price: 1.5, energy: 35 };
export const EAT_ENERGY = [0, 6, 10, 15, 20, 25]; // per kg eaten, by quality tier

// Quality tiers, in the market's own words: 1 škart, 2 II. klasa, 3 I. klasa, 4 ekstra,
// 5 za sajam (the kind that wins at the village fair). The ★★ price is the market price;
// customers only take škart (at half price) when there is nothing better on the stand.
export const TIER_NAMES = ['', 'škart', 'II. klasa', 'I. klasa', 'ekstra', 'za sajam'];
export const TIER_PRICE = [0, 0.5, 1, 1.3, 1.6, 2];
export const MAX_TIER = 5;
// Quality points: 35 base + up to 45 for watering every day + the fertilizer's bonus
// (by its quality ★–★★★) − waiting ripe. Tier thresholds: ★★ 40, ★★★ 65, ★★★★ 85, ★★★★★ 98,
// so ★★★★★ needs ★★★ fertilizer (a perfect plot with ★★ fertilizer reaches 94).
export const FERT_BONUS = [0, 8, 14, 22];
export const TIER_AT = [0, 0, 40, 65, 85, 98];


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
// Fertilizer: one bag is 10 doses, one dose fertilizes one plot. It has a quality (★–★★★):
// compost made at the workbench from 5 kg of produce takes the quality of that produce
// (★★★★ and ★★★★★ produce make ★★★ compost); bought fertilizer is ★★.
export const FERTILIZER_PRICE = 6; // zl per bag, ordered on the phone, delivered to the chest
export const FERT_DOSES = 10; // plots per bag
export const COMPOST_KG = 5; // kg of produce for one bag of compost
export const BOUGHT_FERT_TIER = 2;
export const fertId = (tier) => `fertilizer:${tier}`;

// The well: a plan is sketched at the workbench, then the farmer builds it on site.
// Buildings: a plan is sketched at the workbench, then the farmer builds on site.
// Every future building follows the same pattern: add it here and give it a plan recipe.
export const BUILDINGS = {
  well: { name: 'Bunar', plan: 'wellPlan', price: 150, wood: 6, stone: 12, energy: 30, seconds: 6 },
  coop: { name: 'Kokošinjac', plan: 'coopPlan', price: 25, wood: 10, stone: 4, energy: 20, seconds: 6 },
};
export const WELL_BUILD = BUILDINGS.well;

// Irrigation is a system built from parts: a water pump on the well, hose (10 m per
// sprinkler) and sprinklers. A sprinkler stands on the crossing of four plots and waters
// those four every morning. How many sprinklers the pump drives and how well they water
// (nozzles) are upgrades: UPGRADES.pump and UPGRADES.nozzles.
export const HOSE_PER_SPRINKLER = 10; // m
export const TANK_SIZE = 60; // doses of fertilizer in the fertigation tank by the pump
export const PUMP_INSTALL_SECONDS = 4;

// Materials for the workbench, carried in the bag. Wood and stone come from the woods and go
// into buildings; iron and plastic go into machines (drone, pump, nozzles…) and are ordered
// on the phone or found among old parts in the woods. gen = after a number ("4 željeza").
export const MATERIALS = {
  wood: { name: 'Drva', gen: 'drva' },
  stone: { name: 'Kamenje', gen: 'kamena' },
  iron: { name: 'Željezo', gen: 'željeza' },
  plastic: { name: 'Plastika', gen: 'plastike' },
};
// Where each material is found, shown on the workbench next to what is missing.
export const MATERIAL_SOURCE = {
  wood: 'grane uz rub šume',
  stone: 'kamenje uz rub šume',
  iron: 'Dostava ili odbačeni dijelovi u šumi',
  plastic: 'Dostava ili odbačeni dijelovi u šumi',
};

// Delivered to the chest the next morning, ordered on the phone.
export const SHOP_ITEMS = [
  { id: 'fertilizer', name: 'Gnojivo ★★ (vreća)', n: 10, unit: 'doza', price: 6, give: 'fertilizer:2' },
  { id: 'pump', name: 'Vodena pumpa', n: 1, unit: 'kom', price: 70 },
  { id: 'hose', name: 'Crijevo', n: 10, unit: 'm', price: 9 },
  { id: 'sprinkler', name: 'Prskalica', n: 1, unit: 'kom', price: 8 },
  { id: 'hen', name: 'Kokoš nesilica', n: 1, unit: 'kom', price: 12 }, // goes straight into the coop
  { id: 'mulch', name: 'Malč (vreća)', n: 10, unit: 'doza', price: 3 },
  { id: 'iron', name: 'Željezo (šipke)', n: 5, unit: 'kom', price: 8 },
  { id: 'plastic', name: 'Plastika (ploče)', n: 5, unit: 'kom', price: 6 },
  { id: 'jar', name: 'Tegle za med', n: 10, unit: 'kom', price: 3 }, // honey needs a jar per kg
];
// decorations are in the catalogue too (Dostava → Uređenje); DECOR is declared further down
export const decorShopItems = (decor) => Object.entries(decor).map(([k, d]) => ({ id: `deco:${k}`, name: d.name, n: d.n, unit: 'kom', price: d.price, decor: true }));

// Selling back on the phone (otkup): half of what it costs new.
export const BUYBACK = 0.5;
export const IRRIGATION_COSTS = [0, 25, 40, 60, 90, 130, 180, 250, 340, 450]; // zl to reach level i + 1

// The town market, up the road to the north (off the map). The farmer rents a stall and takes
// what is in the bag; later a van and a hired hand take the van's load there every morning.
export const MARKET = {
  open: 7 * 60, // game minutes: the market runs in the morning
  close: 13 * 60,
  walk: 60, // game minutes each way on foot (the farmer with the bag)
  drive: 20, // game minutes each way by van: much quicker than walking
  stall: 25, // zl, the stall is rented once for the season
  interval: [3, 6], // real seconds between customers: far busier than the stand by the road
  kg: [2, 6], // a market customer buys 2–6 kg
  van: 800, // zl, a used van
  wage: 30, // zl, the hired hand's pay for a day at the market (only on days he drives)
  // zl on top of the wage when he takes the packed parcels to the post office in town first (owner, 16. 11.:
  // he gets there before the market opens anyway); with no produce to sell he drives just to the post for it
  postWage: 10,
  vanSize: 12, // slots in the van
  worker: 'Joža',
  markup: 0.1, // the market pays 10 % more than the stand: on a full day about the hired hand's wage
};

// Weather: some days it rains and the rain waters everything planted (counts like watering by
// hand). Tomorrow's weather is known a day ahead (the forecast on the phone).
export const RAIN_CHANCE = 0.22;
export const RAIN_CUSTOMERS = 0.6; // fewer people come by the stand in the rain

// Mulch (wood chips) on a plot keeps the soil moist for two days instead of one
// (bark from the shredder upgrade: three days, see UPGRADES.mulchDays).
export const MULCH_DAYS = 2;

// Produce in the chest slowly loses quality (one class, on about two mornings in five);
// the cold room from the workbench keeps it as it is.
export const CHEST_DECAY = 0.4;

// Customers sometimes order ahead at the stand ("5 kg mrkve ★★★ do petka") and pay a little extra.
// Price ladder (owner's rule): the stand is the cheapest, it costs nothing; every channel with extra
// costs pays more: stand order +5 %, market +10 % (about Joža's wage on a full van), online +30 % (packing, post).
// Delivery (Joža taking parcels to the post) costs only his wage; the customer pays just the online price.
export const REQUESTS = {
  max: 3, chance: 0.5, kg: [3, 8], days: [2, 4], minTier: [2, 3, 3, 4], bonus: 0.05,
  who: ['gospođa Ana', 'susjed Ivo', 'kuharica iz škole', 'restoran Kod Mate', 'baka Milka', 'pekar Stjepan', 'teta iz vrtića'],
};
export const DAY_NAMES = ['ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota', 'nedjelja'];
export const DAY_NAMES_GEN = ['ponedjeljka', 'utorka', 'srijede', 'četvrtka', 'petka', 'subote', 'nedjelje']; // "do petka"

// Bees: a hive from the workbench is put on the grass; every second morning it fills with
// 1 kg of honey (up to 6 kg), collected with a click into jars (one jar per kg, from the
// phone). Upgrades (UPGRADES.hive*): a bigger hive, honey every day, and bees that pollinate
// the plots near the hive (+4 quality points: a perfect plot with ★★ fertilizer gets ★★★★★).
export const HIVES = { max: 5, every: 2, cap: 6 };
export const POLLEN_BONUS = 4;

// Decorations from the phone (Dostava → Uređenje), put on grass. Fences and benches are in
// the way like anything else; nothing may be put where it would close off the farm.
export const DECOR = {
  path: { name: 'Kamena staza', n: 5, price: 4, block: false },
  fence: { name: 'Ograda', n: 4, price: 6, block: true },
  flowers: { name: 'Cvjetna gredica', n: 1, price: 3, block: false },
  bench: { name: 'Klupa', n: 1, price: 12, block: true },
  gnome: { name: 'Vrtni patuljak', n: 1, price: 8, block: false },
  lamp: { name: 'Lampion', n: 1, price: 10, block: false },
};

SHOP_ITEMS.push(...decorShopItems(DECOR));

// A dog or a cat from the shelter follows the farmer around. A pat once a day gives energy.
export const PETS = { dog: { name: 'Šarko', species: 'pas' }, cat: { name: 'Maca', species: 'mačka' }, adopt: 5, pat: 5 };
export const PET_NAME_MAX = 16; // letters in a pet's name, chosen by the player

export const CUSTOMER_INTERVAL = [18, 36]; // seconds between customers
export const CUSTOMER_KG = [1, 4]; // a customer buys 1–4 kg
// Advertising for the stand (workbench → Reklame i plakati): each level brings 10 % more customers.
export const AD_NAMES = ['plakat', 'letci', 'oglas u novinama', 'reklama na radiju', 'jumbo plakat'];

// Prices follow Croatian market prices per kg (in €, autumn 2026), written as zlatnici.
// gen   = the name after a quantity ("5 kg mrkve")
// days  = days to ripen if watered every day: cheap crops are quick (radish and carrot are
//         ripe the morning after planting, so there is something to sell every day),
//         the valuable ones take longer
// yield = kg one plot gives
// price = zl per kg at ★★
// pack  = zl for a delivery pack of 5 seeds / seedlings. Rule: a pack always costs less than
//         1 kg of the crop at ★★, and one seed is at most a tenth of what its plot yields.
//         With that, a plot earns about 3–4 zl a day (★★, seed paid) whatever is grown.
// unlock = zl earned in total before the crop shows up in the delivery catalogue
export const CROPS = [
  { id: 'radish', name: 'Rotkvica', gen: 'rotkvice', days: 1, yield: 1, price: 3.5, pack: 1.5, unlock: 0 },
  { id: 'carrot', name: 'Mrkva', gen: 'mrkve', days: 1, yield: 4, price: 0.9, pack: 0.6, unlock: 0 },
  { id: 'potato', name: 'Krumpir', gen: 'krumpira', days: 2, yield: 6, price: 1.0, pack: 0.7, unlock: 15 },
  { id: 'cabbage', name: 'Kupus', gen: 'kupusa', days: 2, yield: 5, price: 1.25, pack: 0.8, unlock: 30 },
  { id: 'chard', name: 'Blitva', gen: 'blitve', days: 3, yield: 3, price: 3.9, pack: 1.8, unlock: 50 },
  { id: 'tomato', name: 'Rajčica', gen: 'rajčice', days: 3, yield: 4, price: 3.0, pack: 2.0, unlock: 90 },
  { id: 'sweetpotato', name: 'Batat', gen: 'batata', days: 4, yield: 4, price: 3.3, pack: 2.4, unlock: 150 },
  { id: 'pumpkin', name: 'Bundeva', gen: 'bundeve', days: 4, yield: 9, price: 1.6, pack: 1.0, unlock: 220 },
];

// Other things sold at the stand: what grows in the woods, and eggs (price per unit at ★★).
export const GOODS = [
  { id: 'mushroom', name: 'Gljive', price: 6, unit: 'kg' },
  { id: 'blackberry', name: 'Kupine', price: 5, unit: 'kg' },
  { id: 'egg', name: 'Jaja', gen: 'jaja', price: 0.4, unit: 'kom' },
  // fish from the pond (prices per kg at Croatian fish markets)
  { id: 'carp', name: 'Šaran', price: 4.5, unit: 'kg' },
  { id: 'tench', name: 'Linjak', price: 7, unit: 'kg' },
  { id: 'pike', name: 'Štuka', price: 9, unit: 'kg' },
  { id: 'honey', name: 'Med', gen: 'meda', price: 12, unit: 'kg' },
];

// Fishing is idle: the farmer sits at the pond with the rod from the workbench and fishes all day,
// until called away or until it gets dark. Every morning the pond has its own luck for the day
// (0–5 fish to be caught); some days bring a few fish, some none. Catches come at random times.
export const FISH = [
  { id: 'carp', kg: [1, 3], weight: 6 },
  { id: 'tench', kg: [1, 2], weight: 3 },
  { id: 'pike', kg: [2, 4], weight: 1 },
];
export const FISHING = {
  daily: [2, 3, 3, 2, 1, 1], // weights for 0, 1, 2, 3, 4, 5 fish in the pond today
  every: [20, 90], // real seconds between bites (40–180 game minutes)
  tiers: [2, 5, 3], // weights for ★, ★★, ★★★
  energyPerHour: 1, // sitting by the water is not hard work
  until: 22 * 60, // packs up when it gets dark
};

// The woods: a few of these appear along the forest edge every morning.
export const FORAGE = [
  { id: 'mushroom', name: 'gljive', item: 'crop:mushroom:2', n: [1, 1], weight: 2 },
  { id: 'blackberry', name: 'kupine', item: 'crop:blackberry:2', n: [1, 2], weight: 2 },
  { id: 'branches', name: 'grane', item: 'wood', n: [2, 3], weight: 3 },
  { id: 'rocks', name: 'kamenje', item: 'stone', n: [2, 3], weight: 3 },
  // somebody's old garden things: a piece of hose or, rarely, a whole sprinkler
  { id: 'scrap', name: 'odbačeni dijelovi', loot: [
    { item: 'hose', n: [3, 6], weight: 6 }, { item: 'sprinkler', n: [1, 1], weight: 2 },
    { item: 'iron', n: [1, 3], weight: 5 }, { item: 'plastic', n: [1, 3], weight: 5 },
  ], weight: 2 },
];
export const FORAGE_START = 8;
export const FORAGE_DAILY = [3, 5];
export const FORAGE_MAX = 14;

// The old chicken coop by the house: repaired at the workbench, then hens lay one egg
// each morning if there is food. A hen eats about 200 g a day, so 1 kg of produce feeds five.
// How many hens fit and how much the feeder holds are upgrades (UPGRADES.coopHens, coopFeeder);
// maxHens and feedCap here are the repaired coop before any upgrade.
export const COOP = { maxHens: 9, eggCap: 30, feedCap: 20, feedPerHen: 0.2 }; // hens are bought one by one, feed in kg

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
// Selling online. The farmer builds it himself on the laptop at home, like an unpaid gig: first
// the web shop, then a Google Business profile, SEO and social media, each bringing more orders.
// Orders come in the morning and pay more than the stand; the farmer packs them from the bag into
// the parcel box at the parking lot and takes the parcels to the post office in town (on foot,
// or along with a trip to the market). An order not posted by its day is lost; a packed parcel
// that missed its day goes back to the chest.
export const ONLINE = {
  channels: [
    { id: 'webshop', name: 'Web shop', hours: 4, chance: 0.6, desc: 'stranica farme s katalogom i narudžbama' },
    { id: 'google', name: 'Google Business profil', hours: 1, chance: 0.4, desc: 'farma na karti, s recenzijama' },
    { id: 'seo', name: 'SEO za web shop', hours: 3, chance: 0.5, desc: 'shop se nađe na tražilici' },
    { id: 'social', name: 'Društvene mreže', hours: 2, chance: 0.5, desc: 'slike s farme, pratitelji naručuju' },
  ],
  max: 5, // open online orders at once
  kg: [2, 6], // per order, kg of produce (eggs: twice as many pieces; honey: 1–3 kg)
  days: [2, 4], // days to post it
  minTier: [2, 2, 3, 3, 4],
  markup: 0.3, // online buyers pay 30 % more than the stand
  packEnergy: 1,
  postClose: 17 * 60, // the post office in town takes parcels until 17 h
  who: ['Marina iz Zagreba', 'obitelj Kovač', 'bistro Zrno', 'Petra (Instagram)', 'g. Babić', 'vrtić Sunce', 'Luka iz Splita', 'Eko-kutija d.o.o.'],
};

export const GIG_OFFERS = [1, 3]; // new offers each morning
export const GIG_ENERGY_PER_HOUR = 6;

export const RECIPES = [
  {
    id: 'coopPlan', name: 'Plan popravka kokošinjca', once: 'coopPlan', price: 0,
    desc: 'Skiciraj popravak starog kokošinjca. Farmer ga zatim popravlja na licu mjesta; kokoši se naručuju na mobitelu.',
  },
  {
    id: 'wellPlan', name: 'Plan bunara', once: 'wellPlan', price: 0,
    desc: 'Skiciraj bunar. Zida se na gradilištu kod kuće: farmer ode tamo i zida.',
  },
  {
    id: 'rod', name: 'Pecaljka', once: 'rod', price: 4, mats: { wood: 2 },
    desc: 'Štap od drva, najlon i udica (4 zl). Peca se na ribnjaku: alat 5, klik na ribnjak, pa klik kad riba zagrize.',
  },
  {
    // how many doses one bag holds is the shredder's upgrade (UPGRADES.mulchMaker)
    id: 'mulch', name: 'Malč (iverje)', gives: 'mulch', n: 10, nLine: 'mulchMaker', price: 0, mats: { wood: 2 },
    desc: '2 drva → vreća malča. Malčirana zemlja ostaje vlažna dva dana: dovoljno je zalijevati svaki drugi dan.',
  },
  {
    id: 'hive', name: 'Košnica', gives: 'hive', price: 10, mats: { wood: 6 },
    desc: 'Postavi je na travu. Pčele svaki drugi dan napune 1 kg meda (najviše 6 kg); med se skuplja u tegle (Dostava), tegla po kilogramu.',
  },
  {
    id: 'coldroom', name: 'Hladnjača', once: 'coldroom', price: 150, mats: { iron: 6, plastic: 4 },
    desc: 'Škrinja postaje hladnjača: plodovi u njoj više ne gube kvalitetu.',
  },
  {
    id: 'bigCan', name: 'Velika kanta', once: 'bigCan', price: 15,
    desc: `Kanta drži 30 umjesto ${CAN_SIZE} zalijevanja; kasnije se nadograđuje.`,
  },
  {
    id: 'drone', name: 'harvest-drone', once: 'drone', price: 300, mats: { iron: 3, plastic: 3 },
    desc: 'Bere zrele usjeve i nosi ih u škrinju. Plodove bolje od svoje kamere ostavlja tebi; kamera, motori i košara se nadograđuju.',
  },
  {
    id: 'replant', name: 'replant.py', once: 'replant', requires: 'drone', price: 150,
    desc: 'Dron nakon berbe posadi isto sjeme, ako ga imaš.',
  },
  {
    id: 'ads', name: 'Reklame i plakati', once: 'ads', price: 20,
    desc: 'Plakat na stupu uz cestu: kupci na štandu dolaze 10 % češće. Nadogradnje: letci, novine, radio i jumbo plakat, svaka još +10 %.',
  },
  {
    id: 'field2', name: 'git clone polje', once: 'field2', price: 400,
    desc: 'Raščisti zaraslo polje južno od staze: još 48 parcela.',
  },
];

// Upgrades of what was made at the workbench (or built from parts). Each line has levels:
// level 1 is what you get when the thing is first made; every next level is bought on its
// card at the workbench (price in zl, materials from the bag: see MATERIALS). `values[level - 1]` is
// what the level gives, `text(value)` says it in a few words.
export const UPGRADES = {
  droneTier: {
    of: 'drone', name: 'Kamera', values: [2, 3, 4, 5], text: (v) => `bere do ${'★'.repeat(v)}`,
    steps: [{ price: 250, plastic: 3 }, { price: 500, plastic: 6 }, { price: 900, plastic: 10 }],
  },
  droneSpeed: {
    of: 'drone', name: 'Motori', values: [6, 9, 12], text: (v) => `${v} polja/s`,
    steps: [{ price: 150, iron: 3 }, { price: 350, iron: 6 }],
  },
  droneLoad: {
    of: 'drone', name: 'Košara', values: [1, 3, 6], text: (v) => `${v} ${v === 1 ? 'parcela' : v < 5 ? 'parcele' : 'parcela'} po letu`,
    steps: [{ price: 200, wood: 4 }, { price: 400, wood: 8 }],
  },
  replant: {
    of: 'replant', name: 'replant.py', values: [1, 2, 3],
    text: (v) => ['posadi isto sjeme', 'posadi i zalije', 'posadi, zalije i pognoji (gnojivo iz škrinje)'][v - 1],
    steps: [{ price: 120 }, { price: 250 }],
  },
  can: {
    of: 'bigCan', name: 'Kanta', values: [30, 50, 80], text: (v) => `${v} zalijevanja`,
    steps: [{ price: 40, iron: 2 }, { price: 90, iron: 4 }],
  },
  pump: {
    of: 'pump', name: 'Pumpa', values: [6, 12, 24], text: (v) => `pogoni ${v} prskalica`,
    steps: [{ price: 120, iron: 4 }, { price: 300, iron: 8 }],
  },
  // how much sprinkler water counts towards quality next to watering by hand (1);
  // the 4th level also feeds fertilizer from the tank to the plots the sprinklers reach
  nozzles: {
    of: 'pump', name: 'Mlaznice', values: [0.5, 0.8, 1, 1],
    text: (v, level) => (level >= 4 ? 'fertigacija: zalijevaju i gnoje' : `${Math.round(v * 100)} % ručnog zalijevanja`),
    steps: [{ price: 80, plastic: 2 }, { price: 200, plastic: 4 }, { price: 400, plastic: 8 }],
  },
  // the fishing rod: share of ★★★ fish, how long a bite takes, and the most fish a day
  rodTier: {
    of: 'rod', name: 'Štap', values: [30, 50, 70], text: (v) => `${v} % ulova ★★★`,
    steps: [{ price: 40, wood: 3 }, { price: 120, iron: 2, plastic: 2 }],
  },
  rodBait: {
    of: 'rod', name: 'Mamac', values: [1, 0.7, 0.5],
    text: (v) => `riba grize svakih ${Math.round(FISHING.every[0] * v * GAME_MIN_PER_SEC)}–${Math.round(FISHING.every[1] * v * GAME_MIN_PER_SEC)} min`,
    steps: [{ price: 25 }, { price: 70 }],
  },
  rodNet: {
    of: 'rod', name: 'Mreža za ribu', values: [FISHING.daily.length - 1, 7], text: (v) => `do ${v} riba na dan`,
    steps: [{ price: 100, plastic: 4 }],
  },
  mulchMaker: {
    of: 'mulch', name: 'Drobilica', values: [10, 20], text: (v) => `vreća od 2 drva ima ${v} doza malča`,
    steps: [{ price: 60, iron: 3 }],
  },
  mulchDays: {
    of: 'mulch', name: 'Kora', values: [MULCH_DAYS, 3], text: (v, level) => `${level > 1 ? 'malč od kore: ' : ''}zemlja ostaje vlažna ${v} dana`,
    steps: [{ price: 50, wood: 4 }],
  },
  hiveCap: {
    of: 'hive', name: 'Nastavak', values: [HIVES.cap, 10], text: (v) => `košnica drži ${v} kg meda`,
    steps: [{ price: 30, wood: 4 }],
  },
  hiveRate: {
    of: 'hive', name: 'Matica', values: [HIVES.every, 1], text: (v) => (v === 1 ? '1 kg meda svaki dan' : `1 kg meda svaki ${v}. dan`),
    steps: [{ price: 60 }],
  },
  hivePollen: {
    of: 'hive', name: 'Roj', values: [0, 5],
    text: (v) => (v ? `pčele oprašuju parcele do ${v} polja od košnice (+${POLLEN_BONUS} boda kvalitete)` : 'mali roj: pčele ne stižu do polja'),
    steps: [{ price: 80 }],
  },
  coldSize: {
    of: 'coldroom', name: 'Police', values: [CHEST_SIZE, 36, 48], text: (v) => `${v} mjesta u hladnjači`,
    steps: [{ price: 120, iron: 4, plastic: 2 }, { price: 250, iron: 6, plastic: 4 }],
  },
  coopHens: {
    of: 'coop', name: 'Prostor', values: [COOP.maxHens, 12, 15], text: (v) => `do ${v} kokoši`,
    steps: [{ price: 40, wood: 6, stone: 2 }, { price: 80, wood: 10, stone: 4 }],
  },
  coopFeeder: {
    of: 'coop', name: 'Hranilica', values: [COOP.feedCap, 40, 60], text: (v) => `${v} kg hrane`,
    steps: [{ price: 30, wood: 4 }, { price: 60, iron: 3 }],
  },
  incubator: {
    of: 'coop', name: 'Inkubator', values: [0, 3],
    text: (v) => (v ? `svaki ${v}. dan iz jajeta se izleže nova kokoš (dok ima mjesta)` : 'bez inkubatora'),
    steps: [{ price: 90, iron: 2, plastic: 3 }],
  },
  tap: {
    of: 'well', name: 'Slavina uz polje', values: [0, 1],
    text: (v) => (v ? 'slavina na ogradi polja: kanta se puni uz parcele' : 'voda je samo na bunaru i ribnjaku'),
    steps: [{ price: 60, iron: 3, plastic: 2 }],
  },
  greenhouse: {
    of: 'field', name: 'Staklenik', values: [0, 1],
    text: (v) => (v ? 'sve na poljima dozrijeva dan brže (najmanje 1 dan)' : 'bez staklenika'),
    steps: [{ price: 350, wood: 10, plastic: 12 }],
  },
  ads: {
    of: 'ads', name: 'Reklame', values: [1.1, 1.2, 1.3, 1.4, 1.5],
    text: (v, level) => `${AD_NAMES[level - 1]}: +${Math.round((v - 1) * 100)} % kupaca na štandu`,
    steps: [{ price: 40 }, { price: 80 }, { price: 150 }, { price: 250 }],
  },
};

