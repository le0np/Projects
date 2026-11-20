import type { ElementId } from '../config/elements';

/**
 * Visual-only description of the protagonist. Never read by combat code (GDD 3: appearance and
 * combat attributes are separate systems).
 */
export interface Appearance {
  presentation: 'masculine' | 'feminine';
  /** 0.9 .. 1.1, multiplies the model height only. */
  height: number;
  /** 0 slim .. 1 heavy. */
  build: number;
  age: number;
  skinTone: number;
  hairColor: number;
  hairStyle: string;
  eyeColor: number;
}

export const defaultAppearance: Appearance = {
  presentation: 'feminine',
  height: 1,
  build: 0.35,
  age: 22,
  skinTone: 0xf1c8a8,
  hairColor: 0x2b2235,
  hairStyle: 'long',
  eyeColor: 0x4a7bd0,
};

export interface CharacterLook {
  appearance: Appearance;
  element: ElementId;
}
