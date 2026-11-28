import type { SaveBackend } from './SaveManager';

export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  version: 1;
  masterVolume: number;
  mouseSensitivity: number;
  invertY: boolean;
  quality: Quality;
  showControls: boolean;
}

export const defaultSettings: Settings = {
  version: 1,
  masterVolume: 0.8,
  mouseSensitivity: 1,
  invertY: false,
  quality: 'high',
  showControls: true,
};

export function loadSettings(backend: SaveBackend): Settings {
  try {
    const s = JSON.parse(backend.read('settings') ?? '{}');
    const n = (v: unknown, d: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
    return {
      version: 1,
      masterVolume: n(s.masterVolume, defaultSettings.masterVolume, 0, 1),
      mouseSensitivity: n(s.mouseSensitivity, defaultSettings.mouseSensitivity, 0.2, 3),
      invertY: s.invertY === true,
      quality: ['low', 'medium', 'high'].includes(s.quality) ? s.quality : defaultSettings.quality,
      showControls: s.showControls !== false,
    };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(backend: SaveBackend, s: Settings): void {
  try {
    backend.write('settings', JSON.stringify(s));
  } catch {
    /* storage full or blocked: settings stay for this session only */
  }
}
