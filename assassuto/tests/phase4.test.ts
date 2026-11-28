import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AbilityState } from '../src/combat/Abilities';
import { Combatant } from '../src/combat/Combatant';
import { aimVelocity, Projectiles } from '../src/combat/Projectiles';
import { resolveHit } from '../src/combat/resolveHit';
import { StatusEffects } from '../src/combat/Status';
import { abilities, abilityConfig } from '../src/config/abilities';
import { campRoster, enemyDefs } from '../src/config/enemies';
import { AttackTokens } from '../src/ai/AttackTokens';
import type { CharacterView } from '../src/animation/CharacterView';
import { Enemy } from '../src/entities/Enemy';
import { newSave, sanitizeSave } from '../src/save/SaveSchema';
import { defaultAppearance } from '../src/entities/appearance';
import type { CollisionWorld } from '../src/physics/CharacterMotor';

describe('AbilityState', () => {
  it('starts with the character element unlocked and selected', () => {
    const a = new AbilityState('water');
    expect(a.list).toEqual(['water']);
    expect(a.selected).toBe('water');
    expect(a.tryCast('fire')).toEqual({ ok: false, reason: 'locked' });
  });

  it('casts, then refuses until the cooldown has run out; affinity shortens it and adds damage', () => {
    const a = new AbilityState('fire', ['fire', 'air']);
    const r = a.tryCast('fire');
    expect(r.ok && r.damageScale).toBe(abilityConfig.affinity.damage);
    expect(a.tryCast('fire')).toEqual({ ok: false, reason: 'cooldown' });
    const cd = abilities.fire.cooldown * abilityConfig.affinity.cooldown;
    expect(a.cooldownOf('fire')).toBeCloseTo(cd);
    a.tick(cd - 0.01);
    expect(a.tryCast('fire').ok).toBe(false);
    a.tick(0.02);
    expect(a.tryCast('fire').ok).toBe(true);
    const air = a.tryCast('air');
    expect(air.ok && air.damageScale).toBe(1);
    // Gale Rush has two charges: the cooldown starts with the second.
    expect(a.cooldownOf('air')).toBe(0);
    a.tryCast('air');
    expect(a.cooldownOf('air')).toBeCloseTo(abilities.air.cooldown);
  });

  it('cycles through unlocked elements in fixed order and ignores locked selection', () => {
    const a = new AbilityState('earth', ['air', 'fire'], 'water');
    expect(a.selected).toBe('earth');
    expect(a.list).toEqual(['fire', 'earth', 'air']);
    expect(a.cycle()).toBe('air');
    expect(a.cycle()).toBe('fire');
    expect(a.cycle(-1)).toBe('air');
    expect(a.unlock('water')).toBe(true);
    expect(a.unlock('water')).toBe(false);
  });

  it('round-trips cooldowns through the save format and clamps bad values', () => {
    const a = new AbilityState('air');
    a.tryCast('air');
    a.tick(1);
    const saved = a.toSave();
    const b = new AbilityState('air');
    b.loadCooldowns(saved);
    expect(b.cooldownOf('air')).toBeCloseTo(a.cooldownOf('air'), 2);
    b.loadCooldowns({ 'ability.air': 99999, 'ability.fire': -5 });
    expect(b.cooldownOf('air')).toBeCloseTo(b.maxCooldown('air'));
    expect(b.cooldownOf('fire')).toBe(0);
  });
});

describe('StatusEffects', () => {
  it('burn deals its total damage in ticks and then stops', () => {
    const s = new StatusEffects();
    s.burn(5, 4);
    let total = 0;
    for (let t = 0; t < 6; t += 1 / 60) total += s.tick(1 / 60);
    expect(total).toBe(20);
    expect(s.burning).toBe(false);
  });

  it('soak slows to the strongest slow and wears off', () => {
    const s = new StatusEffects();
    s.soak(0.5, 2);
    s.soak(0.7, 1);
    expect(s.speed).toBe(0.5);
    for (let t = 0; t < 2.1; t += 0.1) s.tick(0.1);
    expect(s.speed).toBe(1);
  });
});

