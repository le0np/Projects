// Turns the 2D side-view key poses (poses.js) into 3D joints for the low-poly figures. Pure, no Three.js.
// 2D: x to the right, y down, ground at GROUND, about 100 units per metre.
// 3D: x to the right, y up (metres above the mat), z towards the camera. Near limbs get +z, far limbs -z.
import { JOINTS, GROUND } from './poses.js';

export const UNIT = 0.01; // metres per 2D unit
export const HALF_SHOULDER = 0.2;
export const HALF_HIP = 0.11;

const to3 = ([x, y], z = 0) => [(x - 400) * UNIT, Math.max(0.04, (GROUND - y) * UNIT), z];

// `zShift` moves the whole fighter along z (positive = towards the camera).
export function pose3d(pose2d, zShift = 0) {
  const j = Object.fromEntries(JOINTS.map((name, i) => [name, pose2d[i]]));
  const p = (name, z = 0) => to3(j[name], z + zShift);
  return {
    head: p('head'),
    neck: p('neck'),
    pelvis: p('hip'),
    shoulderN: p('neck', HALF_SHOULDER), elbowN: p('eN', HALF_SHOULDER + 0.04), handN: p('hN', HALF_SHOULDER),
    shoulderF: p('neck', -HALF_SHOULDER), elbowF: p('eF', -HALF_SHOULDER - 0.04), handF: p('hF', -HALF_SHOULDER),
    hipN: p('hip', HALF_HIP), kneeN: p('kN', HALF_HIP + 0.05), footN: p('fN', HALF_HIP + 0.03),
    hipF: p('hip', -HALF_HIP), kneeF: p('kF', -HALF_HIP - 0.05), footF: p('fF', -HALF_HIP - 0.03),
  };
}

// Straight-line blend of two 3D poses (t = 0..1), for transitions between positions.
export function lerpPose(a, b, t) {
  const out = {};
  for (const k of Object.keys(a)) out[k] = a[k].map((v, i) => v + (b[k][i] - v) * t);
  return out;
}

// Body parts as [from, to, radiusFrom, radiusTo, material]. Torso and head are built separately.
export const LIMBS = [
  ['shoulderN', 'elbowN', 0.055, 0.045, 'skin'], ['elbowN', 'handN', 0.045, 0.035, 'skin'],
  ['shoulderF', 'elbowF', 0.055, 0.045, 'skin'], ['elbowF', 'handF', 0.045, 0.035, 'skin'],
  ['hipN', 'kneeN', 0.085, 0.06, 'shorts'], ['kneeN', 'footN', 0.06, 0.04, 'skin'],
  ['hipF', 'kneeF', 0.085, 0.06, 'shorts'], ['kneeF', 'footF', 0.06, 0.04, 'skin'],
];
