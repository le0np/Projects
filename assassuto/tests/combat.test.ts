import { describe, expect, it } from 'vitest';
import { AttackTokens } from '../src/ai/AttackTokens';
import { AttackRunner } from '../src/combat/AttackRunner';
import { Combatant } from '../src/combat/Combatant';
import { InputBuffer } from '../src/combat/InputBuffer';
import { inArc, isInFront, resolveHit, type HitInfo } from '../src/combat/resolveHit';
import { combatConfig, sword, weapons } from '../src/config/combat';

const step = (r: AttackRunner, total: number, dt = 1 / 60) => {
  const ev = { opened: 0, closed: 0, finished: 0 };
  for (let t = 0; t < total; t += dt) {
    const e = r.step(dt);
    ev.opened += +e.opened;
    ev.closed += +e.closed;
    ev.finished += +e.finished;
  }
  return ev;
};

describe('AttackRunner (combo graph)', () => {
  it('starts L1 from neutral, H1 for heavy, air attack in the air and counter after a parry', () => {
    const r = new AttackRunner(sword);
    expect(r.resolve('light', { airborne: false, counterReady: false })).toBe('sw_l1');
    expect(r.resolve('heavy', { airborne: false, counterReady: false })).toBe('sw_h1');
    expect(r.resolve('light', { airborne: true, counterReady: false })).toBe('sw_air');
    expect(r.resolve('light', { airborne: false, counterReady: true })).toBe('sw_counter');
  });

  it('chains only inside the combo window: L -> L -> L and L -> L -> H', () => {
    const r = new AttackRunner(sword);
    r.start('sw_l1');
    step(r, 0.05);
    expect(r.resolve('light', { airborne: false, counterReady: false })).toBeNull(); // too early
    step(r, 0.15);
    expect(r.resolve('light', { airborne: false, counterReady: false })).toBe('sw_l2');
    r.start('sw_l2');
    step(r, 0.2);
    expect(r.resolve('heavy', { airborne: false, counterReady: false })).toBe('sw_llh');
    expect(r.chain).toBe(2);
  });

  it('opens and closes the hit window exactly once and finishes after its duration', () => {
    const r = new AttackRunner(sword);
    r.start('sw_h1');
    const ev = step(r, sword.attacks.sw_h1.duration + 0.05);
    expect(ev).toEqual({ opened: 1, closed: 1, finished: 1 });
    expect(r.busy).toBe(false);
  });

  it('gives every swing a unique instance id', () => {
    const r = new AttackRunner(sword);
    const a = r.start('sw_l1').instance;
    const b = r.start('sw_l2').instance;
    expect(a).not.toBe(b);
  });

  it('every attack referenced by a weapon exists and has sane timings', () => {
    for (const w of Object.values(weapons)) {
      for (const id of [w.start.light, w.start.heavy, w.air, w.counter]) expect(w.attacks[id], `${w.id}:${id}`).toBeDefined();
      for (const a of Object.values(w.attacks)) {
        expect(a.hitStart).toBeLessThan(a.hitEnd);
        expect(a.hitEnd).toBeLessThanOrEqual(a.duration);
        for (const n of Object.values(a.next ?? {})) expect(w.attacks[n!], `${a.id} -> ${n}`).toBeDefined();
      }
    }
  });
});

describe('InputBuffer', () => {
  it('keeps presses for the buffer window only', () => {
    const b = new InputBuffer<'light' | 'heavy'>(0.25);
    b.push('light', 1);
    expect(b.consume(1.2)).toBe('light');
    b.push('heavy', 2);
    expect(b.consume(2.3)).toBeNull();
  });
});

const hit = (instance: number, over: Partial<HitInfo> = {}): HitInfo => ({ instance, damage: 20, poise: 20, knockback: 3, kind: 'melee', ...over });
const fighter = (o: Partial<{ maxHealth: number; maxPoise: number; superArmor: boolean }> = {}) =>
  new Combatant('t', { maxHealth: 100, maxPoise: 40, poiseRegenPerSec: 10, ...o });

