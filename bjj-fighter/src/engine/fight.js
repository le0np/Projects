// Fight simulation. Works in game seconds; the UI converts real time with CLOCK_SPEED.
// Pure logic: the renderer only reads `pos`, `playerTop`, `critical`, `lastAction`.
import { MOVES, MOVE_BY_ID, MOVE_CLASS } from '../data/moves.js';
import { POSITIONS, ACTIONS, ACTION_BY_ID, MISTAKES, OPPORTUNITY_MISTAKES, GENERIC_MISTAKES, actionsFor } from '../data/positions.js';
import { pick, shuffle } from './rng.js';

export const ROUND_SECONDS = 180;
export const ROUNDS = 3;
export const CLOCK_SPEED = 3;
export const HOLD_SECONDS = 3;
export const CRITICAL_TIME_LIMIT = 20; // real seconds, enforced by the UI; long enough to read five options

const KIND_POINTS = { takedown: 2, sweep: 2, pass: 3 };
const POSITION_POINTS = { kneeOnBelly: 2, mount: 4, back: 4 };
const STEP = 0.25;
const EXCHANGE_MIN = 6;
const EXCHANGE_SPREAD = 3;
const CRITICAL_COOLDOWN = 6;
const P_DEFENSE_CRITICAL = 0.3;
const P_OPPORTUNITY_CRITICAL = 0.25;
const FAST_BONUS = 0.1;
const BELT_ERROR = { white: 0.25, blue: 0.18, purple: 0.12, brown: 0.08, black: 0.05 };
const KIND_LABEL = { takedown: 'rušenje', sweep: 'sweep', pass: 'prolaz garda' };
const POSITION_LABEL = { kneeOnBelly: 'knee on belly', mount: 'mount', back: 'leđa' };

