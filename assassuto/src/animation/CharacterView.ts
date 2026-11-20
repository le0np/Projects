import type * as THREE from 'three';

/** Everything a view needs to animate locomotion. Produced by gameplay, consumed by rendering. */
export interface LocomotionState {
  grounded: boolean;
  /** Horizontal speed in m/s. */
  speed: number;
  vy: number;
  sprinting: boolean;
  /** 0..1 landing impact, decays over time. */
  landing: number;
}

/**
 * A visual character. Implementations: procedural placeholder (no assets) and glTF (Tripo models).
 * Gameplay never depends on which one is active.
 */
export interface CharacterView {
  readonly object: THREE.Object3D;
  readonly source: 'placeholder' | 'gltf';
  update(dt: number, state: LocomotionState): void;
  dispose(): void;
}

/** Reference speeds used to pick and time-scale locomotion animations. */
export const locomotionRef = {
  walkSpeed: 2.2,
  runSpeed: 5.5,
  sprintSpeed: 8.5,
};
