import * as THREE from 'three';
import type { CharacterView, LocomotionState } from '../animation/CharacterView';
import { AttackRunner } from '../combat/AttackRunner';
import { Combatant } from '../combat/Combatant';
import { InputBuffer } from '../combat/InputBuffer';
import { combatConfig, weapons, type AttackInput, type WeaponDef } from '../config/combat';
import { playerConfig } from '../config/player';
import type { EventBus, GameEvents } from '../core/EventBus';
import { angleDelta, damp } from '../core/math';
import type { InputManager } from '../input/InputManager';
import { CharacterMotor, type CollisionWorld } from '../physics/CharacterMotor';
import { Stamina } from './Stamina';

/** Something the player can aim at (enemies). */
export interface Targetable {
  readonly id: string;
  position(): { x: number; z: number };
  readonly alive: boolean;
}

export interface PlayerStepContext {
  now: number;
  camForward: { x: number; z: number };
  world: CollisionWorld;
  /** Current lock-on target, if any. */
  lockTarget: Targetable | null;
  /** Candidates for aim assist. */
  targets: Targetable[];
}

/** The protagonist: reads input, drives the motor (logic), combat state and the view (render). */
export class Player {
  readonly motor = new CharacterMotor();
  readonly stamina = new Stamina();
  readonly combatant = new Combatant('player', {
    maxHealth: combatConfig.player.maxHealth,
    maxPoise: combatConfig.player.maxPoise,
    poiseRegenPerSec: combatConfig.player.poiseRegenPerSec,
    poiseRegenDelay: combatConfig.player.poiseRegenDelay,
  });
  readonly runner: AttackRunner;
  private buffer = new InputBuffer<AttackInput>(combatConfig.inputBuffer);
  facing = 0;
  sprinting = false;
  /** Seconds into the current dodge, or -1. */
  dodgeT = -1;
  private dodgeDir = { x: 0, z: 1 };
  private dodgeCooldown = 0;
  /** Game time until which a light attack becomes a counter (after a perfect parry). */
  counterUntil = -Infinity;
  private landing = 0;
  private prev = new THREE.Vector3();
  private curr = new THREE.Vector3();
  readonly renderPosition = new THREE.Vector3();
  /** Set while a scripted move (finisher) controls the player. */
  scripted = false;

  constructor(
    public view: CharacterView,
    private readonly bus: EventBus<GameEvents>,
    weaponId = 'sword',
  ) {
    this.runner = new AttackRunner(weapons[weaponId] ?? weapons.sword);
    if (weaponId !== 'fists' && weapons[weaponId]) this.lastArmed = weaponId;
  }

  get weapon(): WeaponDef {
    return this.runner.weapon;
  }

  /** Last real weapon, restored when the player draws again (X). */
  lastArmed = 'sword';

  get armed(): boolean {
    return this.weapon.id !== 'fists';
  }

  /** Weapon change requested mid-attack; applied as soon as the move ends. */
  private pendingWeapon: string | null = null;

  setWeapon(id: string): void {
    if (!weapons[id]) return;
    if (this.runner.busy) {
      this.pendingWeapon = id;
      return;
    }
    this.pendingWeapon = null;
    if (id !== 'fists') this.lastArmed = id;
    this.runner.weapon = weapons[id];
    this.buffer.clear();
  }

  /** The weapon the player will hold once any queued change applies (used by the X toggle). */
  private get intendedWeapon(): string {
    return this.pendingWeapon ?? this.weapon.id;
  }

  spawn(p: THREE.Vector3, facing = 0): void {
    this.motor.teleport(p.x, p.y, p.z);
    this.facing = facing;
    this.prev.copy(p);
    this.curr.copy(p);
    this.renderPosition.copy(p);
  }

  get busy(): boolean {
    return this.runner.busy || this.dodgeT >= 0 || !this.combatant.free;
  }

