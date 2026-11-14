import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFight, stepFight, chooseOption, applyTransition, startDefense, startOpportunity,
  ROUND_SECONDS, ROUNDS, CLOCK_SPEED, CRITICAL_TIME_LIMIT,
} from '../src/engine/fight.js';
import { makeOpponent, fighterFromState } from '../src/engine/opponent.js';
import { createState } from '../src/engine/progression.js';
import { ACTIONS, ACTION_BY_ID, OPPORTUNITY_MISTAKES, MISTAKES } from '../src/data/positions.js';
import { mulberry32 } from '../src/engine/rng.js';

const empty = (name) => ({ name, belt: 'white', levels: {} });
// The player knows every technique at level 1 (as with "sve otključano"), plus any given levels.
const kit = (levels = {}) => ({ name: 'Ti', belt: 'white', levels: { ...Object.fromEntries(ACTIONS.flatMap((a) => [a.move, ...a.defenses]).map((id) => [id, 1])), ...levels } });
const idle = (seed = 1) => createFight(kit(), empty('On'), mulberry32(seed), { quiet: true });
const quiet = (seed = 1) => createFight(empty('Ti'), empty('On'), mulberry32(seed), { quiet: true }); // nobody acts

test('constants match the spec', () => {
  assert.equal(ROUND_SECONDS, 180);
  assert.equal(ROUNDS, 3);
  assert.equal(CLOCK_SPEED, 3);
});

test('a critical moment gives 20 real seconds to read five options and choose', () => {
  assert.equal(CRITICAL_TIME_LIMIT, 20);
  const f = idle();
  f.pos = 'mount'; f.playerTop = false;
  startDefense(f, 'armbar_m');
  assert.equal(f.critical.timeLimit, 20);
});

test('points are awarded only after holding the position for 3 seconds', () => {
  const f = idle();
  applyTransition(f, 'p', 'sweep', { pos: 'mount', actorTop: true });
  stepFight(f, 2.9);
  assert.equal(f.score.p.pts, 0);
  stepFight(f, 0.2);
  assert.equal(f.score.p.pts, 6); // sweep 2 + mount 4
});

test('losing the position before 3 seconds cancels the points', () => {
  const f = idle();
  applyTransition(f, 'p', 'pass', { pos: 'sideControl', actorTop: true });
  stepFight(f, 1);
  applyTransition(f, 'o', 'escape', { pos: 'closedGuard', actorTop: false });
  stepFight(f, 5);
  assert.equal(f.score.p.pts, 0);
  assert.equal(f.score.o.pts, 0);
});

test('takedown scores 2 and knee on belly scores 2', () => {
  const f = idle();
  applyTransition(f, 'o', 'takedown', { pos: 'halfGuard', actorTop: true });
  stepFight(f, 3.1);
  assert.equal(f.score.o.pts, 2);
  applyTransition(f, 'o', 'pass', { pos: 'sideControl', actorTop: true });
  stepFight(f, 3.1);
  applyTransition(f, 'o', 'transition', { pos: 'kneeOnBelly', actorTop: true });
  stepFight(f, 3.1);
  assert.equal(f.score.o.pts, 2 + 3 + 2);
});

test('choosing a wrong option against a submission ends the fight by submission', () => {
  const f = idle();
  f.pos = 'back'; f.playerTop = false;
  startDefense(f, 'rnc_b');
  const wrong = f.critical.options.findIndex((o) => !o.correct);
  f.rng = () => 0; // the choke lands
  chooseOption(f, wrong);
  assert.deepEqual([f.ended.winner, f.ended.method], ['o', 'sub']);
});

test('no answer in time against a submission is a tap', () => {
  const f = idle();
  f.pos = 'mount'; f.playerTop = false;
  startDefense(f, 'armbar_m');
  chooseOption(f, null);
  assert.deepEqual([f.ended.winner, f.ended.method], ['o', 'sub']);
});

test('a successful player submission from an opportunity wins', () => {
  const f = createFight(kit({ armbar: 10 }), empty('On'), () => 0);
  f.pos = 'mount'; f.playerTop = true;
  startOpportunity(f);
  const idx = f.critical.options.findIndex((o) => o.actionId === 'armbar_m');
  assert.ok(idx >= 0);
  chooseOption(f, idx);
  assert.deepEqual([f.ended.winner, f.ended.method], ['p', 'sub']);
});

