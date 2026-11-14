import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFight, stepFight, chooseOption, applyTransition, startDefense, startOpportunity,
  ROUND_SECONDS, ROUNDS, CLOCK_SPEED, CRITICAL_TIME_LIMIT,
} from '../src/engine/fight.js';
import { makeOpponent, fighterFromState } from '../src/engine/opponent.js';
import { createState } from '../src/engine/progression.js';
import { ACTIONS, OPPORTUNITY_MISTAKES } from '../src/data/positions.js';
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
