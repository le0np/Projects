import * as THREE from 'three';
import type { CharacterView, LocomotionState } from '../animation/CharacterView';
import { AttackTokens } from '../ai/AttackTokens';
import { Combatant } from '../combat/Combatant';
import { StatusEffects } from '../combat/Status';
import { aiConfig, type EnemyAttackDef, type EnemyDef } from '../config/enemies';
import { angleDelta, damp } from '../core/math';
import { CharacterMotor, type CollisionWorld } from '../physics/CharacterMotor';
import type { Targetable } from './Player';

export type BrainState = 'idle' | 'alert' | 'approach' | 'circle' | 'attack' | 'retreat' | 'return';

let nextEnemy = 1;
let nextSwing = 1_000_000;

export interface EnemyContext {
  now: number;
  player: { x: number; z: number; alive: boolean };
  tokens: AttackTokens;
  /** Separate tokens for ranged attackers. */
  shooters: AttackTokens;
  world: CollisionWorld;
}

/**
 * An enemy with simple utility-style AI (GDD 10): notices the player, approaches, circles at a distance
 * while waiting for an attack token so groups take turns, telegraphs attacks, reacts to stagger,
 * knockdown and poise break, and returns home when the player leaves.
 */
export class Enemy implements Targetable {
  readonly id: string;
  readonly motor = new CharacterMotor();
  readonly combatant: Combatant;
  facing = 0;
  brain: BrainState = 'idle';
  attack: { def: EnemyAttackDef; t: number; instance: number; fired: boolean } | null = null;
  readonly status = new StatusEffects();
  /** Seconds left of an evasive roll (archers), and its direction. */
  private rollT = 0;
  private rollDir = { x: 0, z: 0 };
  private rollCooldown = 0;
  private cooldown = 1;
  private stateT = 0;
  private circleDir = Math.random() < 0.5 ? 1 : -1;
  private wanderTarget: { x: number; z: number } | null = null;
  private reaction: string | null = null;
  deadTime = 0;
  /** Set when a finisher is playing on this enemy. */
  finishing = false;
  private prev = new THREE.Vector3();
  private curr = new THREE.Vector3();
  readonly renderPosition = new THREE.Vector3();
  /** Last time this enemy took damage (for showing its health bar). */
  lastHurt = -Infinity;

  constructor(
    readonly def: EnemyDef,
    public view: CharacterView,
    readonly home: { x: number; y: number; z: number },
  ) {
    this.id = `${def.id}_${nextEnemy++}`;
    this.combatant = new Combatant(this.id, { maxHealth: def.maxHealth, maxPoise: def.maxPoise, poiseRegenPerSec: def.poiseRegenPerSec, superArmor: def.superArmor });
    this.motor.teleport(home.x, home.y, home.z);
    this.facing = Math.random() * Math.PI * 2;
    this.syncRender();
  }

  get alive(): boolean {
    return this.combatant.alive;
  }

  position() {
    return { x: this.motor.x, z: this.motor.z };
  }

  /** True during the telegraph just before the hit window (the parry cue). */
  get telegraphing(): boolean {
    const a = this.attack;
    return !!a && a.t >= a.def.hitStart - 0.32 && a.t < a.def.hitStart;
  }

  get hitActive(): boolean {
    const a = this.attack;
    return !!a && !a.def.projectile && a.t >= a.def.hitStart && a.t <= a.def.hitEnd;
  }

  /** A ranged attack whose arrow should be released now (the director spawns it and marks it fired). */
  get readyToFire(): boolean {
    const a = this.attack;
    return !!a && !!a.def.projectile && !a.fired && a.t >= a.def.hitStart;
  }

  /** Point the area attack lands on. */
  aoeCenter(): { x: number; z: number } {
    const r = (this.attack?.def.reach ?? 0) * 0.6;
    return { x: this.motor.x + Math.sin(this.facing) * r, z: this.motor.z + Math.cos(this.facing) * r };
  }

  /** Called by the combat system when this enemy is hit/staggered, to play a reaction. */
  react(kind: 'stagger' | 'knockdown' | 'vulnerable' | 'dead' | 'parried'): void {
    this.cancelAttack();
    this.reaction = kind;
    const c = this.combatant;
    if (kind === 'dead' || kind === 'knockdown') this.view.playAction('fall_down', kind === 'dead' ? 1.1 : 0.9, { hold: true, range: [0, 0.75] });
    else if (kind === 'vulnerable') this.view.playAction('hurt', c.stateTimer, { hold: true, range: [0, 0.6] });
    else this.view.playAction(Math.random() < 0.5 ? 'hurt' : 'hit_to_body_01', 0.5, { range: [0, 0.8] });
  }

