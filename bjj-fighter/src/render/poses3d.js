// 3D key poses for the model fighters (fighter3d.js). Pure data, no Three.js.
// World metres: x along the fight (the bottom fighter's head points to -x on the ground), y up from the mat,
// z depth (+z towards the default camera). T = player (top, or the left one standing), B = opponent.
// Per fighter: pelvis position; hipUp/hipFwd (direction from the pelvis to the chest / out of the belly);
// optional chestUp/chestFwd and headUp/headFwd; hands, feet and elbow/knee hints (where the joint bends to);
// optional toes (where the foot points). L/R are the fighter's own left and right.
// Measured on the model: hip joints 0.97 m high and 0.11 m off centre, shoulders 0.21 m off centre,
// arm 0.25 + 0.24 m to the wrist, leg 0.43 + 0.46 m to the ankle.

export const POSE_KEYS = ['pelvis', 'hipUp', 'hipFwd', 'handL', 'handR', 'elbowL', 'elbowR', 'footL', 'footR', 'kneeL', 'kneeR'];
const OPTIONAL = ['chestUp', 'chestFwd', 'headUp', 'headFwd', 'toeL', 'toeR'];

// Mirror image across x = 0: the other fighter in a symmetric position (left and right swap).
export function mirrorPose(p) {
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    const key = k.endsWith('L') ? `${k.slice(0, -1)}R` : k.endsWith('R') ? `${k.slice(0, -1)}L` : k;
    out[key] = Array.isArray(v) ? [-v[0], v[1], v[2]] : v;
  }
  return out;
}

const STAND = {
  pelvis: [-0.46, 0.88, 0], hipUp: [0.12, 1, 0], hipFwd: [1, -0.1, 0], chestUp: [0.4, 1, 0], chestFwd: [1, -0.35, 0],
  headUp: [0.15, 1, 0], headFwd: [1, -0.1, 0],
  handL: [-0.04, 1.2, -0.1], elbowL: [-0.22, 1.0, -0.35], handR: [-0.08, 1.02, 0.14], elbowR: [-0.28, 0.9, 0.35],
  footL: [-0.3, 0.09, -0.18], kneeL: [-0.18, 0.5, -0.2], toeL: [-0.12, 0.02, -0.2],
  footR: [-0.66, 0.09, 0.2], kneeR: [-0.48, 0.5, 0.24], toeR: [-0.5, 0.02, 0.26],
  grip: 0.7,
};

// Bottom fighter flat on the back, head towards -x, face up.
const FLAT = { hipUp: [-1, 0, 0], hipFwd: [0, 1, 0], chestUp: [-1, 0.02, 0], chestFwd: [0, 1, 0], headUp: [-1, 0.25, 0], headFwd: [0.25, 1, 0] };

