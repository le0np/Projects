export const cameraConfig = {
  fov: 55,
  near: 0.1,
  far: 900,
  distance: 5.2,
  minDistance: 2.2,
  maxDistance: 9,
  pitchMin: -0.55,
  pitchMax: 1.15,
  startPitch: 0.28,
  mouseSensitivity: 0.0022,
  /** Height of the look target above the player's feet. */
  targetHeight: 1.55,
  /** Over-the-shoulder offset to the right. */
  shoulderOffset: 0.45,
  followRate: 14,
  zoomRate: 10,
  /** Keep the camera this far above the terrain. */
  groundClearance: 0.45,
  /** Extra FOV while sprinting, for a sense of speed. */
  sprintFovBoost: 6,
} as const;
