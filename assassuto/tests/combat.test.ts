import { describe, expect, it } from 'vitest';
import { AttackTokens } from '../src/ai/AttackTokens';
import { AttackRunner } from '../src/combat/AttackRunner';
import { Combatant } from '../src/combat/Combatant';
import { InputBuffer } from '../src/combat/InputBuffer';
import { inArc, isInFront, resolveHit, type HitInfo } from '../src/combat/resolveHit';
import { armedClips, combatConfig, fists, sword, unarmedClips, weaponOrder, weapons } from '../src/config/combat';
import { rng } from '../src/core/math';
import { makePlayer } from './fixtures/playerHarness';

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

const neutral = { airborne: false, counterReady: false };

describe('AttackRunner (randomised combo strings)', () => {
  it('starts a combo string from neutral, the air attack in the air and the counter after a parry', () => {
    const r = new AttackRunner(sword, rng(1));
    const l = r.resolve('light', neutral)!;
    expect(sword.combos.light.map((c) => c[0])).toContain(l.id);
    expect(l.combo?.index).toBe(0);
    expect(sword.combos.heavy.map((c) => c[0])).toContain(r.resolve('heavy', neutral)!.id);
    expect(r.resolve('light', { airborne: true, counterReady: false })!.id).toBe('sw_air');
    expect(r.resolve('light', { airborne: false, counterReady: true })!.id).toBe('sw_counter');
  });

  it('resolve does not change state; the same press resolves the same way until it starts', () => {
    const r = new AttackRunner(fists, rng(7));
    const a = r.resolve('light', neutral)!;
    for (let i = 0; i < 5; i++) expect(r.resolve('light', neutral)).toEqual(a);
  });

  it('walks a string press by press, only inside the combo window', () => {
    const r = new AttackRunner(fists, rng(3));
    const first = r.resolve('light', neutral)!;
    const moves = first.combo!.moves;
    r.start(first);
    step(r, 0.02);
    expect(r.resolve('light', neutral)).toBeNull(); // too early
    for (let i = 1; i < moves.length; i++) {
      const def = fists.attacks[moves[i - 1]];
      step(r, def.comboWindow[0] - r.current!.t + 0.01);
      const next = r.resolve('light', neutral)!;
      expect(next.id).toBe(moves[i]);
      r.start(next);
    }
    expect(r.current!.ender).toBe(true);
    expect(r.chain).toBe(moves.length);
  });

  it('never picks the same string twice in a row, and uses every string over time', () => {
    for (const w of Object.values(weapons)) {
      for (const input of ['light', 'heavy'] as const) {
        const r = new AttackRunner(w, rng(11));
        const seen = new Set<number>();
        let last = -1;
        for (let i = 0; i < 60; i++) {
          const p = r.resolve(input, neutral)!;
          expect(p.combo!.pick, `${w.id} ${input}`).not.toBe(last);
          last = p.combo!.pick;
          seen.add(last);
          r.start(p);
          r.cancel();
        }
        expect(seen.size, `${w.id} ${input}`).toBe(w.combos[input].length);
      }
    }
  });

  it('the other button mid-string chains into one of its strings', () => {
    const r = new AttackRunner(fists, rng(5));
    r.start(r.resolve('light', neutral)!);
    step(r, 0.2);
    const k = r.resolve('heavy', neutral)!;
    expect(fists.combos.heavy.map((c) => c[0])).toContain(k.id);
  });

  it('opens and closes the hit window exactly once and finishes after its duration', () => {
    const r = new AttackRunner(sword);
    r.start('sw_over');
    const ev = step(r, sword.attacks.sw_over.duration + 0.05);
    expect(ev).toEqual({ opened: 1, closed: 1, finished: 1 });
    expect(r.busy).toBe(false);
  });

  it('gives every swing a unique instance id', () => {
    const r = new AttackRunner(sword);
    const a = r.start('sw_diag_l').instance;
    const b = r.start('sw_diag_r').instance;
    expect(a).not.toBe(b);
  });

  it('every weapon has five strings per button, all moves exist and have sane timings', () => {
    for (const w of Object.values(weapons)) {
      for (const input of ['light', 'heavy'] as const) {
        expect(w.combos[input].length, `${w.id} ${input}`).toBeGreaterThanOrEqual(5);
        for (const c of w.combos[input]) for (const id of c) expect(w.attacks[id], `${w.id}:${id}`).toBeDefined();
      }
      for (const id of [w.air, w.counter, w.finisher]) expect(w.attacks[id], `${w.id}:${id}`).toBeDefined();
      for (const a of Object.values(w.attacks)) {
        expect(a.hitStart).toBeLessThan(a.hitEnd);
        expect(a.hitEnd).toBeLessThanOrEqual(a.duration);
        if (a.id !== w.finisher) expect(a.comboWindow[0]).toBeLessThanOrEqual(a.duration);
      }
    }
  });

  it('unarmed: LMB strings are punches (jabs, crosses, hooks, uppercuts), RMB strings are kicks', () => {
    const punch = new Set(fists.combos.light.flat());
    const kick = new Set(fists.combos.heavy.flat());
    for (const id of punch) expect(fists.attacks[id].clip, id).toMatch(/^box_0[12](_m)?$/);
    for (const id of kick) expect(['front_kick_01', 'front_kick_01_m', 'flip', 'stance'], id).toContain(fists.attacks[id].clip);
    const ids = [...punch].join(' ');
    for (const kind of ['jab', 'cross', 'hook', 'upper']) expect(ids).toContain(kind);
  });
});

