/** Per-model knobs for Tripo character assets (visual only). */
export interface HairKey {
  /** Bones whose skin weights mark the hair region (hair is part of the single Tripo mesh). */
  bones: string[];
  /** Linear-space chromaticity (r,g,b / sum) of the original hair, measured from the texture. */
  chroma: [number, number, number];
  /** Linear-space luminance of the original hair colour, used to keep shading when recolouring. */
  luma: number;
  /** Max chroma distance still counted as hair. */
  tolerance: number;
  /** Texels brighter than this (linear) are never hair (skin, eye whites, cloth). */
  maxLuma: number;
  /** Creator swatch that means "keep the generated hair". */
  native: number;
}

export interface CharacterModelConfig {
  hair?: HairKey;
  torsoBones: string[];
  limbBones: string[];
  /** Bones that undo the torso scale so the head and arms keep their size. */
  counterBones: string[];
  /** 'toon' converts the PBR material into the cel-shaded look used elsewhere. */
  shading: 'toon' | 'pbr';
}

export const characterModels: Record<string, CharacterModelConfig> = {
  player_feminine: {
    hair: {
      bones: ['Head', 'NeckTwist01', 'NeckTwist02'],
      chroma: [0.223, 0.253, 0.525],
      luma: 0.0211,
      tolerance: 0.2,
      maxLuma: 0.15,
      native: 0x1d2146,
    },
    torsoBones: ['Spine01', 'Spine02', 'Pelvis'],
    limbBones: ['L_Thigh', 'R_Thigh', 'L_Upperarm', 'R_Upperarm'],
    counterBones: ['NeckTwist01'],
    shading: 'toon',
  },
  player_masculine: {
    hair: {
      bones: ['Head', 'NeckTwist01', 'NeckTwist02'],
      chroma: [0.822, 0.1, 0.078],
      luma: 0.0043,
      tolerance: 0.32,
      maxLuma: 0.1,
      native: 0x5a3422,
    },
    torsoBones: ['Spine01', 'Spine02', 'Pelvis'],
    limbBones: ['L_Thigh', 'R_Thigh', 'L_Upperarm', 'R_Upperarm'],
    counterBones: ['NeckTwist01'],
    shading: 'toon',
  },
  enemy_raider: {
    torsoBones: ['Spine01', 'Spine02', 'Pelvis'],
    limbBones: [],
    counterBones: ['NeckTwist01'],
    shading: 'toon',
  },
};

/** Default hair swatch for a body: the generated model's own hair. */
export function nativeHairFor(presentation: 'feminine' | 'masculine', fallback: number): number {
  return characterModels[`player_${presentation}`]?.hair?.native ?? fallback;
}

/** Maps the 0..1 build slider to bone width multipliers. 0.35 is the model as generated. */
export function buildScales(build: number): { torso: number; limbs: number } {
  const t = Math.min(1, Math.max(0, build)) - 0.35;
  return { torso: 1 + t * 0.32, limbs: 1 + t * 0.4 };
}

/** Grey blend for older characters' hair. */
export function greyAmount(age: number): number {
  return Math.min(0.85, Math.max(0, (age - 45) / 25) * 0.85);
}
