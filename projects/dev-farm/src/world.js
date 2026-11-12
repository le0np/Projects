// The static map: terrain, buildings and where you stand to use them.
//
// Map characters:
//   .  grass        *  flowers       ,  dirt path     r  road (customers come from here)
//   t  tree         f  fence         ~  pond          P  field plot
//   Q  plot in the overgrown second field (unlocked with "git clone polje")
//   H  house        S  stand         C  chest         W  well          B  workbench

export const W = 48;
export const H = 32;

export const HOUSE = { x: 5, y: 4, w: 6, h: 5 };
export const STAND = { x: 12, y: 10, w: 2, h: 2 };
export const HOUSE_DOOR = [8, 9]; // tile in front of the door
export const DRONE_HOME = [8, 5]; // on the roof
export const CUSTOMER_SPOT = [12, 12];
export const SPAWNS = [[43, 0], [44, 31]];
export const FIELD_A = { x: 18, y: 4, w: 10, h: 8 }; // including the fence
export const FIELD_B = { x: 18, y: 15, w: 10, h: 8 };

function build() {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const rect = (x0, y0, x1, y1, ch) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch;
  };
  const fenced = (f, plot) => {
    rect(f.x, f.y, f.x + f.w - 1, f.y + f.h - 1, 'f');
    rect(f.x + 1, f.y + 1, f.x + f.w - 2, f.y + f.h - 2, plot);
  };

  // forest border
  rect(0, 0, W - 1, 1, 't');
  rect(0, H - 2, W - 1, H - 1, 't');
  rect(0, 0, 1, H - 1, 't');
  rect(W - 2, 0, W - 1, H - 1, 't');

  // scattered trees (deterministic), only on plain grass
  let seed = 20261112;
  const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  const forest = [
    [2, 16, 15, 29, 0.32], [29, 25, 41, 29, 0.35], [31, 2, 41, 8, 0.22], [2, 2, 3, 6, 0.3],
  ];
  for (const [x0, y0, x1, y1, p] of forest) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (rnd() < p) g[y][x] = 't';
  }

  // road along the east edge, main path from the door to the road
  rect(43, 0, 44, H - 1, 'r');
  rect(8, 9, 8, 12, ',');
  rect(8, 12, 42, 12, ',');

  // buildings
  rect(HOUSE.x, HOUSE.y, HOUSE.x + HOUSE.w - 1, HOUSE.y + HOUSE.h - 1, 'H');
  rect(STAND.x, STAND.y, STAND.x + STAND.w - 1, STAND.y + STAND.h - 1, 'S');
  g[8][11] = 'C';
  g[6][15] = 'W';
  g[8][3] = 'B';

  // fields with gates onto the path
  fenced(FIELD_A, 'P');
  rect(22, 11, 23, 11, ',');
  fenced(FIELD_B, 'Q');
  rect(22, 13, 23, 15, ',');

  // pond
  rect(32, 17, 37, 22, '~');
  for (const [x, y] of [[32, 17], [37, 17], [32, 22], [37, 22]]) g[y][x] = '.';

  // keep the areas around buildings and paths clear of trees
  for (const [x0, y0, x1, y1] of [[2, 9, 16, 13], [12, 4, 17, 9], [29, 11, 42, 13], [30, 15, 39, 24]]) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y][x] === 't') g[y][x] = '.';
  }

  // flowers near the house
  for (let y = 2; y <= 13; y++) {
    for (let x = 2; x <= 17; x++) if (g[y][x] === '.' && rnd() < 0.08) g[y][x] = '*';
  }
  return g.map((row) => row.join(''));
}

export const MAP = build();

export const idx = (x, y) => y * W + x;
export const xy = (i) => [i % W, Math.floor(i / W)];
export const inBounds = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
export const charAt = (x, y) => (inBounds(x, y) ? MAP[y][x] : 't');

const WALKABLE = new Set(['.', '*', ',', 'r', 'P', 'Q']);
export const isWalkable = (x, y) => WALKABLE.has(charAt(x, y));
export const isPlotTile = (x, y) => charAt(x, y) === 'P' || charAt(x, y) === 'Q';
// customers prefer the road and paths, and stay out of the fields
export const npcCost = (x, y) => {
  const ch = charAt(x, y);
  return ch === 'r' || ch === ',' ? 1 : ch === 'P' || ch === 'Q' ? 50 : 6;
};

const collect = (ch) => {
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (MAP[y][x] === ch) out.push(idx(x, y));
  return out;
};
export const PLOTS_A = collect('P');
export const PLOTS_B = collect('Q');
const PLOTS_A_SET = new Set(PLOTS_A);
export const inFieldA = (i) => PLOTS_A_SET.has(i);

const pondAccess = () => {
  const seen = new Set();
  for (const i of collect('~')) {
    const [x, y] = xy(i);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (isWalkable(x + dx, y + dy)) seen.add(idx(x + dx, y + dy));
    }
  }
  return [...seen].map(xy);
};

export const OBJECTS = {
  house: { name: 'Kuća', access: [HOUSE_DOOR] },
  chest: { name: 'Škrinja', access: [[11, 9]] },
  stand: { name: 'Štand', access: [[13, 12], [14, 11]] },
  well: { name: 'Bunar', access: [[15, 7]] },
  workbench: { name: 'Radni stol', access: [[3, 9]] },
  pond: { name: 'Ribnjak', access: pondAccess() },
};

const CHAR_OBJECT = { H: 'house', S: 'stand', C: 'chest', W: 'well', B: 'workbench', '~': 'pond' };
export const objectAt = (x, y) => CHAR_OBJECT[charAt(x, y)] ?? null;
