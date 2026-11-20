import * as THREE from 'three';
import type { RegionDef } from '../config/regions';
import { elements } from '../config/elements';
import { rng, smoothstep } from '../core/math';
import { addWind, keepNormalOnBackFaces, toonMaterial } from '../render/ToonMaterials';
import { CollisionGrid } from './CollisionGrid';
import { Heightfield, regionHeightFn } from './Heightfield';
import { Simplex2 } from './noise';
import { buildPropTemplate } from './props';

/** A built, playable region: render group + terrain data + collision. */
export class Region {
  readonly group = new THREE.Group();
  readonly terrain: Heightfield;
  readonly collision: CollisionGrid;
  readonly spawn: THREE.Vector3;
  readonly landmark: THREE.Vector3;
  private windUniform = { time: { value: 0 } };
  private animated: ((t: number) => void)[] = [];
  private disposables: { dispose(): void }[] = [];

  constructor(readonly def: RegionDef) {
    const t = def.terrain;
    this.terrain = new Heightfield(t.size, t.segments, regionHeightFn(def));
    this.collision = new CollisionGrid(this.terrain, t.size * 0.42);
    const sy = this.terrain.heightAt(def.spawn.x, def.spawn.z);
    this.spawn = new THREE.Vector3(def.spawn.x, sy, def.spawn.z);
    this.landmark = new THREE.Vector3(def.spawn.x, 0, def.spawn.z - 22);
    this.landmark.y = this.terrain.heightAt(this.landmark.x, this.landmark.z);

    this.buildTerrain();
    if (t.waterLevel !== null) this.buildWater(t.waterLevel);
    this.buildProps();
    this.buildGrass();
    this.buildShrine();
  }

  /** 0 at water level (or terrain minimum), 1 at the highest peak. */
  normHeight(h: number): number {
    const lo = this.def.terrain.waterLevel ?? this.terrain.minHeight;
    return (h - lo) / Math.max(1, this.terrain.maxHeight - lo);
  }

  update(dt: number, elapsed: number): void {
    this.windUniform.time.value += dt;
    for (const fn of this.animated) fn(elapsed);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }

  private track<T extends { dispose(): void }>(x: T): T {
    this.disposables.push(x);
    return x;
  }