test('every defense offers 2 to 5 options with a right and a wrong one; an opportunity, when it opens, at least one right', () => {
  const everything = kit().levels;
  for (const a of ACTIONS.filter((x) => x.defenses.length)) {
    const f = createFight({ name: 'Ti', belt: 'white', levels: everything }, { name: 'On', belt: 'white', levels: everything }, mulberry32(7));
    f.pos = a.from; f.playerTop = a.role === 'bottom';
    startDefense(f, a.id);
    const o = f.critical.options;
    assert.ok(o.length >= 2 && o.length <= 5, a.id);
    assert.ok(o.some((x) => x.correct) && o.some((x) => !x.correct), a.id);
  }
  const opened = [];
  for (const key of Object.keys(OPPORTUNITY_MISTAKES)) {
    const [pos, role] = key.split(':');
    const f = createFight({ name: 'Ti', belt: 'white', levels: everything }, empty('On'), mulberry32(3));
    f.pos = pos; f.playerTop = role === 'neutral' ? null : role === 'top';
    if (!startOpportunity(f)) { opened.push(key); continue; }
    const o = f.critical.options;
    assert.ok(o.length >= 2 && o.length <= 5, key);
    assert.ok(o.some((x) => x.correct), key);
  }
  // No decision where the player has only one technique for the spot (e.g. only the rear naked choke from the back).
  const single = Object.keys(OPPORTUNITY_MISTAKES).filter((k) => { const [p, r] = k.split(':'); return actionsFor(p, r).filter((a) => a.kind !== 'pull').length < 2; });
  assert.deepEqual(opened, single);
});

test('a round ends exactly at 180 s even with a huge step, and the fight ends after round 3', () => {
  const f = quiet();
  stepFight(f, 170);
  stepFight(f, 30);
  assert.equal(f.round, 2);
  assert.equal(f.clock, 0);
  stepFight(f, 1000);
  stepFight(f, 1000);
  assert.equal(f.ended.method, 'decision');
});

test('after 3 rounds the winner is decided by points, then advantages, then penalties', () => {
  const run = (p, o) => {
    const f = quiet();
    f.score.p = p; f.score.o = o;
    for (let i = 0; i < 3; i++) stepFight(f, 200);
    return f.ended;
  };
  assert.deepEqual(run({ pts: 2, adv: 0, pen: 0 }, { pts: 0, adv: 5, pen: 0 }), { winner: 'p', method: 'points', detail: 'bodovi' });
  assert.equal(run({ pts: 2, adv: 1, pen: 0 }, { pts: 2, adv: 2, pen: 0 }).winner, 'o');
  assert.equal(run({ pts: 2, adv: 1, pen: 1 }, { pts: 2, adv: 1, pen: 0 }).winner, 'o');
});

test('stepFight does not advance while a critical moment is open', () => {
  const f = idle();
  f.pos = 'mount'; f.playerTop = false;
  startDefense(f, 'armbar_m');
  stepFight(f, 10);
  assert.equal(f.clock, 0);
});

function simulate(seed, chooser) {
  const rng = mulberry32(seed);
  const s = { ...createState({ test: true, now: 0 }), unlockAll: true };
  const f = createFight(fighterFromState(s), makeOpponent('white', rng), rng);
  let guard = 0;
  while (!f.ended && guard++ < 10_000) {
    if (f.critical) chooseOption(f, chooser(f, rng));
    else stepFight(f, 1);
  }
  assert.ok(f.ended, 'fight finished');
  return f;
}

test('a good player sees about 4-8 critical moments per fight', () => {
  const good = (f, rng) => {
    const right = f.critical.options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);
    return right[Math.floor(rng() * right.length)];
  };
  let total = 0;
  for (let i = 0; i < 200; i++) total += simulate(i + 1, good).criticalCount;
  const avg = total / 200;
  assert.ok(avg >= 4 && avg <= 8, `average ${avg}`);
});

test('random choices always reach a result', () => {
  for (let i = 0; i < 100; i++) simulate(1000 + i, (f, rng) => Math.floor(rng() * 5));
});

