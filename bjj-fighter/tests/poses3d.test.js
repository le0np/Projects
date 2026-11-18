import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSES3D, POSE_KEYS, OPTIONAL_KEYS, mirrorPose } from '../src/render/poses3d.js';

const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

test('every 3D pose has both fighters with all required targets as 3D points', () => {
  for (const [name, pose] of Object.entries(POSES3D)) {
    for (const who of ['T', 'B']) {
      const p = pose[who];
      for (const k of POSE_KEYS) assert.ok(isVec(p[k]), `${name}.${who}.${k}`);
      for (const k of OPTIONAL_KEYS) if (k in p) assert.ok(isVec(p[k]), `${name}.${who}.${k}`);
    }
  }
});

test('feet and hands stay on or above the mat, and up and front directions are never parallel', () => {
  for (const [name, pose] of Object.entries(POSES3D)) {
    for (const who of ['T', 'B']) {
      const p = pose[who];
      for (const k of ['handL', 'handR', 'footL', 'footR', 'pelvis']) assert.ok(p[k][1] >= 0, `${name}.${who}.${k}`);
      for (const [up, fwd] of [['hipUp', 'hipFwd'], ['chestUp', 'chestFwd'], ['headUp', 'headFwd']]) {
        if (!p[up] || !p[fwd]) continue;
        const [a, b] = [p[up], p[fwd]];
        const cross = Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
        assert.ok(cross / (Math.hypot(...a) * Math.hypot(...b)) > 0.3, `${name}.${who}.${up}/${fwd}`);
      }
    }
  }
});

test('mirroring flips x and swaps left and right', () => {
  const m = mirrorPose({ pelvis: [1, 2, 3], handL: [0.5, 1, -0.2], handR: [0.4, 1, 0.2], grip: 0.5 });
  assert.deepEqual(m.pelvis, [-1, 2, 3]);
  assert.deepEqual(m.handR, [-0.5, 1, -0.2]);
  assert.deepEqual(m.handL, [-0.4, 1, 0.2]);
  assert.equal(m.grip, 0.5);
});
