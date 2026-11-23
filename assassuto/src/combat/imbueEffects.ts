import type { ElementId } from '../config/elements';
import { fusionName, imbueConfig } from '../config/skills';
import type { Imbue } from './Abilities';

/** Elements on the weapon: one, or two when fused at level 5. */
export function imbueElements(imbue: Imbue | null): ElementId[] {
  if (!imbue) return [];
  return imbue.second ? [imbue.element, imbue.second] : [imbue.element];
}

export const imbueNames: Record<ElementId, string> = { fire: 'Flame Weapon', water: 'Frost Weapon', earth: 'Stone Weapon', air: 'Gust Weapon' };

/** HUD name: "Flame Weapon", or the fusion's name ("Flame Vortex"). */
export function imbueLabel(imbue: Imbue | null): string {
  if (!imbue) return '';
  if (imbue.second) return fusionName(imbue.element, imbue.second) ?? `${imbueNames[imbue.element]} + ${imbueNames[imbue.second]}`;
  return imbueNames[imbue.element];
}

/** What an imbued weapon adds to one hit. */
export interface WeaponHitMods {
  damage: number;
  poise: number;
  knockback: number;
  /** Extra reach in metres (the whirlwind around an air blade). */
  reach: number;
  /** Attack speed multiplier (stone is heavier). */
  speed: number;
  /** Earth: heavy hits and combo enders knock the target down. */
  knockdown: boolean;
  /** Fire: heavy hits and combo enders explode. */
  explode: boolean;
  /** Water: each hit adds a chill stack; heavy hits shatter a frozen target. */
  chill: boolean;
  shatter: number;
  burn: { dps: number; time: number } | null;
  soak: { slow: number; time: number } | null;
}

/**
 * Hit modifiers for the current coat. `heavy` is a heavy attack, the last hit of a combo string or a
 * thrown-spear impact: those trigger the element's signature (explosion, knockdown, shatter).
 * Fused coats apply both elements.
 */
export function weaponHitMods(imbue: Imbue | null, heavy = false): WeaponHitMods {
  const out: WeaponHitMods = { damage: 1, poise: 1, knockback: 1, reach: 0, speed: 1, knockdown: false, explode: false, chill: false, shatter: 1, burn: null, soak: null };
  if (!imbue) return out;
  const p = imbue.power;
  for (const el of imbueElements(imbue)) {
    if (el === 'fire') {
      out.damage *= 1 + (imbueConfig.fire.damage - 1) * p;
      out.burn = { dps: imbueConfig.fire.burnDps * p, time: imbueConfig.fire.burnTime };
      out.explode ||= heavy;
    } else if (el === 'water') {
      out.soak = { slow: Math.max(0.3, 1 - (1 - imbueConfig.water.slow) * p), time: imbueConfig.water.soakTime };
      out.chill = true;
      if (heavy) out.shatter = imbueConfig.water.shatter;
    } else if (el === 'earth') {
      out.poise *= 1 + (imbueConfig.earth.poise - 1) * p;
      out.speed *= imbueConfig.earth.speed;
      out.knockdown ||= heavy;
    } else {
      out.knockback *= 1 + (imbueConfig.air.knockback - 1) * p;
      out.reach += imbueConfig.air.reach;
    }
  }
  return out;
}

/** Thrown spear extras: air brings it back like a boomerang, earth raises a stone spike where it lands. */
export function spearImbue(imbue: Imbue | null): { returns: boolean; spike: boolean } {
  const els = imbueElements(imbue);
  return { returns: els.includes('air'), spike: els.includes('earth') };
}
