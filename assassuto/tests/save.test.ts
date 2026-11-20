import { describe, expect, it } from 'vitest';
import { validateName } from '../src/config/creator';
import { MemoryBackend, migrate, SaveManager } from '../src/save/SaveManager';
import { defaultEcho, newSave, SAVE_VERSION, sanitizeSave } from '../src/save/SaveSchema';
import { resolveLoadPosition } from '../src/save/restore';
import { defaultAppearance } from '../src/entities/appearance';
import { loadSettings, saveSettings, defaultSettings } from '../src/save/Settings';

const character = { name: 'Aria', element: 'water' as const, appearance: { ...defaultAppearance, height: 1.05 } };

describe('SaveManager', () => {
  it('round-trips a save including cooldowns, bonds and position', () => {
    const backend = new MemoryBackend();
    const mgr = new SaveManager(backend);
    const s = newSave(character, { ...defaultEcho, name: 'Dad', relationship: 'Father' }, 'glacemere');
    s.world.position = { x: 12, y: 3, z: -4 };
    s.cooldowns.guardianEmbrace = 431.5;
    s.creatures.tidecrane_01 = { species: 'tidecrane', bondLevel: 2, bondPoints: 37, unlocked: ['follow'], companion: false, flags: { fed: true } };
    mgr.save(s);
    const r = mgr.load();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.character).toEqual(character);
    expect(r.data.echo.name).toBe('Dad');
    expect(r.data.world.position).toEqual({ x: 12, y: 3, z: -4 });
    expect(r.data.cooldowns.guardianEmbrace).toBe(431.5);
    expect(r.data.creatures.tidecrane_01.bondLevel).toBe(2);
    expect(r.data.version).toBe(SAVE_VERSION);
  });

  it('reports empty, corrupt and future saves', () => {
    const backend = new MemoryBackend();
    const mgr = new SaveManager(backend);
    expect(mgr.load()).toEqual({ ok: false, reason: 'empty' });
    backend.write('save.slot1', '{not json');
    expect(mgr.load()).toEqual({ ok: false, reason: 'corrupt' });
    backend.write('save.slot1', JSON.stringify({ version: SAVE_VERSION + 1 }));
    expect(mgr.load()).toEqual({ ok: false, reason: 'future' });
  });

  it('sanitises tampered values instead of crashing', () => {
    const s = sanitizeSave({
      version: 1,
      character: { name: 42, element: 'lightning', appearance: { height: 9, build: -3, age: 500 } },
      echo: { personality: 'evil', form: 'dragon', memory: 'x'.repeat(1000) },
      world: { regionId: 'nowhere', position: { x: 'a' } },
      cooldowns: { guardianEmbrace: -50 },
      creatures: { a: { bondLevel: 99 } },
    });
    expect(s.character.element).toBe('earth');
    expect(s.character.name).toBe('Traveller');
    expect(s.character.appearance.height).toBeLessThanOrEqual(1.08);
    expect(s.character.appearance.build).toBe(0);
    expect(s.character.appearance.age).toBe(70);
    expect(s.echo.personality).toBe('warm');
    expect(s.echo.form).toBe('human');
    expect(s.echo.memory.length).toBe(160);
    expect(s.world.regionId).toBe('thornwall');
    expect(Number.isNaN(s.world.position.x)).toBe(true);
    expect(s.cooldowns.guardianEmbrace).toBe(0);
    expect(s.creatures.a.bondLevel).toBe(4);
  });

  it('runs migrations in order up to the current version', () => {
    const table = { 0: (r: Record<string, unknown>) => ({ ...r, renamed: r.old }) };
    const out = migrate({ version: 0, old: 5 }, table);
    expect(out.version).toBe(1);
    expect(out.renamed).toBe(5);
    expect(() => migrate({ version: -1 }, table)).toThrow();
  });

  it('keeps meta and settings separately from the save slot', () => {
    const backend = new MemoryBackend();
    const mgr = new SaveManager(backend);
    expect(mgr.readMeta().tutorialCompletedOnce).toBe(false);
    mgr.writeMeta({ tutorialCompletedOnce: true });
    mgr.delete();
    expect(mgr.readMeta().tutorialCompletedOnce).toBe(true);
    saveSettings(backend, { ...defaultSettings, mouseSensitivity: 99, invertY: true });
    const st = loadSettings(backend);
    expect(st.mouseSensitivity).toBe(3);
    expect(st.invertY).toBe(true);
  });
});

describe('resolveLoadPosition', () => {
  const spawn = { x: 0, y: 5, z: 10 };
  const flat = () => 2;
  it('uses the spawn for missing or out-of-bounds positions', () => {
    expect(resolveLoadPosition({ x: NaN, y: NaN, z: NaN }, spawn, flat, 100).usedSpawn).toBe(true);
    expect(resolveLoadPosition({ x: 500, y: 2, z: 0 }, spawn, flat, 100).usedSpawn).toBe(true);
  });
  it('snaps positions below or far above the ground onto it', () => {
    expect(resolveLoadPosition({ x: 3, y: -20, z: 3 }, spawn, flat, 100)).toEqual({ x: 3, y: 2, z: 3, usedSpawn: false });
    expect(resolveLoadPosition({ x: 3, y: 2.5, z: 3 }, spawn, flat, 100).y).toBe(2.5);
  });
});

describe('validateName', () => {
  it('accepts normal names and trims whitespace', () => {
    expect(validateName('  Ana  Marija ')).toEqual({ ok: true, value: 'Ana Marija' });
    expect(validateName("D'Arcy-Lee").ok).toBe(true);
    expect(validateName('Željka').ok).toBe(true);
  });
  it('rejects empty, too long or symbol names', () => {
    expect(validateName('A').ok).toBe(false);
    expect(validateName('x'.repeat(30)).ok).toBe(false);
    expect(validateName('<script>').ok).toBe(false);
  });
});
