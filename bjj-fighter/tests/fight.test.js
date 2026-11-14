import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFight, stepFight, chooseOption, applyTransition, startDefense, startOpportunity,
  ROUND_SECONDS, ROUNDS, CLOCK_SPEED, CRITICAL_TIME_LIMIT,
} from '../src/engine/fight.js';
import { makeOpponent, fighterFromState } from '../src/engine/opponent.js';
import { createState } from '../src/engine/progression.js';
import { ACTIONS, ACTION_BY_ID, OPPORTUNITY_MISTAKES } from '../src/data/positions.js';
import { mulberry32 } from '../src/engine/rng.js';

const empty = (name) => ({ name, belt: 'white', levels: {} });
const idle = (seed = 1) => createFight(empty('Ti'), empty('On'), mulberry32(seed));

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
  const f = createFight({ name: 'Ti', belt: 'white', levels: { rnc: 10 } }, empty('On'), () => 0);
  f.pos = 'back'; f.playerTop = true;
  startOpportunity(f);
  const idx = f.critical.options.findIndex((o) => o.actionId === 'rnc_b');
  assert.ok(idx >= 0);
  chooseOption(f, idx);
  assert.deepEqual([f.ended.winner, f.ended.method], ['p', 'sub']);
});

test('every defense and every opportunity offers 5 options with at least one right and one wrong', () => {
  const everything = Object.fromEntries(ACTIONS.map((a) => [a.move, 3]));
  for (const a of ACTIONS.filter((x) => x.defenses.length)) {
    const f = createFight({ name: 'Ti', belt: 'white', levels: everything }, { name: 'On', belt: 'white', levels: everything }, mulberry32(7));
    f.pos = a.from; f.playerTop = a.role === 'bottom';
    startDefense(f, a.id);
    const o = f.critical.options;
    assert.equal(o.length, 5, a.id);
    assert.ok(o.some((x) => x.correct) && o.some((x) => !x.correct), a.id);
  }
  for (const key of Object.keys(OPPORTUNITY_MISTAKES)) {
    const [pos, role] = key.split(':');
    const f = createFight({ name: 'Ti', belt: 'white', levels: everything }, empty('On'), mulberry32(3));
    f.pos = pos; f.playerTop = role === 'neutral' ? null : role === 'top';
    startOpportunity(f);
    const o = f.critical.options;
    assert.equal(o.length, 5, key);
    assert.ok(o.some((x) => x.correct) && o.some((x) => !x.correct), key);
  }
});

