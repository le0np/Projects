import * as THREE from 'three';

/*
 * Extra moves without extra Tripo animations:
 *  - mirrorClip: a left-handed jab becomes a right-handed one (L_/R_ bones swapped and reflected).
 *  - pose overlays: rotations layered on top of a playing clip (an uppercut is a punch with the arm
 *    driven upward and the knees dipping), authored in the character's own frame.
 */

/** Character frame inside a Tripo model (before the yaw offset): +X forward, +Y up, +Z right. */
export type PoseAxis = 'pitch' | 'yaw' | 'roll';

export interface PoseKey {
  bone: string;
  /** pitch: top tilts forward; yaw: turns left (seen from above); roll: top tilts right. */
  axis?: PoseAxis;
  deg?: number;
  /**
   * Instead of a fixed rotation: turn the hand so the held weapon points this way (character frame,
   * +X forward, +Y up, +Z right). Used for thrusts, where the clip holds the weapon upright.
   */
  aim?: readonly [number, number, number];
  /** Window inside the action, as fractions of its duration. Default 0..1. */
  from?: number;
  to?: number;
  /** bell: in and out (default); ramp: eases 0 -> 1 and holds (full spins); hold: quick in, then holds. */
  curve?: 'bell' | 'ramp' | 'hold';
}

export type PoseOverlay = readonly PoseKey[];

const AXES: Record<PoseAxis, THREE.Vector3> = {
  pitch: new THREE.Vector3(0, 0, -1),
  yaw: new THREE.Vector3(0, 1, 0),
  roll: new THREE.Vector3(1, 0, 0),
};

export const partnerBone = (n: string): string => (n.startsWith('L_') ? `R_${n.slice(2)}` : n.startsWith('R_') ? `L_${n.slice(2)}` : n);

/** The same overlay for the mirrored clip: left and right swap, turns and tilts flip. */
export function mirrorOverlay(o: PoseOverlay): PoseKey[] {
  return o.map((k) =>
    k.aim ? { ...k, aim: [k.aim[0], k.aim[1], -k.aim[2]] as const } : { ...k, bone: partnerBone(k.bone), deg: k.axis === 'pitch' ? k.deg : -(k.deg ?? 0) },
  );
}

/** Weight of a key at action progress u (0..1). */
export function overlayWeight(k: PoseKey, u: number): number {
  const a = k.from ?? 0;
  const b = k.to ?? 1;
  if (u <= a) return 0;
  const x = Math.min(1, (u - a) / Math.max(1e-4, b - a));
  switch (k.curve ?? 'bell') {
    case 'ramp':
      return x * x * (3 - 2 * x);
    case 'hold':
      return Math.min(1, x / 0.3);
    default:
      return u >= b ? 0 : Math.sin(x * Math.PI);
  }
}

const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _inv = new THREE.Quaternion();
const _mq = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const _bq = new THREE.Quaternion();
const _from = new THREE.Vector3();
const _id = new THREE.Quaternion();

/**
 * Applies an overlay after the mixer has posed the skeleton. Keys must be sorted parent-first
 * (see sortOverlay) so children follow. `model` is the Tripo scene root (defines the character frame).
 */
export function applyOverlay(
  model: THREE.Object3D,
  bones: Map<string, THREE.Bone>,
  overlay: PoseOverlay,
  u: number,
  scale = 1,
  /** Weapon axis in the hand bone's local frame (for `aim` keys). */
  weaponAxis: THREE.Vector3 = new THREE.Vector3(0, 0, 1),
): void {
  model.getWorldQuaternion(_mq);
  for (const k of overlay) {
    const bone = bones.get(k.bone);
    if (!bone?.parent) continue;
    const w = overlayWeight(k, u) * scale;
    if (Math.abs(w) < 1e-4) continue;
    if (k.aim) {
      bone.getWorldQuaternion(_bq);
      _from.copy(weaponAxis).applyQuaternion(_bq).normalize();
      _axis.set(k.aim[0], k.aim[1], k.aim[2]).normalize().applyQuaternion(_mq);
      _q.setFromUnitVectors(_from, _axis);
      _q.slerpQuaternions(_id, _q.clone(), Math.min(1, w));
    } else {
      _axis.copy(AXES[k.axis ?? 'pitch']).applyQuaternion(_mq);
      _q.setFromAxisAngle(_axis, THREE.MathUtils.degToRad(k.deg ?? 0) * w);
    }
    bone.parent.getWorldQuaternion(_pq);
    // local' = P^-1 * R * P * local
    _inv.copy(_pq).invert().multiply(_q).multiply(_pq);
    bone.quaternion.premultiply(_inv);
  }
}

/** Sorts overlay keys so that parents are rotated before their children. */
export function sortOverlay(overlay: PoseOverlay, bones: Map<string, THREE.Bone>): PoseKey[] {
  const depth = (n: string) => {
    let d = 0;
    let o: THREE.Object3D | null | undefined = bones.get(n);
    while (o?.parent) {
      d++;
      o = o.parent;
    }
    return d;
  };
  return [...overlay].sort((a, b) => depth(a.bone) - depth(b.bone));
}

/**
 * Mirrors a skeletal clip across the character's sagittal plane. Works in model space with a rest-pose
 * correction, so it does not depend on how the rig orients left and right bone axes.
 * `root` must be a separate copy of the rigged scene (it is posed while sampling).
 */
