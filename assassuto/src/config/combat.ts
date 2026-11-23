/**
 * Combat tuning (GDD 8). Every number that shapes how fights feel lives here.
 * Times are in seconds of game time; distances in metres.
 */
import type { PoseOverlay } from '../animation/clipTools';
import { poses } from './moves';

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
  /** Bone rotations layered on the clip (see config/moves.ts). */
  overlay?: PoseOverlay;
  /** Throws instead of striking: the weapon leaves the hand at this time (no melee hit). */
  release?: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  /**
   * Combo strings per button. Starting a string picks one at random (never the same one twice in a row),
   * like a fighter mixing up their attacks. Each further press of the same button plays the next move.
   */
  combos: Record<AttackInput, string[][]>;
  air: string;
  counter: string;
  finisher: string;
  attacks: Record<string, AttackDef>;
}

const A = (d: Omit<AttackDef, 'hitstop' | 'shake'> & Partial<Pick<AttackDef, 'hitstop' | 'shake'>>): AttackDef => ({ hitstop: 0.06, shake: 0.15, ...d });

/**
 * Unarmed (key 1): the weapon is put away. LMB throws punches (jabs, straights, hooks, uppercuts),
 * RMB throws kicks. Faster and cheaper than weapons, but shorter reach and less damage.
 */
