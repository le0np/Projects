import { elements, type ElementId } from '../config/elements';
import { echoConnections, echoForms, echoHues, echoPersonalities, echoRelationships, type EchoConnection, type EchoForm, type EchoPersonality, type EchoRelationship } from '../config/echo';
import { ageRange, heightRange } from '../config/creator';
import { regions } from '../config/regions';
import { defaultAppearance, type Appearance } from '../entities/appearance';

export const SAVE_VERSION = 1;

export interface EchoConfig {
  name: string;
  relationship: EchoRelationship;
  personality: EchoPersonality;
  form: EchoForm;
  hue: number;
  memory: string;
  connection: EchoConnection;
}

export interface CreatureBond {
  species: string;
  bondLevel: number;
  bondPoints: number;
  unlocked: string[];
  companion: boolean;
  flags: Record<string, boolean>;
}

/**
 * Everything GDD 14 asks a save to hold. Sections that later phases fill in already exist so the format
 * only grows through migrations, never breaks.
 */
export interface SaveData {
  version: number;
  savedAt: string;
  playTime: number;
  character: { name: string; element: ElementId; appearance: Appearance };
  echo: EchoConfig;
  world: { regionId: string; position: { x: number; y: number; z: number }; facing: number; cameraYaw: number };
  tutorial: { completedSteps: string[]; completed: boolean };
  progression: {
    level: number;
    xp: number;
    skillPoints: number;
    weaponMastery: Record<string, number>;
    unlockedElements: ElementId[];
    /** Elemental skill levels 1-5 (air is the mobility skill). */
    skills: Record<ElementId, number>;
  };
  /** `ability` is the selected elemental ability (by element). */
  equipment: { weapon: string; unlockedWeapons: string[]; ability: ElementId };
  creatures: Record<string, CreatureBond>;
  mount: { selected: string | null };
  /** Remaining seconds of game time (not wall-clock), so cooldowns survive save/load exactly. */
  cooldowns: Record<string, number>;
  discoveries: string[];
  flags: Record<string, boolean>;
}

export const defaultEcho: EchoConfig = {
  name: 'Mira',
  relationship: 'Mother',
  personality: 'warm',
  form: 'human',
  hue: echoHues[0],
  memory: 'You are never as alone as you feel.',
  connection: 'Protector',
};

export function newSave(character: SaveData['character'], echo: EchoConfig, regionId: string): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    playTime: 0,
    character,
    echo,
    world: { regionId, position: { x: NaN, y: NaN, z: NaN }, facing: 0, cameraYaw: 0 },
    tutorial: { completedSteps: [], completed: false },
    progression: { level: 1, xp: 0, skillPoints: 0, weaponMastery: { sword: 0 }, unlockedElements: [character.element], skills: { fire: 1, water: 1, earth: 1, air: 1 } },
    equipment: { weapon: 'sword', unlockedWeapons: ['sword'], ability: character.element },
    creatures: {},
    mount: { selected: null },
    cooldowns: { guardianEmbrace: 0, spiritWard: 0 },
    discoveries: [],
    flags: {},
  };
}

// ---------- sanitising (a save is untrusted input: corrupted, edited or from an older version) ----------

const num = (v: unknown, d: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const str = (v: unknown, d: string, max = 200) => (typeof v === 'string' ? v.slice(0, max) : d);
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const strList = (v: unknown, max = 500) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max) : []);
const elementIds = Object.keys(elements) as ElementId[];

function sanitizeAppearance(v: unknown): Appearance {
  const a = obj(v);
  return {
    presentation: oneOf(a.presentation, ['feminine', 'masculine'] as const, defaultAppearance.presentation),
    height: num(a.height, 1, heightRange.min, heightRange.max),
    build: num(a.build, defaultAppearance.build, 0, 1),
    age: Math.round(num(a.age, ageRange.default, ageRange.min, ageRange.max)),
    skinTone: Math.round(num(a.skinTone, defaultAppearance.skinTone, 0, 0xffffff)),
    hairColor: Math.round(num(a.hairColor, defaultAppearance.hairColor, 0, 0xffffff)),
    hairStyle: str(a.hairStyle, defaultAppearance.hairStyle, 32),
    eyeColor: Math.round(num(a.eyeColor, defaultAppearance.eyeColor, 0, 0xffffff)),
  };
}

