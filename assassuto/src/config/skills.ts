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
  /** Extra jumps in the air (Space while airborne). No cooldown: they recharge on landing. */
  airJumps: number;
  /** Hold Space on the ground, release: a jump pushed up by compressed air. */
  highJump: boolean;
  /** Gale Rush charges before the cooldown starts. */
  dashCharges: number;
  /** Hold Space while falling to glide down on the wind (seconds of hover per jump, 0 = none). */
  hover: number;
}

const tiers = (notes: string[]): SkillTier[] =>
  notes.map((note, i) => ({
    note,
    damage: [1, 1.2, 1.35, 1.5, 1.7][i],
    cooldown: [1, 0.92, 0.84, 0.76, 0.66][i],
    area: [1, 1, 1.15, 1.15, 1.3][i],
    imbueDuration: [20, 23, 26, 28, 30][i],
    imbuePower: [1, 1.25, 1.5, 1.8, 2.2][i],
  }));

export const skills: Record<ElementId, { name: string; summary: string; levels: SkillTier[] }> = {
  fire: {
    name: 'Ember',
    summary: 'Ember Burst and a burning weapon: hits set enemies on fire.',
    levels: tiers(['Ember Burst, Flame Weapon, explosive back-hop (C)', 'Hotter flames: +20% damage', 'Wider burst, longer burn', 'Faster recharge, fiercer weapon', 'Inferno: +70% damage; fuse two elements on the weapon']),
  },
  water: {
    name: 'Tide',
    summary: 'Tidal Surge and a frost-water weapon: hits soak and slow enemies.',
    levels: tiers(['Tidal Surge, Frost Weapon (3 hits freeze), ice slide (C)', 'Stronger surge: +20% damage', 'Longer wave, deeper slow', 'Faster recharge, colder weapon', 'Deluge: +70% damage; fuse two elements on the weapon']),
  },
  earth: {
    name: 'Stone',
    summary: 'Stone Aegis and a stone-heavy weapon: hits crush guard and poise.',
    levels: tiers(['Stone Aegis, Stone Weapon, rock-pillar launch (C)', 'Harder stone: +20% shockwave', 'Wider shockwave, heavier blows', 'Faster recharge, longer aegis', 'Mountain: +70% shockwave; fuse two elements on the weapon']),
  },
  air: {
    name: 'Wind (mobility)',
    summary: 'Movement skill: double jump (no cooldown), high jump, gliding, Gale Rush, and a whirlwind weapon that brings a thrown spear back.',
    levels: tiers(['Double jump, Gale Rush (2 charges), Gust Weapon', 'High jump: hold Space, release', 'Glide: hold Space while falling', 'Triple jump, longer glide', 'Three Gale Rush charges; fuse two elements on the weapon']),
  },
};

export const mobility: MobilityTier[] = [
  { airJumps: 1, highJump: false, dashCharges: 2, hover: 0 },
  { airJumps: 1, highJump: true, dashCharges: 2, hover: 0 },
  { airJumps: 1, highJump: true, dashCharges: 2, hover: 1.2 },
  { airJumps: 2, highJump: true, dashCharges: 2, hover: 2 },
  { airJumps: 2, highJump: true, dashCharges: 3, hover: 2.5 },
];

export const mobilityConfig = {
  /** Upward speed of an air jump (normal jump is 9.2). Air jumps cost nothing and recharge on landing. */
  airJumpVelocity: 9,
  /** Length of the somersault played on an air jump. */
  airFlipTime: 0.5,
  /** Falling speed while gliding (hold Space). */
  hoverFallSpeed: 1.6,
  /** With the wind skill the player always falls a little slower. */
  airGravityScale: 0.88,
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

/**
 * Weapon imbue (Z): the selected element coats the weapon (or fists) for 20-30 s by level. A perfect
 * parry or the last hit of a combo string adds time. At level 5, Z with a second element while one is
 * active fuses the two.
 */
export const imbueConfig = {
  cooldown: 10,
  /** Seconds added by a parry / a combo ender that lands; capped at 1.5x the full duration. */
  extendParry: 4,
  extendCombo: 3,
  maxExtend: 1.5,
  /** Hand-along-the-blade activation gesture. */
  gestureTime: 0.55,
  fire: { burnDps: 4, burnTime: 3, damage: 1.1, explosion: { radius: 2.8, damage: 12, knockback: 6 } },
  water: { slow: 0.6, soakTime: 3, freezeHits: 3, freezeTime: 2.6, shatter: 2.5 },
  earth: { poise: 1.6, speed: 0.88, spike: { radius: 2.6, damage: 18, launch: 8 } },
  air: { knockback: 1.7, reach: 0.5, spearReturn: { delay: 0.75, speed: 26 } },
  /** Names of fused imbues (order does not matter). */
  fusions: {
    'air+fire': 'Flame Vortex',
    'fire+water': 'Steam Blade',
    'earth+fire': 'Magma Edge',
    'air+water': 'Frost Gale',
    'earth+water': 'Mire Blade',
    'air+earth': 'Sandstorm',
  } as Record<string, string>,
};

/**
 * Element dodges (C with fire, water or earth selected; air keeps the roll and has Gale Rush on R).
 * `speed` is horizontal m/s (backwards for Blast Hop), `up` the launch speed; the blast at the start
 * hits everything within `radius` (Ice Slide hits along its path instead).
 */
export interface ElementDodgeDef {
  name: string;
  cooldown: number;
  duration: number;
  speed: number;
  up: number;
  radius: number;
  damage: number;
  knockback: number;
  launch: number;
  /** Ice Slide soaks and chills what it passes (seconds of soak). */
  soak: number;
}

export const elementDodge: Record<'fire' | 'water' | 'earth', ElementDodgeDef> = {
  fire: { name: 'Blast Hop', cooldown: 3.5, duration: 0.5, speed: 9, up: 7, radius: 2.6, damage: 10, knockback: 7, launch: 3, soak: 0 },
  water: { name: 'Ice Slide', cooldown: 3, duration: 0.6, speed: 13, up: 0, radius: 1.4, damage: 4, knockback: 3, launch: 0, soak: 3 },
  earth: { name: 'Rock Pillar', cooldown: 5, duration: 0.45, speed: 3, up: 15, radius: 2.4, damage: 12, knockback: 8, launch: 6, soak: 0 },
};

/** Gale Rush ends in a spin strike with the weapon in hand. */
export const galeRush = { endSpinRadius: 2.8, endSpinDamage: 14 };

export function fusionName(a: string, b: string): string | null {
  return imbueConfig.fusions[[a, b].sort().join('+')] ?? null;
}
