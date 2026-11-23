import * as THREE from 'three';
import type { CharacterView, LocomotionState } from '../animation/CharacterView';
import { AttackRunner, type AttackPlan } from '../combat/AttackRunner';
import { AbilityState } from '../combat/Abilities';
import { Combatant } from '../combat/Combatant';
import type { AnyAbilityDef } from '../config/abilities';
import type { ElementId } from '../config/elements';
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

/** An ability whose effect fires this step; the combat director applies it to the world. */
export interface AbilityEvent {
  def: AnyAbilityDef;
  damageScale: number;
  x: number;
  y: number;
  z: number;
  facing: number;
  /** Hit instance shared by everything this cast touches. */
  instance: number;
}

let nextCast = 2_000_000;

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
  readonly abilities: AbilityState;
  /** Current ability cast (wind-up, effect, recovery). */
  cast: { def: AnyAbilityDef; t: number; fired: boolean; damageScale: number; instance: number } | null = null;
  /** Gale Step in progress. */
  dash: { t: number; dir: { x: number; z: number }; instance: number } | null = null;
  /** Seconds left of Stone Aegis. */
  aegisT = 0;
  /** Effect to apply this step (consumed by the combat director). */
  abilityEvent: AbilityEvent | null = null;
  /** Last failed cast attempt, for HUD feedback. */
  castFailed: { reason: 'locked' | 'cooldown'; at: number } | null = null;

  constructor(
    public view: CharacterView,
    private readonly bus: EventBus<GameEvents>,
    weaponId = 'sword',
    element: ElementId = 'earth',
    unlocked: ElementId[] = [element],
    selected?: ElementId,
  ) {
    this.abilities = new AbilityState(element, unlocked, selected);
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
    return this.runner.busy || this.dodgeT >= 0 || !!this.cast || !this.combatant.free;
  }

  /** Hit, knocked down or respawned: drop whatever move was in progress. */
  interrupt(): void {
    this.runner.cancel();
    this.dodgeT = -1;
    this.cast = null;
    this.dash = null;
  }

  /** Ends Stone Aegis (expiry or respawn). */
  endAegis(): void {
    this.aegisT = 0;
    this.combatant.armored = false;
    this.combatant.damageTaken = 1;
  }

  private startCast(ctx: PlayerStepContext, moveYaw: number | null): void {
    const r = this.abilities.tryCast();
    if (!r.ok) {
      this.castFailed = { reason: r.reason, at: ctx.now };
      return;
    }
    this.runner.cancel();
    this.buffer.clear();
    this.cast = { def: r.def, t: 0, fired: false, damageScale: r.damageScale, instance: nextCast++ };
    // Aim: lock target, else movement direction, else where the camera looks.
    const t = ctx.lockTarget?.alive ? ctx.lockTarget.position() : null;
    if (t) this.facing = Math.atan2(t.x - this.motor.x, t.z - this.motor.z);
    else if (moveYaw !== null) this.facing = moveYaw;
    else if (r.def.kind === 'wave' || r.def.kind === 'dash') this.facing = Math.atan2(ctx.camForward.x, ctx.camForward.z);
    const total = r.def.kind === 'dash' ? r.def.castTime + r.def.dashTime : r.def.recovery;
    if (!this.view.playAction(r.def.clip, total, { range: r.def.clipRange, fade: 0.06 })) this.view.stopAction();
    this.bus.emit('abilityCast', { element: r.def.element });
  }

  /** Advances the current cast; fires the effect at the end of the wind-up. */
  private stepCast(dt: number): void {
    const cast = this.cast;
    if (!cast) return;
    cast.t += dt;
    const d = cast.def;
    if (!cast.fired && cast.t >= d.castTime) {
      cast.fired = true;
      this.abilityEvent = { def: d, damageScale: cast.damageScale, x: this.motor.x, y: this.motor.y, z: this.motor.z, facing: this.facing, instance: cast.instance };
      if (d.kind === 'dash') this.dash = { t: 0, dir: { x: Math.sin(this.facing), z: Math.cos(this.facing) }, instance: cast.instance };
      if (d.kind === 'aegis') {
        this.aegisT = d.duration;
        this.combatant.armored = true;
        this.combatant.damageTaken = d.damageTaken;
      }
    }
    const end = d.kind === 'dash' ? Math.max(d.recovery, d.castTime + d.dashTime) : d.recovery;
    if (cast.t >= end) {
      this.cast = null;
      this.view.stopAction(0.15);
    }
  }

  /** Fixed-step logic. */
  step(dt: number, input: InputManager, ctx: PlayerStepContext): void {
    const cfg = playerConfig;
    const c = this.combatant;
    c.tick(dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    if (input.wasPressed('attackLight')) this.buffer.push('light', ctx.now);
    if (input.wasPressed('attackHeavy')) this.buffer.push('heavy', ctx.now);
    if (input.wasPressed('weapon1')) this.setWeapon('fists');
    if (input.wasPressed('weapon2')) this.setWeapon('sword');
    if (input.wasPressed('weapon3')) this.setWeapon('spear');
    if (input.wasPressed('sheathe')) this.setWeapon(this.intendedWeapon === 'fists' ? this.lastArmed : 'fists');
    if (this.pendingWeapon && !this.runner.busy) this.setWeapon(this.pendingWeapon);
    this.abilities.tick(dt);
    this.abilityEvent = null;
    if (this.aegisT > 0) {
      this.aegisT -= dt;
      if (this.aegisT <= 0) this.endAegis();
    }
    if (input.wasPressed('cycleAbility')) this.abilities.cycle();

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

    // ---- elemental ability (R); interrupts attack recovery like a dodge
    const canAct = c.free && !this.scripted;
    if (canAct && input.wasPressed('ability') && !this.cast && this.dodgeT < 0 && this.runner.cancelable) {
      const dashing = this.abilities.selected === 'air';
      if (this.motor.grounded || dashing) this.startCast(ctx, moving ? Math.atan2(mx, mz) : null);
    }
    if (!c.free) {
      this.cast = null;
      this.dash = null;
    }
    this.stepCast(dt);

    // ---- defensive actions (cancel attack recovery)
    if (canAct && !this.cast && input.wasPressed('dodge') && this.dodgeT < 0 && this.dodgeCooldown <= 0 && this.runner.cancelable && this.motor.grounded) {
      if (this.stamina.spend(combatConfig.dodge.stamina)) this.startDodge(moving ? { x: mx, z: mz } : { x: -Math.sin(this.facing), z: -Math.cos(this.facing) });
    }
    if (input.wasPressed('block')) c.blockPressedAt = ctx.now;
    c.blocking = canAct && !this.cast && input.isDown('block') && this.dodgeT < 0 && this.runner.cancelable && this.motor.grounded;
    if (c.blocking && this.runner.busy) {
      this.runner.cancel();
      this.view.stopAction(0.1);
    }

    // ---- attacks
    if (canAct && this.dodgeT < 0 && !c.blocking && !this.cast) {
      const airborne = !this.motor.grounded;
      const counterReady = ctx.now <= this.counterUntil;
      const picked = this.buffer.consume(ctx.now, (i) => this.runner.resolve(i, { airborne, counterReady }) !== null);
      if (picked) {
        const plan = this.runner.resolve(picked, { airborne, counterReady })!;
        const def = this.weapon.attacks[plan.id];
        if (this.stamina.spend(def.stamina) || def.stamina === 0) {
          if (plan.id === this.weapon.counter) this.counterUntil = -Infinity;
          this.beginAttack(plan, ctx, moving ? Math.atan2(mx, mz) : null);
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
    if (this.dash) {
      const d = this.cast?.def;
      const dashTime = d?.kind === 'dash' ? d.dashTime : 0.28;
      const distance = d?.kind === 'dash' ? d.distance : 8;
      this.dash.t += dt;
      c.invulnerable = Math.max(c.invulnerable, dt * 1.5);
      moveX = this.dash.dir.x;
      moveZ = this.dash.dir.z;
      speed = distance / dashTime;
      // The dash ignores acceleration limits: full speed from the first frame.
      this.motor.vx = moveX * speed;
      this.motor.vz = moveZ * speed;
      if (this.dash.t >= dashTime) {
        this.dash = null;
        // Keep a little momentum so the stop doesn't feel like hitting a wall.
        this.motor.vx *= 0.3;
        this.motor.vz *= 0.3;
      }
    } else if (this.cast) {
      // Planted while casting.
    } else if (this.dodgeT >= 0) {
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
    } else if (this.cast && !this.cast.fired && ctx.lockTarget?.alive) {
      const t = ctx.lockTarget.position();
      this.turnTowards(Math.atan2(t.x - this.motor.x, t.z - this.motor.z), dt, 1.4);
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
  beginAttack(plan: string | AttackPlan, ctx: PlayerStepContext, inputYaw: number | null): void {
    const atk = this.runner.start(plan);
    const target = ctx.lockTarget?.alive ? ctx.lockTarget : this.aimAssist(ctx.targets, inputYaw ?? this.facing);
    if (target) {
      const p = target.position();
      this.facing = Math.atan2(p.x - this.motor.x, p.z - this.motor.z);
    } else if (inputYaw !== null) this.facing = inputYaw;
    this.view.playAction(atk.def.clip, atk.def.duration, { range: atk.def.clipRange, fade: 0.06, overlay: atk.def.overlay });
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