export const POSES3D = {
  standing: { T: STAND, B: mirrorPose(STAND) },

  closedGuard: {
    // Player kneels in the guard with posture, facing -x, hands on the opponent's belly.
    T: {
      pelvis: [0.46, 0.44, 0], hipUp: [-0.1, 1, 0], hipFwd: [-1, 0, 0], chestUp: [-0.45, 1, 0], chestFwd: [-1, -0.4, 0],
      headUp: [-0.2, 1, 0], headFwd: [-1, -0.2, 0],
      handL: [0.06, 0.4, 0.13], elbowL: [0.25, 0.55, 0.4], handR: [0.06, 0.4, -0.13], elbowR: [0.25, 0.55, -0.4],
      footL: [0.82, 0.08, 0.15], kneeL: [0.2, 0.06, 0.18], toeL: [0.95, 0.02, 0.15],
      footR: [0.82, 0.08, -0.15], kneeR: [0.2, 0.06, -0.18], toeR: [0.95, 0.02, -0.15],
      grip: 0.5,
    },
    // Opponent on the back, hips on the player's thighs, legs locked behind the player's back, gripping the wrists.
    B: {
      ...FLAT, pelvis: [0.16, 0.24, 0], hipUp: [-1, -0.22, 0], chestUp: [-1, 0, 0],
      handL: [0.06, 0.44, -0.14], elbowL: [-0.2, 0.25, -0.45], handR: [0.06, 0.44, 0.14], elbowR: [-0.2, 0.25, 0.45],
      footL: [0.66, 0.56, 0.07], kneeL: [0.36, 0.5, -0.45], toeL: [0.7, 0.5, 0.2],
      footR: [0.66, 0.5, -0.07], kneeR: [0.36, 0.5, 0.45], toeR: [0.7, 0.45, -0.2],
      grip: 0.8,
    },
  },

  mount: {
    // Player sits on the opponent's belly, knees on the mat by the ribs, one hand on the chest, one posted.
    T: {
      pelvis: [-0.12, 0.38, 0], hipUp: [-0.15, 1, 0], hipFwd: [-1, 0.1, 0], chestUp: [-0.6, 1, 0], chestFwd: [-1, -0.5, 0],
      headUp: [-0.3, 1, 0], headFwd: [-1, -0.3, 0],
      handL: [-0.55, 0.32, 0.12], elbowL: [-0.3, 0.5, 0.4], handR: [-0.5, 0.06, -0.42], elbowR: [-0.3, 0.4, -0.5],
      footL: [0.22, 0.08, 0.3], kneeL: [-0.3, 0.08, 0.42], toeL: [0.34, 0.02, 0.3],
      footR: [0.22, 0.08, -0.3], kneeR: [-0.3, 0.08, -0.42], toeR: [0.34, 0.02, -0.3],
      grip: 0.4,
    },
    // Opponent flat on the back, pushing on the player's hips.
    B: {
      ...FLAT, pelvis: [0.02, 0.12, 0],
      handL: [-0.14, 0.34, -0.2], elbowL: [-0.4, 0.08, -0.4], handR: [-0.14, 0.34, 0.2], elbowR: [-0.4, 0.08, 0.4],
      footL: [0.82, 0.07, -0.22], kneeL: [0.45, 0.35, -0.2], toeL: [0.85, 0.2, -0.24],
      footR: [0.82, 0.07, 0.22], kneeR: [0.45, 0.35, 0.2], toeR: [0.85, 0.2, 0.24],
      grip: 0.5,
    },
  },

  back: {
    // Player sits behind the opponent: hooks in, seatbelt (right arm over the shoulder, left under the arm).
    T: {
      pelvis: [-0.34, 0.12, 0], hipUp: [-0.35, 1, 0], hipFwd: [1, 0.3, 0], chestUp: [-0.25, 1, 0], chestFwd: [1, 0.2, 0],
      headUp: [0, 1, 0], headFwd: [1, 0, 0.3],
      handL: [0.0, 0.5, 0.06], elbowL: [-0.1, 0.32, -0.35], handR: [0.02, 0.56, -0.06], elbowR: [-0.12, 0.85, 0.3],
      footL: [0.36, 0.2, -0.1], kneeL: [-0.02, 0.38, -0.42], toeL: [0.45, 0.2, -0.05],
      footR: [0.36, 0.2, 0.1], kneeR: [-0.02, 0.38, 0.42], toeR: [0.45, 0.2, 0.05],
      grip: 0.8,
    },
    // Opponent sits leaning back into the player, hands fighting the choke.
    B: {
      pelvis: [0.06, 0.13, 0], hipUp: [-0.45, 1, 0], hipFwd: [1, 0.3, 0], chestUp: [-0.4, 1, 0], chestFwd: [1, 0.3, 0],
      headUp: [-0.1, 1, 0], headFwd: [1, -0.2, 0],
      handL: [0.06, 0.5, -0.1], elbowL: [0.25, 0.3, -0.3], handR: [0.08, 0.46, 0.12], elbowR: [0.28, 0.3, 0.3],
      footL: [0.78, 0.08, -0.24], kneeL: [0.45, 0.5, -0.24], toeL: [0.9, 0.04, -0.26],
      footR: [0.78, 0.08, 0.24], kneeR: [0.45, 0.5, 0.24], toeR: [0.9, 0.04, 0.26],
      grip: 0.7,
    },
  },

  sideControl: {
    // Player lies across the opponent's chest, chest down, knees on the mat towards the camera.
    T: {
      pelvis: [-0.26, 0.27, 0.55], hipUp: [0, -0.05, -1], hipFwd: [0, -1, 0.1], chestUp: [-0.1, -0.2, -1], chestFwd: [0, -1, 0.2],
      headUp: [-0.2, 0, -1], headFwd: [0, -1, 0],
      handL: [-0.78, 0.08, -0.08], elbowL: [-0.6, 0.35, 0.05], handR: [0.06, 0.12, -0.26], elbowR: [0.0, 0.4, 0.1],
      footL: [-0.5, 0.06, 1.3], kneeL: [-0.48, 0.12, 0.95], toeL: [-0.5, 0.0, 1.38],
      footR: [-0.04, 0.06, 1.3], kneeR: [-0.06, 0.12, 0.95], toeR: [-0.04, 0.0, 1.38],
      grip: 0.6,
    },
    // Opponent flat on the back, framing on the player's neck and hip.
    B: {
      ...FLAT, pelvis: [0.04, 0.12, 0],
      handL: [-0.22, 0.12, -0.46], elbowL: [-0.4, 0.06, -0.45], handR: [-0.38, 0.42, 0.18], elbowR: [-0.4, 0.15, 0.4],
      footL: [0.7, 0.07, -0.16], kneeL: [0.42, 0.5, -0.2], toeL: [0.85, 0.02, -0.18],
      footR: [0.7, 0.07, 0.22], kneeR: [0.42, 0.5, 0.24], toeR: [0.85, 0.02, 0.24],
      grip: 0.5,
    },
  },
};