describe('weapon styles', () => {
  it('armed styles only swing the weapon; punches and kicks are unarmed only', () => {
    for (const w of Object.values(weapons)) {
      const allowed = w.id === 'fists' ? unarmedClips : armedClips;
      for (const a of Object.values(w.attacks)) expect(allowed, `${w.id}:${a.id} uses ${a.clip}`).toContain(a.clip);
    }
  });

  it('keys 1-3 are unarmed, sword, spear', () => {
    expect(weaponOrder).toEqual(['fists', 'sword', 'spear']);
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

  it('timing decides: a press just before the hit parries even as a tap; holding earlier only blocks', () => {
    const t = fighter();
    // Tap: not holding block when the hit lands, but pressed inside the window.
    t.blocking = false;
    t.blockPressedAt = 10 - combatConfig.block.parryWindow / 2;
    expect(resolveHit(t, hit(30), { now: 10, stamina: 100, fromFront: true }).outcome.result).toBe('parried');
    // Tap too early, not holding: the hit lands.
    t.blockPressedAt = 9;
    expect(resolveHit(t, hit(31), { now: 10, stamina: 100, fromFront: true }).outcome.result).toBe('hit');
    t.health = 100;
    // Parry never works from behind or against unblockable attacks.
    t.blockPressedAt = 20;
    expect(resolveHit(t, hit(32), { now: 20.05, stamina: 100, fromFront: false }).outcome.result).toBe('hit');
    expect(resolveHit(t, hit(33, { unblockable: true }), { now: 20.05, stamina: 100, fromFront: true }).outcome.result).toBe('hit');
  });

  it('a held block pressed within the parry window also parries; later it is a block that costs stamina', () => {
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

describe('Player parry and automatic counter', () => {
  it('mashing Q does not parry: a press that parries nothing locks parrying briefly', () => {
    const h = makePlayer('sword');
    h.input.press('block');
    h.step();
    const first = h.p.combatant.blockPressedAt;
    expect(first).toBeCloseTo(h.now, 5);
    h.step(6);
    h.input.press('block');
    h.step();
    expect(h.p.combatant.blockPressedAt).toBe(first); // locked
    h.step(Math.ceil(combatConfig.block.parryCooldown * 60));
    h.input.press('block');
    h.step();
    expect(h.p.combatant.blockPressedAt).toBeGreaterThan(first);
  });

  it('a parry makes the fighter counter-attack the attacker on their own', () => {
    const h = makePlayer('fists');
    h.p.autoCounter({ x: 0, z: 2 });
    expect(h.p.runner.current?.def.id).toBe('fi_counter');
    expect(h.p.facing).toBeCloseTo(0, 5);
    expect(h.view.played.at(-1)).toBe(fists.attacks.fi_counter.clip);
    expect(h.p.parryLockUntil).toBe(-Infinity);
  });

  it('keys 1, 2 and 3 select unarmed, sword and spear', () => {
    const h = makePlayer('sword');
    for (const [key, id] of [['weapon1', 'fists'], ['weapon2', 'sword'], ['weapon3', 'spear']] as const) {
      h.input.press(key);
      h.step();
      expect(h.p.weapon.id).toBe(id);
    }
  });
});
