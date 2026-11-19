import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_KEYS, keymap, bindKey, actionFor, keyLabel, toolOrder, moveTool, TOOL_ORDER } from '../src/keys.js';

test('keys: defaults are the old keys, and every action has its own', () => {
  const map = keymap(null);
  assert.equal(map['tool:hand'], '1');
  assert.equal(map['job:harvest'], 'b');
  assert.equal(map.bag, 't');
  assert.equal(new Set(Object.values(map)).size, Object.keys(map).length);
  assert.equal(actionFor(map, 'B'), 'job:harvest', 'capital letters work too');
  assert.equal(actionFor(map, '='), 'zoomIn', '= zooms in without Shift');
  assert.equal(actionFor(map, 'x'), null);
});

test('keys: binding a taken key swaps the two actions', () => {
  let map = keymap(null);
  map = bindKey(map, 'bag', 'B');
  assert.equal(map.bag, 'b');
  assert.equal(map['job:harvest'], 't', 'harvest gets the bag key');
  assert.equal(actionFor(map, 'b'), 'bag');
  // Escape and Tab cannot be bound
  assert.equal(bindKey(map, 'bag', 'Escape'), map);
  assert.equal(bindKey(map, 'nope', 'q'), map);
});

test('keys: saved settings are checked', () => {
  const map = keymap({ bag: 'Q', phone: 'q', 'tool:hand': 'Escape', unknown: 'x' });
  assert.equal(map.bag, 'q');
  assert.equal(map.phone, 'm', 'a double goes back to its default');
  assert.equal(map['tool:hand'], '1', 'a reserved key is ignored');
  assert.ok(!('unknown' in map));
  assert.equal(keyLabel('q'), 'Q');
  assert.equal(keyLabel('ArrowUp'), '↑');
  assert.equal(keyLabel(''), '–');
  assert.deepEqual(Object.keys(keymap({})), Object.keys(DEFAULT_KEYS));
});

test('toolbar order: saved order is checked, tools move one place', () => {
  assert.deepEqual(toolOrder(null), TOOL_ORDER);
  assert.deepEqual(toolOrder(['can', 'hand', 'can', 'axe']), ['can', 'hand', 'seed', 'fert', 'rod', 'mulch']);
  assert.deepEqual(moveTool(TOOL_ORDER, 'can', -1), ['hand', 'can', 'seed', 'fert', 'rod', 'mulch']);
  assert.deepEqual(moveTool(TOOL_ORDER, 'hand', -1), TOOL_ORDER);
  assert.deepEqual(moveTool(TOOL_ORDER, 'mulch', 1), TOOL_ORDER);
});
