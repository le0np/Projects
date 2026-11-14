import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tickCriticalTimer } from '../src/ui/criticalTimer.js';

test('a new critical moment gets a full timer even if the previous one was almost out', () => {
  let t = { seq: 1, left: 0.01 };
  const r = tickCriticalTimer(t, { timeLimit: 10 }, 2, 0.05);
  assert.equal(r.expired, false);
  assert.ok(Math.abs(r.timer.left - 9.95) < 1e-9);
  assert.equal(r.timer.seq, 2);
});

test('the same critical moment expires when its time runs out', () => {
  const r = tickCriticalTimer({ seq: 3, left: 0.04 }, { timeLimit: 10 }, 3, 0.05);
  assert.equal(r.expired, true);
});
