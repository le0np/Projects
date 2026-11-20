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
export interface ActionOptions {
  /** Portion of the clip to play, as fractions of its length. */
  range?: [number, number];
  /** Keep the last frame until stopAction (death, knockdown). */
  hold?: boolean;
  fade?: number;
}

export interface CharacterView {
  readonly object: THREE.Object3D;
  readonly source: 'placeholder' | 'gltf';
  update(dt: number, state: LocomotionState): void;
  /** Plays a one-shot action (attack, hit reaction) over `duration` seconds. Returns false if unavailable. */
  playAction(clip: string, duration: number, opts?: ActionOptions): boolean;
  /** Ends the current action and blends back to locomotion. */
  stopAction(fade?: number): void;
  hasClip(clip: string): boolean;
  /** Object that follows the right hand; weapons are parented here. */
  readonly weaponSocket: THREE.Object3D;
  dispose(): void;
}

/** Reference speeds used to pick and time-scale locomotion animations. */
export const locomotionRef = {
  walkSpeed: 2.2,
  runSpeed: 5.5,
  sprintSpeed: 8.5,
};
