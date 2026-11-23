import * as THREE from 'three';
import type { CharacterView, LocomotionState } from '../animation/CharacterView';
import { AttackRunner, type AttackPlan } from '../combat/AttackRunner';
import { AbilityState, type DodgeElement, type ElementDodgeDef, type Imbue } from '../combat/Abilities';
import { weaponHitMods } from '../combat/imbueEffects';
import { poses } from '../config/moves';
import { imbueConfig, mobilityConfig } from '../config/skills';
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

/** Fire Blast Hop, Water Ice Slide or Earth Rock Pillar in progress (C with that element selected). */
export interface ElementDodge {
  el: DodgeElement;
  def: ElementDodgeDef;
  t: number;
  dir: { x: number; z: number };
  instance: number;
  damageScale: number;
  area: number;
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
  /** Gale Rush in progress. */
  dash: { t: number; dir: { x: number; z: number }; instance: number } | null = null;
  /** Set on the step Gale Rush ends in its spin strike (consumed by the combat director). */
  rushSpinEvent: { x: number; y: number; z: number; instance: number; damageScale: number; area: number } | null = null;
  /** Element dodge in progress, and the step it starts (consumed by the combat director). */
  edodge: ElementDodge | null = null;
  dodgeEvent: (ElementDodge & { x: number; y: number; z: number }) | null = null;
  /** Seconds left of the Z gesture (hand along the blade). */
  gestureT = 0;
  /** Seconds of gliding left this jump, and whether the player is gliding now. */
  private glideLeft = 0;
  gliding = false;
  /** Space went down while airborne (gliding needs a fresh press in the air). */
  private airHold = false;
  /** The air-jump somersault plays until this time. */
  private flipUntil = -Infinity;
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
  /** Set on the step Z coats the weapon (consumed by effects); `fused` when a second element joined. */
  imbueEvent: { imbue: Imbue; fused: boolean } | null = null;
  imbueFailed: { reason: 'locked' | 'cooldown' | 'active'; at: number } | null = null;
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
    return this.runner.busy || this.dodgeT >= 0 || !!this.cast || !!this.edodge || this.gestureT > 0 || !this.combatant.free;
  }

  /** Attack speed: a stone coat makes every swing heavier and slower. */
  get attackSpeed(): number {
    return weaponHitMods(this.abilities.imbue).speed;
  }

  /** Hit, knocked down or respawned: drop whatever move was in progress. */
  interrupt(): void {
    this.runner.cancel();
    this.dodgeT = -1;
    this.cast = null;
    this.dash = null;
    this.edodge = null;
    this.gestureT = 0;
    this.gliding = false;
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
    const lunge = r.def.kind === 'dash' ? r.def.castTime + r.def.dashTime : total;
    if (!this.view.playAction(r.def.clip, lunge, { range: r.def.clipRange, fade: 0.06, overlay: r.def.overlay })) this.view.stopAction();
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
    this.rushSpinEvent = null;
    this.dodgeEvent = null;
    if (this.gestureT > 0) this.gestureT = Math.max(0, this.gestureT - dt);
    if (input.wasPressed('imbue') && c.free && !this.scripted) {
      const r = this.abilities.tryImbue();
      if (r.ok) {
        this.imbueEvent = { imbue: r.imbue, fused: r.fused };
        this.bus.emit('weaponImbued', { element: r.fused ? r.imbue.second! : r.imbue.element });
        // The free hand runs along the blade, unless the fighter is mid-move.
        if (!this.cast && !this.edodge && this.dodgeT < 0 && this.runner.cancelable) {
          this.runner.cancel();
          this.buffer.clear();
          this.gestureT = imbueConfig.gestureTime;
          this.view.playAction('stance', imbueConfig.gestureTime, { overlay: poses.imbueSweep, fade: 0.08 });
        }
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
    if (canAct && !this.cast && !this.edodge && input.wasPressed('dodge') && this.dodgeT < 0 && this.runner.cancelable && this.motor.grounded) {
      const dir = moving ? { x: mx, z: mz } : { x: -Math.sin(this.facing), z: -Math.cos(this.facing) };
      // Fire, water and earth replace the roll with their own move while it is ready.
      if (this.stamina.value >= combatConfig.dodge.stamina) {
        const ed = this.abilities.tryElementDodge();
        if (ed.ok) {
          this.stamina.spend(combatConfig.dodge.stamina);
          this.startElementDodge(ed, moving ? { x: mx, z: mz } : null, ctx);
        } else if (this.dodgeCooldown <= 0 && this.stamina.spend(combatConfig.dodge.stamina)) this.startDodge(dir);
      }
    }
    if (input.wasPressed('block')) {
      // A parry attempt only counts when the fighter is free to react, and failed attempts lock it briefly.
      const ready = canAct && !this.cast && !this.edodge && this.dodgeT < 0 && this.runner.cancelable && ctx.now >= this.parryLockUntil;
      if (ready) {
        c.blockPressedAt = ctx.now;
        this.parryLockUntil = ctx.now + combatConfig.block.parryCooldown;
        if (this.runner.busy) {
          this.runner.cancel();
          this.view.stopAction(0.08);
        }
      }
    }
    c.blocking = canAct && !this.cast && !this.edodge && input.isDown('block') && this.dodgeT < 0 && this.runner.cancelable && this.motor.grounded;
    if (c.blocking && this.gestureT > 0) {
      this.gestureT = 0;
      this.view.stopAction(0.1);
    }
    if (c.blocking && this.runner.busy) {
      this.runner.cancel();
      this.view.stopAction(0.1);
    }

    // ---- attacks
    if (canAct && this.dodgeT < 0 && !c.blocking && !this.cast && !this.edodge && this.gestureT <= 0) {
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
      const ev = this.runner.step(dt * this.attackSpeed);
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
        // Brake with a spin strike.
        const cast = this.cast;
        if (cast && d?.kind === 'dash') {
          this.rushSpinEvent = { x: this.motor.x, y: this.motor.y, z: this.motor.z, instance: nextCast++, damageScale: cast.damageScale, area: cast.area };
          const rest = Math.max(0.2, d.recovery - d.castTime - d.dashTime);
          this.view.playAction('stance', rest, { overlay: poses.rushSpin, fade: 0.05 });
        }
      }
    } else if (this.edodge) {
      const ed = this.edodge;
      ed.t += dt;
      const k = Math.min(1, ed.t / ed.def.duration);
      moveX = ed.dir.x;
      moveZ = ed.dir.z;
      if (ed.el === 'water') {
        // Slide fast, easing off; untouchable the whole way.
        speed = (ed.def.speed / 0.7) * (1 - 0.6 * k) * ed.area;
        c.invulnerable = Math.max(c.invulnerable, dt * 1.5);
      } else {
        speed = ed.def.speed;
        if (ed.t < 0.3) c.invulnerable = Math.max(c.invulnerable, dt * 1.5);
      }
      this.motor.vx = moveX * speed;
      this.motor.vz = moveZ * speed;
      if (ed.t >= ed.def.duration) {
        this.edodge = null;
        if (ed.el === 'water') this.view.stopAction(0.2);
      }
    } else if (this.gestureT > 0) {
      // Planted for the gesture.
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
    this.stepGlide(dt, input, ctx.now);
    if (this.motor.grounded) {
      this.airJumpsUsed = 0;
      this.glideLeft = this.abilities.mobility.hover;
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
    this.gestureT = 0;
    this.edodge = null;
    this.view.playAction(atk.def.clip, atk.def.duration / this.attackSpeed, { range: atk.def.clipRange, fade: 0.04, overlay: atk.def.overlay });
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
      // Air jumps are free: no stamina, no cooldown, they come back on landing.
      if (input.wasPressed('jump') && this.airJumpsUsed < mob.airJumps && this.motor.vy < m.airJumpVelocity * 0.6) {
        this.airJumpsUsed++;
        this.motor.vy = m.airJumpVelocity;
        this.jumpBurst = { kind: 'air', at: now };
        this.flipUntil = now + m.airFlipTime;
        this.view.playAction('stance', m.airFlipTime, { overlay: poses.airFlip, fade: 0.05 });
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

  /**
   * Gliding (wind skill level 3+): hold Space, pressed in the air, while falling and the wind carries
   * you down slowly for a few seconds per jump. The wind skill also makes every fall a little floatier.
   */
  private stepGlide(dt: number, input: InputManager, now: number): void {
    const mob = this.abilities.mobility;
    const m = mobilityConfig;
    this.motor.gravityScale = mob.unlocked ? m.airGravityScale : 1;
    if (this.motor.grounded) this.airHold = false;
    else if (input.wasPressed('jump')) this.airHold = true;
    if (!input.isDown('jump')) this.airHold = false;
    const free = this.combatant.free && !this.scripted && !this.runner.busy && !this.cast && !this.edodge && this.dodgeT < 0;
    const want = free && this.airHold && !this.motor.grounded && this.motor.vy < 0 && this.glideLeft > 0 && now >= this.flipUntil;
    if (want) {
      this.glideLeft -= dt;
      // Ease into the glide speed; the wind cancels this step's gravity.
      this.motor.vy += (-m.hoverFallSpeed - this.motor.vy) * Math.min(1, dt * 12) + playerConfig.gravity * this.motor.gravityScale * dt;
      if (!this.gliding) this.view.playAction('stance', 6, { overlay: poses.glide, fade: 0.15, hold: true });
    } else if (this.gliding && free) this.view.stopAction(0.2);
    this.gliding = want;
  }

  /** Starts Blast Hop (fire), Ice Slide (water) or Rock Pillar (earth). */
  private startElementDodge(ed: { el: DodgeElement; def: ElementDodgeDef; damageScale: number; area: number }, moveDir: { x: number; z: number } | null, ctx: PlayerStepContext): void {
    this.runner.cancel();
    this.buffer.clear();
    const t = ctx.lockTarget?.alive ? ctx.lockTarget.position() : null;
    if (t) this.facing = Math.atan2(t.x - this.motor.x, t.z - this.motor.z);
    const fwd = { x: Math.sin(this.facing), z: Math.cos(this.facing) };
    // Blast Hop always leaps back from where you face; the others go where you steer.
    const dir = ed.el === 'fire' ? { x: -fwd.x, z: -fwd.z } : (moveDir ?? fwd);
    if (ed.el === 'water' && moveDir) this.facing = Math.atan2(moveDir.x, moveDir.z);
    this.edodge = { el: ed.el, def: ed.def, t: 0, dir, instance: nextCast++, damageScale: ed.damageScale, area: ed.area };
    this.dodgeEvent = { ...this.edodge, x: this.motor.x, y: this.motor.y, z: this.motor.z };
    if (ed.el !== 'water') {
      this.motor.vy = ed.def.up;
      this.motor.grounded = false;
    }
    const pose = ed.el === 'fire' ? poses.backHop : ed.el === 'water' ? poses.iceSlide : poses.pillarLaunch;
    const time = ed.el === 'fire' ? 0.6 : ed.def.duration;
    this.view.playAction('stance', time, { overlay: pose, fade: 0.05 });
    this.bus.emit('abilityCast', { element: ed.el });
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
    this.view.playAction(atk.def.clip, atk.def.duration / this.attackSpeed, { range: atk.def.clipRange, fade: 0.06, overlay: atk.def.overlay });
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
    // Ice Slide: the body drops low onto the folded leg (bones alone cannot lower the hips).
    const ed = this.edodge;
    if (ed?.el === 'water') {
      const k = ed.t / ed.def.duration;
      this.view.object.position.y -= 0.42 * Math.min(1, k / 0.12) * Math.min(1, (1 - k) / 0.2);
    }
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
