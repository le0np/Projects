// Career progression: timed training, activities, belts, save/load. Pure logic, no DOM.
import { BELTS, MOVES, MOVE_BY_ID } from '../data/moves.js';
import { pick } from './rng.js';

export const BELT_FACTOR = { white: 1, blue: 0.8, purple: 0.55, brown: 0.35, black: 0.15 };
export const MAX_LEVEL = 10;
export const SAVE_VERSION = 1;
export const ACTIVITIES = {
  // The seminar runs on the real clock: one real hour, whatever the test speed-up, even while the game is closed.
  seminar: { name: 'Seminar', cost: 50, realDuration: 3600 },
  openMat: { name: 'Open mat', cost: 0, duration: 60 },
};
export const COMPETITION_LEARN_CHANCE = 0.05;
// Physical preparation, trained in the club next to the techniques (its own slot, so it runs in parallel).
// Strength changes the chance of every attack and defense; cardio is how slowly you tire in a fight.
export const PHYSICAL = {
  strength: { name: 'Strength', place: 'Gym', base: 20, desc: 'Weights and bodyweight exercises. Strength adds chance to every attack and defense.' },
  cardio: { name: 'Cardio', place: 'Cardio', base: 20, desc: 'Running, intervals and drills. Better cardio: you tire more slowly in a fight and recover faster between rounds.' },
};
export const PROMOTION = {
  blue: { moves: 20, wins: 5 },
  purple: { moves: 30, wins: 15 },
  brown: { moves: 40, wins: 30 },
  black: { moves: 48, wins: 50 },
};

// Story start (see story.js): has the intro been shown, and how many spars, activities and competitions so far.
export function newStory() {
  return { intro: false, skipped: false, spars: 0, activities: 0, comps: 0 };
}

// An older save has no story: show the intro, count what was already done from the record.
export function storyFromSave(raw) {
  const n = (v, fb) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : fb);
  const s = raw.story && typeof raw.story === 'object' ? raw.story : {};
  const medals = raw.medals ?? {};
  const hadComp = (raw.compWins ?? 0) > 0 || ['gold', 'silver', 'bronze'].some((k) => (medals[k] ?? 0) > 0);
  const hadFight = (raw.wins ?? 0) + (raw.losses ?? 0) > 0;
  return {
    intro: s.intro === true,
    skipped: s.skipped === true,
    spars: n(s.spars, hadFight && !hadComp ? 1 : 0),
    activities: n(s.activities, 0),
    comps: n(s.comps, hadComp ? 1 : 0),
  };
}

export function createState({ test = true, now = 0 } = {}) {
  return {
    version: SAVE_VERSION,
    test,
    gameTime: 0,
    lastReal: now,
    speed: 1,
    unlockAll: false, // new game starts from zero; the test panel can still unlock everything
    belt: 'white',
    money: test ? 500 : 100,
    levels: {},
    physical: { strength: 1, cardio: 1 },
    workout: null,
    wins: 0,
    losses: 0,
    compWins: 0, // only competition wins count toward promotion
    medals: { gold: 0, silver: 0, bronze: 0 },
    training: null,
    activity: null,
    story: newStory(),
  };
}

// The player does one thing at a time: a technique, the gym, cardio, a seminar or an open mat.
// Returns what is running (with a reason to show) or null when the player is free.
export function busyWith(state) {
  if (state.training) return { slot: 'training', reason: `You are training ${MOVE_BY_ID[state.training.moveId].name}. One thing at a time.` };
  if (state.workout) return { slot: 'workout', reason: `${PHYSICAL[state.workout.attr].place} is running. One thing at a time.` };
  if (state.activity) return { slot: 'activity', reason: `${state.activity.type === 'seminar' ? 'You are at a seminar' : 'You are at an open mat'}. One thing at a time.` };
  return null;
}

// Timers: `clock: 'real'` means startedAt/endsAt are real milliseconds (Date.now), otherwise game seconds.
export function slotProgress(state, slot, realNow) {
  const at = slot.clock === 'real' ? realNow : state.gameTime;
  return Math.max(0, Math.min(1, (at - slot.startedAt) / (slot.endsAt - slot.startedAt)));
}

// Real seconds left until a timer ends.
export function slotRealLeft(state, slot, realNow) {
  return slot.clock === 'real' ? (slot.endsAt - realNow) / 1000 : (slot.endsAt - state.gameTime) / state.speed;
}

const slotDone = (state, slot, realNow) => (slot.clock === 'real' ? realNow >= slot.endsAt : state.gameTime >= slot.endsAt);

export function workoutTime(attr, level) {
  return PHYSICAL[attr].base * 2 ** (level - 1);
}

export function startWorkout(state, attr) {
  if (!PHYSICAL[attr]) return { ok: false, reason: 'Unknown workout.' };
  const busy = busyWith(state);
  if (busy) return { ok: false, reason: busy.reason };
  const toLevel = state.physical[attr] + 1;
  if (toLevel > MAX_LEVEL) return { ok: false, reason: 'Highest level.' };
  state.workout = { attr, toLevel, startedAt: state.gameTime, endsAt: state.gameTime + workoutTime(attr, toLevel) };
  return { ok: true };
}