  cancelAttack(tokens?: AttackTokens): void {
    this.attack = null;
    tokens?.release(this.id);
  }

  step(dt: number, ctx: EnemyContext): void {
    const c = this.combatant;
    const wasState = c.state;
    c.tick(dt);
    if (!c.alive) {
      this.deadTime += dt;
      this.motor.step(dt, { moveX: 0, moveZ: 0, speed: 0, jump: false }, ctx.world);
      this.syncCurr();
      return;
    }
    // Recovered from a reaction: stand back up.
    if (wasState !== 'normal' && c.state === 'normal' && this.reaction) {
      this.reaction = null;
      this.view.stopAction(0.25);
    }
    // Soaked enemies move and swing slower.
    const speedK = this.status.speed;
    this.cooldown -= dt * speedK;
    this.stateT += dt;
    this.rollCooldown -= dt;

    const p = ctx.player;
    const dx = p.x - this.motor.x;
    const dz = p.z - this.motor.z;
    const dist = Math.hypot(dx, dz);
    const toPlayer = Math.atan2(dx, dz);
    const fromHome = Math.hypot(this.motor.x - this.home.x, this.motor.z - this.home.z);
    let moveX = 0;
    let moveZ = 0;
    let speed = 0;
    let face: number | null = null;

    const tokens = this.def.role === 'ranged' ? ctx.shooters : ctx.tokens;
    if (!c.free || this.finishing) {
      tokens.release(this.id);
      this.rollT = 0;
    } else if (this.rollT > 0) {
      // Evasive roll away from the player.
      this.rollT -= dt;
      moveX = this.rollDir.x;
      moveZ = this.rollDir.z;
      speed = 9 * Math.max(0.2, this.rollT / 0.5);
      if (this.rollT <= 0) this.setBrain('circle');
    } else if (this.attack) {
      const a = this.attack;
      a.t += dt * speedK;
      face = a.t < a.def.hitStart - 0.15 ? toPlayer : null; // commits to the swing just before it lands
      if (a.t < a.def.hitStart) {
        moveX = Math.sin(this.facing);
        moveZ = Math.cos(this.facing);
        speed = (a.def.lunge / a.def.hitStart) * (dist > 1.2 ? 1 : 0);
      }
      if (a.t >= a.def.duration) {
        this.cancelAttack(tokens);
        this.view.stopAction(0.2);
        this.cooldown = this.def.attackCooldown[0] + Math.random() * (this.def.attackCooldown[1] - this.def.attackCooldown[0]);
        this.setBrain('circle');
      }
    } else {
      switch (this.brain) {
        case 'idle': {
          if (p.alive && dist < this.def.noticeRange) {
            this.setBrain('alert');
            this.view.playAction('angry', 0.9, { range: [0, 0.6] });
            break;
          }
          // Wander around the camp.
          if (!this.wanderTarget || this.stateT > 6) {
            const a = Math.random() * Math.PI * 2;
            this.wanderTarget = { x: this.home.x + Math.cos(a) * 4, z: this.home.z + Math.sin(a) * 4 };
            this.stateT = 0;
          }
          const wx = this.wanderTarget.x - this.motor.x;
          const wz = this.wanderTarget.z - this.motor.z;
          const wd = Math.hypot(wx, wz);
          if (wd > 0.6) {
            moveX = wx / wd;
            moveZ = wz / wd;
            speed = this.def.walkSpeed * 0.6;
            face = Math.atan2(wx, wz);
          }
          break;
        }
        case 'alert':
          face = toPlayer;
          if (this.stateT > 0.9) this.setBrain('approach');
          break;
        case 'approach':
          face = toPlayer;
          if (!p.alive || fromHome > 32) this.setBrain('return');
          else if (dist > (this.def.role === 'ranged' ? this.def.attackRange - 2 : this.def.circleRange[1])) {
            moveX = dx / dist;
            moveZ = dz / dist;
            speed = this.def.runSpeed;
          } else this.setBrain('circle');
          break;
        case 'circle': {
          face = toPlayer;
          if (!p.alive || fromHome > 32) {
            this.setBrain('return');
            break;
          }
          const ranged = this.def.role === 'ranged';
          if (dist > (ranged ? this.def.attackRange : this.def.circleRange[1] + 1.5)) {
            this.setBrain('approach');
            break;
          }
          if (ranged && dist < (this.def.retreatRange ?? 0)) {
            if (this.rollCooldown <= 0) {
              // Too close: roll away, then keep backing off.
              this.rollT = 0.5;
              this.rollCooldown = 4;
              this.rollDir = { x: -dx / dist, z: -dz / dist };
              this.view.playAction('dive', 0.55, { range: [0.05, 0.75] });
              break;
            }
          }
          // Strafe around the player, keeping preferred distance.
          const [near, far] = this.def.circleRange;
          const radial = dist < near ? -1 : dist > far ? 1 : 0;
          const tx = (dz / dist) * this.circleDir;
          const tz = (-dx / dist) * this.circleDir;
          moveX = tx * 0.8 + (dx / dist) * radial;
          moveZ = tz * 0.8 + (dz / dist) * radial;
          const l = Math.hypot(moveX, moveZ) || 1;
          moveX /= l;
          moveZ /= l;
          speed = this.def.walkSpeed;
          if (ranged && dist < near) speed = this.def.runSpeed * 0.7;
          if (this.stateT > 2.5 && Math.random() < dt * 0.5) this.circleDir *= -1;
          if (this.cooldown <= 0 && tokens.request(this.id, ctx.now)) {
            if (dist <= this.def.attackRange + 0.4) this.startAttack();
            else {
              // Close in for the attack.
              moveX = dx / dist;
              moveZ = dz / dist;
              speed = this.def.runSpeed;
            }
          }
          break;
        }
        case 'return': {
          const hx = this.home.x - this.motor.x;
          const hz = this.home.z - this.motor.z;
          const hd = Math.hypot(hx, hz);
          if (hd < 1.5) {
            this.combatant.heal(this.def.maxHealth);
            this.setBrain('idle');
          } else {
            moveX = hx / hd;
            moveZ = hz / hd;
            speed = this.def.runSpeed;
            face = Math.atan2(hx, hz);
          }
          if (p.alive && dist < this.def.noticeRange * 0.6 && fromHome < 20) this.setBrain('approach');
          break;
        }
      }
    }
    if (face !== null) this.facing += angleDelta(this.facing, face) * damp(8, dt);
    this.prev.copy(this.curr);
    this.motor.step(dt, { moveX, moveZ, speed: speed * speedK, jump: false }, ctx.world);
    this.syncCurr();
  }

