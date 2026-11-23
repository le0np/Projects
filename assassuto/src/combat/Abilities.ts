import { abilities, abilityConfig, type AnyAbilityDef } from '../config/abilities';
import { elementOrder, type ElementId } from '../config/elements';
import { imbueConfig, levelCost, MAX_SKILL_LEVEL, mobility, skills, type MobilityTier, type SkillTier } from '../config/skills';

export type CastResult = { ok: true; def: AnyAbilityDef; damageScale: number; area: number } | { ok: false; reason: 'locked' | 'cooldown' };

/** The selected element coating the weapon. */
export interface Imbue {
  element: ElementId;
  remaining: number;
  duration: number;
  power: number;
}

/**
 * Which elemental abilities the player has, which one is selected and their cooldowns (game time).
 * Pure state so it can be tested and saved; casting effects live in the combat director.
 */
export class AbilityState {
  readonly unlocked = new Set<ElementId>();
  selected: ElementId;
  private cooldowns = new Map<ElementId, number>();
  private levels = new Map<ElementId, number>();
  /** Gale Step charges left before its cooldown starts (mobility level 5 has two). */
  private dashCharges = 1;
  imbue: Imbue | null = null;
  imbueCooldown = 0;

  constructor(
    readonly affinity: ElementId,
    unlocked: ElementId[] = [affinity],
    selected?: ElementId,
    levels: Partial<Record<ElementId, number>> = {},
  ) {
    this.unlocked.add(affinity);
    for (const e of unlocked) this.unlocked.add(e);
    this.selected = selected && this.unlocked.has(selected) ? selected : affinity;
    for (const e of elementOrder) {
      const l = Math.round(levels[e] ?? 1);
      this.levels.set(e, Math.min(MAX_SKILL_LEVEL, Math.max(1, Number.isFinite(l) ? l : 1)));
    }
    this.dashCharges = this.mobility.dashCharges;
  }

  /** Skill level 1-5 (locked elements report their level for when they unlock). */
  level(el: ElementId): number {
    return this.levels.get(el) ?? 1;
  }

  tier(el: ElementId): SkillTier {
    return skills[el].levels[this.level(el) - 1];
  }

  /** Air is the mobility skill; without it there is no double jump or high jump. */
  get mobility(): MobilityTier & { unlocked: boolean } {
    const unlocked = this.unlocked.has('air');
    return unlocked ? { ...mobility[this.level('air') - 1], unlocked } : { airJumps: 0, highJump: false, dashCharges: 1, unlocked };
  }

  /** Points needed for the next level, or null at max level / locked. */
  upgradeCost(el: ElementId): number | null {
    if (!this.unlocked.has(el) || this.level(el) >= MAX_SKILL_LEVEL) return null;
    return levelCost(this.level(el) + 1);
  }

  /** Raises a skill if `points` cover it; returns the points spent (0 if not possible). */
  upgrade(el: ElementId, points: number): number {
    const cost = this.upgradeCost(el);
    if (cost === null || cost > points) return 0;
    this.levels.set(el, this.level(el) + 1);
    if (el === 'air') this.dashCharges = this.mobility.dashCharges;
    return cost;
  }

  levelsToSave(): Record<ElementId, number> {
    return Object.fromEntries(elementOrder.map((e) => [e, this.level(e)])) as Record<ElementId, number>;
  }

  /** Z: coat the weapon in the selected element. */
  tryImbue(el: ElementId = this.selected): { ok: true; imbue: Imbue } | { ok: false; reason: 'locked' | 'cooldown' } {
    if (!this.unlocked.has(el)) return { ok: false, reason: 'locked' };
    if (this.imbueCooldown > 0) return { ok: false, reason: 'cooldown' };
    const t = this.tier(el);
    this.imbue = { element: el, remaining: t.imbueDuration, duration: t.imbueDuration, power: t.imbuePower };
    this.imbueCooldown = imbueConfig.cooldown + t.imbueDuration;
    return { ok: true, imbue: this.imbue };
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
    return abilities[el].cooldown * (el === this.affinity ? abilityConfig.affinity.cooldown : 1) * this.tier(el).cooldown;
  }

  /** 0 = ready, 1 = just used. */
  cooldownRatio(el: ElementId): number {
    return Math.min(1, this.cooldownOf(el) / this.maxCooldown(el));
  }

  tick(dt: number): void {
    for (const [k, v] of this.cooldowns) {
      const n = Math.max(0, v - dt);
      this.cooldowns.set(k, n);
      if (k === 'air' && n === 0) this.dashCharges = this.mobility.dashCharges;
    }
    this.imbueCooldown = Math.max(0, this.imbueCooldown - dt);
    if (this.imbue) {
      this.imbue.remaining -= dt;
      if (this.imbue.remaining <= 0) this.imbue = null;
    }
  }

  tryCast(el: ElementId = this.selected): CastResult {
    if (!this.unlocked.has(el)) return { ok: false, reason: 'locked' };
    if (this.cooldownOf(el) > 0) return { ok: false, reason: 'cooldown' };
    if (el === 'air' && this.dashCharges > 1) this.dashCharges--;
    else this.cooldowns.set(el, this.maxCooldown(el));
    const t = this.tier(el);
    return { ok: true, def: abilities[el], damageScale: (el === this.affinity ? abilityConfig.affinity.damage : 1) * t.damage, area: t.area };
  }

  resetCooldowns(): void {
    this.cooldowns.clear();
    this.imbueCooldown = 0;
    this.dashCharges = this.mobility.dashCharges;
  }

  /** Save format: `ability.<element>` keys in SaveData.cooldowns (remaining game seconds). */
  toSave(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of elementOrder) out[`ability.${e}`] = Math.round(this.cooldownOf(e) * 100) / 100;
    out.imbue = Math.round(this.imbueCooldown * 100) / 100;
    return out;
  }

  loadCooldowns(saved: Record<string, number>): void {
    for (const e of elementOrder) {
      const v = saved[`ability.${e}`];
      if (typeof v === 'number' && Number.isFinite(v)) this.cooldowns.set(e, Math.min(Math.max(0, v), this.maxCooldown(e)));
    }
    const im = saved.imbue;
    if (typeof im === 'number' && Number.isFinite(im)) this.imbueCooldown = Math.min(Math.max(0, im), imbueConfig.cooldown + 16);
  }
}
