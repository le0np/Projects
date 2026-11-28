import { describe, expect, it } from 'vitest';
import { AbilityState } from '../src/combat/Abilities';
import { imbueLabel, spearImbue, weaponHitMods } from '../src/combat/imbueEffects';
import { StatusEffects } from '../src/combat/Status';
import { ThrownSpear } from '../src/combat/ThrownSpear';
import { AttackTokens } from '../src/ai/AttackTokens';
import { abilities } from '../src/config/abilities';
import { combatConfig } from '../src/config/combat';
import { enemyDefs } from '../src/config/enemies';
import { elementDodge, imbueConfig, mobility, mobilityConfig } from '../src/config/skills';
import { Enemy } from '../src/entities/Enemy';
import { flat, makePlayer, stubView } from './fixtures/playerHarness';

const imbue = (element: 'fire' | 'water' | 'earth' | 'air', second: 'fire' | 'water' | 'earth' | 'air' | null = null) => ({ element, second, remaining: 20, duration: 20, power: 1 });

describe('weapon coat (Z): duration, extension, fusion', () => {
  it('a parry or a combo ender adds time, capped at 1.5x the duration', () => {
    const a = new AbilityState('fire');
    a.tryImbue();
    a.tick(10);
    expect(a.extendImbue(imbueConfig.extendParry)).toBeCloseTo(imbueConfig.extendParry);
    for (let i = 0; i < 20; i++) a.extendImbue(imbueConfig.extendCombo);
    expect(a.imbue!.remaining).toBeCloseTo(a.imbue!.duration * imbueConfig.maxExtend);
    expect(new AbilityState('fire').extendImbue(5)).toBe(0);
  });

  it('at level 5, Z with a second element fuses the two (fire + air = Flame Vortex)', () => {
    const low = new AbilityState('fire', ['fire', 'air']);
    low.tryImbue('fire');
    const no = low.tryImbue('air');
    expect(!no.ok && no.reason).toBe('active');

    const a = new AbilityState('fire', ['fire', 'air'], 'fire', { fire: 5 });
    a.tryImbue('fire');
    expect(a.canFuse('air')).toBe(true);
    const r = a.tryImbue('air');
    expect(r.ok && r.fused).toBe(true);
    expect(a.imbue).toMatchObject({ element: 'fire', second: 'air' });
    expect(imbueLabel(a.imbue)).toBe('Flame Vortex');
    // Both elements act: fire burns and explodes on heavy hits, air reaches further and throws harder.
    const m = weaponHitMods(a.imbue, true);
    expect(m.burn).not.toBeNull();
    expect(m.explode).toBe(true);
    expect(m.reach).toBeGreaterThan(0);
    expect(m.knockback).toBeGreaterThan(1);
    // No third element.
    expect(a.tryImbue('fire').ok).toBe(false);
  });

  it('signature effects come with heavy hits and combo enders', () => {
    expect(weaponHitMods(imbue('fire')).explode).toBe(false);
    expect(weaponHitMods(imbue('fire'), true).explode).toBe(true);
    expect(weaponHitMods(imbue('earth')).knockdown).toBe(false);
    expect(weaponHitMods(imbue('earth'), true).knockdown).toBe(true);
    expect(weaponHitMods(imbue('earth')).speed).toBeLessThan(1);
    expect(weaponHitMods(imbue('water')).chill).toBe(true);
    expect(weaponHitMods(imbue('water')).shatter).toBe(1);
    expect(weaponHitMods(imbue('water'), true).shatter).toBe(imbueConfig.water.shatter);
    expect(spearImbue(imbue('air'))).toEqual({ returns: true, spike: false });
    expect(spearImbue(imbue('earth'))).toEqual({ returns: false, spike: true });
  });

  it('Z plays the hand-along-the-blade gesture, during which no attack starts', () => {
    const h = makePlayer('sword', 'fire');
    h.input.press('imbue');
    h.step();
    expect(h.p.gestureT).toBeGreaterThan(0);
    expect(h.view.played.at(-1)).toBe('stance');
    h.input.press('attackLight');
    h.step();
    expect(h.p.runner.busy).toBe(false);
    h.step(Math.ceil(imbueConfig.gestureTime * 60));
    expect(h.p.gestureT).toBe(0);
  });

  it('a stone coat makes swings slower', () => {
    const swingFrames = (coat: boolean) => {
      const h = makePlayer('sword', 'earth');
      if (coat) {
        h.input.press('imbue');
        h.step(Math.ceil(imbueConfig.gestureTime * 60) + 2);
      }
      h.input.press('attackLight');
      h.step();
      let n = 0;
      while (h.p.runner.busy && n < 600) {
        h.step();
        n++;
      }
      return n;
    };
    expect(swingFrames(true)).toBeGreaterThan(swingFrames(false) * 1.08);
  });
});