describe('Projectiles', () => {
  const flat = () => 0;

  it('aimVelocity lands on the target despite gravity', () => {
    const from = { x: 0, y: 1.5, z: 0 };
    const to = { x: 0, y: 1.1, z: 14 };
    const v = aimVelocity(from, to, 24, 6);
    const p = new Projectiles();
    p.spawn({ instance: 1, owner: 'a', team: 'enemy', ...from, ...v, gravity: 6, life: 3, damage: 10, poise: 5, knockback: 1 });
    const hits = p.step(2, flat, [{ id: 'player', team: 'player', x: 0, y: 0, z: 14, radius: 0.5, height: 1.8 }]);
    expect(hits.map((h) => h.target.id)).toEqual(['player']);
  });

  it('never hits its own side, stops at the ground and is pruned', () => {
    const p = new Projectiles();
    p.spawn({ instance: 2, owner: 'a', team: 'enemy', x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 30, gravity: 9.8, life: 3, damage: 10, poise: 5, knockback: 1 });
    const hits = p.step(1, flat, [{ id: 'b', team: 'enemy', x: 0, y: 0, z: 3, radius: 0.5, height: 1.8 }]);
    expect(hits).toHaveLength(0);
    expect(p.prune()).toHaveLength(1);
    expect(p.list).toHaveLength(0);
  });

  it('does not tunnel through a thin target at high speed, and a reflected arrow switches sides', () => {
    const p = new Projectiles();
    const arrow = p.spawn({ instance: 3, owner: 'archer', team: 'enemy', x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 60, gravity: 0, life: 3, damage: 10, poise: 5, knockback: 1 });
    const hit = p.step(0.1, flat, [{ id: 'player', team: 'player', x: 0, y: 0, z: 3, radius: 0.3, height: 1.8 }]);
    expect(hit).toHaveLength(1);
    p.reflect(arrow, 'player', { x: 0, y: 1, z: -10 });
    expect(arrow.team).toBe('player');
    expect(arrow.dead).toBe(false);
    expect(arrow.vz).toBeLessThan(0);
    const back = p.step(0.5, flat, [
      { id: 'player', team: 'player', x: 0, y: 0, z: 0, radius: 0.3, height: 1.8 },
      { id: 'archer', team: 'enemy', x: 0, y: 0, z: -10, radius: 0.5, height: 1.8 },
    ]);
    expect(back.map((h) => h.target.id)).toEqual(['archer']);
  });
});

describe('Stone Aegis and heavy enemies in resolveHit', () => {
  const fighter = () => new Combatant('p', { maxHealth: 100, maxPoise: 40, poiseRegenPerSec: 10 });

  it('armour halves damage and prevents stagger and knockdown', () => {
    const c = fighter();
    c.armored = true;
    c.damageTaken = abilities.earth.kind === 'aegis' ? abilities.earth.damageTaken : 0.5;
    const { outcome } = resolveHit(c, { instance: 1, damage: 40, poise: 100, knockback: 5, knockdown: true, kind: 'melee' }, { now: 0, stamina: 0, fromFront: true });
    expect(outcome).toMatchObject({ result: 'hit', damage: 20, staggered: false, knockedDown: false, vulnerable: false });
    expect(c.state).toBe('normal');
    expect(c.poise).toBe(40);
  });

  it('burn (dot) never staggers, unblockable hits go through a block', () => {
    const c = fighter();
    const dot = resolveHit(c, { instance: 2, damage: 15, poise: 15, knockback: 0, kind: 'dot' }, { now: 0, stamina: 0, fromFront: true });
    expect(dot.outcome).toMatchObject({ result: 'hit', staggered: false });
    c.blocking = true;
    c.blockPressedAt = -10;
    const slam = resolveHit(c, { instance: 3, damage: 20, poise: 5, knockback: 5, kind: 'melee', unblockable: true }, { now: 0, stamina: 100, fromFront: true });
    expect(slam.outcome.result).toBe('hit');
  });

  it('a brute with super armour keeps swinging until its poise breaks', () => {
    const b = enemyDefs.brute;
    const c = new Combatant('b', { maxHealth: b.maxHealth, maxPoise: b.maxPoise, poiseRegenPerSec: b.poiseRegenPerSec, superArmor: b.superArmor });
    let i = 10;
    for (; i < 30 && c.state === 'normal'; i++) resolveHit(c, { instance: i, damage: 10, poise: 40, knockback: 5, knockdown: true, kind: 'melee' }, { now: 0, stamina: 0, fromFront: true });
    expect(c.state).toBe('vulnerable');
    expect(i - 10).toBe(Math.ceil(b.maxPoise / 40));
  });
});

