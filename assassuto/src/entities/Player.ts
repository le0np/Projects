import * as THREE from 'three';
import type { CharacterView, LocomotionState } from '../animation/CharacterView';
import { playerConfig } from '../config/player';
import type { EventBus, GameEvents } from '../core/EventBus';
import { angleDelta, damp } from '../core/math';
import type { InputManager } from '../input/InputManager';
import { CharacterMotor, type CollisionWorld } from '../physics/CharacterMotor';
import { Stamina } from './Stamina';

/** The protagonist: reads input, drives the motor (logic) and the view (render). */
export class Player {
  readonly motor = new CharacterMotor();
  readonly stamina = new Stamina();
  facing = 0;
  sprinting = false;
  private landing = 0;
  private prev = new THREE.Vector3();
  private curr = new THREE.Vector3();
  readonly renderPosition = new THREE.Vector3();

  constructor(
    public view: CharacterView,
    private readonly bus: EventBus<GameEvents>,
  ) {}

  spawn(p: THREE.Vector3, facing = 0): void {
    this.motor.teleport(p.x, p.y, p.z);
    this.facing = facing;
    this.prev.copy(p);
    this.curr.copy(p);
    this.renderPosition.copy(p);
  }

  /** Fixed-step logic. `camForward` is the camera's horizontal forward vector. */
  step(dt: number, input: InputManager, camForward: { x: number; z: number }, world: CollisionWorld): void {
    const cfg = playerConfig;
    const f = (input.isDown('moveForward') ? 1 : 0) - (input.isDown('moveBack') ? 1 : 0);
    const r = (input.isDown('moveRight') ? 1 : 0) - (input.isDown('moveLeft') ? 1 : 0);
    // Camera right = forward rotated -90 degrees around Y.
    let mx = camForward.x * f - camForward.z * r;
    let mz = camForward.z * f + camForward.x * r;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
    }
    const moving = len > 0;
    const wantSprint = moving && input.isDown('sprint') && this.motor.grounded;
    this.sprinting = wantSprint && this.stamina.canSprint();
    const speed = input.isDown('walk') ? cfg.walkSpeed : this.sprinting ? cfg.sprintSpeed : cfg.runSpeed;

    let jump = input.wasPressed('jump');
    if (jump && this.motor.grounded && !this.stamina.spend(cfg.stamina.jumpCost)) jump = false;

    this.stamina.tick(dt, this.sprinting);
    this.prev.copy(this.curr);
    const events = this.motor.step(dt, { moveX: mx, moveZ: mz, speed, jump }, world);
    for (const e of events) {
      if (e.type === 'jumped') this.bus.emit('playerJumped', {});
      else {
        this.landing = Math.min(1, Math.max(this.landing, (e.fallSpeed - 6) / 14));
        this.bus.emit('playerLanded', { fallSpeed: e.fallSpeed });
      }
    }
    this.curr.set(this.motor.x, this.motor.y, this.motor.z);

    if (moving) {
      const target = Math.atan2(mx, mz);
      this.facing += angleDelta(this.facing, target) * damp(cfg.turnRate * (this.motor.grounded ? 1 : 0.35), dt);
    }
  }

  /** Per-frame render update with interpolation between logic steps. */
  render(dt: number, alpha: number): void {
    this.renderPosition.lerpVectors(this.prev, this.curr, alpha);
    this.view.object.position.copy(this.renderPosition);
    this.view.object.rotation.y = this.facing;
    this.landing = Math.max(0, this.landing - dt * 3.5);
    const state: LocomotionState = {
      grounded: this.motor.grounded,
      speed: this.motor.horizontalSpeed,
      vy: this.motor.vy,
      sprinting: this.sprinting,
      landing: this.landing,
    };
    this.view.update(dt, state);
  }

  replaceView(view: CharacterView): void {
    const parent = this.view.object.parent;
    this.view.dispose();
    this.view = view;
    parent?.add(view.object);
  }
}
