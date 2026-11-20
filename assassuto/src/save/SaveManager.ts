import { SAVE_VERSION, sanitizeSave, type SaveData } from './SaveSchema';

/** Storage abstraction: local storage today, cloud sync later (GDD 14). */
export interface SaveBackend {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export class LocalStorageBackend implements SaveBackend {
  constructor(private readonly prefix = 'fourfold.') {}
  read(key: string): string | null {
    try {
      return localStorage.getItem(this.prefix + key);
    } catch {
      return null;
    }
  }
  write(key: string, value: string): void {
    localStorage.setItem(this.prefix + key, value);
  }
  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch {
      /* ignore */
    }
  }
}

export class MemoryBackend implements SaveBackend {
  readonly data = new Map<string, string>();
  read(key: string) {
    return this.data.get(key) ?? null;
  }
  write(key: string, value: string) {
    this.data.set(key, value);
  }
  remove(key: string) {
    this.data.delete(key);
  }
}

/** Upgrades raw save JSON from version N to N+1. Add an entry whenever SaveData changes shape. */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;
export const migrations: Record<number, Migration> = {
  // 1: (raw) => ({ ...raw, version: 2, newSection: {} }),
};

export type LoadResult = { ok: true; data: SaveData; migratedFrom?: number } | { ok: false; reason: 'empty' | 'corrupt' | 'future' };

export function migrate(raw: Record<string, unknown>, table: Record<number, Migration> = migrations): Record<string, unknown> {
  let v = typeof raw.version === 'number' ? raw.version : 1;
  let cur = raw;
  while (v < SAVE_VERSION) {
    const m = table[v];
    if (!m) throw new Error(`No migration from save version ${v}`);
    cur = m(cur);
    v++;
    cur.version = v;
  }
  return cur;
}

export class SaveManager {
  constructor(
    private readonly backend: SaveBackend = new LocalStorageBackend(),
    private readonly table: Record<number, Migration> = migrations,
  ) {}

  private key(slot: string) {
    return `save.${slot}`;
  }

  has(slot = 'slot1'): boolean {
    return this.load(slot).ok;
  }

  load(slot = 'slot1'): LoadResult {
    const text = this.backend.read(this.key(slot));
    if (!text) return { ok: false, reason: 'empty' };
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(text);
      if (!raw || typeof raw !== 'object') return { ok: false, reason: 'corrupt' };
    } catch {
      return { ok: false, reason: 'corrupt' };
    }
    const version = typeof raw.version === 'number' ? raw.version : 1;
    if (version > SAVE_VERSION) return { ok: false, reason: 'future' };
    try {
      const data = sanitizeSave(migrate(raw, this.table));
      return version < SAVE_VERSION ? { ok: true, data, migratedFrom: version } : { ok: true, data };
    } catch {
      return { ok: false, reason: 'corrupt' };
    }
  }

  save(data: SaveData, slot = 'slot1'): void {
    const out: SaveData = { ...data, version: SAVE_VERSION, savedAt: new Date().toISOString() };
    this.backend.write(this.key(slot), JSON.stringify(out));
  }

  delete(slot = 'slot1'): void {
    this.backend.remove(this.key(slot));
  }

  /** Small cross-save facts, e.g. whether the tutorial was ever completed (GDD 13: skippable afterwards). */
  readMeta(): { tutorialCompletedOnce: boolean } {
    try {
      const m = JSON.parse(this.backend.read('meta') ?? '{}');
      return { tutorialCompletedOnce: m.tutorialCompletedOnce === true };
    } catch {
      return { tutorialCompletedOnce: false };
    }
  }

  writeMeta(meta: { tutorialCompletedOnce: boolean }): void {
    this.backend.write('meta', JSON.stringify(meta));
  }
}
