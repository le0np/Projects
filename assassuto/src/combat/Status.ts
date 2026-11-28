import { abilityConfig } from '../config/abilities';

/**
 * Elemental status effects on a combatant: burning (damage over time), soaked (slowed movement and
 * attacks), chilled (frost-weapon hits stacking up) and frozen (encased in ice, cannot act).
 * Pure logic: `tick` returns how much burn damage lands this step.
 */
export class StatusEffects {
  burnTime = 0;
  burnDps = 0;
  soakTime = 0;
  soakSlow = 1;
  /** Frost hits taken recently; at the threshold the target freezes. */
  chill = 0;
  private chillTime = 0;
  frozenTime = 0;
  private burnAcc = 0;
  private burnTimer = 0;

  burn(dps: number, duration: number): void {
    this.burnDps = Math.max(this.burnTime > 0 ? this.burnDps : 0, dps);
    this.burnTime = Math.max(this.burnTime, duration);
  }

  soak(slow: number, duration: number): void {
    this.soakSlow = Math.min(this.soakTime > 0 ? this.soakSlow : 1, slow);
    this.soakTime = Math.max(this.soakTime, duration);
  }

  /**
   * A frost-weapon hit: adds a chill stack (they fade after `memory` seconds without a new one).
   * Returns true when this hit freezes the target.
   */
  addChill(threshold: number, freezeTime: number, memory = 4): boolean {
    if (this.frozen) return false;
    this.chill++;
    this.chillTime = memory;
    if (this.chill < threshold) return false;
    this.chill = 0;
    this.frozenTime = freezeTime;
    return true;
  }

  get frozen(): boolean {
    return this.frozenTime > 0;
  }

  /** Ends the freeze (shattered). */
  thaw(): void {
    this.frozenTime = 0;
    this.chill = 0;
  }

  /** Multiplier for movement and attack speed. */
  get speed(): number {
    return this.soakTime > 0 ? this.soakSlow : 1;
  }

  get burning(): boolean {
    return this.burnTime > 0;
  }

  get soaked(): boolean {
    return this.soakTime > 0;
  }

  /** Advances timers; returns burn damage to apply now (whole ticks every `dotInterval`). */
  tick(dt: number): number {
    let damage = 0;
    if (this.burnTime > 0) {
      const t = Math.min(dt, this.burnTime);
      this.burnAcc += this.burnDps * t;
      this.burnTime -= t;
      this.burnTimer += dt;
      if (this.burnTimer >= abilityConfig.dotInterval || this.burnTime <= 0) {
        this.burnTimer = 0;
        damage = Math.round(this.burnAcc);
        this.burnAcc -= damage;
      }
    }
    if (this.soakTime > 0) this.soakTime = Math.max(0, this.soakTime - dt);
    if (this.frozenTime > 0) this.frozenTime = Math.max(0, this.frozenTime - dt);
    if (this.chillTime > 0) {
      this.chillTime -= dt;
      if (this.chillTime <= 0) this.chill = 0;
    }
    return damage;
  }

  clear(): void {
    this.burnTime = this.soakTime = this.burnAcc = this.burnTimer = 0;
    this.chill = this.chillTime = this.frozenTime = 0;
    this.soakSlow = 1;
  }
}