export const fists: WeaponDef = {
  id: 'fists',
  name: 'Unarmed',
  combos: {
    light: [
      ['fi_jab', 'fi_jab_r', 'fi_hook_l', 'fi_upper_r'],
      ['fi_jab', 'fi_jab', 'fi_cross'],
      ['fi_jab_r', 'fi_hook_l', 'fi_cross'],
      ['fi_hook_r', 'fi_upper_l', 'fi_cross'],
      ['fi_jab', 'fi_upper_r', 'fi_hook_l'],
    ],
    heavy: [
      ['fi_push', 'fi_round_r'],
      ['fi_round_r', 'fi_round_l'],
      ['fi_knee', 'fi_push'],
      ['fi_round_l', 'fi_spin'],
      ['fi_push', 'fi_flip'],
    ],
  },
  air: 'fi_air',
  counter: 'fi_counter',
  finisher: 'fi_finisher',
  attacks: {
    fi_jab: A({ id: 'fi_jab', clip: 'box_01', duration: 0.34, clipRange: [0.12, 0.55], hitStart: 0.1, hitEnd: 0.18, comboWindow: [0.12, 0.34], cancelAfter: 0.2, damage: 6, poise: 9, knockback: 1.5, reach: 1.7, arc: 55, lunge: 0.35, stamina: 4, hitstop: 0.05 }),
    fi_jab_r: A({ id: 'fi_jab_r', clip: 'box_01_m', duration: 0.36, clipRange: [0.12, 0.55], hitStart: 0.11, hitEnd: 0.19, comboWindow: [0.13, 0.36], cancelAfter: 0.21, damage: 7, poise: 10, knockback: 1.8, reach: 1.75, arc: 55, lunge: 0.4, stamina: 4, hitstop: 0.05 }),
    fi_cross: A({ id: 'fi_cross', clip: 'box_02', duration: 0.42, clipRange: [0.58, 0.95], hitStart: 0.13, hitEnd: 0.23, comboWindow: [0.16, 0.42], cancelAfter: 0.26, damage: 10, poise: 15, knockback: 3, reach: 1.85, arc: 55, lunge: 0.55, stamina: 5, hitstop: 0.07, shake: 0.2 }),
    fi_hook_l: A({ id: 'fi_hook_l', clip: 'box_01', duration: 0.42, clipRange: [0.1, 0.6], hitStart: 0.14, hitEnd: 0.24, comboWindow: [0.16, 0.42], cancelAfter: 0.26, damage: 9, poise: 15, knockback: 2.5, reach: 1.7, arc: 85, lunge: 0.4, stamina: 5, overlay: poses.hookL, hitstop: 0.06 }),
    fi_hook_r: A({ id: 'fi_hook_r', clip: 'box_01_m', duration: 0.42, clipRange: [0.1, 0.6], hitStart: 0.14, hitEnd: 0.24, comboWindow: [0.16, 0.42], cancelAfter: 0.26, damage: 9, poise: 15, knockback: 2.5, reach: 1.7, arc: 85, lunge: 0.4, stamina: 5, overlay: poses.hookR, hitstop: 0.06 }),
    fi_upper_r: A({ id: 'fi_upper_r', clip: 'box_02', duration: 0.52, clipRange: [0.18, 0.5], hitStart: 0.24, hitEnd: 0.34, comboWindow: [0.3, 0.52], cancelAfter: 0.36, damage: 12, poise: 24, knockback: 2, launch: 6, reach: 1.7, arc: 55, lunge: 0.45, stamina: 7, overlay: poses.uppercutR, hitstop: 0.09, shake: 0.28 }),
    fi_upper_l: A({ id: 'fi_upper_l', clip: 'box_02_m', duration: 0.52, clipRange: [0.18, 0.5], hitStart: 0.24, hitEnd: 0.34, comboWindow: [0.3, 0.52], cancelAfter: 0.36, damage: 12, poise: 24, knockback: 2, launch: 6, reach: 1.7, arc: 55, lunge: 0.45, stamina: 7, overlay: poses.uppercutL, hitstop: 0.09, shake: 0.28 }),
    fi_push: A({ id: 'fi_push', clip: 'stance', duration: 0.6, clipRange: [0, 0.04], hitStart: 0.25, hitEnd: 0.37, comboWindow: [0.36, 0.6], cancelAfter: 0.42, damage: 13, poise: 30, knockback: 7.5, reach: 2.1, arc: 45, lunge: 0.4, stamina: 9, overlay: poses.pushKickR, hitstop: 0.09, shake: 0.3 }),
    fi_knee: A({ id: 'fi_knee', clip: 'stance', duration: 0.5, clipRange: [0, 0.04], hitStart: 0.2, hitEnd: 0.3, comboWindow: [0.28, 0.5], cancelAfter: 0.34, damage: 12, poise: 28, knockback: 3, reach: 1.5, arc: 55, lunge: 0.6, stamina: 8, overlay: poses.kneeR, hitstop: 0.09, shake: 0.25 }),
    fi_round_r: A({ id: 'fi_round_r', clip: 'front_kick_01', duration: 0.72, clipRange: [0.08, 0.85], hitStart: 0.3, hitEnd: 0.42, comboWindow: [0.4, 0.72], cancelAfter: 0.48, damage: 16, poise: 34, knockback: 6, reach: 2.1, arc: 70, lunge: 0.5, stamina: 10, overlay: poses.roundhouseR, hitstop: 0.1, shake: 0.32 }),
    fi_round_l: A({ id: 'fi_round_l', clip: 'front_kick_01_m', duration: 0.72, clipRange: [0.08, 0.85], hitStart: 0.3, hitEnd: 0.42, comboWindow: [0.4, 0.72], cancelAfter: 0.48, damage: 16, poise: 34, knockback: 6, reach: 2.1, arc: 70, lunge: 0.5, stamina: 10, overlay: poses.roundhouseL, hitstop: 0.1, shake: 0.32 }),
    fi_spin: A({ id: 'fi_spin', clip: 'front_kick_01', duration: 0.8, clipRange: [0.05, 0.9], hitStart: 0.3, hitEnd: 0.48, comboWindow: [0.5, 0.8], cancelAfter: 0.55, damage: 19, poise: 45, knockback: 8, reach: 2.2, arc: 180, lunge: 0.4, stamina: 13, knockdown: true, hitstop: 0.11, shake: 0.4 }),
    fi_flip: A({ id: 'fi_flip', clip: 'flip', duration: 0.88, clipRange: [0.18, 0.64], hitStart: 0.38, hitEnd: 0.54, comboWindow: [0.58, 0.88], cancelAfter: 0.62, damage: 18, poise: 50, knockback: 5, launch: 7, reach: 2.0, arc: 80, lunge: 0.5, stamina: 14, knockdown: true, hitstop: 0.11, shake: 0.4 }),
    fi_air: A({ id: 'fi_air', clip: 'front_kick_01', duration: 0.55, clipRange: [0.1, 0.9], hitStart: 0.18, hitEnd: 0.32, comboWindow: [0.36, 0.55], cancelAfter: 0.36, damage: 12, poise: 25, knockback: 4, reach: 2.0, arc: 80, lunge: 0.4, stamina: 8 }),
    fi_counter: A({ id: 'fi_counter', clip: 'box_02', duration: 0.46, clipRange: [0.55, 0.95], hitStart: 0.12, hitEnd: 0.24, comboWindow: [0.26, 0.46], cancelAfter: 0.28, damage: 20, poise: 70, knockback: 6, reach: 2.1, arc: 90, lunge: 0.9, stamina: 0, hitstop: 0.13, shake: 0.35 }),
    fi_finisher: A({ id: 'fi_finisher', clip: 'flip', duration: 1.3, clipRange: [0, 1], hitStart: 0.6, hitEnd: 0.8, comboWindow: [2, 2], cancelAfter: 1.3, damage: 9999, poise: 999, knockback: 10, launch: 5, reach: 2.6, arc: 120, lunge: 0.4, stamina: 0, hitstop: 0.2, shake: 0.7, knockdown: true }),
  },
};

