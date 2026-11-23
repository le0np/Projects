import type { ElementId } from './elements';

/**
 * Elemental abilities (GDD 7): one per element. The starting element is unlocked from the beginning;
 * the others are unlocked by attuning at their region's shrine. All tuning lives here.
 */
export interface AbilityDef {
  id: string;
  element: ElementId;
  name: string;
  description: string;
  /** Seconds of game time. */
  cooldown: number;
  /** Time from the key press until the effect fires (wind-up of the cast animation). */
  castTime: number;
  /** Total time the caster is committed (cannot move or attack). */
  recovery: number;
  clip: string;
  clipRange?: [number, number];
  damage: number;
  poise: number;
  knockback: number;
  launch?: number;
  knockdown?: boolean;
}

export interface EmberBurstDef extends AbilityDef {
  kind: 'burst';
  radius: number;
  burn: { dps: number; duration: number };
}

export interface TidalSurgeDef extends AbilityDef {
  kind: 'wave';
  range: number;
  /** Half-angle of the cone, degrees. */
  arc: number;
  soak: { slow: number; duration: number };
}

export interface StoneAegisDef extends AbilityDef {
  kind: 'aegis';
  radius: number;
  duration: number;
  /** Multiplier on damage taken while the aegis holds. */
  damageTaken: number;
}

export interface GaleStepDef extends AbilityDef {
  kind: 'dash';
  distance: number;
  dashTime: number;
  /** Enemies within this distance of the dash path are hit. */
  hitRadius: number;
}

export type AnyAbilityDef = EmberBurstDef | TidalSurgeDef | StoneAegisDef | GaleStepDef;

export const abilities: Record<ElementId, AnyAbilityDef> = {
  fire: {
    id: 'emberBurst',
    kind: 'burst',
    element: 'fire',
    name: 'Ember Burst',
    description: 'An explosion of flame around you. Knocks enemies down and sets them burning.',
    cooldown: 9,
    castTime: 0.42,
    recovery: 0.75,
    clip: 'cast_a_spell',
    clipRange: [0.15, 0.85],
    damage: 26,
    poise: 35,
    knockback: 7,
    launch: 3,
    knockdown: true,
    radius: 4.8,
    burn: { dps: 5, duration: 4 },
  },
  water: {
    id: 'tidalSurge',
    kind: 'wave',
    element: 'water',
    name: 'Tidal Surge',
    description: 'A wave rolls forward, sweeping enemies back, washing arrows away and slowing everything it soaks.',
    cooldown: 8,
    castTime: 0.36,
    recovery: 0.7,
    clip: 'cast_a_spell',
    clipRange: [0.15, 0.85],
    damage: 14,
    poise: 35,
    knockback: 13,
    range: 9,
    arc: 50,
    soak: { slow: 0.5, duration: 5 },
  },
  earth: {
    id: 'stoneAegis',
    kind: 'aegis',
    element: 'earth',
    name: 'Stone Aegis',
    description: 'Stone armour that halves damage and cannot be staggered, raised with a shockwave.',
    cooldown: 16,
    castTime: 0.5,
    recovery: 0.8,
    clip: 'cast_a_spell',
    clipRange: [0.15, 0.85],
    damage: 12,
    poise: 30,
    knockback: 6,
    radius: 4,
    duration: 7,
    damageTaken: 0.5,
  },
  air: {
    id: 'galeStep',
    kind: 'dash',
    element: 'air',
    name: 'Gale Step',
    description: 'Part of the Wind mobility skill (with double jump and high jump): dash straight through enemies, untouchable, cutting and lifting them. Works in the air.',
    cooldown: 5,
    castTime: 0.05,
    recovery: 0.34,
    clip: 'dive',
    clipRange: [0.05, 0.7],
    damage: 12,
    poise: 28,
    knockback: 3,
    launch: 6,
    distance: 9,
    dashTime: 0.28,
    hitRadius: 1.4,
  },
};

export const abilityConfig = {
  /** The element chosen at character creation is stronger: more damage, shorter cooldown. */
  affinity: { damage: 1.2, cooldown: 0.8 },
  /** Burn ticks this often. */
  dotInterval: 0.5,
};
