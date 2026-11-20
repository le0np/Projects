/** Types, loading and validation for assets-src/manifest.json. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export type StyleKey = 'character' | 'creature' | 'object';
export type RigType = 'biped' | 'quadruped' | 'hexapod' | 'octopod' | 'avian' | 'serpentine' | 'aquatic' | 'others';

export interface AssetSpec {
  id: string;
  kind: 'character' | 'creature' | 'mount' | 'prop' | 'weapon' | 'hair';
  phase: number;
  style: StyleKey;
  prompt: string;
  /** Optional concept image (path relative to the project root) -> image-to-model instead of text-to-model. */
  image?: string;
  face_limit?: number;
  targetHeight?: number;
  yawOffset?: number;
  rig?: { type: RigType; model: string; spec?: string };
  /** Logical clip name -> Tripo preset. */
  animations?: Record<string, string>;
  /** Reuse another asset's animation list (still retargeted onto this asset's own rig). */
  animationsFrom?: string;
  /** Subset generated when running with --phase1-anims (cheap first test). */
  phase1Animations?: string[];
  out: string;
}

export interface Manifest {
  style: Record<StyleKey | 'negative', string>;
  defaults: { model: string; texture_quality: string; pbr: boolean; face_limit: number; /** Tripo exports face +X; the game expects +Z. */ yawOffset?: number };
  assets: AssetSpec[];
}

export const PROMPT_MAX = 1024;
export const NEGATIVE_MAX = 255;
export const RETARGET_BATCH = 5;

/** Presets documented for rig v1.0 (biped) and the non-biped skeletons (developers.tripo3d.ai, 2026-11). */
export const BIPED_V1_PRESETS = new Set(
  (
    'afraid agree angry_01 angry_02 angry_03 basketball_shot bow box_01 box_02 box_03 cast_a_spell cheer chop clap climb complain_01 ' +
    'complain_02 cross_body_crunch crossover_dribble cry dance_01 dance_02 dance_03 dance_04 dance_05 dance_06 defeat_02 defeat_03 depressed ' +
    'dig dive dribble fall fire flee_01 flee_02 flip fold_arms football_catch football_save football_pass freaky frightened front_kick_01 ' +
    'front_kick_02 frustrated_01 frustrated_02 golf greet_01 greet_02 greet_03 greet_04 heart_pose hit_to_body_01 hit_to_body_02 hit_to_head ' +
    'hit_to_side hit_to_stomach hug hurt idle jump_down jump jump_rope_01 jump_rope_02 laugh_01 laugh_02 lift_heavy look_around make_a_call_01 ' +
    'make_a_call_02 pitch_baseball play_mobile_game play_video_game press-up run_upstairs run scared_01 scared_02 scratch shoot shovel sing_01 ' +
    'sing_02 sing_03 sing_04 sit slash sob standing_relax surf swagger swim turn victory_celebration volleyball wait walk warm_up ' +
    'wave_goodbye_01 wave_goodbye_02'
  )
    .split(/\s+/)
    .map((n) => `preset:biped:${n}`),
);
export const OTHER_PRESETS = new Set([
  'preset:idle', 'preset:walk', 'preset:run', 'preset:dive', 'preset:climb', 'preset:jump', 'preset:slash', 'preset:shoot',
  'preset:hurt', 'preset:fall', 'preset:turn', 'preset:quadruped:walk', 'preset:hexapod:walk', 'preset:octopod:walk',
  'preset:serpentine:march', 'preset:aquatic:march',
]);

export function loadManifest(path = 'assets-src/manifest.json'): Manifest {
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
}

export function fullPrompt(m: Manifest, a: AssetSpec): string {
  return `${a.prompt}. ${m.style[a.style]}`;
}

export function animationsOf(m: Manifest, a: AssetSpec): Record<string, string> {
  if (a.animations) return a.animations;
  if (a.animationsFrom) return m.assets.find((x) => x.id === a.animationsFrom)?.animations ?? {};
  return {};
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Returns a list of human-readable problems; empty means valid. */
export function validateManifest(m: Manifest): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  if (m.style.negative.length > NEGATIVE_MAX) problems.push(`negative prompt longer than ${NEGATIVE_MAX}`);
  for (const a of m.assets) {
    if (ids.has(a.id)) problems.push(`duplicate id ${a.id}`);
    ids.add(a.id);
    if (!/^[a-z0-9_]+$/.test(a.id)) problems.push(`${a.id}: id must be snake_case`);
    if (!m.style[a.style]) problems.push(`${a.id}: unknown style ${a.style}`);
    if (fullPrompt(m, a).length > PROMPT_MAX) problems.push(`${a.id}: prompt longer than ${PROMPT_MAX}`);
    if (!/^[a-z0-9_/]+$/.test(a.out)) problems.push(`${a.id}: bad out path ${a.out}`);
    if (a.animationsFrom && !m.assets.some((x) => x.id === a.animationsFrom)) problems.push(`${a.id}: animationsFrom ${a.animationsFrom} not found`);
    const anims = animationsOf(m, a);
    if (Object.keys(anims).length > 0 && !a.rig) problems.push(`${a.id}: animations need a rig`);
    for (const [name, preset] of Object.entries(anims)) {
      const v1 = a.rig?.model.startsWith('v1.0');
      const known = v1 ? BIPED_V1_PRESETS.has(preset) : OTHER_PRESETS.has(preset);
      if (!known) problems.push(`${a.id}: animation ${name} uses unknown preset ${preset} for rig ${a.rig?.model}`);
    }
    for (const n of a.phase1Animations ?? []) if (!(n in anims)) problems.push(`${a.id}: phase1 animation ${n} not in animations`);
  }
  return problems;
}

/**
 * Fingerprint of everything that changes the *generated model*. Only these fields may count:
 * a change elsewhere in the manifest (e.g. yawOffset, targetHeight) must never trigger a paid regeneration.
 */
export function hashSpec(m: Manifest, a: AssetSpec): string {
  const d = m.defaults;
  const key = { p: fullPrompt(m, a), n: m.style.negative, f: a.face_limit ?? d.face_limit, i: a.image, model: d.model, tq: d.texture_quality, pbr: d.pbr };
  return 'v2:' + createHash('sha1').update(JSON.stringify(key)).digest('hex').slice(0, 12);
}

