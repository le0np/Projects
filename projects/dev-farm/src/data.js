// Game balance and static content. Everything tunable lives here.

export const SAVE_VERSION = 1;
export const GRID_MAX = 5; // tiles are always stored as GRID_MAX × GRID_MAX
export const BASE_GRID = 3; // starting field is 3 × 3
export const START_COINS = 10;

export const WATER_DURATION = 30; // seconds a watered tile stays wet
export const DRY_RATE = 0.5; // dry tiles grow at half speed
export const COMPOST_BONUS = 0.25; // +25 % growth speed per compost level
export const WATER_INTERVAL = 10; // water.sh runs every 10 s
export const MAX_STEP = 1; // simulation step in seconds
export const OFFLINE_CAP = 8 * 3600; // at most 8 h of catch-up

// grow = seconds to mature when watered the whole time
export const CROPS = [
  { id: 'radish', name: 'Rotkvica', seed: 2, grow: 10, sell: 5, unlock: 0 },
  { id: 'carrot', name: 'Mrkva', seed: 8, grow: 30, sell: 22, unlock: 60 },
  { id: 'potato', name: 'Krumpir', seed: 25, grow: 60, sell: 70, unlock: 400 },
  { id: 'tomato', name: 'Rajčica', seed: 80, grow: 150, sell: 240, unlock: 2000 },
  { id: 'pumpkin', name: 'Bundeva', seed: 250, grow: 300, sell: 800, unlock: 8000 },
];

export const WATER_PER_RUN = [3, 5, 9, 15, 25];
export const DRONE_INTERVALS = [8, 5, 3, 2, 1];

export const UPGRADES = [
  {
    id: 'water',
    name: 'water.sh',
    cmd: 'crontab -e  # */10 * * * * ./water.sh',
    blurb: 'Cron skripta koja svakih 10 s zalije suhe parcele.',
    costs: [50, 150, 450, 1350, 4000],
    effect: (l) => (l === 0 ? 'ne radi' : `${WATER_PER_RUN[l - 1]} parcela / 10 s`),
  },
  {
    id: 'drone',
    name: 'harvest-drone',
    cmd: 'docker run -d harvest-drone',
    blurb: 'Dron koji sam bere zrele usjeve.',
    costs: [150, 500, 1500, 4500, 12000],
    effect: (l) => (l === 0 ? 'nema' : `1 berba / ${DRONE_INTERVALS[l - 1]} s`),
  },
  {
    id: 'replant',
    name: 'replant.py',
    cmd: 'pip install replant',
    blurb: 'Nakon berbe odmah posadi isti usjev (sjeme se plaća).',
    costs: [300],
    effect: (l) => (l === 0 ? 'isključeno' : 'uključeno'),
  },
  {
    id: 'compost',
    name: 'compost-cache',
    cmd: 'redis-cli SET compost-cache warm',
    blurb: 'Kompost u cacheu: sve raste brže.',
    costs: [100, 300, 900, 2700],
    effect: (l) => (l === 0 ? 'nema' : `+${Math.round(l * COMPOST_BONUS * 100)} % brzine rasta`),
  },
  {
    id: 'field',
    name: 'git clone polje',
    cmd: 'git clone git@farma:polje.git',
    blurb: 'Kloniraj polje i dobij nove parcele.',
    costs: [250, 2000],
    effect: (l) => `${BASE_GRID + l}×${BASE_GRID + l}`,
  },
];
