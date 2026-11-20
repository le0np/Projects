/** Per-model knobs for Tripo character assets (visual only). */
export interface CharacterModelConfig {
  /** Bones whose skin weights mark the hair region (hair is part of the single Tripo mesh). */
  hairBones: string[];
  /** Linear-space luminance of the original hair colour, used to keep shading when recolouring. */
  hairKeyLuma: number;
  /** Original hair colour (shown as the default swatch). */
  nativeHair: number;
  torsoBones: string[];
  limbBones: string[];
  /** Bones that undo the torso scale so the head and arms keep their size. */
  counterBones: string[];
  /** 'toon' converts the PBR material into the cel-shaded look used elsewhere. */
  shading: 'toon' | 'pbr';
}

export const characterModels: Record<string, CharacterModelConfig> = {
  player_feminine: {
    hairBones: ['Head', 'NeckTwist01', 'NeckTwist02', 'Spine02', 'Spine01', 'Waist', 'L_Clavicle', 'R_Clavicle'],
    hairKeyLuma: 0.0104,
    nativeHair: 0x1d2146,
    torsoBones: ['Spine01', 'Spine02', 'Pelvis'],
    limbBones: ['L_Thigh', 'R_Thigh', 'L_Upperarm', 'R_Upperarm'],
    counterBones: ['NeckTwist01'],
    shading: 'toon',
  },
};

/** Maps the 0..1 build slider to bone width multipliers. 0.35 is the model as generated. */
export function buildScales(build: number): { torso: number; limbs: number } {
  const t = Math.min(1, Math.max(0, build)) - 0.35;
  return { torso: 1 + t * 0.32, limbs: 1 + t * 0.4 };
}

/** Grey blend for older characters' hair. */
export function greyAmount(age: number): number {
  return Math.min(0.85, Math.max(0, (age - 45) / 25) * 0.85);
}