// Chance that a fighter botches a move: lower for higher belts and better-trained moves.
export function errorChance(belt, level) {
  return Math.max(0.02, BELT_ERROR[belt] - 0.015 * Math.max(0, level - 1));
}
const KIND_WEIGHT = { sub: 0.6, sweep: 1.5, pass: 1.5, takedown: 1.5, transition: 1.2, escape: 2, pull: 0.3 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const other = (who) => (who === 'p' ? 'o' : 'p');

export function createFight(player, opponent, rng) {
  return {
    rng, player, opponent,
    round: 1, clock: 0, elapsed: 0,
    pos: 'standing', playerTop: null,
    score: { p: { pts: 0, adv: 0, pen: 0 }, o: { pts: 0, adv: 0, pen: 0 } },
    pending: null,
    nextExchange: 2,
    turn: rng() < 0.5 ? 'p' : 'o',
    history: [],
    critical: null,
    criticalCount: 0,
    lastCriticalAt: -Infinity,
    subCooldownUntil: -Infinity,
    lastResult: null,
    lastAction: null,
    seq: 0,
    log: [],
    ended: null,
  };
}

const fighter = (f, who) => (who === 'p' ? f.player : f.opponent);
const lvl = (f, who, moveId) => fighter(f, who).levels[moveId] ?? 0;

export function roleOf(f, who) {
  if (f.pos === 'standing') return 'neutral';
  return (who === 'p') === f.playerTop ? 'top' : 'bottom';
}

function say(f, text, who = null) {
  f.log.push({ t: f.elapsed, round: f.round, clock: f.clock, text, who });
}

function bestDefense(f, who, action) {
  return action.defenses.reduce((best, d) => Math.max(best, lvl(f, who, d)), 0);
}

function finish(f, winner, method, detail) {
  f.ended = { winner, method, detail };
  f.critical = null;
  say(f, method === 'sub' ? `${fighter(f, winner).name} pobjeđuje submissionom (${detail})!` : `Kraj borbe: ${fighter(f, winner).name} pobjeđuje (${detail}).`, winner);
}

export function applyTransition(f, who, kind, to, label = KIND_LABEL[kind]) {
  if (f.pending) {
    f.score[f.pending.who].adv += 1; // near-score that was not held
    f.pending = null;
  }
  f.pos = to.pos;
  f.playerTop = to.pos === 'standing' ? null : (who === 'p') === to.actorTop;
  const scoring = POSITIONS[to.pos].scoring;
  const parts = [];
  if (KIND_POINTS[kind]) parts.push([label, KIND_POINTS[kind]]);
  if (to.actorTop && scoring) parts.push([POSITION_LABEL[scoring], POSITION_POINTS[scoring]]);
  const pts = parts.reduce((sum, [, n]) => sum + n, 0);
  if (pts > 0) f.pending = { who, pts, at: f.clock, why: parts.map(([l, n]) => `${l} ${n}`).join(' + ') };
  f.seq += 1;
}

function runAction(f, who, action, success) {
  const move = MOVE_BY_ID[action.move];
  f.lastAction = { seq: ++f.seq, who, actionId: action.id, success };
  if (!success) {
    if (action.kind !== 'pull' && f.rng() < 0.3) f.score[who].adv += 1;
    say(f, `${fighter(f, who).name}: ${move.name} — ne prolazi.`, who);
    return;
  }
  if (action.kind === 'sub') {
    finish(f, who, 'sub', move.name);
    return;
  }
  say(f, `${fighter(f, who).name}: ${move.name}.`, who);
  applyTransition(f, who, action.kind, action.to, move.name);
}

function autoChance(f, who, action) {
  const diff = lvl(f, who, action.move) - bestDefense(f, other(who), action);
  return action.kind === 'sub' ? clamp(0.06 + 0.04 * diff, 0.02, 0.4) : clamp(0.3 + 0.06 * diff, 0.05, 0.8);
}

function chooseAction(f, who) {
  const subsBlocked = who === 'o' && f.elapsed < f.subCooldownUntil;
  const options = actionsFor(f.pos, roleOf(f, who)).filter((a) => lvl(f, who, a.move) > 0 && !(subsBlocked && a.kind === 'sub'));
  if (!options.length) return null;
  const total = options.reduce((s, a) => s + KIND_WEIGHT[a.kind], 0);
  let r = f.rng() * total;
  for (const a of options) {
    r -= KIND_WEIGHT[a.kind];
    if (r <= 0) return a;
  }
  return options[options.length - 1];
}

const canCritical = (f) => f.elapsed - f.lastCriticalAt >= CRITICAL_COOLDOWN;

// The opponent botched a move: it fails and the player gets a chance to punish it.
export function opponentBlunder(f, action) {
  const move = MOVE_BY_ID[action.move];
  f.lastAction = { seq: ++f.seq, who: 'o', actionId: action.id, success: false };
  say(f, `${f.opponent.name} griješi: ${move.name} mu ne sjeda.`, 'o');
  if (!startOpportunity(f, `${f.opponent.name} je pogriješio — prilika!`)) {
    f.score.p.adv += 1;
    say(f, 'Prednost za tebe.', 'p');
  }
}

// One exchange: the fighter whose turn it is acts, then the turn passes to the other one.
function exchange(f) {
  const who = f.turn;
  f.turn = other(who);
  const action = chooseAction(f, who);
  const entry = { who, actionId: action?.id ?? null, error: false };
  f.history.push(entry);
  if (!action) return;
  if (f.rng() < errorChance(fighter(f, who).belt, lvl(f, who, action.move))) {
    entry.error = true;
    if (who === 'o') { opponentBlunder(f, action); return; }
    f.lastAction = { seq: ++f.seq, who, actionId: action.id, success: false };
    say(f, `Ti: ${MOVE_BY_ID[action.move].name} — greška u izvedbi, ne prolazi.`, 'p');
    return;
  }
  if (who === 'o' && action.defenses.length) {
    if (action.kind === 'sub' || (canCritical(f) && f.rng() < P_DEFENSE_CRITICAL)) {
      startDefense(f, action.id);
      return;
    }
  }
  if (who === 'p' && canCritical(f) && f.rng() < P_OPPORTUNITY_CRITICAL && startOpportunity(f)) return;
  runAction(f, who, action, f.rng() < autoChance(f, who, action));
}

function openCritical(f, critical) {
  f.critical = { ...critical, timeLimit: CRITICAL_TIME_LIMIT };
  f.criticalCount += 1;
  f.lastCriticalAt = f.elapsed;
  f.seq += 1;
}

// Every option is a real technique. Wrong ones are techniques that do not work from this spot;
// choosing one triggers one of the situation's typical mistakes (`MISTAKES` effects).
const option = (moveId, extra) => ({ label: MOVE_BY_ID[moveId].name, detail: MOVE_BY_ID[moveId].desc, cls: MOVE_CLASS[moveId], moveId, ...extra });

const MOVES_BY_ROLE = {};
for (const a of ACTIONS) (MOVES_BY_ROLE[a.role] ??= new Set()).add(a.move);
const ATTACK_KINDS = new Set(['sub', 'sweep', 'pass', 'takedown', 'transition']);
const DEFENSIVE_CATEGORIES = new Set(['defense', 'escape', 'movement']);

function attackDecoys(role) {
  const mine = MOVES_BY_ROLE[role];
  return [...new Set(ACTIONS.filter((a) => ATTACK_KINDS.has(a.kind) && !mine.has(a.move)).map((a) => a.move))];
}

function defenseDecoys(pos, role, correctIds) {
  const usable = new Set(actionsFor(pos, role).map((a) => a.move));
  return MOVES.filter((m) => DEFENSIVE_CATEGORIES.has(m.category) && !correctIds.includes(m.id) && !usable.has(m.id)).map((m) => m.id);
}

function fillOptions(f, correct, decoyIds, mistakeIds) {
  const effects = shuffle(f.rng, mistakeIds.length ? [...new Set(mistakeIds)] : GENERIC_MISTAKES);
  const wrong = shuffle(f.rng, decoyIds).slice(0, 5 - correct.length)
    .map((id, i) => option(id, { correct: false, mistakeId: effects[i % effects.length] }));
  return shuffle(f.rng, [...correct, ...wrong]);
}

const THREAT_TEXT = {
  sub: (m) => `kreće u ${m}!`, sweep: (m) => `pokušava sweep (${m})!`, pass: (m) => `pokušava prolaz garda (${m})!`,
  takedown: (m) => `ulazi u rušenje (${m})!`, transition: (m) => `ide u ${m}!`, escape: (m) => `pokušava pobjeći (${m})!`,
};

// The opponent attacks the player with `actionId`; the player must answer.
export function startDefense(f, actionId) {
  const action = ACTION_BY_ID[actionId];
  if (action.from !== f.pos) {
    // Counters can come from a neighbouring position (e.g. an arm inside a butterfly guard → triangle).
    f.pos = action.from;
    f.playerTop = action.from === 'standing' ? null : action.role === 'bottom';
    f.pending = null;
  }
  const correct = action.defenses.map((d) => option(d, { correct: true }));
  const move = MOVE_BY_ID[action.move];
  const role = roleOf(f, 'p');
  openCritical(f, {
    kind: 'defense', actionId,
    text: `${f.opponent.name} ${THREAT_TEXT[action.kind](move.name)}`,
    options: fillOptions(f, correct, defenseDecoys(f.pos, role, action.defenses), [...action.mistakes, ...GENERIC_MISTAKES]),
  });
  f.lastAction = { seq: f.seq, who: 'o', actionId, success: null };
}

// The player has a chance to attack from the current position. Returns false when no real attack is known,
// so a critical moment never consists of wrong answers only.
export function startOpportunity(f, text = `Prilika! (${POSITIONS[f.pos].name})`) {
  const role = roleOf(f, 'p');
  const known = shuffle(f.rng, actionsFor(f.pos, role).filter((a) => lvl(f, 'p', a.move) > 0 && a.kind !== 'pull'));
  if (!known.length) return false;
  const count = Math.min(known.length, 1 + Math.floor(f.rng() * 3));
  const correct = known.slice(0, count).map((a) => option(a.move, { correct: true, actionId: a.id }));
  openCritical(f, {
    kind: 'opportunity',
    text,
    options: fillOptions(f, correct, attackDecoys(role), OPPORTUNITY_MISTAKES[`${f.pos}:${role}`] ?? []),
  });
  return true;
}

function applyMistake(f, mk, threatAction) {
  switch (mk.effect) {
    case 'tap':
      finish(f, 'o', 'sub', threatAction ? MOVE_BY_ID[threatAction.move].name : 'submission');
      return;
    case 'threat':
      if (threatAction) runAction(f, 'o', threatAction, true);
      else f.score.o.adv += 1;
      return;
    case 'pos':
      say(f, `${f.opponent.name} to iskoristi.`, 'o');
      applyTransition(f, 'o', mk.kind, { pos: mk.to.pos, actorTop: !mk.to.selfTop });
      return;
    case 'counter':
      startDefense(f, mk.counterAction);
      return;
    case 'penalty':
      f.score.p.pen += 1;
      say(f, 'Sudac ti daje kaznu.', 'o');
      if (threatAction) runAction(f, 'o', threatAction, f.rng() < autoChance(f, 'o', threatAction));
      return;
    default:
      throw new Error(`unknown mistake effect ${mk.effect}`);
  }
}

const BAD_SPOTS = new Set(['mount', 'back', 'sideControl', 'kneeOnBelly', 'northSouth', 'turtle']);
export const SUB_COOLDOWN = 20;

// After defending a submission the opponent needs time to set up the next one, and from a bad spot
// the escape lands the player in half guard instead of the same submission again.
function escapeAfterDefense(f) {
  f.subCooldownUntil = f.elapsed + SUB_COOLDOWN;
  if (roleOf(f, 'p') === 'bottom' && BAD_SPOTS.has(f.pos)) {
    say(f, 'Izvukao si se u polugard.', 'p');
    applyTransition(f, 'p', 'escape', { pos: 'halfGuard', actorTop: false });
  }
}

export function chooseOption(f, index, { fast = false } = {}) {
  const bonus = fast ? FAST_BONUS : 0;
  const c = f.critical;
  if (!c) return;
  f.critical = null;
  const opt = index === null || index === undefined ? null : c.options[index];
  f.lastResult = { kind: c.kind, option: opt, correct: !!opt?.correct, seq: f.seq + 1 };
  if (c.kind === 'defense') {
    const threat = ACTION_BY_ID[c.actionId];
    if (!opt) { say(f, 'Nisi reagirao na vrijeme!', 'o'); applyMistake(f, { effect: 'threat' }, threat); return; }
    if (!opt.correct) { say(f, `${opt.label} ovdje ne pomaže.`, 'p'); applyMistake(f, MISTAKES[opt.mistakeId], threat); return; }
    const mine = lvl(f, 'p', opt.moveId);
    const theirs = lvl(f, 'o', threat.move);
    Object.assign(f.lastResult, { myLevel: mine, theirLevel: theirs, theirMove: MOVE_BY_ID[threat.move].name });
    const p = clamp(0.8 + 0.05 * (mine - theirs), 0.5, 0.97) + bonus;
    if (f.rng() < p) {
      f.lastResult.success = true;
      f.lastAction = { seq: ++f.seq, who: 'o', actionId: threat.id, success: false };
      say(f, `${MOVE_BY_ID[opt.moveId].name} — obranio si se!`, 'p');
      if (threat.kind === 'sub') escapeAfterDefense(f);
    } else if (threat.kind === 'sub' && f.rng() < 0.65) {
      f.lastResult.success = true;
      f.score.o.adv += 1;
      say(f, `Zamalo! ${f.opponent.name} je jači (razina ${theirs} protiv tvojih ${mine}), ali izvukao si se.`, 'p');
      escapeAfterDefense(f);
    } else {
      f.lastResult.success = false;
      say(f, `Dobar izbor, ali ${f.opponent.name} je jači: ${MOVE_BY_ID[threat.move].name} razina ${theirs} protiv tvoje obrane razine ${mine}.`, 'o');
      runAction(f, 'o', threat, true);
    }
    return;
  }
  // opportunity
  if (!opt) { say(f, 'Propustio si priliku.', 'p'); return; }
  if (!opt.correct) { say(f, `${opt.label} odavde ne ide.`, 'p'); applyMistake(f, MISTAKES[opt.mistakeId], null); return; }
  const action = ACTION_BY_ID[opt.actionId];
  const mine = lvl(f, 'p', action.move);
  const theirs = bestDefense(f, 'o', action);
  const p = (action.kind === 'sub' ? clamp(0.35 + 0.06 * (mine - theirs), 0.15, 0.75) : clamp(0.6 + 0.06 * (mine - theirs), 0.25, 0.92)) + bonus;
  const success = f.rng() < p;
  Object.assign(f.lastResult, { success, myLevel: mine, theirLevel: theirs });
  if (!success) say(f, `Dobar izbor, ali ${f.opponent.name} se obranio: tvoj ${MOVE_BY_ID[action.move].name} razina ${mine} protiv njegove obrane razine ${theirs}.`, 'o');
  runAction(f, 'p', action, success);
}

function endRound(f) {
  if (f.pending && f.clock - f.pending.at < HOLD_SECONDS) f.pending = null;
  if (f.round < ROUNDS) {
    f.round += 1;
    f.clock = 0;
    f.pos = 'standing';
    f.playerTop = null;
    f.pending = null;
    f.nextExchange = 2;
    f.seq += 1;
    say(f, `Runda ${f.round}!`);
    return;
  }
  const { p, o } = f.score;
  if (p.pts !== o.pts) finish(f, p.pts > o.pts ? 'p' : 'o', 'points', 'bodovi');
  else if (p.adv !== o.adv) finish(f, p.adv > o.adv ? 'p' : 'o', 'points', 'prednosti');
  else if (p.pen !== o.pen) finish(f, p.pen < o.pen ? 'p' : 'o', 'points', 'kazne');
  else finish(f, f.rng() < 0.5 ? 'p' : 'o', 'decision', 'odluka suca');
}

export function stepFight(f, gameDt) {
  let left = gameDt;
  while (left > 1e-9 && !f.ended && !f.critical) {
    const h = Math.min(STEP, left, ROUND_SECONDS - f.clock);
    left -= h;
    f.clock += h;
    f.elapsed += h;
    if (f.pending && f.clock - f.pending.at >= HOLD_SECONDS - 1e-9) {
      f.score[f.pending.who].pts += f.pending.pts;
      say(f, `+${f.pending.pts} boda: ${fighter(f, f.pending.who).name} (${f.pending.why})`, f.pending.who);
      f.pending = null;
    }
    if (f.clock >= ROUND_SECONDS - 1e-9) {
      f.clock = ROUND_SECONDS;
      endRound(f);
      return; // the rest of the step is the break between rounds
    }
    if (f.clock >= f.nextExchange) {
      f.nextExchange = f.clock + EXCHANGE_MIN + f.rng() * EXCHANGE_SPREAD;
      exchange(f);
    }
  }
}

const clockText = (clock) => {
  const left = Math.max(0, Math.ceil(ROUND_SECONDS - clock));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
};

export function logLine(l) {
  return `R${l.round} ${clockText(l.clock)} ${l.text}`;
}

// Whole fight as plain text, for copying into a bug report or a chat.
export function formatLog(f) {
  const { p, o } = f.score;
  const head = [
    `${f.player.name} (${f.player.belt}) vs ${f.opponent.name} (${f.opponent.belt})`,
    `Bodovi ${p.pts}:${o.pts} · prednosti ${p.adv}:${o.adv} · kazne ${p.pen}:${o.pen}`,
    f.ended ? `Ishod: ${f.ended.winner === 'p' ? 'pobjeda' : 'poraz'} (${f.ended.method}, ${f.ended.detail})` : 'Borba u tijeku',
    '',
  ];
  return [...head, ...f.log.map(logLine)].join('\n');
}