describe('enemy archetypes', () => {
  it('the camp roster has a raider, an archer and a brute with sane attacks', () => {
    expect(new Set(campRoster)).toEqual(new Set(['raider', 'archer', 'brute']));
    for (const d of Object.values(enemyDefs)) {
      for (const a of d.attacks) {
        expect(a.hitStart, `${d.id}:${a.id}`).toBeLessThan(a.hitEnd);
        expect(a.hitEnd).toBeLessThanOrEqual(a.duration);
        expect(a.hitStart, 'telegraph needs time').toBeGreaterThanOrEqual(0.35);
      }
    }
    expect(enemyDefs.archer.attacks.every((a) => a.projectile)).toBe(true);
    expect(enemyDefs.brute.superArmor).toBe(true);
    expect(enemyDefs.brute.attacks.some((a) => a.unblockable && a.aoe)).toBe(true);
  });

  const stubView = (): CharacterView => ({
    object: new THREE.Group(),
    source: 'placeholder',
    update() {},
    playAction: () => true,
    stopAction() {},
    hasClip: () => true,
    weaponSocket: new THREE.Group(),
    dispose() {},
  });
  const openWorld: CollisionWorld = { heightAt: () => 0, collidersNear: () => [], boundsRadius: 1000 };

  function run(e: Enemy, player: { x: number; z: number }, seconds: number) {
    const tokens = new AttackTokens(1, 2);
    const shooters = new AttackTokens(1, 2);
    let fired = false;
    for (let t = 0; t < seconds; t += 1 / 60) {
      e.step(1 / 60, { now: t, player: { ...player, alive: true }, tokens, shooters, world: openWorld });
      if (e.readyToFire) {
        fired = true;
        e.attack!.fired = true;
      }
    }
    return fired;
  }

  it('an archer keeps its distance, rolls away when rushed and shoots', () => {
    const e = new Enemy(enemyDefs.archer, stubView(), { x: 0, y: 0, z: 0 });
    const fired = run(e, { x: 0, z: 12 }, 8);
    expect(fired).toBe(true);
    const rushed = new Enemy(enemyDefs.archer, stubView(), { x: 0, y: 0, z: 0 });
    run(rushed, { x: 0, z: 12 }, 2);
    const before = Math.hypot(rushed.motor.x, rushed.motor.z - 3);
    run(rushed, { x: 0, z: 3 }, 1.5);
    const after = Math.hypot(rushed.motor.x, rushed.motor.z - 3);
    expect(after).toBeGreaterThan(before);
  });

  it('a soaked enemy moves at reduced speed', () => {
    const a = new Enemy(enemyDefs.raider, stubView(), { x: 0, y: 0, z: 0 });
    const b = new Enemy(enemyDefs.raider, stubView(), { x: 0, y: 0, z: 0 });
    b.status.soak(0.5, 10);
    run(a, { x: 0, z: 18 }, 2);
    run(b, { x: 0, z: 18 }, 2);
    expect(b.motor.z).toBeLessThan(a.motor.z * 0.8);
  });
});

describe('save: abilities', () => {
  it('keeps the selected ability only if it is unlocked', () => {
    const s = newSave({ name: 'Aria', element: 'water', appearance: defaultAppearance }, newSave({ name: 'x', element: 'water', appearance: defaultAppearance }, {} as never, 'glacemere').echo, 'glacemere');
    expect(s.equipment.ability).toBe('water');
    const raw = JSON.parse(JSON.stringify(s));
    raw.equipment.ability = 'fire';
    expect(sanitizeSave(raw).equipment.ability).toBe('water');
    raw.progression.unlockedElements = ['water', 'fire'];
    expect(sanitizeSave(raw).equipment.ability).toBe('fire');
    delete raw.equipment.ability;
    expect(sanitizeSave(raw).equipment.ability).toBe('water');
  });
});