// Test version only: raise strength or cardio by one level right away.
export function instantPhysicalUp(state, attr) {
  if (!state.test) return { ok: false, reason: 'Test version only.' };
  if (!PHYSICAL[attr] || state.physical[attr] >= MAX_LEVEL) return { ok: false, reason: 'Highest level.' };
  state.physical[attr] += 1;
  if (state.workout?.attr === attr) state.workout = null;
  return { ok: true, level: state.physical[attr] };
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
  if (!MOVE_BY_ID[moveId]) return { ok: false, reason: 'Unknown move.' };
  const busy = busyWith(state);
  if (busy) return { ok: false, reason: busy.reason };
  const lvl = effectiveLevel(state, moveId);
  if (lvl >= MAX_LEVEL) return { ok: false, reason: 'The move is at the highest level.' };
  if (lvl === 0 && beltIndex(MOVE_BY_ID[moveId].belt) > beltIndex(state.belt)) {
    return { ok: false, reason: 'Higher belt move: learn it at a seminar, an open mat or a competition.' };
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
  if (!state.test) return { ok: false, reason: 'Test version only.' };
  if (!MOVE_BY_ID[moveId]) return { ok: false, reason: 'Unknown move.' };
  const lvl = effectiveLevel(state, moveId);
  if (lvl >= MAX_LEVEL) return { ok: false, reason: 'The move is at the highest level.' };
  state.levels[moveId] = lvl + 1;
  if (state.training?.moveId === moveId) state.training = null;
  return { ok: true, level: lvl + 1 };
}

export function startActivity(state, type, rng, realNow = state.lastReal) {
  const def = ACTIVITIES[type];
  if (!def) return { ok: false, reason: 'Unknown activity.' };
  const busy = busyWith(state);
  if (busy) return { ok: false, reason: busy.reason };
  if (state.money < def.cost) return { ok: false, reason: `You need ${def.cost} €.` };
  state.money -= def.cost;
  const chance = type === 'seminar' ? 0.9 : 0.1 + 0.1 * rng();
  state.activity = def.realDuration
    ? { type, chance, clock: 'real', startedAt: realNow, endsAt: realNow + def.realDuration * 1000 }
    : { type, chance, startedAt: state.gameTime, endsAt: state.gameTime + def.duration };
  return { ok: true };
}

// Test version only: end the running seminar or open mat right away (it still rolls for a new move).
export function finishActivityNow(state, realNow) {
  if (!state.test) return { ok: false, reason: 'Test version only.' };
  const a = state.activity;
  if (!a) return { ok: false, reason: 'No activity is running.' };
  a.endsAt = a.clock === 'real' ? realNow : state.gameTime;
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
  if (state.workout && state.gameTime >= state.workout.endsAt) {
    const { attr, toLevel } = state.workout;
    state.physical[attr] = Math.max(state.physical[attr], toLevel);
    state.workout = null;
    events.push({ type: 'workout', attr, level: toLevel });
  }
  if (state.activity && slotDone(state, state.activity, realNow)) {
    const { type, chance } = state.activity;
    state.activity = null;
    const learned = rng() < chance ? learnRandomMove(state, rng) : null;
    if (state.story) state.story.activities += 1;
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
  attack: ['sub', 'sweep', 'pass', 'takedown'],
  defense: ['defense', 'escape'],
  control: ['top', 'guard', 'transition'],
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
  if (state.story) state.story[mode === 'comp' ? 'comps' : 'spars'] += 1;
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
  const wo = raw.workout;
  const physical = {};
  for (const k of Object.keys(PHYSICAL)) physical[k] = Math.floor(num(raw.physical?.[k], 1, 1, MAX_LEVEL));
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
    physical,
    workout: timer(wo) && PHYSICAL[wo.attr] && Number.isInteger(wo.toLevel) && wo.toLevel >= 2 && wo.toLevel <= MAX_LEVEL
      ? { attr: wo.attr, toLevel: wo.toLevel, startedAt: wo.startedAt, endsAt: wo.endsAt } : null,
    wins: Math.floor(num(raw.wins, 0, 0)),
    losses: Math.floor(num(raw.losses, 0, 0)),
    medals,
    // Older saves have no compWins: rebuild it from medals (a quarterfinal exit has no wins).
    compWins: Math.floor(num(raw.compWins, compWinsFromMedals(medals), 0)),
    story: storyFromSave(raw),
    training: timer(tr) && MOVE_BY_ID[tr.moveId] && Number.isInteger(tr.toLevel) && tr.toLevel >= 1 && tr.toLevel <= MAX_LEVEL
      ? { moveId: tr.moveId, toLevel: tr.toLevel, startedAt: tr.startedAt, endsAt: tr.endsAt } : null,
    activity: timer(ac) && ACTIVITIES[ac.type] && Number.isFinite(ac.chance)
      ? { type: ac.type, chance: num(ac.chance, 0, 0, 1), ...(ac.clock === 'real' ? { clock: 'real' } : {}), startedAt: ac.startedAt, endsAt: ac.endsAt } : null,
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
