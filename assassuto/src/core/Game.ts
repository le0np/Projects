import * as THREE from 'three';
import { AssetRegistry } from '../assets/AssetRegistry';
import { canApplyLive, createPlayerView } from '../animation/characterFactory';
import type { CharacterView } from '../animation/CharacterView';
import { GltfCharacter } from '../animation/GltfCharacter';
import { cameraConfig } from '../config/camera';
import { echoIntroLines } from '../config/echo';
import { elementOrder, elements, type ElementId } from '../config/elements';
import { regions } from '../config/regions';
import type { CharacterLook } from '../entities/appearance';
import { EchoView } from '../entities/EchoView';
import { Player } from '../entities/Player';
import { InputManager } from '../input/InputManager';
import { Atmosphere } from '../render/Atmosphere';
import { CameraRig } from '../render/CameraRig';
import { Renderer } from '../render/Renderer';
import { LocalStorageBackend, SaveManager } from '../save/SaveManager';
import { newSave, type EchoConfig, type SaveData } from '../save/SaveSchema';
import { loadSettings, saveSettings, type Settings } from '../save/Settings';
import { resolveLoadPosition } from '../save/restore';
import { CharacterCreator, type CreatorState, type CreatorStep } from '../ui/CharacterCreator';
import { CreditsPanel } from '../ui/CreditsPanel';
import { toast } from '../ui/dom';
import { Hud } from '../ui/Hud';
import { IntroOverlay } from '../ui/IntroOverlay';
import { MainMenu } from '../ui/MainMenu';
import { SettingsPanel } from '../ui/SettingsPanel';
import { Region } from '../world/Region';
import { CombatDirector } from '../combat/CombatDirector';
import { attachWeapon, buildWeapon, detachWeapon } from '../combat/WeaponModels';
import { combatConfig } from '../config/combat';
import { Fx } from '../render/Fx';
import { CombatHud } from '../ui/CombatHud';
import { ShrinePanel } from '../ui/ShrinePanel';
import { abilities } from '../config/abilities';
import { progressionConfig, skills } from '../config/skills';
import { gainXp } from '../entities/Progression';
import { discoveryConfig, shrineId } from '../config/discovery';
import { EventBus, type GameEvents } from './EventBus';
import { FixedLoop } from './FixedLoop';
import { angleDelta, damp, lerp, smoothstep } from './math';
import { Time } from './Time';

type Mode = 'menu' | 'creator' | 'intro' | 'playing';

const AUTOSAVE_INTERVAL = 60;
const INTRO_LENGTH = 15;

/** Top-level orchestrator: owns systems and switches between menu, creator, intro and gameplay. */
export class Game {
  readonly bus = new EventBus<GameEvents>();
  readonly time = new Time();
  readonly assets = new AssetRegistry();
  private storage = new LocalStorageBackend();
  readonly saves = new SaveManager(this.storage);
  private settings: Settings = loadSettings(this.storage);
  private renderer: Renderer;
  private input: InputManager;
  private loop = new FixedLoop(1 / 60);
  private scene = new THREE.Scene();
  private ui: HTMLElement;
  private hud: Hud;
  private menu: MainMenu;
  private creator: CharacterCreator;
  private settingsPanel: SettingsPanel;
  private credits: CreditsPanel;
  private intro: IntroOverlay;
  private mode: Mode = 'menu';
  private region: Region | null = null;
  private atmosphere: Atmosphere | null = null;
  private player: Player | null = null;
  private rig: CameraRig | null = null;
  private echo: EchoView | null = null;
  private echoPos = new THREE.Vector3();
  private save: SaveData | null = null;
  private paused = false;
  private hadLock = false;
  private lockPauseAt = 0;
  private last = performance.now();
  private fps = 0;
  private frameCount = 0;
  private fpsTimer = 0;
  private autosaveTimer = 0;
  private menuAngle = 0;
  // Creator preview
  private preview: CharacterView | null = null;
  private previewLook: CharacterLook | null = null;
  private previewYaw = 0;
  private previewStep: CreatorStep = 'appearance';
  private previewToken = 0;
  private previewEchoKey = '';
  // Intro
  private introT = 0;
  private introLine = -1;
  // Combat
  private fx = new Fx();
  private director: CombatDirector;
  private combatHud: CombatHud;
  private hitstopT = 0;
  private slowmoT = 0;
  private slowmoScale = 1;
  private shot: { focus: THREE.Vector3; yaw: number } | null = null;
  private deathTimer = 0;
  private weaponShown = '';
  // Discovery
  private shrinePanel: ShrinePanel;
  private traveling = false;

