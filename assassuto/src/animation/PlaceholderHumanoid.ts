import * as THREE from 'three';
import { elements } from '../config/elements';
import { damp, lerp, smoothstep } from '../core/math';
import type { CharacterLook } from '../entities/appearance';
import { greyAmount } from '../config/characters';
import { toonMaterial } from '../render/ToonMaterials';
import { locomotionRef, type CharacterView, type LocomotionState } from './CharacterView';

type Joint =
  | 'hips' | 'spine' | 'chest' | 'neck' | 'head'
  | 'thighL' | 'kneeL' | 'footL' | 'thighR' | 'kneeR' | 'footR'
  | 'shoulderL' | 'elbowL' | 'shoulderR' | 'elbowR' | 'scarf';

type Pose = Partial<Record<Joint, [number, number, number]>>;

/**
 * Stylized procedural humanoid used until the Tripo character model is generated.
 * Built from primitives on a joint hierarchy and animated procedurally (idle, walk, run, sprint, jump, fall, land).
 */
export class PlaceholderHumanoid implements CharacterView {
  readonly object = new THREE.Group();
  readonly source = 'placeholder' as const;
  private j = {} as Record<Joint, THREE.Object3D>;
  private hipsBaseY: number;
  private phase = 0;
  private runW = 0;
  private moveW = 0;
  private airW = 0;
  private time = 0;
  private disposables: { dispose(): void }[] = [];

