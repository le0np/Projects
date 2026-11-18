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

import { blendPose, poseTravel } from '../src/render/poses3d.js';

test('a blend starts and ends exactly on the two poses', () => {
  const a = POSES3D.standing.T;
  const b = POSES3D.closedGuard.T;
  const start = blendPose(a, b, 0);
  const end = blendPose(a, b, 1);
  for (const k of ['pelvis', 'handL', 'footR']) {
    start[k].forEach((v, i) => assert.ok(Math.abs(v - a[k][i]) < 1e-9, `start ${k}`));
    end[k].forEach((v, i) => assert.ok(Math.abs(v - b[k][i]) < 1e-9, `end ${k}`));
  }
});

test('in a blend the body keeps up and front at right angles, also when turning around', () => {
  for (const [a, b] of [[POSES3D.standing.T, POSES3D.closedGuard.T], [POSES3D.mount.T, POSES3D.back.T], [POSES3D.turtle.B, POSES3D.northSouth.T]]) {
    for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const m = blendPose(a, b, t);
      for (const [up, fwd] of [['hipUp', 'hipFwd'], ['chestUp', 'chestFwd'], ['headUp', 'headFwd']]) {
        assert.ok(Math.abs(Math.hypot(...m[up]) - 1) < 1e-6 && Math.abs(Math.hypot(...m[fwd]) - 1) < 1e-6, `${up} unit at ${t}`);
        assert.ok(Math.abs(m[up][0] * m[fwd][0] + m[up][1] * m[fwd][1] + m[up][2] * m[fwd][2]) < 1e-6, `${up}/${fwd} at ${t}`);
      }
    }
  }
});

test('the blend of the body direction changes smoothly (no jump between nearby steps)', () => {
  const a = POSES3D.standing.T, b = POSES3D.closedGuard.T;
  let prev = blendPose(a, b, 0);
  for (let i = 1; i <= 100; i++) {
    const cur = blendPose(a, b, i / 100);
    for (const k of ['hipUp', 'hipFwd', 'chestFwd']) assert.ok(Math.hypot(...cur[k].map((v, j) => v - prev[k][j])) < 0.1, `${k} at ${i}`);
    prev = cur;
  }
});

test('hands and feet never pass below the mat in a blend between two poses that are above it', () => {
  for (const [, a] of Object.entries(POSES3D)) {
    for (const [, b] of Object.entries(POSES3D)) {
      for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const m = blendPose(a.T, b.B, t, 0.06);
        for (const k of ['handL', 'handR', 'footL', 'footR', 'pelvis']) assert.ok(m[k][1] >= 0, k);
      }
    }
  }
});

test('travel grows with the distance and with turning around', () => {
  assert.equal(poseTravel(POSES3D.mount.T, POSES3D.mount.T), 0);
  assert.ok(poseTravel(POSES3D.standing.T, POSES3D.mount.B) > 0.8);
  assert.ok(poseTravel(POSES3D.mount.T, POSES3D.back.T) > 1.7); // about 157° of turn
});

import { orientation, rotate } from '../src/render/poses3d.js';

test('an orientation turns +y into up and +z into front', () => {
  for (const [up, fwd] of [[[0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0]], [[0, -0.05, -1], [0, -1, 0.1]], [[0.4, 1, 0], [1, -0.35, 0]]]) {
    const q = orientation(up, fwd);
    const u = up.map((v) => v / Math.hypot(...up));
    rotate(q, [0, 1, 0]).forEach((v, i) => assert.ok(Math.abs(v - u[i]) < 1e-6, `up ${up}`));
    const f = rotate(q, [0, 0, 1]);
    assert.ok(Math.abs(f[0] * u[0] + f[1] * u[1] + f[2] * u[2]) < 1e-6);
    assert.ok(f[0] * fwd[0] + f[1] * fwd[1] + f[2] * fwd[2] > 0, `front ${fwd}`);
  }
});
