// Fight simulation. Works in game seconds; the UI converts real time with CLOCK_SPEED.
// Pure logic: the renderer only reads `pos`, `playerTop`, `critical`, `lastAction`.
import { MOVE_BY_ID, MOVE_CLASS } from '../data/moves.js';
import { POSITIONS, ACTION_BY_ID, MISTAKES, GENERIC_MISTAKES, actionsFor } from '../data/positions.js';
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
const KIND_LABEL = { takedown: 'takedown', sweep: 'sweep', pass: 'guard pass' };
const POSITION_LABEL = { kneeOnBelly: 'knee on belly', mount: 'mount', back: 'back' };

// Chance that a fighter botches a move: lower for higher belts and better-trained moves.
export function errorChance(belt, level) {
  return Math.max(0.02, BELT_ERROR[belt] * ERROR_PER_LEVEL ** Math.max(0, level - 1));
}

// Typical error chance of a fighter (belt and average level of known moves), shown before the fight.
export function fighterErrorChance(fighter) {
  const l = Object.values(fighter.levels).filter((x) => x > 0); // moves the fighter does not know are never tried
  const avg = l.length ? l.reduce((s, x) => s + x, 0) / l.length : 1;
  return errorChance(fighter.belt, avg);
}

export const pct = (p) => `${Math.round(p * 100)}%`;

// ---- strength and cardio ----
// Every attempt costs energy (0-100); good cardio makes it cheaper and helps recover between rounds.
// Below 50 energy a fighter gets tired: more errors, weaker attacks and defenses (up to 15 points at 0).
// Strength: every level of difference moves the chance of an attack or a defense by 3 points.
const STRENGTH_STEP = 0.03;
const ATTEMPT_COST = 2.5;
const SUB_COST = 3.5;
const ERROR_COST = 1;
const TIRED_AT = 50;
const FATIGUE_MAX = 0.15;
const strengthOf = (x) => x.strength ?? 1;
const cardioOf = (x) => x.cardio ?? 1;

export function fatigue(f, who) {
  return Math.max(0, TIRED_AT - f.energy[who]) / TIRED_AT * FATIGUE_MAX;
}

// Physical edge of `who` over the other fighter: strength difference and who is more tired.
function physicalEdge(f, who) {
  const them = other(who);
  return STRENGTH_STEP * (strengthOf(fighter(f, who)) - strengthOf(fighter(f, them))) - fatigue(f, who) + fatigue(f, them);
}

