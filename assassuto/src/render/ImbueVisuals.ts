import * as THREE from 'three';

const TRAIL_LIFE = 0.2;
const TRAIL_MAX = 28;

/**
 * Ribbon behind a swinging weapon: a strip between the grip end and the tip of the blade, fading with
 * age (additive vertex colours, so black is invisible). Cosmetic only.
 */
export class SwingTrail {
  readonly mesh: THREE.Mesh;
  private points: { base: THREE.Vector3; tip: THREE.Vector3; age: number }[] = [];
  private pos = new Float32Array(TRAIL_MAX * 2 * 3);
  private col = new Float32Array(TRAIL_MAX * 2 * 3);
  private geo = new THREE.BufferGeometry();
  private color = new THREE.Color();

  constructor() {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let i = 0; i < TRAIL_MAX - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  push(base: THREE.Vector3, tip: THREE.Vector3): void {
    this.points.unshift({ base: base.clone(), tip: tip.clone(), age: 0 });
    if (this.points.length > TRAIL_MAX) this.points.length = TRAIL_MAX;
  }

  update(dt: number, color: number, strength: number): void {
    for (const p of this.points) p.age += dt;
    while (this.points.length && this.points[this.points.length - 1].age > TRAIL_LIFE) this.points.pop();
    this.color.setHex(color);
    const n = this.points.length;
    for (let i = 0; i < n; i++) {
      const p = this.points[i];
      const k = Math.max(0, 1 - p.age / TRAIL_LIFE) * strength;
      const o = i * 6;
      this.pos.set([p.base.x, p.base.y, p.base.z, p.tip.x, p.tip.y, p.tip.z], o);
      this.col.set([this.color.r * k * 0.25, this.color.g * k * 0.25, this.color.b * k * 0.25, this.color.r * k, this.color.g * k, this.color.b * k], o);
    }
    this.geo.setDrawRange(0, Math.max(0, n - 1) * 6);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.mesh.visible = n > 1;
  }

  clear(): void {
    this.points.length = 0;
    this.mesh.visible = false;
  }
}

/** Blade length (grip to tip) by weapon, for the trail and the aura. */
const bladeSpan: Record<string, [number, number]> = { sword: [0.2, 0.92], spear: [1.2, 1.85] };

/**
 * The imbued weapon's look: the blade glows in the element's colour with a pulsing aura sleeve around
 * it, a swing trail follows every attack, and bare fists carry a glowing orb. With two fused elements
 * the colours alternate. A faint white trail also follows unimbued swings.
 */
export class ImbueVisuals {
  readonly group = new THREE.Group();
  private trail = new SwingTrail();
  private aura: THREE.Mesh;
  private orb: THREE.Mesh;
  private glowed = new Set<THREE.MeshStandardMaterial>();
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private c1 = new THREE.Color();
  private c2 = new THREE.Color();

  constructor() {
    this.group.name = 'imbueVisuals';
    this.group.add(this.trail.mesh);
    const auraMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    this.aura = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 1, 10, 1, true), auraMat);
    this.aura.name = 'imbueAura';
    this.orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), auraMat.clone());
    this.orb.name = 'imbueAura';
  }

  /**
   * @param socket the hand the weapon hangs from
   * @param weaponId 'fists' | 'sword' | 'spear'
   * @param colors element glow colours (empty = no imbue)
   * @param swinging an attack is in progress
   */
  update(dt: number, time: number, socket: THREE.Object3D, weaponId: string, colors: number[], swinging: boolean): void {
    const weapon = socket.children.find((c) => c.name.startsWith('weapon:')) ?? null;
    const imbued = colors.length > 0;
    // Colour: one element, or two alternating.
    this.c1.setHex(colors[0] ?? 0xffffff);
    if (colors.length > 1) this.c1.lerp(this.c2.setHex(colors[1]), 0.5 + 0.5 * Math.sin(time * 5));
    const pulse = 0.75 + 0.25 * Math.sin(time * 9);

    // Blade glow and aura sleeve, parented to the weapon so they swing with it.
    const span = bladeSpan[weaponId];
    if (imbued && weapon && span) {
      if (this.aura.parent !== weapon) weapon.add(this.aura);
      this.aura.scale.set(1, span[1] - span[0] + 0.1, 1);
      this.aura.position.set(0, (span[0] + span[1]) / 2, 0);
      (this.aura.material as THREE.MeshBasicMaterial).color.copy(this.c1);
      (this.aura.material as THREE.MeshBasicMaterial).opacity = 0.35 * pulse;
      weapon.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!m || o.name === 'imbueAura' || !('emissive' in m)) return;
        if (!this.glowed.has(m)) {
          m.userData.baseEmissive ??= m.emissive.getHex();
          m.userData.baseIntensity ??= m.emissiveIntensity;
          this.glowed.add(m);
        }
        m.emissive.copy(this.c1);
        m.emissiveIntensity = 0.9 * pulse;
      });
    } else {
      this.aura.removeFromParent();
      this.restore();
    }
    // Fists: a glowing orb in the hand.
    if (imbued && weaponId === 'fists') {
      if (this.orb.parent !== socket) socket.add(this.orb);
      this.orb.scale.setScalar(0.8 + 0.3 * pulse);
      (this.orb.material as THREE.MeshBasicMaterial).color.copy(this.c1);
      (this.orb.material as THREE.MeshBasicMaterial).opacity = 0.55 * pulse;
    } else this.orb.removeFromParent();

    // Swing trail.
    if (swinging) {
      if (weapon && span) {
        weapon.updateWorldMatrix(true, false);
        weapon.localToWorld(this.tmpA.set(0, span[0], 0));
        weapon.localToWorld(this.tmpB.set(0, span[1], 0));
      } else {
        socket.updateWorldMatrix(true, false);
        socket.getWorldPosition(this.tmpA);
        socket.localToWorld(this.tmpB.set(0, 0.12, 0));
      }
      this.trail.push(this.tmpA, this.tmpB);
    }
    this.trail.update(dt, imbued ? this.c1.getHex() : 0xbfd4ff, imbued ? 1 : 0.35);
  }

  private restore(): void {
    for (const m of this.glowed) {
      m.emissive.setHex(m.userData.baseEmissive ?? 0);
      m.emissiveIntensity = m.userData.baseIntensity ?? 1;
    }
    this.glowed.clear();
  }

  clear(): void {
    this.trail.clear();
    this.aura.removeFromParent();
    this.orb.removeFromParent();
    this.restore();
  }
}
