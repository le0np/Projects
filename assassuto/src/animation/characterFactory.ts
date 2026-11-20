import type { AssetRegistry } from '../assets/AssetRegistry';
import { characterModels } from '../config/characters';
import type { CharacterLook } from '../entities/appearance';
import type { CharacterView } from './CharacterView';
import { GltfCharacter } from './GltfCharacter';
import { PlaceholderHumanoid } from './PlaceholderHumanoid';

export function playerAssetId(presentation: 'feminine' | 'masculine'): string {
  return presentation === 'feminine' ? 'player_feminine' : 'player_masculine';
}

/**
 * Builds the protagonist's view: the Tripo model when it exists in the runtime manifest,
 * otherwise the procedural placeholder. Never throws; falls back to the placeholder on load errors.
 */
export async function createPlayerView(look: CharacterLook, assets: AssetRegistry): Promise<CharacterView> {
  const id = playerAssetId(look.appearance.presentation);
  const asset = assets.get(id);
  if (asset) {
    try {
      const gltf = await assets.load(asset.model);
      const clips = await assets.loadClips(asset, gltf);
      const view = new GltfCharacter(asset, gltf, clips, 1, characterModels[id]);
      view.applyAppearance(look.appearance);
      return view;
    } catch (err) {
      console.warn(`[assets] ${id} failed to load, using placeholder`, err);
    }
  }
  return new PlaceholderHumanoid(look);
}

/** Whether a view can follow an appearance change live, or must be rebuilt. */
export function canApplyLive(view: CharacterView, prev: CharacterLook, next: CharacterLook): boolean {
  if (prev.appearance.presentation !== next.appearance.presentation) return false;
  if (view instanceof GltfCharacter) return true;
  return false;
}