function spend(f, who, amount) {
  const before = f.energy[who];
  const cost = amount * (1.25 - 0.05 * cardioOf(fighter(f, who)));
  f.energy[who] = Math.max(0, before - cost);
  if (before >= TIRED_AT && f.energy[who] < TIRED_AT) say(f, subject(f, who, 'are starting to tire.', 'is starting to tire.'), who);
  if (before >= 20 && f.energy[who] < 20) say(f, subject(f, who, 'are exhausted!', 'is exhausted!'), who);
}
const KIND_WEIGHT = { sub: 0.4, sweep: 1.5, pass: 1.5, takedown: 1.5, transition: 1.2, escape: 2, pull: 0.3 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const other = (who) => (who === 'p' ? 'o' : 'p');

// `quiet: true` (tests only): no exchanges happen on their own.
// `coach: true` (your first sparring): the coach shouts the best card at every decision, always right.
export function createFight(player, opponent, rng, { quiet = false, coach = false } = {}) {
  const f = {
    rng, player, opponent, coach,
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
    energy: { p: 100, o: 100 },
  };
  say(f, `Mistake chance per move: ${player.name} ${pct(fighterErrorChance(player))}, ${opponent.name} ${pct(fighterErrorChance(opponent))} (belt and move level).`);
  say(f, `Strength: ${player.name} ${strengthOf(player)}, ${opponent.name} ${strengthOf(opponent)} · cardio: ${player.name} ${cardioOf(player)}, ${opponent.name} ${cardioOf(opponent)}.`);
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
  say(f, `+1 advantage: ${fighter(f, who).name} (${why})`, who);
}

// Best defense against `action`: the fighter's level in one of its defenses, or half of their own level in
// the same technique (who knows an armbar well sees it coming and knows how to get out of it).
const KNOW_THE_MOVE = 0.5;
function bestDefense(f, who, action) {
  const own = action.kind === 'sub' || action.defenses.length ? Math.floor(lvl(f, who, action.move) * KNOW_THE_MOVE) : 0;
  return action.defenses.reduce((best, d) => Math.max(best, lvl(f, who, d)), own);
}

// Sentence with a fighter as subject: "You are ..." for the player, "Marko is ..." for the opponent.
const subject = (f, who, you, them) => (who === 'p' ? `You ${you}` : `${fighter(f, who).name} ${them}`);

function finish(f, winner, method, detail) {
  f.ended = { winner, method, detail };
  f.critical = null;
  say(f, method === 'sub' ? subject(f, winner, `win by submission (${detail})!`, `wins by submission (${detail})!`) : `End of fight: ${subject(f, winner, 'win', 'wins')} (${detail}).`, winner);
}

export function applyTransition(f, who, kind, to, label = KIND_LABEL[kind]) {
  if (f.pending) {
    const lost = f.pending; // near-score that was not held
    f.pending = null;
    addAdvantage(f, lost.who, `${lost.why} not held for 3 s`);
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
    say(f, `${why}${parts.length > 1 ? ` = +${pts}` : ''} (points if held for ${HOLD_SECONDS} s)`, who);
  }
  f.seq += 1;
}

function runAction(f, who, action, success, why = '') {
  const move = MOVE_BY_ID[action.move];
  f.lastAction = { seq: ++f.seq, who, actionId: action.id, success };
  spend(f, who, action.kind === 'sub' ? SUB_COST : ATTEMPT_COST);
  if (!success) {
    say(f, `${fighter(f, who).name}: ${move.name} — fails${why ? ` (${why})` : ''}.`, who);
    if (action.kind !== 'pull' && f.rng() < 0.3) addAdvantage(f, who, `almost ${move.name}`);
    return;
  }
  if (action.kind === 'sub') {
    finish(f, who, 'sub', move.name);
    return;
  }
  say(f, `${fighter(f, who).name}: ${move.name}${lvl(f, who, action.move) ? '' : ' (no technique learned, on instinct)'}.`, who);
  applyTransition(f, who, action.kind, action.to, move.name);
}

function autoChance(f, who, action, bonus = 0) {
  const diff = lvl(f, who, action.move) - bestDefense(f, other(who), action);
  // A submission on its own rarely works between equals, but a much better-trained one usually does.
  const base = action.kind === 'sub' ? clamp(0.06 + 0.045 * diff, 0.02, 0.6) : clamp(0.6 + 0.07 * diff, 0.25, 0.9);
  return clamp(base + bonus + physicalEdge(f, who), 0.01, 0.97);
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
  say(f, `${f.opponent.name} slips: his ${move.name} doesn't land (mistake chance ${pct(chance)}).`, 'o');
  if (canCritical(f) && f.rng() < P_BLUNDER_CRITICAL
    && startOpportunity(f, `${f.opponent.name} botched the ${move.name}, punish him! ${whereText(f)[0].toUpperCase()}${whereText(f).slice(1)}, pick a move.`)) return;
  counter(f, 'p', move.name);
}

// After a botched move the other fighter goes straight into a positional attack (sweep, pass, takedown,
// escape...), with a small bonus. Submissions need a set-up, so they are not counters.
function counter(f, who, botched) {
  if (f.rng() >= P_COUNTER) return;
  const action = chooseAction(f, who, { noSubs: true });
  if (!action) { addAdvantage(f, who, `opponent's mistake: ${botched}`); return; }
  f.history.push({ who, actionId: action.id, error: false, counter: true });
  f.turn = other(who);
  say(f, subject(f, who, 'punish the mistake:', 'punishes the mistake:'), who);
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
  const err = Math.min(0.95, errorChance(fighter(f, who).belt, lvl(f, who, action.move)) + fatigue(f, who));
  if (f.rng() < err) {
    entry.error = true;
    spend(f, who, ATTEMPT_COST + ERROR_COST);
    if (who === 'o') { opponentBlunder(f, action, err); return; }
    f.lastAction = { seq: ++f.seq, who, actionId: action.id, success: false };
    say(f, `You: ${MOVE_BY_ID[action.move].name} — sloppy execution, fails (mistake chance ${pct(err)}).`, 'p');
    counter(f, 'o', MOVE_BY_ID[action.move].name);
    return;
  }
  if (who === 'o' && action.defenses.length && canCritical(f)
    && f.rng() < (action.kind === 'sub' ? P_SUB_CRITICAL : P_DEFENSE_CRITICAL) && startDefense(f, action.id)) return;
  if (who === 'p' && canCritical(f) && f.rng() < P_OPPORTUNITY_CRITICAL && startOpportunity(f)) return;
  autoAction(f, who, action);
}

function openCritical(f, critical) {
  f.critical = { ...critical, options: withLevel(f, critical.options), timeLimit: CRITICAL_TIME_LIMIT };
  f.critical.hint = giveHint(f, f.critical);
  say(f, `⚡ Decision: ${critical.text} [${critical.options.map((o) => `${o.label}${o.correct ? ' ✔' : ''}`).join(' | ')}]`);
  if (f.critical.hint?.coach) say(f, `🥋 Coach shouts from the edge: ${critical.options[f.critical.hint.index].label}!`, 'p');
  else if (f.critical.hint) say(f, `💭 Your gut says: ${critical.options[f.critical.hint.index].label} (gut reliability ${pct(f.critical.hint.accuracy)}).`, 'p');
  f.criticalCount += 1;
  f.lastCriticalAt = f.elapsed;
  f.seq += 1;
}

// Every option is a real technique. Wrong ones are techniques that do not work from this spot;
// choosing one triggers one of the situation's typical mistakes (`MISTAKES` effects).
const option = (moveId, extra) => ({ label: MOVE_BY_ID[moveId].name, detail: MOVE_BY_ID[moveId].desc, cls: MOVE_CLASS[moveId], moveId, ...extra });
const withLevel = (f, opts) => opts.map((o) => ({ ...o, level: lvl(f, 'p', o.moveId) }));

const known = (f, ids) => [...new Set(ids)].filter((id) => lvl(f, 'p', id) > 0);
const otherRole = (role) => (role === 'top' ? 'bottom' : role === 'bottom' ? 'top' : 'neutral');

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
function fillOptions(f, correct, decoyIds, mistakeIds, extraChoices = 0) {
  if (!correct.length || (!decoyIds.length && correct.length < 2 && !extraChoices)) return null;
  const effects = shuffle(f.rng, mistakeIds.length ? [...new Set(mistakeIds)] : GENERIC_MISTAKES);
  const wrong = shuffle(f.rng, decoyIds).slice(0, 5 - correct.length)
    .map((id, i) => option(id, { correct: false, mistakeId: effects[i % effects.length] }));
  return shuffle(f.rng, [...correct, ...wrong]);
}

const THREAT_TEXT = {
  sub: (m) => `goes for a ${m}!`, sweep: (m) => `tries a sweep (${m})!`, pass: (m) => `tries to pass the guard (${m})!`,
  takedown: (m) => `shoots for a takedown (${m})!`, transition: (m) => `moves to ${m}!`, escape: (m) => `tries to escape (${m})!`,
};

// The opponent attacks the player with `actionId`; the player must answer with a defense they know.
// Returns false (and changes nothing) when the player knows no defense or no other technique from that spot.
export function startDefense(f, actionId) {
  const action = ACTION_BY_ID[actionId];
  // Counters can come from a neighbouring position (e.g. an arm inside a butterfly guard → triangle).
  const role = action.from === 'standing' ? 'neutral' : action.role === 'top' ? 'bottom' : 'top';
  const correct = known(f, action.defenses).map((d) => option(d, { correct: true }));
  // The player's own attacks from this spot are counter-attacks: a real chance, but against the timing.
  const counters = actionsFor(action.from, role).filter((a) => COUNTER_KINDS.has(a.kind) && lvl(f, 'p', a.move) > 0 && !action.defenses.includes(a.move));
  const counterMoves = new Set(counters.map((a) => a.move));
  const decoys = defenseDecoys(f, action.from, role, action.defenses).filter((id) => !counterMoves.has(id));
  let options = fillOptions(f, correct, decoys, [...action.mistakes, ...GENERIC_MISTAKES], counters.length);
  if (options && counters.length) {
    // One counter-attack card: it takes a free slot, or replaces one of the wrong cards.
    const card = option(pick(f.rng, counters).move, { correct: false, counter: null });
    card.counter = counters.find((a) => a.move === card.moveId).id;
    const wrongAt = options.findIndex((o) => !o.correct);
    if (options.length < 5) options.push(card);
    else options[wrongAt] = card;
    options = shuffle(f.rng, options);
  }
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
  const unknown = who === 'o' && !def && action.defenses.length ? " — you don't know a defense" : '';
  const raw = lvl(f, who, action.move) ? '' : ', no technique learned';
  const sa = strengthOf(fighter(f, who)), sd = strengthOf(fighter(f, other(who)));
  const body = `${sa !== sd ? `, strength ${sa}:${sd}` : ''}${fatigue(f, who) > 0 ? ', tired' : ''}`;
  const why = `attack level ${lvl(f, who, action.move)} vs defense level ${def}${unknown}${raw}${body}, chance ${pct(chance)}`;
  runAction(f, who, action, f.rng() < chance, why);
}

// The opponent attacks; the player decides if they can, otherwise the attack plays out on levels.
function opponentAttack(f, action) {
  if (!startDefense(f, action.id)) autoAction(f, 'o', action);
}

// The player has a chance to attack from the current position. Returns false when no real attack is known,
// so a critical moment never consists of wrong answers only.
// Where the player is, in words: "you are on top (mount)", "you are on the bottom (back)", "standing".
export function whereText(f) {
  const role = roleOf(f, 'p');
  if (role === 'neutral') return 'standing';
  return `you are on ${role === 'top' ? 'top' : 'the bottom'} (${POSITIONS[f.pos].name.toLowerCase()})`;
}

// The player has a chance to act from the current position. The cards are exactly the techniques the
// player knows for this spot and role (up to 5): no wrong cards, the choice is which one has the best
// chance. With fewer than two known techniques there is nothing to choose, so it returns false.
export function startOpportunity(f, text = `Opportunity! ${whereText(f)[0].toUpperCase()}${whereText(f).slice(1)}. Pick a move.`) {
  const role = roleOf(f, 'p');
  const known = shuffle(f.rng, actionsFor(f.pos, role).filter((a) => lvl(f, 'p', a.move) > 0 && a.kind !== 'pull'));
  if (known.length < 2) return false;
  const options = known.slice(0, 5).map((a) => option(a.move, { correct: true, actionId: a.id }));
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
        say(f, `The ${MOVE_BY_ID[threatAction.move].name} was deep, but you got out at the last moment.`, 'p');
        addAdvantage(f, 'o', `almost ${MOVE_BY_ID[threatAction.move].name}`);
        escapeAfterDefense(f);
      } else if (threatAction) runAction(f, 'o', threatAction, true);
      else addAdvantage(f, 'o', 'you did not react');
      return;
    case 'pos':
      say(f, `${f.opponent.name} takes advantage.`, 'o');
      applyTransition(f, 'o', mk.kind, { pos: mk.to.pos, actorTop: !mk.to.selfTop });
      return;
    case 'counter':
      opponentAttack(f, ACTION_BY_ID[mk.counterAction]);
      return;
    case 'penalty':
      f.score.p.pen += 1;
      say(f, 'The referee gives you a penalty (+1 penalty).', 'o');
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
    say(f, 'You escaped to half guard.', 'p');
    applyTransition(f, 'p', 'escape', { pos: 'halfGuard', actorTop: false });
  }
}

