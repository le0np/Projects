// Technique clips for the 3D fighters. Pure data, no Three.js.
// A clip shapes how one action looks: keyframes of offsets added to the pose targets of the attacker (a)
// and the defender (d) while the fighters go from the start position to the end position (or stay put,
// for a submission or a failed attempt). Offsets are 0 at the start and at the end, so a clip never
// changes where a position begins or ends; it only adds the movement in between.
//
// Offsets are in the world frame of the start position as poses3d.js draws it (x along the fight, y up,
// z towards the camera), for the attacker in their usual slot: a 'top' action by the top fighter (T),
// a 'bottom' action by B, a standing action by the left fighter (T). For a standing action by the right
// fighter the clip is mirrored. Point keys (pelvis, handL, footR, kneeL, ...) move by [x, y, z] metres;
// direction keys (hipUp, chestFwd, ...) get [x, y, z] added before they are normalised.

// K(t, a, d, { A, D }): offsets for attacker and defender at time t, and optional absolute targets
// (A for the attacker, D for the defender) that the pose is pulled to at that moment, for end shapes a
// position cannot express (the attacker lying across the opponent in an armbar).
const K = (t, a = {}, d = {}, abs = {}) => ({ t, a, d, A: abs.A ?? {}, D: abs.D ?? {} });
const MIRROR_KEY = (k) => (k.endsWith('L') ? `${k.slice(0, -1)}R` : k.endsWith('R') ? `${k.slice(0, -1)}L` : k);

export function mirrorOffsets(o) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [MIRROR_KEY(k), [-v[0], v[1], v[2]]]));
}

// Mirror absolute targets ({ key: { v, w } }) the same way.
export function mirrorAbsolute(o) {
  return Object.fromEntries(Object.entries(o).map(([k, { v, w }]) => [MIRROR_KEY(k), { v: [-v[0], v[1], v[2]], w }]));
}

