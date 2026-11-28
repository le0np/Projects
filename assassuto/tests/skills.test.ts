import { describe, expect, it } from 'vitest';
import { AbilityState } from '../src/combat/Abilities';
import { weaponHitMods } from '../src/combat/imbueEffects';
import { abilities } from '../src/config/abilities';
import { imbueConfig, levelCost, MAX_SKILL_LEVEL, mobilityConfig, skills } from '../src/config/skills';
import { gainXp } from '../src/entities/Progression';
import { defaultAppearance } from '../src/entities/appearance';
import { newSave, sanitizeSave } from '../src/save/SaveSchema';
import { makePlayer } from './fixtures/playerHarness';

describe('skill levels', () => {
  it('every element has five levels', () => {
    for (const s of Object.values(skills)) expect(s.levels).toHaveLength(MAX_SKILL_LEVEL);
  });

  it('levels cost points, only for unlocked skills, up to level 5', () => {
    const a = new AbilityState('fire');
    expect(a.upgradeCost('water')).toBeNull(); // locked
    expect(a.upgrade('fire', 0)).toBe(0);
    let spent = 0;
    for (let l = 2; l <= MAX_SKILL_LEVEL; l++) spent += a.upgrade('fire', 99);
    expect(a.level('fire')).toBe(MAX_SKILL_LEVEL);
    expect(spent).toBe([2, 3, 4, 5].reduce((s, l) => s + levelCost(l), 0));
    expect(a.upgradeCost('fire')).toBeNull();
  });

  it('a higher level hits harder, reaches further and recharges faster', () => {
    const lo = new AbilityState('earth', ['earth', 'fire'], 'fire');
    const hi = new AbilityState('earth', ['earth', 'fire'], 'fire', { fire: 5 });
    expect(hi.maxCooldown('fire')).toBeLessThan(lo.maxCooldown('fire'));
    const a = lo.tryCast('fire');
    const b = hi.tryCast('fire');
    if (!a.ok || !b.ok) throw new Error('cast failed');
    expect(b.damageScale).toBeGreaterThan(a.damageScale);
    expect(b.area).toBeGreaterThan(a.area);
  });

  it('Gale Rush has two charges before the cooldown, three at level 5', () => {
    const a = new AbilityState('air', ['air'], 'air');
    expect(a.tryCast().ok).toBe(true);
    expect(a.cooldownOf('air')).toBe(0);
    expect(a.tryCast().ok).toBe(true);
    expect(a.cooldownOf('air')).toBeGreaterThan(0);
    expect(a.tryCast().ok).toBe(false);
    a.tick(abilities.air.cooldown);
    expect(a.tryCast().ok).toBe(true);
    expect(a.tryCast().ok).toBe(true);
    const b = new AbilityState('air', ['air'], 'air', { air: 5 });
    expect([b.tryCast().ok, b.tryCast().ok, b.tryCast().ok, b.tryCast().ok]).toEqual([true, true, true, false]);
  });

  it('mobility needs the air element; level 2 adds the high jump, level 4 a third jump', () => {
    expect(new AbilityState('fire').mobility.airJumps).toBe(0);
    const a = new AbilityState('fire', ['fire', 'air']);
    expect(a.mobility).toMatchObject({ airJumps: 1, highJump: false });
    a.upgrade('air', 99);
    expect(a.mobility.highJump).toBe(true);
    a.upgrade('air', 99);
    a.upgrade('air', 99);
    expect(a.mobility.airJumps).toBe(2);
  });
});