  /** Fixed-step logic. */
  step(dt: number, input: InputManager, ctx: PlayerStepContext): void {
    const cfg = playerConfig;
    const c = this.combatant;
    c.tick(dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    if (input.wasPressed('attackLight')) this.buffer.push('light', ctx.now);
    if (input.wasPressed('attackHeavy')) this.buffer.push('heavy', ctx.now);
    if (input.wasPressed('weapon1')) this.setWeapon('sword');
    if (input.wasPressed('weapon2')) this.setWeapon('spear');
    if (input.wasPressed('weapon3')) this.setWeapon('fists');
    if (input.wasPressed('sheathe')) this.setWeapon(this.intendedWeapon === 'fists' ? this.lastArmed : 'fists');
    if (this.pendingWeapon && !this.runner.busy) this.setWeapon(this.pendingWeapon);

    const f = (input.isDown('moveForward') ? 1 : 0) - (input.isDown('moveBack') ? 1 : 0);
    const r = (input.isDown('moveRight') ? 1 : 0) - (input.isDown('moveLeft') ? 1 : 0);
    // Camera right = forward rotated -90 degrees around Y.
    let mx = ctx.camForward.x * f - ctx.camForward.z * r;
    let mz = ctx.camForward.z * f + ctx.camForward.x * r;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
    }
    const moving = len > 0;

    // ---- defensive actions (cancel attack recovery)
    const canAct = c.free && !this.scripted;
    if (canAct && input.wasPressed('dodge') && this.dodgeT < 0 && this.dodgeCooldown <= 0 && this.runner.cancelable && this.motor.grounded) {
      if (this.stamina.spend(combatConfig.dodge.stamina)) this.startDodge(moving ? { x: mx, z: mz } : { x: -Math.sin(this.facing), z: -Math.cos(this.facing) });
    }
    if (input.wasPressed('block')) c.blockPressedAt = ctx.now;
    c.blocking = canAct && input.isDown('block') && this.dodgeT < 0 && this.runner.cancelable && this.motor.grounded;
    if (c.blocking && this.runner.busy) {
      this.runner.cancel();
      this.view.stopAction(0.1);
    }

    // ---- attacks
    if (canAct && this.dodgeT < 0 && !c.blocking) {
      const airborne = !this.motor.grounded;
      const counterReady = ctx.now <= this.counterUntil;
      const picked = this.buffer.consume(ctx.now, (i) => this.runner.resolve(i, { airborne, counterReady }) !== null);
      if (picked) {
        const id = this.runner.resolve(picked, { airborne, counterReady })!;
        const def = this.weapon.attacks[id];
        if (this.stamina.spend(def.stamina) || def.stamina === 0) {
          if (id === this.weapon.counter) this.counterUntil = -Infinity;
          this.beginAttack(id, ctx, moving ? Math.atan2(mx, mz) : null);
        }
      }
    }

    // ---- advance attack
    const atk = this.runner.current;
    if (atk) {
      const ev = this.runner.step(dt);
      if (ev.finished) this.view.stopAction(0.2);
    }

    // ---- movement
    let moveX = 0;
    let moveZ = 0;
    let speed = 0;
    let jump = false;
    this.sprinting = false;
    const cur = this.runner.current;
    if (this.dodgeT >= 0) {
      const d = combatConfig.dodge;
      this.dodgeT += dt;
      const k = this.dodgeT / d.duration;
      c.invulnerable = this.dodgeT >= d.iframeStart && this.dodgeT <= d.iframeEnd ? Math.max(c.invulnerable, dt * 1.5) : c.invulnerable;
      moveX = this.dodgeDir.x;
      moveZ = this.dodgeDir.z;
      speed = (d.distance / d.duration) * 1.6 * Math.max(0, 1 - k);
      if (k >= 1) {
        this.dodgeT = -1;
        this.dodgeCooldown = d.cooldown;
      }
    } else if (cur) {
      // Lunge forward during the wind-up.
      if (cur.t < cur.def.hitStart) {
        moveX = Math.sin(this.facing);
        moveZ = Math.cos(this.facing);
        speed = cur.def.lunge / cur.def.hitStart;
      }
    } else if (c.free && !this.scripted) {
      const wantSprint = moving && input.isDown('sprint') && this.motor.grounded && !c.blocking;
      this.sprinting = wantSprint && this.stamina.canSprint();
      speed = input.isDown('walk') || c.blocking ? cfg.walkSpeed : this.sprinting ? cfg.sprintSpeed : cfg.runSpeed;
      moveX = mx;
      moveZ = mz;
      jump = input.wasPressed('jump');
      if (jump && this.motor.grounded && !this.stamina.spend(cfg.stamina.jumpCost)) jump = false;
    }

    this.stamina.tick(dt, this.sprinting, c.blocking);
    this.prev.copy(this.curr);
    const events = this.motor.step(dt, { moveX, moveZ, speed, jump }, ctx.world);
    for (const e of events) {
      if (e.type === 'jumped') this.bus.emit('playerJumped', {});
      else {
        this.landing = Math.min(1, Math.max(this.landing, (e.fallSpeed - 6) / 14));
        this.bus.emit('playerLanded', { fallSpeed: e.fallSpeed });
      }
    }
    this.curr.set(this.motor.x, this.motor.y, this.motor.z);

    // ---- facing
    if (ctx.lockTarget && (c.blocking || this.runner.busy) && ctx.lockTarget.alive) {
      const t = ctx.lockTarget.position();
      this.turnTowards(Math.atan2(t.x - this.motor.x, t.z - this.motor.z), dt, 1.4);
    } else if (moving && !this.runner.busy && this.dodgeT < 0 && c.free) {
      this.turnTowards(Math.atan2(mx, mz), dt, this.motor.grounded ? 1 : 0.35);
    } else if (this.dodgeT >= 0) {
      this.turnTowards(Math.atan2(this.dodgeDir.x, this.dodgeDir.z), dt, 1);
    }
  }

