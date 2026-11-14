import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, learnTime, effectiveLevel, canTrain, startTraining, startActivity, advance, setSpeed,
  rollCompetitionLearn, promotionStatus, promote, serialize, deserialize, BELT_FACTOR, MAX_LEVEL,
} from '../src/engine/progression.js';
import { MOVE_BY_ID } from '../src/data/moves.js';

const fixed = (v) => () => v;
const base = MOVE_BY_ID.shrimp.base;

test('learnTime doubles per level and scales by belt factor', () => {
  assert.equal(learnTime('shrimp', 1, 'white'), base);
  assert.equal(learnTime('shrimp', 3, 'white'), 4 * base);
  assert.equal(learnTime('shrimp', 1, 'black'), 0.15 * base);
  assert.deepEqual(BELT_FACTOR, { white: 1, blue: 0.8, purple: 0.55, brown: 0.35, black: 0.15 });
  assert.equal(MAX_LEVEL, 10);
});

test('training completes exactly when game time reaches its end', () => {
  const s = createState({ test: false, now: 0 });
  assert.equal(startTraining(s, 'shrimp').ok, true);
  advance(s, (base - 1) * 1000, fixed(0.5));
  assert.equal(effectiveLevel(s, 'shrimp'), 0);
  const events = advance(s, base * 1000, fixed(0.5));
  assert.equal(effectiveLevel(s, 'shrimp'), 1);
  assert.equal(s.training, null);
  assert.deepEqual(events.map((e) => e.type), ['trained']);
});

test('changing speed mid-training keeps the remaining game time', () => {
  const s = createState({ test: false, now: 0 });
  startTraining(s, 'guillotine'); // 30 s
  advance(s, 10_000, fixed(0.5)); // 10 s done at 1x
  setSpeed(s, 10, 10_000);
  advance(s, 11_000, fixed(0.5)); // +10 s game time
  assert.equal(s.gameTime, 20);
  assert.ok(s.training);
  advance(s, 12_000, fixed(0.5)); // +10 s → 30
  assert.equal(effectiveLevel(s, 'guillotine'), 1);
});

test('reload counts offline time with the saved speed', () => {
  const s = createState({ test: true, now: 0 });
  setSpeed(s, 10, 0);
  const restored = deserialize(serialize(s), 60_000);
  assert.equal(restored.gameTime, 600);
});

test('corrupt or foreign save data starts a fresh game', () => {
  for (const bad of ['{bad', 'null', '"x"', JSON.stringify({ version: 999 })]) {
    const s = deserialize(bad, 5_000);
    assert.equal(s.gameTime, 0);
    assert.equal(s.belt, 'white');
  }
});

test('seminar teaches a move at roll 0.5, open mat does not at roll 0.99', () => {
  const s = createState({ test: false, now: 0 });
  assert.equal(startActivity(s, 'seminar', fixed(0.5)).ok, true);
  const ev = advance(s, 10_000_000, fixed(0.5));
  const done = ev.find((e) => e.type === 'activityDone');
  assert.ok(done.learned);
  assert.equal(s.levels[done.learned], 1);

  const s2 = createState({ test: false, now: 0 });
  startActivity(s2, 'openMat', fixed(0.99));
  const ev2 = advance(s2, 10_000_000, fixed(0.99));
  assert.equal(ev2.find((e) => e.type === 'activityDone').learned, null);
});

test('open mat chance is between 10 and 20 percent', () => {
  const s = createState({ test: false, now: 0 });
  startActivity(s, 'openMat', fixed(0));
  assert.equal(s.activity.chance, 0.1);
  const s2 = createState({ test: false, now: 0 });
  startActivity(s2, 'openMat', fixed(0.999));
  assert.ok(s2.activity.chance <= 0.2 && s2.activity.chance > 0.19);
});

test('seminar costs money and is refused without it', () => {
  const s = createState({ test: false, now: 0 });
  s.money = 10;
  assert.equal(startActivity(s, 'seminar', fixed(0.5)).ok, false);
});

test('unlockAll makes every move at least level 1', () => {
  const s = createState({ test: true, now: 0 });
  assert.equal(effectiveLevel(s, 'heelHook'), 1);
  s.unlockAll = false;
  assert.equal(effectiveLevel(s, 'heelHook'), 0);
});

test('without unlockAll an unknown higher-belt move cannot be trained', () => {
  const s = createState({ test: false, now: 0 });
  assert.equal(canTrain(s, 'heelHook').ok, false);
  assert.equal(canTrain(s, 'shrimp').ok, true);
  s.levels.heelHook = 1;
  assert.equal(canTrain(s, 'heelHook').ok, true);
});

test('only one training at a time and none beyond max level', () => {
  const s = createState({ test: false, now: 0 });
  startTraining(s, 'shrimp');
  assert.equal(canTrain(s, 'upa').ok, false);
  const s2 = createState({ test: false, now: 0 });
  s2.levels.upa = MAX_LEVEL;
  assert.equal(canTrain(s2, 'upa').ok, false);
});

test('competition learning happens at 5 percent', () => {
  const s = createState({ test: false, now: 0 });
  assert.equal(rollCompetitionLearn(s, fixed(0.06)), null);
  const id = rollCompetitionLearn(s, fixed(0.04));
  assert.ok(id);
  assert.equal(s.levels[id], 1);
});

test('promotion needs moves and wins', () => {
  const s = createState({ test: false, now: 0 });
  assert.equal(promotionStatus(s).ok, false);
  assert.equal(promote(s), false);
  const st = promotionStatus(s);
  Object.keys(MOVE_BY_ID).slice(0, st.need.moves).forEach((id) => { s.levels[id] = 1; });
  s.wins = st.need.wins;
  assert.equal(promote(s), true);
  assert.equal(s.belt, 'blue');
});

test('a partly valid save is repaired instead of crashing', () => {
  const partial = JSON.stringify({
    version: 1, gameTime: 50, lastReal: 0, belt: 'blue', levels: { shrimp: 3 },
    training: { moveId: 'nope', toLevel: 1, startedAt: 0, endsAt: 1e9 },
    activity: { type: 'party', chance: 1, startedAt: 0, endsAt: 1e9 },
  });
  const s = deserialize(partial, 0);
  assert.equal(s.gameTime, 50);
  assert.equal(s.belt, 'blue');
  assert.equal(s.levels.shrimp, 3);
  assert.equal(s.speed, 1);
  assert.deepEqual(s.medals, { gold: 0, silver: 0, bronze: 0 });
  assert.equal(s.training, null);
  assert.equal(s.activity, null);
  assert.ok(Number.isFinite(s.money) && Number.isFinite(s.wins) && Number.isFinite(s.losses));
});

test('save numbers out of range are clamped or reset', () => {
  const s = deserialize(JSON.stringify({ version: 1, gameTime: 0, lastReal: 0, belt: 'white', levels: { upa: 99, x: 2 }, speed: 50, money: 'lots', wins: -3 }), 0);
  assert.equal(s.speed, 10);
  assert.equal(s.money, createState().money);
  assert.equal(s.wins, 0);
  assert.equal(s.levels.upa, 10);
  assert.equal(s.levels.x, undefined);
});
