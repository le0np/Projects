import type { CapsuleTarget } from './Projectiles';

/**
 * The player's spear once thrown (G): flies with gravity, strikes the first enemy in its path, sticks in
 * the ground where it lands and waits to be picked up (walk over it or press E). Pure logic.
 */
export class ThrownSpear {
  state: 'held' | 'flying' | 'grounded' = 'held';
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  /** Direction of flight (kept after landing so the spear stays stuck at its angle). */
  dir = { x: 0, y: 0, z: 1 };
  instance = 0;
  private age = 0;

  constructor(
    readonly opts: { gravity: number; life: number } = { gravity: 9, life: 2.5 },
  ) {}

  throwFrom(from: { x: number; y: number; z: number }, v: { vx: number; vy: number; vz: number }, instance: number): void {
    Object.assign(this, from, v);
    this.instance = instance;
    this.state = 'flying';
    this.age = 0;
    this.updateDir();
  }

  private updateDir(): void {
    const l = Math.hypot(this.vx, this.vy, this.vz) || 1;
    this.dir = { x: this.vx / l, y: this.vy / l, z: this.vz / l };
  }

  /** Advances the flight; returns the target struck this step, if any. */
  step(dt: number, groundAt: (x: number, z: number) => number, targets: CapsuleTarget[]): CapsuleTarget | null {
    if (this.state !== 'flying') return null;
    const speed = Math.hypot(this.vx, this.vy, this.vz);
    const sub = Math.max(1, Math.ceil((speed * dt) / 0.25));
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      this.vy -= this.opts.gravity * h;
      this.x += this.vx * h;
      this.y += this.vy * h;
      this.z += this.vz * h;
      this.updateDir();
      for (const t of targets) {
        if (t.team === 'player') continue;
        if (this.y < t.y || this.y > t.y + t.height) continue;
        if (Math.hypot(this.x - t.x, this.z - t.z) > t.radius) continue;
        // Drops at the enemy's feet.
        this.land(t.x + this.dir.x * (t.radius + 0.3), t.z + this.dir.z * (t.radius + 0.3), groundAt);
        this.dir = { x: this.dir.x * 0.6, y: -0.8, z: this.dir.z * 0.6 };
        return t;
      }
      const g = groundAt(this.x, this.z);
      if (this.y <= g) {
        this.land(this.x, this.z, groundAt);
        return null;
      }
    }
    this.age += dt;
    if (this.age > this.opts.life) this.land(this.x, this.z, groundAt);
    return null;
  }

  private land(x: number, z: number, groundAt: (x: number, z: number) => number): void {
    this.state = 'grounded';
    this.x = x;
    this.z = z;
    this.y = groundAt(x, z);
    this.vx = this.vy = this.vz = 0;
  }

  /** Can a player at (x, z) take the spear? Walking over it is enough; E reaches a little further. */
  canPickUp(x: number, z: number, radius: number): boolean {
    return this.state === 'grounded' && Math.hypot(x - this.x, z - this.z) <= radius;
  }

  pickUp(): void {
    this.state = 'held';
  }
}