  private turnTowards(target: number, dt: number, rate: number): void {
    this.facing += angleDelta(this.facing, target) * damp(playerConfig.turnRate * rate, dt);
  }

  private startDodge(dir: { x: number; z: number }): void {
    this.runner.cancel();
    this.dodgeT = 0;
    this.dodgeDir = dir;
    this.facing = Math.atan2(dir.x, dir.z);
    this.buffer.clear();
    if (!this.view.playAction('dive', combatConfig.dodge.duration, { range: [0.05, 0.75] })) this.view.stopAction();
  }

  /** Starts an attack, snapping to the lock target or the best aim-assist target. */
  beginAttack(id: string, ctx: PlayerStepContext, inputYaw: number | null): void {
    const atk = this.runner.start(id);
    const target = ctx.lockTarget?.alive ? ctx.lockTarget : this.aimAssist(ctx.targets, inputYaw ?? this.facing);
    if (target) {
      const p = target.position();
      this.facing = Math.atan2(p.x - this.motor.x, p.z - this.motor.z);
    } else if (inputYaw !== null) this.facing = inputYaw;
    this.view.playAction(atk.def.clip, atk.def.duration, { range: atk.def.clipRange, fade: 0.06 });
  }

  private aimAssist(targets: Targetable[], yaw: number): Targetable | null {
    const { range, arc } = combatConfig.aimAssist;
    let best: Targetable | null = null;
    let bestScore = Infinity;
    for (const t of targets) {
      if (!t.alive) continue;
      const p = t.position();
      const dx = p.x - this.motor.x;
      const dz = p.z - this.motor.z;
      const d = Math.hypot(dx, dz);
      if (d > range) continue;
      const ang = Math.abs(angleDelta(yaw, Math.atan2(dx, dz)));
      if (ang > (arc * Math.PI) / 180 && d > 1.5) continue;
      const score = d + ang * 2;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
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

  /** Snap render interpolation (after teleports/respawns). */
  syncRender(): void {
    this.curr.set(this.motor.x, this.motor.y, this.motor.z);
    this.prev.copy(this.curr);
    this.renderPosition.copy(this.curr);
  }

  replaceView(view: CharacterView): void {
    const parent = this.view.object.parent;
    this.view.dispose();
    this.view = view;
    parent?.add(view.object);
  }
}
