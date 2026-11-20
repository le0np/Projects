import { playerConfig } from '../config/player';

type StaminaCfg = typeof playerConfig.stamina;

/** Stamina pool with regen delay and an exhausted lock-out (pure logic). */
export class Stamina {
  value: number;
  exhausted = false;
  private sinceUse = 0;

  constructor(private readonly cfg: StaminaCfg = playerConfig.stamina) {
    this.value = cfg.max;
  }

  get ratio(): number {
    return this.value / this.cfg.max;
  }

  canSprint(): boolean {
    return !this.exhausted && this.value > 0;
  }

  /** Spend instantly (e.g. jump). Returns false if not enough. */
  spend(amount: number): boolean {
    if (this.value < amount) return false;
    this.value -= amount;
    this.sinceUse = 0;
    return true;
  }

  tick(dt: number, sprinting: boolean): void {
    if (sprinting) {
      this.value = Math.max(0, this.value - this.cfg.sprintCostPerSec * dt);
      this.sinceUse = 0;
      if (this.value === 0) this.exhausted = true;
      return;
    }
    this.sinceUse += dt;
    if (this.sinceUse >= this.cfg.regenDelay) this.value = Math.min(this.cfg.max, this.value + this.cfg.regenPerSec * dt);
    if (this.exhausted && this.value >= this.cfg.exhaustedThreshold) this.exhausted = false;
  }
}
