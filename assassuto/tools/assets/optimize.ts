/**
 * Optimises downloaded GLBs from assets-src/incoming/<id>/ into public/assets/<out>/ and rewrites
 * public/assets/manifest.runtime.json, which the game reads at startup.
 *
 * Works for both pipelines: files produced by `npm run assets:generate` (with asset.json) and GLBs
 * exported by hand from Tripo Studio (rigged.glb or base.glb, settings taken from assets-src/manifest.json).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import type { RuntimeAsset, RuntimeManifest } from '../../src/assets/manifest';
import { loadManifest } from '../tripo/manifest';

const MAX_TEXTURE = Number(process.env.MAX_TEXTURE ?? 1024);

interface IncomingAsset {
  id: string;
  kind: RuntimeAsset['kind'];
  out: string;
  model: string;
  animations: { file: string; clips: string[] }[];
  targetHeight?: number;
  yawOffset?: number;
}

export interface OptimizeOptions {
  incoming?: string;
  publicDir?: string;
  manifestPath?: string;
  log?: (msg: string) => void;
}

export async function optimizeAll(opts: OptimizeOptions = {}): Promise<RuntimeManifest> {
  const INCOMING = opts.incoming ?? 'assets-src/incoming';
  const PUBLIC = opts.publicDir ?? 'public/assets';
  const RUNTIME = join(PUBLIC, 'manifest.runtime.json');
  const log = opts.log ?? console.log;
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const manifest = loadManifest(opts.manifestPath);
  mkdirSync(PUBLIC, { recursive: true });
  const runtime: RuntimeManifest = existsSync(RUNTIME)
    ? JSON.parse(readFileSync(RUNTIME, 'utf8'))
    : { version: 1, generatedAt: '', assets: {} };
  if (!existsSync(INCOMING)) {
    log(`Nothing in ${INCOMING}.`);
    return runtime;
  }

  for (const id of readdirSync(INCOMING)) {
    const dir = join(INCOMING, id);
    if (!statSync(dir).isDirectory()) continue;
    const spec = manifest.assets.find((a) => a.id === id);
    let info: IncomingAsset;
    if (existsSync(join(dir, 'asset.json'))) info = JSON.parse(readFileSync(join(dir, 'asset.json'), 'utf8'));
    else {
      // Hand-exported from Tripo Studio.
      const model = ['rigged.glb', 'base.glb'].find((f) => existsSync(join(dir, f)));
      if (!model || !spec) {
        log(`skip ${id}: no rigged.glb/base.glb or not in manifest`);
        continue;
      }
      info = { id, kind: spec.kind, out: spec.out, model, animations: [], targetHeight: spec.targetHeight, yawOffset: spec.yawOffset ?? manifest.defaults.yawOffset };
    }
    const outDir = join(PUBLIC, info.out);
    mkdirSync(outDir, { recursive: true });

    // Main model: textures resized + WebP, geometry welded and meshopt-compressed.
    const doc = await io.read(join(dir, info.model));
    const inlineClips = doc.getRoot().listAnimations().map((a) => a.getName());
    await doc.transform(
      dedup(),
      prune(),
      weld(),
      resample(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [MAX_TEXTURE, MAX_TEXTURE] }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
    await io.write(join(outDir, 'model.glb'), doc);
    const before = statSync(join(dir, info.model)).size;
    const after = statSync(join(outDir, 'model.glb')).size;
    log(`${id}: model ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);

    const animations: RuntimeAsset['animations'] = [];
    if (inlineClips.length) animations.push({ file: `${info.out}/model.glb`, clips: inlineClips });
    for (const a of info.animations) {
      const adoc = await io.read(join(dir, a.file));
      // Animation-only files: keep the bone nodes, drop everything else.
      await adoc.transform(dedup(), prune({ keepLeaves: true }), resample());
      await io.write(join(outDir, a.file), adoc);
      animations.push({ file: `${info.out}/${a.file}`, clips: a.clips });
      log(`${id}: ${a.file} [${a.clips.join(', ')}]`);
    }

    runtime.assets[id] = {
      id,
      kind: info.kind,
      model: `${info.out}/model.glb`,
      animations,
      targetHeight: info.targetHeight,
      yawOffset: info.yawOffset ?? 0,
    };
  }
  runtime.version = 1;
  runtime.generatedAt = new Date().toISOString();
  writeFileSync(RUNTIME, JSON.stringify(runtime, null, 2) + '\n');
  log(`Wrote ${RUNTIME} (${Object.keys(runtime.assets).length} assets)`);
  return runtime;
}

if (process.argv[1]?.endsWith('optimize.ts')) {
  optimizeAll().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
