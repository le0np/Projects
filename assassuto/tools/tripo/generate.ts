/**
 * Generates 3D assets with the Tripo API from assets-src/manifest.json.
 *
 *   npm run assets:generate -- --only player_feminine --anims phase1
 *   npm run assets:generate -- --phase 3            (all assets up to phase 3)
 *   npm run assets:generate -- --dry-run            (print the plan and credit estimate, no API calls)
 *   npm run assets:generate -- --balance
 *
 * Progress is stored in assets-src/.tripo-state.json so a rerun never pays twice for a finished step.
 * Downloads land in assets-src/incoming/<id>/; run `npm run assets` afterwards to optimise them into public/.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { TripoClient } from './client';
import { matchClips } from './clips';
import { animationsOf, chunk, fullPrompt, hashSpec, loadManifest, RETARGET_BATCH, validateManifest, type AssetSpec, type Manifest } from './manifest';

interface AssetState {
  promptHash: string;
  generation?: string;
  rig?: string;
  retarget: Record<string, string>;
  files: { model?: string; preview?: string; animations: { file: string; clips: string[] }[] };
}
type State = Record<string, AssetState>;

const STATE_PATH = 'assets-src/.tripo-state.json';
const INCOMING = 'assets-src/incoming';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : 'true';
}

function loadState(): State {
  return existsSync(STATE_PATH) ? (JSON.parse(readFileSync(STATE_PATH, 'utf8')) as State) : {};
}
function saveState(s: State) {
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

function selectedAnimations(m: Manifest, a: AssetSpec, mode: string): [string, string][] {
  const all = Object.entries(animationsOf(m, a));
  if (mode === 'none') return [];
  if (mode === 'phase1') {
    const want = a.phase1Animations ?? m.assets.find((x) => x.id === a.animationsFrom)?.phase1Animations ?? [];
    return all.filter(([k]) => want.includes(k));
  }
  if (mode === 'all') return all;
  const names = mode.split(',');
  return all.filter(([k]) => names.includes(k));
}

async function clipNamesOf(path: string): Promise<string[]> {
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
  return doc.getRoot().listAnimations().map((a) => a.getName());
}

async function main() {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* no .env file */
  }
  const manifest = loadManifest();
  const problems = validateManifest(manifest);
  if (problems.length) {
    console.error('Manifest problems:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
  const only = arg('only')?.split(',');
  const phase = Number(arg('phase') ?? 99);
  const animMode = arg('anims') ?? 'all';
  const dry = arg('dry-run') === 'true';
  const force = arg('force') === 'true';
  const regenerate = arg('regenerate') === 'true';
  const assets = manifest.assets.filter((a) => (only ? only.includes(a.id) : a.phase <= phase));
  if (assets.length === 0) {
    console.error('No assets selected.');
    process.exit(1);
  }

  if (dry) {
    let credits = 0;
    for (const a of assets) {
      const anims = selectedAnimations(manifest, a, animMode);
      const c = 30 + (a.rig ? 25 : 0) + anims.length * 10;
      credits += c;
      console.log(`${a.id.padEnd(22)} ${a.image ? 'image' : 'text'}-to-model${a.rig ? ` + rig ${a.rig.type}` : ''}${anims.length ? ` + ${anims.length} anims (${chunk(anims, RETARGET_BATCH).length} calls)` : ''}  ~${c} credits`);
    }
    console.log(`\nEstimated upper bound: ~${credits} credits (~$${(credits / 100).toFixed(2)}). Nothing was sent.`);
    return;
  }

  const client = new TripoClient({ apiKey: process.env.TRIPO_API_KEY ?? '', log: (m) => console.log(`  ${m}`) });
  const bal = await client.balance();
  console.log(`Tripo balance: ${bal.balance} credits (${bal.frozen} frozen)`);
  if (arg('balance')) return;

  const state = loadState();
  for (const a of assets) {
    console.log(`\n== ${a.id}`);
    const dir = join(INCOMING, a.id);
    mkdirSync(dir, { recursive: true });
    const hash = hashSpec(manifest, a);
    let st = state[a.id];
    if (st && !st.promptHash.startsWith('v2:')) st.promptHash = hash; // legacy fingerprint: trust existing files
    if (st && st.promptHash !== hash && !regenerate && !force) {
      console.warn(`  prompt/settings changed since this asset was generated; skipping. Rerun with --regenerate to pay for a new model.`);
      continue;
    }
    if (!st || force || regenerate) st = state[a.id] = { promptHash: hash, retarget: {}, files: { animations: [] } };
    const save = () => saveState(state);

    // 1. Model
    if (!st.generation || !st.files.model || !existsSync(join(dir, 'base.glb'))) {
      const common = {
        model: manifest.defaults.model,
        negative_prompt: manifest.style.negative,
        texture: true,
        pbr: manifest.defaults.pbr,
        texture_quality: manifest.defaults.texture_quality,
        face_limit: a.face_limit ?? manifest.defaults.face_limit,
      };
      let taskId: string;
      if (a.image) {
        const bytes = readFileSync(a.image);
        const mime = extname(a.image) === '.png' ? 'image/png' : 'image/jpeg';
        const token = await client.uploadImage(bytes, a.image.split('/').pop()!, mime);
        taskId = await client.imageToModel({ ...common, input: token });
      } else {
        taskId = await client.textToModel({ ...common, prompt: fullPrompt(manifest, a) });
      }
      st.generation = taskId;
      save();
      const t = await client.wait(taskId, 'model');
      writeFileSync(join(dir, 'base.glb'), await client.download(t.output!.model_url!));
      if (t.output?.rendered_image_url) {
        writeFileSync(join(dir, 'preview.webp'), await client.download(t.output.rendered_image_url));
        st.files.preview = 'preview.webp';
      }
      st.files.model = 'base.glb';
      st.rig = undefined;
      st.retarget = {};
      st.files.animations = [];
      save();
      console.log(`  model ok (${t.credits_consumed ?? '?'} credits)`);
    }

    // 2. Rig
    if (a.rig && (!st.rig || !existsSync(join(dir, 'rigged.glb')))) {
      const check = await client.wait(await client.rigCheck(st.generation!), 'rig-check');
      if (check.output?.riggable === false) {
        console.warn(`  not riggable (detected ${check.output?.rig_type}); skipping rig and animations`);
        continue;
      }
      const rigId = await client.rig({ input: st.generation!, model: a.rig.model, rig_type: a.rig.type, spec: a.rig.spec, out_format: 'glb' });
      st.rig = rigId;
      save();
      const t = await client.wait(rigId, 'rig');
      writeFileSync(join(dir, 'rigged.glb'), await client.download(t.output!.model_url!));
      st.files.model = 'rigged.glb';
      st.retarget = {};
      st.files.animations = [];
      save();
      console.log(`  rig ok (${t.credits_consumed ?? '?'} credits)`);
    }

    // 3. Animations, five per retarget call, in place (movement comes from gameplay code).
    const anims = a.rig ? selectedAnimations(manifest, a, animMode) : [];
    for (const batch of chunk(anims, RETARGET_BATCH)) {
      const key = batch.map(([k]) => k).join('+');
      const file = `anims_${createHash('sha1').update(key).digest('hex').slice(0, 8)}.glb`;
      if (st.retarget[key] && existsSync(join(dir, file))) continue;
      const id = await client.retarget({ input: st.rig!, animations: batch.map(([, p]) => p), out_format: 'glb', export_with_geometry: false, animate_in_place: true });
      st.retarget[key] = id;
      save();
      const t = await client.wait(id, `retarget ${key}`);
      writeFileSync(join(dir, file), await client.download(t.output!.model_url!));
      const names = await clipNamesOf(join(dir, file));
      const clips = matchClips(names, batch);
      console.log(`  clips in ${file}: ${names.join(', ')} -> ${clips.join(', ')}`);
      st.files.animations = st.files.animations.filter((f) => f.file !== file).concat({ file, clips });
      save();
    }

    writeFileSync(
      join(dir, 'asset.json'),
      JSON.stringify(
        { id: a.id, kind: a.kind, out: a.out, model: st.files.model, animations: st.files.animations, targetHeight: a.targetHeight, yawOffset: a.yawOffset ?? manifest.defaults.yawOffset ?? 0 },
        null,
        2,
      ),
    );
    console.log(`  saved to ${dir}`);
  }
  console.log('\nDone. Next: npm run assets');
}

main().catch((e) => {
  console.error(`\nFailed: ${e.message ?? e}`);
  process.exit(1);
});
