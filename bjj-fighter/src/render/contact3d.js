// Contact checks for the posed model fighters: how deep the skin goes into the mat and into the other fighter.
// Uses the real skinned vertices (CPU skinning of every n-th vertex), so it measures what you see.
import * as THREE from 'three';

const _v = new THREE.Vector3();

// Body region of each bone: which pose target moves that part (see settle()).
function regionOf(bone) {
  const side = bone.endsWith('_l') ? 'L' : bone.endsWith('_r') ? 'R' : '';
  if (/^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)/.test(bone)) return `arm${side}`;
  if (bone.startsWith('thigh')) return `thigh${side}`;
  if (/^(calf|foot|ball)/.test(bone)) return `shin${side}`;
  return 'torso';
}

// Every `step`-th vertex of the body mesh with the region of its strongest bone (cached per mesh).
const samples = new WeakMap();
function sampleSet(mesh, step) {
  const key = `${step}`;
  const cache = samples.get(mesh) ?? {};
  if (!cache[key]) {
    const idx = mesh.geometry.attributes.skinIndex;
    const wt = mesh.geometry.attributes.skinWeight;
    const names = mesh.skeleton.bones.map((b) => b.name);
    const list = [];
    for (let i = 0; i < idx.count; i += step) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (wt.getComponent(i, k) > wt.getComponent(i, best)) best = k;
      list.push([i, regionOf(names[idx.getComponent(i, best)])]);
    }
    cache[key] = list;
    samples.set(mesh, cache);
  }
  return cache[key];
}

// World positions of every `step`-th vertex of the body mesh, in the current pose: [x, y, z, region].
export function sampleSkin(fighter, step = 6) {
  const mesh = fighter.mesh;
  mesh.updateMatrixWorld(true);
  mesh.skeleton.update();
  return sampleSet(mesh, step).map(([i, region]) => {
    mesh.getVertexPosition(i, _v);
    _v.applyMatrix4(mesh.matrixWorld);
    return [_v.x, _v.y, _v.z, region];
  });
}

// Body as capsules between joints [from, to, radius], slightly thinner than the skin so a hit is a real overlap.
const CAPSULES = [
  ['pelvis', 'spine_02', 0.11], ['spine_02', 'neck_01', 0.11], ['neck_01', 'Head', 0.05], ['Head', 'HEAD_TOP', 0.085],
  ['upperarm_l', 'lowerarm_l', 0.045], ['lowerarm_l', 'hand_l', 0.038], ['upperarm_r', 'lowerarm_r', 0.045], ['lowerarm_r', 'hand_r', 0.038],
  ['thigh_l', 'calf_l', 0.07], ['calf_l', 'foot_l', 0.048], ['thigh_r', 'calf_r', 0.07], ['calf_r', 'foot_r', 0.048],
];

export function capsules(fighter) {
  const head = new THREE.Vector3(...fighter.joint('Head'));
  const neck = new THREE.Vector3(...fighter.joint('neck_01'));
  const top = head.clone().add(head.clone().sub(neck).setLength(0.17));
  const at = (n) => (n === 'HEAD_TOP' ? top.clone() : new THREE.Vector3(...fighter.joint(n)));
  return CAPSULES.map(([a, b, r]) => ({ a: at(a), b: at(b), r, name: `${a}-${b}` }));
}

const _ab = new THREE.Vector3();
const _ap = new THREE.Vector3();
function depthIn(p, c) {
  _ab.subVectors(c.b, c.a);
  _ap.set(p[0] - c.a.x, p[1] - c.a.y, p[2] - c.a.z);
  const t = Math.max(0, Math.min(1, _ap.dot(_ab) / Math.max(1e-9, _ab.lengthSq())));
  const dx = p[0] - (c.a.x + _ab.x * t);
  const dy = p[1] - (c.a.y + _ab.y * t);
  const dz = p[2] - (c.a.z + _ab.z * t);
  return c.r - Math.hypot(dx, dy, dz);
}

