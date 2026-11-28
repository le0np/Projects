import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { parseRuntimeManifest, type RuntimeAsset, type RuntimeManifest } from './manifest';

/** Loads the runtime manifest and glTF files; caches by URL. */
export class AssetRegistry {
  private manifest: RuntimeManifest = { version: 1, generatedAt: '', assets: {} };
  private loader = new GLTFLoader();
  private cache = new Map<string, Promise<GLTF>>();

  constructor(private readonly base = `${import.meta.env.BASE_URL}assets/`) {
    this.loader.setMeshoptDecoder(MeshoptDecoder);
  }

  async init(): Promise<void> {
    try {
      const res = await fetch(`${this.base}manifest.runtime.json`, { cache: 'no-cache' });
      if (res.ok) this.manifest = parseRuntimeManifest(await res.json());
    } catch {
      // No manifest yet: every asset falls back to its placeholder.
    }
  }

  get(id: string): RuntimeAsset | undefined {
    return this.manifest.assets[id];
  }

  has(id: string): boolean {
    return id in this.manifest.assets;
  }

  get count(): number {
    return Object.keys(this.manifest.assets).length;
  }

  load(file: string): Promise<GLTF> {
    const url = `${this.base}${file}`;
    let p = this.cache.get(url);
    if (!p) {
      p = this.loader.loadAsync(url);
      this.cache.set(url, p);
    }
    return p;
  }

  /** Loads all animation files of an asset and returns clips renamed to their logical names. */
  async loadClips(asset: RuntimeAsset, model: GLTF): Promise<Map<string, THREE.AnimationClip>> {
    const clips = new Map<string, THREE.AnimationClip>();
    for (const c of model.animations) clips.set(c.name, c);
    for (const f of asset.animations ?? []) {
      const gltf = f.file === asset.model ? model : await this.load(f.file);
      gltf.animations.forEach((clip, i) => {
        const name = f.clips[i] ?? clip.name;
        const copy = clip.clone();
        copy.name = name;
        clips.set(name, copy);
      });
    }
    return clips;
  }
}