// ---------------------------------------------------------------- clips by action id
export const CLIPS = {
  // Standing
  td_double: { dur: 1.5, keys: [
    K(0.15, { pelvis: [0.05, -0.28, 0], chestUp: [0.9, 0, 0], handL: [0.15, -0.45, 0], handR: [0.15, -0.35, 0], footL: [0.2, 0, 0] }), // level change
    K(0.38, { pelvis: [0.42, -0.34, 0], chestUp: [1.2, 0, 0], handL: [0.4, -0.7, 0.05], handR: [0.4, -0.7, -0.05], kneeL: [0.3, -0.3, 0] }, // penetration step, hands behind the knees
      { pelvis: [0, 0.04, 0], handL: [-0.25, -0.2, 0], handR: [-0.25, -0.2, 0], chestUp: [-0.3, 0, 0] }),
    K(0.62, { pelvis: [0.3, -0.15, 0], chestUp: [0.8, -0.2, 0] }, { pelvis: [0.05, 0.1, 0], chestUp: [-0.6, -0.2, 0], footL: [0.15, 0.25, 0], footR: [0.15, 0.25, 0] }), // lift and drive
  ] },
  td_single: { dur: 1.5, keys: [
    K(0.18, { pelvis: [0.08, -0.25, 0], chestUp: [0.8, 0, 0], handL: [0.2, -0.5, 0.1], handR: [0.2, -0.5, 0.15], footL: [0.18, 0, 0] }),
    K(0.42, { pelvis: [0.35, -0.3, 0.05], chestUp: [1.0, 0, 0.2], handL: [0.4, -0.75, 0.15], handR: [0.4, -0.65, 0.2] }, // grabs one leg
      { footL: [0.1, 0.35, 0.1], kneeL: [0.1, 0.25, 0.05], chestUp: [-0.3, 0, -0.2], handL: [-0.2, -0.3, 0] }), // that leg comes up, hopping
    K(0.66, { pelvis: [0.3, -0.1, 0], chestUp: [0.6, 0, 0] }, { pelvis: [0, 0.05, -0.1], chestUp: [-0.6, -0.2, -0.3], footL: [0.1, 0.3, 0] }), // trips the other leg
  ] },
  pull: { dur: 1.3, keys: [
    K(0.25, { handL: [0.2, 0.1, 0], handR: [0.2, 0.1, 0], footL: [0.25, 0.35, 0], kneeL: [0.25, 0.3, 0] }), // grips, one foot up on the hip
    K(0.55, { pelvis: [0.1, -0.35, 0], chestUp: [-0.6, -0.2, 0], footR: [0.2, 0.3, 0], footL: [0.15, 0.25, 0] }, { chestUp: [0.4, 0, 0], pelvis: [0.05, -0.1, 0] }), // sits back, pulls him in
  ] },
  snap: { dur: 1.2, keys: [
    K(0.3, { handL: [0.1, 0.15, 0], handR: [0.1, 0.15, 0], chestUp: [0.2, 0, 0] }, { chestUp: [0.2, 0, 0] }), // hands on the back of the head
    K(0.55, { pelvis: [-0.15, -0.1, 0], handL: [0.1, -0.35, 0], handR: [0.1, -0.35, 0], chestUp: [-0.2, 0, 0] }, { pelvis: [0.05, -0.2, 0], chestUp: [1.2, -0.6, 0], headUp: [1, -0.6, 0] }), // snaps the head down
  ] },
  guill_st: { dur: 1.6, hold: true, keys: [
    K(0.25, { handL: [0.2, -0.15, 0], handR: [0.15, -0.2, 0], chestUp: [0.2, 0, 0] }, { chestUp: [0.7, -0.4, 0], pelvis: [0, -0.12, 0] }), // head under the armpit
    K(0.6, { pelvis: [-0.12, -0.05, 0], chestUp: [-0.4, 0, 0], handL: [-0.1, -0.05, 0], handR: [-0.1, -0.1, 0] }, { chestUp: [1.1, -0.6, 0], pelvis: [-0.08, -0.15, 0], headUp: [1.2, -0.8, 0] }), // arches back and squeezes
  ] },

  // Closed guard, bottom
  hipBump: { dur: 1.7, keys: [
    K(0.22, { chestUp: [1.3, 1.1, 0], pelvis: [0.03, 0.02, 0], handR: [-0.15, -0.3, 0.2], handL: [0.25, 0.25, -0.05] }), // sits up, posts the right hand
    K(0.45, { chestUp: [1.1, 1.0, 0.3], pelvis: [0.08, 0.12, 0.08], handL: [0.3, 0.3, -0.15] }, { chestUp: [0, -0.1, -0.7], handR: [0, -0.15, -0.2], pelvis: [0, 0, -0.05] }), // bumps the hip into him, he tips over
    K(0.7, { pelvis: [0, 0.08, -0.12], chestUp: [0.3, 0.2, -0.6] }, { pelvis: [0, 0.05, -0.18], chestUp: [0, -0.4, -1.0] }), // rolls over with him, low
  ] },
  scissor: { dur: 1.6, keys: [
    K(0.25, { pelvis: [0, 0.02, 0.12], chestFwd: [0, 0, 0.6], kneeR: [0.05, 0.25, 0.1], footR: [0.15, 0.35, 0.1], footL: [0, -0.3, -0.15], kneeL: [0, -0.2, -0.1] }), // on the side, knee across the belly
    K(0.5, { footL: [-0.15, -0.2, 0.2], footR: [0.2, 0.15, -0.15], handL: [0.15, 0.1, 0] }, { pelvis: [-0.05, -0.05, 0.1], chestUp: [0, -0.2, 0.5] }), // the legs scissor
    K(0.72, { pelvis: [0, 0.18, 0.05] }, { pelvis: [-0.05, 0.1, 0.12], chestUp: [0, -0.4, 0.8] }),
  ] },
  flower: { dur: 1.6, keys: [
    K(0.25, { handL: [0.15, 0.05, 0.05], handR: [0.2, -0.15, 0.15], footR: [0.1, -0.2, 0.15], chestFwd: [0, 0, 0.3] }), // grabs the arm and the leg
    K(0.5, { footL: [0.15, 0.35, -0.1], kneeL: [0.1, 0.3, -0.1], pelvis: [0, 0.05, 0.05] }, { pelvis: [0, 0.18, -0.12], chestUp: [0, 0.1, -0.6] }), // the leg swings him like a pendulum
    K(0.72, { pelvis: [0, 0.2, 0], chestUp: [0.6, 0.6, -0.3] }, { pelvis: [0, 0.12, -0.15], chestUp: [0, -0.3, -0.9] }),
  ] },
  armbar_cg: { dur: 1.9, hold: true, keys: [
    K(0.25, { handL: [0.05, 0.1, 0.08], handR: [0.05, 0.1, -0.05], pelvis: [0, 0, 0.12], hipFwd: [0, 0, 0.5], footL: [0, 0.12, -0.12] }, { handL: [-0.1, 0, 0] }), // controls the arm, turns to the side
    K(0.5, { footR: [-0.25, 0.4, 0.15], kneeR: [-0.1, 0.35, 0.1], pelvis: [0.03, 0.08, 0.12] }, { chestUp: [-0.3, -0.2, 0.1] }), // swings the leg up over the face
    // Hips up under the shoulder, one leg over the face, the other across the back; his arm straight to the chest.
    K(0.85, {}, { pelvis: [-0.04, -0.06, 0] }, {
      A: {
        pelvis: [0.2, 0.22, 0.12], hipUp: [-0.7, -0.15, -0.7], hipFwd: [0, 1, 0], chestUp: [-0.75, 0, -0.65], chestFwd: [0, 1, 0],
        footR: [0.4, 0.78, -0.3], kneeR: [0.12, 0.8, 0.02], footL: [0.56, 0.5, 0.34], kneeL: [0.32, 0.58, 0.38],
        handL: [0.04, 0.4, 0.06], elbowL: [-0.1, 0.25, -0.2], handR: [0.08, 0.42, 0.12], elbowR: [0.05, 0.25, 0.4],
      },
      D: { handL: [0.08, 0.48, 0.08], elbowL: [0.22, 0.6, 0.2], chestUp: [-1, 0.75, 0], headUp: [-1, 0.4, 0] }, // pulled down, arm stretched
    }),
  ] },
  triangle_cg: { dur: 1.7, hold: true, keys: [
    K(0.25, { handL: [0.1, 0.05, 0.1], footL: [0, 0.25, -0.05], kneeL: [0, 0.2, 0] }, { handR: [-0.15, 0, 0] }), // one arm in, one arm out
    K(0.55, { footL: [-0.25, 0.4, 0.2], kneeL: [-0.05, 0.35, -0.05], footR: [-0.05, 0.25, -0.05] }, { chestUp: [-0.4, -0.2, 0], pelvis: [-0.04, -0.03, 0] }), // shin across the neck
    K(0.82, { footR: [-0.15, 0.3, 0.12], kneeR: [0, 0.3, -0.1], handL: [0.15, 0.25, 0], handR: [0.15, 0.25, 0] }, { chestUp: [-0.6, -0.4, 0], headUp: [-0.5, -0.4, 0] }), // locks the legs, pulls the head down
  ] },
  kimura_cg: { dur: 1.6, hold: true, keys: [
    K(0.25, { chestUp: [0.8, 0.8, 0.2], handR: [0.2, 0.15, 0.05], handL: [0.15, 0.25, 0.15] }, { handL: [-0.1, -0.05, 0] }), // sits up, figure-four grip
    K(0.6, { chestUp: [0.2, 0.2, -0.4], pelvis: [0, 0, 0.1], handR: [0, 0.2, -0.15], handL: [0, 0.25, -0.1] }, { chestUp: [-0.1, -0.2, 0.3], handL: [-0.05, 0.15, -0.2] }), // falls back and turns the arm behind
  ] },
  guill_cg: { dur: 1.6, hold: true, keys: [
    K(0.3, { chestUp: [1.0, 0.8, 0], handL: [0.2, 0.25, 0], handR: [0.2, 0.25, 0] }, { chestUp: [-0.6, -0.4, 0] }), // sits up, arm around the neck
    K(0.65, { chestUp: [0.2, 0, 0], pelvis: [0, 0.06, 0], handL: [0.05, 0.25, 0], handR: [0.05, 0.25, 0], footL: [0, 0.15, 0], footR: [0, 0.15, 0] }, { chestUp: [-0.9, -0.6, 0], pelvis: [-0.06, -0.04, 0] }), // falls back, closes the guard, squeezes
  ] },

  // Passes and top transitions
  toreando: { dur: 1.6, keys: [
    K(0.25, { pelvis: [0, 0.3, 0], hipUp: [0, 1, 0], chestUp: [-0.2, 0.8, 0], handL: [-0.15, -0.2, 0.1], handR: [-0.15, -0.2, -0.1] }, { kneeL: [0, 0.1, 0], kneeR: [0, 0.1, 0] }), // stands up, grips the knees
    K(0.5, { pelvis: [-0.05, 0.2, 0.35], footL: [-0.2, 0, 0.45], footR: [0, 0, 0.3], handL: [0, 0, -0.25], handR: [0, 0, -0.25] }, { kneeL: [0, 0.05, -0.3], kneeR: [0, 0.05, -0.3], footL: [0, 0, -0.25], footR: [0, 0, -0.25] }), // throws the legs aside and runs around
    K(0.75, { pelvis: [-0.1, 0.05, 0.25], chestUp: [0, -0.3, 0] }),
  ] },
  kneeSlice_b: { dur: 1.5, keys: [
    K(0.3, { kneeR: [-0.2, 0, 0.05], pelvis: [0, 0.08, 0], chestUp: [-0.4, 0, 0], handR: [-0.1, -0.1, 0.1] }, { kneeR: [0, -0.05, 0] }), // knee slides across the thigh
    K(0.6, { pelvis: [-0.15, -0.02, 0.25], kneeR: [-0.3, 0, 0.1], chestUp: [-0.6, -0.3, 0.2] }, { footR: [0, 0, -0.15] }),
  ] },
  sideToMount: { dur: 1.4, keys: [
    K(0.3, { kneeR: [0.05, 0.05, -0.25], footR: [0.05, 0.1, -0.3] }), // knee slides across the belly
    K(0.6, { pelvis: [0.05, 0.12, -0.25], kneeR: [0.05, 0.1, -0.5], footR: [0.1, 0.15, -0.6] }, { handR: [0.1, 0.05, 0] }), // leg goes over
  ] },
  sideToKob: { dur: 1.1, keys: [K(0.45, { pelvis: [0, 0.18, 0.1], chestUp: [0, 0.6, 0.3] })] },
  mountToBack: { dur: 1.6, keys: [
    K(0.3, { pelvis: [0, 0.1, 0], chestUp: [-0.2, 0.2, 0] }, { pelvis: [0, 0.02, 0.1], chestUp: [0, 0.1, 0.4], hipFwd: [0, -0.2, 0.6] }), // he turns to the side
    K(0.6, { pelvis: [0.1, 0.05, 0.1], footL: [0.1, 0.1, -0.1], handL: [0.1, 0.1, 0.1], handR: [0.1, 0.15, -0.1] }, { pelvis: [0.05, 0.08, 0.05], hipFwd: [0.3, -0.8, 0.5] }), // follows and takes the back
  ] },

  // Escapes
  mountUpa_e: { dur: 1.6, keys: [
    K(0.25, { handL: [0.12, 0.05, 0.12], footL: [-0.25, 0, 0.05], kneeL: [-0.15, 0.2, 0], footR: [-0.25, 0, -0.05], kneeR: [-0.15, 0.2, 0] }), // traps the arm, feet close to the hips
    K(0.5, { pelvis: [0, 0.3, 0], hipUp: [0, 0.6, 0] }, { pelvis: [0, 0.22, 0], chestUp: [-0.6, -0.2, 0], handL: [-0.25, -0.1, 0.15], handR: [-0.25, -0.1, -0.15] }), // the bridge
    K(0.72, { pelvis: [0, 0.2, -0.1], chestFwd: [0, 0, -0.8] }, { pelvis: [0, 0.1, -0.2], chestUp: [0, -0.3, -0.8] }), // rolls him over the shoulder
  ] },
  elbowKnee_e: { dur: 1.6, keys: [
    K(0.3, { pelvis: [-0.15, 0.03, 0.15], hipFwd: [0, 0, 0.6], handL: [0.15, 0.05, -0.05], kneeR: [-0.1, 0.15, -0.1] }), // turns to the side, elbow to the knee
    K(0.6, { pelvis: [-0.25, 0.02, 0.1], kneeR: [0.05, 0.2, -0.15], footR: [0.15, 0.15, -0.1] }, { kneeL: [0, 0.05, 0] }), // shrimps out, knee back in
  ] },
  sideShrimp_e: { dur: 1.5, keys: [
    K(0.3, { handL: [0, 0.2, 0.15], handR: [0, 0.2, 0.1], footL: [0.1, 0, 0.1], kneeL: [0, 0.2, 0.1] }), // frames on the neck and hip
    K(0.6, { pelvis: [-0.2, 0.04, -0.15], hipFwd: [0, 0, 0.6], kneeR: [0.1, 0.25, 0.2] }, { pelvis: [0.03, 0.05, 0.05] }), // shrimps away, knee in
  ] },
  backEscape_e: { dur: 1.6, keys: [
    K(0.3, { pelvis: [0.08, -0.05, 0.12], chestUp: [-0.2, -0.2, 0.3], handL: [0, 0.1, 0], handR: [0, 0.15, 0] }), // shoulders to the mat on the choking side
    K(0.6, { pelvis: [0, 0, 0.25], hipFwd: [-0.6, 0, 0.6], chestFwd: [-0.6, 0, 0.6] }, { pelvis: [0, 0, -0.05] }), // turns into him
  ] },

  // Submissions on top
  armbar_m: { dur: 2.0, hold: true, keys: [
    K(0.22, { pelvis: [-0.05, 0.08, 0], chestUp: [-0.3, 0.4, 0], handL: [0.05, 0.05, 0.1], handR: [0.05, 0.05, 0.12] }, { handR: [0, 0.2, 0] }), // high mount, isolates the right arm
    K(0.5, { pelvis: [-0.12, 0.12, 0.2], footL: [-0.4, 0.3, -0.1], kneeL: [-0.3, 0.4, -0.05], chestUp: [0.2, 0.2, 0.4] }, { handR: [0, 0.3, 0.08] }), // pivots, swings the left leg over the head
    // Lies back across him: legs over the face and the chest, his right arm straight between the legs.
    K(0.85, {}, {}, {
      A: {
        pelvis: [-0.38, 0.15, 0.36], hipUp: [0.05, 0.05, 1], hipFwd: [0, 1, 0], chestUp: [0, 0.12, 1], chestFwd: [0, 1, -0.12], headUp: [0, 0.4, 1], headFwd: [0, 1, -0.4],
        footL: [-0.72, 0.1, -0.35], kneeL: [-0.66, 0.34, -0.02], footR: [-0.18, 0.1, -0.35], kneeR: [-0.22, 0.34, -0.02],
        handL: [-0.43, 0.42, 0.2], elbowL: [-0.6, 0.25, 0.42], handR: [-0.36, 0.44, 0.24], elbowR: [-0.18, 0.25, 0.45],
      },
      D: { handR: [-0.42, 0.55, 0.14], elbowR: [-0.44, 0.38, 0.3], handL: [-0.32, 0.32, 0.02], headUp: [-1, 0.3, -0.3] },
    }),
  ] },
  americana_m: { dur: 1.6, hold: true, keys: [
    K(0.3, { chestUp: [-0.5, -0.2, 0], handL: [-0.15, -0.15, -0.1], handR: [-0.15, -0.15, -0.05] }, { handR: [-0.05, -0.1, -0.1] }), // pins the wrist to the mat
    K(0.7, { chestUp: [-0.6, -0.3, -0.2], handL: [-0.1, -0.1, -0.2], handR: [-0.05, 0, -0.2] }, { handR: [0.05, -0.05, -0.2] }), // paints the floor
  ] },
  americana_s: { dur: 1.6, hold: true, keys: [
    K(0.3, { handL: [-0.05, -0.05, -0.1], handR: [-0.2, -0.05, -0.1], chestUp: [0, -0.1, -0.2] }, { handL: [0, -0.15, 0.1] }),
    K(0.7, { handL: [0.05, -0.05, -0.15], handR: [-0.05, 0, -0.15] }, { handL: [0.1, -0.05, 0.05] }),
  ] },
  kimura_s: { dur: 1.6, hold: true, keys: [
    K(0.3, { handL: [0, 0.1, -0.1], handR: [-0.1, 0.1, -0.15], chestUp: [0, 0.2, -0.1] }, { handL: [0, 0.2, 0.1] }),
    K(0.7, { pelvis: [0, 0.08, 0], handL: [0.1, 0.2, 0], handR: [0, 0.25, -0.05], chestUp: [0.2, 0.4, 0.1] }, { handL: [0.15, 0.3, 0.2] }), // lifts the arm behind his back
  ] },
  armbar_k: { dur: 1.7, hold: true, keys: [
    K(0.3, { pelvis: [-0.1, 0, -0.1], handL: [0, 0.1, -0.05], handR: [0, 0.1, -0.05] }, { handR: [0, 0.2, 0.1] }), // pulls the arm up
    K(0.65, { pelvis: [-0.15, -0.3, -0.25], chestUp: [0, -0.4, 0.8], footL: [-0.3, 0.05, -0.3], footR: [0.2, 0.05, -0.25] }, { handR: [0, 0.3, 0.2] }), // steps over the head and sits back
  ] },
  rnc_b: { dur: 1.8, hold: true, keys: [
    K(0.3, { handR: [0.06, 0.12, 0.05], handL: [0.05, 0.15, 0.05] }, { handL: [-0.03, 0.08, 0], handR: [-0.03, 0.08, 0] }), // the arm slides under the chin
    // The choke: elbow under the chin, the right forearm along the far side of the neck, the left hand behind the head.
    K(0.75, { chestUp: [-0.3, 0, 0], footL: [0, 0.05, 0], footR: [0, 0.05, 0] }, { chestUp: [-0.3, 0, 0], headUp: [-0.2, 0.3, 0] }, {
      A: { elbowR: [-0.05, 0.58, 0.1], handR: [-0.14, 0.7, -0.12], elbowL: [-0.35, 0.55, -0.25], handL: [-0.24, 0.76, -0.04] },
      D: { handL: [-0.04, 0.6, 0.04], handR: [-0.02, 0.58, 0.1], elbowL: [0.15, 0.4, -0.2], elbowR: [0.15, 0.4, 0.25] }, // pulls at the arm
    }),
  ] },
  darce_h: { dur: 1.6, hold: true, keys: [
    K(0.3, { handR: [0.1, -0.1, -0.1], handL: [0.05, -0.05, 0.1] }),
    K(0.7, { pelvis: [0, 0.05, -0.1], chestUp: [0, -0.2, -0.3], handL: [0.05, 0, 0.15] }, { chestUp: [0, 0.2, 0.3] }), // sprawls and squeezes
  ] },
  guill_t: { dur: 1.6, hold: true, keys: [
    K(0.3, { handL: [-0.05, -0.15, 0], handR: [-0.05, -0.15, 0] }, { headUp: [0.4, -0.3, 0] }),
    K(0.7, { pelvis: [0.05, 0.1, 0], chestUp: [0.4, 0.4, 0], handL: [0.05, 0.05, 0], handR: [0.05, 0.05, 0] }, { pelvis: [0.05, 0.05, 0], chestUp: [0, 0.3, 0] }), // pulls up on the neck
  ] },
  turtleBack: { dur: 1.6, keys: [
    K(0.35, { pelvis: [-0.3, 0.15, 0.25], footL: [-0.3, 0, 0.3], footR: [-0.4, 0, 0.1] }), // circles to the side
    K(0.65, { pelvis: [-0.5, 0.15, 0.15], footL: [-0.4, 0.15, 0.1], footR: [-0.4, 0.15, -0.1] }), // hooks in
  ] },
};

