/** Arrows and other projectiles: straight flight with gravity, hit tests against vertical capsules. Pure logic. */
export interface Projectile {
  id: number;
  /** Swing/shot instance used for hit de-duplication. */
  instance: number;
  owner: string;
  /** Projectiles never hit their own side. */
  team: 'player' | 'enemy';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  age: number;
  life: number;
  damage: number;
  poise: number;
  knockback: number;
  /** Set when parried back toward enemies. */
  reflected: boolean;
  dead: boolean;
}

export interface CapsuleTarget {
  id: string;
  team: 'player' | 'enemy';
  x: number;
  /** Feet height. */
  y: number;
  z: number;
  radius: number;
  height: number;
}

let nextId = 1;

/** Initial velocity to hit a point `speed` m/s away along a straight line, corrected for gravity drop. */
export function aimVelocity(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, speed: number, gravity: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dy, dz) || 1;
  const t = d / speed;
  return { vx: (dx / d) * speed, vy: (dy / d) * speed + 0.5 * gravity * t, vz: (dz / d) * speed };
}

export class Projectiles {
  readonly list: Projectile[] = [];

  spawn(p: Omit<Projectile, 'id' | 'age' | 'dead' | 'reflected'>): Projectile {
    const proj: Projectile = { ...p, id: nextId++, age: 0, dead: false, reflected: false };
    this.list.push(proj);
    return proj;
  }

  /**
   * Moves every projectile with sub-steps (so fast arrows cannot tunnel through a body), kills those that hit
   * the ground or expire, and reports capsule hits. A projectile hits at most one target and then stops.
   */
  step(dt: number, groundAt: (x: number, z: number) => number, targets: CapsuleTarget[]): { projectile: Projectile; target: CapsuleTarget }[] {
    const hits: { projectile: Projectile; target: CapsuleTarget }[] = [];
    for (const p of this.list) {
      if (p.dead) continue;
      const speed = Math.hypot(p.vx, p.vy, p.vz);
      const sub = Math.max(1, Math.ceil((speed * dt) / 0.25));
      const h = dt / sub;
      for (let i = 0; i < sub && !p.dead; i++) {
        p.vy -= p.gravity * h;
        p.x += p.vx * h;
        p.y += p.vy * h;
        p.z += p.vz * h;
        for (const t of targets) {
          if (t.team === p.team) continue;
          if (p.y < t.y || p.y > t.y + t.height) continue;
          if (Math.hypot(p.x - t.x, p.z - t.z) > t.radius) continue;
          hits.push({ projectile: p, target: t });
          p.dead = true;
          break;
        }
        if (!p.dead && p.y < groundAt(p.x, p.z)) p.dead = true;
      }
      p.age += dt;
      if (p.age > p.life) p.dead = true;
    }
    return hits;
  }

  /** Sends a projectile back where it came from (perfect parry). */
  reflect(p: Projectile, newOwner: string, toward: { x: number; y: number; z: number }, speedScale = 1.2): void {
    const speed = Math.hypot(p.vx, p.vy, p.vz) * speedScale;
    const v = aimVelocity(p, toward, speed, p.gravity);
    Object.assign(p, v, { owner: newOwner, team: p.team === 'enemy' ? 'player' : 'enemy', reflected: true, dead: false, age: 0 });
  }

  prune(): Projectile[] {
    const dead = this.list.filter((p) => p.dead);
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].dead) this.list.splice(i, 1);
    return dead;
  }

  clear(): void {
    for (const p of this.list) p.dead = true;
  }
}
