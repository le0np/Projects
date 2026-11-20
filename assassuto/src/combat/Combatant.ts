/**
 * Health, poise and defensive state shared by the player and enemies. Pure data + rules;
 * movement and animation live elsewhere.
 */
export type CombatState = 'normal' | 'staggered' | 'knockdown' | 'vulnerable' | 'dead';

export interface CombatantOptions {
  maxHealth: number;
  maxPoise: number;
  poiseRegenPerSec: number;
  poiseRegenDelay?: number;
  superArmor?: boolean;
}

export class Combatant {
  health: number;
  poise: number;
  state: CombatState = 'normal';
  stateTimer = 0;
  /** Seconds of invulnerability left (dodge i-frames, after Guardian's Embrace, etc.). */
  invulnerable = 0;
  blocking = false;
  /** Game time when block was last pressed; used for the perfect-parry window. */
  blockPressedAt = -Infinity;
  /** Attack instances that already hit this combatant. */
  private hitBy = new Set<number>();
  private sinceHit = 0;

  constructor(
    readonly id: string,
    readonly opts: CombatantOptions,
  ) {
    this.health = opts.maxHealth;
    this.poise = opts.maxPoise;
  }

  get alive(): boolean {
    return this.state !== 'dead';
  }

  /** Can act (attack, move freely). */
  get free(): boolean {
    return this.state === 'normal';
  }

  alreadyHitBy(instance: number): boolean {
    return this.hitBy.has(instance);
  }

  markHit(instance: number): void {
    this.hitBy.add(instance);
    if (this.hitBy.size > 64) this.hitBy = new Set([...this.hitBy].slice(-32));
    this.sinceHit = 0;
  }

  setState(s: CombatState, duration = 0): void {
    this.state = s;
    this.stateTimer = duration;
  }

  tick(dt: number): void {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.sinceHit += dt;
    if (this.state !== 'dead' && this.state !== 'normal') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        // Recover; a vulnerable enemy comes back with full poise.
        if (this.state === 'vulnerable') this.poise = this.opts.maxPoise;
        this.state = 'normal';
      }
    }
    if (this.state === 'normal' && this.sinceHit >= (this.opts.poiseRegenDelay ?? 1.2)) {
      this.poise = Math.min(this.opts.maxPoise, this.poise + this.opts.poiseRegenPerSec * dt);
    }
  }

  heal(amount: number): void {
    if (this.alive) this.health = Math.min(this.opts.maxHealth, this.health + amount);
  }

  revive(): void {
    this.health = this.opts.maxHealth;
    this.poise = this.opts.maxPoise;
    this.state = 'normal';
    this.stateTimer = 0;
    this.invulnerable = 1.5;
    this.hitBy.clear();
  }
}
