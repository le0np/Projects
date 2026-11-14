// Career progression: timed training, activities, belts, save/load. Pure logic, no DOM.
import { BELTS, MOVES, MOVE_BY_ID } from '../data/moves.js';
import { pick } from './rng.js';

export const BELT_FACTOR = { white: 1, blue: 0.8, purple: 0.55, brown: 0.35, black: 0.15 };
export const MAX_LEVEL = 10;
export const SAVE_VERSION = 1;
export const ACTIVITIES = {
  seminar: { name: 'Seminar', cost: 50, duration: 120 },
  openMat: { name: 'Open mat', cost: 0, duration: 60 },
};
export const COMPETITION_LEARN_CHANCE = 0.05;
export const PROMOTION = {
  blue: { moves: 20, wins: 5 },
  purple: { moves: 30, wins: 15 },
  brown: { moves: 40, wins: 30 },
  black: { moves: 48, wins: 50 },
};

export function createState({ test = true, now = 0 } = {}) {
  return {
    version: SAVE_VERSION,
    test,
    gameTime: 0,
    lastReal: now,
    speed: 1,
    unlockAll: test,
    belt: 'white',
    money: test ? 500 : 100,
    levels: {},
    wins: 0,
    losses: 0,
    compWins: 0, // only competition wins count toward promotion
    medals: { gold: 0, silver: 0, bronze: 0 },
    training: null,
    activity: null,
  };
}

export function learnTime(moveId, level, belt) {
  return MOVE_BY_ID[moveId].base * 2 ** (level - 1) * BELT_FACTOR[belt];
}

export function effectiveLevel(state, moveId) {
  const lvl = state.levels[moveId] ?? 0;
  return state.unlockAll ? Math.max(1, lvl) : lvl;
}

const beltIndex = (b) => BELTS.indexOf(b);

export function canTrain(state, moveId) {
  if (!MOVE_BY_ID[moveId]) return { ok: false, reason: 'Nepoznat potez.' };
  if (state.training) return { ok: false, reason: 'Trening već traje.' };
  const lvl = effectiveLevel(state, moveId);
  if (lvl >= MAX_LEVEL) return { ok: false, reason: 'Potez je na najvišoj razini.' };
  if (lvl === 0 && beltIndex(MOVE_BY_ID[moveId].belt) > beltIndex(state.belt)) {
    return { ok: false, reason: 'Potez višeg pojasa: nauči ga na seminaru, open matu ili natjecanju.' };
  }
  return { ok: true };
}

export function startTraining(state, moveId) {
  const check = canTrain(state, moveId);
  if (!check.ok) return check;
  const toLevel = effectiveLevel(state, moveId) + 1;
  state.training = { moveId, toLevel, startedAt: state.gameTime, endsAt: state.gameTime + learnTime(moveId, toLevel, state.belt) };
  return { ok: true };
}

// Test version only: skip the countdown and raise a move by one level right away.
export function instantLevelUp(state, moveId) {
  if (!state.test) return { ok: false, reason: 'Samo u testnoj verziji.' };
  if (!MOVE_BY_ID[moveId]) return { ok: false, reason: 'Nepoznat potez.' };
  const lvl = effectiveLevel(state, moveId);
  if (lvl >= MAX_LEVEL) return { ok: false, reason: 'Potez je na najvišoj razini.' };
  state.levels[moveId] = lvl + 1;
  if (state.training?.moveId === moveId) state.training = null;
  return { ok: true, level: lvl + 1 };
}

export function startActivity(state, type, rng) {
  const def = ACTIVITIES[type];
  if (!def) return { ok: false, reason: 'Nepoznata aktivnost.' };
  if (state.activity) return { ok: false, reason: 'Već si na aktivnosti.' };
  if (state.money < def.cost) return { ok: false, reason: `Treba ti ${def.cost} €.` };
  state.money -= def.cost;
  const chance = type === 'seminar' ? 0.9 : 0.1 + 0.1 * rng();
  state.activity = { type, chance, startedAt: state.gameTime, endsAt: state.gameTime + def.duration };
  return { ok: true };
}

// Moves the player has never actually learned (level 0 in the save), any belt.
function learnRandomMove(state, rng) {
  const unknown = MOVES.filter((m) => !state.levels[m.id]);
  if (!unknown.length) return null;
  const id = pick(rng, unknown).id;
  state.levels[id] = 1;
  return id;
}

export function advance(state, realNow, rng = Math.random) {
  const dt = Math.max(0, realNow - state.lastReal) / 1000;
  state.lastReal = realNow;
  state.gameTime += dt * state.speed;
  const events = [];
  if (state.training && state.gameTime >= state.training.endsAt) {
    const { moveId, toLevel } = state.training;
    state.levels[moveId] = Math.max(state.levels[moveId] ?? 0, toLevel);
    state.training = null;
    events.push({ type: 'trained', moveId, level: toLevel });
  }
  if (state.activity && state.gameTime >= state.activity.endsAt) {
    const { type, chance } = state.activity;
    state.activity = null;
    const learned = rng() < chance ? learnRandomMove(state, rng) : null;
    events.push({ type: 'activityDone', activity: type, learned });
  }
  return events;
}