  private startAttack(): void {
    const total = this.def.attacks.reduce((s, a) => s + a.weight, 0);
    let r = Math.random() * total;
    const def = this.def.attacks.find((a) => (r -= a.weight) <= 0) ?? this.def.attacks[0];
    this.attack = { def, t: 0, instance: nextSwing++, fired: false };
    // Bows draw over the wind-up and hold until release; melee swings play over the whole move.
    const animTime = def.projectile ? def.hitStart : def.duration;
    this.view.playAction(def.clip, animTime / this.status.speed, { range: def.clipRange, fade: 0.1, hold: !!def.projectile });
    this.setBrain('attack');
  }

  private setBrain(s: BrainState): void {
    this.brain = s;
    this.stateT = 0;
  }

  private syncCurr(): void {
    this.curr.set(this.motor.x, this.motor.y, this.motor.z);
  }

  syncRender(): void {
    this.syncCurr();
    this.prev.copy(this.curr);
    this.renderPosition.copy(this.curr);
  }

  render(dt: number, alpha: number): void {
    this.renderPosition.lerpVectors(this.prev, this.curr, alpha);
    this.view.object.position.copy(this.renderPosition);
    this.view.object.rotation.y = this.facing;
    const s: LocomotionState = { grounded: this.motor.grounded, speed: this.motor.horizontalSpeed, vy: this.motor.vy, sprinting: false, landing: 0 };
    this.view.update(dt, s);
  }

  /** Resets the enemy at its camp (player respawn / camp respawn). */
  reset(): void {
    this.combatant.revive();
    this.combatant.invulnerable = 0;
    this.cancelAttack();
    this.finishing = false;
    this.reaction = null;
    this.deadTime = 0;
    this.rollT = 0;
    this.status.clear();
    this.view.stopAction(0);
    this.view.object.visible = true;
    this.motor.teleport(this.home.x, this.home.y, this.home.z);
    this.setBrain('idle');
    this.syncRender();
  }
}

export const enemyAi = aiConfig;