// ---------------------------------------------------------------- generic clips by kind (towards +x)
// For techniques without a clip of their own; the renderer mirrors them when the opponent is at -x.
export const KIND_CLIPS = {
  takedown: CLIPS.td_double,
  sweep: { dur: 1.5, keys: [
    K(0.3, { pelvis: [0.04, 0.05, 0.08], footL: [0.1, 0.25, 0], footR: [0.1, 0.25, 0], handL: [0.1, 0.1, 0] }),
    K(0.6, { pelvis: [0.05, 0.18, 0] }, { pelvis: [0, 0.15, 0.1], chestUp: [0, -0.2, 0.6] }),
  ] },
  pass: { dur: 1.5, keys: [
    K(0.3, { pelvis: [0.08, 0.12, 0], handL: [0.1, -0.1, 0], handR: [0.1, -0.1, 0] }),
    K(0.6, { pelvis: [0.15, 0.06, 0.25], chestUp: [0.4, -0.2, 0] }),
  ] },
  escape: { dur: 1.5, keys: [
    K(0.3, { handL: [0.08, 0.15, 0], handR: [0.08, 0.15, 0], kneeL: [0, 0.15, 0] }),
    K(0.6, { pelvis: [-0.18, 0.04, 0.1], hipFwd: [0, 0, 0.5] }),
  ] },
  transition: { dur: 1.2, keys: [K(0.45, { pelvis: [0.05, 0.12, 0], chestUp: [0.2, 0.3, 0] })] },
  pull: CLIPS.pull,
  sub: { dur: 1.5, hold: true, keys: [
    K(0.35, { handL: [0.1, 0.05, 0], handR: [0.1, 0.05, 0] }, { handL: [0, 0.1, 0], handR: [0, 0.1, 0] }),
    K(0.75, { handL: [-0.05, 0.1, 0], handR: [-0.05, 0.1, 0], chestUp: [-0.3, 0.1, 0] }, { chestUp: [0.2, 0.1, 0] }),
  ] },
};

