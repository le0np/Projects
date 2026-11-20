/** Enemy archetypes (GDD 10). Phase 3 ships the Raider; Archer and Brute arrive in phase 4. */
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
}

export interface EnemyDef {
  id: string;
  name: string;
  assetId: string;
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

export const enemyDefs: Record<string, EnemyDef> = { raider };

export const aiConfig = {
  /** At most this many enemies attack the player at once (the rest circle). */
  maxAttackers: 1,
  tokenHold: 2.2,
  repathInterval: 0.25,
};
