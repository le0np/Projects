/**
 * Runtime asset manifest, written by `npm run assets` into public/assets/manifest.runtime.json.
 * The game only knows asset ids; whether a real model exists is decided here.
 */
export interface RuntimeAnimationFile {
  file: string;
  /** Logical clip names in the order the clips appear in the file (Tripo exports them in request order). */
  clips: string[];
}

export interface RuntimeAsset {
  id: string;
  kind: 'character' | 'creature' | 'mount' | 'prop' | 'weapon' | 'hair';
  model: string;
  animations?: RuntimeAnimationFile[];
  /** Rotation (radians) applied so the model faces +Z. */
  yawOffset?: number;
  /** Height in metres the model is scaled to (0/undefined = keep source scale). */
  targetHeight?: number;
}

export interface RuntimeManifest {
  version: 1;
  generatedAt: string;
  assets: Record<string, RuntimeAsset>;
}

export function parseRuntimeManifest(raw: unknown): RuntimeManifest {
  const empty: RuntimeManifest = { version: 1, generatedAt: '', assets: {} };
  if (!raw || typeof raw !== 'object') return empty;
  const m = raw as Partial<RuntimeManifest>;
  if (m.version !== 1 || !m.assets || typeof m.assets !== 'object') return empty;
  const assets: Record<string, RuntimeAsset> = {};
  for (const [id, a] of Object.entries(m.assets)) {
    if (a && typeof a.model === 'string' && a.model.length > 0) assets[id] = { ...a, id };
  }
  return { version: 1, generatedAt: String(m.generatedAt ?? ''), assets };
}