Object.assign(POSES3D, {
  halfGuard: {
    // Player flattens the opponent chest to chest, right leg trapped between the opponent's legs, crossface.
    T: {
      pelvis: [0.16, 0.38, 0.04], hipUp: [-1, 0.12, 0], hipFwd: [0, -1, 0], chestUp: [-1, -0.05, 0], chestFwd: [0, -1, 0.15],
      headUp: [-1, 0.1, -0.2], headFwd: [0, -1, 0],
      handL: [-0.32, 0.08, 0.38], elbowL: [-0.2, 0.32, 0.5], handR: [-0.78, 0.1, -0.12], elbowR: [-0.55, 0.35, -0.35],
      footL: [0.66, 0.07, 0.36], kneeL: [0.2, 0.04, 0.42], toeL: [0.74, 0.0, 0.36],
      footR: [0.7, 0.1, -0.08], kneeR: [0.32, 0.06, -0.06], toeR: [0.78, 0.04, -0.08],
      grip: 0.6,
    },
    // Opponent on the back, turned a little towards the player, legs locked on the player's leg, underhook.
    B: {
      ...FLAT, pelvis: [0.02, 0.13, 0], hipFwd: [0, 1, 0.3], chestUp: [-1, 0.05, 0], chestFwd: [0, 1, 0.45],
      handL: [-0.5, 0.36, 0.05], elbowL: [-0.45, 0.12, -0.38], handR: [-0.52, 0.5, -0.06], elbowR: [-0.3, 0.3, 0.42],
      footL: [0.55, 0.2, 0.03], kneeL: [0.32, 0.38, -0.28], toeL: [0.62, 0.22, 0.08],
      footR: [0.5, 0.1, -0.1], kneeR: [0.28, 0.16, 0.32], toeR: [0.58, 0.08, -0.14],
      grip: 0.7,
    },
  },

  butterfly: {
    // Player kneels up in front of the seated opponent, hands on the biceps.
    T: {
      pelvis: [0.56, 0.5, 0], hipUp: [0.05, 1, 0], hipFwd: [-1, 0, 0], chestUp: [-0.3, 1, 0], chestFwd: [-1, -0.3, 0],
      headUp: [-0.1, 1, 0], headFwd: [-1, -0.1, 0],
      handL: [0.14, 0.58, 0.22], elbowL: [0.36, 0.5, 0.42], handR: [0.14, 0.58, -0.22], elbowR: [0.36, 0.5, -0.42],
      footL: [0.88, 0.08, 0.22], kneeL: [0.36, 0.06, 0.26], toeL: [0.98, 0.02, 0.22],
      footR: [0.88, 0.08, -0.22], kneeR: [0.36, 0.06, -0.26], toeR: [0.98, 0.02, -0.22],
      grip: 0.7,
    },
    // Opponent sits with both feet hooked inside the player's thighs, underhook and collar tie.
    B: {
      pelvis: [-0.04, 0.13, 0], hipUp: [-0.2, 1, 0], hipFwd: [1, 0.15, 0], chestUp: [0.15, 1, 0], chestFwd: [1, -0.1, 0],
      headUp: [0.1, 1, 0], headFwd: [1, -0.1, 0],
      handL: [0.48, 0.74, -0.16], elbowL: [0.2, 0.5, -0.4], handR: [0.5, 0.6, 0.2], elbowR: [0.2, 0.42, 0.4],
      footL: [0.42, 0.32, -0.12], kneeL: [0.2, 0.45, -0.45], toeL: [0.5, 0.4, -0.12],
      footR: [0.42, 0.32, 0.12], kneeR: [0.2, 0.45, 0.45], toeR: [0.5, 0.4, 0.12],
      grip: 0.8,
    },
  },

  kneeOnBelly: {
    // Player beside the opponent (towards the camera), left knee on the belly, right foot posted wide.
    T: {
      pelvis: [-0.05, 0.56, 0.36], hipUp: [0, 1, -0.15], hipFwd: [0, -0.2, -1], chestUp: [0, 1, -0.7], chestFwd: [0, -0.5, -1],
      headUp: [0, 1, -0.3], headFwd: [0, -0.4, -1],
      handL: [-0.3, 0.38, 0.0], elbowL: [-0.45, 0.6, 0.3], handR: [0.2, 0.36, 0.0], elbowR: [0.4, 0.6, 0.3],
      footL: [-0.06, 0.1, 0.44], kneeL: [-0.1, 0.3, 0.0], toeL: [-0.06, 0.0, 0.56],
      footR: [0.46, 0.08, 0.62], kneeR: [0.36, 0.5, 0.6], toeR: [0.5, 0.0, 0.5],
      grip: 0.7,
    },
    // Opponent flat on the back, pushing the knee off the belly.
    B: {
      ...FLAT, pelvis: [0.02, 0.12, 0],
      handL: [-0.08, 0.32, -0.04], elbowL: [-0.3, 0.08, -0.35], handR: [-0.08, 0.36, 0.08], elbowR: [-0.3, 0.08, 0.35],
      footL: [0.75, 0.07, -0.2], kneeL: [0.45, 0.4, -0.2], toeL: [0.85, 0.02, -0.2],
      footR: [0.75, 0.07, 0.22], kneeR: [0.45, 0.4, 0.22], toeR: [0.85, 0.02, 0.22],
      grip: 0.6,
    },
  },

  northSouth: {
    // Player lies chest down over the opponent's chest, head towards the opponent's hips, legs past the opponent's head.
    T: {
      pelvis: [-0.8, 0.32, 0], hipUp: [1, -0.12, 0], hipFwd: [0, -1, 0], chestUp: [1, -0.05, 0], chestFwd: [0, -1, 0],
      headUp: [1, 0.05, 0], headFwd: [0, -1, 0],
      handL: [-0.05, 0.1, -0.3], elbowL: [-0.25, 0.32, -0.42], handR: [-0.05, 0.1, 0.3], elbowR: [-0.25, 0.32, 0.42],
      footL: [-1.38, 0.07, -0.18], kneeL: [-1.05, 0.0, -0.2], toeL: [-1.46, 0.0, -0.18],
      footR: [-1.38, 0.07, 0.18], kneeR: [-1.05, 0.0, 0.2], toeR: [-1.46, 0.0, 0.18],
      grip: 0.6,
    },
    // Opponent flat on the back, framing on the player's hips above the head.
    B: {
      ...FLAT, pelvis: [0.02, 0.12, 0],
      handL: [-0.74, 0.34, -0.12], elbowL: [-0.5, 0.18, -0.38], handR: [-0.74, 0.34, 0.12], elbowR: [-0.5, 0.18, 0.38],
      footL: [0.72, 0.07, -0.2], kneeL: [0.44, 0.42, -0.2], toeL: [0.82, 0.02, -0.2],
      footR: [0.72, 0.07, 0.22], kneeR: [0.44, 0.42, 0.22], toeR: [0.82, 0.02, 0.22],
      grip: 0.6,
    },
  },

  turtle: {
    // Player sprawls in front of the turtled opponent with a front headlock.
    T: {
      pelvis: [0.76, 0.3, 0], hipUp: [-1, 0.25, 0], hipFwd: [0, -1, 0], chestUp: [-1, 0.05, 0], chestFwd: [0, -1, 0],
      headUp: [-1, 0.2, 0], headFwd: [0, -1, 0],
      handL: [0.02, 0.6, 0.08], elbowL: [0.3, 0.62, 0.32], handR: [0.18, 0.3, 0.1], elbowR: [0.36, 0.42, -0.3],
      footL: [1.36, 0.07, 0.25], kneeL: [1.05, 0.05, 0.26], toeL: [1.44, 0.0, 0.25],
      footR: [1.36, 0.07, -0.25], kneeR: [1.05, 0.05, -0.26], toeR: [1.44, 0.0, -0.25],
      grip: 0.8,
    },
    // Opponent on knees and elbows, facing the player, head low.
    B: {
      pelvis: [-0.22, 0.5, 0], hipUp: [1, -0.35, 0], hipFwd: [0, -1, 0], chestUp: [1, -0.45, 0], chestFwd: [0, -1, 0],
      headUp: [1, -0.6, 0], headFwd: [0.2, -1, 0],
      handL: [0.36, 0.12, -0.1], elbowL: [0.22, 0.05, -0.22], handR: [0.36, 0.12, 0.1], elbowR: [0.22, 0.05, 0.22],
      footL: [-0.62, 0.07, -0.15], kneeL: [-0.12, 0.05, -0.16], toeL: [-0.7, 0.0, -0.15],
      footR: [-0.62, 0.07, 0.15], kneeR: [-0.12, 0.05, 0.16], toeR: [-0.7, 0.0, 0.15],
      grip: 0.5,
    },
  },
});