  constructor(container: HTMLElement) {
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    container.append(canvas);
    this.ui = container;
    const params = new URLSearchParams(location.search);
    const q = params.get('quality');
    if (q === 'low' || q === 'medium' || q === 'high') this.settings.quality = q;
    this.renderer = new Renderer(canvas, this.settings.quality);
    this.input = new InputManager(canvas);
    this.hud = new Hud(container);
    this.hud.root.hidden = true;
    this.menu = new MainMenu(container, {
      newGame: () => this.openCreator(),
      continueGame: () => this.continueGame(),
      settings: () => this.settingsPanel.open(this.settings),
      credits: () => this.credits.open(),
    });
    this.creator = new CharacterCreator(container, {
      change: (s, step) => this.onCreatorChange(s, step),
      finish: (s) => this.startNewGame(s),
      cancel: () => this.showMenu(),
      rotatePreview: (dx) => (this.previewYaw += dx * 0.01),
    });
    this.intro = new IntroOverlay(container, () => this.finishIntro());
    this.settingsPanel = new SettingsPanel(container, (s) => this.applySettings(s));
    this.credits = new CreditsPanel(container);
    this.combatHud = new CombatHud(container);
    this.shrinePanel = new ShrinePanel(container, {
      upgrade: (el) => this.upgradeSkill(el),
      attune: () => this.attune(),
      rest: () => this.rest(),
      travel: (id) => void this.travel(id),
      close: () => this.closeShrine(),
    });
    this.combatHud.root.hidden = true;
    this.scene.add(this.fx.group);
    this.director = new CombatDirector(this.scene, this.bus, this.assets, this.fx, {
      hitstop: (s) => (this.hitstopT = Math.max(this.hitstopT, s)),
      slowmo: (s, scale) => {
        this.slowmoT = Math.max(this.slowmoT, s);
        this.slowmoScale = scale;
      },
      shake: (a) => this.rig?.shake(a),
      popup: (at, text, kind) => this.combatHud.popup(at, text, kind),
      cinematic: (shot) => (this.shot = shot),
    });
    this.bus.on('enemyKilled', ({ xp }) => {
      if (!this.save) return;
      const gained = gainXp(this.save.progression, xp);
      if (gained > 0) toast(this.ui, `Skill point earned (${this.save.progression.skillPoints} unspent) — spend it at a shrine`, 3600);
    });
    this.bus.on('playerDied', () => {
      this.deathTimer = 3.2;
      this.combatHud.setDefeated(true);
    });
    this.hud.onPauseAction((a) => {
      if (a === 'resume') this.resume();
      else if (a === 'save') this.saveNow(true);
      else if (a === 'settings') this.settingsPanel.open(this.settings);
      else {
        this.saveNow(false);
        this.showMenu();
      }
    });
    canvas.addEventListener('click', () => {
      if (this.mode === 'playing' && !this.paused) this.input.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      if (locked) this.hadLock = true;
      else if (this.mode === 'playing' && this.hadLock && !this.paused && !this.shrinePanel.isOpen) {
        this.setPaused(true);
        this.lockPauseAt = performance.now();
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.mode === 'playing') {
        // Browsers usually swallow Esc to release pointer lock (which pauses via pointerlockchange);
        // ignore an Esc that arrives right after that so it does not instantly unpause.
        if (performance.now() - this.lockPauseAt < 400) return;
        if (this.shrinePanel.isOpen) this.closeShrine();
        else if (this.settingsPanel.isOpen) this.settingsPanel.close();
        else if (this.paused) this.resume();
        else {
          this.setPaused(true);
          this.input.exitPointerLock();
        }
      }
      if ((e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') && this.mode === 'intro') this.finishIntro();
    });
    window.addEventListener('beforeunload', () => {
      if (this.mode === 'playing') this.saveNow(false);
    });
    this.bus.on('regionEntered', ({ regionId }) => {
      const r = regions[regionId];
      this.hud.showBanner(r.name, r.subtitle);
    });
    this.applySettings(this.settings, false);
  }

  async init(): Promise<void> {
    await this.assets.init();
    const params = new URLSearchParams(location.search);
    // Dev shortcut: ?play&element=fire jumps straight into a fresh character.
    if (params.has('play')) {
      const el = params.get('element');
      const element = el && el in elements ? (el as keyof typeof elements) : 'earth';
      const s = { ...this.creatorDefaults(), element, regionId: elements[element].startRegion, name: 'Tester' };
      s.appearance.presentation = params.get('body') === 'masculine' ? 'masculine' : 'feminine';
      await this.startNewGame(s, false);
    } else this.showMenu();
    requestAnimationFrame(this.frame);
  }

  private creatorDefaults(): CreatorState {
    return { ...this.creator.state, appearance: { ...this.creator.state.appearance }, echo: { ...this.creator.state.echo } };
  }

  // ---------------------------------------------------------------- settings

  private applySettings(s: Settings, persist = true): void {
    const qualityChanged = s.quality !== this.settings.quality;
    this.settings = s;
    if (persist) saveSettings(this.storage, s);
    if (qualityChanged || !persist) this.renderer.setQuality(s.quality, this.scene);
    this.hud.setHelpVisible(s.showControls);
    if (this.rig) this.rig.sensitivity = cameraConfig.mouseSensitivity * s.mouseSensitivity;
  }

  // ---------------------------------------------------------------- world

  private buildRegion(id: string): void {
    if (this.region?.def.id === id) return;
    this.region?.dispose();
    this.atmosphere?.dispose();
    const def = regions[id];
    this.region = new Region(def);
    this.scene.add(this.region.group);
    this.atmosphere = new Atmosphere(this.scene, this.renderer.renderer, def, this.renderer.renderer.shadowMap.enabled);
    this.renderer.exposure = def.atmosphere.exposure;
    this.rig = new CameraRig(this.renderer.camera, (x, z) => this.region!.terrain.heightAt(x, z));
    this.rig.sensitivity = cameraConfig.mouseSensitivity * this.settings.mouseSensitivity;
  }

  private clearActors(): void {
    this.player?.view.dispose();
    this.player = null;
    this.preview?.dispose();
    this.preview = null;
    this.previewLook = null;
    this.echo?.dispose();
    this.echo = null;
    this.previewEchoKey = '';
    this.director.clear();
    this.combatHud.clear();
    this.combatHud.root.hidden = true;
    this.shot = null;
    this.deathTimer = 0;
    this.weaponShown = '';
    this.shrinePanel.close();
    this.hud.setInteract(null);
  }

  private setEcho(cfg: EchoConfig): void {
    this.echo?.dispose();
    this.echo = new EchoView(cfg);
    this.scene.add(this.echo.object);
  }

  // ---------------------------------------------------------------- menu

  private showMenu(): void {
    this.mode = 'menu';
    this.input.exitPointerLock();
    this.clearActors();
    this.setPaused(false);
    this.hud.root.hidden = true;
    this.creator.close();
    this.intro.hide();
    const r = this.saves.load();
    this.save = r.ok ? r.data : null;
    this.buildRegion(this.save?.world.regionId ?? 'thornwall');
    this.menu.show(this.save);
  }

  private updateMenu(dt: number): void {
    if (!this.region) return;
    this.menuAngle += dt * 0.05;
    const c = this.region.landmark;
    const cam = this.renderer.camera;
    const x = c.x + Math.sin(this.menuAngle) * 30;
    const z = c.z + Math.cos(this.menuAngle) * 30;
    cam.position.set(x, Math.max(c.y + 5, this.region.terrain.heightAt(x, z) + 3), z);
    cam.lookAt(c.x, c.y + 9, c.z);
    this.atmosphere?.follow(c, this.time.realElapsed);
  }

  // ---------------------------------------------------------------- creator

  private openCreator(): void {
    this.menu.hide();
    this.mode = 'creator';
    this.previewYaw = 0;
    this.creator.open();
  }

  private lookOf(s: CreatorState): CharacterLook {
    return { element: s.element, appearance: { ...s.appearance } };
  }

  private onCreatorChange(s: CreatorState, step: CreatorStep): void {
    this.previewStep = step;
    this.buildRegion(s.regionId);
    const look = this.lookOf(s);
    if (this.preview && this.previewLook && canApplyLive(this.preview, this.previewLook, look) && this.previewLook.element === look.element) {
      (this.preview as GltfCharacter).applyAppearance(look.appearance);
      this.previewLook = look;
    } else {
      const token = ++this.previewToken;
      void createPlayerView(look, this.assets).then((view) => {
        if (token !== this.previewToken || this.mode !== 'creator') {
          view.dispose();
          return;
        }
        this.preview?.dispose();
        this.preview = view;
        this.previewLook = look;
        this.scene.add(view.object);
      });
    }
    const echoKey = JSON.stringify([s.echo.form, s.echo.hue]);
    if ((step === 'echo' || step === 'begin') && echoKey !== this.previewEchoKey) {
      this.setEcho(s.echo);
      this.previewEchoKey = echoKey;
    }
    if (this.echo) this.echo.object.visible = step === 'echo' || step === 'begin';
  }

  /**
   * The preview character stands on the shrine platform (stone floor, no grass), facing the camera which
   * looks in from the spawn side. The framing puts the character right of centre, clear of the panel.
   */
  private updateCreator(dt: number): void {
    const region = this.region;
    if (!region) return;
    const L = region.landmark;
    const toSpawn = new THREE.Vector3(region.spawn.x - L.x, 0, region.spawn.z - L.z).normalize();
    const p = L.clone().addScaledVector(toSpawn, 1.2);
    p.y = L.y + 0.6; // top of the platform
    const facing = Math.atan2(toSpawn.x, toSpawn.z);
    // Screen-right as seen from a camera looking along -toSpawn.
    const screenRight = new THREE.Vector3(toSpawn.z, 0, -toSpawn.x);
    const showEcho = this.previewStep === 'echo' || this.previewStep === 'begin';
    if (this.preview) {
      this.preview.object.position.copy(p);
      this.preview.object.rotation.y = facing + this.previewYaw;
      this.preview.update(dt, { grounded: true, speed: 0, vy: 0, sprinting: false, landing: 0 });
    }
    if (this.echo) {
      this.echo.object.position.copy(p).addScaledVector(screenRight, 1.5).addScaledVector(toSpawn, -0.9);
      this.echo.object.rotation.y = facing - (this.creator.state.echo.form === 'human' ? 0.35 : 1.1);
      this.echo.presence = 1;
      this.echo.update(dt);
    }
    const dist = showEcho ? 4.6 : 3.1;
    const shift = showEcho ? 1.6 : 0.95; // move the look target left so the subject sits right of centre
    const target = p.clone().add(new THREE.Vector3(0, showEcho ? 1.0 : 0.95, 0)).addScaledVector(screenRight, (showEcho ? 0.75 : 0) - shift);
    const camPos = p.clone().addScaledVector(toSpawn, dist).add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(screenRight, (showEcho ? 0.75 : 0) - shift);
    const cam = this.renderer.camera;
    cam.position.lerp(camPos, damp(6, dt));
    cam.lookAt(target);
    this.atmosphere?.follow(p, this.time.realElapsed);
  }

  // ---------------------------------------------------------------- start / continue

  private async startNewGame(s: CreatorState, withIntro = true): Promise<void> {
    this.creator.close();
    const character = { name: s.name, element: s.element, appearance: { ...s.appearance } };
    this.save = newSave(character, { ...s.echo }, s.regionId);
    this.saves.save(this.save);
    await this.enterWorld(this.save, withIntro);
  }

  private async continueGame(): Promise<void> {
    const r = this.saves.load();
    if (!r.ok) {
      toast(this.ui, r.reason === 'future' ? 'This save was made by a newer version.' : 'The save could not be read.');
      return;
    }
    this.menu.hide();
    this.save = r.data;
    await this.enterWorld(r.data, false);
  }

  private async enterWorld(save: SaveData, withIntro: boolean): Promise<void> {
    this.menu.hide();
    this.clearActors();
    this.buildRegion(save.world.regionId);
    const region = this.region!;
    const look: CharacterLook = { element: save.character.element, appearance: save.character.appearance };
    const view = await createPlayerView(look, this.assets);
    this.player = new Player(view, this.bus, save.equipment.weapon, save.character.element, save.progression.unlockedElements, save.equipment.ability, save.progression.skills);
    this.player.abilities.loadCooldowns(save.cooldowns);
    this.scene.add(view.object);
    region.setAttuned(save.discoveries.includes(shrineId(region.def.id)));
    for (const w of region.waystones) w.setLit(save.discoveries.includes(w.id));
    this.director.setElement(save.character.element);
    await this.director.spawnCamp(region);

    const toShrine = Math.atan2(region.landmark.x - region.spawn.x, region.landmark.z - region.spawn.z);
    const pos = resolveLoadPosition(save.world.position, region.spawn, (x, z) => region.terrain.heightAt(x, z), region.collision.boundsRadius);
    const facing = pos.usedSpawn ? toShrine : save.world.facing;
    this.player.spawn(new THREE.Vector3(pos.x, pos.y, pos.z), facing);
    this.rig!.snapBehind(facing);
    if (!pos.usedSpawn && Number.isFinite(save.world.cameraYaw)) this.rig!.yaw = save.world.cameraYaw;
    this.setEcho(save.echo);
    this.echoPos.copy(this.player.renderPosition).add(new THREE.Vector3(-1.2, 0, -1));
    this.autosaveTimer = 0;
    this.hud.root.hidden = true;

    if (withIntro) {
      this.mode = 'intro';
      this.introT = 0;
      this.introLine = -1;
      this.echo!.presence = 0;
      this.intro.show();
    } else this.beginPlaying();
  }

  private beginPlaying(): void {
    this.mode = 'playing';
    this.intro.hide();
    this.hud.root.hidden = false;
    this.combatHud.root.hidden = false;
    this.hud.setHelpVisible(this.settings.showControls);
    this.setPaused(false);
    this.hadLock = false;
    if (this.echo) this.echo.presence = 1;
    this.input.requestPointerLock();
    this.bus.emit('regionEntered', { regionId: this.region!.def.id });
  }

  // ---------------------------------------------------------------- intro cinematic

  private introScript(): { at: number; speaker: string; text: string }[] {
    const s = this.save!;
    const r = regions[s.world.regionId];
    const fill = (t: string) => t.replaceAll('{player}', s.character.name).replaceAll('{echo}', s.echo.name);
    const lines = echoIntroLines[s.echo.personality].map(fill);
    const out = [
      { at: 0.4, speaker: r.subtitle, text: r.name },
      { at: 5.2, speaker: s.echo.name, text: lines[0] },
      { at: 8.6, speaker: s.echo.name, text: lines[1] },
    ];
    if (s.echo.memory.trim()) out.push({ at: 11.8, speaker: `What ${s.echo.name} taught you`, text: `“${s.echo.memory.trim()}”` });
    return out;
  }

  private updateIntro(dt: number): void {
    const region = this.region!;
    const player = this.player!;
    this.introT += dt;
    const t = this.introT;
    const script = this.introScript();
    const idx = script.reduce((i, l, k) => (t >= l.at ? k : i), -1);
    if (idx !== this.introLine && idx >= 0) {
      this.introLine = idx;
      this.intro.say(script[idx].speaker, script[idx].text);
    }
    player.render(dt, 1);
    const p = player.renderPosition;
    // Echo manifests beside the player from 4.5 s.
    const echo = this.echo!;
    echo.presence = smoothstep(4.5, 6.5, t);
    const side = new THREE.Vector3(Math.cos(player.facing), 0, -Math.sin(player.facing));
    echo.object.position.copy(p).addScaledVector(side, -1.4);
    echo.object.position.y = region.terrain.heightAt(echo.object.position.x, echo.object.position.z);
    echo.object.rotation.y = player.facing + 0.6;
    echo.update(dt);
    // Camera: high orbit over the land, then a slow descent to a shot of the player and the Echo.
    const cam = this.renderer.camera;
    const k = smoothstep(2.5, 7.5, t);
    const orbit = t * 0.06 + player.facing + Math.PI * 0.75;
    const wide = new THREE.Vector3(p.x + Math.sin(orbit) * 45, p.y + 24, p.z + Math.cos(orbit) * 45);
    const closeAngle = player.facing + Math.PI * 0.85 + t * 0.015;
    const close = new THREE.Vector3(p.x + Math.sin(closeAngle) * 5.5, p.y + 1.9, p.z + Math.cos(closeAngle) * 5.5);
    cam.position.lerpVectors(wide, close, k);
    cam.position.y = Math.max(cam.position.y, region.terrain.heightAt(cam.position.x, cam.position.z) + 1);
    const look = new THREE.Vector3(lerp(region.landmark.x, p.x, k), lerp(region.landmark.y + 2, p.y + 1.3, k), lerp(region.landmark.z, p.z, k));
    cam.lookAt(look);
    this.atmosphere?.follow(p, this.time.realElapsed);
    if (t >= INTRO_LENGTH) this.finishIntro();
  }

  private finishIntro(): void {
    if (this.mode !== 'intro') return;
    this.rig!.snapBehind(this.player!.facing);
    this.beginPlaying();
  }

  // ---------------------------------------------------------------- saving

  private captureSave(): SaveData | null {
    if (!this.save || !this.player || !this.region) return null;
    const m = this.player.motor;
    return {
      ...this.save,
      world: { regionId: this.region.def.id, position: { x: m.x, y: m.y, z: m.z }, facing: this.player.facing, cameraYaw: this.rig?.yaw ?? 0 },
      equipment: {
        ...this.save.equipment,
        weapon: this.player.weapon.id,
        unlockedWeapons: [...new Set([...this.save.equipment.unlockedWeapons, 'sword', 'spear', 'fists'])],
        ability: this.player.abilities.selected,
      },
      progression: { ...this.save.progression, unlockedElements: this.player.abilities.list, skills: this.player.abilities.levelsToSave() },
      cooldowns: { ...this.save.cooldowns, ...this.player.abilities.toSave() },
    };
  }

  private saveNow(announce: boolean): void {
    const data = this.captureSave();
    if (!data) return;
    try {
      this.saves.save(data);
      this.save = data;
      if (announce) toast(this.ui, 'Game saved');
    } catch {
      toast(this.ui, 'Saving failed: browser storage is unavailable or full.');
    }
  }

  // ---------------------------------------------------------------- pause

  private setPaused(p: boolean): void {
    this.paused = p;
    this.hud.setPaused(p && this.mode === 'playing');
    if (!p) this.settingsPanel.close();
  }

  private resume(): void {
    this.setPaused(false);
    this.input.requestPointerLock();
  }

  // ---------------------------------------------------------------- frame

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
    // Hitstop and slow motion scale game time; real time keeps the camera and UI smooth.
    this.hitstopT = Math.max(0, this.hitstopT - realDt);
    this.slowmoT = Math.max(0, this.slowmoT - realDt);
    this.time.timeScale = this.hitstopT > 0 ? combatConfig.hitstopScale : this.slowmoT > 0 ? this.slowmoScale : 1;
    const dt = this.paused || this.shrinePanel.isOpen ? 0 : this.time.advance(realDt);
    if (this.mode === 'playing') this.updatePlaying(dt, realDt);
    else if (this.mode === 'intro') this.updateIntro(realDt);
    else if (this.mode === 'creator') this.updateCreator(realDt);
    else this.updateMenu(realDt);
    this.region?.update(dt || realDt, this.time.realElapsed);
    this.renderer.render(this.scene);
  };

  private updatePlaying(dt: number, realDt: number): void {
    const player = this.player!;
    const rig = this.rig!;
    const input = this.input;
    if (input.wasPressed('toggleHelp')) {
      this.settings = { ...this.settings, showControls: !this.settings.showControls };
      this.applySettings(this.settings);
    }
    if (input.wasPressed('toggleDebug')) this.hud.toggleDebug();
    const mouse = input.consumeMouse();
    if (!this.paused && !this.shrinePanel.isOpen) {
      this.updateDiscovery(input.wasPressed('interact'));
      rig.rotate(mouse.dx, this.settings.invertY ? -mouse.dy : mouse.dy);
      if (mouse.wheel) rig.zoom(mouse.wheel);
      const { steps, alpha } = this.loop.advance(dt);
      for (let i = 0; i < steps; i++) {
        const now = this.time.elapsed;
        const camForward = rig.forward();
        player.step(this.loop.step, input, { now, camForward, world: this.region!.collision, lockTarget: this.director.lockTarget, targets: this.director.enemies });
        this.director.step(this.loop.step, now, player, input, camForward, this.region!);
        input.endStep();
      }
      if (player.weapon.id !== this.weaponShown) {
        this.weaponShown = player.weapon.id;
        if (player.armed) attachWeapon(player.view.weaponSocket, player.view.source, buildWeapon(player.weapon.id, elements[this.save!.character.element].color));
        else detachWeapon(player.view.weaponSocket);
      }
      player.render(dt, alpha);
      this.director.render(dt, alpha, player);
      if (this.deathTimer > 0) {
        this.deathTimer -= realDt;
        if (this.deathTimer <= 0) this.respawnPlayer();
      }
      this.save!.playTime += dt;
      this.autosaveTimer += dt;
      if (this.autosaveTimer >= AUTOSAVE_INTERVAL) {
        this.autosaveTimer = 0;
        this.saveNow(false);
      }
      this.updateEchoFollow(dt);
    } else input.endStep();
    const lock = this.director.lockTarget;
    rig.lockTarget = lock ? lock.renderPosition : null;
    rig.update(realDt, player.renderPosition, player.sprinting);
    if (this.shot) {
      // Finisher camera: low side angle on both fighters.
      const cam = this.renderer.camera;
      const f = this.shot.focus;
      cam.position.set(f.x + Math.sin(this.shot.yaw) * 4.4, f.y + 0.5, f.z + Math.cos(this.shot.yaw) * 4.4);
      cam.lookAt(f);
    }
    this.atmosphere!.follow(player.renderPosition, this.time.realElapsed);
    this.combatHud.update(realDt, this.time.elapsed, this.renderer.camera, player, this.save!.character.name, this.director.enemies, lock, !!this.director.finisherCandidate(player), this.director.comboCount);
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

  /**
   * Basic follow so the Echo stays with the player without blocking the view: it keeps to the player's side
   * as seen from the camera, slightly ahead. Phase 5 replaces this with full Echo behaviour.
   */
  private updateEchoFollow(dt: number): void {
    const echo = this.echo;
    const player = this.player!;
    const rig = this.rig!;
    if (!echo) return;
    const p = player.renderPosition;
    const f = rig.forward();
    const camForward = new THREE.Vector3(f.x, 0, f.z);
    const camRight = new THREE.Vector3(-f.z, 0, f.x);
    // Stay on whichever side the Echo already is, to avoid crossing in front of the camera.
    const rel = this.echoPos.clone().sub(p);
    const side = rel.dot(camRight) >= 0 ? 1 : -1;
    const goal = p.clone().addScaledVector(camRight, side * 1.8).addScaledVector(camForward, 0.6);
    if (this.echoPos.distanceTo(goal) > 15) this.echoPos.copy(goal);
    else this.echoPos.lerp(goal, damp(2.5, dt));
    this.echoPos.y = this.region!.terrain.heightAt(this.echoPos.x, this.echoPos.z);
    echo.object.position.copy(this.echoPos);
    // Step aside (fade) during finisher shots so the Echo never blocks the cinematic camera.
    echo.presence += ((this.shot ? 0.12 : 1) - echo.presence) * damp(6, dt);
    const moveYaw = Math.atan2(goal.x - this.echoPos.x, goal.z - this.echoPos.z);
    const yaw = this.echoPos.distanceTo(goal) > 0.4 ? moveYaw : player.facing;
    echo.object.rotation.y += angleDelta(echo.object.rotation.y, yaw) * damp(4, dt);
    echo.update(dt);
  }

  // ---------------------------------------------------------------- discovery: shrines and waystones

  /** Shows the shrine prompt, opens the shrine on E and lights waystones the player walks up to. */
  private updateDiscovery(interact: boolean): void {
    const player = this.player!;
    const region = this.region!;
    if (!player.combatant.alive || this.deathTimer > 0) {
      this.hud.setInteract(null);
      return;
    }
    const p = player.motor;
    const nearShrine = Math.hypot(p.x - region.landmark.x, p.z - region.landmark.z) < discoveryConfig.shrineRadius;
    const el = elements[region.def.element];
    const spear = !nearShrine && this.director.spearNearby(player);
    this.hud.setInteract(nearShrine ? `Shrine of ${el.name}` : spear ? 'Pick up spear' : null);
    if (nearShrine && interact) this.openShrine();
    for (const w of region.waystones) {
      if (w.lit || Math.hypot(p.x - w.pos.x, p.z - w.pos.z) > discoveryConfig.waystoneRadius) continue;
      w.setLit(true);
      this.discover(w.id, w.name);
      // A waystone restores the traveller.
      player.combatant.heal(player.combatant.opts.maxHealth);
      player.abilities.resetCooldowns();
      player.stamina.value = 100;
      this.fx.ring(w.pos.clone(), el.glow, 5, 0.9);
      this.fx.burst(w.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), el.glow, 50, 6);
      const lit = region.waystones.filter((x) => x.lit).length;
      this.hud.showBanner(w.name, `${w.kind} lit · ${lit} / ${region.waystones.length}`);
      toast(this.ui, 'Health and abilities restored');
      this.saveNow(false);
    }
  }

  private discover(id: string, name: string): void {
    if (!this.save || this.save.discoveries.includes(id)) return;
    this.save.discoveries.push(id);
    this.bus.emit('discovered', { id, name });
  }

  private shrineView() {
    const region = this.region!;
    const save = this.save!;
    return {
      regionId: region.def.id,
      attuned: save.discoveries.includes(shrineId(region.def.id)),
      unlocked: this.player!.abilities.list,
      attunedRegions: Object.keys(regions).filter((id) => save.discoveries.includes(shrineId(id))),
      waystones: region.waystones.map((w) => ({ name: w.name, lit: w.lit })),
      skillPoints: save.progression.skillPoints,
      skills: elementOrder.map((el) => ({
        element: el,
        unlocked: this.player!.abilities.unlocked.has(el),
        level: this.player!.abilities.level(el),
        cost: this.player!.abilities.upgradeCost(el),
      })),
    };
  }

  private openShrine(): void {
    this.hud.setInteract(null);
    this.input.exitPointerLock();
    this.shrinePanel.open(this.shrineView());
  }

  /** Spends skill points on the next level of an elemental skill (shrine panel). */
  private upgradeSkill(el: ElementId): void {
    const save = this.save!;
    const spent = this.player!.abilities.upgrade(el, save.progression.skillPoints);
    if (!spent) return;
    save.progression.skillPoints -= spent;
    const lvl = this.player!.abilities.level(el);
    toast(this.ui, `${skills[el].name} reached level ${lvl}: ${skills[el].levels[lvl - 1].note}`, 3600);
    this.saveNow(false);
    this.shrinePanel.render(this.shrineView());
  }

  private closeShrine(): void {
    this.shrinePanel.close();
    this.input.requestPointerLock();
  }

  /** First visit: the shrine is discovered and its element's ability is learned. */
  private attune(): void {
    const region = this.region!;
    const player = this.player!;
    const el = region.def.element;
    this.discover(shrineId(region.def.id), regions[region.def.id].name);
    region.setAttuned(true);
    this.save!.progression.skillPoints += progressionConfig.shrinePoints;
    const learned = player.abilities.unlock(el);
    if (learned) {
      player.abilities.selected = el;
      this.bus.emit('elementUnlocked', { element: el });
      toast(this.ui, `${abilities[el].name} learned — R to cast, V to switch element`, 4200);
    } else toast(this.ui, 'Shrine attuned');
    const at = region.landmark.clone();
    this.fx.ring(at, elements[el].glow, 12, 1.4);
    this.fx.burst(at.clone().add(new THREE.Vector3(0, 3, 0)), elements[el].glow, 120, 9);
    this.saveNow(false);
    this.closeShrine();
    this.hud.showBanner(learned ? abilities[el].name : regions[region.def.id].name, learned ? `${elements[el].name} attunement` : 'Shrine attuned');
  }

  private rest(): void {
    const player = this.player!;
    player.combatant.heal(player.combatant.opts.maxHealth);
    player.abilities.resetCooldowns();
    player.stamina.value = 100;
    this.saveNow(false);
    toast(this.ui, 'You rest at the shrine. Health and abilities restored.');
    this.closeShrine();
  }

  /** Shrine travel: save, then load the destination region at its spawn (beside its shrine). */
  private async travel(regionId: string): Promise<void> {
    if (this.traveling || !this.region || regionId === this.region.def.id || !(regionId in regions)) return;
    const data = this.captureSave();
    if (!data) return;
    this.traveling = true;
    this.shrinePanel.close();
    data.world = { regionId, position: { x: NaN, y: NaN, z: NaN }, facing: 0, cameraYaw: 0 };
    try {
      this.saves.save(data);
    } catch {
      /* storage unavailable: travel anyway, the in-memory save is kept */
    }
    this.save = data;
    try {
      await this.enterWorld(data, false);
    } finally {
      this.traveling = false;
    }
  }

  /** Back at the shrine after defeat; the camp resets too. */
  private respawnPlayer(): void {
    const player = this.player!;
    const region = this.region!;
    player.combatant.revive();
    player.interrupt();
    player.endAegis();
    player.scripted = false;
    player.stamina.value = 100;
    const facing = Math.atan2(region.landmark.x - region.spawn.x, region.landmark.z - region.spawn.z);
    player.spawn(region.spawn, facing);
    player.view.stopAction(0);
    this.rig!.snapBehind(facing);
    this.director.resetAll();
    this.combatHud.setDefeated(false);
    this.shot = null;
    this.echoPos.copy(region.spawn);
  }

  /** Small read-only hook for automated smoke tests. */
  debugState() {
    const m = this.player?.motor;
    return {
      mode: this.mode,
      paused: this.paused,
      region: this.region?.def.id ?? null,
      view: (this.player?.view ?? this.preview)?.source ?? null,
      position: m ? { x: m.x, y: m.y, z: m.z } : null,
      grounded: m?.grounded ?? null,
      vy: m?.vy ?? null,
      stamina: this.player?.stamina.value ?? null,
      fps: this.fps,
      hasEcho: !!this.echo,
      hp: this.player?.combatant.health ?? null,
      playerState: this.player?.combatant.state ?? null,
      weapon: this.player?.weapon.id ?? null,
      attack: this.player?.runner.current?.def.id ?? null,
      spear: { away: this.player?.spearAway ?? false, state: this.director.spear.state, x: this.director.spear.x, z: this.director.spear.z },
      imbue: this.player?.abilities.imbue?.element ?? null,
      imbueInfo: this.player?.abilities.imbue ? { ...this.player.abilities.imbue } : null,
      edodge: this.player?.edodge?.el ?? null,
      gliding: this.player?.gliding ?? false,
      gesture: this.player ? this.player.gestureT > 0 : false,
      frozen: this.director.enemies.filter((e) => e.status.frozen).map((e) => e.id),
      skills: this.player ? { levels: this.player.abilities.levelsToSave(), points: this.save?.progression.skillPoints ?? 0, xp: this.save?.progression.xp ?? 0 } : null,
      jumpBurst: this.player?.jumpBurst?.kind ?? null,
      enemies: this.director.enemies.map((e) => ({ id: e.id, hp: e.combatant.health, state: e.combatant.state, brain: e.brain, x: e.motor.x, z: e.motor.z })),
      lock: this.director.lockTarget?.id ?? null,
      camp: this.region ? { x: this.region.camp.center.x, z: this.region.camp.center.z } : null,
      saveName: this.save?.character.name ?? null,
      enemyTypes: this.director.enemies.map((e) => e.def.id),
      ability: this.player ? { selected: this.player.abilities.selected, unlocked: this.player.abilities.list, cooldowns: this.player.abilities.toSave(), aegis: this.player.aegisT, casting: !!this.player.cast } : null,
      projectiles: this.director.projectiles.list.filter((p) => !p.dead).length,
      discoveries: this.save?.discoveries ?? [],
      shrineOpen: this.shrinePanel.isOpen,
    };
  }
}
