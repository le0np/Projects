import type { RegionDef } from '../config/regions';
import { lerp, smoothstep } from '../core/math';
import { Simplex2 } from './noise';

/**
 * Pure-data terrain: a square grid of heights centred on the origin.
 * Rendering and physics both read from the same grid, so the player stands exactly on what is drawn.
 */
export class Heightfield {
  readonly size: number;
  readonly segments: number;
  readonly heights: Float32Array;
  readonly cell: number;
  minHeight = Infinity;
  maxHeight = -Infinity;

  constructor(size: number, segments: number, fn: (x: number, z: number) => number) {
    this.size = size;
    this.segments = segments;
    this.cell = size / segments;
    const n = segments + 1;
    this.heights = new Float32Array(n * n);
    const half = size / 2;
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const h = fn(-half + ix * this.cell, -half + iz * this.cell);
        this.heights[iz * n + ix] = h;
        if (h < this.minHeight) this.minHeight = h;
        if (h > this.maxHeight) this.maxHeight = h;
      }
    }
  }

  private at(ix: number, iz: number): number {
    const n = this.segments + 1;
    ix = Math.max(0, Math.min(this.segments, ix));
    iz = Math.max(0, Math.min(this.segments, iz));
    return this.heights[iz * n + ix];
  }

  /** Bilinear height at world position. Outside the grid the edge value is used. */
  heightAt(x: number, z: number): number {
    const half = this.size / 2;
    const fx = (x + half) / this.cell;
    const fz = (z + half) / this.cell;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const h00 = this.at(ix, iz);
    const h10 = this.at(ix + 1, iz);
    const h01 = this.at(ix, iz + 1);
    const h11 = this.at(ix + 1, iz + 1);
    return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
  }

  /** Gradient magnitude (rise over run). 0 = flat, 1 = 45 degrees. */
  slopeAt(x: number, z: number): number {
    const e = this.cell * 0.5;
    const dx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const dz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    return Math.hypot(dx, dz);
  }

  /** Uphill direction (dh/dx, dh/dz). */
  gradientAt(x: number, z: number): [number, number] {
    const e = this.cell * 0.5;
    return [
      (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e),
      (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e),
    ];
  }

  normalAt(x: number, z: number): [number, number, number] {
    const e = this.cell * 0.5;
    const dx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const dz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    const len = Math.hypot(dx, 1, dz);
    return [-dx / len, 1 / len, -dz / len];
  }
}

/** Builds the height function for a region from its config. */
export function regionHeightFn(def: RegionDef): (x: number, z: number) => number {
  const t = def.terrain;
  const noise = new Simplex2(def.seed);
  const ridgeNoise = new Simplex2(def.seed + 101);
  const rimNoise = new Simplex2(def.seed + 202);
  const half = t.size / 2;
  return (x, z) => {
    const hills = noise.fbm(x * t.hillScale, z * t.hillScale, 5) * t.hillAmplitude;
    const r = 1 - Math.abs(ridgeNoise.fbm(x * t.hillScale * 0.6, z * t.hillScale * 0.6, 3));
    const ridges = r * r * r * t.ridgeAmplitude;
    let h = t.baseHeight + hills + ridges;

    // Flattened clearing around the spawn so the first steps feel calm and readable.
    const ds = Math.hypot(x - def.spawn.x, z - def.spawn.z);
    const plateau = smoothstep(t.plateauRadius, t.plateauRadius * 2.4, ds);
    h = lerp(t.baseHeight + hills * 0.15, h, plateau);

    // Mountain rim that bounds the playable area (future: replaced by region borders/passes).
    const dr = Math.hypot(x, z) / half;
    const wobble = rimNoise.fbm(x * 0.02, z * 0.02, 3) * 0.08;
    const rim = smoothstep(0.6 + wobble, 0.97, dr);
    h += Math.pow(rim, 1.7) * t.rimHeight * (0.8 + 0.4 * rimNoise.noise(x * 0.01, z * 0.01));
    return h;
  };
}
