import { test } from 'node:test';
import assert from 'node:assert/strict';
import { energySegments, bannerFor, createFxMemo, nextFxEvents } from '../src/ui/fightFx.js';

const ACTIONS = {
  td: { id: 'td', kind: 'takedown', to: { pos: 'halfGuard', actorTop: true } },
  sw: { id: 'sw', kind: 'sweep', to: { pos: 'mount', actorTop: true } },
  ps: { id: 'ps', kind: 'pass', to: { pos: 'sideControl', actorTop: true } },
  toBack: { id: 'toBack', kind: 'transition', to: { pos: 'back', actorTop: true } },
  toMount: { id: 'toMount', kind: 'transition', to: { pos: 'mount', actorTop: true } },
  esc: { id: 'esc', kind: 'escape', to: { pos: 'closedGuard', actorTop: false } },
  arm: { id: 'arm', kind: 'sub', to: undefined },
};

const fight = ({ seq = -1, actionId = 'td', who = 'p', success = true, p = 0, o = 0, ended = null } = {}) => ({
  lastAction: seq < 0 ? null : { seq, who, actionId, success },
  score: { p: { pts: p }, o: { pts: o } },
  ended,
});

test('energy segments: one per 10 energy, rounded up, clamped to 0..10', () => {
  assert.deepEqual(energySegments(100), { on: 10, level: 'ok' });
  assert.deepEqual(energySegments(50), { on: 5, level: 'ok' });
  assert.deepEqual(energySegments(49), { on: 5, level: 'tired' });
  assert.deepEqual(energySegments(19), { on: 2, level: 'spent' });
  assert.deepEqual(energySegments(0), { on: 0, level: 'spent' });
  assert.equal(energySegments(-5).on, 0);
  assert.equal(energySegments(130).on, 10);
});

test('banner: technique kind wins, then target position, otherwise nothing', () => {
  assert.deepEqual(bannerFor(ACTIONS.td, true), { text: 'TAKEDOWN!', shake: true });
  assert.deepEqual(bannerFor(ACTIONS.sw, true), { text: 'SWEEP!', shake: true });
  assert.deepEqual(bannerFor(ACTIONS.ps, true), { text: 'PASS!', shake: false });
  assert.deepEqual(bannerFor(ACTIONS.toBack, true), { text: 'BACK!', shake: false });
  assert.deepEqual(bannerFor(ACTIONS.toMount, true), { text: 'MOUNT!', shake: false });
  assert.equal(bannerFor(ACTIONS.esc, true), null);
  assert.equal(bannerFor(ACTIONS.arm, true), null);
});

test('banner: only for techniques that worked', () => {
  assert.equal(bannerFor(ACTIONS.td, false), null);
  assert.equal(bannerFor(ACTIONS.td, null), null);
  assert.equal(bannerFor(undefined, true), null);
});

test('events: same action seq gives nothing', () => {
  const f = fight({ seq: 4 });
  const { events } = nextFxEvents(createFxMemo(f), f, ACTIONS);
  assert.deepEqual(events, []);
});

test('events: a new successful sweep gives one banner for that fighter', () => {
  const memo = createFxMemo(fight({ seq: 4 }));
  const { events } = nextFxEvents(memo, fight({ seq: 5, actionId: 'sw', who: 'o' }), ACTIONS);
  assert.deepEqual(events, [{ type: 'banner', who: 'o', text: 'SWEEP!', shake: true }]);
});

test('events: points awarded give exactly one badge with the real gain', () => {
  const memo = createFxMemo(fight({ seq: 4 }));
  const f = fight({ seq: 4, p: 6 });
  const first = nextFxEvents(memo, f, ACTIONS);
  assert.deepEqual(first.events, [{ type: 'badge', who: 'p', pts: 6 }]);
  const second = nextFxEvents(first.memo, f, ACTIONS);
  assert.deepEqual(second.events, []);
});

test('events: the memo passed in is not changed', () => {
  const memo = createFxMemo(fight({ seq: 4 }));
  const copy = structuredClone(memo);
  nextFxEvents(memo, fight({ seq: 5, o: 2 }), ACTIONS);
  assert.deepEqual(memo, copy);
});

test('events: a submission win gives TAP! once, a give-up does not', () => {
  const memo = createFxMemo(fight({ seq: 4 }));
  const sub = fight({ seq: 4, ended: { winner: 'o', method: 'sub', detail: 'Armbar' } });
  const r = nextFxEvents(memo, sub, ACTIONS);
  assert.deepEqual(r.events, [{ type: 'banner', who: 'o', text: 'TAP!', shake: false }]);
  assert.deepEqual(nextFxEvents(r.memo, sub, ACTIONS).events, []);
  const quit = fight({ seq: 4, ended: { winner: 'o', method: 'sub', detail: 'gave up' } });
  assert.deepEqual(nextFxEvents(memo, quit, ACTIONS).events, []);
  const points = fight({ seq: 4, ended: { winner: 'p', method: 'points', detail: 'points' } });
  assert.deepEqual(nextFxEvents(memo, points, ACTIONS).events, []);
});

test('events: a fresh memo for a fight in progress replays nothing', () => {
  const f = fight({ seq: 9, actionId: 'sw', p: 6, o: 2 });
  assert.deepEqual(nextFxEvents(createFxMemo(f), f, ACTIONS).events, []);
});