describe('weapon imbue (Z)', () => {
  it('coats the weapon for 20-30 s by level; the cooldown starts when it wears off', () => {
    expect(skills.fire.levels.map((l) => l.imbueDuration)).toEqual([20, 23, 26, 28, 30]);
    const a = new AbilityState('fire', ['fire', 'water'], 'water', { water: 3 });
    const r = a.tryImbue();
    expect(r.ok && r.imbue.element).toBe('water');
    expect(a.imbue?.duration).toBe(skills.water.levels[2].imbueDuration);
    const again = a.tryImbue();
    expect(!again.ok && again.reason).toBe('active');
    a.tick(a.imbue!.duration + 0.1);
    expect(a.imbue).toBeNull();
    expect(a.imbueCooldown).toBeCloseTo(imbueConfig.cooldown, 5);
    const cd = a.tryImbue();
    expect(!cd.ok && cd.reason).toBe('cooldown');
    a.tick(imbueConfig.cooldown);
    expect(a.tryImbue().ok).toBe(true);
  });

  it('locked elements cannot be imbued; each element changes hits differently', () => {
    expect(new AbilityState('fire').tryImbue('earth').ok).toBe(false);
    const m = (element: 'fire' | 'water' | 'earth' | 'air') => weaponHitMods({ element, second: null, remaining: 5, duration: 5, power: 1 });
    expect(m('fire').damage).toBeGreaterThan(1);
    expect(m('earth').poise).toBeGreaterThan(1);
    expect(m('air').knockback).toBeGreaterThan(1);
    expect(m('air').reach).toBeGreaterThan(0);
    expect(weaponHitMods(null)).toMatchObject({ damage: 1, poise: 1, knockback: 1, reach: 0, speed: 1, explode: false, chill: false });
  });

  it('Z on the player starts the imbue', () => {
    const h = makePlayer('sword', 'fire');
    h.input.press('imbue');
    h.step();
    expect(h.p.abilities.imbue?.element).toBe('fire');
  });
});

describe('mobility: double jump and high jump', () => {
  const jumpPeak = (h: ReturnType<typeof makePlayer>, frames = 120) => {
    let peak = 0;
    for (let i = 0; i < frames; i++) {
      h.step();
      peak = Math.max(peak, h.p.motor.y);
    }
    return peak;
  };

  it('without the wind skill Space in the air does nothing', () => {
    const h = makePlayer('fists', 'fire');
    h.input.press('jump');
    h.step(20);
    const vy = h.p.motor.vy;
    h.input.press('jump');
    h.step();
    expect(h.p.motor.vy).toBeLessThan(vy);
  });

  it('with wind, Space in the air jumps again (once at level 1)', () => {
    const h = makePlayer('fists', 'air');
    h.input.press('jump');
    h.step(28);
    h.input.press('jump');
    h.step();
    expect(h.p.motor.vy).toBeGreaterThan(mobilityConfig.airJumpVelocity * 0.9);
    expect(h.p.jumpBurst?.kind).toBe('air');
    h.step(10);
    const vy = h.p.motor.vy;
    h.input.press('jump');
    h.step();
    expect(h.p.motor.vy).toBeLessThan(vy); // no third jump at level 1
  });

  it('a double jump goes higher than a single jump', () => {
    const single = makePlayer('fists', 'air');
    single.input.press('jump');
    const p1 = jumpPeak(single);
    const dbl = makePlayer('fists', 'air');
    dbl.input.press('jump');
    dbl.step(28);
    dbl.input.press('jump');
    expect(jumpPeak(dbl)).toBeGreaterThan(p1 + 0.8);
  });

  it('level 2: holding Space charges a high jump on release; a tap is a normal jump', () => {
    const tap = makePlayer('fists', 'air', ['air']);
    tap.p.abilities.upgrade('air', 99);
    tap.input.press('jump');
    tap.step(3);
    tap.input.release('jump');
    const normal = jumpPeak(tap);

    const high = makePlayer('fists', 'air', ['air']);
    high.p.abilities.upgrade('air', 99);
    high.input.press('jump');
    high.input.hold('jump');
    high.step(Math.ceil(mobilityConfig.highJumpCharge * 60) + 2);
    expect(high.p.motor.grounded).toBe(true);
    high.input.release('jump');
    const peak = jumpPeak(high);
    expect(peak).toBeGreaterThan(normal * 1.8);
    expect(high.p.jumpBurst?.kind).toBe('high');
  });
});

describe('progression', () => {
  it('experience earns skill points; saves keep skill levels and old saves start at level 1', () => {
    const p = { level: 1, xp: 0, skillPoints: 0 };
    expect(gainXp(p, 60)).toBe(0);
    expect(gainXp(p, 60)).toBe(1);
    expect(p).toMatchObject({ skillPoints: 1, level: 2 });
    const s = newSave({ name: 'Aria', element: 'air', appearance: defaultAppearance }, newSave({ name: 'x', element: 'air', appearance: defaultAppearance }, {} as never, 'galecrest').echo, 'galecrest');
    s.progression.skills.air = 4;
    const back = sanitizeSave(JSON.parse(JSON.stringify(s)));
    expect(back.progression.skills.air).toBe(4);
    const old = JSON.parse(JSON.stringify(s));
    delete old.progression.skills;
    expect(sanitizeSave(old).progression.skills).toEqual({ fire: 1, water: 1, earth: 1, air: 1 });
  });
});