test('no opportunity opens when the only known move is guard pull', () => {
  const f = createFight({ name: 'Ti', belt: 'white', levels: { guardPull: 3 } }, empty('On'), mulberry32(5));
  assert.equal(startOpportunity(f), false);
  assert.equal(f.critical, null);
  for (let i = 0; i < 50 && !f.ended; i++) {
    stepFight(f, 10);
    if (f.critical) assert.ok(f.critical.options.some((o) => o.correct));
  }
});

// ---- feedback round 2 ----
import { MOVES, MOVE_BY_ID, MOVE_CLASS } from '../src/data/moves.js';
import { actionsFor } from '../src/data/positions.js';

test('a defended submission from a bad spot escapes to half guard and stops sub attacks for 20 s', () => {
  const opp = { name: 'On', belt: 'white', levels: { armbar: 3, americana: 3, darce: 3, kimura: 3 } };
  const f = createFight(kit({ armbarDefense: 10 }), opp, mulberry32(11));
  f.pos = 'mount'; f.playerTop = false;
  startDefense(f, 'armbar_m');
  const right = f.critical.options.findIndex((o) => o.correct);
  f.rng = () => 0.01; // defense succeeds
  chooseOption(f, right);
  assert.equal(f.ended, null);
  assert.equal(f.pos, 'halfGuard');
  assert.equal(f.playerTop, false);
  f.rng = mulberry32(12);
  const start = f.elapsed;
  while (f.elapsed - start < 19 && !f.ended) {
    stepFight(f, 0.5);
    if (f.critical) {
      assert.notEqual(f.critical.kind === 'defense' && ACTION_BY_ID[f.critical.actionId].kind, 'sub');
      chooseOption(f, f.critical.options.findIndex((o) => o.correct));
    }
  }
});

const nameSet = new Set(MOVES.map((m) => m.name));
const usableBy = (pos, role) => new Set(actionsFor(pos, role).map((a) => a.move));

test('every option in a critical moment is a real technique name', () => {
  const everything = Object.fromEntries(MOVES.map((m) => [m.id, 3]));
  for (const a of ACTIONS.filter((x) => x.defenses.length)) {
    const f = createFight({ name: 'Ti', belt: 'white', levels: everything }, { name: 'On', belt: 'white', levels: everything }, mulberry32(9));
    f.pos = a.from; f.playerTop = a.role === 'bottom';
    startDefense(f, a.id);
    for (const o of f.critical.options) {
      assert.ok(nameSet.has(o.label), `${a.id}: "${o.label}"`);
      assert.ok(MOVE_BY_ID[o.moveId], a.id);
    }
  }
  for (const key of Object.keys(OPPORTUNITY_MISTAKES)) {
    const [pos, role] = key.split(':');
    const f = createFight({ name: 'Ti', belt: 'white', levels: everything }, empty('On'), mulberry32(4));
    f.pos = pos; f.playerTop = role === 'neutral' ? null : role === 'top';
    if (!startOpportunity(f)) continue;
    for (const o of f.critical.options) assert.ok(nameSet.has(o.label), `${key}: "${o.label}"`);
  }
});

test('wrong technique options are not usable by the player from that spot', () => {
  const everything = Object.fromEntries(MOVES.map((m) => [m.id, 3]));
  for (const key of Object.keys(OPPORTUNITY_MISTAKES)) {
    const [pos, role] = key.split(':');
    for (let seed = 1; seed < 6; seed++) {
      const f = createFight({ name: 'Ti', belt: 'white', levels: everything }, empty('On'), mulberry32(seed));
      f.pos = pos; f.playerTop = role === 'neutral' ? null : role === 'top';
      if (!startOpportunity(f)) continue;
      const ok = usableBy(pos, role);
      for (const o of f.critical.options.filter((x) => !x.correct)) assert.ok(!ok.has(o.moveId), `${key}: ${o.moveId}`);
    }
  }
});

test('a decent player (right 75 % of the time) wins about half of balanced sparring fights or more', () => {
  let wins = 0;
  const N = 300;
  for (let i = 0; i < N; i++) {
    const rng = mulberry32(5000 + i);
    const s = { ...createState({ test: true, now: 0 }), unlockAll: true };
    const f = createFight(fighterFromState(s), makeOpponent('white', rng, 1, 0.8, 1), rng);
    while (!f.ended) {
      if (f.critical) {
        const o = f.critical.options;
        const right = o.map((x, k) => (x.correct ? k : -1)).filter((k) => k >= 0);
        const wrong = o.map((x, k) => (x.correct ? -1 : k)).filter((k) => k >= 0);
        chooseOption(f, rng() < 0.75 ? right[0] : wrong[0]);
      } else stepFight(f, 1);
    }
    if (f.ended.winner === 'p') wins++;
  }
  assert.ok(wins / N >= 0.4 && wins / N <= 0.8, `win rate ${wins / N}`);
});

