import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BELTS, MOVES, MOVE_BY_ID, CATEGORIES } from '../src/data/moves.js';
import { mulberry32 } from '../src/engine/rng.js';

const WHITE_IDS = ['shrimp', 'upa', 'technicalStandUp', 'sprawl', 'guardPosture', 'doubleLeg', 'singleLeg',
  'snapDown', 'guardPull', 'closedGuard', 'halfGuard', 'butterflyGuard', 'hipBump', 'scissor', 'flower',
  'butterflySweep', 'underhookSweep', 'openClosedGuard', 'kneeSlice', 'toreando', 'overUnder', 'sideControl',
  'kneeOnBelly', 'mount', 'backControl', 'northSouth', 'sideToMount', 'sideToKob', 'mountToBack', 'mountUpa',
  'elbowKnee', 'sideShrimp', 'sideUnderhook', 'backEscape', 'kobEscape', 'rnc', 'guillotine', 'triangle',
  'armbar', 'kimura', 'americana', 'straightAnkle', 'guillotineDefense', 'triangleDefense', 'armbarDefense',
  'rncDefense'];

test('move ids are unique', () => {
  assert.equal(new Set(MOVES.map((m) => m.id)).size, MOVES.length);
});

test('every move has a valid belt, category, name and base time', () => {
  for (const m of MOVES) {
    assert.ok(BELTS.includes(m.belt), `${m.id} belt`);
    assert.ok(CATEGORIES[m.category], `${m.id} category`);
    assert.ok(m.name.length > 0, `${m.id} name`);
    assert.ok(m.base > 0, `${m.id} base`);
  }
});

test('white belt curriculum from the plan is complete with 5-60 s base times', () => {
  for (const id of WHITE_IDS) {
    const m = MOVE_BY_ID[id];
    assert.ok(m, `missing ${id}`);
    assert.equal(m.belt, 'white', id);
    assert.ok(m.base >= 5 && m.base <= 60, `${id} base ${m.base}`);
  }
});

test('higher belt moves exist, including heel hook', () => {
  assert.notEqual(MOVE_BY_ID.heelHook?.belt, undefined);
  assert.notEqual(MOVE_BY_ID.heelHook.belt, 'white');
  for (const b of ['blue', 'purple', 'brown']) assert.ok(MOVES.some((m) => m.belt === b), b);
});

test('mulberry32 is deterministic and in [0,1)', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 100; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

import { makeOpponent } from '../src/engine/opponent.js';

test('an opponent built around a base level stays within one level of it', () => {
  const rng = mulberry32(3);
  for (const base of [1, 2, 5]) {
    const o = makeOpponent('white', rng, base);
    for (const l of Object.values(o.levels)) assert.ok(l >= Math.max(1, base - 1) && l <= base + 1, `${base}: ${l}`);
  }
});
