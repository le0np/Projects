import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { RuntimeAsset } from '../assets/manifest';
import { damp, smoothstep } from '../core/math';
import { addRim, toonGradient } from '../render/ToonMaterials';
import { buildScales, greyAmount, type CharacterModelConfig } from '../config/characters';
import type { Appearance } from '../entities/appearance';
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
  private model: THREE.Object3D;
  private baseScale: number;
  private bones = new Map<string, THREE.Bone>();
  private hairUniforms = {
    hairColor: { value: new THREE.Color() },
    hairGrey: { value: 0 },
    hairOn: { value: 0 },
    hairKeyLuma: { value: 0.01 },
  };

  constructor(
    asset: RuntimeAsset,
    gltf: GLTF,
    clips: Map<string, THREE.AnimationClip>,
    heightScale = 1,
    private readonly cfg?: CharacterModelConfig,
  ) {
    const model = SkeletonUtils.clone(gltf.scene);
    this.model = model;
    model.rotation.y = asset.yawOffset ?? 0;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const h = box.max.y - box.min.y;
    this.baseScale = asset.targetHeight && h > 0 ? asset.targetHeight / h : 1;
    model.scale.multiplyScalar(this.baseScale * heightScale);
    model.position.y = -box.min.y * this.baseScale * heightScale;
    this.groundOffset = -box.min.y * this.baseScale;
    if (cfg) this.hairUniforms.hairKeyLuma.value = cfg.hairKeyLuma;
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bones.set(o.name, o as THREE.Bone);
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Skinned bounds are computed in bind pose; avoid wrong culling while animating.
      mesh.frustumCulled = false;
      if (cfg && mesh.isSkinnedMesh) this.addHairMask(mesh, cfg);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next = mats.map((m) => {
        const out = cfg?.shading === 'toon' ? toToon(m as THREE.MeshStandardMaterial) : m;
        addRim(out, 0xffffff, 0.16, 3);
        if (cfg) this.addHairRecolor(out);
        return out;
      });
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
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

  private groundOffset = 0;

  /** Live appearance update (creator preview): height, build and hair colour, without rebuilding. */
  applyAppearance(a: Appearance): void {
    const s = this.baseScale * a.height;
    this.model.scale.setScalar(s);
    this.model.position.y = this.groundOffset * a.height;
    if (this.cfg) {
      const { torso, limbs } = buildScales(a.build);
      for (const n of this.cfg.torsoBones) this.bones.get(n)?.scale.set(torso, 1, torso);
      for (const n of this.cfg.counterBones) this.bones.get(n)?.scale.set(1 / torso, 1, 1 / torso);
      for (const n of this.cfg.limbBones) this.bones.get(n)?.scale.set(limbs, 1, limbs);
      const native = a.hairColor === this.cfg.nativeHair;
      this.hairUniforms.hairColor.value.setHex(a.hairColor);
      this.hairUniforms.hairGrey.value = greyAmount(a.age);
      this.hairUniforms.hairOn.value = native && greyAmount(a.age) === 0 ? 0 : 1;
      if (native) this.hairUniforms.hairColor.value.setHex(0x23263f);
    }
  }

  /** Per-vertex weight of the "hair-capable" bones, so recolouring never touches legs, gloves or boots. */
  private addHairMask(mesh: THREE.SkinnedMesh, cfg: CharacterModelConfig): void {
    const geo = mesh.geometry;
    const si = geo.attributes.skinIndex as THREE.BufferAttribute | undefined;
    const sw = geo.attributes.skinWeight as THREE.BufferAttribute | undefined;
    if (!si || !sw) return;
    const allowed = new Set(mesh.skeleton.bones.map((b, i) => (cfg.hairBones.includes(b.name) ? i : -1)).filter((i) => i >= 0));
    const mask = new Float32Array(si.count);
    for (let v = 0; v < si.count; v++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (allowed.has(si.getComponent(v, k))) w += sw.getComponent(v, k);
      mask[v] = w;
    }
    geo.setAttribute('hairMask', new THREE.BufferAttribute(mask, 1));
  }

  private addHairRecolor(material: THREE.Material): void {
    const u = this.hairUniforms;
    const prev = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      prev.call(material, shader, renderer);
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float hairMask;\nvarying float vHairMask;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHairMask = hairMask;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 hairColor;\nuniform float hairGrey, hairOn, hairKeyLuma;\nvarying float vHairMask;')
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          {
            vec3 c = diffuseColor.rgb;
            float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
            float blueness = clamp((c.b - max(c.r, c.g)) / max(c.b, 1e-4), 0.0, 1.0);
            float m = smoothstep(0.5, 0.85, vHairMask) * smoothstep(0.35, 0.55, blueness) * (1.0 - smoothstep(0.12, 0.3, lum)) * hairOn;
            float shade = clamp(pow(lum / hairKeyLuma, 0.6), 0.3, 2.0);
            vec3 target = mix(hairColor, vec3(0.55), hairGrey) * shade;
            diffuseColor.rgb = mix(c, target, m);
          }`,
        );
    };
    const prevKey = material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey = () => `${prevKey()}|hair`;
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

/** Cel-shaded copy of a Tripo PBR material: keeps the painted albedo and normal map, drops metal/roughness shine. */
function toToon(m: THREE.MeshStandardMaterial): THREE.MeshToonMaterial {
  const t = new THREE.MeshToonMaterial({
    map: m.map ?? null,
    normalMap: m.normalMap ?? null,
    color: m.color,
    gradientMap: toonGradient(),
    transparent: m.transparent,
    alphaTest: m.alphaTest,
    side: m.side,
  });
  if (m.normalMap) t.normalScale.copy(m.normalScale).multiplyScalar(0.6);
  t.name = m.name;
  return t;
}
