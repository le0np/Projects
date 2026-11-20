import * as THREE from 'three';
import { AssetRegistry } from '../assets/AssetRegistry';
import type { CharacterView } from '../animation/CharacterView';
import { GltfCharacter } from '../animation/GltfCharacter';
import { PlaceholderHumanoid } from '../animation/PlaceholderHumanoid';
import { elements } from '../config/elements';
import { regions } from '../config/regions';
import { defaultAppearance, type CharacterLook } from '../entities/appearance';
import { Player } from '../entities/Player';
import { InputManager } from '../input/InputManager';
import { Atmosphere } from '../render/Atmosphere';
import { CameraRig } from '../render/CameraRig';
import { Renderer } from '../render/Renderer';
import { Hud } from '../ui/Hud';
import { TitleScreen, type TitleChoice } from '../ui/TitleScreen';
import { Region } from '../world/Region';
import { EventBus, type GameEvents } from './EventBus';
import { FixedLoop } from './FixedLoop';
import { Time } from './Time';

type Mode = 'title' | 'playing';

/** Top-level orchestrator: owns systems, switches between title and gameplay, runs the frame loop. */
export class Game {
  readonly bus = new EventBus<GameEvents>();
  readonly time = new Time();
  readonly assets = new AssetRegistry();
  private renderer: Renderer;
  private input: InputManager;
  private loop = new FixedLoop(1 / 60);
  private scene = new THREE.Scene();
  private hud: Hud;
  private title: TitleScreen;
  private mode: Mode = 'title';
  private region: Region | null = null;
  private atmosphere: Atmosphere | null = null;
  private player: Player | null = null;
  private rig: CameraRig | null = null;
  private paused = false;
  private hadLock = false;
  private choice: TitleChoice = { element: 'earth', presentation: 'feminine' };
  private last = performance.now();
  private fps = 0;
  private frameCount = 0;
  private fpsTimer = 0;

  constructor(container: HTMLElement) {
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    container.append(canvas);
    const params = new URLSearchParams(location.search);
    const quality = (params.get('quality') as 'low' | 'medium' | 'high') ?? 'high';
    this.renderer = new Renderer(canvas, quality);
    this.input = new InputManager(canvas);
    this.hud = new Hud(container);
    this.hud.root.hidden = true;
    const el = params.get('element');
    if (el && el in elements) this.choice.element = el as TitleChoice['element'];
    this.title = new TitleScreen(container, this.choice, (c) => this.enterWorld(c));
    this.title.root.addEventListener('click', () => {
      // Live-preview the region of the selected element behind the title.
      const sel = this.title.root.querySelector<HTMLElement>('.el-card.selected')?.dataset.element;
      if (sel && sel !== this.choice.element && this.mode === 'title') {
        this.choice.element = sel as TitleChoice['element'];
        this.buildRegion(elements[this.choice.element].startRegion);
      }
    });
    this.hud.onPauseAction((a) => (a === 'menu' ? this.showTitle() : this.input.requestPointerLock()));
    canvas.addEventListener('click', () => {
      if (this.mode === 'playing') this.input.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      if (locked) this.hadLock = true;
      if (this.mode === 'playing' && this.hadLock) this.setPaused(!locked);
    });
    this.bus.on('regionEntered', ({ regionId }) => {
      const r = regions[regionId];
      this.hud.showBanner(r.name, r.subtitle);
    });
  }

  async init(): Promise<void> {
    await this.assets.init();
    this.buildRegion(elements[this.choice.element].startRegion);
    const params = new URLSearchParams(location.search);
    if (params.has('play')) this.enterWorld({ ...this.choice, presentation: (params.get('body') as TitleChoice['presentation']) ?? this.choice.presentation });
    requestAnimationFrame(this.frame);
  }

  private buildRegion(id: string): void {
    this.region?.dispose();
    this.atmosphere?.dispose();
    const def = regions[id];
    this.region = new Region(def);
    this.scene.add(this.region.group);
    this.atmosphere = new Atmosphere(this.scene, this.renderer.renderer, def, this.renderer.renderer.shadowMap.enabled);
    this.renderer.exposure = def.atmosphere.exposure;
    this.rig = new CameraRig(this.renderer.camera, (x, z) => this.region!.terrain.heightAt(x, z));
  }

