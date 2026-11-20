/**
 * Combat tuning (GDD 8). Every number that shapes how fights feel lives here.
 * Times are in seconds of game time; distances in metres.
 */
export type AttackInput = 'light' | 'heavy';

export interface AttackDef {
  id: string;
  /** Logical animation clip (see GltfCharacter); views fall back gracefully if it is missing. */
  clip: string;
  /** Total length of the move. The clip is time-scaled to fit. */
  duration: number;
  /** Portion of the clip to play (Tripo clips include long wind-ups/recoveries). */
  clipRange?: [number, number];
  hitStart: number;
  hitEnd: number;
  /** Inputs pressed inside this window chain into the next attack. */
  comboWindow: [number, number];
  /** After this time the move can be cancelled into a dodge/block. */
  cancelAfter: number;
  damage: number;
  /** Poise (stagger) damage. Breaking an enemy's poise staggers it. */
  poise: number;
  /** Knockback speed applied to the target, m/s. */
  knockback: number;
  /** Launches the target upward (m/s). */
  launch?: number;
  reach: number;
  /** Half-angle of the hit arc in degrees. */
  arc: number;
  /** Forward step during the move (m), applied over the wind-up. */
  lunge: number;
  stamina: number;
  hitstop: number;
  shake: number;
  /** Next attack by input. */
  next?: Partial<Record<AttackInput, string>>;
  /** Heavy hits make most enemies fall. */
  knockdown?: boolean;
}

export interface WeaponDef {
  id: string;
  name: string;
  /** Entry attacks from neutral, in the air, and after a perfect parry. */
  start: Record<AttackInput, string>;
  air: string;
  counter: string;
  finisher: string;
  attacks: Record<string, AttackDef>;
}

const A = (d: Omit<AttackDef, 'hitstop' | 'shake'> & Partial<Pick<AttackDef, 'hitstop' | 'shake'>>): AttackDef => ({ hitstop: 0.06, shake: 0.15, ...d });

export const sword: WeaponDef = {
  id: 'sword',
  name: 'Wayfarer Blade',
  start: { light: 'sw_l1', heavy: 'sw_h1' },
  air: 'sw_air',
  counter: 'sw_counter',
  finisher: 'sw_finisher',
  attacks: {
    sw_l1: A({ id: 'sw_l1', clip: 'slash', duration: 0.48, clipRange: [0.15, 0.85], hitStart: 0.16, hitEnd: 0.28, comboWindow: [0.18, 0.48], cancelAfter: 0.3, damage: 10, poise: 12, knockback: 2, reach: 2.4, arc: 70, lunge: 0.5, stamina: 6, next: { light: 'sw_l2', heavy: 'sw_lh' } }),
    sw_l2: A({ id: 'sw_l2', clip: 'box_01', duration: 0.44, clipRange: [0.1, 0.85], hitStart: 0.14, hitEnd: 0.26, comboWindow: [0.16, 0.44], cancelAfter: 0.28, damage: 11, poise: 12, knockback: 2, reach: 2.5, arc: 60, lunge: 0.6, stamina: 6, next: { light: 'sw_l3', heavy: 'sw_llh' } }),
    sw_l3: A({ id: 'sw_l3', clip: 'slash', duration: 0.6, clipRange: [0.1, 1], hitStart: 0.2, hitEnd: 0.34, comboWindow: [0.24, 0.6], cancelAfter: 0.4, damage: 16, poise: 20, knockback: 4.5, reach: 2.6, arc: 95, lunge: 0.9, stamina: 8, hitstop: 0.08, shake: 0.25, next: { light: 'sw_l1', heavy: 'sw_llh' } }),
    sw_h1: A({ id: 'sw_h1', clip: 'chop', duration: 0.85, clipRange: [0.1, 0.9], hitStart: 0.38, hitEnd: 0.5, comboWindow: [0.45, 0.85], cancelAfter: 0.55, damage: 24, poise: 35, knockback: 5, reach: 2.6, arc: 55, lunge: 0.7, stamina: 14, hitstop: 0.1, shake: 0.35, next: { heavy: 'sw_hh', light: 'sw_l2' } }),
    sw_hh: A({ id: 'sw_hh', clip: 'chop', duration: 0.95, clipRange: [0.05, 1], hitStart: 0.42, hitEnd: 0.56, comboWindow: [0.6, 0.95], cancelAfter: 0.65, damage: 32, poise: 55, knockback: 7, reach: 2.7, arc: 60, lunge: 1.0, stamina: 16, hitstop: 0.12, shake: 0.45, knockdown: true }),
    sw_lh: A({ id: 'sw_lh', clip: 'front_kick_01', duration: 0.7, clipRange: [0.1, 0.9], hitStart: 0.26, hitEnd: 0.38, comboWindow: [0.4, 0.7], cancelAfter: 0.45, damage: 14, poise: 40, knockback: 8, reach: 2.2, arc: 50, lunge: 0.6, stamina: 12, hitstop: 0.09, shake: 0.3, next: { light: 'sw_l1' } }),
    sw_llh: A({ id: 'sw_llh', clip: 'chop', duration: 0.9, clipRange: [0.05, 1], hitStart: 0.36, hitEnd: 0.5, comboWindow: [0.6, 0.9], cancelAfter: 0.6, damage: 28, poise: 60, knockback: 6, launch: 7, reach: 2.7, arc: 80, lunge: 0.9, stamina: 16, hitstop: 0.12, shake: 0.45, knockdown: true }),
    sw_air: A({ id: 'sw_air', clip: 'chop', duration: 0.6, clipRange: [0.15, 0.9], hitStart: 0.18, hitEnd: 0.34, comboWindow: [0.4, 0.6], cancelAfter: 0.4, damage: 18, poise: 30, knockback: 3, reach: 2.6, arc: 90, lunge: 0.4, stamina: 10, hitstop: 0.08, shake: 0.3 }),
    sw_counter: A({ id: 'sw_counter', clip: 'slash', duration: 0.5, clipRange: [0.15, 0.9], hitStart: 0.14, hitEnd: 0.28, comboWindow: [0.3, 0.5], cancelAfter: 0.3, damage: 30, poise: 80, knockback: 6, reach: 2.8, arc: 90, lunge: 1.0, stamina: 0, hitstop: 0.14, shake: 0.4, next: { light: 'sw_l2', heavy: 'sw_lh' } }),
    sw_finisher: A({ id: 'sw_finisher', clip: 'chop', duration: 1.4, clipRange: [0, 1], hitStart: 0.8, hitEnd: 0.95, comboWindow: [2, 2], cancelAfter: 1.4, damage: 9999, poise: 999, knockback: 9, launch: 4, reach: 3.2, arc: 120, lunge: 0.6, stamina: 0, hitstop: 0.2, shake: 0.7, knockdown: true }),
  },
};

