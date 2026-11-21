import { abilities, abilityConfig, type AnyAbilityDef } from '../config/abilities';
import { elementOrder, type ElementId } from '../config/elements';

export type CastResult = { ok: true; def: AnyAbilityDef; damageScale: number } | { ok: false; reason: 'locked' | 'cooldown' };

/**
 * Which elemental abilities the player has, which one is selected and their cooldowns (game time).
 * Pure state so it can be tested and saved; casting effects live in the combat director.
 */
export class AbilityState {
  readonly unlocked = new Set<ElementId>();
  selected: ElementId;
  private cooldowns = new Map<ElementId, number>();

  constructor(
    readonly affinity: ElementId,
    unlocked: ElementId[] = [affinity],
    selected?: ElementId,
  ) {
    this.unlocked.add(affinity);
    for (const e of unlocked) this.unlocked.add(e);
    this.selected = selected && this.unlocked.has(selected) ? selected : affinity;
  }

  unlock(el: ElementId): boolean {
    if (this.unlocked.has(el)) return false;
    this.unlocked.add(el);
    return true;
  }

  /** Unlocked elements in the fixed fire, water, earth, air order. */
  get list(): ElementId[] {
    return elementOrder.filter((e) => this.unlocked.has(e));
  }

  /** Selects the next unlocked element; returns the new selection. */
  cycle(dir = 1): ElementId {
    const list = this.list;
    const i = list.indexOf(this.selected);
    this.selected = list[(i + dir + list.length) % list.length];
    return this.selected;
  }

  cooldownOf(el: ElementId): number {
    return this.cooldowns.get(el) ?? 0;
  }

  maxCooldown(el: ElementId): number {
    return abilities[el].cooldown * (el === this.affinity ? abilityConfig.affinity.cooldown : 1);
  }

  /** 0 = ready, 1 = just used. */
  cooldownRatio(el: ElementId): number {
    return Math.min(1, this.cooldownOf(el) / this.maxCooldown(el));
  }

  tick(dt: number): void {
    for (const [k, v] of this.cooldowns) this.cooldowns.set(k, Math.max(0, v - dt));
  }

  tryCast(el: ElementId = this.selected): CastResult {
    if (!this.unlocked.has(el)) return { ok: false, reason: 'locked' };
    if (this.cooldownOf(el) > 0) return { ok: false, reason: 'cooldown' };
    this.cooldowns.set(el, this.maxCooldown(el));
    return { ok: true, def: abilities[el], damageScale: el === this.affinity ? abilityConfig.affinity.damage : 1 };
  }

  resetCooldowns(): void {
    this.cooldowns.clear();
  }

  /** Save format: `ability.<element>` keys in SaveData.cooldowns (remaining game seconds). */
  toSave(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of elementOrder) out[`ability.${e}`] = Math.round(this.cooldownOf(e) * 100) / 100;
    return out;
  }

  loadCooldowns(saved: Record<string, number>): void {
    for (const e of elementOrder) {
      const v = saved[`ability.${e}`];
      if (typeof v === 'number' && Number.isFinite(v)) this.cooldowns.set(e, Math.min(Math.max(0, v), this.maxCooldown(e)));
    }
  }
}
