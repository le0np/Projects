import * as THREE from 'three';
import type { AssetRegistry } from '../assets/AssetRegistry';
import { characterModels } from '../config/characters';
import { combatConfig } from '../config/combat';
import { aiConfig, campRoster, enemyDefs, type EnemyDef } from '../config/enemies';
import { abilities, type AnyAbilityDef } from '../config/abilities';
import { elements, type ElementId } from '../config/elements';
import type { EventBus, GameEvents } from '../core/EventBus';
import { AttackTokens } from '../ai/AttackTokens';
import { GltfCharacter } from '../animation/GltfCharacter';
import { PlaceholderHumanoid } from '../animation/PlaceholderHumanoid';
import type { CharacterView } from '../animation/CharacterView';
import { Enemy } from '../entities/Enemy';
import type { AbilityEvent, Player } from '../entities/Player';
import { AbilityFx } from '../render/AbilityFx';
import { aimVelocity, Projectiles, type CapsuleTarget } from './Projectiles';
import { ThrownSpear } from './ThrownSpear';
import type { Imbue } from './Abilities';
import { galeRush, imbueConfig } from '../config/skills';
import { imbueElements, spearImbue, weaponHitMods, type WeaponHitMods } from './imbueEffects';
import { ImbueVisuals } from '../render/ImbueVisuals';
import type { InputManager } from '../input/InputManager';
import type { Fx } from '../render/Fx';
import type { Region } from '../world/Region';
import { inArc, isInFront, resolveHit, type HitInfo } from './resolveHit';
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

const PLAYER_RADIUS = 0.4;
let nextDot = 3_000_000;

/**
 * Runs fights: spawns the camp, steps enemy AI, resolves hits both ways (with parry, block, dodge),
 * handles lock-on, finishers, hit feedback and camp respawns. Rendering-side bits (FX, weapon glints,
 * vulnerability markers, block ward) also live here so gameplay code stays free of effects.
 */