describe('frost: chill, freeze, shatter', () => {
  it('three frost hits freeze; the chill fades if the hits stop', () => {
    const s = new StatusEffects();
    expect(s.addChill(3, 2)).toBe(false);
    expect(s.addChill(3, 2)).toBe(false);
    expect(s.addChill(3, 2)).toBe(true);
    expect(s.frozen).toBe(true);
    expect(s.addChill(3, 2)).toBe(false); // no stacking while frozen
    s.tick(2.1);
    expect(s.frozen).toBe(false);
    s.addChill(3, 2);
    s.tick(5);
    expect(s.chill).toBe(0);
  });

  it('a frozen enemy cannot move or attack until the ice melts or breaks', () => {
    const e = new Enemy(enemyDefs.raider, stubView(), { x: 0, y: 0, z: 0 });
    const tokens = new AttackTokens(1, 2);
    const run = (seconds: number) => {
      for (let t = 0; t < seconds; t += 1 / 60) e.step(1 / 60, { now: t, player: { x: 0, z: 10, alive: true }, tokens, shooters: tokens, world: flat });
    };
    e.status.addChill(1, 1.5);
    e.freeze(1.5, tokens);
    run(1);
    expect(Math.hypot(e.motor.x, e.motor.z)).toBeLessThan(0.05);
    expect(e.attack).toBeNull();
    e.thaw();
    run(2);
    expect(Math.hypot(e.motor.x, e.motor.z)).toBeGreaterThan(1);
  });
});

describe('thrown spear with a wind coat comes back', () => {
  it('lands, waits, then flies back to the hand', () => {
    const s = new ThrownSpear({ gravity: 9, life: 2.5 });
    s.throwFrom({ x: 0, y: 1.5, z: 0 }, { vx: 0, vy: 2, vz: 20 }, 1, imbueConfig.air.spearReturn.delay);
    expect(s.returns).toBe(true);
    let t = 0;
    while (s.state === 'flying' && t < 3) {
      s.step(1 / 60, () => 0, []);
      t += 1 / 60;
    }
    expect(s.state).toBe('grounded');
    const events: string[] = [];
    for (let i = 0; i < 400 && s.state !== 'held'; i++) {
      const r = s.stepReturn(1 / 60, { x: 0, y: 1.3, z: 0 }, imbueConfig.air.spearReturn.speed, []);
      if (r.event) events.push(r.event);
    }
    expect(events).toEqual(['began', 'caught']);
    expect(s.state).toBe('held');
  });

  it('without the wind coat it stays where it lands', () => {
    const s = new ThrownSpear();
    s.throwFrom({ x: 0, y: 1.5, z: 0 }, { vx: 0, vy: 0, vz: 20 }, 1);
    for (let i = 0; i < 200; i++) s.step(1 / 60, () => 0, []);
    for (let i = 0; i < 200; i++) s.stepReturn(1 / 60, { x: 0, y: 1, z: 0 }, 26, []);
    expect(s.state).toBe('grounded');
  });
});