const defenseChance = (mine, theirs) => clamp(0.8 + 0.05 * (mine - theirs), 0.5, 0.97);
// A chosen submission: 25% between equals, 7 points per level of difference (level 10 against no defense: 95%).
const attackChance = (kind, mine, theirs) => (kind === 'sub' ? clamp(0.25 + 0.07 * (mine - theirs), 0.08, 0.95) : clamp(0.6 + 0.06 * (mine - theirs), 0.25, 0.92));
// A counter-attack thrown while the opponent is moving: like the attack, but the timing makes it harder.
const COUNTER_TIMING = 0.6;
// Only attacks can be counters; running away (an escape) while caught stays a wrong answer.
const COUNTER_KINDS = new Set(['sub', 'sweep', 'pass', 'transition', 'takedown']);

// Chance that a right option works, so the hint can point at the best one.
function optionChance(f, c, opt) {
  if (opt.counter) {
    const a = ACTION_BY_ID[opt.counter];
    return attackChance(a.kind, lvl(f, 'p', a.move), bestDefense(f, 'o', a)) * COUNTER_TIMING;
  }
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

function bestOption(f, c) {
  return c.options.reduce((bi, o, i) => (optionChance(f, c, o) > optionChance(f, c, c.options[bi]) ? i : bi), 0);
}

function giveHint(f, c) {
  if (f.coach) return { index: bestOption(f, c), accuracy: 1, coach: true };
  const levels = c.options.map((o) => lvl(f, 'p', o.moveId)).filter((x) => x > 0);
  const avg = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 1;
  const accuracy = hintAccuracy(f.player.belt, avg);
  if (!accuracy) return null;
  const best = bestOption(f, c);
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
  say(f, opt ? `Your choice: ${opt.label}${fast ? ' (fast, +10%)' : ''}` : 'Your choice: nothing (time ran out)', 'p');
  if (c.kind === 'defense') {
    const threat = ACTION_BY_ID[c.actionId];
    if (!opt) { say(f, "You didn't react in time!", 'o'); applyMistake(f, { effect: 'threat' }, threat); return; }
    if (opt.counter) {
      // Counter-attack: if it works the player's technique happens instead; if not, the opponent's goes through.
      const action = ACTION_BY_ID[opt.counter];
      const mine = lvl(f, 'p', action.move);
      const theirs = bestDefense(f, 'o', action);
      const p = clamp(attackChance(action.kind, mine, theirs) * COUNTER_TIMING + bonus + physicalEdge(f, 'p'), 0.02, 0.95);
      const success = f.rng() < p;
      Object.assign(f.lastResult, { counter: true, success, myLevel: mine, theirLevel: theirs, chance: Math.min(1, p) });
      if (success) {
        say(f, `Counter! ${f.opponent.name} goes for the ${MOVE_BY_ID[threat.move].name}, you catch him with a ${MOVE_BY_ID[action.move].name} (level ${mine} vs ${theirs}, counter chance ${pct(p)}).`, 'p');
        runAction(f, 'p', action, true);
      } else {
        say(f, `The counter comes too late: your ${MOVE_BY_ID[action.move].name} (level ${mine} vs ${theirs}, counter chance ${pct(p)}) misses and ${f.opponent.name} goes through.`, 'o');
        runAction(f, 'o', threat, true);
      }
      return;
    }
    if (!opt.correct) { say(f, `${opt.label} doesn't help here.`, 'p'); applyMistake(f, MISTAKES[opt.mistakeId], threat, true); return; }
    const mine = lvl(f, 'p', opt.moveId);
    const theirs = lvl(f, 'o', threat.move);
    Object.assign(f.lastResult, { myLevel: mine, theirLevel: theirs, theirMove: MOVE_BY_ID[threat.move].name });
    const p = clamp(defenseChance(mine, theirs) + bonus + physicalEdge(f, 'p'), 0.05, 0.99);
    f.lastResult.chance = Math.min(1, p);
    if (f.rng() < p) {
      f.lastResult.success = true;
      f.lastAction = { seq: ++f.seq, who: 'o', actionId: threat.id, success: false };
      say(f, `${MOVE_BY_ID[opt.moveId].name} — you defended!`, 'p');
      if (threat.kind === 'sub') escapeAfterDefense(f);
    } else if (threat.kind === 'sub' && f.rng() < 0.65) {
      f.lastResult.success = true;
      say(f, `Close one! ${f.opponent.name} is better (level ${theirs} vs your ${mine}, defense chance was ${pct(p)}), but you got out.`, 'p');
      addAdvantage(f, 'o', `almost ${MOVE_BY_ID[threat.move].name}`);
      escapeAfterDefense(f);
    } else {
      f.lastResult.success = false;
      say(f, `Good choice, but ${f.opponent.name} overpowered you: ${MOVE_BY_ID[threat.move].name} level ${theirs} vs your defense level ${mine} (defense chance was ${pct(p)}).`, 'o');
      runAction(f, 'o', threat, true);
    }
    return;
  }
  // opportunity
  if (!opt) { say(f, 'You missed the chance.', 'p'); return; }
  const action = ACTION_BY_ID[opt.actionId];
  const mine = lvl(f, 'p', action.move);
  const theirs = bestDefense(f, 'o', action);
  const p = clamp(attackChance(action.kind, mine, theirs) + bonus + physicalEdge(f, 'p'), 0.02, 0.97);
  const success = f.rng() < p;
  Object.assign(f.lastResult, { success, myLevel: mine, theirLevel: theirs, chance: Math.min(1, p) });
  if (!success) say(f, `Good choice, but ${f.opponent.name} overpowered you: your ${MOVE_BY_ID[action.move].name} level ${mine} vs his defense level ${theirs} (chance was ${pct(p)}).`, 'o');
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
    for (const w of ['p', 'o']) f.energy[w] = Math.min(100, f.energy[w] + 20 + 2 * cardioOf(fighter(f, w)));
    say(f, `Round ${f.round}! Energy: ${f.player.name} ${Math.round(f.energy.p)}, ${f.opponent.name} ${Math.round(f.energy.o)}.`);
    return;
  }
  const { p, o } = f.score;
  if (p.pts !== o.pts) finish(f, p.pts > o.pts ? 'p' : 'o', 'points', 'points');
  else if (p.adv !== o.adv) finish(f, p.adv > o.adv ? 'p' : 'o', 'points', 'advantages');
  else if (p.pen !== o.pen) finish(f, p.pen < o.pen ? 'p' : 'o', 'points', 'penalties');
  else finish(f, f.rng() < 0.5 ? 'p' : 'o', 'decision', "referee's decision");
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
      say(f, `+${f.pending.pts} points: ${fighter(f, f.pending.who).name} (${f.pending.why})`, f.pending.who);
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
    `Points ${p.pts}:${o.pts} · advantages ${p.adv}:${o.adv} · penalties ${p.pen}:${o.pen}`,
    f.ended ? `Result: ${f.ended.winner === 'p' ? 'win' : 'loss'} (${f.ended.method}, ${f.ended.detail})` : 'Fight in progress',
    '',
  ];
  return [...head, ...f.log.map(logLine)].join('\n');
}
