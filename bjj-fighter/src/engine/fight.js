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
// Competition pace (ADCC / CJI / UFC BJJ): frequent exchanges, most of them play out on their own,
// and the player decides only in a few key moments per fight.
const EXCHANGE_MIN = 4;
const EXCHANGE_SPREAD = 3;
const CRITICAL_COOLDOWN = 30; // game seconds between two decisions
const P_DEFENSE_CRITICAL = 0.12; // opponent's sweep, pass, takedown... becomes a decision
const P_SUB_CRITICAL = 0.6; // opponent's submission attempt becomes a decision
const P_OPPORTUNITY_CRITICAL = 0.1;
const P_BLUNDER_CRITICAL = 0.25; // opponent's mistake becomes your decision, otherwise an advantage
const P_WRONG_SUB_LANDS = 0.6; // a wrong answer to a submission finishes it this often
const FAST_BONUS = 0.1;
// Error chance at move level 1; every level above 1 multiplies it by ERROR_PER_LEVEL.
// White and blue belts botch a lot; it drops with training and with the belt.
const BELT_ERROR = { white: 0.6, blue: 0.42, purple: 0.25, brown: 0.13, black: 0.06 };
const ERROR_PER_LEVEL = 0.88;
const P_COUNTER = 0.5; // a botched move gives the other fighter an immediate counter this often
const COUNTER_BONUS = 0.1; // ...with this bonus
const KIND_LABEL = { takedown: 'rušenje', sweep: 'sweep', pass: 'prolaz garda' };
const POSITION_LABEL = { kneeOnBelly: 'knee on belly', mount: 'mount', back: 'leđa' };

// Chance that a fighter botches a move: lower for higher belts and better-trained moves.
export function errorChance(belt, level) {
  return Math.max(0.02, BELT_ERROR[belt] * ERROR_PER_LEVEL ** Math.max(0, level - 1));
}

// Typical error chance of a fighter (belt and average level of known moves), shown before the fight.
export function fighterErrorChance(fighter) {
  const l = Object.values(fighter.levels);
  const avg = l.length ? l.reduce((s, x) => s + x, 0) / l.length : 1;
  return errorChance(fighter.belt, avg);
}