// Deepest skin point of `a` inside the body of `b` (metres, 0 = no overlap) and which body parts.
export function overlap(a, b, step = 6) {
  const caps = capsules(b);
  let worst = { depth: 0, part: null };
  for (const p of sampleSkin(a, step)) {
    for (const c of caps) {
      const d = depthIn(p, c);
      if (d > worst.depth) worst = { depth: d, part: c.name };
    }
  }
  return worst;
}

// How far the lowest skin point is below the mat (metres, 0 = nothing below).
export function belowMat(fighter, step = 6) {
  let min = Infinity;
  for (const p of sampleSkin(fighter, step)) min = Math.min(min, p[1]);
  return Math.max(0, -min);
}

// Pose targets that move each body region, and how much of a correction each one takes.
const MOVERS = {
  torso: [['pelvis', 1]],
  armL: [['handL', 1], ['elbowL', 1]], armR: [['handR', 1], ['elbowR', 1]],
  thighL: [['pelvis', 0.5], ['kneeL', 1], ['footL', 0.5]], thighR: [['pelvis', 0.5], ['kneeR', 1], ['footR', 0.5]],
  shinL: [['footL', 1], ['toeL', 1], ['kneeL', 1]], shinR: [['footR', 1], ['toeR', 1], ['kneeR', 1]],
};

// Biggest correction needed per region: out of the mat (straight up) and out of the other fighter's body.
// `limbsOnly`: only arms and legs move out of the other fighter (the bottom fighter's back stays on the mat).
function corrections(fighter, other, step, limbsOnly = false) {
  const caps = other ? capsules(other) : [];
  const fix = {};
  const want = (region, v) => {
    const cur = fix[region];
    if (!cur || v.lengthSq() > cur.lengthSq()) fix[region] = v;
  };
  for (const p of sampleSkin(fighter, step)) {
    if (p[1] < 0) want(p[3], new THREE.Vector3(0, -p[1], 0));
    if (limbsOnly && p[3] === 'torso') continue;
    for (const c of caps) {
      const d = depthIn(p, c);
      if (d <= 0) continue;
      _ab.subVectors(c.b, c.a);
      const t = Math.max(0, Math.min(1, ((p[0] - c.a.x) * _ab.x + (p[1] - c.a.y) * _ab.y + (p[2] - c.a.z) * _ab.z) / Math.max(1e-9, _ab.lengthSq())));
      const n = new THREE.Vector3(p[0] - (c.a.x + _ab.x * t), p[1] - (c.a.y + _ab.y * t), p[2] - (c.a.z + _ab.z * t));
      if (n.lengthSq() < 1e-8) n.set(0, 1, 0);
      want(p[3], n.setLength(d));
    }
  }
  return fix;
}

function applyFix(pose, fix, rate) {
  const moved = {};
  for (const [region, v] of Object.entries(fix)) {
    for (const [key, share] of MOVERS[region]) {
      if (!pose[key]) continue;
      const m = moved[key] ?? new THREE.Vector3();
      // A target moved by two regions takes the bigger push on each axis, not the sum.
      for (const ax of ['x', 'y', 'z']) if (Math.abs(v[ax] * share) > Math.abs(m[ax])) m[ax] = v[ax] * share;
      moved[key] = m;
    }
  }
  for (const [key, m] of Object.entries(moved)) pose[key] = [pose[key][0] + m.x * rate, pose[key][1] + m.y * rate, pose[key][2] + m.z * rate];
  return Object.keys(moved).length;
}

const copy = (p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]));

// Settle a two-fighter pose: lift every body part out of the mat and push the top fighter out of the
// bottom one (and the bottom one out of the mat), moving the pose targets. Returns corrected copies.
export function settle(top, bottom, T, B, { rounds = 16, step = 6, rate = 1.15 } = {}) {
  const t = copy(T);
  const b = copy(B);
  for (let i = 0; i < rounds; i++) {
    bottom.setPose(b);
    top.setPose(t);
    const fb = corrections(bottom, top, step, true);
    const ft = corrections(top, bottom, step);
    const n = applyFix(b, fb, rate) + applyFix(t, ft, rate);
    if (!n) break;
  }
  return { T: t, B: b };
}

