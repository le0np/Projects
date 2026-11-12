// Pixel-art sprites as strings: one character = one pixel, '.' = transparent.

export const PALETTE = {
  // crops
  g: '#6cc644', G: '#3d8a2a', r: '#e0475b', R: '#a8283c', o: '#f08a24', O: '#c26412',
  b: '#d2a86a', y: '#9c7442', w: '#f6f1e3',
  // people
  h: '#e2c066', H: '#a5532e', n: '#5b3a24', s: '#f2c39b', k: '#25262b',
  c: '#4f7fc9', C: '#3a5f9c', p: '#6b5138', d: '#3b2a1c',
  // things
  l: '#4e9a3a', L: '#2f6b2a', t: '#7a5230', T: '#4f331d', q: '#a3a9b0', Q: '#6b7178',
  B: '#3d8fd8', Y: '#e8c35a', m: '#7d5a3c', x: '#c9c9c9', e: '#5ad1e6',
};

// --- people: hat + head (per direction) + body + legs (two walk frames)
const HAT = [
  '................',
  '.....hhhhhh.....',
  '....hhhhhhhh....',
  '..hhHHHHHHHHhh..',
];
const HEAD = {
  down: ['....nssssssn....', '....skssssks....', '....ssssssss....', '.....ssssss.....'],
  up: ['....nnnnnnnn....', '....nnnnnnnn....', '....snnnnnns....', '.....ssssss.....'],
  side: ['....nsssssss....', '....nsssssks....', '....nsssssss....', '.....ssssss.....'],
};
const BODY = {
  front: ['....cccccccc....', '...sccccccccs...', '...sCccccccCs...', '....cccccccc....', '....pppppppp....'],
  side: ['.....cccccc.....', '.....ccccccs....', '.....cCcccc.....', '.....cccccc.....', '.....pppppp.....'],
};
const LEGS = {
  front: [
    ['....ppp..ppp....', '....ppp..ppp....', '....ddd..ddd....'],
    ['....ppp..ppp....', '....ddd..ppp....', '.........ddd....'],
  ],
  side: [
    ['.....pp..pp.....', '.....pp..pp.....', '.....dd..ddd....'],
    ['.....ppppp......', '......ppp.......', '......dddd......'],
  ],
};
// villagers (customers) have hair instead of the farmer's straw hat
const HAIR = [
  '................',
  '................',
  '.....nnnnnn.....',
  '....nnnnnnnn....',
];
const person = (top, head, body, legs) => [...top, ...HEAD[head], ...BODY[body], ...legs];
const people = {};
for (const [who, top] of [['farmer', HAT], ['villager', HAIR]]) {
  for (const f of [0, 1]) {
    people[`${who}-down-${f}`] = person(top, 'down', 'front', LEGS.front[f]);
    people[`${who}-up-${f}`] = person(top, 'up', 'front', LEGS.front[f]);
    people[`${who}-side-${f}`] = person(top, 'side', 'side', LEGS.side[f]);
  }
}

export const SPRITES = {
  ...people,

  tree: [
    '.....LLLLLL.....',
    '...LLllllllLL...',
    '..LllllllllllL..',
    '.LllllLlllllllL.',
    '.LlllllllllLlllL',
    'LLllLlllllllllLL',
    '.LlllllllllllL..',
    '.LLllllLlllllL..',
    '..LLlllllllLL...',
    '....LLLLLLLL....',
    '.......tt.......',
    '.......tt.......',
    '.......tt.......',
    '......tTTt......',
    '................',
    '................',
  ],
  chest: [
    '................',
    '................',
    '................',
    '..tttttttttttt..',
    '.tTTTTTTTTTTTTt.',
    '.tttttttttttttt.',
    '.TTTTTTYYTTTTTT.',
    '.ttttttYYtttttt.',
    '.tttttttttttttt.',
    '.tttttttttttttt.',
    '.TTTTTTTTTTTTTT.',
    '.tttttttttttttt.',
    '.tttttttttttttt.',
    '.TTTTTTTTTTTTTT.',
    '................',
    '................',
  ],
  well: [
    '................',
    '..kkkkkkkkkkkk..',
    '.kHHHHHHHHHHHHk.',
    '..t..........t..',
    '..t....xx....t..',
    '..t....mm....t..',
    '..t..........t..',
    '.qqqqqqqqqqqqqq.',
    '.qQqqQqqqQqqQqq.',
    '.qBBBBBBBBBBBBq.',
    '.qqqqqqqqqqqqqq.',
    '.QqqQqqqqQqqqQq.',
    '.qqqqqqqqqqqqqq.',
    '................',
    '................',
    '................',
  ],
  workbench: [
    '................',
    '................',
    '................',
    '................',
    '...xx.....qq....',
    '..xxxx...qQQq...',
    'tttttttttttttttt',
    'TTTTTTTTTTTTTTTT',
    '.t............t.',
    '.t..tttttttt..t.',
    '.t..T......T..t.',
    '.t............t.',
    '.t............t.',
    '.T............T.',
    '................',
    '................',
  ],

  // 8 × 8 crop stages and small things
  sprout: ['........', '........', '........', '........', '..g..g..', '...gg...', '....G...', '........'],
  young: ['........', '........', '.g....g.', '..g..g..', '..gggg..', '...gG...', '....G...', '........'],
  radish: ['..g..g..', '...gg...', '....G...', '..rrrr..', '.rrrrRr.', '.rrrrRr.', '..rRRr..', '....w...'],
  carrot: ['.g.g.g..', '..ggg...', '..oooo..', '..oOoo..', '...ooo..', '...oO...', '....o...', '........'],
  potato: ['...g.g..', '....G...', '..bbbb..', '.bbybbb.', '.bbbbyb.', '.bybbbb.', '..bbbb..', '........'],
  tomato: ['...gg...', '..gGGg..', '.rrGGrr.', 'rrwrrrrR', 'rwrrrrrR', 'rrrrrrRR', '.rrrrRR.', '..RRRR..'],
  pumpkin: ['....n...', '...gn...', '.oOooOo.', 'oOooOooO', 'oOooOooO', 'oOooOooO', '.oOooOo.', '..OOOO..'],
  rotten: ['........', '........', '...yy...', '..yTTy..', '.yTTTTy.', '.yTTTTy.', '..yyyy..', '........'],
  drone: ['qq....qq', '.k....k.', '..kkkk..', '..keek..', '..kkkk..', '.k....k.', 'qq....qq', '........'],
  sprinkler: ['...BB...', '..B..B..', '...qq...', '...qq...', '...qq...', '..qqqq..', '.kkkkkk.', '........'],
  fertilizer: ['........', '..mmmm..', '.mYYYYm.', '.mmmmmm.', '.mmgmmm.', '.mgggmm.', '.mmmmmm.', '........'],
  drop: ['..B..', '.BBB.', 'BBBBB', 'BwBBB', '.BBB.'],
};

const cache = new Map();

// Offscreen canvas at 1 px per pixel. `colors` swaps palette entries (customers' clothes).
export function spriteCanvas(name, colors = null) {
  const key = colors ? `${name}|${JSON.stringify(colors)}` : name;
  if (cache.has(key)) return cache.get(key);
  const rows = SPRITES[name];
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const ctx = c.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = colors?.[ch] ?? PALETTE[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  cache.set(key, c);
  return c;
}

const urls = new Map();
export function spriteUrl(name) {
  if (!urls.has(name)) urls.set(name, spriteCanvas(name).toDataURL());
  return urls.get(name);
}