export function mirrorClip(clip: THREE.AnimationClip, root: THREE.Object3D, name = `${clip.name}_m`, fps = 30): THREE.AnimationClip {
  const bones: THREE.Bone[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone);
  });
  const byName = new Map(bones.map((b) => [b.name, b]));
  root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert();
  const modelOf = (o: THREE.Object3D) => rootInv.clone().multiply(o.matrixWorld);
  const rest = new Map(bones.map((b) => [b.name, modelOf(b)]));

  // Mirror plane: through the root bone, normal = the rig's left/right axis (snapped to the dominant
  // model axis, since thighs and hands in a rest pose are rarely perfectly level).
  const pos = (b: string) => new THREE.Vector3().setFromMatrixPosition(rest.get(b) ?? new THREE.Matrix4());
  const lat = pos('R_Thigh').sub(pos('L_Thigh')).add(pos('R_Hand').sub(pos('L_Hand')));
  const ax = Math.abs(lat.x) > Math.abs(lat.z) ? (Math.abs(lat.x) > Math.abs(lat.y) ? 'x' : 'y') : Math.abs(lat.z) > Math.abs(lat.y) ? 'z' : 'y';
  const n = new THREE.Vector3(ax === 'x' ? 1 : 0, ax === 'y' ? 1 : 0, ax === 'z' ? 1 : 0);
  const c = bones.length ? pos(bones[0].name) : new THREE.Vector3();
  const S0 = new THREE.Matrix4().set(
    1 - 2 * n.x * n.x, -2 * n.x * n.y, -2 * n.x * n.z, 0,
    -2 * n.y * n.x, 1 - 2 * n.y * n.y, -2 * n.y * n.z, 0,
    -2 * n.z * n.x, -2 * n.z * n.y, 1 - 2 * n.z * n.z, 0,
    0, 0, 0, 1,
  );
  // Reflect about the plane through the midpoint between the hips.
  const S = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(S0).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
  const reflect = (m: THREE.Matrix4) => S.clone().multiply(m).multiply(S);
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const quatOf = (m: THREE.Matrix4) => (m.decompose(p, q, s), q.clone());
  // Rest correction: reflected partner rest orientation -> this bone's rest orientation.
  const corr = new Map<string, THREE.Quaternion>();
  const restScale = new Map<string, THREE.Vector3>();
  for (const b of bones) {
    const pr = rest.get(partnerBone(b.name)) ?? rest.get(b.name)!;
    corr.set(b.name, quatOf(reflect(pr)).invert().multiply(quatOf(rest.get(b.name)!)));
    rest.get(b.name)!.decompose(p, q, s);
    restScale.set(b.name, s.clone());
  }

  // Which bones / properties the clip animates.
  const wanted = new Map<string, Set<string>>();
  for (const t of clip.tracks) {
    const pb = THREE.PropertyBinding.parseTrackName(t.name);
    if (!byName.has(pb.nodeName)) continue;
    if (!wanted.has(pb.nodeName)) wanted.set(pb.nodeName, new Set());
    wanted.get(pb.nodeName)!.add(pb.propertyName);
  }

  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.play();
  const frames = Math.max(2, Math.ceil(clip.duration * fps) + 1);
  const times = new Float32Array(frames);
  const out = new Map<string, { pos: number[]; quat: number[] }>();
  for (const b of bones) out.set(b.name, { pos: [], quat: [] });
  const prevQ = new Map<string, THREE.Quaternion>();

  for (let f = 0; f < frames; f++) {
    const t = Math.min(clip.duration, (f / (frames - 1)) * clip.duration);
    times[f] = t;
    action.time = t;
    mixer.update(0);
    root.updateMatrixWorld(true);
    const posed = new Map(bones.map((b) => [b.name, modelOf(b)]));
    const mirrored = new Map<string, THREE.Matrix4>();
    for (const b of bones) {
      const src = posed.get(partnerBone(b.name)) ?? posed.get(b.name)!;
      reflect(src).decompose(p, q, s);
      q.multiply(corr.get(b.name)!);
      mirrored.set(b.name, new THREE.Matrix4().compose(p, q, restScale.get(b.name)!));
    }
    for (const b of bones) {
      const parent = b.parent;
      const pm = parent && (parent as THREE.Bone).isBone ? mirrored.get(parent.name)! : parent ? modelOf(parent) : new THREE.Matrix4();
      const local = pm.clone().invert().multiply(mirrored.get(b.name)!);
      local.decompose(p, q, s);
      const prev = prevQ.get(b.name);
      if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      prevQ.set(b.name, q.clone());
      const o = out.get(b.name)!;
      o.pos.push(p.x, p.y, p.z);
      o.quat.push(q.x, q.y, q.z, q.w);
    }
  }
  action.stop();
  mixer.uncacheRoot(root);

  const tracks: THREE.KeyframeTrack[] = [];
  for (const [bone, props] of wanted) {
    const o = out.get(bone)!;
    if (props.has('quaternion')) tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, o.quat));
    if (props.has('position')) tracks.push(new THREE.VectorKeyframeTrack(`${bone}.position`, times, o.pos));
  }
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

const mirrorCache = new WeakMap<Map<string, THREE.AnimationClip>, Map<string, THREE.AnimationClip>>();

/**
 * Adds `<clip>_m` mirrored versions of the listed clips. Cached per clip set, so every instance of a
 * model shares them. `rigged` returns a copy of the scene, which is posed while sampling.
 */
export function withMirroredClips(clips: Map<string, THREE.AnimationClip>, rigged: () => THREE.Object3D, names: readonly string[]): Map<string, THREE.AnimationClip> {
  const cached = mirrorCache.get(clips);
  if (cached) return cached;
  const all = new Map(clips);
  const todo = names.filter((n) => clips.has(n) && !clips.has(`${n}_m`));
  if (todo.length) {
    const copy = rigged();
    for (const n of todo) all.set(`${n}_m`, mirrorClip(clips.get(n)!, copy));
  }
  mirrorCache.set(clips, all);
  return all;
}