describe('resolveHit', () => {
  it('applies damage once per swing instance', () => {
    const t = fighter();
    expect(resolveHit(t, hit(1), { now: 0, stamina: 0, fromFront: true }).outcome.result).toBe('hit');
    expect(resolveHit(t, hit(1), { now: 0, stamina: 0, fromFront: true }).outcome.result).toBe('ignored');
    expect(t.health).toBe(80);
  });

  it('dodge i-frames evade', () => {
    const t = fighter();
    t.invulnerable = 0.2;
    expect(resolveHit(t, hit(2), { now: 0, stamina: 0, fromFront: true }).outcome.result).toBe('evaded');
    expect(t.health).toBe(100);
  });

  it('a block pressed within the parry window is a perfect parry; later is a block that costs stamina', () => {
    const t = fighter();
    t.blocking = true;
    t.blockPressedAt = 10 - combatConfig.block.parryWindow / 2;
    expect(resolveHit(t, hit(3), { now: 10, stamina: 100, fromFront: true }).outcome.result).toBe('parried');
    t.blockPressedAt = 5;
    const r = resolveHit(t, hit(4), { now: 10, stamina: 100, fromFront: true });
    expect(r.outcome).toMatchObject({ result: 'blocked', guardBroken: false });
    expect(r.staminaCost).toBeGreaterThan(0);
    expect(t.health).toBe(100 - Math.round(20 * combatConfig.block.damageFactor));
  });

  it('blocking does nothing against attacks from behind, and runs out into a guard break', () => {
    const t = fighter();
    t.blocking = true;
    t.blockPressedAt = -10;
    expect(resolveHit(t, hit(5), { now: 0, stamina: 100, fromFront: false }).outcome.result).toBe('hit');
    t.setState('normal'); // recovered from the flinch
    t.blocking = true;
    const r = resolveHit(t, hit(6), { now: 0, stamina: 1, fromFront: true });
    expect(r.outcome).toMatchObject({ result: 'blocked', guardBroken: true });
    expect(t.state).toBe('staggered');
  });

  it('breaking poise makes the target vulnerable (finisher window), knockdown hits knock down', () => {
    const t = fighter({ maxPoise: 30 });
    const r = resolveHit(t, hit(7, { poise: 35, damage: 5 }), { now: 0, stamina: 0, fromFront: true });
    expect(r.outcome).toMatchObject({ result: 'hit', vulnerable: true });
    expect(t.state).toBe('vulnerable');
    const k = fighter();
    expect(resolveHit(k, hit(8, { poise: 5, knockdown: true }), { now: 0, stamina: 0, fromFront: true }).outcome).toMatchObject({ knockedDown: true });
  });

  it('super armor ignores flinches but still loses poise', () => {
    const t = fighter({ superArmor: true, maxPoise: 100 });
    const r = resolveHit(t, hit(9, { poise: 50 }), { now: 0, stamina: 0, fromFront: true });
    expect(r.outcome).toMatchObject({ staggered: false });
    expect(t.state).toBe('normal');
    expect(t.poise).toBe(50);
  });

  it('kills, and lets a death-prevention hook (Guardian\'s Embrace) cancel a lethal direct hit but not damage over time', () => {
    const t = fighter();
    t.health = 10;
    let asked = 0;
    const prevent = () => (++asked, true);
    expect(resolveHit(t, hit(10), { now: 0, stamina: 0, fromFront: true, preventDeath: prevent }).outcome).toMatchObject({ lethal: true, killed: false });
    expect(t.health).toBe(10);
    expect(resolveHit(t, hit(11, { kind: 'dot' }), { now: 0, stamina: 0, fromFront: true, preventDeath: prevent }).outcome).toMatchObject({ killed: true });
    expect(asked).toBe(1);
    expect(t.alive).toBe(false);
  });

  it('vulnerable targets recover with full poise', () => {
    const t = fighter();
    t.poise = 0;
    t.setState('vulnerable', 0.5);
    t.tick(0.6);
    expect(t.state).toBe('normal');
    expect(t.poise).toBe(40);
  });
});

describe('geometry helpers', () => {
  it('inArc respects reach and angle', () => {
    const a = { x: 0, z: 0, facing: 0 }; // facing +Z
    expect(inArc(a, { x: 0, z: 2, radius: 0.4 }, 2.2, 60)).toBe(true);
    expect(inArc(a, { x: 0, z: 3, radius: 0.4 }, 2.2, 60)).toBe(false);
    expect(inArc(a, { x: 2, z: 0.2, radius: 0.4 }, 2.5, 60)).toBe(false);
    expect(inArc(a, { x: 0, z: -2, radius: 0.4 }, 2.5, 60)).toBe(false);
  });
  it('isInFront', () => {
    expect(isInFront({ x: 0, z: 0, facing: 0 }, { x: 0, z: 5 })).toBe(true);
    expect(isInFront({ x: 0, z: 0, facing: 0 }, { x: 0, z: -5 })).toBe(false);
  });
});

describe('AttackTokens', () => {
  it('limits simultaneous attackers and expires stale tokens', () => {
    const t = new AttackTokens(1, 2);
    expect(t.request('a', 0)).toBe(true);
    expect(t.request('b', 0.5)).toBe(false);
    t.release('a');
    expect(t.request('b', 0.6)).toBe(true);
    expect(t.request('c', 3)).toBe(true); // b expired
  });
});