// ---- round 2, step 1 ----
import { errorChance, formatLog, opponentBlunder } from '../src/engine/fight.js';

test('error chance depends on belt and move level', () => {
  assert.equal(errorChance('white', 1), 0.6);
  assert.ok(Math.abs(errorChance('blue', 3) - 0.42 * 0.88 ** 2) < 1e-9);
  assert.ok(errorChance('white', 5) < errorChance('white', 1) && errorChance('white', 5) > 0.3);
  assert.equal(errorChance('black', 10), 0.02);
});

test('initiative strictly alternates between the fighters', () => {
  let longest = 0;
  for (let seed = 77; seed < 87; seed++) {
    const rng = mulberry32(seed);
    const s = { ...createState({ test: true, now: 0 }), unlockAll: true };
    const f = createFight(fighterFromState(s), makeOpponent('white', rng, 1, 0.8, 1), rng);
    while (!f.ended && f.elapsed < 300) {
      if (f.critical) chooseOption(f, f.critical.options.findIndex((o) => o.correct));
      else stepFight(f, 1);
    }
    longest = Math.max(longest, f.history.length);
    for (let i = 1; i < f.history.length; i++) assert.notEqual(f.history[i].who, f.history[i - 1].who, `seed ${seed} turn ${i}`);
  }
  assert.ok(longest > 10);
});

test('an opponent blunder gives the player a chance', () => {
  const f = createFight({ name: 'Ti', belt: 'white', levels: { sideToMount: 2, sideToKob: 2 } }, { name: 'On', belt: 'white', levels: { sideShrimp: 1 } }, mulberry32(2));
  f.pos = 'sideControl'; f.playerTop = true;
  f.rng = () => 0; // this blunder becomes a decision
  opponentBlunder(f, ACTION_BY_ID.sideShrimp_e);
  assert.equal(f.critical.kind, 'opportunity');
  assert.match(f.critical.text, /zeznuo Shrimp.*kazni ga! Ti si gore \(side control\), izaberi potez/);
});

test('an opponent blunder the player cannot decide on is punished right away, even on instinct', () => {
  const f = createFight(empty('Ti'), { name: 'On', belt: 'white', levels: { sideShrimp: 1 } }, mulberry32(2), { quiet: true });
  f.pos = 'sideControl'; f.playerTop = true;
  f.rng = () => 0.1; // decision would open, counter happens and lands
  opponentBlunder(f, ACTION_BY_ID.sideShrimp_e);
  assert.equal(f.critical, null);
  assert.ok(f.log.some((l) => /Ti kažnjava grešku/.test(l.text)));
  assert.ok(f.log.some((l) => /bez naučene tehnike/.test(l.text)));
});

test('a fighter with no move from a position still acts, so a round never freezes', () => {
  const f = createFight(empty('Ti'), empty('On'), mulberry32(4));
  f.pos = 'mount'; f.playerTop = false;
  stepFight(f, 60);
  assert.ok(f.history.filter((h) => h.actionId).length > 5);
});

test('the player decides in about 7 % of exchanges', () => {
  let crit = 0, ex = 0;
  for (let i = 0; i < 150; i++) {
    const rng = mulberry32(300 + i);
    const s = { ...createState({ test: true, now: 0 }), unlockAll: true };
    const f = createFight(fighterFromState(s), makeOpponent('white', rng, 1, 0.8, 1), rng);
    while (!f.ended) {
      if (f.critical) chooseOption(f, f.critical.options.findIndex((o) => o.correct));
      else stepFight(f, 1);
    }
    crit += f.criticalCount; ex += f.history.length;
  }
  assert.ok(crit / ex >= 0.04 && crit / ex <= 0.12, `share ${crit / ex}`);
});