describe('wind mobility', () => {
  it('air jumps cost no stamina and come back on landing', () => {
    const h = makePlayer('fists', 'air');
    for (let round = 0; round < 3; round++) {
      h.input.press('jump');
      h.step(28);
      const st = h.p.stamina.value;
      h.input.press('jump');
      h.step();
      expect(h.p.motor.vy).toBeGreaterThan(mobilityConfig.airJumpVelocity * 0.9);
      expect(h.p.stamina.value).toBeGreaterThanOrEqual(st);
      h.input.release('jump');
      h.step(150);
      expect(h.p.motor.grounded).toBe(true);
    }
  });

  it('the air jump plays a somersault', () => {
    const h = makePlayer('fists', 'air');
    h.input.press('jump');
    h.step(28);
    h.input.press('jump');
    h.step();
    expect(h.view.played.at(-1)).toBe('stance');
  });

  it('level 3: holding Space (pressed in the air) glides down slowly', () => {
    const fall = (glide: boolean) => {
      const h = makePlayer('fists', 'air');
      h.p.abilities.upgrade('air', 99);
      h.p.abilities.upgrade('air', 99);
      expect(h.p.abilities.mobility.hover).toBe(mobility[2].hover);
      h.input.press('jump');
      h.step(3);
      h.input.release('jump');
      h.step(25);
      h.input.press('jump'); // air jump
      if (!glide) h.input.release('jump');
      h.step(60);
      return { vy: h.p.motor.vy, gliding: h.p.gliding, y: h.p.motor.y };
    };
    const g = fall(true);
    const n = fall(false);
    expect(g.gliding).toBe(true);
    expect(g.vy).toBeGreaterThan(-mobilityConfig.hoverFallSpeed - 0.6);
    expect(g.y).toBeGreaterThan(n.y + 0.5);
  });

  it('Gale Rush dashes, then brakes with a spin strike', () => {
    const h = makePlayer('sword', 'air');
    h.input.press('ability');
    let spins = 0;
    for (let i = 0; i < 60; i++) {
      h.step();
      if (h.p.rushSpinEvent) spins++;
    }
    expect(spins).toBe(1);
    expect(h.p.motor.z).toBeGreaterThan(abilities.air.kind === 'dash' ? abilities.air.distance * 0.8 : 0);
    expect(h.p.cast).toBeNull();
  });
});

describe('element dodges (C)', () => {
  it('fire: Blast Hop leaps backwards with an explosion where you stood', () => {
    const h = makePlayer('sword', 'fire');
    h.input.press('dodge');
    h.step();
    expect(h.p.edodge?.el).toBe('fire');
    expect(h.p.dodgeEvent?.el).toBe('fire');
    expect(h.p.motor.vy).toBeGreaterThan(5);
    h.step(30);
    expect(h.p.motor.z).toBeLessThan(-2);
    // On cooldown the plain roll comes back.
    h.step(60);
    h.input.press('dodge');
    h.step();
    expect(h.p.edodge).toBeNull();
    expect(h.p.dodgeT).toBeGreaterThanOrEqual(0);
  });

  it('water: Ice Slide covers ground fast and stays untouchable', () => {
    const h = makePlayer('sword', 'water');
    h.input.hold('moveForward');
    h.input.press('dodge');
    h.step();
    expect(h.p.edodge?.el).toBe('water');
    for (let i = 0; i < 30; i++) {
      h.step();
      if (h.p.edodge) expect(h.p.combatant.invulnerable).toBeGreaterThan(0);
    }
    expect(h.p.motor.z).toBeGreaterThan(elementDodge.water.speed * elementDodge.water.duration * 0.8);
    expect(h.p.motor.grounded).toBe(true);
  });

  it('earth: Rock Pillar launches you high', () => {
    const h = makePlayer('sword', 'earth');
    h.input.press('dodge');
    h.step();
    expect(h.p.edodge?.el).toBe('earth');
    let peak = 0;
    for (let i = 0; i < 90; i++) {
      h.step();
      peak = Math.max(peak, h.p.motor.y);
    }
    expect(peak).toBeGreaterThan(3.5);
  });

  it('air keeps the ordinary roll', () => {
    const h = makePlayer('sword', 'air');
    h.input.press('dodge');
    h.step();
    expect(h.p.edodge).toBeNull();
    expect(h.p.dodgeT).toBeGreaterThanOrEqual(0);
    expect(combatConfig.dodge.stamina).toBeGreaterThan(0);
  });
});
