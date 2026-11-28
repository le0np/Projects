/** Writes assets-src/TRIPO-PROMPTS.md: copy-paste prompts for generating the manifest by hand in Tripo Studio. */
import { writeFileSync } from 'node:fs';
import { animationsOf, fullPrompt, loadManifest } from './manifest';

const m = loadManifest();
const lines = [
  '# Tripo prompts (generated)',
  '',
  'Generated from `assets-src/manifest.json` by `npm run assets:prompts`. Do not edit by hand.',
  '',
  'Manual workflow in Tripo Studio: generate the model with the prompt and negative prompt below, rig it with the listed rig type,',
  'add the listed preset animations, export **GLB** and save it as `assets-src/incoming/<id>/rigged.glb` (or `base.glb` when there is no rig).',
  'Then run `npm run assets`.',
  '',
  `**Negative prompt (all assets):** ${m.style.negative}`,
  '',
];
for (const phase of [...new Set(m.assets.map((a) => a.phase))].sort((a, b) => a - b)) {
  lines.push(`## Phase ${phase}`, '');
  for (const a of m.assets.filter((x) => x.phase === phase)) {
    const anims = Object.entries(animationsOf(m, a));
    lines.push(`### \`${a.id}\` (${a.kind})`, '', '```', fullPrompt(m, a), '```', '');
    lines.push(`- Face limit: ${a.face_limit ?? m.defaults.face_limit}; target height in game: ${a.targetHeight ?? '-'} m`);
    if (a.rig) lines.push(`- Rig: ${a.rig.type} (model ${a.rig.model}${a.rig.spec ? `, spec ${a.rig.spec}` : ''})`);
    if (anims.length) lines.push(`- Animations: ${anims.map(([k, p]) => `${k} = \`${p}\``).join(', ')}`);
    lines.push('');
  }
}
writeFileSync('assets-src/TRIPO-PROMPTS.md', lines.join('\n'));
console.log('Wrote assets-src/TRIPO-PROMPTS.md');