export function setSpeed(state, speed, realNow, rng = Math.random) {
  const events = advance(state, realNow, rng);
  state.speed = Math.min(10, Math.max(1, Math.round(speed)));
  return events;
}

export function rollCompetitionLearn(state, rng) {
  return rng() < COMPETITION_LEARN_CHANCE ? learnRandomMove(state, rng) : null;
}

// Before a competition the fighter must know at least one move from each group.
export const COMPETITION_GROUPS = {
  napad: ['sub', 'sweep', 'pass', 'takedown'],
  obrana: ['defense', 'escape'],
  kontrola: ['top', 'guard', 'transition'],
};

export function competitionReady(state) {
  const missing = Object.entries(COMPETITION_GROUPS)
    .filter(([, cats]) => !MOVES.some((m) => cats.includes(m.category) && effectiveLevel(state, m.id) > 0))
    .map(([group]) => group);
  return { ok: missing.length === 0, missing };
}

export function knownMoveCount(state) {
  return Object.values(state.levels).filter((l) => l >= 1).length;
}

// Every fight counts toward the overall record; only competition wins count toward promotion.
export function recordFight(state, mode, won) {
  if (won) state.wins += 1; else state.losses += 1;
  if (won && mode === 'comp') state.compWins += 1;
}

// Wins implied by medals from finished competitions: gold 3, silver 2, bronze 1.
export function compWinsFromMedals(medals) {
  return 3 * (medals?.gold ?? 0) + 2 * (medals?.silver ?? 0) + (medals?.bronze ?? 0);
}

export function promotionStatus(state) {
  const next = BELTS[beltIndex(state.belt) + 1];
  if (!next) return { next: null, ok: false };
  const need = PROMOTION[next];
  const have = { moves: knownMoveCount(state), wins: state.compWins };
  return { next, need, have, ok: have.moves >= need.moves && have.wins >= need.wins };
}

export function promote(state) {
  const st = promotionStatus(state);
  if (!st.ok) return false;
  state.belt = st.next;
  return true;
}

export function serialize(state) {
  return JSON.stringify(state);
}

function isValid(s) {
  return s && typeof s === 'object' && s.version === SAVE_VERSION && Number.isFinite(s.gameTime)
    && Number.isFinite(s.lastReal) && BELTS.includes(s.belt) && s.levels && typeof s.levels === 'object';
}

const num = (v, fallback, lo = -Infinity, hi = Infinity) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const timer = (t) => t && typeof t === 'object' && Number.isFinite(t.startedAt) && Number.isFinite(t.endsAt);

// Keep what is usable from an older or hand-edited save, fill the rest with defaults.
function repair(raw, realNow) {
  const d = createState({ test: raw.test !== false, now: realNow });
  const levels = {};
  for (const [id, l] of Object.entries(raw.levels)) {
    if (MOVE_BY_ID[id] && Number.isFinite(l) && l >= 1) levels[id] = Math.min(MAX_LEVEL, Math.floor(l));
  }
  const medals = { ...d.medals };
  for (const k of Object.keys(medals)) medals[k] = Math.floor(num(raw.medals?.[k], 0, 0));
  const tr = raw.training;
  const ac = raw.activity;
  return {
    ...d,
    test: raw.test !== false,
    gameTime: raw.gameTime,
    lastReal: raw.lastReal,
    speed: Math.round(num(raw.speed, 1, 1, 10)),
    unlockAll: typeof raw.unlockAll === 'boolean' ? raw.unlockAll : d.unlockAll,
    belt: raw.belt,
    money: Math.floor(num(raw.money, d.money, 0)),
    levels,
    wins: Math.floor(num(raw.wins, 0, 0)),
    losses: Math.floor(num(raw.losses, 0, 0)),
    medals,
    // Older saves have no compWins: rebuild it from medals (a quarterfinal exit has no wins).
    compWins: Math.floor(num(raw.compWins, compWinsFromMedals(medals), 0)),
    training: timer(tr) && MOVE_BY_ID[tr.moveId] && Number.isInteger(tr.toLevel) && tr.toLevel >= 1 && tr.toLevel <= MAX_LEVEL
      ? { moveId: tr.moveId, toLevel: tr.toLevel, startedAt: tr.startedAt, endsAt: tr.endsAt } : null,
    activity: timer(ac) && ACTIVITIES[ac.type] && Number.isFinite(ac.chance)
      ? { type: ac.type, chance: num(ac.chance, 0, 0, 1), startedAt: ac.startedAt, endsAt: ac.endsAt } : null,
  };
}

export function deserialize(str, realNow, rng = Math.random) {
  let raw;
  try { raw = JSON.parse(str); } catch { raw = null; }
  if (!isValid(raw)) return createState({ now: realNow });
  const s = repair(raw, realNow);
  advance(s, realNow, rng);
  return s;
}
