import { combatConfig } from '../config/combat';
import type { Combatant } from './Combatant';

export interface HitInfo {
  /** Unique per swing. */
  instance: number;
  damage: number;
  poise: number;
  knockback: number;
  launch?: number;
  knockdown?: boolean;
  /** Direct attacks (melee/projectiles) can trigger Guardian's Embrace; damage over time cannot. */
  kind: 'melee' | 'projectile' | 'dot' | 'environment';
  /** Finishers ignore defence. */
  unblockable?: boolean;
}

export type HitOutcome =
  | { result: 'ignored' }
  | { result: 'evaded' }
  | { result: 'parried' }
  | { result: 'blocked'; damage: number; guardBroken: boolean }
  | { result: 'hit'; damage: number; staggered: boolean; knockedDown: boolean; vulnerable: boolean; killed: boolean; lethal: boolean };

export interface DefenderContext {
  now: number;
  /** Defender's stamina for blocking; mutated by the caller according to `staminaCost`. */
  stamina: number;
  /** True if the hit comes from in front of the defender (blocks only work facing the attack). */
  fromFront: boolean;
  /**
   * Called when a direct hit would kill. Returning true cancels the death (Guardian's Embrace, phase 5).
   * The hit then deals no damage.
   */
  preventDeath?: (hit: HitInfo) => boolean;
}

/**
 * Decides what a hit does to a defender (GDD 8): i-frames, perfect parry, block and guard break,
 * damage, poise break -> stagger / knockdown / vulnerable (finisher window), death.
 * Returns the outcome plus how much stamina blocking cost.
 */
export function resolveHit(target: Combatant, hit: HitInfo, ctx: DefenderContext): { outcome: HitOutcome; staminaCost: number } {
  const cfg = combatConfig;
  if (!target.alive || target.alreadyHitBy(hit.instance)) return { outcome: { result: 'ignored' }, staminaCost: 0 };
  target.markHit(hit.instance);
  if (target.invulnerable > 0 && hit.kind !== 'environment') return { outcome: { result: 'evaded' }, staminaCost: 0 };

  // Perfect parry: block pressed (tapped or held) just before the hit lands. Timing matters, holding does not.
  const canDefend = ctx.fromFront && !hit.unblockable && target.free && hit.kind !== 'dot';
  if (canDefend && ctx.now - target.blockPressedAt <= cfg.block.parryWindow && ctx.now >= target.blockPressedAt) {
    return { outcome: { result: 'parried' }, staminaCost: 0 };
  }
  const defending = target.blocking && canDefend;
  if (defending) {
    const cost = hit.damage * cfg.block.staminaPerDamage;
    if (ctx.stamina >= cost) {
      const dmg = Math.round(hit.damage * cfg.block.damageFactor);
      target.health = Math.max(1, target.health - dmg);
      return { outcome: { result: 'blocked', damage: dmg, guardBroken: false }, staminaCost: cost };
    }
    // Guard break: out of stamina, the block collapses into a stagger.
    target.blocking = false;
    target.setState('staggered', cfg.stagger.duration * 1.6);
    return { outcome: { result: 'blocked', damage: 0, guardBroken: true }, staminaCost: ctx.stamina };
  }

  const damage = Math.max(1, Math.round(hit.damage * target.damageTaken));
  const lethal = target.health - damage <= 0;
  const direct = hit.kind === 'melee' || hit.kind === 'projectile';
  if (lethal && direct && ctx.preventDeath?.(hit)) {
    return { outcome: { result: 'hit', damage: 0, staggered: false, knockedDown: false, vulnerable: false, killed: false, lethal: true }, staminaCost: 0 };
  }

  target.health = Math.max(0, target.health - damage);
  if (target.health <= 0) {
    target.setState('dead');
    return { outcome: { result: 'hit', damage, staggered: false, knockedDown: true, vulnerable: false, killed: true, lethal: true }, staminaCost: 0 };
  }

  let staggered = false;
  let knockedDown = false;
  let vulnerable = false;
  const armored = !!target.opts.superArmor || target.armored;
  if (target.state !== 'vulnerable' && !(target.armored && hit.kind !== 'environment')) {
    target.poise -= hit.poise;
    if (target.poise <= 0) {
      target.poise = 0;
      // Poise broken: the target is open to a finisher.
      target.setState('vulnerable', cfg.stagger.vulnerableDuration);
      vulnerable = true;
    } else if (hit.knockdown && !armored) {
      target.setState('knockdown', cfg.stagger.knockdownDuration);
      knockedDown = true;
    } else if (!armored && hit.poise >= target.opts.maxPoise * 0.25 && hit.kind !== 'dot') {
      target.setState('staggered', cfg.stagger.duration);
      staggered = true;
    }
  }
  return { outcome: { result: 'hit', damage, staggered, knockedDown, vulnerable, killed: false, lethal: false }, staminaCost: 0 };
}

/** Melee arc test on the ground plane: is the target inside reach and the attacker's facing cone? */
export function inArc(
  attacker: { x: number; z: number; facing: number },
  target: { x: number; z: number; radius: number },
  reach: number,
  arcDeg: number,
): boolean {
  const dx = target.x - attacker.x;
  const dz = target.z - attacker.z;
  const dist = Math.hypot(dx, dz);
  if (dist - target.radius > reach) return false;
  if (dist < 0.6) return true;
  const fx = Math.sin(attacker.facing);
  const fz = Math.cos(attacker.facing);
  const cos = (dx * fx + dz * fz) / dist;
  return cos >= Math.cos((arcDeg * Math.PI) / 180);
}

/** Is `from` in front of a defender facing `facing`? */
export function isInFront(defender: { x: number; z: number; facing: number }, from: { x: number; z: number }, halfAngleDeg = 80): boolean {
  return inArc(defender, { x: from.x, z: from.z, radius: 0 }, Infinity, halfAngleDeg);
}
