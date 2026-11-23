import { abilities, abilityConfig, type AnyAbilityDef } from '../config/abilities';
import { elementOrder, type ElementId } from '../config/elements';
import { elementDodge, imbueConfig, type ElementDodgeDef, levelCost, MAX_SKILL_LEVEL, mobility, skills, type MobilityTier, type SkillTier } from '../config/skills';

export type DodgeElement = keyof typeof elementDodge;
export type { ElementDodgeDef };

export type CastResult = { ok: true; def: AnyAbilityDef; damageScale: number; area: number } | { ok: false; reason: 'locked' | 'cooldown' };

/** The element (or, at level 5, two fused elements) coating the weapon. */
export interface Imbue {
  element: ElementId;
  /** Second element fused in at level 5, or null. */
  second: ElementId | null;
  remaining: number;
  duration: number;
  power: number;
}

export type ImbueResult = { ok: true; imbue: Imbue; fused: boolean } | { ok: false; reason: 'locked' | 'cooldown' | 'active' };

/**
 * Which elemental abilities the player has, which one is selected and their cooldowns (game time).
 * Pure state so it can be tested and saved; casting effects live in the combat director.
 */
export class AbilityState {
  readonly unlocked = new Set<ElementId>();
  selected: ElementId;
  private cooldowns = new Map<ElementId, number>();
  private levels = new Map<ElementId, number>();
  /** Element dodges (C) recharge separately from the abilities. */
  private dodgeCooldowns = new Map<ElementId, number>();
  /** Gale Rush charges left before its cooldown starts. */
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
    return unlocked ? { ...mobility[this.level('air') - 1], unlocked } : { airJumps: 0, highJump: false, dashCharges: 1, hover: 0, unlocked };
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

  /**
   * Z: coat the weapon in the selected element. While a coat is on, Z with another element fuses the
   * two when either is at level 5; otherwise Z waits for the coat to wear off and the cooldown after it.
   */
  tryImbue(el: ElementId = this.selected): ImbueResult {
    if (!this.unlocked.has(el)) return { ok: false, reason: 'locked' };
    const cur = this.imbue;
    if (cur) {
      if (this.canFuse(el)) {
        const t = this.tier(el);
        cur.second = el;
        cur.duration = Math.max(cur.duration, t.imbueDuration);
        cur.remaining = Math.max(cur.remaining, t.imbueDuration);
        cur.power = Math.max(cur.power, t.imbuePower);
        return { ok: true, imbue: cur, fused: true };
      }
      return { ok: false, reason: 'active' };
    }
    if (this.imbueCooldown > 0) return { ok: false, reason: 'cooldown' };
    const t = this.tier(el);
    this.imbue = { element: el, second: null, remaining: t.imbueDuration, duration: t.imbueDuration, power: t.imbuePower };
    return { ok: true, imbue: this.imbue, fused: false };
  }

  /** Would Z with `el` fuse it into the current coat? */
  canFuse(el: ElementId = this.selected): boolean {
    const cur = this.imbue;
    return !!cur && !cur.second && el !== cur.element && this.unlocked.has(el) && (this.level(el) >= MAX_SKILL_LEVEL || this.level(cur.element) >= MAX_SKILL_LEVEL);
  }

  /** A perfect parry or a landed combo ender keeps the coat burning longer (up to 1.5x its duration). */
  extendImbue(seconds: number): number {
    const cur = this.imbue;
    if (!cur) return 0;
    const before = cur.remaining;
    cur.remaining = Math.min(cur.duration * imbueConfig.maxExtend, cur.remaining + seconds);
    return cur.remaining - before;
  }

  /** C with fire, water or earth selected: that element's dodge, if ready. */
  tryElementDodge(el: ElementId = this.selected): { ok: true; el: DodgeElement; def: ElementDodgeDef; damageScale: number; area: number } | { ok: false } {
    if (el === 'air' || !this.unlocked.has(el) || this.dodgeCooldownOf(el) > 0) return { ok: false };
    const def = elementDodge[el];
    const t = this.tier(el);
    this.dodgeCooldowns.set(el, def.cooldown * t.cooldown);
    return { ok: true, el, def, damageScale: t.damage, area: t.area };
  }

  dodgeCooldownOf(el: ElementId): number {
    return this.dodgeCooldowns.get(el) ?? 0;
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
    for (const [k, v] of this.dodgeCooldowns) this.dodgeCooldowns.set(k, Math.max(0, v - dt));
    this.imbueCooldown = Math.max(0, this.imbueCooldown - dt);
    if (this.imbue) {
      this.imbue.remaining -= dt;
      if (this.imbue.remaining <= 0) {
        this.imbue = null;
        // The cooldown starts once the coat wears off.
        this.imbueCooldown = imbueConfig.cooldown;
      }
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
    this.dodgeCooldowns.clear();
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
    if (typeof im === 'number' && Number.isFinite(im)) this.imbueCooldown = Math.min(Math.max(0, im), imbueConfig.cooldown);
  }
}