/*
 * Armed styles only use weapon swings built from the Tripo two-handed `slash` (segments, mirrored,
 * played backwards for rising cuts, and with overlays): a fighter holding a blade never punches or kicks.
 */
export const sword: WeaponDef = {
  id: 'sword',
  name: 'Wayfarer Blade',
  combos: {
    light: [
      ['sw_diag_l', 'sw_diag_r', 'sw_sweep'],
      ['sw_diag_r', 'sw_diag_l', 'sw_rise', 'sw_diag_l'],
      ['sw_sweep', 'sw_sweep_m', 'sw_diag_l'],
      ['sw_diag_l', 'sw_rise', 'sw_diag_r'],
      ['sw_rise', 'sw_diag_r', 'sw_sweep_m'],
    ],
    heavy: [
      ['sw_over', 'sw_spin'],
      ['sw_thrust', 'sw_over'],
      ['sw_spin', 'sw_launch'],
      ['sw_launch', 'sw_over'],
      ['sw_over', 'sw_thrust'],
    ],
  },
  air: 'sw_air',
  counter: 'sw_counter',
  finisher: 'sw_finisher',
  attacks: {
    sw_diag_l: A({ id: 'sw_diag_l', clip: 'slash', duration: 0.46, clipRange: [0.18, 0.5], hitStart: 0.15, hitEnd: 0.27, comboWindow: [0.17, 0.46], cancelAfter: 0.3, damage: 10, poise: 12, knockback: 2, reach: 2.4, arc: 70, lunge: 0.5, stamina: 6 }),
    sw_diag_r: A({ id: 'sw_diag_r', clip: 'slash_m', duration: 0.46, clipRange: [0.18, 0.5], hitStart: 0.15, hitEnd: 0.27, comboWindow: [0.17, 0.46], cancelAfter: 0.3, damage: 10, poise: 12, knockback: 2, reach: 2.4, arc: 70, lunge: 0.5, stamina: 6 }),
    sw_rise: A({ id: 'sw_rise', clip: 'slash', duration: 0.44, clipRange: [0.42, 0.2], hitStart: 0.14, hitEnd: 0.26, comboWindow: [0.18, 0.44], cancelAfter: 0.3, damage: 11, poise: 16, knockback: 2, launch: 5, reach: 2.4, arc: 60, lunge: 0.5, stamina: 7 }),
    sw_sweep: A({ id: 'sw_sweep', clip: 'slash', duration: 0.6, clipRange: [0.15, 0.55], hitStart: 0.24, hitEnd: 0.36, comboWindow: [0.3, 0.6], cancelAfter: 0.4, damage: 14, poise: 18, knockback: 4.5, reach: 2.6, arc: 120, lunge: 0.7, stamina: 8, overlay: poses.sweepSlash, hitstop: 0.08, shake: 0.25 }),
    sw_sweep_m: A({ id: 'sw_sweep_m', clip: 'slash_m', duration: 0.6, clipRange: [0.15, 0.55], hitStart: 0.24, hitEnd: 0.36, comboWindow: [0.3, 0.6], cancelAfter: 0.4, damage: 14, poise: 18, knockback: 4.5, reach: 2.6, arc: 120, lunge: 0.7, stamina: 8, overlay: poses.sweepSlashM, hitstop: 0.08, shake: 0.25 }),
    sw_over: A({ id: 'sw_over', clip: 'slash', duration: 0.82, clipRange: [0.12, 0.55], hitStart: 0.38, hitEnd: 0.5, comboWindow: [0.45, 0.82], cancelAfter: 0.55, damage: 24, poise: 38, knockback: 5, reach: 2.6, arc: 55, lunge: 0.7, stamina: 14, overlay: poses.overhead, hitstop: 0.11, shake: 0.38 }),
    sw_spin: A({ id: 'sw_spin', clip: 'slash', duration: 0.9, clipRange: [0.15, 0.55], hitStart: 0.34, hitEnd: 0.58, comboWindow: [0.6, 0.9], cancelAfter: 0.65, damage: 22, poise: 45, knockback: 7, reach: 2.7, arc: 180, lunge: 0.6, stamina: 16, knockdown: true, overlay: poses.spin, hitstop: 0.11, shake: 0.42 }),
    sw_thrust: A({ id: 'sw_thrust', clip: 'slash', duration: 0.6, clipRange: [0.28, 0.42], hitStart: 0.24, hitEnd: 0.34, comboWindow: [0.36, 0.6], cancelAfter: 0.42, damage: 20, poise: 32, knockback: 6, reach: 3.0, arc: 28, lunge: 1.4, stamina: 12, overlay: poses.thrust, hitstop: 0.1, shake: 0.32 }),
    sw_launch: A({ id: 'sw_launch', clip: 'slash_m', duration: 0.78, clipRange: [0.45, 0.18], hitStart: 0.3, hitEnd: 0.44, comboWindow: [0.5, 0.78], cancelAfter: 0.55, damage: 22, poise: 60, knockback: 4, launch: 8, reach: 2.6, arc: 70, lunge: 0.8, stamina: 15, knockdown: true, hitstop: 0.12, shake: 0.45 }),
    sw_air: A({ id: 'sw_air', clip: 'slash', duration: 0.6, clipRange: [0.15, 0.5], hitStart: 0.18, hitEnd: 0.34, comboWindow: [0.4, 0.6], cancelAfter: 0.4, damage: 18, poise: 30, knockback: 3, reach: 2.6, arc: 90, lunge: 0.4, stamina: 10, overlay: poses.overhead, hitstop: 0.08, shake: 0.3 }),
    sw_counter: A({ id: 'sw_counter', clip: 'slash_m', duration: 0.5, clipRange: [0.18, 0.55], hitStart: 0.14, hitEnd: 0.28, comboWindow: [0.3, 0.5], cancelAfter: 0.3, damage: 26, poise: 80, knockback: 6, reach: 2.8, arc: 90, lunge: 1.0, stamina: 0, hitstop: 0.14, shake: 0.4 }),
    sw_finisher: A({ id: 'sw_finisher', clip: 'slash', duration: 1.4, clipRange: [0, 0.6], hitStart: 0.8, hitEnd: 0.95, comboWindow: [2, 2], cancelAfter: 1.4, damage: 9999, poise: 999, knockback: 9, launch: 4, reach: 3.2, arc: 120, lunge: 0.6, stamina: 0, hitstop: 0.2, shake: 0.7, knockdown: true, overlay: poses.overhead }),
  },
};