/** Coerces arbitrary JSON (already migrated to the current version) into a valid SaveData. */
export function sanitizeSave(raw: unknown): SaveData {
  const r = obj(raw);
  const ch = obj(r.character);
  const element = oneOf(ch.element, elementIds, 'earth');
  const character = { name: str(ch.name, 'Traveller', 24) || 'Traveller', element, appearance: sanitizeAppearance(ch.appearance) };
  const e = obj(r.echo);
  const echo: EchoConfig = {
    name: str(e.name, defaultEcho.name, 24) || defaultEcho.name,
    relationship: oneOf(e.relationship, echoRelationships, defaultEcho.relationship),
    personality: oneOf(e.personality, Object.keys(echoPersonalities) as EchoPersonality[], defaultEcho.personality),
    form: oneOf(e.form, Object.keys(echoForms) as EchoForm[], defaultEcho.form),
    hue: Math.round(num(e.hue, defaultEcho.hue, 0, 0xffffff)),
    memory: str(e.memory, defaultEcho.memory, 160),
    connection: oneOf(e.connection, echoConnections, defaultEcho.connection),
  };
  const w = obj(r.world);
  const p = obj(w.position);
  const regionId = typeof w.regionId === 'string' && w.regionId in regions ? w.regionId : elements[element].startRegion;
  const base = newSave(character, echo, regionId);
  const t = obj(r.tutorial);
  const pr = obj(r.progression);
  const eq = obj(r.equipment);
  const creatures: Record<string, CreatureBond> = {};
  for (const [id, c0] of Object.entries(obj(r.creatures))) {
    const c = obj(c0);
    creatures[id.slice(0, 48)] = {
      species: str(c.species, 'unknown', 48),
      bondLevel: Math.round(num(c.bondLevel, 0, 0, 4)),
      bondPoints: num(c.bondPoints, 0, 0, 1e6),
      unlocked: strList(c.unlocked, 50),
      companion: c.companion === true,
      flags: Object.fromEntries(Object.entries(obj(c.flags)).filter(([, v]) => typeof v === 'boolean')) as Record<string, boolean>,
    };
  }
  const cooldowns: Record<string, number> = { ...base.cooldowns };
  for (const [k, v] of Object.entries(obj(r.cooldowns))) cooldowns[k.slice(0, 48)] = num(v, 0, 0, 86400);
  const mastery: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(pr.weaponMastery))) mastery[k.slice(0, 32)] = num(v, 0, 0, 1e6);
  const unlockedElements = [...new Set([element, ...strList(pr.unlockedElements).filter((x): x is ElementId => elementIds.includes(x as ElementId))])];
  return {
    ...base,
    savedAt: str(r.savedAt, base.savedAt, 40),
    playTime: num(r.playTime, 0, 0, 1e8),
    world: {
      regionId,
      position: { x: num(p.x, NaN), y: num(p.y, NaN), z: num(p.z, NaN) },
      facing: num(w.facing, 0),
      cameraYaw: num(w.cameraYaw, 0),
    },
    tutorial: { completedSteps: strList(t.completedSteps, 100), completed: t.completed === true },
    progression: {
      level: Math.round(num(pr.level, 1, 1, 99)),
      xp: num(pr.xp, 0, 0, 1e9),
      skillPoints: Math.round(num(pr.skillPoints, 0, 0, 999)),
      weaponMastery: { ...base.progression.weaponMastery, ...mastery },
      unlockedElements,
      // Older saves have no skill levels: everything starts at level 1.
      skills: Object.fromEntries(elementIds.map((e) => [e, Math.round(num(obj(pr.skills)[e], 1, 1, 5))])) as Record<ElementId, number>,
    },
    equipment: {
      weapon: str(eq.weapon, 'sword', 32),
      unlockedWeapons: strList(eq.unlockedWeapons, 50).length ? strList(eq.unlockedWeapons, 50) : ['sword'],
      // Only an unlocked element can be selected (older saves have none: falls back to the character's element).
      ability: oneOf(eq.ability, unlockedElements, element),
    },
    creatures,
    mount: { selected: typeof obj(r.mount).selected === 'string' ? (obj(r.mount).selected as string).slice(0, 48) : null },
    cooldowns,
    discoveries: strList(r.discoveries, 1000),
    flags: Object.fromEntries(Object.entries(obj(r.flags)).filter(([, v]) => typeof v === 'boolean')) as Record<string, boolean>,
  };
}
