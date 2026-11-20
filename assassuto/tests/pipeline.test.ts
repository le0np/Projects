import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { optimizeAll } from '../tools/assets/optimize';
import { matchClips } from '../tools/tripo/clips';
import { GltfCharacter } from '../src/animation/GltfCharacter';
import { writeFixture } from './fixtures/makeRig';

async function parse(path: string): Promise<GLTF> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return loader.parseAsync(ab, '');
}

describe('asset pipeline (offline fixture)', () => {
  it('optimises a rigged model plus animation file and the game can play its clips', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fourfold-'));
    const incoming = join(root, 'incoming');
    const pub = join(root, 'public');
    const dir = join(incoming, 'player_feminine');
    mkdirSync(dir, { recursive: true });
    await writeFixture(dir);
    const clips = matchClips(['Armature|preset_biped_idle', 'Armature|preset_biped_walk', 'Armature|preset_biped_run'], [
      ['idle', 'preset:biped:idle'],
      ['walk', 'preset:biped:walk'],
      ['run', 'preset:biped:run'],
    ]);
    writeFileSync(
      join(dir, 'asset.json'),
      JSON.stringify({ id: 'player_feminine', kind: 'character', out: 'characters/player_feminine', model: 'rigged.glb', animations: [{ file: 'anims_test.glb', clips }], targetHeight: 1.7 }),
    );

    const runtime = await optimizeAll({ incoming, publicDir: pub, log: () => {} });
    const asset = runtime.assets.player_feminine;
    expect(asset.model).toBe('characters/player_feminine/model.glb');
    expect(asset.animations?.[0].clips).toEqual(['idle', 'walk', 'run']);

    const model = await parse(join(pub, asset.model));
    const anim = await parse(join(pub, asset.animations![0].file));
    const map = new Map<string, THREE.AnimationClip>();
    anim.animations.forEach((c, i) => {
      const copy = c.clone();
      copy.name = asset.animations![0].clips[i];
      map.set(copy.name, copy);
    });
    const view = new GltfCharacter(asset, model, map);
    expect(view.clipNames).toEqual(expect.arrayContaining(['idle', 'walk', 'run']));

    // Scaled to target height and standing on y = 0.
    view.object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(view.object);
    expect(box.max.y - box.min.y).toBeCloseTo(1.7, 1);
    expect(box.min.y).toBeCloseTo(0, 2);

    // Animation actually drives the bone found by name.
    const spine = view.object.getObjectByName('Spine')!;
    const before = spine.quaternion.clone();
    view.update(0.25, { grounded: true, speed: 4, vy: 0, sprinting: false, landing: 0 });
    view.update(0.25, { grounded: true, speed: 4, vy: 0, sprinting: false, landing: 0 });
    expect(spine.quaternion.angleTo(before)).toBeGreaterThan(0.01);
  });
});
