import * as THREE from 'three';

/** Pooled hit sparks and expanding rings (impact feedback, GDD 8.2). */
export class Fx {
  readonly group = new THREE.Group();
  private sparks: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private colors: Float32Array;
  private next = 0;
  private rings: { mesh: THREE.Mesh; t: number; dur: number; size: number }[] = [];
  private readonly N = 600;

  constructor() {
    this.pos = new Float32Array(this.N * 3);
    this.vel = new Float32Array(this.N * 3);
    this.life = new Float32Array(this.N);
    this.colors = new Float32Array(this.N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.sparks = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.sparks.frustumCulled = false;
    this.group.add(this.sparks);
  }

  burst(at: THREE.Vector3, color: number, count = 18, speed = 6, dir?: THREE.Vector3): void {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const k = this.next;
      this.next = (this.next + 1) % this.N;
      this.pos.set([at.x, at.y, at.z], k * 3);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize();
      if (dir) v.addScaledVector(dir, 0.9).normalize();
      v.multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      this.vel.set([v.x, v.y, v.z], k * 3);
      this.life[k] = 0.25 + Math.random() * 0.3;
      this.colors.set([c.r, c.g, c.b], k * 3);
    }
  }

  ring(at: THREE.Vector3, color: number, size = 3, dur = 0.45): void {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(at).add(new THREE.Vector3(0, 0.1, 0));
    this.group.add(mesh);
    this.rings.push({ mesh, t: 0, dur, size });
  }

  update(dt: number): void {
    for (let k = 0; k < this.N; k++) {
      if (this.life[k] <= 0) {
        this.pos[k * 3 + 1] = -9999;
        continue;
      }
      this.life[k] -= dt;
      this.vel[k * 3 + 1] -= 14 * dt;
      for (let a = 0; a < 3; a++) this.pos[k * 3 + a] += this.vel[k * 3 + a] * dt;
      const fade = Math.max(0, Math.min(1, this.life[k] * 4));
      this.colors[k * 3] *= 0.98 + 0.02 * fade;
    }
    this.sparks.geometry.attributes.position.needsUpdate = true;
    this.sparks.geometry.attributes.color.needsUpdate = true;
    this.rings = this.rings.filter((r) => {
      r.t += dt;
      const k = r.t / r.dur;
      r.mesh.scale.setScalar(0.3 + k * r.size);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      if (k >= 1) {
        r.mesh.geometry.dispose();
        (r.mesh.material as THREE.Material).dispose();
        r.mesh.removeFromParent();
        return false;
      }
      return true;
    });
  }
}