  private buildTerrain(): void {
    const { size, segments, waterLevel } = this.def.terrain;
    const p = this.def.palette;
    const geo = this.track(new THREE.PlaneGeometry(size, size, segments, segments));
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const cLow = new THREE.Color(p.low), cMid = new THREE.Color(p.mid), cHigh = new THREE.Color(p.high);
    const cCliff = new THREE.Color(p.cliff), cShore = new THREE.Color(p.shore);
    const c = new THREE.Color();
    const detail = new Simplex2(this.def.seed + 5);
    const n = segments + 1;
    for (let i = 0; i < pos.count; i++) {
      const ix = i % n;
      const iz = Math.floor(i / n);
      const h = this.terrain.heights[iz * n + ix];
      pos.setY(i, h);
      const x = pos.getX(i), z = pos.getZ(i);
      const nh = this.normHeight(h);
      const v = detail.fbm(x * 0.05, z * 0.05, 3) * 0.08;
      c.copy(cLow).lerp(cMid, smoothstep(0.08, 0.35, nh + v)).lerp(cHigh, smoothstep(0.45, 0.8, nh + v));
      if (waterLevel !== null) c.lerp(cShore, 1 - smoothstep(0.4, 1.6, h - waterLevel));
      const slope = this.terrain.slopeAt(x, z);
      c.lerp(cCliff, smoothstep(0.55, 1.0, slope + v * 2));
      const shade = 1 + detail.noise(x * 0.18, z * 0.18) * 0.05;
      colors.set([c.r * shade, c.g * shade, c.b * shade], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = this.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    this.group.add(mesh);
  }

  private buildWater(level: number): void {
    const geo = this.track(new THREE.CircleGeometry(this.def.terrain.size * 0.7, 64));
    geo.rotateX(-Math.PI / 2);
    const mat = this.track(
      new THREE.MeshStandardMaterial({ color: this.def.palette.water, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.82 }),
    );
    const water = new THREE.Mesh(geo, mat);
    water.position.y = level;
    water.receiveShadow = true;
    water.name = 'water';
    this.group.add(water);
    this.animated.push((t) => {
      water.position.y = level + Math.sin(t * 0.6) * 0.04;
    });
  }

  private buildProps(): void {
    const r = rng(this.def.seed * 31 + 7);
    const p = this.def.palette;
    const half = this.def.terrain.size / 2;
    const dummy = new THREE.Object3D();
    const water = this.def.terrain.waterLevel;
    for (const rule of this.def.props) {
      const tpl = buildPropTemplate(rule.kind);
      const matrices: THREE.Matrix4[] = [];
      const tints: number[] = [];
      let attempts = 0;
      while (matrices.length < rule.count && attempts++ < rule.count * 40) {
        const x = (r() * 2 - 1) * half * 0.92;
        const z = (r() * 2 - 1) * half * 0.92;
        const dSpawn = Math.hypot(x - this.spawn.x, z - this.spawn.z);
        const dLandmark = Math.hypot(x - this.landmark.x, z - this.landmark.z);
        if (dSpawn < (rule.clearRadius ?? 0) || dLandmark < 10) continue;
        const h = this.terrain.heightAt(x, z);
        if (!tpl.floatHeight && water !== null && h < water + 0.3 && rule.kind !== 'rock') continue;
        const nh = this.normHeight(h);
        if (nh < rule.heightRange[0] || nh > rule.heightRange[1]) continue;
        if (this.terrain.slopeAt(x, z) > rule.maxSlope) continue;
        const s = rule.scale[0] + r() * (rule.scale[1] - rule.scale[0]);
        let y = h - (tpl.sink ?? 0) * s;
        if (tpl.floatHeight) y = h + tpl.floatHeight[0] + r() * (tpl.floatHeight[1] - tpl.floatHeight[0]);
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, r() * Math.PI * 2, 0);
        if (rule.kind === 'rock') dummy.rotation.set((r() - 0.5) * 0.5, r() * Math.PI * 2, (r() - 0.5) * 0.5);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        matrices.push(dummy.matrix.clone());
        tints.push(r());
        if (tpl.colliderRadius > 0 && (rule.kind !== 'rock' || s > 0.7)) {
          this.collision.add({ x, z, radius: tpl.colliderRadius * s, bottom: y - 1, top: y + tpl.colliderHeight * s });
        }
      }
      for (const part of tpl.parts) {
        const base =
          part.colorKey === 'foliage' ? p.foliage[0] : part.colorKey === 'cliff' ? p.cliff : (p[part.colorKey] as number);
        const mat = this.track(
          toonMaterial({
            color: 0xffffff,
            emissive: part.emissive ? base : 0x000000,
            emissiveIntensity: part.emissive ? 1.6 : 1,
            rim: part.colorKey === 'foliage' ? { color: 0xffffff, strength: 0.12, power: 2.5 } : undefined,
            soft: part.colorKey === 'foliage' || part.colorKey === 'grass',
          }),
        );
        if (part.wind) addWind(mat, this.windUniform, part.wind, 6);
        // Faceted look: un-indexed geometry gets per-face normals.
        const geometry = this.track(part.flat && part.geometry.index ? part.geometry.toNonIndexed() : part.geometry);
        if (part.flat) geometry.computeVertexNormals();
        const mesh = new THREE.InstancedMesh(geometry, mat, matrices.length);
        const col = new THREE.Color();
        matrices.forEach((m, i) => {
          mesh.setMatrixAt(i, m);
          if (part.colorKey === 'foliage') col.set(p.foliage[Math.floor(tints[i] * p.foliage.length) % p.foliage.length]);
          else col.set(base).multiplyScalar(0.88 + tints[i] * 0.24);
          mesh.setColorAt(i, col);
        });
        mesh.castShadow = !part.emissive;
        mesh.receiveShadow = true;
        mesh.name = `prop:${rule.kind}`;
        this.group.add(mesh);
      }
    }
  }

  private buildGrass(): void {
    const density = this.def.grassDensity;
    if (density <= 0) return;
    // A tuft is three crossed tapered blades; vertex colour darkens toward the root.
    const blades: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.PlaneGeometry(0.14, 0.6, 1, 3);
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < pos.count; v++) {
        const y = pos.getY(v) + 0.3;
        pos.setY(v, y);
        pos.setX(v, pos.getX(v) * (1 - y / 0.6) + 0.06 * (y / 0.6) ** 2);
      }
      g.rotateY((i / 3) * Math.PI);
      g.translate((i - 1) * 0.08, 0, (i % 2) * 0.06);
      blades.push(g);
    }
    const geo = this.track(mergeSimple(blades));
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    for (let v = 0; v < pos.count; v++) {
      const k = 0.55 + 0.45 * (pos.getY(v) / 0.6);
      col.set([k, k, k], v * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = this.track(toonMaterial({ vertexColors: true, side: THREE.DoubleSide, soft: true }));
    addWind(mat, this.windUniform, 0.22, 0.6);
    keepNormalOnBackFaces(mat);

    const count = Math.floor(34000 * density);
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const r = rng(this.def.seed + 999);
    const dummy = new THREE.Object3D();
    const base = new THREE.Color(this.def.palette.grass);
    const c = new THREE.Color();
    const water = this.def.terrain.waterLevel;
    let placed = 0;
    for (let a = 0; a < count * 6 && placed < count; a++) {
      // Denser near the spawn, sparser toward the rim.
      const ang = r() * Math.PI * 2;
      const rad = Math.pow(r(), 0.75) * this.def.terrain.size * 0.4;
      const x = this.spawn.x + Math.cos(ang) * rad;
      const z = this.spawn.z + Math.sin(ang) * rad;
      const h = this.terrain.heightAt(x, z);
      if (water !== null && h < water + 0.5) continue;
      if (this.terrain.slopeAt(x, z) > 0.55) continue;
      if (this.normHeight(h) > 0.55) continue;
      if (Math.hypot(x - this.landmark.x, z - this.landmark.z) < 7) continue;
      dummy.position.set(x, h - 0.04, z);
      dummy.rotation.set(0, r() * Math.PI, 0);
      const s = 0.5 + r() * 0.45;
      dummy.scale.set(s * 1.3, s * (0.7 + r() * 0.5), s * 1.3);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      c.copy(base).multiplyScalar(0.85 + r() * 0.3);
      mesh.setColorAt(placed, c);
      placed++;
    }
    mesh.count = placed;
    mesh.receiveShadow = true;
    mesh.name = 'grass';
    this.group.add(mesh);
  }

  /** Placeholder elemental shrine; will be replaced by the Tripo "shrine" asset. */
  private buildShrine(): void {
    const el = elements[this.def.element];
    const g = new THREE.Group();
    g.name = 'shrine';
    const stone = this.track(toonMaterial({ color: this.def.palette.rock }));
    const ring = new THREE.Mesh(this.track(new THREE.CylinderGeometry(5.5, 6, 0.6, 24)), stone);
    ring.position.y = 0.3;
    ring.receiveShadow = ring.castShadow = true;
    g.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const pillar = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.7, 3.2 + (i % 2) * 0.8, 0.7)), stone);
      pillar.position.set(Math.cos(a) * 4.6, 1.9 + (i % 2) * 0.4, Math.sin(a) * 4.6);
      pillar.rotation.y = -a;
      pillar.castShadow = true;
      g.add(pillar);
      this.collision.add({ x: this.landmark.x + pillar.position.x, z: this.landmark.z + pillar.position.z, radius: 0.55, bottom: this.landmark.y - 1, top: this.landmark.y + 4.5 });
    }
    const core = new THREE.Mesh(
      this.track(new THREE.OctahedronGeometry(0.55, 0)),
      this.track(toonMaterial({ color: el.color, emissive: el.glow, emissiveIntensity: 1.25 })),
    );
    core.position.y = 3.1;
    g.add(core);
    const light = new THREE.PointLight(el.glow, 18, 16, 1.6);
    light.position.y = 2.8;
    g.add(light);
    g.position.copy(this.landmark);
    this.group.add(g);
    this.animated.push((t) => {
      core.position.y = 3.1 + Math.sin(t * 1.3) * 0.2;
      core.rotation.y = t * 0.6;
    });
  }
}

function mergeSimple(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const total = list.reduce((n, g) => n + (g.index ? g.index.count : g.attributes.position.count), 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let o = 0;
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  // Point grass normals upward so tufts shade like the ground instead of flickering per blade.
  for (let i = 0; i < total; i++) nor.set([0, 1, 0], i * 3);
  return out;
}
