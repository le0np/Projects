import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSITIONS, ACTIONS, ACTION_BY_ID, MISTAKES, OPPORTUNITY_MISTAKES, GENERIC_MISTAKES, actionsFor } from '../src/data/positions.js';
import { MOVE_BY_ID } from '../src/data/moves.js';

test('action ids are unique and reference existing moves and positions', () => {
  assert.equal(new Set(ACTIONS.map((a) => a.id)).size, ACTIONS.length);
  for (const a of ACTIONS) {
    assert.ok(MOVE_BY_ID[a.move], `${a.id} move ${a.move}`);
    assert.ok(POSITIONS[a.from], `${a.id} from`);
    for (const d of a.defenses) assert.ok(MOVE_BY_ID[d], `${a.id} defense ${d}`);
    if (a.kind === 'sub') assert.equal(a.to, undefined, `${a.id} sub has no target`);
    else assert.ok(POSITIONS[a.to?.pos], `${a.id} to`);
    assert.equal(a.from === 'standing', a.role === 'neutral', `${a.id} role`);
  }
});

test('every submission has at least one defense and two specific mistakes', () => {
  for (const a of ACTIONS.filter((x) => x.kind === 'sub')) {
    assert.ok(a.defenses.length >= 1, a.id);
    assert.ok(a.mistakes.length >= 2, a.id);
  }
});

test('mistakes referenced anywhere exist and counters point at real actions', () => {
  const used = [...ACTIONS.flatMap((a) => a.mistakes), ...Object.values(OPPORTUNITY_MISTAKES).flat(), ...GENERIC_MISTAKES];
  for (const id of used) assert.ok(MISTAKES[id], `missing mistake ${id}`);
  for (const [id, mk] of Object.entries(MISTAKES)) {
    assert.ok(['threat', 'tap', 'pos', 'counter', 'penalty'].includes(mk.effect), id);
    if (mk.effect === 'counter') assert.ok(ACTION_BY_ID[mk.counterAction], `${id} counter`);
    if (mk.effect === 'pos') assert.ok(POSITIONS[mk.to?.pos], `${id} to`);
  }
});

test('every position+role with player actions has at least two opportunity mistakes', () => {
  const keys = new Set(ACTIONS.map((a) => `${a.from}:${a.role}`));
  for (const k of keys) assert.ok((OPPORTUNITY_MISTAKES[k] ?? []).length >= 2, k);
});

test('counter mistakes for an opportunity name an action the opponent can do from that spot', () => {
  for (const [key, ids] of Object.entries(OPPORTUNITY_MISTAKES)) {
    const [pos, role] = key.split(':');
    const oppRole = role === 'top' ? 'bottom' : role === 'bottom' ? 'top' : 'neutral';
    for (const id of ids) {
      const mk = MISTAKES[id];
      if (mk.effect !== 'counter') continue;
      const ca = ACTION_BY_ID[mk.counterAction];
      assert.equal(ca.from, pos, `${key} ${id}`);
      assert.equal(ca.role, oppRole, `${key} ${id}`);
    }
  }
});

test('all positions are reachable from standing', () => {
  const seen = new Set(['standing']);
  const queue = ['standing'];
  while (queue.length) {
    const p = queue.shift();
    for (const a of ACTIONS.filter((x) => x.from === p && x.to)) {
      if (!seen.has(a.to.pos)) { seen.add(a.to.pos); queue.push(a.to.pos); }
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(POSITIONS).sort());
});

test('actionsFor filters by position and role', () => {
  const list = actionsFor('mount', 'bottom');
  assert.ok(list.length >= 2);
  assert.ok(list.every((a) => a.from === 'mount' && a.role === 'bottom'));
});
