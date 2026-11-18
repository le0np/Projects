import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSES } from '../src/render/poses.js';
import { pose3d, lerpPose, LIMBS, HALF_SHOULDER } from '../src/render/pose3d.js';

test('every 2D key pose turns into finite 3D joints above the mat, near limbs in front of far ones', () => {
  for (const [name, p] of Object.entries(POSES)) {
    for (const side of ['T', 'B']) {
      const j = pose3d(p[side]);
      for (const [k, xyz] of Object.entries(j)) {
        assert.ok(xyz.every(Number.isFinite), `${name}.${side}.${k}`);
        assert.ok(xyz[1] > 0, `${name}.${side}.${k} is above the mat`);
      }
      assert.ok(j.shoulderN[2] > j.shoulderF[2] && j.hipN[2] > j.hipF[2] && j.footN[2] > j.footF[2]);
      for (const [a, b] of LIMBS) assert.ok(j[a] && j[b], `${a}-${b}`);
    }
  }
});

test('standing figures are about 1.7 m tall and blending poses goes straight between them', () => {
  const j = pose3d(POSES.standing.T);
  assert.ok(j.head[1] > 1.5 && j.head[1] < 1.8, `head at ${j.head[1]}`);
  assert.equal(j.shoulderN[2], HALF_SHOULDER);
  const a = pose3d(POSES.standing.T), b = pose3d(POSES.mount.T);
  const near = (x, y) => Object.keys(x).every((k) => x[k].every((v, i) => Math.abs(v - y[k][i]) < 1e-12));
  assert.ok(near(lerpPose(a, b, 0), a));
  assert.ok(near(lerpPose(a, b, 1), b));
  const mid = lerpPose(a, b, 0.5);
  assert.ok(Math.abs(mid.head[1] - (a.head[1] + b.head[1]) / 2) < 1e-12);
});
