import * as THREE from 'three';
import type { CharacterView } from '../../src/animation/CharacterView';
import { EventBus, type GameEvents } from '../../src/core/EventBus';
import type { Action } from '../../src/input/actions';
import type { InputManager } from '../../src/input/InputManager';
import type { CollisionWorld } from '../../src/physics/CharacterMotor';
import { Player, type PlayerStepContext } from '../../src/entities/Player';
import type { ElementId } from '../../src/config/elements';

/** A view that records which actions were played. */
export function stubView(): CharacterView & { played: string[] } {
  const played: string[] = [];
  return {
    object: new THREE.Group(),
    source: 'placeholder',
    weaponSocket: new THREE.Group(),
    played,
    update() {},
    playAction(clip: string) {
      played.push(clip);
      return true;
    },
    stopAction() {},
    hasClip: () => true,
    dispose() {},
  };
}

/** Input whose presses last exactly one step. */
export class StubInput {
  private down = new Set<Action>();
  private pressed = new Set<Action>();
  press(a: Action): void {
    this.pressed.add(a);
    this.down.add(a);
  }
  hold(a: Action, on = true): void {
    if (on) this.down.add(a);
    else this.down.delete(a);
  }
  release(a: Action): void {
    this.down.delete(a);
  }
  wasPressed(a: Action): boolean {
    return this.pressed.has(a);
  }
  isDown(a: Action): boolean {
    return this.down.has(a);
  }
  endStep(): void {
    for (const a of this.pressed) if (a !== 'jump' || !this.down.has(a)) this.down.delete(a);
    this.pressed.clear();
  }
  asInput(): InputManager {
    return this as unknown as InputManager;
  }
}

export const flat: CollisionWorld = { heightAt: () => 0, collidersNear: () => [], boundsRadius: 1000 };

export function makePlayer(weapon = 'sword', element: ElementId = 'earth', unlocked: ElementId[] = [element]) {
  const bus = new EventBus<GameEvents>();
  const view = stubView();
  const p = new Player(view, bus, weapon, element, unlocked);
  p.spawn(new THREE.Vector3(0, 0, 0));
  const input = new StubInput();
  let now = 0;
  const dt = 1 / 60;
  const ctx = (): PlayerStepContext => ({ now, camForward: { x: 0, z: 1 }, world: flat, lockTarget: null, targets: [] });
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      now += dt;
      p.step(dt, input.asInput(), ctx());
      input.endStep();
    }
  };
  return { p, input, step, view, bus, get now() { return now; }, dt };
}