/** Spear: longer reach, narrower arcs, fewer but more deliberate hits (proves weapon variety, GDD 9). */
export const spear: WeaponDef = {
  id: 'spear',
  name: 'Ashwood Spear',
  start: { light: 'sp_l1', heavy: 'sp_h1' },
  air: 'sp_air',
  counter: 'sp_counter',
  finisher: 'sw_finisher',
  attacks: {
    sp_l1: A({ id: 'sp_l1', clip: 'box_01', duration: 0.5, clipRange: [0.1, 0.85], hitStart: 0.18, hitEnd: 0.3, comboWindow: [0.2, 0.5], cancelAfter: 0.32, damage: 11, poise: 10, knockback: 2.5, reach: 3.3, arc: 30, lunge: 0.6, stamina: 7, next: { light: 'sp_l2', heavy: 'sp_h1' } }),
    sp_l2: A({ id: 'sp_l2', clip: 'box_02', duration: 0.55, clipRange: [0.1, 0.85], hitStart: 0.2, hitEnd: 0.32, comboWindow: [0.24, 0.55], cancelAfter: 0.36, damage: 13, poise: 14, knockback: 3.5, reach: 3.4, arc: 30, lunge: 0.7, stamina: 7, next: { light: 'sp_l1' } }),
    sp_h1: A({ id: 'sp_h1', clip: 'slash', duration: 0.9, clipRange: [0, 1], hitStart: 0.4, hitEnd: 0.56, comboWindow: [0.5, 0.9], cancelAfter: 0.6, damage: 22, poise: 40, knockback: 6, reach: 3.4, arc: 120, lunge: 0.4, stamina: 15, hitstop: 0.1, shake: 0.35, knockdown: true }),
    sp_air: A({ id: 'sp_air', clip: 'chop', duration: 0.6, clipRange: [0.15, 0.9], hitStart: 0.2, hitEnd: 0.34, comboWindow: [0.4, 0.6], cancelAfter: 0.4, damage: 16, poise: 25, knockback: 3, reach: 3, arc: 60, lunge: 0.4, stamina: 10 }),
    sp_counter: A({ id: 'sp_counter', clip: 'box_02', duration: 0.5, clipRange: [0.1, 0.9], hitStart: 0.14, hitEnd: 0.28, comboWindow: [0.3, 0.5], cancelAfter: 0.3, damage: 30, poise: 80, knockback: 7, reach: 3.5, arc: 40, lunge: 1.0, stamina: 0, hitstop: 0.14, shake: 0.4 }),
  },
};

export const weapons: Record<string, WeaponDef> = { sword, spear };

export const combatConfig = {
  inputBuffer: 0.25,
  player: {
    maxHealth: 160,
    maxPoise: 60,
    poiseRegenDelay: 1.6,
    poiseRegenPerSec: 30,
  },
  dodge: { duration: 0.42, distance: 4.2, iframeStart: 0.02, iframeEnd: 0.32, stamina: 18, cooldown: 0.12 },
  block: {
    /** Damage taken while blocking. */
    damageFactor: 0.2,
    /** Stamina lost per blocked point of damage. */
    staminaPerDamage: 1.1,
    /** Pressing block this close before a hit lands is a perfect parry. */
    parryWindow: 0.16,
    parrySlowmo: 0.35,
    parrySlowmoScale: 0.25,
    /** After a parry, a light attack within this time becomes a counter. */
    counterWindow: 1.0,
  },
  stagger: { duration: 0.55, knockdownDuration: 1.6, vulnerableDuration: 2.6 },
  finisher: { range: 3.2, slowmoScale: 0.35 },
  lockOn: { range: 22, breakRange: 30 },
  aimAssist: { range: 4.5, arc: 70 },
  hitstopScale: 0.04,
} as const;