const smooth = (x) => x * x * (3 - 2 * x);

// Offsets of a clip at normalised time t (0..1).
// outcome: 'success' plays it through; 'fail' goes in for the first half and comes back;
// 'pending' (the player is deciding) holds in the middle of the attempt.
// A submission clip ('hold') that succeeds stays at its last key.
export function clipAt(clip, t, outcome = 'success') {
  let tt = Math.max(0, Math.min(1, t));
  if (outcome === 'fail') tt = tt < 0.5 ? tt : 1 - tt;
  if (outcome === 'pending') tt = Math.min(tt, 0.42);
  const last = clip.keys[clip.keys.length - 1];
  const hold = clip.hold && outcome === 'success';
  const keys = [K(0), ...clip.keys, hold ? { ...last, t: 1 } : K(1)];
  let i = 0;
  while (i < keys.length - 2 && tt > keys[i + 1].t) i++;
  const k0 = keys[i];
  const k1 = keys[i + 1];
  const w = smooth(k1.t > k0.t ? (tt - k0.t) / (k1.t - k0.t) : 1);
  const mix = (a, b) => {
    const out = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const x = a[key] ?? [0, 0, 0];
      const y = b[key] ?? [0, 0, 0];
      out[key] = x.map((v, j) => v + (y[j] - v) * w);
    }
    return out;
  };
  // Absolute targets: weight 1 at a key that has the target, 0 at a key that does not.
  const mixAbs = (a, b) => {
    const out = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const wa = key in a ? 1 : 0;
      const wb = key in b ? 1 : 0;
      const weight = wa + (wb - wa) * w;
      if (weight <= 0) continue;
      const v = wa && wb ? a[key].map((x, j) => x + (b[key][j] - x) * w) : (a[key] ?? b[key]);
      out[key] = { v, w: weight };
    }
    return out;
  };
  return { a: mix(k0.a, k1.a), d: mix(k0.d, k1.d), A: mixAbs(k0.A, k1.A), D: mixAbs(k0.D, k1.D) };
}