test('the log spells out how points add up and carries round and clock', () => {
  const f = idle();
  applyTransition(f, 'p', 'sweep', { pos: 'mount', actorTop: true }, 'Flower sweep');
  stepFight(f, 3.1);
  const announced = f.log.find((l) => l.text.includes('= +6'));
  assert.match(announced.text, /Flower sweep \+2, mount \+4 = \+6/);
  const line = f.log.find((l) => l.text.startsWith('+6 boda'));
  assert.ok(line, 'points line');
  assert.match(line.text, /Flower sweep \+2, mount \+4/);
  assert.equal(line.round, 1);
  assert.match(formatLog(f), /R1 \d:\d\d .*\+6/);
});

test('a fast answer adds 10 percentage points', () => {
  const setup = () => {
    const f = createFight(kit({ armbarDefense: 1 }), { name: 'On', belt: 'white', levels: { armbar: 1 } }, mulberry32(1));
    f.pos = 'mount'; f.playerTop = false;
    startDefense(f, 'armbar_m');
    f.rng = () => 0.85; // base chance at equal levels is 0.8
    return f;
  };
  const slow = setup();
  chooseOption(slow, slow.critical.options.findIndex((o) => o.correct));
  assert.equal(slow.lastResult.success, false);
  const fast = setup();
  chooseOption(fast, fast.critical.options.findIndex((o) => o.correct), { fast: true });
  assert.equal(fast.lastResult.success, true);
});

test('every option carries a class colour group', () => {
  const f = createFight(kit({ armbar: 3 }), empty('On'), mulberry32(1));
  f.pos = 'mount'; f.playerTop = true;
  startOpportunity(f);
  for (const o of f.critical.options) assert.ok(['napad', 'obrana', 'sweep'].includes(o.cls), o.label);
});

// ---- opponent mistakes and precise log ----
import { fighterErrorChance } from '../src/engine/fight.js';

test('the fight log opens with both fighters\' error chance in percent', () => {
  const f = createFight({ name: 'Ti', belt: 'white', levels: { mount: 1 } }, { name: 'On', belt: 'purple', levels: { mount: 3 } }, mulberry32(1));
  assert.ok(Math.abs(fighterErrorChance(f.opponent) - 0.25 * 0.88 ** 2) < 1e-9);
  assert.match(f.log[0].text, /Ti 60 %, On 19 %/);
});

test('an opponent blunder says how likely it was', () => {
  const f = createFight(empty('Ti'), { name: 'On', belt: 'blue', levels: { sideShrimp: 1 } }, mulberry32(2));
  f.pos = 'sideControl'; f.playerTop = true;
  opponentBlunder(f, ACTION_BY_ID.sideShrimp_e);
  assert.ok(f.log.some((l) => /On griješi: .*šansa greške 42 %/.test(l.text)));
});

test('when the opponent overpowers a good choice the log gives levels and the chance', () => {
  let seen = false;
  for (let seed = 1; seed < 400 && !seen; seed++) {
    const rng = mulberry32(seed);
    const s = { ...createState({ test: true, now: 0 }), unlockAll: true };
    const f = createFight(fighterFromState(s), makeOpponent('white', rng, 4), rng);
    while (!f.ended && !seen) {
      if (f.critical) chooseOption(f, f.critical.options.findIndex((o) => o.correct));
      else stepFight(f, 1);
      seen = f.log.some((l) => /nadjača.*razina \d+ protiv .*razine \d+ \(šansa .*\d+ %\)/.test(l.text));
    }
  }
  assert.ok(seen);
});

// ---- options follow the position and the player's known moves ----
test('options only offer moves the player has learned', () => {
  const lv = { armbarDefense: 2, shrimp: 1, elbowKnee: 1 };
  const f = createFight({ name: 'Ti', belt: 'white', levels: lv }, empty('On'), mulberry32(3));
  f.pos = 'mount'; f.playerTop = false;
  assert.ok(startDefense(f, 'armbar_m'));
  for (const o of f.critical.options) assert.ok(lv[o.moveId] > 0, o.moveId);
});

test('without a known defense there is no decision and the attack plays out on levels', () => {
  const f = createFight({ name: 'Ti', belt: 'white', levels: { shrimp: 1 } }, empty('On'), mulberry32(3));
  f.pos = 'mount'; f.playerTop = false;
  assert.equal(startDefense(f, 'armbar_m'), false);
  assert.equal(f.critical, null);
});

