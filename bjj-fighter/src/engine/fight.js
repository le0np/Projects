// Fight simulation. Works in game seconds; the UI converts real time with CLOCK_SPEED.
// Pure logic: the renderer only reads `pos`, `playerTop`, `critical`, `lastAction`.
import { MOVE_BY_ID, MOVE_CLASS } from '../data/moves.js';
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

// Typical error chance of a fighter (belt and average level of known moves), shown before the fight.
export function fighterErrorChance(fighter) {
  const l = Object.values(fighter.levels);
  const avg = l.length ? l.reduce((s, x) => s + x, 0) / l.length : 1;
  return errorChance(fighter.belt, avg);
}

export const pct = (p) => `${Math.round(p * 100)} %`;
const KIND_WEIGHT = { sub: 0.6, sweep: 1.5, pass: 1.5, takedown: 1.5, transition: 1.2, escape: 2, pull: 0.3 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const other = (who) => (who === 'p' ? 'o' : 'p');

export function createFight(player, opponent, rng) {
  const f = {
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
  say(f, `Šansa greške po potezu: ${player.name} ${pct(fighterErrorChance(player))}, ${opponent.name} ${pct(fighterErrorChance(opponent))} (pojas i razina poteza).`);
  return f;
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

function addAdvantage(f, who, why) {
  f.score[who].adv += 1;
  say(f, `+1 prednost: ${fighter(f, who).name} (${why})`, who);
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
    const lost = f.pending; // near-score that was not held
    f.pending = null;
    addAdvantage(f, lost.who, `${lost.why} nije zadržano 3 s`);
  }
  f.pos = to.pos;
  f.playerTop = to.pos === 'standing' ? null : (who === 'p') === to.actorTop;
  const scoring = POSITIONS[to.pos].scoring;
  const parts = [];
  if (KIND_POINTS[kind]) parts.push([label, KIND_POINTS[kind]]);
  if (to.actorTop && scoring) parts.push([POSITION_LABEL[scoring], POSITION_POINTS[scoring]]);
  const pts = parts.reduce((sum, [, n]) => sum + n, 0);
  if (pts > 0) {
    const why = parts.map(([l, n]) => `${l} +${n}`).join(', ');
    f.pending = { who, pts, at: f.clock, why };
    say(f, `${why}${parts.length > 1 ? ` = +${pts}` : ''} (boda ako zadrži ${HOLD_SECONDS} s)`, who);
  }
  f.seq += 1;
}

function runAction(f, who, action, success, why = '') {
  const move = MOVE_BY_ID[action.move];
  f.lastAction = { seq: ++f.seq, who, actionId: action.id, success };
  if (!success) {
    say(f, `${fighter(f, who).name}: ${move.name} — ne prolazi${why ? ` (${why})` : ''}.`, who);
    if (action.kind !== 'pull' && f.rng() < 0.3) addAdvantage(f, who, `skoro ${move.name}`);
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
export function opponentBlunder(f, action, chance = errorChance(f.opponent.belt, lvl(f, 'o', action.move))) {
  const move = MOVE_BY_ID[action.move];
  f.lastAction = { seq: ++f.seq, who: 'o', actionId: action.id, success: false };
  say(f, `${f.opponent.name} griješi: ${move.name} mu ne sjeda (šansa greške ${pct(chance)}).`, 'o');
  if (!startOpportunity(f, `${f.opponent.name} je pogriješio — prilika!`)) addAdvantage(f, 'p', `greška protivnika: ${move.name}`);
}

// One exchange: the fighter whose turn it is acts, then the turn passes to the other one.
function exchange(f) {
  const who = f.turn;
  f.turn = other(who);
  const action = chooseAction(f, who);
  const entry = { who, actionId: action?.id ?? null, error: false };
  f.history.push(entry);
  if (!action) return;
  const err = errorChance(fighter(f, who).belt, lvl(f, who, action.move));
  if (f.rng() < err) {
    entry.error = true;
    if (who === 'o') { opponentBlunder(f, action, err); return; }
    f.lastAction = { seq: ++f.seq, who, actionId: action.id, success: false };
    say(f, `Ti: ${MOVE_BY_ID[action.move].name} — greška u izvedbi, ne prolazi (šansa greške ${pct(err)}).`, 'p');
    return;
  }
  if (who === 'o' && action.defenses.length) {
    if (action.kind === 'sub' || (canCritical(f) && f.rng() < P_DEFENSE_CRITICAL)) {
      opponentAttack(f, action);
      return;
    }
  }
  if (who === 'p' && canCritical(f) && f.rng() < P_OPPORTUNITY_CRITICAL && startOpportunity(f)) return;
  const chance = autoChance(f, who, action);
  const why = `napad razine ${lvl(f, who, action.move)} protiv obrane razine ${bestDefense(f, other(who), action)}, šansa ${pct(chance)}`;
  runAction(f, who, action, f.rng() < chance, why);
}

function openCritical(f, critical) {
  f.critical = { ...critical, timeLimit: CRITICAL_TIME_LIMIT };
  say(f, `⚡ Odluka: ${critical.text} [${critical.options.map((o) => `${o.label}${o.correct ? ' ✔' : ''}`).join(' | ')}]`);
  f.criticalCount += 1;
  f.lastCriticalAt = f.elapsed;
  f.seq += 1;
}

// Every option is a real technique. Wrong ones are techniques that do not work from this spot;
// choosing one triggers one of the situation's typical mistakes (`MISTAKES` effects).
const option = (moveId, extra) => ({ label: MOVE_BY_ID[moveId].name, detail: MOVE_BY_ID[moveId].desc, cls: MOVE_CLASS[moveId], moveId, ...extra });

// Positions directly connected to a ground position (one action away), standing excluded.
const NEIGHBOURS = {};
for (const a of ACTIONS) {
  if (!a.to || a.from === 'standing' || a.to.pos === 'standing') continue;
  (NEIGHBOURS[a.from] ??= new Set()).add(a.to.pos);
  (NEIGHBOURS[a.to.pos] ??= new Set()).add(a.from);
}

const known = (f, ids) => [...new Set(ids)].filter((id) => lvl(f, 'p', id) > 0);
const defensesAt = (pos) => ACTIONS.filter((a) => a.from === pos).flatMap((a) => a.defenses);

// Wrong attack options: techniques the player knows that belong to this spot but do not work for their role
// (the other fighter's moves here, defensive moves of this position, the same role one position over).
// Never a standing technique on the ground or a ground technique while standing.
function opportunityDecoys(f, pos, role) {
  const near = NEIGHBOURS[pos] ?? new Set();
  const usable = new Set(actionsFor(pos, role).map((a) => a.move));
  const pool = [
    ...ACTIONS.filter((a) => (a.from === pos && a.role !== role) || (a.role === role && near.has(a.from))).map((a) => a.move),
    ...defensesAt(pos),
  ];
  return known(f, pool).filter((id) => !usable.has(id));
}

// Wrong defense options: techniques the player knows from this spot (other defenses of this position,
// the player's own moves here) that do not stop this particular attack.
function defenseDecoys(f, pos, role, correctIds) {
  const pool = [...defensesAt(pos), ...actionsFor(pos, role).map((a) => a.move)];
  return known(f, pool).filter((id) => !correctIds.includes(id));
}

// null when the player knows no right answer or no wrong one: then there is nothing to decide.
function fillOptions(f, correct, decoyIds, mistakeIds) {
  if (!correct.length || !decoyIds.length) return null;
  const effects = shuffle(f.rng, mistakeIds.length ? [...new Set(mistakeIds)] : GENERIC_MISTAKES);
  const wrong = shuffle(f.rng, decoyIds).slice(0, 5 - correct.length)
    .map((id, i) => option(id, { correct: false, mistakeId: effects[i % effects.length] }));
  return shuffle(f.rng, [...correct, ...wrong]);
}

const THREAT_TEXT = {
  sub: (m) => `kreće u ${m}!`, sweep: (m) => `pokušava sweep (${m})!`, pass: (m) => `pokušava prolaz garda (${m})!`,
  takedown: (m) => `ulazi u rušenje (${m})!`, transition: (m) => `ide u ${m}!`, escape: (m) => `pokušava pobjeći (${m})!`,
};

// The opponent attacks the player with `actionId`; the player must answer with a defense they know.
// Returns false (and changes nothing) when the player knows no defense or no other technique from that spot.
export function startDefense(f, actionId) {
  const action = ACTION_BY_ID[actionId];
  // Counters can come from a neighbouring position (e.g. an arm inside a butterfly guard → triangle).
  const role = action.from === 'standing' ? 'neutral' : action.role === 'top' ? 'bottom' : 'top';
  const correct = known(f, action.defenses).map((d) => option(d, { correct: true }));
  const options = fillOptions(f, correct, defenseDecoys(f, action.from, role, action.defenses), [...action.mistakes, ...GENERIC_MISTAKES]);
  if (!options) return false;
  if (action.from !== f.pos) {
    f.pos = action.from;
    f.playerTop = action.from === 'standing' ? null : action.role === 'bottom';
    f.pending = null;
  }
  const move = MOVE_BY_ID[action.move];
  openCritical(f, {
    kind: 'defense', actionId,
    text: `${f.opponent.name} ${THREAT_TEXT[action.kind](move.name)}`,
    options,
  });
  f.lastAction = { seq: f.seq, who: 'o', actionId, success: null };
  return true;
}

// The opponent attacks; the player decides if they can, otherwise the attack plays out on levels.
function opponentAttack(f, action) {
  if (startDefense(f, action.id)) return;
  const chance = autoChance(f, 'o', action);
  const def = bestDefense(f, 'p', action);
  const why = `napad razine ${lvl(f, 'o', action.move)} protiv tvoje obrane razine ${def}${def ? '' : ' (ne znaš obranu)'}, šansa ${pct(chance)}`;
  runAction(f, 'o', action, f.rng() < chance, why);
}

// The player has a chance to attack from the current position. Returns false when no real attack is known,
// so a critical moment never consists of wrong answers only.
export function startOpportunity(f, text = `Prilika! (${POSITIONS[f.pos].name})`) {
  const role = roleOf(f, 'p');
  const attacks = shuffle(f.rng, actionsFor(f.pos, role).filter((a) => lvl(f, 'p', a.move) > 0 && a.kind !== 'pull'));
  if (!attacks.length) return false;
  const count = Math.min(attacks.length, 1 + Math.floor(f.rng() * 3));
  const correct = attacks.slice(0, count).map((a) => option(a.move, { correct: true, actionId: a.id }));
  const options = fillOptions(f, correct, opportunityDecoys(f, f.pos, role), OPPORTUNITY_MISTAKES[`${f.pos}:${role}`] ?? []);
  if (!options) return false;
  openCritical(f, { kind: 'opportunity', text, options });
  return true;
}

function applyMistake(f, mk, threatAction) {
  switch (mk.effect) {
    case 'tap':
      finish(f, 'o', 'sub', threatAction ? MOVE_BY_ID[threatAction.move].name : 'submission');
      return;
    case 'threat':
      if (threatAction) runAction(f, 'o', threatAction, true);
      else addAdvantage(f, 'o', 'nisi reagirao');
      return;
    case 'pos':
      say(f, `${f.opponent.name} to iskoristi.`, 'o');
      applyTransition(f, 'o', mk.kind, { pos: mk.to.pos, actorTop: !mk.to.selfTop });
      return;
    case 'counter':
      opponentAttack(f, ACTION_BY_ID[mk.counterAction]);
      return;
    case 'penalty':
      f.score.p.pen += 1;
      say(f, 'Sudac ti daje kaznu (+1 kazna).', 'o');
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
  say(f, opt ? `Tvoj izbor: ${opt.label}${fast ? ' (brzo, +10 %)' : ''}` : 'Tvoj izbor: ništa (isteklo vrijeme)', 'p');
  if (c.kind === 'defense') {
    const threat = ACTION_BY_ID[c.actionId];
    if (!opt) { say(f, 'Nisi reagirao na vrijeme!', 'o'); applyMistake(f, { effect: 'threat' }, threat); return; }
    if (!opt.correct) { say(f, `${opt.label} ovdje ne pomaže.`, 'p'); applyMistake(f, MISTAKES[opt.mistakeId], threat); return; }
    const mine = lvl(f, 'p', opt.moveId);
    const theirs = lvl(f, 'o', threat.move);
    Object.assign(f.lastResult, { myLevel: mine, theirLevel: theirs, theirMove: MOVE_BY_ID[threat.move].name });
    const p = clamp(0.8 + 0.05 * (mine - theirs), 0.5, 0.97) + bonus;
    f.lastResult.chance = Math.min(1, p);
    if (f.rng() < p) {
      f.lastResult.success = true;
      f.lastAction = { seq: ++f.seq, who: 'o', actionId: threat.id, success: false };
      say(f, `${MOVE_BY_ID[opt.moveId].name} — obranio si se!`, 'p');
      if (threat.kind === 'sub') escapeAfterDefense(f);
    } else if (threat.kind === 'sub' && f.rng() < 0.65) {
      f.lastResult.success = true;
      say(f, `Zamalo! ${f.opponent.name} je jači (razina ${theirs} protiv tvojih ${mine}, šansa obrane bila je ${pct(p)}), ali izvukao si se.`, 'p');
      addAdvantage(f, 'o', `skoro ${MOVE_BY_ID[threat.move].name}`);
      escapeAfterDefense(f);
    } else {
      f.lastResult.success = false;
      say(f, `Dobar izbor, ali ${f.opponent.name} je nadjačao: ${MOVE_BY_ID[threat.move].name} razina ${theirs} protiv tvoje obrane razine ${mine} (šansa obrane bila je ${pct(p)}).`, 'o');
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
  Object.assign(f.lastResult, { success, myLevel: mine, theirLevel: theirs, chance: Math.min(1, p) });
  if (!success) say(f, `Dobar izbor, ali ${f.opponent.name} te nadjačao: tvoj ${MOVE_BY_ID[action.move].name} razina ${mine} protiv njegove obrane razine ${theirs} (šansa je bila ${pct(p)}).`, 'o');
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
