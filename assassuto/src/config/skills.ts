import type { ElementId } from './elements';

/**
 * Elemental skills: each element is one skill with 5 levels. A level makes the element's ability
 * (R) and its weapon imbue (Z) stronger; air is the mobility skill (double jump, high jump, Gale Step).
 * Skill points come from experience (enemies) and discoveries, and are spent at a shrine.
 */
export const MAX_SKILL_LEVEL = 5;

export interface SkillTier {
  /** What this level adds, shown in the shrine panel. */
  note: string;
  /** Multipliers on the ability (R). */
  damage: number;
  cooldown: number;
  /** Radius / range / dash distance multiplier. */
  area: number;
  /** Weapon imbue (Z): seconds it lasts, and strength of its effect. */
  imbueDuration: number;
  imbuePower: number;
}

export interface MobilityTier {
  /** Extra jumps in the air (Space while airborne). */
  airJumps: number;
  /** Hold Space on the ground, release: a jump pushed up by compressed air. */
  highJump: boolean;
  /** Gale Step charges before the cooldown starts. */
  dashCharges: number;
}

const tiers = (notes: string[]): SkillTier[] =>
  notes.map((note, i) => ({
    note,
    damage: [1, 1.2, 1.35, 1.5, 1.7][i],
    cooldown: [1, 0.92, 0.84, 0.76, 0.66][i],
    area: [1, 1, 1.15, 1.15, 1.3][i],
    imbueDuration: [8, 10, 12, 14, 16][i],
    imbuePower: [1, 1.25, 1.5, 1.8, 2.2][i],
  }));

export const skills: Record<ElementId, { name: string; summary: string; levels: SkillTier[] }> = {
  fire: {
    name: 'Ember',
    summary: 'Ember Burst and a burning weapon: hits set enemies on fire.',
    levels: tiers(['Ember Burst, Flame Weapon', 'Hotter flames: +20% damage', 'Wider burst, longer burn', 'Faster recharge, fiercer weapon', 'Inferno: +70% damage, huge burst']),
  },
  water: {
    name: 'Tide',
    summary: 'Tidal Surge and a frost-water weapon: hits soak and slow enemies.',
    levels: tiers(['Tidal Surge, Frost Weapon', 'Stronger surge: +20% damage', 'Longer wave, deeper slow', 'Faster recharge, colder weapon', 'Deluge: +70% damage, vast wave']),
  },
  earth: {
    name: 'Stone',
    summary: 'Stone Aegis and a stone-heavy weapon: hits crush guard and poise.',
    levels: tiers(['Stone Aegis, Stone Weapon', 'Harder stone: +20% shockwave', 'Wider shockwave, heavier blows', 'Faster recharge, longer aegis', 'Mountain: +70% shockwave, crushing weapon']),
  },
  air: {
    name: 'Wind (mobility)',
    summary: 'Movement skill: double jump, high jump on a cushion of air, Gale Step dash, and a gusting weapon.',
    levels: tiers(['Double jump, Gale Step, Gust Weapon', 'High jump: hold Space, release', 'Longer Gale Step, faster recharge', 'Triple jump', 'Two Gale Steps in a row']),
  },
};

export const mobility: MobilityTier[] = [
  { airJumps: 1, highJump: false, dashCharges: 1 },
  { airJumps: 1, highJump: true, dashCharges: 1 },
  { airJumps: 1, highJump: true, dashCharges: 1 },
  { airJumps: 2, highJump: true, dashCharges: 1 },
  { airJumps: 2, highJump: true, dashCharges: 2 },
];

export const mobilityConfig = {
  /** Upward speed of an air jump (normal jump is 9.2). */
  airJumpVelocity: 8.6,
  airJumpStamina: 8,
  /** Hold Space this long on the ground to charge a high jump; a shorter tap is a normal jump. */
  highJumpCharge: 0.35,
  /** Releasing earlier than this is a normal jump (fires on release). */
  tapTime: 0.16,
  highJumpVelocity: 15,
  highJumpStamina: 16,
};

/** Cost in skill points to reach a level (level 1 comes with the element). */
export const levelCost = (level: number): number => Math.max(0, level - 1);

export const progressionConfig = {
  /** Experience for one skill point. */
  xpPerPoint: 100,
  /** Bonus points for discoveries. */
  shrinePoints: 1,
  waystonePoints: 0,
};

/** Weapon imbue (Z): the selected element coats the weapon (or fists) for a while. */
export const imbueConfig = {
  cooldown: 14,
  fire: { burnDps: 4, burnTime: 3, damage: 1.1 },
  water: { slow: 0.6, soakTime: 3 },
  earth: { poise: 1.6, guardCrush: 12 },
  air: { knockback: 1.7, reach: 0.5 },
};
