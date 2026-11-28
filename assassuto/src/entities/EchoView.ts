import * as THREE from 'three';
import { PlaceholderHumanoid } from '../animation/PlaceholderHumanoid';
import { spiritBird, spiritWolf, type SpiritShape } from '../animation/SpiritCreatures';
import type { EchoConfig } from '../save/SaveSchema';
import { spiritMaterial } from '../render/SpiritMaterial';

/**
 * Visual of the Echo spirit (form + colour) with drifting light motes and a manifest/fade value.
 * Behaviour (following, abilities) arrives in phase 5; this is the shared look used by the creator and intro.
 */
export class EchoView {
  readonly object = new THREE.Group();
  private shape: SpiritShape | null = null;
  private humanoid: PlaceholderHumanoid | null = null;
  private material: THREE.MeshToonMaterial;
  private motes: THREE.Points;
  private time = 0;
  /** 0 = invisible, 1 = fully manifested. */
  presence = 1;

  constructor(cfg: EchoConfig) {
    this.material = spiritMaterial(cfg.hue);
    if (cfg.form === 'human') {
      this.humanoid = new PlaceholderHumanoid({
        element: 'air',
        appearance: { presentation: 'feminine', height: 1.02, build: 0.3, age: 30, skinTone: 0xffffff, hairColor: 0xffffff, hairStyle: 'long', eyeColor: 0xffffff },
      });
      this.humanoid.object.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.material = this.material;
          mesh.castShadow = false;
        }
      });
      // The Echo carries no weapon.
      const sword = this.humanoid.object.getObjectByName('sword');
      if (sword) sword.visible = false;
      this.object.add(this.humanoid.object);
    } else {
      this.shape = cfg.form === 'wolf' ? spiritWolf(this.material) : spiritBird(this.material);
      this.object.add(this.shape.object);
    }

    const count = 70;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) pos.set([(Math.random() - 0.5) * 1.6, Math.random() * 2.2, (Math.random() - 0.5) * 1.6], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: cfg.hue, size: 0.05, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.object.add(this.motes);
  }

  update(dt: number): void {
    this.time += dt;
    const p = Math.max(0, Math.min(1, this.presence));
    this.material.opacity = 0.6 * p;
    (this.motes.material as THREE.PointsMaterial).opacity = 0.8 * p;
    this.object.visible = p > 0.001;
    this.shape?.update(this.time);
    this.humanoid?.update(dt, { grounded: true, speed: 0, vy: 0, sprinting: false, landing: 0 });
    if (this.humanoid) this.humanoid.object.position.y = 0.08 + Math.sin(this.time * 1.2) * 0.06;
    const pos = this.motes.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dt * (0.25 + (i % 5) * 0.06);
      if (y > 2.4) y = 0;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }

  dispose(): void {
    this.humanoid?.dispose();
    this.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.material.dispose();
    this.object.removeFromParent();
  }
}
