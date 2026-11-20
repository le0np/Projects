import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { RuntimeAsset } from '../assets/manifest';
import { damp, smoothstep } from '../core/math';
import { addRim } from '../render/ToonMaterials';
import { locomotionRef, type CharacterView, type LocomotionState } from './CharacterView';

/** Logical locomotion states mapped onto clip names, in order of preference. */
const CLIP_CANDIDATES: Record<string, string[]> = {
  idle: ['idle', 'standing_relax', 'wait'],
  walk: ['walk'],
  run: ['run'],
  jump: ['jump'],
  fall: ['fall', 'jump'],
};

/** A rigged glTF character (Tripo export) driven by an AnimationMixer with cross-fades. */
export class GltfCharacter implements CharacterView {
  readonly object = new THREE.Group();
  readonly source = 'gltf' as const;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: string | null = null;
  private runW = 0;

  constructor(asset: RuntimeAsset, gltf: GLTF, clips: Map<string, THREE.AnimationClip>, heightScale = 1) {
    const model = SkeletonUtils.clone(gltf.scene);
    model.rotation.y = asset.yawOffset ?? 0;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const h = box.max.y - box.min.y;
    const scale = asset.targetHeight && h > 0 ? (asset.targetHeight * heightScale) / h : heightScale;
    model.scale.multiplyScalar(scale);
    model.position.y = -box.min.y * scale;
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Skinned bounds are computed in bind pose; avoid wrong culling while animating.
      mesh.frustumCulled = false;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) addRim(m, 0xffffff, 0.18, 3);
    });
    this.object.add(model);

    this.mixer = new THREE.AnimationMixer(model);
    for (const [state, names] of Object.entries(CLIP_CANDIDATES)) {
      const clip = names.map((n) => clips.get(n)).find(Boolean);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      if (state === 'jump') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions.set(state, action);
    }
    this.play('idle', 0);
  }

  get clipNames(): string[] {
    return [...this.actions.keys()];
  }

  private play(state: string, fade = 0.2): void {
    if (this.current === state) return;
    const next = this.actions.get(state) ?? this.actions.get('idle');
    if (!next) return;
    const prev = this.current ? this.actions.get(this.current) : undefined;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
    this.current = state;
  }

  update(dt: number, s: LocomotionState): void {
    const { walkSpeed, runSpeed } = locomotionRef;
    this.runW += (smoothstep(walkSpeed, runSpeed, s.speed) - this.runW) * damp(6, dt);
    if (!s.grounded) this.play(s.vy > 0 ? 'jump' : 'fall', 0.15);
    else if (s.speed < 0.25) this.play('idle', 0.25);
    else if (s.speed < (walkSpeed + runSpeed) / 2 || !this.actions.has('run')) this.play('walk', 0.2);
    else this.play('run', 0.2);

    // Match foot speed to ground speed.
    const a = this.current ? this.actions.get(this.current) : undefined;
    if (a && (this.current === 'walk' || this.current === 'run')) {
      const ref = this.current === 'walk' ? walkSpeed : runSpeed;
      a.timeScale = Math.max(0.6, Math.min(1.6, s.speed / ref));
    }
    this.mixer.update(dt);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.object.removeFromParent();
  }
}
