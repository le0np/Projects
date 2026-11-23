import * as THREE from 'three';
import type { CharacterView, LocomotionState } from '../animation/CharacterView';
import { AttackRunner, type AttackPlan } from '../combat/AttackRunner';
import { AbilityState, type Imbue } from '../combat/Abilities';
import { mobilityConfig } from '../config/skills';
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
  /** Radius / range / distance multiplier from the skill level. */
  area: number;
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
  /** Parry presses before this time are ignored (anti-mash). */
  parryLockUntil = -Infinity;
  private landing = 0;
  private prev = new THREE.Vector3();
  private curr = new THREE.Vector3();
  readonly renderPosition = new THREE.Vector3();
  /** Set while a scripted move (finisher) controls the player. */
  scripted = false;
  readonly abilities: AbilityState;
  /** Current ability cast (wind-up, effect, recovery). */
  cast: { def: AnyAbilityDef; t: number; fired: boolean; damageScale: number; area: number; instance: number } | null = null;
  /** Gale Step in progress. */
  dash: { t: number; dir: { x: number; z: number }; instance: number } | null = null;
  /** Seconds left of Stone Aegis. */
  aegisT = 0;
  /** Effect to apply this step (consumed by the combat director). */
  abilityEvent: AbilityEvent | null = null;
  /** Air jumps used since leaving the ground. */
  private airJumpsUsed = 0;
  /** Game time Space went down for a high-jump charge, or -1. */
  private chargeStart = -1;
  private highJumpPending = false;
  private lastNow = 0;
  /** Last air/high jump, for the burst effect under the feet. */
  jumpBurst: { kind: 'air' | 'high'; at: number } | null = null;
  /** Set on the step Z coats the weapon (consumed by effects). */
  imbueEvent: Imbue | null = null;
  imbueFailed: { reason: 'locked' | 'cooldown'; at: number } | null = null;
  /** Last failed cast attempt, for HUD feedback. */
  castFailed: { reason: 'locked' | 'cooldown'; at: number } | null = null;

  constructor(
    public view: CharacterView,
    private readonly bus: EventBus<GameEvents>,
    weaponId = 'sword',
    element: ElementId = 'earth',
    unlocked: ElementId[] = [element],
    selected?: ElementId,
    skillLevels: Partial<Record<ElementId, number>> = {},
  ) {
    this.abilities = new AbilityState(element, unlocked, selected, skillLevels);
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

  /** The spear has been thrown and lies somewhere in the world. */
  spearAway = false;
  /** Re-equip the spear when it is picked up (it was in hand when thrown). */
  private rearmSpear = false;
  /** Set on the step the spear leaves the hand (consumed by the combat director). */
  throwEvent: { x: number; y: number; z: number; facing: number } | null = null;
  /** Game time of the last attempt to draw a spear that is not in hand (HUD hint). */
  spearMissingAt = -Infinity;

  setWeapon(id: string): void {
    if (!weapons[id]) return;
    if (id === 'spear' && this.spearAway) return;
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
    this.cast = { def: r.def, t: 0, fired: false, damageScale: r.damageScale, area: r.area, instance: nextCast++ };
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
      this.abilityEvent = { def: d, damageScale: cast.damageScale, area: cast.area, x: this.motor.x, y: this.motor.y, z: this.motor.z, facing: this.facing, instance: cast.instance };
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
    this.lastNow = ctx.now;
    const c = this.combatant;
    c.tick(dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    if (input.wasPressed('attackLight')) this.buffer.push('light', ctx.now);
    if (input.wasPressed('attackHeavy')) this.buffer.push('heavy', ctx.now);
    if (input.wasPressed('weapon1')) this.setWeapon('fists');
    if (input.wasPressed('weapon2')) this.setWeapon('sword');
    if (input.wasPressed('weapon3')) {
      if (this.spearAway) this.spearMissingAt = ctx.now;
      this.setWeapon('spear');
    }
    if (input.wasPressed('sheathe')) this.setWeapon(this.intendedWeapon === 'fists' ? this.lastArmed : 'fists');
    if (this.pendingWeapon && !this.runner.busy) this.setWeapon(this.pendingWeapon);
    this.abilities.tick(dt);
    this.abilityEvent = null;
    if (this.aegisT > 0) {
      this.aegisT -= dt;
      if (this.aegisT <= 0) this.endAegis();
    }
    if (input.wasPressed('cycleAbility')) this.abilities.cycle();
    this.imbueEvent = null;
    if (input.wasPressed('imbue') && c.free && !this.scripted) {
      const r = this.abilities.tryImbue();
      if (r.ok) {
        this.imbueEvent = r.imbue;
        this.bus.emit('weaponImbued', { element: r.imbue.element });
      } else this.imbueFailed = { reason: r.reason, at: ctx.now };
    }

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
    if (input.wasPressed('block')) {
      // A parry attempt only counts when the fighter is free to react, and failed attempts lock it briefly.
      const ready = canAct && !this.cast && this.dodgeT < 0 && this.runner.cancelable && ctx.now >= this.parryLockUntil;
      if (ready) {
        c.blockPressedAt = ctx.now;
        this.parryLockUntil = ctx.now + combatConfig.block.parryCooldown;
        if (this.runner.busy) {
          this.runner.cancel();
          this.view.stopAction(0.08);
        }
      }
    }
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

    // ---- spear throw (G)
    if (canAct && input.wasPressed('throwWeapon') && this.weapon.id === 'spear' && !this.spearAway && !this.cast && this.dodgeT < 0 && this.runner.cancelable) {
      const def = this.weapon.attacks.sp_throw;
      if (this.stamina.spend(def.stamina)) {
        this.buffer.clear();
        const t = ctx.lockTarget?.alive ? ctx.lockTarget.position() : null;
        const yaw = t ? Math.atan2(t.x - this.motor.x, t.z - this.motor.z) : Math.atan2(ctx.camForward.x, ctx.camForward.z);
        this.beginAttack('sp_throw', { ...ctx, lockTarget: null, targets: [] }, yaw);
      }
    }

    // ---- advance attack
    this.throwEvent = null;
    const atk = this.runner.current;
    if (atk) {
      const before = atk.t;
      const ev = this.runner.step(dt);
      const rel = atk.def.release;
      if (rel !== undefined && before < rel && atk.t >= rel && this.weapon.id === 'spear') {
        this.throwEvent = { x: this.motor.x, y: this.motor.y + 1.55, z: this.motor.z, facing: this.facing };
        this.spearAway = true;
        this.rearmSpear = true;
        // The spear leaves the hand: fight unarmed until it is picked up.
        this.runner.weapon = weapons.fists;
        this.pendingWeapon = null;
      }
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
      const distance = (d?.kind === 'dash' ? d.distance : 8) * (this.cast?.area ?? 1);
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
      jump = this.jumpInput(input, ctx.now);
      if (jump && this.motor.grounded && !this.stamina.spend(cfg.stamina.jumpCost)) jump = false;
    }
    if (this.motor.grounded) {
      this.airJumpsUsed = 0;
      // A high jump keeps its burst until it leaves the ground.
    }

    this.stamina.tick(dt, this.sprinting, c.blocking);
    this.prev.copy(this.curr);
    const events = this.motor.step(dt, { moveX, moveZ, speed, jump }, ctx.world);
    for (const e of events) {
      if (e.type === 'jumped') {
        if (this.highJumpPending) this.motor.vy = mobilityConfig.highJumpVelocity;
        this.bus.emit('playerJumped', {});
      }
      else {
        this.landing = Math.min(1, Math.max(this.landing, (e.fallSpeed - 6) / 14));
        this.bus.emit('playerLanded', { fallSpeed: e.fallSpeed });
      }
    }
    this.highJumpPending = false;
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

  /** The thrown spear was picked up: back in hand if the player has not switched weapons since. */
  spearReturned(): void {
    this.spearAway = false;
    if (this.rearmSpear && this.intendedWeapon === 'fists') this.setWeapon('spear');
    this.rearmSpear = false;
  }

  /**
   * Perfect parry: the fighter answers on their own with the weapon's counter move, aimed at the attacker.
   * A light attack right after chains into a combo.
   */
  autoCounter(target: { x: number; z: number }): void {
    this.runner.cancel();
    this.buffer.clear();
    this.dodgeT = -1;
    this.combatant.blocking = false;
    this.facing = Math.atan2(target.x - this.motor.x, target.z - this.motor.z);
    const atk = this.runner.start(this.weapon.counter);
    this.view.playAction(atk.def.clip, atk.def.duration, { range: atk.def.clipRange, fade: 0.04, overlay: atk.def.overlay });
    this.counterUntil = -Infinity;
    // Several enemies can swing in a row: a successful parry re-arms the next one immediately.
    this.parryLockUntil = -Infinity;
  }

  /**
   * Jump input with the mobility skill: Space in the air is a double (or triple) jump; with high jump
   * unlocked, holding Space on the ground charges a jump on a cushion of compressed air (released to fire),
   * while a quick tap still jumps normally on release.
   */
  private jumpInput(input: InputManager, now: number): boolean {
    const mob = this.abilities.mobility;
    const m = mobilityConfig;
    if (!this.motor.grounded) {
      this.chargeStart = -1;
      if (input.wasPressed('jump') && this.airJumpsUsed < mob.airJumps && this.motor.vy < m.airJumpVelocity * 0.6 && this.stamina.spend(m.airJumpStamina)) {
        this.airJumpsUsed++;
        this.motor.vy = m.airJumpVelocity;
        this.jumpBurst = { kind: 'air', at: now };
        this.bus.emit('playerJumped', {});
        return false;
      }
      return input.wasPressed('jump');
    }
    if (!mob.highJump) return input.wasPressed('jump');
    if (input.wasPressed('jump')) this.chargeStart = now;
    if (this.chargeStart < 0) return false;
    const held = now - this.chargeStart;
    if (input.isDown('jump')) return false;
    // Released.
    this.chargeStart = -1;
    if (held >= m.highJumpCharge && this.stamina.spend(m.highJumpStamina)) {
      this.highJumpPending = true;
      this.jumpBurst = { kind: 'high', at: now };
    }
    return true;
  }

  /** 0..1 while a high jump is charging (HUD / effects). */
  get highJumpCharge(): number {
    return this.chargeStart < 0 || !this.motor.grounded ? 0 : Math.min(1, (this.lastNow - this.chargeStart) / mobilityConfig.highJumpCharge);
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
