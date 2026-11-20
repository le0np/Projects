import * as THREE from 'three';
import type { AssetRegistry } from '../assets/AssetRegistry';
import { characterModels } from '../config/characters';
import { combatConfig } from '../config/combat';
import { aiConfig, enemyDefs, type EnemyDef } from '../config/enemies';
import { elements, type ElementId } from '../config/elements';
import type { EventBus, GameEvents } from '../core/EventBus';
import { AttackTokens } from '../ai/AttackTokens';
import { GltfCharacter } from '../animation/GltfCharacter';
import { PlaceholderHumanoid } from '../animation/PlaceholderHumanoid';
import type { CharacterView } from '../animation/CharacterView';
import { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { InputManager } from '../input/InputManager';
import type { Fx } from '../render/Fx';
import type { Region } from '../world/Region';
import { inArc, isInFront, resolveHit } from './resolveHit';
import { attachWeapon, buildWeapon } from './WeaponModels';

export interface CombatFeedback {
  /** Freeze time briefly (seconds, real time). */
  hitstop(seconds: number): void;
  /** Slow motion for a while (real seconds) at a given scale. */
  slowmo(seconds: number, scale: number): void;
  shake(amount: number): void;
  /** Floating text at a world position. */
  popup(at: THREE.Vector3, text: string, kind: 'damage' | 'crit' | 'player' | 'info'): void;
  /** Cinematic camera for finishers; null ends it. */
  cinematic(shot: { focus: THREE.Vector3; yaw: number } | null): void;
}

const ENEMY_RADIUS = 0.45;
const PLAYER_RADIUS = 0.4;

/**
 * Runs fights: spawns the camp, steps enemy AI, resolves hits both ways (with parry, block, dodge),
 * handles lock-on, finishers, hit feedback and camp respawns. Rendering-side bits (FX, weapon glints,
 * vulnerability markers, block ward) also live here so gameplay code stays free of effects.
 */
export class CombatDirector {
  readonly enemies: Enemy[] = [];
  readonly tokens = new AttackTokens(aiConfig.maxAttackers, aiConfig.tokenHold);
  lockTarget: Enemy | null = null;
  comboCount = 0;
  private comboTimer = 0;
  private allDeadTimer = 0;
  private finisher: { enemy: Enemy; done: boolean } | null = null;
  private markers = new Map<string, { glint: THREE.Sprite; ring: THREE.Mesh }>();
  private ward: THREE.Mesh;
  private wardFlash = 0;
  private group = new THREE.Group();
  private glintTex = makeGlintTexture();
  private element: ElementId = 'earth';

  constructor(
    private readonly scene: THREE.Scene,
    private readonly bus: EventBus<GameEvents>,
    private readonly assets: AssetRegistry,
    private readonly fx: Fx,
    private readonly feedback: CombatFeedback,
  ) {
    scene.add(this.group);
    this.ward = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 24, 12, -Math.PI / 2.4, Math.PI / 1.2, Math.PI * 0.18, Math.PI * 0.62),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.ward.visible = false;
    this.group.add(this.ward);
  }

  setElement(el: ElementId): void {
    this.element = el;
    (this.ward.material as THREE.MeshBasicMaterial).color.setHex(elements[el].glow);
  }

  // ------------------------------------------------------------------ spawning

  async spawnCamp(region: Region): Promise<void> {
    this.clear();
    const def = enemyDefs.raider;
    for (const sp of region.camp.spawns) {
      const view = await this.enemyView(def);
      const e = new Enemy(def, view, { x: sp.x, y: sp.y, z: sp.z });
      e.facing = Math.atan2(region.camp.center.x - sp.x, region.camp.center.z - sp.z) + Math.PI;
      this.scene.add(view.object);
      this.enemies.push(e);
      const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glintTex, color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
      glint.scale.setScalar(0.9);
      glint.visible = false;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.rotation.x = Math.PI / 2;
      ring.visible = false;
      this.group.add(glint, ring);
      this.markers.set(e.id, { glint, ring });
    }
  }

  private async enemyView(def: EnemyDef): Promise<CharacterView> {
    const asset = this.assets.get(def.assetId);
    let view: CharacterView | null = null;
    if (asset) {
      try {
        const gltf = await this.assets.load(asset.model);
        const clips = await this.assets.loadClips(asset, gltf);
        view = new GltfCharacter(asset, gltf, clips, 1, characterModels[def.assetId]);
      } catch (err) {
        console.warn(`[assets] ${def.assetId} failed, using placeholder`, err);
      }
    }
    view ??= new PlaceholderHumanoid({
      element: 'fire',
      appearance: { presentation: 'masculine', height: 1.02, build: 0.6, age: 35, skinTone: 0xc99a74, hairColor: 0x2a1d18, hairStyle: 'short', eyeColor: 0x331a10 },
    });
    attachWeapon(view.weaponSocket, view.source, buildWeapon('sword', def.color, true));
    return view;
  }

  clear(): void {
    for (const e of this.enemies) e.view.dispose();
    this.enemies.length = 0;
    for (const m of this.markers.values()) {
      m.glint.removeFromParent();
      m.ring.removeFromParent();
    }
    this.markers.clear();
    this.lockTarget = null;
    this.finisher = null;
  }

  resetAll(): void {
    for (const e of this.enemies) e.reset();
    this.lockTarget = null;
    this.finisher = null;
    this.allDeadTimer = 0;
  }

  // ------------------------------------------------------------------ lock-on & finisher

  toggleLock(player: Player, camForward: { x: number; z: number }): void {
    if (this.lockTarget) {
      this.lockTarget = null;
      return;
    }
    let best: Enemy | null = null;
    let bestScore = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.motor.x - player.motor.x;
      const dz = e.motor.z - player.motor.z;
      const d = Math.hypot(dx, dz);
      if (d > combatConfig.lockOn.range) continue;
      const cos = (dx * camForward.x + dz * camForward.z) / (d || 1);
      const score = d * (1.6 - cos);
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    this.lockTarget = best;
  }

  /** Enemy that can be finished right now, if any. */
  finisherCandidate(player: Player): Enemy | null {
    if (this.finisher || !player.combatant.free || player.runner.busy) return null;
    let best: Enemy | null = null;
    let bestD: number = combatConfig.finisher.range;
    for (const e of this.enemies) {
      if (!e.alive || e.combatant.state !== 'vulnerable') continue;
      const d = Math.hypot(e.motor.x - player.motor.x, e.motor.z - player.motor.z);
      if (d <= bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private startFinisher(player: Player, enemy: Enemy): void {
    this.finisher = { enemy, done: false };
    enemy.finishing = true;
    enemy.combatant.stateTimer = 10;
    player.scripted = true;
    player.facing = Math.atan2(enemy.motor.x - player.motor.x, enemy.motor.z - player.motor.z);
    // Approach to a fixed distance so the strike connects.
    const back = 1.5;
    const tx = enemy.motor.x - Math.sin(player.facing) * back;
    const tz = enemy.motor.z - Math.cos(player.facing) * back;
    player.motor.x = tx;
    player.motor.z = tz;
    player.syncRender();
    const atk = player.runner.start(player.weapon.finisher);
    player.view.playAction(atk.def.clip, atk.def.duration, { range: atk.def.clipRange });
    this.feedback.slowmo(atk.def.duration * 0.9, combatConfig.finisher.slowmoScale);
    const mid = new THREE.Vector3((player.motor.x + enemy.motor.x) / 2, player.motor.y + 1.1, (player.motor.z + enemy.motor.z) / 2);
    this.feedback.cinematic({ focus: mid, yaw: player.facing + Math.PI / 2 });
  }

  // ------------------------------------------------------------------ simulation

  step(dt: number, now: number, player: Player, input: InputManager, camForward: { x: number; z: number }, region: Region): void {
    if (input.wasPressed('lockOn')) this.toggleLock(player, camForward);
    if (input.wasPressed('finisher')) {
      const e = this.finisherCandidate(player);
      if (e) this.startFinisher(player, e);
    }
    if (this.lockTarget && (!this.lockTarget.alive || dist2(this.lockTarget, player) > combatConfig.lockOn.breakRange ** 2)) this.lockTarget = null;

    const pAlive = player.combatant.alive;
    for (const e of this.enemies) e.step(dt, { now, player: { x: player.motor.x, z: player.motor.z, alive: pAlive }, tokens: this.tokens, world: region.collision });

    this.playerHits(player, now);
    if (pAlive) this.enemyHits(player, now);
    this.separate(player);

    // Finisher completion.
    if (this.finisher && !player.runner.busy) {
      player.scripted = false;
      this.finisher.enemy.finishing = false;
      this.finisher = null;
      this.feedback.cinematic(null);
    }

    // Combo counter.
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.comboCount = 0;

    // Camp respawn once everyone is down and the player has left.
    if (this.enemies.length && this.enemies.every((e) => !e.alive)) {
      this.allDeadTimer += dt;
      const far = Math.hypot(player.motor.x - region.camp.center.x, player.motor.z - region.camp.center.z) > 28;
      if (this.allDeadTimer > 45 && far) this.resetAll();
    } else this.allDeadTimer = 0;
  }

  private playerHits(player: Player, now: number): void {
    const atk = player.runner.current;
    if (!atk || !player.runner.hitActive) return;
    const def = atk.def;
    const isFinisher = def.id === player.weapon.finisher;
    for (const e of this.enemies) {
      if (!e.alive || e.combatant.alreadyHitBy(atk.instance)) continue;
      if (isFinisher && this.finisher?.enemy !== e) continue;
      if (!inArc({ x: player.motor.x, z: player.motor.z, facing: player.facing }, { x: e.motor.x, z: e.motor.z, radius: ENEMY_RADIUS }, def.reach, def.arc)) continue;
      const { outcome } = resolveHit(
        e.combatant,
        { instance: atk.instance, damage: def.damage, poise: def.poise, knockback: def.knockback, launch: def.launch, knockdown: def.knockdown, kind: 'melee', unblockable: isFinisher },
        { now, stamina: 0, fromFront: true },
      );
      if (outcome.result !== 'hit') continue;
      e.lastHurt = now;
      const dir = new THREE.Vector3(e.motor.x - player.motor.x, 0, e.motor.z - player.motor.z).normalize();
      e.motor.vx = dir.x * def.knockback;
      e.motor.vz = dir.z * def.knockback;
      if (def.launch && (outcome.knockedDown || outcome.killed || outcome.vulnerable)) {
        e.motor.vy = def.launch;
        e.motor.grounded = false;
      }
      if (outcome.killed) {
        e.react('dead');
        this.tokens.release(e.id);
        this.bus.emit('enemyKilled', { id: e.id, xp: e.def.xp });
      } else if (outcome.vulnerable) e.react('vulnerable');
      else if (outcome.knockedDown) e.react('knockdown');
      else if (outcome.staggered) e.react('stagger');
      const at = new THREE.Vector3(e.motor.x, e.motor.y + 1.15, e.motor.z);
      const glow = elements[this.element].glow;
      this.fx.burst(at, 0xffffff, 10, 6, dir);
      this.fx.burst(at, glow, isFinisher ? 80 : 14, isFinisher ? 11 : 7, dir);
      if (isFinisher || outcome.killed) this.fx.ring(new THREE.Vector3(e.motor.x, e.motor.y, e.motor.z), glow, isFinisher ? 7 : 3.5, isFinisher ? 0.8 : 0.45);
      this.feedback.hitstop(def.hitstop);
      this.feedback.shake(def.shake);
      this.comboCount++;
      this.comboTimer = 2.2;
      this.feedback.popup(at, isFinisher ? 'FINISHER' : String(Math.min(outcome.damage, e.def.maxHealth)), isFinisher || def.damage >= 24 ? 'crit' : 'damage');
      if (outcome.vulnerable) this.feedback.popup(at.clone().add(new THREE.Vector3(0, 0.5, 0)), 'BROKEN — press F', 'info');
      this.bus.emit('hit', { attacker: 'player', target: e.id, damage: outcome.damage });
    }
  }

  private enemyHits(player: Player, now: number): void {
    const pc = player.combatant;
    for (const e of this.enemies) {
      const atk = e.attack;
      if (!atk || !e.hitActive || pc.alreadyHitBy(atk.instance)) continue;
      const def = atk.def;
      const pPos = { x: player.motor.x, z: player.motor.z, radius: PLAYER_RADIUS };
      if (!inArc({ x: e.motor.x, z: e.motor.z, facing: e.facing }, pPos, def.reach, def.arc)) continue;
      const fromFront = isInFront({ x: player.motor.x, z: player.motor.z, facing: player.facing }, { x: e.motor.x, z: e.motor.z });
      const { outcome, staminaCost } = resolveHit(pc, { instance: atk.instance, damage: def.damage, poise: def.poise, knockback: def.knockback, knockdown: def.knockdown, kind: 'melee' }, { now, stamina: player.stamina.value, fromFront });
      const at = new THREE.Vector3(player.motor.x, player.motor.y + 1.2, player.motor.z);
      const push = new THREE.Vector3(player.motor.x - e.motor.x, 0, player.motor.z - e.motor.z).normalize();
      switch (outcome.result) {
        case 'parried': {
          e.cancelAttack(this.tokens);
          e.combatant.setState('staggered', 1.2);
          e.combatant.poise = Math.max(0, e.combatant.poise - e.def.maxPoise * 0.5);
          e.react('parried');
          player.counterUntil = now + combatConfig.block.counterWindow;
          this.fx.burst(at.clone().addScaledVector(push, -0.6), 0xffe2a0, 40, 9);
          this.fx.ring(new THREE.Vector3(player.motor.x, player.motor.y, player.motor.z), 0xffe2a0, 3, 0.35);
          this.feedback.slowmo(combatConfig.block.parrySlowmo, combatConfig.block.parrySlowmoScale);
          this.feedback.shake(0.35);
          this.feedback.popup(at, 'PARRY — counter!', 'info');
          this.wardFlash = 1;
          this.bus.emit('parry', { enemy: e.id });
          break;
        }
        case 'blocked':
          player.stamina.value = Math.max(0, player.stamina.value - staminaCost);
          player.motor.vx = push.x * def.knockback * 0.6;
          player.motor.vz = push.z * def.knockback * 0.6;
          this.fx.burst(at.clone().addScaledVector(push, -0.6), 0xffffff, 12, 6);
          this.feedback.shake(0.15);
          this.wardFlash = 1;
          if (outcome.guardBroken) {
            player.view.playAction('hit_to_body_01', 0.9);
            this.feedback.popup(at, 'GUARD BROKEN', 'player');
          }
          break;
        case 'evaded':
          this.feedback.popup(at, 'evade', 'info');
          break;
        case 'hit': {
          player.runner.cancel();
          player.dodgeT = -1;
          player.motor.vx = push.x * def.knockback;
          player.motor.vz = push.z * def.knockback;
          this.fx.burst(at, 0xff6a5a, 14, 6, push);
          this.feedback.shake(0.3);
          this.feedback.hitstop(0.05);
          this.feedback.popup(at, String(outcome.damage), 'player');
          if (outcome.killed) {
            player.view.playAction('fall_down', 1.2, { hold: true, range: [0, 0.8] });
            this.lockTarget = null;
            this.bus.emit('playerDied', {});
          } else if (outcome.knockedDown) player.view.playAction('fall_down', 1.2, { range: [0, 1] });
          else player.view.playAction(Math.random() < 0.5 ? 'hurt' : 'hit_to_head', 0.5, { range: [0, 0.8] });
          this.bus.emit('hit', { attacker: e.id, target: 'player', damage: outcome.damage });
          break;
        }
      }
    }
  }

  /** Keeps bodies from overlapping. */
  private separate(player: Player): void {
    const bodies = [{ m: player.motor, r: PLAYER_RADIUS, alive: player.combatant.alive }, ...this.enemies.map((e) => ({ m: e.motor, r: ENEMY_RADIUS, alive: e.alive }))];
    for (let i = 0; i < bodies.length; i++)
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        if (!a.alive || !b.alive) continue;
        const dx = b.m.x - a.m.x;
        const dz = b.m.z - a.m.z;
        const d = Math.hypot(dx, dz);
        const min = a.r + b.r;
        if (d >= min || d < 1e-4) continue;
        const push = (min - d) / 2;
        a.m.x -= (dx / d) * push;
        a.m.z -= (dz / d) * push;
        b.m.x += (dx / d) * push;
        b.m.z += (dz / d) * push;
      }
  }

  // ------------------------------------------------------------------ rendering

  render(dt: number, alpha: number, player: Player): void {
    for (const e of this.enemies) {
      e.render(dt, alpha);
      // Fade out and hide the fallen.
      e.view.object.visible = !(!e.alive && e.deadTime > 4);
      const m = this.markers.get(e.id);
      if (!m) continue;
      m.glint.visible = e.telegraphing;
      if (m.glint.visible) {
        e.view.weaponSocket.getWorldPosition(m.glint.position);
        m.glint.position.y += 0.35;
        const k = (e.attack!.t - (e.attack!.def.hitStart - 0.32)) / 0.32;
        m.glint.scale.setScalar(0.4 + Math.sin(k * Math.PI) * 0.9);
      }
      m.ring.visible = e.alive && e.combatant.state === 'vulnerable';
      if (m.ring.visible) {
        m.ring.position.set(e.renderPosition.x, e.renderPosition.y + 2.05, e.renderPosition.z);
        m.ring.rotation.z += dt * 4;
      }
    }
    // Block ward in front of the player.
    const blocking = player.combatant.blocking;
    this.wardFlash = Math.max(0, this.wardFlash - dt * 4);
    this.ward.visible = blocking || this.wardFlash > 0;
    if (this.ward.visible) {
      this.ward.position.copy(player.renderPosition).add(new THREE.Vector3(0, 1.0, 0));
      this.ward.rotation.y = player.facing;
      (this.ward.material as THREE.MeshBasicMaterial).opacity = (blocking ? 0.22 : 0) + this.wardFlash * 0.5;
    }
    this.fx.update(dt);
  }

  dispose(): void {
    this.clear();
    this.group.removeFromParent();
  }
}

function dist2(e: Enemy, p: Player): number {
  return (e.motor.x - p.motor.x) ** 2 + (e.motor.z - p.motor.z) ** 2;
}

function makeGlintTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,230,170,0.8)');
  grad.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(30, 2, 4, 60);
  g.fillRect(2, 30, 60, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
