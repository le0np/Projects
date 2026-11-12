// Tiny pixel-art sprites drawn from strings. One character = one pixel, '.' = transparent.

export const PALETTE = {
  g: '#6cc644', G: '#3d8a2a',
  r: '#e0475b', R: '#a8283c',
  o: '#f08a24', O: '#c26412',
  b: '#d2a86a', y: '#9c7442',
  w: '#f6f1e3', k: '#2b2d30', c: '#5ad1e6', s: '#a3a9b0',
  B: '#3d8fd8', n: '#7a5230', N: '#4f331d',
};

export const SPRITES = {
  sprout: [
    '........',
    '........',
    '........',
    '........',
    '..g..g..',
    '...gg...',
    '....G...',
    '........',
  ],
  young: [
    '........',
    '........',
    '.g....g.',
    '..g..g..',
    '..gggg..',
    '...gG...',
    '....G...',
    '........',
  ],
  radish: [
    '..g..g..',
    '...gg...',
    '....G...',
    '..rrrr..',
    '.rrrrRr.',
    '.rrrrRr.',
    '..rRRr..',
    '....w...',
  ],
  carrot: [
    '.g.g.g..',
    '..ggg...',
    '..oooo..',
    '..oOoo..',
    '...ooo..',
    '...oO...',
    '....o...',
    '........',
  ],
  potato: [
    '...g.g..',
    '....G...',
    '..bbbb..',
    '.bbybbb.',
    '.bbbbyb.',
    '.bybbbb.',
    '..bbbb..',
    '........',
  ],
  tomato: [
    '...gg...',
    '..gGGg..',
    '.rrGGrr.',
    'rrwrrrrR',
    'rwrrrrrR',
    'rrrrrrRR',
    '.rrrrRR.',
    '..RRRR..',
  ],
  pumpkin: [
    '....n...',
    '...gn...',
    '.oOooOo.',
    'oOooOooO',
    'oOooOooO',
    'oOooOooO',
    '.oOooOo.',
    '..OOOO..',
  ],
  drone: [
    'ss....ss',
    '.k....k.',
    '..kkkk..',
    '..kcck..',
    '..kkkk..',
    '.k....k.',
    'ss....ss',
    '........',
  ],
  sprinkler: [
    '...BB...',
    '..B..B..',
    '...ss...',
    '...ss...',
    '...ss...',
    '..ssss..',
    '.kkkkkk.',
    '........',
  ],
  compost: [
    '........',
    '.nnnnnn.',
    '.NgnGnN.',
    '.nNnnNn.',
    '.NnNnNn.',
    '.nNnnNn.',
    '.NNNNNN.',
    '........',
  ],
  drop: [
    '..B..',
    '.BBB.',
    'BBBBB',
    'BwBBB',
    '.BBB.',
  ],
};

const cache = new Map();

// Returns an offscreen canvas at 1 px per pixel; scale it up with imageSmoothing off.
export function spriteCanvas(name) {
  if (cache.has(name)) return cache.get(name);
  const rows = SPRITES[name];
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const ctx = c.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = PALETTE[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  cache.set(name, c);
  return c;
}
