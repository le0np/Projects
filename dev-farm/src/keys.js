// The player's own toolbar layout and keys (settings, kept in the browser like the other
// settings, not in the save). Pure functions: no DOM, so they are tested like the rules.

export const TOOL_ORDER = ['hand', 'seed', 'can', 'fert', 'rod', 'mulch', 'axe'];

// Everything that has a key. Tools are picked by key; jobs run on everything (like ▾).
export const ACTIONS = [
  { id: 'tool:hand', name: 'Ruke', key: '1' },
  { id: 'tool:seed', name: 'Sjeme', key: '2' },
  { id: 'tool:can', name: 'Kanta', key: '3' },
  { id: 'tool:fert', name: 'Gnojivo', key: '4' },
  { id: 'tool:rod', name: 'Pecaljka', key: '5' },
  { id: 'tool:mulch', name: 'Malč', key: '6' },
  { id: 'tool:axe', name: 'Sjekira', key: '7' },
  { id: 'job:plant', name: 'Posadi sve', key: 'p' },
  { id: 'job:harvest', name: 'Poberi sve', key: 'b' },
  { id: 'job:water', name: 'Zalij sve', key: 'z' },
  { id: 'job:fertilize', name: 'Pognoji sve', key: 'g' },
  { id: 'bag', name: 'Torba', key: 't' },
  { id: 'phone', name: 'Mobitel', key: 'm' },
  { id: 'zoomIn', name: 'Približi', key: '+' },
  { id: 'zoomOut', name: 'Udalji', key: '-' },
];
export const DEFAULT_KEYS = Object.fromEntries(ACTIONS.map((a) => [a.id, a.key]));

// Keys that keep their own job: Esc cancels, Tab and Enter move around the page.
const RESERVED = new Set(['Escape', 'Tab', 'Enter', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Dead', 'Unidentified']);

// "P" and "p" are the same key; anything longer ("F2", "ArrowUp") stays as it is.
export const normKey = (k) => (typeof k === 'string' && k.length === 1 ? k.toLowerCase() : k);
export const canBind = (k) => typeof k === 'string' && k !== '' && !RESERVED.has(k);

// The keys from saved settings, checked: unknown actions dropped, bad keys and doubles back to default.
export function keymap(saved) {
  const map = { ...DEFAULT_KEYS };
  if (saved && typeof saved === 'object') {
    for (const id of Object.keys(DEFAULT_KEYS)) {
      const k = normKey(saved[id]);
      if (canBind(k)) map[id] = k;
    }
  }
  // two actions on one key: the later one goes back to its default, or to none if that is taken
  const seen = new Set();
  for (const id of Object.keys(map)) {
    if (!seen.has(map[id])) { seen.add(map[id]); continue; }
    const def = DEFAULT_KEYS[id];
    map[id] = seen.has(def) || Object.values(map).filter((k) => k === def).length > 1 ? '' : def;
    if (map[id]) seen.add(map[id]);
  }
  return map;
}

// Put `key` on `action`. If another action had that key, the two swap, so nothing is lost.
export function bindKey(map, action, key) {
  const k = normKey(key);
  if (!Object.hasOwn(map, action) || !canBind(k)) return map;
  const next = { ...map };
  const other = Object.keys(map).find((id) => id !== action && map[id] === k);
  if (other) next[other] = map[action];
  next[action] = k;
  return next;
}

// Which action a pressed key runs (null: none). "=" zooms in too while "+" does (no Shift needed).
export function actionFor(map, key) {
  const k = normKey(key);
  const hit = Object.keys(map).find((id) => map[id] && map[id] === k);
  if (hit) return hit;
  if (k === '=' && map.zoomIn === '+') return 'zoomIn';
  return null;
}

// How a key is written on the toolbar and in titles.
export function keyLabel(k) {
  if (!k) return '–';
  if (k === ' ') return 'Razmak';
  const words = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backspace: '⌫', Delete: 'Del' };
  return words[k] ?? (k.length === 1 ? k.toUpperCase() : k);
}

// The toolbar order from settings: known tools only, each once, the missing ones at the end.
export function toolOrder(saved) {
  const out = Array.isArray(saved) ? saved.filter((t, i) => TOOL_ORDER.includes(t) && saved.indexOf(t) === i) : [];
  return [...out, ...TOOL_ORDER.filter((t) => !out.includes(t))];
}

// Move a tool one place left (-1) or right (+1); at the end it stays.
export function moveTool(order, id, dir) {
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
