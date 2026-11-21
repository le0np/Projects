/** Enemy archetypes (GDD 10): Raider (balanced melee), Archer (ranged, keeps distance) and Brute (heavy, super armour). */
export interface EnemyAttackDef {
  id: string;
  clip: string;
  duration: number;
  clipRange?: [number, number];
  /** Telegraph: the enemy glints/winds up before this time. */
  hitStart: number;
  hitEnd: number;
  damage: number;
  poise: number;
  knockback: number;
  reach: number;
  arc: number;
  lunge: number;
  /** Chance weight when choosing an attack. */
  weight: number;
  knockdown?: boolean;
  /** Cannot be blocked or parried (red telegraph): dodge it. */
  unblockable?: boolean;
  /** Area hit centred `reach * 0.6` in front of the enemy instead of an arc. */
  aoe?: number;
  /** Fires a projectile at `hitStart` instead of a melee hit. */
  projectile?: { speed: number; gravity: number; life: number };
}

export type EnemyRole = 'melee' | 'ranged';

export interface EnemyDef {
  id: string;
  name: string;
  assetId: string;
  role: EnemyRole;
  /** Visual variety on a shared Tripo model: height scale, extra width, colour tint and held weapon. */
  look: { scale: number; width: number; tint: number; weapon: 'sword' | 'bow' | 'club' };
  /** Multiplier on knockback received (heavy enemies barely move). */
  knockbackTaken: number;
  /** Body radius for collisions and hits. */
  radius: number;
  /** Ranged: back off when the player comes closer than this (with an evasive roll). */
  retreatRange?: number;
  maxHealth: number;
  maxPoise: number;
  poiseRegenPerSec: number;
  /** Super armor: hits don't interrupt attacks (heavy enemies). */
  superArmor: boolean;
  walkSpeed: number;
  runSpeed: number;
  noticeRange: number;
  /** Preferred distance while waiting for an attack token. */
  circleRange: [number, number];
  attackRange: number;
  /** Seconds between attacks for this enemy. */
  attackCooldown: [number, number];
  xp: number;
  color: number;
  attacks: EnemyAttackDef[];
}

export const raider: EnemyDef = {
  id: 'raider',
  name: 'Dune Raider',
  assetId: 'enemy_raider',
  role: 'melee',
  look: { scale: 1, width: 1, tint: 0xffffff, weapon: 'sword' },
  knockbackTaken: 1,
  radius: 0.45,
  maxHealth: 90,
  maxPoise: 45,
  poiseRegenPerSec: 14,
  superArmor: false,
  walkSpeed: 2.0,
  runSpeed: 4.6,
  noticeRange: 20,
  circleRange: [3.2, 4.6],
  attackRange: 2.3,
  attackCooldown: [1.4, 2.6],
  xp: 25,
  color: 0x8a4a32,
  attacks: [
    { id: 'rd_slash', clip: 'slash', duration: 1.05, clipRange: [0, 0.9], hitStart: 0.55, hitEnd: 0.68, damage: 14, poise: 18, knockback: 3, reach: 2.4, arc: 70, lunge: 0.8, weight: 3 },
    { id: 'rd_chop', clip: 'chop', duration: 1.4, clipRange: [0, 1], hitStart: 0.85, hitEnd: 1.0, damage: 24, poise: 40, knockback: 6, reach: 2.5, arc: 50, lunge: 1.0, weight: 1, knockdown: true },
  ],
};

/**
 * Archer: keeps 8-15 m away, looses telegraphed arrows (block, dodge, or parry to send them back) and rolls
 * away when the player closes in. Fragile once caught. Uses the Raider model (no extra Tripo credits):
 * slimmer, green-tinted, with a bow; the draw reuses the wind-up of the `chop` clip.
 */
export const archer: EnemyDef = {
  id: 'archer',
  name: 'Raider Archer',
  assetId: 'enemy_raider',
  role: 'ranged',
  look: { scale: 0.97, width: 0.9, tint: 0x9fcf8a, weapon: 'bow' },
  knockbackTaken: 1.1,
  radius: 0.42,
  retreatRange: 5,
  maxHealth: 60,
  maxPoise: 28,
  poiseRegenPerSec: 12,
  superArmor: false,
  walkSpeed: 2.3,
  runSpeed: 5.0,
  noticeRange: 26,
  circleRange: [8, 15],
  attackRange: 20,
  attackCooldown: [2.0, 3.2],
  xp: 30,
  color: 0x55703c,
  attacks: [
    { id: 'ar_shot', clip: 'chop', duration: 1.25, clipRange: [0, 0.42], hitStart: 0.85, hitEnd: 0.9, damage: 12, poise: 14, knockback: 2, reach: 20, arc: 15, lunge: 0, weight: 1, projectile: { speed: 24, gravity: 6, life: 2.5 } },
  ],
};

/**
 * Brute: big, slow and armoured. Super armour means hits never interrupt it; it has to be worn down
 * (poise) or dodged. The ground slam is unblockable (red telegraph). Same Raider model, scaled up,
 * widened, iron-tinted, with a club.
 */
export const brute: EnemyDef = {
  id: 'brute',
  name: 'Ironhide Brute',
  assetId: 'enemy_raider',
  role: 'melee',
  look: { scale: 1.38, width: 1.28, tint: 0xb4aab8, weapon: 'club' },
  knockbackTaken: 0.2,
  radius: 0.75,
  maxHealth: 260,
  maxPoise: 150,
  poiseRegenPerSec: 22,
  superArmor: true,
  walkSpeed: 1.7,
  runSpeed: 3.6,
  noticeRange: 18,
  circleRange: [3.6, 5.2],
  attackRange: 3.3,
  attackCooldown: [2.2, 3.4],
  xp: 80,
  color: 0x5a4a52,
  attacks: [
    { id: 'br_sweep', clip: 'slash', duration: 1.55, clipRange: [0, 1], hitStart: 0.95, hitEnd: 1.15, damage: 26, poise: 45, knockback: 8, reach: 3.5, arc: 100, lunge: 0.6, weight: 2 },
    { id: 'br_slam', clip: 'chop', duration: 2.0, clipRange: [0, 1], hitStart: 1.3, hitEnd: 1.42, damage: 40, poise: 80, knockback: 9, reach: 3.2, arc: 60, lunge: 0.5, weight: 1, knockdown: true, unblockable: true, aoe: 3.2 },
  ],
};

export const enemyDefs: Record<string, EnemyDef> = { raider, archer, brute };

/** Who lives in each region's camp (spawn slots are picked by the region). */
export const campRoster: string[] = ['raider', 'raider', 'archer', 'brute'];

export const aiConfig = {
  /** At most this many enemies attack the player at once (the rest circle). */
  maxAttackers: 1,
  /** Archers shoot on their own tokens so a melee attacker and one archer can pressure together. */
  maxShooters: 1,
  tokenHold: 2.2,
  repathInterval: 0.25,
};