export const OPTIONAL_KEYS = OPTIONAL;

const DIRS = ['hipUp', 'hipFwd', 'chestUp', 'chestFwd', 'headUp', 'headFwd'];
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

// Fill the optional directions from the ones they default to (chest from hips, head from chest).
export function completePose(p) {
  const out = { ...p };
  out.chestUp ??= p.hipUp;
  out.chestFwd ??= p.hipFwd;
  out.headUp ??= out.chestUp;
  out.headFwd ??= out.chestFwd;
  return out;
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Orientation of a body part from its up and front directions, as a unit quaternion [x, y, z, w]:
// the rotation that takes +y to `up` and +z to `front` (a right-handed basis, so it is a true rotation).
export function orientation(up, fwd) {
  const u = norm(up);
  const f = norm(fwd.map((v, i) => v - u[i] * dot3(fwd, u)));
  const r = cross(u, f);
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = [r[0], u[0], f[0], r[1], u[1], f[1], r[2], u[2], f[2]];
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); q = [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]; }
  else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]; }
  return norm(q);
}

export function slerpQuat(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const bb = d < 0 ? b.map((v) => -v) : b;
  d = Math.abs(d);
  if (d > 0.9995) return norm(a.map((v, i) => v + (bb[i] - v) * t));
  const th = Math.acos(d);
  const sa = Math.sin((1 - t) * th) / Math.sin(th);
  const sb = Math.sin(t * th) / Math.sin(th);
  return a.map((v, i) => v * sa + bb[i] * sb);
}