export class CombatDirector {
  readonly enemies: Enemy[] = [];
  readonly tokens = new AttackTokens(aiConfig.maxAttackers, aiConfig.tokenHold);
  readonly shooters = new AttackTokens(aiConfig.maxShooters, aiConfig.tokenHold);
  readonly projectiles = new Projectiles();
  readonly abilityFx = new AbilityFx();
  readonly spear = new ThrownSpear({ gravity: combatConfig.spearThrow.gravity, life: combatConfig.spearThrow.life });
  private spearMesh = buildWeapon('spear', 0xc08040);
  private groundAt: (x: number, z: number) => number = () => 0;
  private time = 0;
  lockTarget: Enemy | null = null;
  comboCount = 0;
  private comboTimer = 0;
  private allDeadTimer = 0;
  private finisherPressedAt = -Infinity;
  private finisher: { enemy: Enemy; done: boolean } | null = null;
  private markers = new Map<string, { glint: THREE.Sprite; ring: THREE.Mesh }>();
  private ward: THREE.Mesh;
  private wardFlash = 0;
  private group = new THREE.Group();
  private glintTex = makeGlintTexture();
  private element: ElementId = 'earth';
  private tmpV = new THREE.Vector3();
  private lastJumpBurst = -1;
  private lastImbue: Imbue | null = null;
  private lastImbueSecond: string | null = null;
  readonly imbueFx = new ImbueVisuals();
  /** Attack instances that already exploded / extended the imbue (once per swing). */
  private explodedBy = new Set<number>();
  private extendedBy = -1;
  private iceGeo = new THREE.IcosahedronGeometry(1, 1);
  private iceMat = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.55, roughness: 0.15, metalness: 0.1, emissive: 0x2a6a9a, emissiveIntensity: 0.5, flatShading: true, depthWrite: false });
  private ice = new Map<string, THREE.Mesh>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly bus: EventBus<GameEvents>,
    private readonly assets: AssetRegistry,
    private readonly fx: Fx,
    private readonly feedback: CombatFeedback,
  ) {
    scene.add(this.group);
    this.group.add(this.abilityFx.group, this.imbueFx.group);
    this.ward = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 24, 12, -Math.PI / 2.4, Math.PI / 1.2, Math.PI * 0.18, Math.PI * 0.62),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.ward.visible = false;
    this.group.add(this.ward);
    this.spearMesh.visible = false;
    this.group.add(this.spearMesh);
  }

  setElement(el: ElementId): void {
    this.element = el;
    this.group.remove(this.spearMesh);
    this.spearMesh = buildWeapon('spear', elements[el].color);
    this.spearMesh.visible = false;
    this.group.add(this.spearMesh);
    (this.ward.material as THREE.MeshBasicMaterial).color.setHex(elements[el].glow);
  }

  // ------------------------------------------------------------------ spawning

  async spawnCamp(region: Region): Promise<void> {
    this.clear();
    this.groundAt = (x, z) => region.terrain.heightAt(x, z);
    for (const [i, sp] of region.camp.spawns.entries()) {
      const def = enemyDefs[campRoster[i % campRoster.length]];
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
      const shell = new THREE.Mesh(this.iceGeo, this.iceMat);
      shell.visible = false;
      this.group.add(shell);
      this.ice.set(e.id, shell);
    }
  }

  private async enemyView(def: EnemyDef): Promise<CharacterView> {
    const asset = this.assets.get(def.assetId);
    let view: CharacterView | null = null;
    if (asset) {
      try {
        const gltf = await this.assets.load(asset.model);
        const clips = await this.assets.loadClips(asset, gltf);
        const g = new GltfCharacter(asset, gltf, clips, def.look.scale, characterModels[def.assetId]);
        if (def.look.tint !== 0xffffff) g.setTint(def.look.tint);
        view = g;
      } catch (err) {
        console.warn(`[assets] ${def.assetId} failed, using placeholder`, err);
      }
    }
    view ??= new PlaceholderHumanoid({
      element: 'fire',
      appearance: { presentation: 'masculine', height: 1.02 * def.look.scale, build: 0.6, age: 35, skinTone: 0xc99a74, hairColor: 0x2a1d18, hairStyle: 'short', eyeColor: 0x331a10 },
    });
    // Broader silhouette for heavy archetypes (the whole rig is widened, animations are unaffected).
    view.object.scale.set(def.look.width, 1, def.look.width);
    attachWeapon(view.weaponSocket, view.source, buildWeapon(def.look.weapon, def.color, true));
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
    for (const m of this.ice.values()) m.removeFromParent();
    this.ice.clear();
    this.imbueFx.clear();
    this.lockTarget = null;
    this.finisher = null;
    this.projectiles.clear();
    this.projectiles.prune();
    this.abilityFx.clear();
    // A spear left in another region comes back to hand.
    this.spear.pickUp();
  }

  resetAll(): void {
    for (const e of this.enemies) e.reset();
    this.spear.pickUp();
    this.projectiles.clear();
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
    // The finisher is a cinematic: arrows or other enemies cannot interrupt it.
    player.combatant.invulnerable = Math.max(player.combatant.invulnerable, atk.def.duration + 0.3);
    player.view.playAction(atk.def.clip, atk.def.duration, { range: atk.def.clipRange, overlay: atk.def.overlay });
    this.feedback.slowmo(atk.def.duration * 0.9, combatConfig.finisher.slowmoScale);
    const mid = new THREE.Vector3((player.motor.x + enemy.motor.x) / 2, player.motor.y + 1.1, (player.motor.z + enemy.motor.z) / 2);
    this.feedback.cinematic({ focus: mid, yaw: player.facing + Math.PI / 2 });
  }

  // ------------------------------------------------------------------ simulation

  step(dt: number, now: number, player: Player, input: InputManager, camForward: { x: number; z: number }, region: Region): void {
    this.time = now;
    if (input.wasPressed('lockOn')) this.toggleLock(player, camForward);
    // F is buffered briefly, so a press during a hit reaction still triggers once the player recovers.
    if (input.wasPressed('finisher')) this.finisherPressedAt = now;
    if (now - this.finisherPressedAt <= combatConfig.finisher.buffer) {
      const e = this.finisherCandidate(player);
      if (e) {
        this.finisherPressedAt = -Infinity;
        this.startFinisher(player, e);
      }
    }
    if (this.lockTarget && (!this.lockTarget.alive || dist2(this.lockTarget, player) > combatConfig.lockOn.breakRange ** 2)) this.lockTarget = null;

    const pAlive = player.combatant.alive;
    for (const e of this.enemies) e.step(dt, { now, player: { x: player.motor.x, z: player.motor.z, alive: pAlive }, tokens: this.tokens, shooters: this.shooters, world: region.collision });

    if (player.abilityEvent) this.applyAbility(player.abilityEvent, now);
    if (player.rushSpinEvent) this.rushSpin(player, now);
    if (player.dodgeEvent) this.elementDodge(player, now);
    this.slideHits(player, now);
    this.dashHits(player, now);
    this.playerHits(player, now);
    this.statusTicks(dt, now);
    this.fireArrows(player);
    this.stepSpear(dt, player, now, input.wasPressed('interact'));
    this.stepProjectiles(dt, player, now);
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

  /**
   * Applies a player hit to an enemy: damage, knockback (scaled by the enemy's weight), reactions,
   * feedback and events. Shared by weapon swings, abilities, burn ticks and reflected arrows.
   */
  private hitEnemy(
    e: Enemy,
    hit: HitInfo,
    from: { x: number; z: number },
    now: number,
    fx: { color?: number; sparks?: number; hitstop?: number; shake?: number; label?: string; combo?: boolean } = {},
  ): boolean {
    const { outcome } = resolveHit(e.combatant, hit, { now, stamina: 0, fromFront: true });
    if (outcome.result !== 'hit') return false;
    e.lastHurt = now;
    const dir = new THREE.Vector3(e.motor.x - from.x, 0, e.motor.z - from.z);
    if (dir.lengthSq() < 1e-6) dir.set(Math.sin(e.facing + Math.PI), 0, Math.cos(e.facing + Math.PI));
    dir.normalize();
    const kb = hit.knockback * e.def.knockbackTaken;
    if (hit.kind !== 'dot') {
      e.motor.vx = dir.x * kb;
      e.motor.vz = dir.z * kb;
    }
    if (hit.launch && e.def.knockbackTaken > 0.5 && (outcome.knockedDown || outcome.killed || outcome.vulnerable)) {
      e.motor.vy = hit.launch;
      e.motor.grounded = false;
    }
    if (outcome.killed) {
      e.react('dead');
      this.tokens.release(e.id);
      this.shooters.release(e.id);
      this.bus.emit('enemyKilled', { id: e.id, xp: e.def.xp });
    } else if (outcome.vulnerable) e.react('vulnerable');
    else if (outcome.knockedDown) e.react('knockdown');
    else if (outcome.staggered) e.react('stagger');
    const at = new THREE.Vector3(e.motor.x, e.motor.y + 1.15 * e.def.look.scale, e.motor.z);
    const glow = fx.color ?? elements[this.element].glow;
    if (hit.kind === 'dot') this.fx.burst(at, glow, 6, 3);
    else {
      this.fx.burst(at, 0xffffff, 10, 6, dir);
      this.fx.burst(at, glow, fx.sparks ?? 14, 7, dir);
    }
    if (outcome.killed) this.fx.ring(new THREE.Vector3(e.motor.x, e.motor.y, e.motor.z), glow, 3.5, 0.45);
    if (fx.hitstop) this.feedback.hitstop(fx.hitstop);
    if (fx.shake) this.feedback.shake(fx.shake);
    if (fx.combo !== false && hit.kind !== 'dot') {
      this.comboCount++;
      this.comboTimer = 2.2;
    }
    this.feedback.popup(at, fx.label ?? String(Math.min(outcome.damage, e.def.maxHealth)), fx.label || hit.damage >= 24 ? 'crit' : hit.kind === 'dot' ? 'info' : 'damage');
    if (outcome.vulnerable) this.feedback.popup(at.clone().add(new THREE.Vector3(0, 0.5, 0)), 'BROKEN — press F', 'info');
    this.bus.emit('hit', { attacker: 'player', target: e.id, damage: outcome.damage });
    return true;
  }

  private playerHits(player: Player, now: number): void {
    const atk = player.runner.current;
    if (!atk || !player.runner.hitActive) return;
    const def = atk.def;
    if (def.release !== undefined) return;
    const imbue = player.abilities.imbue;
    const isFinisher = def.id === player.weapon.finisher;
    // Heavy attacks, combo enders and finishers carry the element's signature effect.
    const heavy = atk.input === 'heavy' || atk.ender || isFinisher;
    const im = weaponHitMods(imbue, heavy);
    const glow = imbue ? elements[imbue.element].glow : undefined;
    for (const e of this.enemies) {
      if (!e.alive || e.combatant.alreadyHitBy(atk.instance)) continue;
      if (isFinisher && this.finisher?.enemy !== e) continue;
      if (!inArc({ x: player.motor.x, z: player.motor.z, facing: player.facing }, { x: e.motor.x, z: e.motor.z, radius: e.def.radius }, def.reach + im.reach, def.arc)) continue;
      // The last move of a combo string lands harder.
      const ender = atk.ender ? combatConfig.comboEnder : null;
      // A parry counter finishes off ordinary enemies that are already hurt.
      const isCounter = def.id === player.weapon.counter;
      const execute = isCounter && !e.def.superArmor && e.combatant.health <= e.def.maxHealth * combatConfig.block.counterExecute;
      // Frost: a heavy blow shatters a frozen enemy.
      const shatter = e.status.frozen && im.shatter > 1;
      if (shatter) e.thaw();
      const hit: HitInfo = {
        instance: atk.instance,
        damage: execute ? e.combatant.health : Math.round(def.damage * (ender?.damage ?? 1) * im.damage * (shatter ? im.shatter : 1)),
        poise: def.poise * (ender?.poise ?? 1) * im.poise * (shatter ? 2 : 1),
        knockback: isFinisher ? def.knockback / Math.max(0.2, e.def.knockbackTaken) : def.knockback * (ender?.knockback ?? 1) * im.knockback,
        launch: def.launch,
        knockdown: def.knockdown || im.knockdown,
        kind: 'melee',
        unblockable: isFinisher,
      };
      const label = isFinisher ? 'FINISHER' : execute ? 'COUNTER KILL' : shatter ? 'SHATTER' : isCounter ? 'COUNTER' : undefined;
      const landed = this.hitEnemy(e, hit, player.motor, now, { sparks: isFinisher || execute ? 80 : 14, hitstop: shatter ? 0.12 : def.hitstop, shake: shatter ? 0.45 : def.shake, label, color: glow });
      if (shatter) this.abilityFx.iceShards(new THREE.Vector3(e.motor.x, e.motor.y + 1, e.motor.z), elements.water.glow);
      if (!landed) continue;
      this.applyImbue(e, im);
      if (isFinisher) this.fx.ring(new THREE.Vector3(e.motor.x, e.motor.y, e.motor.z), elements[this.element].glow, 7, 0.8);
      if (im.explode && !this.explodedBy.has(atk.instance)) {
        this.explodedBy.add(atk.instance);
        if (this.explodedBy.size > 32) this.explodedBy = new Set([...this.explodedBy].slice(-16));
        this.explode({ x: e.motor.x, y: e.motor.y, z: e.motor.z }, imbue!.power, now);
      }
      // A clean combo ender keeps the coat burning longer.
      if (atk.ender && imbue && this.extendedBy !== atk.instance) {
        this.extendedBy = atk.instance;
        this.extendImbue(player, imbueConfig.extendCombo);
      }
    }
  }

  private extendImbue(player: Player, seconds: number): void {
    const added = player.abilities.extendImbue(seconds);
    if (added >= 0.5) this.feedback.popup(new THREE.Vector3(player.motor.x, player.motor.y + 2.1, player.motor.z), `+${Math.round(added)}s`, 'info');
  }

  /** Fire coat: a heavy hit bursts into a small explosion that hurts everyone around. */
  private explode(at: { x: number; y: number; z: number }, power: number, now: number): void {
    const c = imbueConfig.fire.explosion;
    const r = c.radius * (0.85 + 0.15 * power);
    const p = new THREE.Vector3(at.x, at.y, at.z);
    this.abilityFx.fireBurst(p, r, elements.fire.color, elements.fire.glow);
    this.fx.burst(p.clone().add(new THREE.Vector3(0, 1, 0)), elements.fire.glow, 40, 8);
    this.feedback.shake(0.35);
    const instance = nextDot++;
    for (const e of this.enemies) {
      if (!e.alive || Math.hypot(e.motor.x - at.x, e.motor.z - at.z) - e.def.radius > r) continue;
      const hit: HitInfo = { instance, damage: Math.round(c.damage * power), poise: 20, knockback: c.knockback, launch: 2, kind: 'melee' };
      if (this.hitEnemy(e, hit, at, now, { color: elements.fire.glow, sparks: 10, combo: false })) e.status.burn(imbueConfig.fire.burnDps * power, imbueConfig.fire.burnTime);
    }
  }

  /** Earth coat: where the thrown spear lands, stone spikes burst from the ground. */
  private stoneSpike(at: { x: number; y: number; z: number }, power: number, now: number): void {
    const c = imbueConfig.earth.spike;
    const p = new THREE.Vector3(at.x, at.y, at.z);
    this.abilityFx.stoneSpikes(p, c.radius);
    this.abilityFx.shockwave(p, c.radius, elements.earth.glow);
    this.fx.burst(p.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xb89a6a, 30, 7);
    this.feedback.shake(0.4);
    const instance = nextDot++;
    for (const e of this.enemies) {
      if (!e.alive || Math.hypot(e.motor.x - at.x, e.motor.z - at.z) - e.def.radius > c.radius) continue;
      this.hitEnemy(e, { instance, damage: Math.round(c.damage * power), poise: 40, knockback: 4, launch: c.launch, knockdown: true, kind: 'melee' }, at, now, { color: elements.earth.glow, sparks: 12, combo: false });
    }
  }

  // ------------------------------------------------------------------ elemental abilities

  private applyAbility(ev: AbilityEvent, now: number): void {
    const def: AnyAbilityDef = ev.def;
    const area = ev.area;
    const el = elements[def.element];
    const at = new THREE.Vector3(ev.x, ev.y, ev.z);
    const base = { instance: ev.instance, damage: Math.round(def.damage * ev.damageScale), poise: def.poise, knockback: def.knockback, launch: def.launch, knockdown: def.knockdown, kind: 'melee' as const };
    switch (def.kind) {
      case 'burst': {
        this.abilityFx.fireBurst(at, def.radius * area, el.color, el.glow);
        this.fx.burst(at.clone().add(new THREE.Vector3(0, 1, 0)), el.glow, 70, 10);
        this.feedback.shake(0.45);
        for (const e of this.enemies) {
          if (!e.alive || Math.hypot(e.motor.x - ev.x, e.motor.z - ev.z) - e.def.radius * area > def.radius * area) continue;
          if (this.hitEnemy(e, base, ev, now, { color: el.glow, sparks: 20 })) e.status.burn(def.burn.dps * ev.damageScale, def.burn.duration);
        }
        this.feedback.hitstop(0.07);
        break;
      }
      case 'wave': {
        this.abilityFx.wave(at, ev.facing, def.range * area, def.arc, el.glow);
        this.feedback.shake(0.3);
        for (const e of this.enemies) {
          if (!e.alive || !inArc({ x: ev.x, z: ev.z, facing: ev.facing }, { x: e.motor.x, z: e.motor.z, radius: e.def.radius * area }, def.range * area, def.arc)) continue;
          if (this.hitEnemy(e, base, ev, now, { color: el.glow })) e.status.soak(def.soak.slow, def.soak.duration);
          e.cancelAttack(e.def.role === 'ranged' ? this.shooters : this.tokens);
        }
        // Washes incoming arrows away.
        for (const p of this.projectiles.list) {
          if (p.team !== 'enemy' || p.dead) continue;
          if (inArc({ x: ev.x, z: ev.z, facing: ev.facing }, { x: p.x, z: p.z, radius: 0.3 }, def.range * area, def.arc + 10)) {
            p.dead = true;
            this.fx.burst(new THREE.Vector3(p.x, p.y, p.z), el.glow, 8, 4);
          }
        }
        break;
      }
      case 'aegis': {
        this.abilityFx.shockwave(at, def.radius * area, el.glow);
        this.fx.burst(at.clone().add(new THREE.Vector3(0, 0.3, 0)), 0xb89a6a, 40, 7);
        this.feedback.shake(0.5);
        for (const e of this.enemies) {
          if (!e.alive || Math.hypot(e.motor.x - ev.x, e.motor.z - ev.z) - e.def.radius * area > def.radius * area) continue;
          this.hitEnemy(e, base, ev, now, { color: el.glow });
        }
        break;
      }
      case 'dash':
        this.abilityFx.gale(at, ev.facing, def.distance * area, el.glow);
        this.fx.burst(at.clone().add(new THREE.Vector3(0, 1, 0)), el.glow, 24, 6);
        break;
    }
  }

  /** Gale Rush throws aside every enemy the dash passes through. */
  private dashHits(player: Player, now: number): void {
    const dash = player.dash;
    if (!dash) return;
    const def = abilities.air;
    if (def.kind !== 'dash') return;
    const scale = player.cast?.damageScale ?? 1;
    for (const e of this.enemies) {
      if (!e.alive || e.combatant.alreadyHitBy(dash.instance)) continue;
      if (Math.hypot(e.motor.x - player.motor.x, e.motor.z - player.motor.z) > def.hitRadius + e.def.radius) continue;
      const hit: HitInfo = { instance: dash.instance, damage: Math.round(def.damage * scale), poise: def.poise, knockback: def.knockback, launch: def.launch, knockdown: true, kind: 'melee' };
      // Knock sideways, out of the dash line.
      const side = { x: player.motor.x - dash.dir.z, z: player.motor.z + dash.dir.x };
      const s = (e.motor.x - player.motor.x) * -dash.dir.z + (e.motor.z - player.motor.z) * dash.dir.x >= 0 ? side : { x: player.motor.x + dash.dir.z, z: player.motor.z - dash.dir.x };
      this.hitEnemy(e, hit, s, now, { color: elements.air.glow, hitstop: 0.05, shake: 0.2 });
    }
  }

  /** Burn damage over time. */
  private statusTicks(dt: number, now: number): void {
    for (const e of this.enemies) {
      if (!e.alive) {
        e.status.clear();
        continue;
      }
      const dmg = e.status.tick(dt);
      if (dmg > 0) this.hitEnemy(e, { instance: nextDot++, damage: dmg, poise: 0, knockback: 0, kind: 'dot' }, e.motor, now, { color: elements.fire.glow, combo: false });
    }
  }

  // ------------------------------------------------------------------ weapon imbue (Z)

  /** Status effects of an imbued weapon on a hit enemy: burn, soak, chill stacks and freezing. */
  private applyImbue(e: Enemy, im: WeaponHitMods): void {
    if (!e.alive) return;
    if (im.burn) e.status.burn(im.burn.dps, im.burn.time);
    if (im.soak) e.status.soak(im.soak.slow, im.soak.time);
    if (im.chill && e.status.addChill(imbueConfig.water.freezeHits, imbueConfig.water.freezeTime)) {
      e.freeze(imbueConfig.water.freezeTime, e.def.role === 'ranged' ? this.shooters : this.tokens);
      const at = new THREE.Vector3(e.motor.x, e.motor.y + 1.6 * e.def.look.scale, e.motor.z);
      this.feedback.popup(at, 'FROZEN', 'info');
      this.fx.burst(at, elements.water.glow, 24, 4);
    }
  }

  // ------------------------------------------------------------------ Gale Rush spin, element dodges

  /** Gale Rush brakes in a spin strike around the player. */
  private rushSpin(player: Player, now: number): void {
    const ev = player.rushSpinEvent!;
    const r = galeRush.endSpinRadius * ev.area;
    const at = new THREE.Vector3(ev.x, ev.y, ev.z);
    this.abilityFx.shockwave(at, r, elements.air.glow);
    this.fx.burst(at.clone().add(new THREE.Vector3(0, 1, 0)), elements.air.glow, 30, 7);
    for (const e of this.enemies) {
      if (!e.alive || Math.hypot(e.motor.x - ev.x, e.motor.z - ev.z) - e.def.radius > r) continue;
      this.hitEnemy(e, { instance: ev.instance, damage: Math.round(galeRush.endSpinDamage * ev.damageScale), poise: 25, knockback: 7, launch: 2, kind: 'melee' }, ev, now, { color: elements.air.glow, hitstop: 0.05, shake: 0.2 });
    }
  }

  /** Start of Blast Hop (explosion where you stood) or Rock Pillar (shockwave and a rising column). */
  private elementDodge(player: Player, now: number): void {
    const ev = player.dodgeEvent!;
    const d = ev.def;
    const at = new THREE.Vector3(ev.x, ev.y, ev.z);
    const r = d.radius * ev.area;
    if (ev.el === 'fire') {
      this.abilityFx.fireBurst(at, r, elements.fire.color, elements.fire.glow);
      this.fx.burst(at.clone().add(new THREE.Vector3(0, 0.6, 0)), elements.fire.glow, 40, 8);
      this.feedback.shake(0.3);
    } else if (ev.el === 'earth') {
      this.abilityFx.pillar(at, 2.6);
      this.abilityFx.shockwave(at, r, elements.earth.glow);
      this.fx.burst(at.clone().add(new THREE.Vector3(0, 0.3, 0)), 0xb89a6a, 36, 7);
      this.feedback.shake(0.45);
    } else {
      this.fx.ring(at.clone().add(new THREE.Vector3(0, 0.05, 0)), elements.water.glow, 2, 0.35);
      return;
    }
    for (const e of this.enemies) {
      if (!e.alive || Math.hypot(e.motor.x - ev.x, e.motor.z - ev.z) - e.def.radius > r) continue;
      const hit: HitInfo = { instance: ev.instance, damage: Math.round(d.damage * ev.damageScale), poise: 30, knockback: d.knockback, launch: d.launch, knockdown: ev.el === 'earth', kind: 'melee' };
      if (this.hitEnemy(e, hit, ev, now, { color: elements[ev.el].glow, sparks: 16, combo: false }) && ev.el === 'fire') e.status.burn(imbueConfig.fire.burnDps, imbueConfig.fire.burnTime);
    }
  }

  /** Ice Slide trips everything it slides through: a small hit, soaked and chilled. */
  private slideHits(player: Player, now: number): void {
    const ed = player.edodge;
    if (!ed || ed.el !== 'water') return;
    const d = ed.def;
    for (const e of this.enemies) {
      if (!e.alive || e.combatant.alreadyHitBy(ed.instance)) continue;
      if (Math.hypot(e.motor.x - player.motor.x, e.motor.z - player.motor.z) > d.radius * ed.area + e.def.radius) continue;
      const side = { x: player.motor.x - ed.dir.x, z: player.motor.z - ed.dir.z };
      if (this.hitEnemy(e, { instance: ed.instance, damage: Math.round(d.damage * ed.damageScale), poise: 30, knockback: d.knockback, kind: 'melee' }, side, now, { color: elements.water.glow, sparks: 10, combo: false })) {
        e.status.soak(imbueConfig.water.slow, d.soak);
        this.applyImbue(e, { ...weaponHitMods(null), chill: true });
      }
    }
  }

  // ------------------------------------------------------------------ thrown spear

  private stepSpear(dt: number, player: Player, now: number, interact: boolean): void {
    const cfg = combatConfig.spearThrow;
    const ev = player.throwEvent;
    if (ev) {
      // Aim: lock target, else the enemy closest to the throw line, else straight ahead with a slight arc.
      let target: Enemy | null = this.lockTarget?.alive ? this.lockTarget : null;
      if (!target) {
        let best = Infinity;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const d = Math.hypot(e.motor.x - ev.x, e.motor.z - ev.z);
          if (d > cfg.aimRange || !inArc({ x: ev.x, z: ev.z, facing: ev.facing }, { x: e.motor.x, z: e.motor.z, radius: e.def.radius }, cfg.aimRange, cfg.aimArc)) continue;
          if (d < best) {
            best = d;
            target = e;
          }
        }
      }
      const to = target
        ? { x: target.motor.x, y: target.motor.y + 1.1 * target.def.look.scale, z: target.motor.z }
        : { x: ev.x + Math.sin(ev.facing) * 20, y: ev.y + 1.2, z: ev.z + Math.cos(ev.facing) * 20 };
      const sp = spearImbue(player.abilities.imbue);
      this.spear.throwFrom(ev, aimVelocity(ev, to, cfg.speed, cfg.gravity), nextDot++, sp.returns ? imbueConfig.air.spearReturn.delay : null);
      this.spearSpike = sp.spike;
      this.fx.burst(new THREE.Vector3(ev.x, ev.y, ev.z), elements[this.element].glow, 10, 4);
    }
    if (this.spear.state === 'flying') {
      const targets: CapsuleTarget[] = [];
      for (const e of this.enemies) if (e.alive) targets.push({ id: e.id, team: 'enemy', x: e.motor.x, y: e.motor.y, z: e.motor.z, radius: e.def.radius + 0.15, height: 1.8 * e.def.look.scale });
      const struck = this.spear.step(dt, this.groundAt, targets);
      const e = struck && this.enemies.find((x) => x.id === struck.id);
      const imbue = player.abilities.imbue;
      if (e) this.spearHit(e, player, now, 1);
      else if ((this.spear.state as string) === 'grounded') this.fx.burst(new THREE.Vector3(this.spear.x, this.spear.y + 0.1, this.spear.z), 0xc8b89a, 10, 3);
      if ((this.spear.state as string) === 'grounded') {
        // Impact: stone spikes (earth coat) or a blast (fire coat) where it lands.
        const at = { x: this.spear.x, y: this.spear.y, z: this.spear.z };
        if (this.spearSpike) this.stoneSpike(at, imbue?.power ?? 1, now);
        if (imbueElements(imbue).includes('fire')) this.explode(at, imbue!.power, now);
        this.spearSpike = false;
      }
    }
    // Wind coat: the spear flies back to the hand, cutting what it passes.
    if (this.spear.returns) {
      const targets: CapsuleTarget[] = [];
      for (const e of this.enemies) if (e.alive) targets.push({ id: e.id, team: 'enemy', x: e.motor.x, y: e.motor.y, z: e.motor.z, radius: e.def.radius + 0.15, height: 1.8 * e.def.look.scale });
      const r = this.spear.stepReturn(dt, { x: player.motor.x, y: player.motor.y + 1.3, z: player.motor.z }, imbueConfig.air.spearReturn.speed, targets);
      if (r.event === 'began') {
        this.spear.instance = nextDot++;
        this.fx.burst(new THREE.Vector3(this.spear.x, this.spear.y, this.spear.z), elements.air.glow, 16, 4);
      }
      for (const t of r.struck) {
        const e = this.enemies.find((x) => x.id === t.id);
        if (e && !e.combatant.alreadyHitBy(this.spear.instance)) this.spearHit(e, player, now, 0.6);
      }
      if (r.event === 'caught') {
        player.spearReturned();
        this.fx.burst(new THREE.Vector3(player.motor.x, player.motor.y + 1.3, player.motor.z), elements.air.glow, 20, 4);
        this.bus.emit('spearPickedUp', {});
      }
    }
    // Pick up: walk over it, or press E nearby.
    if (player.spearAway && this.spear.state === 'held') player.spearReturned();
    else if (this.spear.state === 'grounded' && player.combatant.alive) {
      const r = interact ? cfg.pickupInteract : cfg.pickupWalk;
      if (this.spear.canPickUp(player.motor.x, player.motor.z, r)) {
        this.spear.pickUp();
        player.spearReturned();
        this.bus.emit('spearPickedUp', {});
      }
    }
  }

  private spearSpike = false;

  /** The thrown (or returning) spear strikes an enemy. */
  private spearHit(e: Enemy, player: Player, now: number, scale: number): void {
    const cfg = combatConfig.spearThrow;
    const from = { x: e.motor.x - this.spear.dir.x, z: e.motor.z - this.spear.dir.z };
    const imbue = player.abilities.imbue;
    const im = weaponHitMods(imbue, scale >= 1);
    const hit: HitInfo = { instance: this.spear.instance, damage: Math.round(cfg.damage * im.damage * scale), poise: cfg.poise * im.poise * scale, knockback: cfg.knockback * im.knockback, kind: 'projectile' };
    if (this.hitEnemy(e, hit, from, now, { hitstop: 0.1, shake: 0.3, sparks: 24, color: imbue ? elements[imbue.element].glow : undefined })) this.applyImbue(e, { ...im, explode: false });
  }

  /** Is the thrown spear lying within reach of E? (HUD prompt) */
  spearNearby(player: Player): boolean {
    return this.spear.canPickUp(player.motor.x, player.motor.z, combatConfig.spearThrow.pickupInteract);
  }

  // ------------------------------------------------------------------ arrows

  private fireArrows(player: Player): void {
    for (const e of this.enemies) {
      if (!e.readyToFire) continue;
      const a = e.attack!;
      a.fired = true;
      const pr = a.def.projectile!;
      const from = { x: e.motor.x + Math.sin(e.facing) * 0.5, y: e.motor.y + 1.45, z: e.motor.z + Math.cos(e.facing) * 0.5 };
      // Lead the target a little, aim at the chest.
      const d = Math.hypot(player.motor.x - from.x, player.motor.z - from.z);
      const lead = (d / pr.speed) * 0.5;
      const to = { x: player.motor.x + player.motor.vx * lead, y: player.motor.y + 1.1, z: player.motor.z + player.motor.vz * lead };
      const v = aimVelocity(from, to, pr.speed, pr.gravity);
      this.projectiles.spawn({ instance: a.instance, owner: e.id, team: 'enemy', ...from, ...v, gravity: pr.gravity, life: pr.life, damage: a.def.damage, poise: a.def.poise, knockback: a.def.knockback });
      e.view.stopAction(0.25);
      this.fx.burst(new THREE.Vector3(from.x, from.y, from.z), 0xffe0a0, 6, 3);
    }
  }

  private stepProjectiles(dt: number, player: Player, now: number): void {
    if (!this.projectiles.list.length) return;
    const targets: CapsuleTarget[] = [];
    if (player.combatant.alive) targets.push({ id: 'player', team: 'player', x: player.motor.x, y: player.motor.y, z: player.motor.z, radius: PLAYER_RADIUS + 0.1, height: 1.75 });
    for (const e of this.enemies) if (e.alive) targets.push({ id: e.id, team: 'enemy', x: e.motor.x, y: e.motor.y, z: e.motor.z, radius: e.def.radius + 0.1, height: 1.8 * e.def.look.scale });
    for (const { projectile: p, target } of this.projectiles.step(dt, this.groundAt, targets)) {
      if (target.id === 'player') {
        const shooter = this.enemies.find((e) => e.id === p.owner);
        const res = this.damagePlayer(player, { instance: p.instance, damage: p.damage, poise: p.poise, knockback: p.knockback, kind: 'projectile' }, { x: p.x - p.vx, z: p.z - p.vz }, now, shooter ?? null);
        if (res === 'parried' && shooter?.alive) {
          // Perfect parry sends the arrow back at the archer.
          this.projectiles.reflect(p, 'player', { x: shooter.motor.x, y: shooter.motor.y + 1.1, z: shooter.motor.z });
          p.instance = nextDot++;
          p.damage *= 2;
          p.x = player.motor.x;
          p.y = player.motor.y + 1.2;
          p.z = player.motor.z;
        }
      } else {
        const e = this.enemies.find((x) => x.id === target.id);
        if (e) this.hitEnemy(e, { instance: p.instance, damage: p.damage, poise: p.poise * 3, knockback: p.knockback, kind: 'projectile' }, { x: p.x - p.vx, z: p.z - p.vz }, now, { label: 'RETURNED', hitstop: 0.08 });
      }
    }
    for (const p of this.projectiles.prune()) if (p.age < p.life) this.fx.burst(new THREE.Vector3(p.x, p.y + 0.1, p.z), 0xc8b89a, 4, 2);
  }

  // ------------------------------------------------------------------ enemy attacks

  private enemyHits(player: Player, now: number): void {
    const pc = player.combatant;
    for (const e of this.enemies) {
      const atk = e.attack;
      if (!atk || !e.hitActive || pc.alreadyHitBy(atk.instance)) continue;
      const def = atk.def;
      if (def.aoe) {
        const c = e.aoeCenter();
        if (Math.hypot(player.motor.x - c.x, player.motor.z - c.z) > def.aoe + PLAYER_RADIUS) continue;
        // The ground slam: debris and a shockwave whether it connects or not.
      } else {
        const pPos = { x: player.motor.x, z: player.motor.z, radius: PLAYER_RADIUS };
        if (!inArc({ x: e.motor.x, z: e.motor.z, facing: e.facing }, pPos, def.reach, def.arc)) continue;
      }
      this.damagePlayer(player, { instance: atk.instance, damage: def.damage, poise: def.poise, knockback: def.knockback, knockdown: def.knockdown, kind: 'melee', unblockable: def.unblockable }, e.motor, now, e);
    }
    // Slam impact effects (once per swing, at the start of the hit window).
    for (const e of this.enemies) {
      const a = e.attack;
      if (!a?.def.aoe || a.fired || a.t < a.def.hitStart) continue;
      a.fired = true;
      const c = e.aoeCenter();
      const at = new THREE.Vector3(c.x, this.groundAt(c.x, c.z), c.z);
      this.abilityFx.shockwave(at, a.def.aoe, 0xff8a5a);
      this.fx.burst(at.clone().add(new THREE.Vector3(0, 0.3, 0)), 0x9a8a70, 36, 7);
      this.feedback.shake(0.5);
    }
  }

  /**
   * Resolves a hit on the player (melee or arrow) with block, parry, dodge, Stone Aegis and death.
   * Returns the outcome kind so arrows can be reflected on a parry.
   */
  private damagePlayer(player: Player, hit: HitInfo, from: { x: number; z: number }, now: number, attacker: Enemy | null): string {
    const pc = player.combatant;
    const fromFront = isInFront({ x: player.motor.x, z: player.motor.z, facing: player.facing }, from);
    const { outcome, staminaCost } = resolveHit(pc, hit, { now, stamina: player.stamina.value, fromFront });
    const at = new THREE.Vector3(player.motor.x, player.motor.y + 1.2, player.motor.z);
    const push = new THREE.Vector3(player.motor.x - from.x, 0, player.motor.z - from.z);
    if (push.lengthSq() < 1e-6) push.set(-Math.sin(player.facing), 0, -Math.cos(player.facing));
    push.normalize();
    const armored = pc.armored;
    const kb = hit.knockback * (armored ? 0.15 : 1);
    switch (outcome.result) {
      case 'parried': {
        if (attacker && hit.kind === 'melee') {
          attacker.cancelAttack(this.tokens);
          attacker.combatant.setState('staggered', attacker.def.superArmor ? 0.8 : 1.2);
          attacker.combatant.poise = Math.max(0, attacker.combatant.poise - attacker.def.maxPoise * 0.5);
          attacker.react('parried');
          // Assassin's-Creed-style answer: the player strikes back on their own.
          if (player.combatant.free && !player.scripted) player.autoCounter(attacker.motor);
        } else player.counterUntil = now + combatConfig.block.counterWindow;
        player.parryLockUntil = -Infinity;
        // A perfect parry feeds the weapon coat.
        this.extendImbue(player, imbueConfig.extendParry);
        this.fx.burst(at.clone().addScaledVector(push, -0.6), 0xffe2a0, 40, 9);
        this.fx.ring(new THREE.Vector3(player.motor.x, player.motor.y, player.motor.z), 0xffe2a0, 3, 0.35);
        this.feedback.slowmo(combatConfig.block.parrySlowmo, combatConfig.block.parrySlowmoScale);
        this.feedback.shake(0.35);
        this.feedback.popup(at, hit.kind === 'projectile' ? 'DEFLECT' : 'PARRY', 'info');
        this.wardFlash = 1;
        if (attacker) this.bus.emit('parry', { enemy: attacker.id });
        break;
      }
      case 'blocked':
        player.stamina.value = Math.max(0, player.stamina.value - staminaCost);
        player.motor.vx = push.x * kb * 0.6;
        player.motor.vz = push.z * kb * 0.6;
        this.fx.burst(at.clone().addScaledVector(push, -0.6), 0xffffff, 12, 6);
        this.feedback.shake(0.15);
        this.wardFlash = 1;
        if (outcome.guardBroken) {
          player.view.playAction('hit_to_body_01', 0.9);
          this.feedback.popup(at, 'GUARD BROKEN', 'player');
        }
        break;
      case 'evaded':
        if (!player.dash) this.feedback.popup(at, 'evade', 'info');
        break;
      case 'hit': {
        player.motor.vx = push.x * kb;
        player.motor.vz = push.z * kb;
        this.fx.burst(at, armored ? 0xd8c27a : 0xff6a5a, 14, 6, push);
        this.feedback.shake(0.3);
        this.feedback.hitstop(0.05);
        this.feedback.popup(at, String(outcome.damage), 'player');
        if (outcome.killed) {
          player.interrupt();
          player.endAegis();
          player.view.playAction('fall_down', 1.2, { hold: true, range: [0, 0.8] });
          this.lockTarget = null;
          this.bus.emit('playerDied', {});
        } else if (outcome.knockedDown) {
          player.interrupt();
          player.view.playAction('fall_down', 1.2, { range: [0, 1] });
        } else if (outcome.staggered) {
          player.interrupt();
          player.view.playAction(Math.random() < 0.5 ? 'hurt' : 'hit_to_head', 0.5, { range: [0, 0.8] });
        }
        this.bus.emit('hit', { attacker: attacker?.id ?? 'arrow', target: 'player', damage: outcome.damage });
        break;
      }
    }
    return outcome.result;
  }

  /** Keeps bodies from overlapping. */
  private separate(player: Player): void {
    const bodies = [{ m: player.motor, r: PLAYER_RADIUS, alive: player.combatant.alive && !player.dash, heavy: 1 }, ...this.enemies.map((e) => ({ m: e.motor, r: e.def.radius, alive: e.alive, heavy: e.def.knockbackTaken }))];
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
        // Heavier bodies (low knockbackTaken) get pushed less.
        const share = a.heavy / (a.heavy + b.heavy);
        const over = min - d;
        a.m.x -= (dx / d) * over * share;
        a.m.z -= (dz / d) * over * share;
        b.m.x += (dx / d) * over * (1 - share);
        b.m.z += (dz / d) * over * (1 - share);
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
      const a = e.attack;
      // Unblockable attacks glint red and mark the ground where they land.
      (m.glint.material as THREE.SpriteMaterial).color.setHex(a?.def.unblockable ? 0xff4030 : 0xffd27a);
      if (a?.def.aoe && a.t < a.def.hitEnd && e.alive) {
        const c = e.aoeCenter();
        this.abilityFx.warning(e.id, { x: c.x, y: this.groundAt(c.x, c.z), z: c.z }, a.def.aoe, Math.min(1, a.t / a.def.hitStart));
      } else this.abilityFx.warning(e.id, null, 0, 0);
      // Status visuals: embers while burning, droplets while soaked.
      if (e.alive && e.status.burning && Math.random() < dt * 14) this.fx.burst(new THREE.Vector3(e.renderPosition.x, e.renderPosition.y + 0.6 + Math.random() * 1.2, e.renderPosition.z), elements.fire.glow, 2, 1.5);
      if (e.alive && e.status.soaked && Math.random() < dt * 8) this.fx.burst(new THREE.Vector3(e.renderPosition.x, e.renderPosition.y + 1.6, e.renderPosition.z), elements.water.glow, 2, 1);
      if (m.glint.visible) {
        e.view.weaponSocket.getWorldPosition(m.glint.position);
        m.glint.position.y += 0.35;
        const k = (e.attack!.t - (e.attack!.def.hitStart - 0.32)) / 0.32;
        m.glint.scale.setScalar(0.4 + Math.sin(k * Math.PI) * 0.9);
      }
      const shell = this.ice.get(e.id);
      if (shell) {
        shell.visible = e.alive && e.status.frozen;
        if (shell.visible) {
          const s = e.def.look.scale;
          shell.position.set(e.renderPosition.x, e.renderPosition.y + 0.95 * s, e.renderPosition.z);
          shell.scale.set((e.def.radius + 0.35) * e.def.look.width, 1.05 * s, (e.def.radius + 0.35) * e.def.look.width);
        }
      }
      // Chill stacks: frost motes.
      if (e.alive && e.status.chill > 0 && Math.random() < dt * 6 * e.status.chill) this.fx.burst(new THREE.Vector3(e.renderPosition.x, e.renderPosition.y + 0.5 + Math.random(), e.renderPosition.z), 0xcfefff, 2, 0.8);
      m.ring.visible = e.alive && e.combatant.state === 'vulnerable';
      if (m.ring.visible) {
        m.ring.position.set(e.renderPosition.x, e.renderPosition.y + 2.05 * e.def.look.scale, e.renderPosition.z);
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
    this.abilityFx.syncArrows(this.projectiles.list);
    // Imbued weapon: glowing blade, aura, swing trail, and embers / droplets / grit / wisps from the hand.
    const imbue = player.abilities.imbue;
    const els = player.combatant.alive ? imbueElements(imbue) : [];
    const colors = els.map((el) => elements[el].glow);
    this.imbueFx.update(dt, this.time, player.view.weaponSocket, player.weapon.id, colors, !!player.runner.current);
    if (colors.length) {
      const glow = colors[Math.random() < 0.5 ? 0 : colors.length - 1];
      player.view.weaponSocket.getWorldPosition(this.tmpV);
      if (Math.random() < dt * 40) this.fx.burst(this.tmpV.clone(), glow, 2, 1.2);
      if (player.armed) {
        const tip = this.tmpV.clone().add(new THREE.Vector3(0, player.weapon.id === 'spear' ? 1.6 : 0.8, 0).applyQuaternion(player.view.weaponSocket.getWorldQuaternion(new THREE.Quaternion())));
        if (Math.random() < dt * 30) this.fx.burst(tip, glow, 3, 1.4);
      }
    }
    // Z gesture: a streak of the element running from the guard to the tip.
    if (player.gestureT > 0 && colors.length) {
      const k = 1 - player.gestureT / imbueConfig.gestureTime;
      const span = player.weapon.id === 'spear' ? 1.8 : player.weapon.id === 'sword' ? 0.9 : 0.15;
      const p = new THREE.Vector3(0, span * Math.min(1, k * 1.4), 0).applyQuaternion(player.view.weaponSocket.getWorldQuaternion(new THREE.Quaternion())).add(player.view.weaponSocket.getWorldPosition(this.tmpV));
      this.fx.burst(p, colors[colors.length - 1], 3, 1.5);
    }
    if (imbue && (imbue !== this.lastImbue || imbue.second !== this.lastImbueSecond)) {
      player.view.weaponSocket.getWorldPosition(this.tmpV);
      for (const c of colors) this.fx.burst(this.tmpV.clone(), c, 40, 5);
      this.fx.ring(new THREE.Vector3(player.renderPosition.x, player.renderPosition.y + 0.05, player.renderPosition.z), colors[colors.length - 1], imbue.second ? 3.4 : 2.2, 0.45);
    }
    this.lastImbue = imbue;
    this.lastImbueSecond = imbue?.second ?? null;
    // Wind trail behind Gale Rush, wisps while gliding, frost behind Ice Slide.
    const feet = new THREE.Vector3(player.renderPosition.x, player.renderPosition.y, player.renderPosition.z);
    if (player.dash) {
      this.fx.burst(feet.clone().add(new THREE.Vector3(0, 0.4 + Math.random() * 1.2, 0)), elements.air.glow, 4, 2.5);
      this.fx.burst(feet.clone().add(new THREE.Vector3(0, 1, 0)), 0xffffff, 2, 1.5);
    }
    if (player.gliding && Math.random() < dt * 25) this.fx.burst(feet.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, 0.9, (Math.random() - 0.5) * 0.6)), elements.air.glow, 2, 1.2);
    if (player.edodge?.el === 'water' && Math.random() < dt * 30) this.abilityFx.iceTrail(feet, elements.water.glow);
    const jb = player.jumpBurst;
    if (jb && jb.at !== this.lastJumpBurst) {
      this.lastJumpBurst = jb.at;
      const at = new THREE.Vector3(player.renderPosition.x, player.renderPosition.y + 0.05, player.renderPosition.z);
      this.abilityFx.shockwave(at, jb.kind === 'high' ? 2.6 : 1.6, elements.air.glow);
      this.fx.burst(at, elements.air.glow, jb.kind === 'high' ? 36 : 18, jb.kind === 'high' ? 6 : 4);
    }
    // The thrown spear: along its flight, then stuck in the ground at the angle it landed.
    const sp = this.spear;
    this.spearMesh.visible = sp.state !== 'held';
    if (this.spearMesh.visible) {
      const d = new THREE.Vector3(sp.dir.x, sp.dir.y, sp.dir.z).normalize();
      if (sp.state === 'grounded' && d.y > -0.35) d.setY(-0.6).normalize();
      this.spearMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      // Grip at the origin, head 1.66 m along +Y: flying, centre it; grounded, bury the head.
      const back = sp.state === 'grounded' ? 1.45 : 0.8;
      this.spearMesh.position.set(sp.x - d.x * back, sp.y - d.y * back, sp.z - d.z * back);
    }
    this.abilityFx.setAegis(player.aegisT > 0, player.renderPosition, this.time, player.aegisT);
    this.abilityFx.update(dt);
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
