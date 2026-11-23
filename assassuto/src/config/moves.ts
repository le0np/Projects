import { mirrorOverlay, type PoseOverlay } from '../animation/clipTools';

/*
 * Move library: Tripo has one jab, one 1-2 combo, one spinning kick, one flip and one two-handed slash.
 * Everything else is built from those by mirroring (`<clip>_m`), playing a segment (or a segment
 * backwards) and layering bone rotations on top (pose overlays, character frame: pitch tilts forward,
 * yaw turns left, roll tilts right). Angles are degrees; windows are fractions of the move.
 */

/** Clips that get a mirrored `<clip>_m` copy at load time. */
export const mirroredClips = ['box_01', 'box_02', 'front_kick_01', 'slash', 'flip'] as const;

const hookL: PoseOverlay = [
  // Elbow out to shoulder height, fist sweeping in from the side, torso turning into it.
  { bone: 'L_Upperarm', axis: 'roll', deg: 55, from: 0.05, to: 0.7 },
  { bone: 'L_Upperarm', axis: 'yaw', deg: 35, from: 0.05, to: 0.45 },
  { bone: 'L_Forearm', axis: 'yaw', deg: -55, from: 0.15, to: 0.7 },
  { bone: 'Spine01', axis: 'yaw', deg: -28, from: 0.1, to: 0.75 },
  { bone: 'Hip', axis: 'yaw', deg: -12, from: 0.1, to: 0.75 },
];

const uppercutR: PoseOverlay = [
  // Dip, then drive up through the legs and the right fist.
  { bone: 'Hip', axis: 'pitch', deg: 6, from: 0, to: 0.45 },
  { bone: 'Spine01', axis: 'pitch', deg: -14, from: 0, to: 0.45 },
  { bone: 'Spine01', axis: 'pitch', deg: -16, from: 0.35, to: 0.95 },
  { bone: 'Spine01', axis: 'yaw', deg: 18, from: 0.2, to: 0.85 },
  { bone: 'R_Upperarm', axis: 'pitch', deg: -35, from: 0.3, to: 0.9 },
];

const kneeR: PoseOverlay = [
  // Knee strike: thigh up, calf folded, hips forward, a little lean back.
  { bone: 'R_Thigh', axis: 'pitch', deg: -95, from: 0.05, to: 0.9 },
  { bone: 'R_Calf', axis: 'pitch', deg: 105, from: 0.05, to: 0.9 },
  { bone: 'Spine01', axis: 'pitch', deg: -14, from: 0.05, to: 0.9 },
  { bone: 'L_Upperarm', axis: 'pitch', deg: -50, from: 0.05, to: 0.85 },
  { bone: 'R_Upperarm', axis: 'pitch', deg: -50, from: 0.05, to: 0.85 },
];

const pushKickR: PoseOverlay = [
  // Chamber the knee, then snap the leg straight out at the target.
  { bone: 'R_Thigh', axis: 'pitch', deg: -95, from: 0.05, to: 0.95 },
  { bone: 'R_Calf', axis: 'pitch', deg: 110, from: 0.02, to: 0.5 },
  { bone: 'Spine01', axis: 'pitch', deg: -24, from: 0.1, to: 0.95 },
  { bone: 'L_Calf', axis: 'pitch', deg: 12, from: 0.1, to: 0.9 },
];

/** The spinning kick lands about 100 degrees to the left; turning the hips puts it on the target. */
const roundhouseR: PoseOverlay = [{ bone: 'Hip', axis: 'yaw', deg: -100, from: 0.1, to: 0.9 }];

const sweepSlash: PoseOverlay = [
  { bone: 'Hip', axis: 'yaw', deg: 55, from: 0, to: 0.45 },
  { bone: 'Hip', axis: 'yaw', deg: -60, from: 0.3, to: 0.95 },
  { bone: 'Spine01', axis: 'roll', deg: -22, from: 0.1, to: 0.8 },
];

const overhead: PoseOverlay = [
  { bone: 'Spine01', axis: 'pitch', deg: -18, from: 0, to: 0.4 },
  { bone: 'Spine01', axis: 'pitch', deg: -12, from: 0.3, to: 0.95 },
];

const spin: PoseOverlay = [{ bone: 'Hip', axis: 'yaw', deg: -360, from: 0.05, to: 0.75, curve: 'ramp' }];

const thrust: PoseOverlay = [
  // The slash clip is bent low at impact: straighten up and drive the arms forward instead.
  { bone: 'Spine01', axis: 'pitch', deg: -30, from: 0.1, to: 0.95 },
  { bone: 'Spine02', axis: 'yaw', deg: -25, from: 0.1, to: 0.95 },
  { bone: 'R_Upperarm', axis: 'pitch', deg: -35, from: 0.2, to: 0.9 },
  { bone: 'R_Hand', aim: [1, -0.08, 0], from: 0.05, to: 1, curve: 'hold' },
  { bone: 'L_Thigh', axis: 'pitch', deg: -25, from: 0.15, to: 0.95 },
  { bone: 'R_Calf', axis: 'pitch', deg: 18, from: 0.15, to: 0.95 },
];

const throwSpear: PoseOverlay = [
  { bone: 'R_Upperarm', axis: 'pitch', deg: -150, from: 0, to: 0.55 },
  { bone: 'Spine01', axis: 'pitch', deg: -20, from: 0, to: 0.45 },
  { bone: 'Spine01', axis: 'pitch', deg: 25, from: 0.35, to: 0.95 },
  { bone: 'Spine01', axis: 'yaw', deg: 30, from: 0, to: 0.5 },
  { bone: 'Spine01', axis: 'yaw', deg: -25, from: 0.4, to: 0.95 },
];

export const poses = {
  hookL,
  hookR: mirrorOverlay(hookL),
  uppercutR,
  uppercutL: mirrorOverlay(uppercutR),
  kneeR,
  kneeL: mirrorOverlay(kneeR),
  pushKickR,
  pushKickL: mirrorOverlay(pushKickR),
  roundhouseR,
  roundhouseL: mirrorOverlay(roundhouseR),
  sweepSlash,
  sweepSlashM: mirrorOverlay(sweepSlash),
  overhead,
  spin,
  spinM: mirrorOverlay(spin),
  thrust,
  throwSpear,
} satisfies Record<string, PoseOverlay>;
