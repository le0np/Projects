// Turning state into a string and back. Anything unexpected falls back to a fresh farm.

import { createState, cropById, upgradeById, isUnlocked } from './sim.js';
import { SAVE_VERSION, OFFLINE_CAP, WATER_DURATION, WATER_INTERVAL } from './data.js';

export const SAVE_KEY = 'dev-farm/save';

export function serialize(s, now) {
  return JSON.stringify({ ...s, savedAt: now });
}

const num = (v, min, max, fallback) =>
  (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);

// Returns { state, elapsed (seconds since save, capped), restored }.
export function deserialize(raw, now) {
  const fresh = { state: createState(), elapsed: 0, restored: false };
  if (typeof raw !== 'string' || raw === '') return fresh;
  let d;
  try {
    d = JSON.parse(raw);
  } catch {
    return fresh;
  }
  if (!d || typeof d !== 'object' || d.version !== SAVE_VERSION) return fresh;

  const s = createState();
  const big = Number.MAX_SAFE_INTEGER;
  s.coins = Math.floor(num(d.coins, 0, big, s.coins));
  s.totalEarned = Math.floor(num(d.totalEarned, 0, big, 0));
  for (const id of Object.keys(s.upgrades)) {
    s.upgrades[id] = Math.floor(num(d.upgrades?.[id], 0, upgradeById[id].costs.length, 0));
  }
  s.timers.water = num(d.timers?.water, 0, WATER_INTERVAL, 0);
  s.timers.drone = num(d.timers?.drone, 0, 60, 0);
  if (Array.isArray(d.tiles)) {
    for (let i = 0; i < s.tiles.length; i++) {
      const t = d.tiles[i];
      if (t && cropById[t.crop]) {
        s.tiles[i] = {
          crop: t.crop,
          progress: num(t.progress, 0, 1, 0),
          water: num(t.water, 0, WATER_DURATION, 0),
        };
      }
    }
  }
  if (isUnlocked(s, d.selectedCrop)) s.selectedCrop = d.selectedCrop;
  s.stats.harvested = Math.floor(num(d.stats?.harvested, 0, big, 0));
  s.stats.planted = Math.floor(num(d.stats?.planted, 0, big, 0));

  const elapsed = typeof d.savedAt === 'number' ? num((now - d.savedAt) / 1000, 0, OFFLINE_CAP, 0) : 0;
  return { state: s, elapsed, restored: true };
}
