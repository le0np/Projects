import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIPS, KIND_CLIPS, clipAt, clipFor, mirrorOffsets } from '../src/render/techniques3d.js';
import { ACTIONS, ACTION_BY_ID } from '../src/data/positions.js';
import { POSE_KEYS, OPTIONAL_KEYS } from '../src/render/poses3d.js';

const KEYS = new Set([...POSE_KEYS, ...OPTIONAL_KEYS]);
const zero = (o) => Object.values(o).every((v) => v.every((x) => Math.abs(x) < 1e-12));

test('every action has a clip, and own clips belong to real actions', () => {
  for (const a of ACTIONS) assert.ok(clipFor(a), a.id);
  for (const id of Object.keys(CLIPS)) assert.ok(ACTION_BY_ID[id], id);
});

test('clip keys are in order inside the clip and only move pose targets', () => {
  for (const [name, clip] of Object.entries({ ...CLIPS, ...KIND_CLIPS })) {
    assert.ok(clip.dur >= 0.8 && clip.dur <= 2.5, name);
    let last = 0;
    for (const k of clip.keys) {
      assert.ok(k.t > last && k.t < 1, `${name} t=${k.t}`);
      last = k.t;
      for (const side of [k.a, k.d, k.A, k.D]) for (const [key, v] of Object.entries(side)) {
        assert.ok(KEYS.has(key), `${name}: ${key}`);
        assert.ok(v.length === 3 && v.every(Number.isFinite), `${name}: ${key}`);
      }
    }
  }
});

test('a clip starts and ends on the positions; a failed one comes back; a pending one waits halfway', () => {
  for (const [name, clip] of Object.entries(CLIPS)) {
    for (const outcome of ['success', 'fail', 'pending']) {
      const s = clipAt(clip, 0, outcome);
      assert.ok(zero(s.a) && zero(s.d), `${name} start ${outcome}`);
    }
    const failEnd = clipAt(clip, 1, 'fail');
    assert.ok(zero(failEnd.a) && zero(failEnd.d), `${name} fail end`);
    const end = clipAt(clip, 1, 'success');
    const lastKey = clipAt(clip, clip.keys.at(-1).t, 'success').a;
    if (clip.hold) {
      for (const k of new Set([...Object.keys(lastKey), ...Object.keys(end.a)])) {
        const x = lastKey[k] ?? [0, 0, 0], y = end.a[k] ?? [0, 0, 0];
        assert.ok(x.every((v, j) => Math.abs(v - y[j]) < 1e-9), `${name} holds ${k}`);
      }
    }
    else assert.ok(zero(end.a) && zero(end.d), `${name} end`);
    assert.deepEqual(clipAt(clip, 0.9, 'pending'), clipAt(clip, 0.42, 'pending'), `${name} pending`);
  }
});

test('clips move smoothly: small time steps give small changes', () => {
  for (const [name, clip] of Object.entries(CLIPS)) {
    let prev = clipAt(clip, 0);
    for (let i = 1; i <= 120; i++) {
      const cur = clipAt(clip, i / 120);
      for (const side of ['a', 'd']) for (const [k, v] of Object.entries(cur[side])) {
        const p = prev[side][k] ?? [0, 0, 0];
        const limit = /(Up|Fwd)$/.test(k) ? 0.12 : 0.06; // directions are not metres
        assert.ok(Math.hypot(...v.map((x, j) => x - p[j])) < limit, `${name} ${side}.${k} at ${i}`);
      }
      prev = cur;
    }
  }
});

test('mirroring a clip flips x and swaps left and right', () => {
  assert.deepEqual(mirrorOffsets({ handL: [0.2, 0.1, 0.3], pelvis: [0.1, 0, 0] }), { handR: [-0.2, 0.1, 0.3], pelvis: [-0.1, 0, 0] });
});
