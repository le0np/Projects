import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gymScene } from '../src/ui/gymScene.js';
import { MOVES } from '../src/data/moves.js';

const base = { belt: 'white', gameTime: 50, training: null, workout: null, activity: null };
const slot = (extra) => ({ startedAt: 0, endsAt: 100, ...extra });

test('gym scene: nothing running, you rest on the bench', () => {
  const s = gymScene(base);
  assert.equal(s.you.spot, 'bench');
  assert.equal(s.you.progress, null);
  assert.deepEqual(s.side, []);
});

test('gym scene: technique training puts you on the mat with name, level and progress', () => {
  const m = MOVES[0];
  const s = gymScene({ ...base, training: slot({ moveId: m.id, toLevel: 3 }) });
  assert.equal(s.you.spot, 'mat');
  assert.equal(s.you.label, `${m.name} → 3`);
  assert.equal(s.you.progress, 0.5);
  assert.equal(s.you.category, m.category);
});

test('gym scene: workout alone uses the weights or cardio corner', () => {
  assert.equal(gymScene({ ...base, workout: slot({ attr: 'strength', toLevel: 2 }) }).you.spot, 'weights');
  assert.equal(gymScene({ ...base, workout: slot({ attr: 'cardio', toLevel: 2 }) }).you.spot, 'cardio');
});

test('gym scene: training wins, workout and activity become signs; activity alone means you are away', () => {
  const s = gymScene({ ...base, training: slot({ moveId: MOVES[0].id, toLevel: 1 }), workout: slot({ attr: 'cardio', toLevel: 2 }), activity: slot({ type: 'openMat', chance: 0.1 }) });
  assert.equal(s.you.spot, 'mat');
  assert.deepEqual(s.side.map((x) => x.spot), ['cardio', 'away']);
  const away = gymScene({ ...base, activity: slot({ type: 'seminar', chance: 0.9 }) });
  assert.equal(away.you.spot, 'away');
  assert.deepEqual(away.side, []);
});

test('gym scene: progress is clamped to 0..1', () => {
  assert.equal(gymScene({ ...base, gameTime: 500, workout: slot({ attr: 'strength', toLevel: 2 }) }).you.progress, 1);
  assert.equal(gymScene({ ...base, gameTime: -5, workout: slot({ attr: 'strength', toLevel: 2 }) }).you.progress, 0);
});