  private async enterWorld(choice: TitleChoice): Promise<void> {
    this.choice = choice;
    const regionId = elements[choice.element].startRegion;
    if (this.region?.def.id !== regionId) this.buildRegion(regionId);
    const region = this.region!;
    const look: CharacterLook = {
      element: choice.element,
      appearance: {
        ...defaultAppearance,
        presentation: choice.presentation,
        hairStyle: choice.presentation === 'feminine' ? 'long' : 'short',
        hairColor: choice.presentation === 'feminine' ? 0x2b2235 : 0x4a3426,
        build: choice.presentation === 'feminine' ? 0.3 : 0.55,
      },
    };
    this.player?.view.dispose();
    this.player = new Player(new PlaceholderHumanoid(look), this.bus);
    this.scene.add(this.player.view.object);
    const facing = Math.atan2(region.landmark.x - region.spawn.x, region.landmark.z - region.spawn.z);
    this.player.spawn(region.spawn, facing);
    this.rig!.snapBehind(facing);
    this.mode = 'playing';
    this.title.visible = false;
    this.hud.root.hidden = false;
    this.setPaused(false);
    this.hadLock = false;
    this.input.requestPointerLock();
    this.bus.emit('regionEntered', { regionId });

    const view = await this.loadPlayerView(look);
    if (view && this.player) this.player.replaceView(view);
  }

  /** Uses the Tripo model when it exists in the runtime manifest; otherwise keeps the placeholder. */
  private async loadPlayerView(look: CharacterLook): Promise<CharacterView | null> {
    const id = look.appearance.presentation === 'feminine' ? 'player_feminine' : 'player_masculine';
    const asset = this.assets.get(id);
    if (!asset) return null;
    try {
      const gltf = await this.assets.load(asset.model);
      const clips = await this.assets.loadClips(asset, gltf);
      return new GltfCharacter(asset, gltf, clips, look.appearance.height);
    } catch (err) {
      this.bus.emit('assetFallback', { assetId: id, reason: String(err) });
      console.warn(`[assets] ${id} failed to load, keeping placeholder`, err);
      return null;
    }
  }

  private showTitle(): void {
    this.mode = 'title';
    this.input.exitPointerLock();
    this.player?.view.dispose();
    this.player = null;
    this.setPaused(false);
    this.hud.root.hidden = true;
    this.title.visible = true;
  }

  private setPaused(p: boolean): void {
    this.paused = p;
    this.hud.setPaused(p);
  }

  private frame = (now: number) => {
    requestAnimationFrame(this.frame);
    const realDt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.frameCount++;
    this.fpsTimer += realDt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }
    const dt = this.paused ? 0 : this.time.advance(realDt);
    if (this.mode === 'playing' && this.player && this.region && this.rig) this.updatePlaying(dt, realDt);
    else this.updateTitle(realDt);
    this.region?.update(dt || realDt, this.time.realElapsed);
    this.renderer.render(this.scene);
  };

  private updatePlaying(dt: number, realDt: number): void {
    const player = this.player!;
    const rig = this.rig!;
    const input = this.input;
    if (input.wasPressed('toggleHelp')) this.hud.toggleHelp();
    if (input.wasPressed('toggleDebug')) this.hud.toggleDebug();
    const mouse = input.consumeMouse();
    if (!this.paused) {
      rig.rotate(mouse.dx, mouse.dy);
      if (mouse.wheel) rig.zoom(mouse.wheel);
      const { steps, alpha } = this.loop.advance(dt);
      for (let i = 0; i < steps; i++) {
        player.step(this.loop.step, input, rig.forward(), this.region!.collision);
        input.endStep();
      }
      player.render(dt, alpha);
    }
    rig.update(realDt, player.renderPosition, player.sprinting);
    this.atmosphere!.follow(player.renderPosition, this.time.realElapsed);
    const m = player.motor;
    this.hud.update(realDt, player.stamina.ratio, player.stamina.exhausted, {
      fps: this.fps,
      region: this.region!.def.id,
      pos: `${m.x.toFixed(1)}, ${m.y.toFixed(1)}, ${m.z.toFixed(1)}`,
      speed: m.horizontalSpeed.toFixed(2),
      grounded: String(m.grounded),
      view: player.view.source,
      assets: this.assets.count,
      draws: this.renderer.info.render.calls,
      tris: this.renderer.info.render.triangles,
    });
  }

  private titleAngle = 0;
  private updateTitle(dt: number): void {
    if (!this.region) return;
    this.titleAngle += dt * 0.05;
    const c = this.region.landmark;
    const cam = this.renderer.camera;
    const r = 30;
    const x = c.x + Math.sin(this.titleAngle) * r;
    const z = c.z + Math.cos(this.titleAngle) * r;
    cam.position.set(x, Math.max(c.y + 5, this.region.terrain.heightAt(x, z) + 3), z);
    cam.lookAt(c.x, c.y + 9, c.z);
    this.atmosphere?.follow(c, this.time.realElapsed);
  }

  /** Small read-only hook for automated smoke tests. */
  debugState() {
    const m = this.player?.motor;
    return {
      mode: this.mode,
      paused: this.paused,
      region: this.region?.def.id ?? null,
      view: this.player?.view.source ?? null,
      position: m ? { x: m.x, y: m.y, z: m.z } : null,
      grounded: m?.grounded ?? null,
      vy: m?.vy ?? null,
      stamina: this.player?.stamina.value ?? null,
      fps: this.fps,
    };
  }
}
