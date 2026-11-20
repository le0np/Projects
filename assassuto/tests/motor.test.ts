import { describe, expect, it } from 'vitest';
import { CharacterMotor, type CollisionWorld, type CylinderCollider } from '../src/physics/CharacterMotor';

function flatWorld(colliders: CylinderCollider[] = [], height = (_x: number, _z: number) => 0): CollisionWorld {
  return {
    heightAt: height,
    gradientAt: (x, z) => {
      const e = 0.01;
      return [(height(x + e, z) - height(x - e, z)) / (2 * e), (height(x, z + e) - height(x, z - e)) / (2 * e)];
    },
    collidersNear: () => colliders,
    boundsRadius: 1000,
  };
}

const idle = { moveX: 0, moveZ: 0, speed: 0, jump: false };
const dt = 1 / 60;

describe('CharacterMotor', () => {
  it('accelerates toward the wish velocity and stops when input is released', () => {
    const m = new CharacterMotor();
    const w = flatWorld();
    for (let i = 0; i < 60; i++) m.step(dt, { moveX: 1, moveZ: 0, speed: 5, jump: false }, w);
    expect(m.vx).toBeCloseTo(5, 3);
    expect(m.x).toBeGreaterThan(4);
    for (let i = 0; i < 60; i++) m.step(dt, idle, w);
    expect(m.horizontalSpeed).toBe(0);
  });

  it('jumps, reaches the expected apex and lands again', () => {
    const m = new CharacterMotor();
    const w = flatWorld();
    const events = m.step(dt, { ...idle, jump: true }, w);
    expect(events).toContainEqual({ type: 'jumped' });
    expect(m.grounded).toBe(false);
    let apex = 0;
    let landed = false;
    for (let i = 0; i < 120 && !landed; i++) {
      const ev = m.step(dt, idle, w);
      apex = Math.max(apex, m.y);
      landed = ev.some((e) => e.type === 'landed');
    }
    expect(landed).toBe(true);
    expect(m.grounded).toBe(true);
    expect(apex).toBeGreaterThan(1.4);
    expect(apex).toBeLessThan(1.8);
  });

  it('buffers a jump pressed just before landing', () => {
    const m = new CharacterMotor();
    const w = flatWorld();
    m.step(dt, { ...idle, jump: true }, w);
    while (m.vy > -8) m.step(dt, idle, w);
    // Press jump while still in the air, a few frames before touching down.
    m.step(dt, { ...idle, jump: true }, w);
    let jumpedAgain = false;
    for (let i = 0; i < 20 && !jumpedAgain; i++) jumpedAgain = m.step(dt, idle, w).some((e) => e.type === 'jumped');
    expect(jumpedAgain).toBe(true);
  });

  it('is pushed out of cylinder colliders', () => {
    const m = new CharacterMotor();
    const w = flatWorld([{ x: 2, z: 0, radius: 1, bottom: -1, top: 5 }]);
    for (let i = 0; i < 120; i++) m.step(dt, { moveX: 1, moveZ: 0, speed: 5, jump: false }, w);
    expect(m.x).toBeLessThanOrEqual(2 - 1 - 0.4 + 1e-6);
  });

  it('cannot walk up slopes steeper than the limit', () => {
    const steep = (x: number) => (x > 3 ? (x - 3) * 2 : 0);
    const m = new CharacterMotor();
    const w = flatWorld([], (x) => steep(x));
    for (let i = 0; i < 180; i++) m.step(dt, { moveX: 1, moveZ: 0, speed: 5, jump: false }, w);
    expect(m.x).toBeLessThan(3.5);
  });

  it('keeps the player inside the bounds radius', () => {
    const m = new CharacterMotor();
    const w = { ...flatWorld(), boundsRadius: 10 };
    for (let i = 0; i < 300; i++) m.step(dt, { moveX: 1, moveZ: 0, speed: 8, jump: false }, w);
    expect(Math.hypot(m.x, m.z)).toBeLessThanOrEqual(10 + 1e-6);
  });
});