/** Spear (key 3): long reach, narrow thrusts and wide sweeps. G throws it; walk over it or press E to pick it up. */
export const spear: WeaponDef = {
  id: 'spear',
  name: 'Ashwood Spear',
  combos: {
    light: [
      ['sp_thrust', 'sp_thrust', 'sp_sweep'],
      ['sp_jab', 'sp_jab', 'sp_thrust'],
      ['sp_sweep', 'sp_sweep_m', 'sp_thrust'],
      ['sp_thrust', 'sp_sweep_m'],
      ['sp_sweep_m', 'sp_jab', 'sp_thrust'],
    ],
    heavy: [
      ['sp_slam', 'sp_spin'],
      ['sp_spin'],
      ['sp_lunge', 'sp_slam'],
      ['sp_lunge', 'sp_spin'],
      ['sp_slam'],
    ],
  },
  air: 'sp_air',
  counter: 'sp_counter',
  finisher: 'sp_finisher',
  attacks: {
    sp_thrust: A({ id: 'sp_thrust', clip: 'slash', duration: 0.48, clipRange: [0.28, 0.42], hitStart: 0.18, hitEnd: 0.28, comboWindow: [0.2, 0.48], cancelAfter: 0.32, damage: 12, poise: 12, knockback: 3, reach: 3.4, arc: 24, lunge: 0.8, stamina: 7, overlay: poses.thrust }),
    sp_jab: A({ id: 'sp_jab', clip: 'slash', duration: 0.36, clipRange: [0.3, 0.4], hitStart: 0.13, hitEnd: 0.21, comboWindow: [0.15, 0.36], cancelAfter: 0.24, damage: 8, poise: 8, knockback: 2, reach: 3.3, arc: 22, lunge: 0.5, stamina: 5, overlay: poses.thrust, hitstop: 0.05 }),
    sp_sweep: A({ id: 'sp_sweep', clip: 'slash', duration: 0.62, clipRange: [0.15, 0.55], hitStart: 0.24, hitEnd: 0.38, comboWindow: [0.32, 0.62], cancelAfter: 0.42, damage: 13, poise: 16, knockback: 5, reach: 3.3, arc: 130, lunge: 0.5, stamina: 9, overlay: poses.sweepSlash, hitstop: 0.08, shake: 0.25 }),
    sp_sweep_m: A({ id: 'sp_sweep_m', clip: 'slash_m', duration: 0.62, clipRange: [0.15, 0.55], hitStart: 0.24, hitEnd: 0.38, comboWindow: [0.32, 0.62], cancelAfter: 0.42, damage: 13, poise: 16, knockback: 5, reach: 3.3, arc: 130, lunge: 0.5, stamina: 9, overlay: poses.sweepSlashM, hitstop: 0.08, shake: 0.25 }),
    sp_slam: A({ id: 'sp_slam', clip: 'slash', duration: 0.88, clipRange: [0.12, 0.55], hitStart: 0.4, hitEnd: 0.54, comboWindow: [0.5, 0.88], cancelAfter: 0.6, damage: 24, poise: 42, knockback: 6, reach: 3.5, arc: 35, lunge: 0.5, stamina: 15, knockdown: true, overlay: poses.overhead, hitstop: 0.11, shake: 0.4 }),
    sp_spin: A({ id: 'sp_spin', clip: 'slash', duration: 0.92, clipRange: [0.15, 0.55], hitStart: 0.34, hitEnd: 0.6, comboWindow: [0.62, 0.92], cancelAfter: 0.66, damage: 20, poise: 40, knockback: 7, reach: 3.4, arc: 180, lunge: 0.3, stamina: 16, knockdown: true, overlay: poses.spin, hitstop: 0.1, shake: 0.4 }),
    sp_lunge: A({ id: 'sp_lunge', clip: 'slash', duration: 0.7, clipRange: [0.28, 0.42], hitStart: 0.3, hitEnd: 0.42, comboWindow: [0.44, 0.7], cancelAfter: 0.5, damage: 22, poise: 36, knockback: 7, reach: 3.6, arc: 22, lunge: 2.2, stamina: 13, overlay: poses.thrust, hitstop: 0.1, shake: 0.35 }),
    sp_throw: A({ id: 'sp_throw', clip: 'slash', duration: 0.6, clipRange: [0.12, 0.3], hitStart: 0.27, hitEnd: 0.28, release: 0.27, comboWindow: [0.4, 0.6], cancelAfter: 0.4, damage: 0, poise: 0, knockback: 0, reach: 0, arc: 0, lunge: 0.3, stamina: 10, overlay: poses.throwSpear }),
    sp_air: A({ id: 'sp_air', clip: 'slash', duration: 0.6, clipRange: [0.15, 0.5], hitStart: 0.2, hitEnd: 0.34, comboWindow: [0.4, 0.6], cancelAfter: 0.4, damage: 16, poise: 25, knockback: 3, reach: 3, arc: 60, lunge: 0.4, stamina: 10, overlay: poses.overhead }),
    sp_counter: A({ id: 'sp_counter', clip: 'slash', duration: 0.5, clipRange: [0.28, 0.42], hitStart: 0.14, hitEnd: 0.28, comboWindow: [0.3, 0.5], cancelAfter: 0.3, damage: 26, poise: 80, knockback: 7, reach: 3.5, arc: 60, lunge: 1.0, stamina: 0, overlay: poses.thrust, hitstop: 0.14, shake: 0.4 }),
    sp_finisher: A({ id: 'sp_finisher', clip: 'slash', duration: 1.4, clipRange: [0, 0.6], hitStart: 0.8, hitEnd: 0.95, comboWindow: [2, 2], cancelAfter: 1.4, damage: 9999, poise: 999, knockback: 9, launch: 4, reach: 3.6, arc: 120, lunge: 0.6, stamina: 0, hitstop: 0.2, shake: 0.7, knockdown: true, overlay: poses.overhead }),
  },
};

