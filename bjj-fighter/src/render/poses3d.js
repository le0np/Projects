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
      handL: [-0.02, 0.6, -0.08], elbowL: [0.25, 0.4, -0.3], handR: [0.0, 0.56, 0.1], elbowR: [0.25, 0.38, 0.3],
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
      footL: [-0.46, 0.07, 1.08], kneeL: [-0.42, 0.0, 0.75], toeL: [-0.46, 0.0, 1.15],
      footR: [-0.06, 0.07, 1.08], kneeR: [-0.1, 0.0, 0.75], toeR: [-0.06, 0.0, 1.15],
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