export const pct = (p) => `${Math.round(p * 100)} %`;
const KIND_WEIGHT = { sub: 0.4, sweep: 1.5, pass: 1.5, takedown: 1.5, transition: 1.2, escape: 2, pull: 0.3 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const other = (who) => (who === 'p' ? 'o' : 'p');

// `quiet: true` (tests only): no exchanges happen on their own.
export function createFight(player, opponent, rng, { quiet = false } = {}) {
  const f = {
    rng, player, opponent,
    round: 1, clock: 0, elapsed: 0,
    pos: 'standing', playerTop: null,
    score: { p: { pts: 0, adv: 0, pen: 0 }, o: { pts: 0, adv: 0, pen: 0 } },
    pending: null,
    nextExchange: 2,
    quiet,
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
  say(f, `${fighter(f, who).name}: ${move.name}${lvl(f, who, action.move) ? '' : ' (bez naučene tehnike, na instinkt)'}.`, who);
  applyTransition(f, who, action.kind, action.to, move.name);
}

function autoChance(f, who, action, bonus = 0) {
  const diff = lvl(f, who, action.move) - bestDefense(f, other(who), action);
  return (action.kind === 'sub' ? clamp(0.05 + 0.03 * diff, 0.02, 0.3) : clamp(0.6 + 0.07 * diff, 0.25, 0.9)) + bonus;
}

// A fighter who knows nothing useful from this spot still moves on instinct: an untrained escape,
// sweep, pass or takedown (never a submission), so nobody gets stuck in a position for a whole round.
function instinctOptions(f, who) {
  return actionsFor(f.pos, roleOf(f, who)).filter((a) => a.kind !== 'sub' && a.kind !== 'pull');
}

function chooseAction(f, who, { noSubs = false } = {}) {
  const subsBlocked = noSubs || (who === 'o' && f.elapsed < f.subCooldownUntil);
  let options = actionsFor(f.pos, roleOf(f, who)).filter((a) => lvl(f, who, a.move) > 0 && !(subsBlocked && a.kind === 'sub'));
  if (!options.length) options = instinctOptions(f, who);
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

// The opponent botched a move: it fails and the player gets a chance to punish it,
// sometimes as a decision, otherwise as an immediate counter that plays out on its own.
export function opponentBlunder(f, action, chance = errorChance(f.opponent.belt, lvl(f, 'o', action.move))) {
  const move = MOVE_BY_ID[action.move];
  f.lastAction = { seq: ++f.seq, who: 'o', actionId: action.id, success: false };
  say(f, `${f.opponent.name} griješi: ${move.name} mu ne sjeda (šansa greške ${pct(chance)}).`, 'o');
  const where = POSITIONS[f.pos].name.toLowerCase();
  if (canCritical(f) && f.rng() < P_BLUNDER_CRITICAL
    && startOpportunity(f, `${f.opponent.name} je zeznuo ${move.name} — kazni ga! Izaberi napad iz pozicije: ${where}.`)) return;
  counter(f, 'p', move.name);
}

// After a botched move the other fighter goes straight into a positional attack (sweep, pass, takedown,
// escape...), with a small bonus. Submissions need a set-up, so they are not counters.
function counter(f, who, botched) {
  if (f.rng() >= P_COUNTER) return;
  const action = chooseAction(f, who, { noSubs: true });
  if (!action) { addAdvantage(f, who, `greška protivnika: ${botched}`); return; }
  f.history.push({ who, actionId: action.id, error: false, counter: true });
  f.turn = other(who);
  say(f, `${fighter(f, who).name} kažnjava grešku:`, who);
  autoAction(f, who, action, COUNTER_BONUS);
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
    counter(f, 'o', MOVE_BY_ID[action.move].name);
    return;
  }
  if (who === 'o' && action.defenses.length && canCritical(f)
    && f.rng() < (action.kind === 'sub' ? P_SUB_CRITICAL : P_DEFENSE_CRITICAL) && startDefense(f, action.id)) return;
  if (who === 'p' && canCritical(f) && f.rng() < P_OPPORTUNITY_CRITICAL && startOpportunity(f)) return;
  autoAction(f, who, action);
}

function openCritical(f, critical) {
  f.critical = { ...critical, timeLimit: CRITICAL_TIME_LIMIT };
  f.critical.hint = giveHint(f, f.critical);
  say(f, `⚡ Odluka: ${critical.text} [${critical.options.map((o) => `${o.label}${o.correct ? ' ✔' : ''}`).join(' | ')}]`);
  if (f.critical.hint) say(f, `💭 Osjećaj ti govori: ${critical.options[f.critical.hint.index].label} (pouzdanost osjećaja ${pct(f.critical.hint.accuracy)}).`, 'p');
  f.criticalCount += 1;
  f.lastCriticalAt = f.elapsed;
  f.seq += 1;
}

// Every option is a real technique. Wrong ones are techniques that do not work from this spot;
// choosing one triggers one of the situation's typical mistakes (`MISTAKES` effects).
const option = (moveId, extra) => ({ label: MOVE_BY_ID[moveId].name, detail: MOVE_BY_ID[moveId].desc, cls: MOVE_CLASS[moveId], moveId, ...extra });

const known = (f, ids) => [...new Set(ids)].filter((id) => lvl(f, 'p', id) > 0);
const ROLE_NAME = { top: 'odozgo', bottom: 'odozdo', neutral: 'iz stava' };
const otherRole = (role) => (role === 'top' ? 'bottom' : role === 'bottom' ? 'top' : 'neutral');

// Wrong attack options: attacks (sweeps, submissions, passes, takedowns) that exist in this exact position
// but only for the other fighter's role, e.g. a triangle when you are on top in closed guard. Never a defense,
// an escape or a position name, which make no sense when you are asked to attack.
function opportunityDecoys(f, pos, role) {
  const usable = new Set(actionsFor(pos, role).map((a) => a.move));
  const pool = actionsFor(pos, otherRole(role)).filter((a) => ['sub', 'sweep', 'pass', 'takedown'].includes(a.kind)).map((a) => a.move);
  return known(f, pool).filter((id) => !usable.has(id));
}

// Wrong defense options: defenses against the other attacks the opponent has from this spot
// (a guillotine defense against a triangle), plus the player's own attacks here. Never a defense
// against the player's own moves (re-closing the guard while you are the one on top).
function defenseDecoys(f, pos, role, correctIds) {
  const threats = actionsFor(pos, otherRole(role));
  const pool = [...threats.flatMap((a) => a.defenses), ...actionsFor(pos, role).map((a) => a.move)];
  return known(f, pool).filter((id) => !correctIds.includes(id));
}

// null when there is nothing to decide: no right answer, or only one right answer and nothing wrong.
// With several right answers and no wrong one the decision is which attack has the best chance.
function fillOptions(f, correct, decoyIds, mistakeIds) {
  if (!correct.length || (!decoyIds.length && correct.length < 2)) return null;
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

// An attack that plays out on its own, decided by the levels of the attack and the best defense.
function autoAction(f, who, action, bonus = 0) {
  const chance = autoChance(f, who, action, bonus);
  const def = bestDefense(f, other(who), action);
  const unknown = who === 'o' && !def && action.defenses.length ? ' — ne znaš obranu' : '';
  const raw = lvl(f, who, action.move) ? '' : ', bez naučene tehnike';
  const why = `napad razine ${lvl(f, who, action.move)} protiv obrane razine ${def}${unknown}${raw}, šansa ${pct(chance)}`;
  runAction(f, who, action, f.rng() < chance, why);
}

// The opponent attacks; the player decides if they can, otherwise the attack plays out on levels.
function opponentAttack(f, action) {
  if (!startDefense(f, action.id)) autoAction(f, 'o', action);
}

// The player has a chance to attack from the current position. Returns false when no real attack is known,
// so a critical moment never consists of wrong answers only.
export function startOpportunity(f, text = `Prilika za napad! Izaberi tehniku iz pozicije: ${POSITIONS[f.pos].name.toLowerCase()}.`) {
  const role = roleOf(f, 'p');
  const attacks = shuffle(f.rng, actionsFor(f.pos, role).filter((a) => lvl(f, 'p', a.move) > 0 && a.kind !== 'pull'));
  if (!attacks.length) return false;
  const decoys = opportunityDecoys(f, f.pos, role);
  const count = Math.min(attacks.length, decoys.length ? 1 + Math.floor(f.rng() * 3) : 5);
  const correct = attacks.slice(0, count).map((a) => option(a.move, { correct: true, actionId: a.id }));
  const options = fillOptions(f, correct, decoys, OPPORTUNITY_MISTAKES[`${f.pos}:${role}`] ?? []);
  if (!options) return false;
  openCritical(f, { kind: 'opportunity', text, options });
  return true;
}

function applyMistake(f, mk, threatAction, wrongChoice = false) {
  switch (mk.effect) {
    case 'tap':
      finish(f, 'o', 'sub', threatAction ? MOVE_BY_ID[threatAction.move].name : 'submission');
      return;
    case 'threat':
      if (threatAction?.kind === 'sub' && wrongChoice && f.rng() >= P_WRONG_SUB_LANDS) {
        // A wrong defense against a submission is usually fatal, but at this level people survive it sometimes.
        say(f, `${MOVE_BY_ID[threatAction.move].name} je bio duboko, ali u zadnji tren si se izvukao.`, 'p');
        addAdvantage(f, 'o', `skoro ${MOVE_BY_ID[threatAction.move].name}`);
        escapeAfterDefense(f);
      } else if (threatAction) runAction(f, 'o', threatAction, true);
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

const defenseChance = (mine, theirs) => clamp(0.8 + 0.05 * (mine - theirs), 0.5, 0.97);
const attackChance = (kind, mine, theirs) => (kind === 'sub' ? clamp(0.2 + 0.05 * (mine - theirs), 0.08, 0.55) : clamp(0.6 + 0.06 * (mine - theirs), 0.25, 0.92));

// Chance that a right option works, so the hint can point at the best one.
function optionChance(f, c, opt) {
  if (!opt.correct) return 0;
  if (c.kind === 'defense') return defenseChance(lvl(f, 'p', opt.moveId), lvl(f, 'o', ACTION_BY_ID[c.actionId].move));
  const action = ACTION_BY_ID[opt.actionId];
  return attackChance(action.kind, lvl(f, 'p', action.move), bestDefense(f, 'o', action));
}

// From blue belt on the player gets a gut feeling about which card to pick. It is not always right:
// it gets more reliable with the belt and with the level of the techniques on offer.
const HINT_BASE = { white: 0, blue: 0.55, purple: 0.7, brown: 0.82, black: 0.9 };
export function hintAccuracy(belt, avgLevel) {
  if (!HINT_BASE[belt]) return 0;
  return Math.min(0.97, HINT_BASE[belt] + 0.015 * Math.max(0, avgLevel - 1));
}

function giveHint(f, c) {
  const levels = c.options.map((o) => lvl(f, 'p', o.moveId)).filter((x) => x > 0);
  const avg = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 1;
  const accuracy = hintAccuracy(f.player.belt, avg);
  if (!accuracy) return null;
  const best = c.options.reduce((bi, o, i) => (optionChance(f, c, o) > optionChance(f, c, c.options[bi]) ? i : bi), 0);
  if (f.rng() < accuracy) return { index: best, accuracy };
  const others = c.options.map((_, i) => i).filter((i) => i !== best);
  return { index: others.length ? others[Math.floor(f.rng() * others.length)] : best, accuracy };
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
    if (!opt.correct) { say(f, `${opt.label} ovdje ne pomaže.`, 'p'); applyMistake(f, MISTAKES[opt.mistakeId], threat, true); return; }
    const mine = lvl(f, 'p', opt.moveId);
    const theirs = lvl(f, 'o', threat.move);
    Object.assign(f.lastResult, { myLevel: mine, theirLevel: theirs, theirMove: MOVE_BY_ID[threat.move].name });
    const p = defenseChance(mine, theirs) + bonus;
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
  if (!opt.correct) {
    const role = roleOf(f, 'p');
    say(f, `${opt.label} se ovdje radi ${ROLE_NAME[otherRole(role)]}, a ti si ${role === 'top' ? 'gore' : 'dolje'}.`, 'p');
    applyMistake(f, MISTAKES[opt.mistakeId], null);
    return;
  }
  const action = ACTION_BY_ID[opt.actionId];
  const mine = lvl(f, 'p', action.move);
  const theirs = bestDefense(f, 'o', action);
  const p = attackChance(action.kind, mine, theirs) + bonus;
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
    if (!f.quiet && f.clock >= f.nextExchange) {
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