test('standing techniques are never offered on the ground and ground ones never while standing', () => {
  const everything = Object.fromEntries(MOVES.map((m) => [m.id, 3]));
  const standingMoves = new Set(actionsFor('standing', 'neutral').flatMap((a) => [a.move, ...a.defenses]));
  const groundOnly = new Set(ACTIONS.filter((a) => a.from !== 'standing').map((a) => a.move).filter((m) => !standingMoves.has(m)));
  for (const key of Object.keys(OPPORTUNITY_MISTAKES)) {
    const [pos, role] = key.split(':');
    for (let seed = 1; seed < 6; seed++) {
      const f = createFight({ name: 'Ti', belt: 'white', levels: everything }, empty('On'), mulberry32(seed));
      f.pos = pos; f.playerTop = role === 'neutral' ? null : role === 'top';
      if (!startOpportunity(f)) continue;
      for (const o of f.critical.options) {
        if (pos === 'standing') assert.ok(!groundOnly.has(o.moveId), `${key}: ${o.moveId}`);
        else assert.ok(!['doubleLeg', 'singleLeg', 'guardPull', 'sprawl'].includes(o.moveId), `${key}: ${o.moveId}`);
      }
    }
  }
});

// ---- competition pace ----
test('a wrong answer to a submission is sometimes survived, with an advantage for the attacker', () => {
  const f = idle();
  f.pos = 'mount'; f.playerTop = false;
  startDefense(f, 'armbar_m');
  f.rng = () => 0.99; // the submission does not land this time
  chooseOption(f, f.critical.options.findIndex((o) => !o.correct && MISTAKES[o.mistakeId].effect === 'threat'));
  assert.equal(f.ended, null);
  assert.equal(f.score.o.adv, 1);
});

