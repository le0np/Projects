// Fight simulation. Works in game seconds; the UI converts real time with CLOCK_SPEED.
// Pure logic: the renderer only reads `pos`, `playerTop`, `critical`, `lastAction`.
import { MOVE_BY_ID } from '../data/moves.js';
import { POSITIONS, ACTION_BY_ID, MISTAKES, OPPORTUNITY_MISTAKES, GENERIC_MISTAKES, actionsFor } from '../data/positions.js';
import { pick, shuffle } from './rng.js';

export const ROUND_SECONDS = 180;
export const ROUNDS = 3;
export const CLOCK_SPEED = 3;
export const HOLD_SECONDS = 3;
export const CRITICAL_TIME_LIMIT = 20; // real seconds, enforced by the UI; long enough to read five options

const KIND_POINTS = { takedown: 2, sweep: 2, pass: 3 };
const POSITION_POINTS = { kneeOnBelly: 2, mount: 4, back: 4 };
const STEP = 0.25;
const EXCHANGE_MIN = 4;
const EXCHANGE_SPREAD = 4;
const CRITICAL_COOLDOWN = 15;
const P_DEFENSE_CRITICAL = 0.35;
const P_OPPORTUNITY_CRITICAL = 0.3;
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
    critical: null,
    criticalCount: 0,
    lastCriticalAt: -Infinity,
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

export function applyTransition(f, who, kind, to) {
  if (f.pending) {
    f.score[f.pending.who].adv += 1; // near-score that was not held
    f.pending = null;
  }
  f.pos = to.pos;
  f.playerTop = to.pos === 'standing' ? null : (who === 'p') === to.actorTop;
  const scoring = POSITIONS[to.pos].scoring;
  const pts = (KIND_POINTS[kind] ?? 0) + (to.actorTop && scoring ? POSITION_POINTS[scoring] : 0);
  if (pts > 0) f.pending = { who, pts, at: f.clock };
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
  applyTransition(f, who, action.kind, action.to);
}

function autoChance(f, who, action) {
  const diff = lvl(f, who, action.move) - bestDefense(f, other(who), action);
  return action.kind === 'sub' ? clamp(0.06 + 0.04 * diff, 0.02, 0.4) : clamp(0.3 + 0.06 * diff, 0.05, 0.8);
}

function chooseAction(f, who) {
  const options = actionsFor(f.pos, roleOf(f, who)).filter((a) => lvl(f, who, a.move) > 0);
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

function exchange(f) {
  const who = f.rng() < 0.5 ? 'p' : 'o';
  const action = chooseAction(f, who);
  if (!action) return;
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

function mistakeOption(id) {
  return { label: MISTAKES[id].text, correct: false, mistakeId: id };
}

function fillOptions(f, correct, mistakeIds) {
  const wrong = shuffle(f.rng, [...new Set(mistakeIds)]).slice(0, 5 - correct.length).map(mistakeOption);
  for (const g of shuffle(f.rng, GENERIC_MISTAKES)) {
    if (correct.length + wrong.length >= 5) break;
    if (!wrong.some((w) => w.mistakeId === g)) wrong.push(mistakeOption(g));
  }
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
  const correct = action.defenses.map((d) => ({ label: MOVE_BY_ID[d].desc, correct: true, moveId: d }));
  const move = MOVE_BY_ID[action.move];
  openCritical(f, {
    kind: 'defense', actionId,
    text: `${f.opponent.name} ${THREAT_TEXT[action.kind](move.name)}`,
    options: fillOptions(f, correct, action.mistakes),
  });
  f.lastAction = { seq: f.seq, who: 'o', actionId, success: null };
}

// The player has a chance to attack from the current position. Returns false when no real attack is known,
// so a critical moment never consists of wrong answers only.
export function startOpportunity(f) {
  const role = roleOf(f, 'p');
  const known = shuffle(f.rng, actionsFor(f.pos, role).filter((a) => lvl(f, 'p', a.move) > 0 && a.kind !== 'pull'));
  if (!known.length) return false;
  const count = Math.min(known.length, 1 + Math.floor(f.rng() * 3));
  const correct = known.slice(0, count).map((a) => ({ label: MOVE_BY_ID[a.move].desc, correct: true, moveId: a.move, actionId: a.id }));
  openCritical(f, {
    kind: 'opportunity',
    text: `Prilika! (${POSITIONS[f.pos].name})`,
    options: fillOptions(f, correct, OPPORTUNITY_MISTAKES[`${f.pos}:${role}`] ?? []),
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

export function chooseOption(f, index) {
  const c = f.critical;
  if (!c) return;
  f.critical = null;
  const opt = index === null || index === undefined ? null : c.options[index];
  f.lastResult = { kind: c.kind, option: opt, correct: !!opt?.correct, seq: f.seq + 1 };
  if (c.kind === 'defense') {
    const threat = ACTION_BY_ID[c.actionId];
    if (!opt) { say(f, 'Nisi reagirao na vrijeme!', 'o'); applyMistake(f, { effect: 'threat' }, threat); return; }
    if (!opt.correct) { say(f, opt.label, 'p'); applyMistake(f, MISTAKES[opt.mistakeId], threat); return; }
    const p = clamp(0.8 + 0.05 * (lvl(f, 'p', opt.moveId) - lvl(f, 'o', threat.move)), 0.5, 0.97);
    if (f.rng() < p) {
      if (threat.kind === 'sub') f.score.o.adv += 1;
      f.lastAction = { seq: ++f.seq, who: 'o', actionId: threat.id, success: false };
      say(f, `${MOVE_BY_ID[opt.moveId].name} — obranio si se!`, 'p');
    } else if (threat.kind === 'sub' && f.rng() < 0.65) {
      f.score.o.adv += 1;
      say(f, 'Zamalo! Jedva si se izvukao.', 'p');
    } else {
      runAction(f, 'o', threat, true);
    }
    return;
  }
  // opportunity
  if (!opt) { say(f, 'Propustio si priliku.', 'p'); return; }
  if (!opt.correct) { say(f, opt.label, 'p'); applyMistake(f, MISTAKES[opt.mistakeId], null); return; }
  const action = ACTION_BY_ID[opt.actionId];
  const diff = lvl(f, 'p', action.move) - bestDefense(f, 'o', action);
  const p = action.kind === 'sub' ? clamp(0.35 + 0.06 * diff, 0.15, 0.75) : clamp(0.6 + 0.06 * diff, 0.25, 0.92);
  runAction(f, 'p', action, f.rng() < p);
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
      say(f, `+${f.pending.pts} boda: ${fighter(f, f.pending.who).name}`, f.pending.who);
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