// The clip for an action (its own, or the generic one for its kind).
export function clipFor(action) {
  return CLIPS[action.id] ?? KIND_CLIPS[action.kind] ?? null;
}

// ---------------------------------------------------------------- applying clips to a pose
const DIR_PAIRS = [['hipUp', 'hipFwd'], ['chestUp', 'chestFwd'], ['headUp', 'headFwd']];
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
// Rotate v by the smallest rotation that takes direction `from` to direction `to` (Rodrigues).
export function rotateLike(from, to, v) {
  const a = unit(from);
  const b = unit(to);
  const axis = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sin = Math.hypot(...axis);
  const cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (sin < 1e-6) return v;
  const k = axis.map((x) => x / sin);
  const kv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const kxv = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return v.map((x, i) => x * cos + kxv[i] * sin + k[i] * kv * (1 - cos));
}
const addV = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// Pose targets of one fighter with technique clips applied. `entries`: [{ clip, t, outcome, side: 'a'|'d',
// mirror }]. First the offsets of every clip, then the tilt coupling (a clip that tilts a body part's up
// direction turns its front with it, so up and front never end up parallel and the body never flips),
// then the absolute targets (end shapes). Returns a new pose.
export function applyClips(pose, entries) {
  const p = { ...pose };
  const before = Object.fromEntries(DIR_PAIRS.flat().map((k) => [k, p[k]]));
  const parts = entries.map((c) => {
    const off = clipAt(c.clip, c.t, c.outcome);
    const mine = c.side === 'a' ? off.a : off.d;
    const abs = c.side === 'a' ? off.A : off.D;
    return { mine: c.mirror ? mirrorOffsets(mine) : mine, abs: c.mirror ? mirrorAbsolute(abs) : abs };
  });
  for (const { mine } of parts) for (const [k, v] of Object.entries(mine)) if (p[k]) p[k] = addV(p[k], v);
  for (const [up, fwd] of DIR_PAIRS) {
    if (!before[up] || !p[up] || p[up] === before[up]) continue;
    const turned = rotateLike(before[up], p[up], before[fwd]);
    p[fwd] = p[fwd] === before[fwd] ? turned : addV(turned, p[fwd].map((v, i) => v - before[fwd][i]));
  }
  for (const { abs } of parts) for (const [k, { v, w }] of Object.entries(abs)) if (p[k]) p[k] = p[k].map((x, i) => x + (v[i] - x) * w);
  return p;
}