// Rotate vector v by unit quaternion q.
export function rotate(q, v) {
  const [x, y, z, w] = q;
  const t = cross([x, y, z], v).map((c) => 2 * c);
  const c2 = cross([x, y, z], t);
  return [v[0] + w * t[0] + c2[0], v[1] + w * t[1] + c2[1], v[2] + w * t[2] + c2[2]];
}

const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];

// Blend of two poses for transitions (t = 0..1): points move in straight lines, directions turn on the sphere.
// `arc` lifts hands and feet in the middle of the move (metres), so they step instead of dragging.
export function blendPose(a, b, t, arc = 0) {
  const A = completePose(a);
  const B = completePose(b);
  const out = {};
  const bump = Math.sin(Math.PI * t) * arc;
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const x = A[k] ?? B[k];
    const y = B[k] ?? A[k];
    if (DIRS.includes(k)) continue;
    if (Array.isArray(x)) {
      out[k] = x.map((v, i) => v + (y[i] - v) * t);
      if (/^(hand|foot|toe)/.test(k)) out[k][1] += bump;
    } else out[k] = x + (y - x) * t;
  }
  // The hips turn as a whole (up and front together). Chest and head blend only their small offset from
  // the hips: turned separately, a half-turn could go one way round for the hips and the other way for
  // the chest, and the spine between them would flip.
  const put = (q, up, fwd) => { out[up] = rotate(q, [0, 1, 0]); out[fwd] = rotate(q, [0, 0, 1]); };
  const hipA = orientation(A.hipUp, A.hipFwd);
  const hipB = orientation(B.hipUp, B.hipFwd);
  const hip = slerpQuat(hipA, hipB, t);
  put(hip, 'hipUp', 'hipFwd');
  for (const [up, fwd] of [['chestUp', 'chestFwd'], ['headUp', 'headFwd']]) {
    const relA = qmul(qinv(hipA), orientation(A[up], A[fwd]));
    const relB = qmul(qinv(hipB), orientation(B[up], B[fwd]));
    put(qmul(hip, slerpQuat(relA, relB, t)), up, fwd);
  }
  return out;
}

// How far a change of pose travels (metres): the longest straight move of the hips, hands and feet,
// or the arc of a body that turns (hands swing about 0.7 m around the hips).
export function poseTravel(a, b) {
  const A = completePose(a);
  const B = completePose(b);
  let travel = 0;
  for (const k of ['pelvis', 'handL', 'handR', 'footL', 'footR']) travel = Math.max(travel, Math.hypot(...A[k].map((v, i) => v - B[k][i])));
  const u = norm(A.hipFwd);
  const v = norm(B.hipFwd);
  const turn = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2])));
  return Math.max(travel, turn * 0.7);
}
