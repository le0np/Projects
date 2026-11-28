import * as THREE from 'three';

interface Transient {
  obj: THREE.Object3D;
  t: number;
  dur: number;
  update(k: number, dt: number): void;
}

const additive = (color: number, opacity = 0.8) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

/**
 * Visuals for elemental abilities and enemy area attacks: fire dome, rolling wave, stone shell,
 * gale streaks, slam warning circles and arrows. Purely cosmetic; gameplay never reads it.
 */
export class AbilityFx {
  readonly group = new THREE.Group();
  private items: Transient[] = [];
  private aegis: THREE.Group;
  private arrowGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.75, 4);
  private arrowHeadGeo = new THREE.ConeGeometry(0.03, 0.12, 4);
  private arrowMat = new THREE.MeshBasicMaterial({ color: 0x4a3626 });
  private arrowGlow = additive(0xffe0a0, 0.9);
  private arrows = new Map<number, THREE.Group>();
  private warnings = new Map<string, THREE.Mesh>();

  constructor() {
    this.group.name = 'abilityFx';
    // Stone Aegis: a ring of orbiting rock shards plus a faint shell.
    this.aegis = new THREE.Group();
    const rock = new THREE.MeshStandardMaterial({ color: 0x9a8a68, roughness: 0.9, flatShading: true, emissive: 0x3a2a10 });
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14 + (i % 3) * 0.04, 0), rock);
      const a = (i / 7) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.85, 0.5 + (i % 3) * 0.45, Math.sin(a) * 0.85);
      this.aegis.add(s);
    }
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 14), additive(0xd8c27a, 0.12));
    shell.scale.set(0.9, 1.15, 0.9);
    shell.position.y = 0.95;
    this.aegis.add(shell);
    this.aegis.visible = false;
    this.group.add(this.aegis);
  }

  private add(obj: THREE.Object3D, dur: number, update: (k: number, dt: number) => void): void {
    this.group.add(obj);
    this.items.push({ obj, t: 0, dur, update });
  }

  /** Ember Burst: a flash dome of flame and a scorched ring. */
  fireBurst(at: THREE.Vector3, radius: number, color: number, glow: number): void {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), additive(color, 0.4));
    dome.position.copy(at);
    this.add(dome, 0.35, (k) => {
      dome.scale.set(0.3 + radius * Math.sqrt(k), (0.3 + radius * Math.sqrt(k)) * 0.6, 0.3 + radius * Math.sqrt(k));
      (dome.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - k) * (1 - k);
    });
    // Flame tongues licking outward.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const tongue = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.4, 6), additive(i % 2 ? glow : color, 0.85));
      tongue.position.set(at.x + Math.cos(a) * 0.6, at.y + 0.6, at.z + Math.sin(a) * 0.6);
      this.add(tongue, 0.5, (k) => {
        const r = 0.6 + radius * 0.85 * Math.sqrt(k);
        tongue.position.set(at.x + Math.cos(a) * r, at.y + 0.5 + Math.sin(k * Math.PI) * 0.5, at.z + Math.sin(a) * r);
        tongue.scale.set(1 - k * 0.6, 1 + Math.sin(k * Math.PI) * 0.6, 1 - k * 0.6);
        (tongue.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
      });
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), additive(color, 0.9));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(at).add(new THREE.Vector3(0, 0.08, 0));
    this.add(ring, 0.8, (k) => {
      ring.scale.setScalar(radius * (0.4 + k * 0.7));
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    });
  }

  /** Tidal Surge: a crescent of water rolling forward over `range` metres. */
  wave(at: THREE.Vector3, yaw: number, range: number, arcDeg: number, color: number): void {
    const arc = (arcDeg * Math.PI) / 180;
    const geo = new THREE.CylinderGeometry(1, 1, 1.3, 32, 1, true, -arc, arc * 2);
    geo.translate(0, 0.65, 0);
    const mesh = new THREE.Mesh(geo, additive(color, 0.75));
    mesh.position.copy(at);
    // Cylinder theta 0 points along +Z; rotate so the crescent faces the cast direction.
    mesh.rotation.y = yaw;
    this.add(mesh, 0.55, (k) => {
      const r = 0.6 + range * k;
      mesh.scale.set(r, 1 - k * 0.5, r);
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - k * k);
    });
  }

  /** Gale Rush: fading streaks along the dash line. */
  gale(from: THREE.Vector3, yaw: number, distance: number, color: number): void {
    for (let i = 0; i < 5; i++) {
      const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.06, distance), additive(color, 0.7));
      streak.rotation.set(-Math.PI / 2, yaw, 0, 'YXZ');
      const side = (i - 2) * 0.22;
      streak.position.set(from.x + Math.sin(yaw) * distance * 0.5 + Math.cos(yaw) * side, from.y + 0.5 + (i % 3) * 0.35, from.z + Math.cos(yaw) * distance * 0.5 - Math.sin(yaw) * side);
      this.add(streak, 0.45 + i * 0.04, (k) => ((streak.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k)));
    }
  }

  /** Stone spike(s) bursting from the ground (earth spear impact) and sinking back. */
  stoneSpikes(at: THREE.Vector3, radius: number): void {
    const rock = new THREE.MeshStandardMaterial({ color: 0x8f7d5c, roughness: 0.95, flatShading: true, emissive: 0x2a1c0a });
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + i * 0.7;
      const r = i === 0 ? 0 : radius * (0.35 + 0.4 * ((i * 37) % 10) / 10);
      const h = i === 0 ? 2.2 : 0.9 + ((i * 53) % 10) / 12;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(i === 0 ? 0.45 : 0.25, h, 5), rock.clone());
      const x = at.x + Math.cos(a) * r;
      const z = at.z + Math.sin(a) * r;
      spike.rotation.set((Math.cos(a) * r) / 6, 0, (-Math.sin(a) * r) / 6);
      this.add(spike, 1.1, (k) => {
        // Shoot up fast, hold, then sink.
        const up = k < 0.15 ? k / 0.15 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        spike.position.set(x, at.y - h / 2 + h * up * 0.95, z);
      });
    }
  }

  /** Rock Pillar: a stone column shoves up under the player, then crumbles. */
  pillar(at: THREE.Vector3, height: number): void {
    const rock = new THREE.MeshStandardMaterial({ color: 0x9a8862, roughness: 0.95, flatShading: true, emissive: 0x2a1c0a });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, height, 7), rock);
    this.add(col, 1.4, (k) => {
      const up = k < 0.12 ? k / 0.12 : k > 0.6 ? Math.max(0, 1 - (k - 0.6) / 0.4) : 1;
      col.position.set(at.x, at.y - height / 2 + height * up * 0.9, at.z);
    });
  }

  /** Ice shattering: crystal shards flying out. */
  iceShards(at: THREE.Vector3, color: number): void {
    for (let i = 0; i < 12; i++) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.12 + (i % 3) * 0.05, 0), additive(color, 0.9));
      const a = (i / 12) * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * (3 + (i % 4)), 2 + (i % 5), Math.sin(a) * (3 + (i % 4)));
      const p = at.clone();
      this.add(shard, 0.6, (k, dt) => {
        v.y -= 18 * dt;
        p.addScaledVector(v, dt);
        shard.position.copy(p);
        shard.rotation.x += dt * 9;
        (shard.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      });
    }
  }

  /** Ice trail left by Ice Slide. */
  iceTrail(at: THREE.Vector3, color: number): void {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.55, 10), additive(color, 0.45));
    patch.rotation.x = -Math.PI / 2;
    patch.position.copy(at).add(new THREE.Vector3(0, 0.04, 0));
    this.add(patch, 1.2, (k) => ((patch.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - k)));
  }

  /** Earth shockwave when the aegis rises. */
  shockwave(at: THREE.Vector3, radius: number, color: number): void {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 40), additive(color, 0.9));
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(at).add(new THREE.Vector3(0, 0.15, 0));
    this.add(ring, 0.45, (k) => {
      ring.scale.setScalar(0.3 + radius * k);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    });
  }

  /** Stone Aegis shell follows the player while active. */
  setAegis(active: boolean, at: THREE.Vector3, time: number, fade: number): void {
    this.aegis.visible = active;
    if (!active) return;
    this.aegis.position.copy(at);
    this.aegis.rotation.y = time * 1.6;
    const s = Math.min(1, fade * 3);
    this.aegis.scale.setScalar(0.6 + 0.4 * s);
  }

  /** Red ground circle where an unblockable slam will land. */
  warning(id: string, at: { x: number; y: number; z: number } | null, radius: number, k: number): void {
    let m = this.warnings.get(id);
    if (!at) {
      if (m) m.visible = false;
      return;
    }
    if (!m) {
      m = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 40), additive(0xff3a2a, 0.7));
      m.rotation.x = -Math.PI / 2;
      this.warnings.set(id, m);
      this.group.add(m);
    }
    m.visible = true;
    m.position.set(at.x, at.y + 0.12, at.z);
    m.scale.setScalar(radius * (0.35 + 0.65 * k));
    (m.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.5 * k;
  }

  /** Syncs arrow meshes with live projectiles. */
  syncArrows(list: { id: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; reflected: boolean; dead: boolean }[]): void {
    const live = new Set<number>();
    for (const p of list) {
      if (p.dead) continue;
      live.add(p.id);
      let g = this.arrows.get(p.id);
      if (!g) {
        g = new THREE.Group();
        const shaft = new THREE.Mesh(this.arrowGeo, this.arrowMat);
        const head = new THREE.Mesh(this.arrowHeadGeo, this.arrowGlow);
        head.position.y = 0.42;
        g.add(shaft, head);
        this.arrows.set(p.id, g);
        this.group.add(g);
      }
      g.position.set(p.x, p.y, p.z);
      // Cylinder points along +Y; align it with the velocity.
      const v = new THREE.Vector3(p.vx, p.vy, p.vz).normalize();
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    }
    for (const [id, g] of this.arrows)
      if (!live.has(id)) {
        g.removeFromParent();
        this.arrows.delete(id);
      }
  }

  update(dt: number): void {
    this.items = this.items.filter((it) => {
      it.t += dt;
      const k = Math.min(1, it.t / it.dur);
      it.update(k, dt);
      if (k >= 1) {
        it.obj.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
          }
        });
        it.obj.removeFromParent();
        return false;
      }
      return true;
    });
  }

  clear(): void {
    for (const it of this.items) it.obj.removeFromParent();
    this.items = [];
    for (const g of this.arrows.values()) g.removeFromParent();
    this.arrows.clear();
    for (const m of this.warnings.values()) m.visible = false;
    this.aegis.visible = false;
  }
}