  constructor(look: CharacterLook) {
    const a = look.appearance;
    const el = elements[look.element];
    const fem = a.presentation === 'feminine';
    const build = a.build;
    const mats = {
      skin: this.track(toonMaterial({ color: a.skinTone, rim: { color: 0xffe6d6, strength: 0.25, power: 3 } })),
      cloth: this.track(toonMaterial({ color: 0x3b4566, rim: { color: 0x9fb0e0, strength: 0.18 } })),
      clothLight: this.track(toonMaterial({ color: 0xe9e1d2 })),
      accent: this.track(toonMaterial({ color: el.color, emissive: el.color, emissiveIntensity: 0.15 })),
      hair: this.track(toonMaterial({ color: new THREE.Color(a.hairColor).lerp(new THREE.Color(0xb9bcc6), greyAmount(a.age)), rim: { color: 0xffffff, strength: 0.18, power: 2.5 } })),
      boot: this.track(toonMaterial({ color: 0x3a2a24 })),
      eye: this.track(toonMaterial({ color: a.eyeColor, emissive: a.eyeColor, emissiveIntensity: 0.25 })),
      metal: this.track(new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 0.9, roughness: 0.25 })),
    };

    const limb = (len: number, r: number, mat: THREE.Material, rBottom = r) => {
      const geo = this.track(new THREE.CylinderGeometry(r, rBottom, len, 12, 1));
      geo.translate(0, -len / 2, 0);
      const m = new THREE.Mesh(geo, mat);
      const capTop = new THREE.Mesh(this.track(new THREE.SphereGeometry(r, 12, 8)), mat);
      const capBot = new THREE.Mesh(this.track(new THREE.SphereGeometry(rBottom, 12, 8)), mat);
      capBot.position.y = -len;
      m.add(capTop, capBot);
      return m;
    };
    const joint = (name: Joint, parent: THREE.Object3D, x: number, y: number, z: number) => {
      const o = new THREE.Object3D();
      o.name = name;
      o.position.set(x, y, z);
      parent.add(o);
      this.j[name] = o;
      return o;
    };

    const thighLen = 0.45, shinLen = 0.44;
    this.hipsBaseY = thighLen + shinLen + 0.08;
    const w = fem ? 0.9 : 1.0;
    const bulk = 0.9 + build * 0.35;

    const hips = joint('hips', this.object, 0, this.hipsBaseY, 0);
    const pelvis = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.16, 16, 12)), mats.cloth);
    pelvis.scale.set((fem ? 1.12 : 1.0) * bulk, 0.75, 0.8 * bulk);
    hips.add(pelvis);
    // Coat tail: an open flared cylinder hanging from the waist.
    // Feminine: flared coat skirt; masculine: short straight jacket hem.
    const tailGeo = fem
      ? this.track(new THREE.CylinderGeometry(0.17 * bulk, 0.27 * bulk, 0.42, 16, 1, true))
      : this.track(new THREE.CylinderGeometry(0.18 * bulk, 0.2 * bulk, 0.2, 16, 1, true));
    tailGeo.translate(0, fem ? -0.2 : -0.08, 0);
    const tail = new THREE.Mesh(tailGeo, this.track(toonMaterial({ color: 0x3b4566, side: THREE.DoubleSide })));
    hips.add(tail);
    const belt = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.165 * bulk, 0.025, 8, 24)), mats.accent);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.04;
    hips.add(belt);

    const spine = joint('spine', hips, 0, 0.08, 0);
    const chest = joint('chest', spine, 0, 0.22, 0);
    const torso = new THREE.Mesh(this.track(new THREE.CapsuleGeometry(0.15, 0.22, 6, 16)), mats.cloth);
    torso.scale.set(w * bulk * (fem ? 1.08 : 1.22), 1, 0.78 * bulk);
    torso.position.y = -0.05;
    chest.add(torso);
    const collar = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.1, 0.16, 0.12, 16)), mats.clothLight);
    collar.position.y = 0.15;
    chest.add(collar);

    const neck = joint('neck', chest, 0, 0.2, 0);
    neck.add(limb(0.08, 0.045, mats.skin).translateY(0.08));
    const head = joint('head', neck, 0, 0.1, 0);
    const skull = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.125, 24, 18)), mats.skin);
    skull.scale.set(0.95, 1.05, 1);
    skull.position.y = 0.1;
    head.add(skull);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.03, 12, 8)), mats.eye);
      eye.scale.set(0.75, 1.15, 0.35);
      eye.position.set(side * 0.045, 0.085, 0.115);
      head.add(eye);
    }
    this.buildHair(head, a.hairStyle, mats.hair);

    // Scarf in the element colour, with a tail that trails when moving.
    const scarfRing = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.085, 0.035, 8, 20)), mats.accent);
    scarfRing.rotation.x = Math.PI / 2;
    scarfRing.position.y = 0.2;
    chest.add(scarfRing);
    const scarf = joint('scarf', chest, 0.04, 0.19, -0.09);
    const scarfGeo = this.track(new THREE.BoxGeometry(0.1, 0.5, 0.02));
    scarfGeo.translate(0, -0.25, 0);
    scarf.add(new THREE.Mesh(scarfGeo, mats.accent));

    const shoulderX = (fem ? 0.17 : 0.2) * bulk;
    for (const [side, s] of [['L', 1], ['R', -1]] as const) {
      const sh = joint(`shoulder${side}`, chest, s * shoulderX, 0.12, 0);
      sh.add(new THREE.Mesh(this.track(new THREE.SphereGeometry(0.06 * bulk, 12, 8)), mats.cloth));
      sh.add(limb(0.27, 0.048 * bulk, mats.cloth, 0.042 * bulk));
      const el2 = joint(`elbow${side}`, sh, 0, -0.27, 0);
      el2.add(limb(0.24, 0.04 * bulk, mats.skin, 0.032));
      const hand = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.045, 12, 8)), mats.skin);
      hand.scale.set(0.8, 1.1, 0.6);
      hand.position.y = -0.28;
      el2.add(hand);
      const cuff = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.046, 0.046, 0.05, 12)), mats.accent);
      cuff.position.y = -0.2;
      el2.add(cuff);

      const th = joint(`thigh${side}`, hips, s * 0.09 * bulk, -0.04, 0);
      th.add(limb(thighLen, 0.075 * bulk, mats.cloth, 0.055 * bulk));
      const kn = joint(`knee${side}`, th, 0, -thighLen, 0);
      kn.add(limb(shinLen, 0.058, mats.boot, 0.045));
      const ft = joint(`foot${side}`, kn, 0, -shinLen, 0);
      const footGeo = this.track(new THREE.BoxGeometry(0.1, 0.08, 0.22));
      footGeo.translate(0, -0.035, 0.05);
      ft.add(new THREE.Mesh(footGeo, mats.boot));
    }

    // Sword carried on the back (weapons system arrives in phase 3).
    const sword = new THREE.Group();
    sword.name = 'sword';
    const blade = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.05, 0.85, 0.012)), mats.metal);
    blade.position.y = 0.45;
    const guard = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.2, 0.035, 0.04)), mats.accent);
    const grip = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8)), mats.boot);
    grip.position.y = -0.1;
    sword.add(blade, guard, grip);
    sword.position.set(0, -0.05, -0.17);
    sword.rotation.set(0, 0, 0.75);
    chest.add(sword);

    this.object.scale.setScalar(a.height);
    this.object.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }

  private buildHair(head: THREE.Object3D, style: string, mat: THREE.Material): void {
    const cap = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.138, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.56)), mat);
    cap.position.set(0, 0.12, -0.008);
    cap.rotation.x = -0.25;
    head.add(cap);
    for (let i = 0; i < 5; i++) {
      const bang = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.035, 0.12, 6)), mat);
      bang.rotation.x = Math.PI + 0.35;
      bang.rotation.z = (i - 2) * 0.12;
      bang.position.set((i - 2) * 0.042, 0.17, 0.1);
      head.add(bang);
    }
    if (style === 'long') {
      const back = new THREE.Mesh(this.track(new THREE.CapsuleGeometry(0.11, 0.3, 6, 12)), mat);
      back.scale.set(1.1, 1, 0.45);
      back.position.set(0, -0.03, -0.09);
      head.add(back);
    } else if (style === 'ponytail') {
      const tie = new THREE.Mesh(this.track(new THREE.CapsuleGeometry(0.045, 0.3, 4, 10)), mat);
      tie.position.set(0, 0.0, -0.16);
      tie.rotation.x = 0.35;
      head.add(tie);
    }
  }

  private track<T extends { dispose(): void }>(x: T): T {
    this.disposables.push(x);
    return x;
  }

  update(dt: number, s: LocomotionState): void {
    this.time += dt;
    const { walkSpeed, runSpeed, sprintSpeed } = locomotionRef;
    this.moveW += ((s.grounded ? smoothstep(0.1, walkSpeed * 0.6, s.speed) : this.moveW) - this.moveW) * damp(10, dt);
    this.runW += (smoothstep(walkSpeed, runSpeed, s.speed) - this.runW) * damp(6, dt);
    this.airW += ((s.grounded ? 0 : 1) - this.airW) * damp(s.grounded ? 14 : 8, dt);
    const sprintW = smoothstep(runSpeed, sprintSpeed, s.speed);

    const cycle = lerp(1.5, 2.7, this.runW) + sprintW * 0.5;
    if (s.grounded) this.phase += (s.speed / cycle) * Math.PI * 2 * dt;
    const ph = this.phase;
    const mw = this.moveW;
    const rw = this.runW;

    const legAmp = lerp(0.42, 0.85, rw) * mw;
    const kneeAmp = lerp(0.55, 1.5, rw) * mw;
    const armAmp = lerp(0.35, 0.95, rw) * mw;
    const breath = Math.sin(this.time * 2.1) * (1 - mw);

    const ground: Pose = {
      thighL: [-Math.sin(ph) * legAmp, 0, 0],
      thighR: [Math.sin(ph) * legAmp, 0, 0],
      kneeL: [Math.max(0, Math.sin(ph + Math.PI / 2)) * kneeAmp + 0.05, 0, 0],
      kneeR: [Math.max(0, Math.sin(ph - Math.PI / 2)) * kneeAmp + 0.05, 0, 0],
      footL: [-0.1 * mw, 0, 0],
      footR: [-0.1 * mw, 0, 0],
      shoulderL: [Math.sin(ph) * armAmp, 0, 0.1 + 0.04 * breath],
      shoulderR: [-Math.sin(ph) * armAmp, 0, -0.1 - 0.04 * breath],
      elbowL: [-(0.15 + rw * 1.0 * mw), 0, 0],
      elbowR: [-(0.15 + rw * 1.0 * mw), 0, 0],
      hips: [0, Math.sin(ph) * 0.12 * mw, 0],
      spine: [lerp(0.02, 0.2, rw) * mw + sprintW * 0.12, 0, 0],
      chest: [0.02 * breath, -Math.sin(ph) * 0.18 * mw, 0],
      neck: [-lerp(0.02, 0.15, rw) * mw, 0, 0],
      head: [0, Math.sin(this.time * 0.4) * 0.15 * (1 - mw), 0],
      scarf: [0.15 + s.speed * 0.12 + Math.sin(this.time * 7) * 0.05 * mw, 0, Math.sin(this.time * 3) * 0.08],
    };
    const rising = s.vy > 0;
    const air: Pose = {
      thighL: [rising ? -0.9 : -0.35, 0, 0.05],
      thighR: [rising ? -0.15 : 0.2, 0, -0.05],
      kneeL: [rising ? 1.3 : 0.5, 0, 0],
      kneeR: [rising ? 0.5 : 0.35, 0, 0],
      footL: [0.2, 0, 0],
      footR: [0.2, 0, 0],
      shoulderL: [-0.4, 0, 0.7],
      shoulderR: [-0.4, 0, -0.7],
      elbowL: [-0.6, 0, 0],
      elbowR: [-0.6, 0, 0],
      hips: [0, 0, 0],
      spine: [0.12, 0, 0],
      chest: [0, 0, 0],
      neck: [0, 0, 0],
      head: [0, 0, 0],
      scarf: [1.0 + Math.max(0, -s.vy) * 0.05, 0, 0],
    };
    const lw = s.landing;
    for (const k of Object.keys(ground) as Joint[]) {
      const g = ground[k]!;
      const a = air[k]!;
      const o = this.j[k];
      o.rotation.set(lerp(g[0], a[0], this.airW), lerp(g[1], a[1], this.airW), lerp(g[2], a[2], this.airW));
    }
    // Landing squash.
    this.j.thighL.rotation.x -= lw * 0.55;
    this.j.thighR.rotation.x -= lw * 0.55;
    this.j.kneeL.rotation.x += lw * 1.0;
    this.j.kneeR.rotation.x += lw * 1.0;
    this.j.spine.rotation.x += lw * 0.3;

    const bob = (1 - Math.abs(Math.sin(ph))) * lerp(0.025, 0.06, rw) * mw;
    this.j.hips.position.y = this.hipsBaseY - 0.035 * mw * rw + bob - lw * 0.14 + breath * 0.004;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.object.removeFromParent();
  }
}