test('most automatic exchanges between equal fighters go through', () => {
  let ok = 0, all = 0;
  for (let i = 0; i < 100; i++) {
    const f = simulate(4000 + i, (g) => g.critical.options.findIndex((o) => o.correct));
    for (const l of f.log) {
      if (/ne prolazi \(napad/.test(l.text)) all++;
      else if (/^(Ti|\S+ \S+): [^—]+\.$/.test(l.text)) { ok++; all++; }
    }
  }
  assert.ok(ok / all >= 0.5, `success share ${ok / all}`);
});

// ---- gut feeling (hint) from blue belt on ----
import { hintAccuracy } from '../src/engine/fight.js';

test('a white belt gets no hint, from blue belt on the hint gets more reliable with belt and level', () => {
  assert.equal(hintAccuracy('white', 10), 0);
  assert.ok(hintAccuracy('blue', 1) > 0.5 && hintAccuracy('blue', 1) < 0.6);
  assert.ok(hintAccuracy('blue', 5) > hintAccuracy('blue', 1));
  assert.ok(hintAccuracy('purple', 1) > hintAccuracy('blue', 5));
  assert.ok(hintAccuracy('black', 10) <= 0.97);
});

test('the hint points at the best right option when it is right, and is missing for a white belt', () => {
  const white = createFight(kit(), empty('On'), () => 0, { quiet: true });
  white.pos = 'mount'; white.playerTop = false;
  startDefense(white, 'armbar_m');
  assert.equal(white.critical.hint, null);
  const blue = createFight({ ...kit({ armbarDefense: 6 }), belt: 'blue' }, { name: 'On', belt: 'white', levels: { armbar: 1 } }, () => 0, { quiet: true });
  blue.pos = 'mount'; blue.playerTop = false;
  startDefense(blue, 'armbar_m');
  const h = blue.critical.hint;
  assert.equal(blue.critical.options[h.index].moveId, 'armbarDefense');
  assert.ok(blue.log.some((l) => /Osjećaj ti govori: Obrana od armbara/.test(l.text)));
});

test('an opportunity offers only the techniques the player knows for that spot and role, each with its level', () => {
  const f = createFight(kit({ armbar: 7 }), empty('On'), mulberry32(5), { quiet: true });
  f.pos = 'mount'; f.playerTop = true;
  assert.ok(startOpportunity(f));
  const mine = new Set(actionsFor('mount', 'top').map((a) => a.move));
  for (const o of f.critical.options) {
    assert.ok(o.correct && mine.has(o.moveId), o.moveId);
    assert.equal(o.level, o.moveId === 'armbar' ? 7 : 1);
  }
  assert.match(f.critical.text, /Ti si gore \(mount\)/);
});

test('sweeps have their own card colour', () => {
  assert.equal(MOVE_CLASS.scissor, 'sweep');
  assert.equal(MOVE_CLASS.armbar, 'napad');
  assert.equal(MOVE_CLASS.armbarDefense, 'obrana');
  assert.equal(MOVE_CLASS.closedGuard, 'obrana');
});

import { makeCompetitor } from '../src/engine/opponent.js';

test('competition opponents have the skill of their belt, not of the player', () => {
  const avg = (o) => { const l = Object.values(o.levels); return l.reduce((a, b) => a + b, 0) / l.length; };
  const rng = mulberry32(9);
  const white = Array.from({ length: 30 }, () => avg(makeCompetitor('white', 0, rng)));
  const whiteFinal = Array.from({ length: 30 }, () => avg(makeCompetitor('white', 2, rng)));
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(mean(white) > 1.5 && mean(white) < 2.6, `white ${mean(white)}`);
  assert.ok(mean(whiteFinal) > mean(white));
});

test('a white belt with maxed techniques beats white-belt competitors most of the time', () => {
  let wins = 0;
  const N = 100;
  for (let i = 0; i < N; i++) {
    const rng = mulberry32(7000 + i);
    const me = { name: 'Ti', belt: 'white', levels: Object.fromEntries(MOVES.filter((m) => m.belt === 'white').map((m) => [m.id, 9])) };
    const f = createFight(me, makeCompetitor('white', i % 3, rng), rng);
    while (!f.ended) {
      if (f.critical) chooseOption(f, f.critical.options.findIndex((o) => o.correct));
      else stepFight(f, 1);
    }
    if (f.ended.winner === 'p') wins++;
  }
  assert.ok(wins / N >= 0.75, `win rate ${wins / N}`);
});

// ---- strength and cardio ----
import { fatigue } from '../src/engine/fight.js';

test('strength moves the chance of a chosen attack by 3 points per level of difference', () => {
  const chance = (sp, so) => {
    const f = createFight({ ...kit({ armbar: 3 }), strength: sp }, { name: 'On', belt: 'white', levels: {}, strength: so }, () => 0.99, { quiet: true });
    f.pos = 'mount'; f.playerTop = true;
    startOpportunity(f);
    chooseOption(f, f.critical.options.findIndex((o) => o.moveId === 'armbar'));
    return f.lastResult.chance;
  };
  assert.ok(Math.abs(chance(5, 1) - chance(1, 1) - 0.12) < 1e-9);
  assert.ok(Math.abs(chance(1, 1) - chance(1, 3) - 0.06) < 1e-9);
});

test('energy drops with every attempt, faster with poor cardio, and tiredness raises errors', () => {
  const play = (cardio) => {
    const rng = mulberry32(31);
    const me = { ...kit(), cardio };
    const f = createFight(me, { name: 'On', belt: 'white', levels: {}, cardio: 5 }, rng);
    for (let i = 0; i < 40 && !f.ended; i++) {
      if (f.critical) chooseOption(f, f.critical.options.findIndex((o) => o.correct));
      else stepFight(f, 5);
    }
    return f;
  };
  const poor = play(1), fit = play(10);
  assert.ok(poor.energy.p < 100);
  const f = idle();
  f.energy.p = 0;
  assert.ok(Math.abs(fatigue(f, 'p') - 0.15) < 1e-9);
  f.energy.p = 60;
  assert.equal(fatigue(f, 'p'), 0);
  assert.ok(fit.energy.p >= poor.energy.p || fit.round !== poor.round);
});

test('energy recovers between rounds, more with better cardio', () => {
  const f = createFight({ ...kit(), cardio: 10 }, { name: 'On', belt: 'white', levels: {}, cardio: 1 }, mulberry32(1), { quiet: true });
  f.energy.p = 10; f.energy.o = 10;
  stepFight(f, 181);
  assert.equal(f.round, 2);
  assert.equal(f.energy.p, 10 + 20 + 20);
  assert.equal(f.energy.o, 10 + 20 + 2);
  assert.match(f.log.at(-1).text, /Runda 2! Energija/);
});