/** Keys 1-3: 1 is always unarmed, 2 the sword, 3 the spear. */
export const weaponOrder = ['fists', 'sword', 'spear'] as const;

/** Clips that only make sense with a blade in hand / with empty hands. Used to verify the rule in tests. */
export const armedClips = ['slash', 'slash_m', 'chop'];
export const unarmedClips = ['box_01', 'box_01_m', 'box_02', 'box_02_m', 'front_kick_01', 'front_kick_01_m', 'flip', 'flip_m', 'stance'];

export const weapons: Record<string, WeaponDef> = { sword, spear, fists };

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
    /**
     * Pressing block (Q) this close before a hit lands is a perfect parry: the attack is deflected and the
     * fighter counter-attacks on their own. Holding block earlier only blocks.
     */
    parryWindow: 0.2,
    /** A press that parries nothing locks parrying for this long, so mashing Q does not work. */
    parryCooldown: 0.5,
    /** The automatic counter kills ordinary enemies at or below this share of their health. */
    counterExecute: 0.35,
    parrySlowmo: 0.35,
    parrySlowmoScale: 0.25,
    /** After a parry, a light attack within this time becomes a counter. */
    counterWindow: 1.0,
  },
  stagger: { duration: 0.55, knockdownDuration: 1.6, vulnerableDuration: 2.6 },
  finisher: { range: 3.2, slowmoScale: 0.35, buffer: 0.4 },
  lockOn: { range: 22, breakRange: 30 },
  aimAssist: { range: 4.5, arc: 70 },
  hitstopScale: 0.04,
  /** Spear throw (G with the spear in hand). */
  spearThrow: { speed: 30, gravity: 9, life: 2.5, damage: 32, poise: 45, knockback: 5, aimRange: 32, aimArc: 25, pickupWalk: 1.3, pickupInteract: 2.8 },
  /** Multipliers for the last move of a combo string. */
  comboEnder: { damage: 1.3, poise: 1.4, knockback: 1.3 },
} as const;