test('a round ends exactly at 180 s even with a huge step, and the fight ends after round 3', () => {
  const f = idle();
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
    const f = idle();
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
  const s = createState({ test: true, now: 0 });
  const f = createFight(fighterFromState(s), makeOpponent('white', rng), rng);
  let guard = 0;
  while (!f.ended && guard++ < 10_000) {
    if (f.critical) chooseOption(f, chooser(f, rng));
    else stepFight(f, 1);
  }
  assert.ok(f.ended, 'fight finished');
  return f;
}

test('a good player sees about 8-12 critical moments per fight', () => {
  const good = (f, rng) => {
    const right = f.critical.options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);
    return right[Math.floor(rng() * right.length)];
  };
  let total = 0;
  for (let i = 0; i < 200; i++) total += simulate(i + 1, good).criticalCount;
  const avg = total / 200;
  assert.ok(avg >= 8 && avg <= 12, `average ${avg}`);
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
import { MOVES, MOVE_BY_ID } from '../src/data/moves.js';
import { actionsFor } from '../src/data/positions.js';

test('a defended submission from a bad spot escapes to half guard and stops sub attacks for 20 s', () => {
  const opp = { name: 'On', belt: 'white', levels: { armbar: 3, americana: 3, darce: 3, kimura: 3 } };
  const f = createFight({ name: 'Ti', belt: 'white', levels: { armbarDefense: 10 } }, opp, mulberry32(11));
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
    startOpportunity(f);
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
      startOpportunity(f);
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
    const s = createState({ test: true, now: 0 });
    const f = createFight(fighterFromState(s), makeOpponent('white', rng, 1), rng);
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
  assert.ok(wins / N >= 0.45 && wins / N <= 0.8, `win rate ${wins / N}`);
});

// ---- round 2, step 1 ----
import { errorChance, formatLog, opponentBlunder } from '../src/engine/fight.js';

test('error chance depends on belt and move level', () => {
  assert.equal(errorChance('white', 1), 0.25);
  assert.ok(Math.abs(errorChance('blue', 3) - 0.15) < 1e-9);
  assert.equal(errorChance('black', 10), 0.02);
});

test('initiative strictly alternates between the fighters', () => {
  const rng = mulberry32(77);
  const s = createState({ test: true, now: 0 });
  const f = createFight(fighterFromState(s), makeOpponent('white', rng, 1), rng);
  while (!f.ended && f.elapsed < 300) {
    if (f.critical) chooseOption(f, f.critical.options.findIndex((o) => o.correct));
    else stepFight(f, 1);
  }
  assert.ok(f.history.length > 10);
  for (let i = 1; i < f.history.length; i++) assert.notEqual(f.history[i].who, f.history[i - 1].who, `turn ${i}`);
});

test('an opponent blunder gives the player a chance', () => {
  const f = createFight({ name: 'Ti', belt: 'white', levels: { mount: 2, sideToMount: 2 } }, { name: 'On', belt: 'white', levels: { sideShrimp: 1 } }, mulberry32(2));
  f.pos = 'sideControl'; f.playerTop = true;
  opponentBlunder(f, ACTION_BY_ID.sideShrimp_e);
  assert.equal(f.critical.kind, 'opportunity');
  assert.match(f.critical.text, /pogriješio/);
});

test('an opponent blunder when the player knows no attack gives an advantage instead', () => {
  const f = createFight(empty('Ti'), { name: 'On', belt: 'white', levels: { sideShrimp: 1 } }, mulberry32(2));
  f.pos = 'sideControl'; f.playerTop = true;
  opponentBlunder(f, ACTION_BY_ID.sideShrimp_e);
  assert.equal(f.critical, null);
  assert.equal(f.score.p.adv, 1);
});

test('the player decides in about 30 % of exchanges', () => {
  let crit = 0, ex = 0;
  for (let i = 0; i < 150; i++) {
    const rng = mulberry32(300 + i);
    const s = createState({ test: true, now: 0 });
    const f = createFight(fighterFromState(s), makeOpponent('white', rng, 1), rng);
    while (!f.ended) {
      if (f.critical) chooseOption(f, f.critical.options.findIndex((o) => o.correct));
      else stepFight(f, 1);
    }
    crit += f.criticalCount; ex += f.history.length;
  }
  assert.ok(crit / ex >= 0.25 && crit / ex <= 0.35, `share ${crit / ex}`);
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
    const f = createFight({ name: 'Ti', belt: 'white', levels: { armbarDefense: 1 } }, { name: 'On', belt: 'white', levels: { armbar: 1 } }, mulberry32(1));
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
  const f = createFight({ name: 'Ti', belt: 'white', levels: { rnc: 3 } }, empty('On'), mulberry32(1));
  f.pos = 'back'; f.playerTop = true;
  startOpportunity(f);
  for (const o of f.critical.options) assert.ok(['napad', 'obrana', 'kontrola', 'pozicija'].includes(o.cls), o.label);
});

// ---- opponent mistakes and precise log ----
import { fighterErrorChance } from '../src/engine/fight.js';

test('the fight log opens with both fighters\' error chance in percent', () => {
  const f = createFight({ name: 'Ti', belt: 'white', levels: { mount: 1 } }, { name: 'On', belt: 'purple', levels: { mount: 3 } }, mulberry32(1));
  assert.ok(Math.abs(fighterErrorChance(f.opponent) - 0.09) < 1e-9);
  assert.match(f.log[0].text, /Ti 25 %, On 9 %/);
});

test('an opponent blunder says how likely it was', () => {
  const f = createFight(empty('Ti'), { name: 'On', belt: 'blue', levels: { sideShrimp: 1 } }, mulberry32(2));
  f.pos = 'sideControl'; f.playerTop = true;
  opponentBlunder(f, ACTION_BY_ID.sideShrimp_e);
  assert.ok(f.log.some((l) => /On griješi: .*šansa greške 18 %/.test(l.text)));
  assert.ok(f.log.some((l) => /^\+1 prednost: Ti/.test(l.text)));
});

test('when the opponent overpowers a good choice the log gives levels and the chance', () => {
  let seen = false;
  for (let seed = 1; seed < 400 && !seen; seed++) {
    const rng = mulberry32(seed);
    const s = createState({ test: true, now: 0 });
    const f = createFight(fighterFromState(s), makeOpponent('white', rng, 4), rng);
    while (!f.ended && !seen) {
      if (f.critical) chooseOption(f, f.critical.options.findIndex((o) => o.correct));
      else stepFight(f, 1);
      seen = f.log.some((l) => /nadjača.*razina \d+ protiv .*razine \d+ \(šansa .*\d+ %\)/.test(l.text));
    }
  }
  assert.ok(seen);
});
