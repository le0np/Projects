import type { CollisionWorld, CylinderCollider } from '../physics/CharacterMotor';
import type { Heightfield } from './Heightfield';

/** Uniform spatial hash of cylinder colliders over a heightfield. */
export class CollisionGrid implements CollisionWorld {
  private cells = new Map<number, CylinderCollider[]>();
  readonly all: CylinderCollider[] = [];

  constructor(
    private readonly terrain: Heightfield,
    readonly boundsRadius: number,
    private readonly cellSize = 8,
  ) {}

  private key(cx: number, cz: number): number {
    return (cx + 1024) * 4096 + (cz + 1024);
  }

  add(c: CylinderCollider): void {
    this.all.push(c);
    const r = c.radius;
    const x0 = Math.floor((c.x - r) / this.cellSize);
    const x1 = Math.floor((c.x + r) / this.cellSize);
    const z0 = Math.floor((c.z - r) / this.cellSize);
    const z1 = Math.floor((c.z + r) / this.cellSize);
    for (let cx = x0; cx <= x1; cx++)
      for (let cz = z0; cz <= z1; cz++) {
        const k = this.key(cx, cz);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(c);
      }
  }

  heightAt(x: number, z: number): number {
    return this.terrain.heightAt(x, z);
  }

  gradientAt(x: number, z: number): [number, number] {
    return this.terrain.gradientAt(x, z);
  }

  *collidersNear(x: number, z: number, radius: number): Iterable<CylinderCollider> {
    const seen = new Set<CylinderCollider>();
    const x0 = Math.floor((x - radius) / this.cellSize);
    const x1 = Math.floor((x + radius) / this.cellSize);
    const z0 = Math.floor((z - radius) / this.cellSize);
    const z1 = Math.floor((z + radius) / this.cellSize);
    for (let cx = x0; cx <= x1; cx++)
      for (let cz = z0; cz <= z1; cz++) {
        const list = this.cells.get(this.key(cx, cz));
        if (!list) continue;
        for (const c of list) {
          if (seen.has(c)) continue;
          seen.add(c);
          yield c;
        }
      }
  }
}
