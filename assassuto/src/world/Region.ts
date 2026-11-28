import * as THREE from 'three';
import type { RegionDef } from '../config/regions';
import { elements } from '../config/elements';
import { discoveryConfig, waystoneId, waystoneNames } from '../config/discovery';
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
  /** Raider camp: centre and spawn points for enemies (order matches `campRoster`). */
  readonly camp: { center: THREE.Vector3; spawns: THREE.Vector3[] };
  /** Discoverable elemental waystones. */
  readonly waystones: Waystone[] = [];
  private shrineCore: THREE.Mesh | null = null;
  private shrineLight: THREE.PointLight | null = null;
  private shrineBeam: THREE.Mesh | null = null;
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

    this.camp = this.pickCamp();
    this.pickWaystones();
    this.buildTerrain();
    if (t.waterLevel !== null) this.buildWater(t.waterLevel);
    this.buildProps();
    this.buildCamp();
    this.buildGrass();
    this.buildShrine();
    for (const w of this.waystones) this.buildWaystone(w);
  }

  /** Shrine glows brighter and sends up a beam once the player has attuned to it. */
  setAttuned(v: boolean): void {
    if (this.shrineBeam) this.shrineBeam.visible = v;
    if (this.shrineCore) (this.shrineCore.material as THREE.MeshToonMaterial).emissiveIntensity = v ? 1.6 : 0.55;
    if (this.shrineLight) this.shrineLight.intensity = v ? 22 : 8;
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
        if (!tpl.floatHeight && Math.hypot(x - this.camp.center.x, z - this.camp.center.z) < 11) continue;
        if (!tpl.floatHeight && this.waystones.some((w) => Math.hypot(x - w.pos.x, z - w.pos.z) < 8)) continue;
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
      if (Math.hypot(x - this.camp.center.x, z - this.camp.center.z) < 5) continue;
      if (this.waystones.some((w) => Math.hypot(x - w.pos.x, z - w.pos.z) < 1.6)) continue;
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

  /**
   * Finds a fairly flat, dry spot 34-48 m from the spawn, away from the shrine, for the raider camp.
   * Deterministic per region seed.
   */
  private pickCamp(): { center: THREE.Vector3; spawns: THREE.Vector3[] } {
    const r = rng(this.def.seed + 4242);
    const water = this.def.terrain.waterLevel;
    const shrineDir = Math.atan2(this.landmark.x - this.spawn.x, this.landmark.z - this.spawn.z);
    let best = { x: this.spawn.x + 40, z: this.spawn.z, score: Infinity };
    for (let i = 0; i < 160; i++) {
      const a = shrineDir + Math.PI * 0.5 + (r() - 0.5) * Math.PI * 1.2;
      const d = 34 + r() * 14;
      const x = this.spawn.x + Math.sin(a) * d;
      const z = this.spawn.z + Math.cos(a) * d;
      const h = this.terrain.heightAt(x, z);
      if (water !== null && h < water + 0.8) continue;
      let slope = 0;
      for (let k = 0; k < 8; k++) slope = Math.max(slope, this.terrain.slopeAt(x + Math.cos(k) * 6, z + Math.sin(k) * 6));
      const score = slope + this.terrain.slopeAt(x, z) * 2;
      if (score < best.score) best = { x, z, score };
    }
    const center = new THREE.Vector3(best.x, this.terrain.heightAt(best.x, best.z), best.z);
    // Two raiders around the fire, an archer at the edge facing the spawn side, the brute by the fire.
    const toSpawn = Math.atan2(this.spawn.z - center.z, this.spawn.x - center.x);
    const slots: [number, number][] = [
      [0.4, 3.2],
      [0.4 + (Math.PI * 2) / 3, 3.2],
      [toSpawn + Math.PI + 0.5, 9.5],
      [0.4 + (Math.PI * 4) / 3, 2.2],
    ];
    const spawns = slots.map(([a, d]) => {
      const x = center.x + Math.cos(a) * d;
      const z = center.z + Math.sin(a) * d;
      return new THREE.Vector3(x, this.terrain.heightAt(x, z), z);
    });
    return { center, spawns };
  }

  /** Tents, crates and a campfire with flickering light. */
  private buildCamp(): void {
    const c = this.camp.center;
    const g = new THREE.Group();
    g.name = 'camp';
    const cloth = this.track(toonMaterial({ color: 0x9c6b48, side: THREE.DoubleSide }));
    const wood = this.track(toonMaterial({ color: 0x5e4433 }));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 1.45;
      const x = Math.cos(a) * 6.5;
      const z = Math.sin(a) * 6.5;
      const tent = new THREE.Mesh(this.track(new THREE.ConeGeometry(1.7, 2.3, 4, 1, true)), cloth);
      tent.position.set(x, this.terrain.heightAt(c.x + x, c.z + z) - c.y + 1.1, z);
      tent.rotation.y = -a + Math.PI / 4;
      tent.castShadow = tent.receiveShadow = true;
      g.add(tent);
      this.collision.add({ x: c.x + x, z: c.z + z, radius: 1.4, bottom: c.y - 2, top: c.y + 3 });
    }
    for (let i = 0; i < 3; i++) {
      const crate = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.8, 0.7, 0.8)), wood);
      const a = i * 2.1 + 0.3;
      crate.position.set(Math.cos(a) * 4.6, 0.35, Math.sin(a) * 4.6);
      crate.position.y = this.terrain.heightAt(c.x + crate.position.x, c.z + crate.position.z) - c.y + 0.35;
      crate.rotation.y = a;
      crate.castShadow = true;
      g.add(crate);
      this.collision.add({ x: c.x + crate.position.x, z: c.z + crate.position.z, radius: 0.55, bottom: c.y - 2, top: c.y + 0.8 });
    }
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 6)), wood);
      log.rotation.set(Math.PI / 2 - 0.35, (i / 4) * Math.PI * 2, 0);
      log.position.y = 0.15;
      g.add(log);
    }
    const flame = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.3, 0.9, 7)), this.track(toonMaterial({ color: 0xffa040, emissive: 0xff7a20, emissiveIntensity: 2.4 })));
    flame.position.y = 0.5;
    const light = new THREE.PointLight(0xff9a40, 14, 14, 1.6);
    light.position.y = 1.1;
    g.add(flame, light);
    g.position.copy(c);
    this.group.add(g);
    this.animated.push((t) => {
      const f = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
      flame.scale.set(f, 1 + Math.sin(t * 9.1) * 0.15, f);
      light.intensity = 12 + Math.sin(t * 11) * 2.5;
    });
  }

  /** Deterministic waystone spots: flat, dry, spread around the spawn, away from the camp and the shrine. */
  private pickWaystones(): void {
    const r = rng(this.def.seed + 777);
    const water = this.def.terrain.waterLevel;
    const [dMin, dMax] = discoveryConfig.waystoneDistance;
    const names = waystoneNames[this.def.element];
    const n = discoveryConfig.waystonesPerRegion;
    for (let i = 0; i < n; i++) {
      let best: { x: number; z: number; score: number } | null = null;
      for (let k = 0; k < 120; k++) {
        // Each waystone gets its own sector so they spread out.
        const a = ((i + r()) / n) * Math.PI * 2;
        const d = dMin + r() * (dMax - dMin);
        const x = this.spawn.x + Math.cos(a) * d;
        const z = this.spawn.z + Math.sin(a) * d;
        if (Math.hypot(x, z) > this.collision.boundsRadius - 8) continue;
        const h = this.terrain.heightAt(x, z);
        if (water !== null && h < water + 0.8) continue;
        if (Math.hypot(x - this.camp.center.x, z - this.camp.center.z) < 16) continue;
        if (Math.hypot(x - this.landmark.x, z - this.landmark.z) < 14) continue;
        const score = this.terrain.slopeAt(x, z) + Math.abs(this.normHeight(h) - 0.25) * 0.5;
        if (!best || score < best.score) best = { x, z, score };
      }
      if (!best) continue;
      const pos = new THREE.Vector3(best.x, this.terrain.heightAt(best.x, best.z), best.z);
      this.waystones.push({ id: waystoneId(this.def.id, i), name: names.names[i % names.names.length], kind: names.kind, pos, lit: false, setLit: () => {} });
    }
  }

  /** Procedural element-themed waystone (stand-in for the Tripo props in the manifest). Dim until lit. */
  private buildWaystone(w: Waystone): void {
    const el = elements[this.def.element];
    const g = new THREE.Group();
    g.name = `waystone:${w.id}`;
    g.position.copy(w.pos);
    const stone = this.track(toonMaterial({ color: this.def.palette.rock }));
    const dark = this.track(toonMaterial({ color: 0x3a3430 }));
    const wood = this.track(toonMaterial({ color: this.def.palette.trunk }));
    const glowMat = this.track(toonMaterial({ color: el.color, emissive: el.glow, emissiveIntensity: 0.15 }));
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, cast = true) => {
      const m = new THREE.Mesh(this.track(geo), mat);
      m.position.set(x, y, z);
      m.castShadow = cast;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    const swing: THREE.Object3D[] = [];
    let flame: THREE.Mesh | null = null;
    let colliderH = 1.4;
    switch (this.def.element) {
      case 'fire': {
        add(new THREE.CylinderGeometry(0.28, 0.4, 0.9, 7), dark, 0, 0.45, 0);
        add(new THREE.CylinderGeometry(0.62, 0.3, 0.38, 9), dark, 0, 1.05, 0);
        add(new THREE.SphereGeometry(0.46, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), glowMat, 0, 1.08, 0, false);
        flame = add(new THREE.ConeGeometry(0.32, 0.95, 7), this.track(toonMaterial({ color: 0xffb050, emissive: el.glow, emissiveIntensity: 2.4 })), 0, 1.6, 0, false);
        colliderH = 1.3;
        break;
      }
      case 'water': {
        add(new THREE.BoxGeometry(0.5, 0.9, 0.5), stone, 0, 0.45, 0);
        add(new THREE.BoxGeometry(0.62, 0.55, 0.62), glowMat, 0, 1.2, 0, false);
        const roof = add(new THREE.ConeGeometry(0.62, 0.42, 4), stone, 0, 1.68, 0);
        roof.rotation.y = Math.PI / 4;
        add(new THREE.ConeGeometry(0.5, 0.2, 4), this.track(toonMaterial({ color: 0xf2f6fa })), 0, 1.86, 0).rotation.y = Math.PI / 4;
        colliderH = 1.9;
        break;
      }
      case 'earth': {
        const mono = add(new THREE.BoxGeometry(0.9, 3.2, 0.55, 1, 4, 1), stone, 0, 1.6, 0);
        mono.rotation.y = 0.3;
        for (let i = 0; i < 3; i++) {
          const rune = add(new THREE.TorusGeometry(0.16 - i * 0.03, 0.03, 5, 16), glowMat, 0, 0.9 + i * 0.75, 0, false);
          rune.position.set(Math.sin(0.3) * 0.29, 0.9 + i * 0.75, Math.cos(0.3) * 0.29);
          rune.rotation.y = 0.3;
        }
        for (let i = 0; i < 4; i++) add(new THREE.TorusGeometry(0.62, 0.06, 5, 10, Math.PI * 0.7), wood, 0, 0.1 + i * 0.12, 0).rotation.set(Math.PI / 2, 0, i * 1.6);
        colliderH = 3.2;
        break;
      }
      case 'air': {
        add(new THREE.CylinderGeometry(0.07, 0.09, 3.0, 6), wood, 0, 1.5, 0);
        add(new THREE.BoxGeometry(1.3, 0.08, 0.08), wood, 0, 2.85, 0);
        for (let i = 0; i < 5; i++) {
          const x = -0.55 + i * 0.275;
          const pivot = new THREE.Group();
          pivot.position.set(x, 2.8, 0);
          const chime = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.035, 0.035, 0.4 + (i % 3) * 0.12, 6)), glowMat);
          chime.position.y = -0.3 - (i % 3) * 0.06;
          pivot.add(chime);
          const ribbon = new THREE.Mesh(this.track(new THREE.PlaneGeometry(0.06, 0.9)), this.track(toonMaterial({ color: el.color, side: THREE.DoubleSide })));
          ribbon.position.set(0.05, -0.75, 0);
          pivot.add(ribbon);
          g.add(pivot);
          swing.push(pivot);
        }
        colliderH = 3;
        break;
      }
    }
    const halo = new THREE.Mesh(this.track(new THREE.RingGeometry(0.9, 1.15, 40)), this.track(new THREE.MeshBasicMaterial({ color: el.glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.06;
    g.add(halo);
    if (flame) flame.visible = false;
    this.collision.add({ x: w.pos.x, z: w.pos.z, radius: 0.55, bottom: w.pos.y - 1, top: w.pos.y + colliderH });
    this.group.add(g);
    w.setLit = (lit: boolean) => {
      w.lit = lit;
      glowMat.emissiveIntensity = lit ? 1.8 : 0.15;
      if (flame) flame.visible = lit;
      (halo.material as THREE.MeshBasicMaterial).opacity = lit ? 0.55 : 0;
    };
    const seed = w.pos.x * 0.37;
    this.animated.push((t) => {
      for (const [i, p] of swing.entries()) p.rotation.z = Math.sin(t * 2.2 + i * 0.9 + seed) * 0.18;
      if (flame?.visible) flame.scale.set(1 + Math.sin(t * 12) * 0.08, 1 + Math.sin(t * 9) * 0.15, 1 + Math.sin(t * 12) * 0.08);
      if (w.lit) halo.scale.setScalar(1 + Math.sin(t * 2 + seed) * 0.06);
    });
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
    // Beam of light shown once attuned: a landmark visible from across the region.
    const beam = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.35, 0.6, 60, 16, 1, true)),
      this.track(new THREE.MeshBasicMaterial({ color: el.glow, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
    );
    beam.position.y = 33;
    beam.visible = false;
    g.add(beam);
    this.shrineCore = core;
    this.shrineLight = light;
    this.shrineBeam = beam;
    g.position.copy(this.landmark);
    this.group.add(g);
    this.animated.push((t) => {
      core.position.y = 3.1 + Math.sin(t * 1.3) * 0.2;
      core.rotation.y = t * 0.6;
    });
  }
}

export interface Waystone {
  id: string;
  name: string;
  kind: string;
  pos: THREE.Vector3;
  lit: boolean;
  setLit(lit: boolean): void;
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
