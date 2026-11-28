import * as THREE from 'three';
import type { RegionDef } from '../config/regions';
import { createSkyDome } from './SkyDome';

/** Sky dome, sun, fill light, fog and image-based environment for one region. */
export class Atmosphere {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  readonly sunDir = new THREE.Vector3();
  private sky: THREE.Mesh;
  private envTarget: THREE.WebGLRenderTarget | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    def: RegionDef,
    shadows: boolean,
  ) {
    const a = def.atmosphere;
    const phi = THREE.MathUtils.degToRad(90 - a.sunElevation);
    const theta = THREE.MathUtils.degToRad(a.sunAzimuth);
    this.sunDir.setFromSphericalCoords(1, phi, theta);

    const skyColors = { top: a.skyTop, horizon: a.skyHorizon, sun: a.sunColor, cloud: a.cloud, cloudShadow: a.cloudShadow, cloudCover: a.cloudCover };
    this.sky = createSkyDome(skyColors, this.sunDir);
    this.group.add(this.sky);

    // Image-based lighting from a cloudless copy of the sky, so standard materials and water pick up the region's colours.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(createSkyDome({ ...skyColors, cloudCover: 0 }, this.sunDir, 10));
    this.envTarget = pmrem.fromScene(envScene, 0, 0.1, 50);
    scene.environment = this.envTarget.texture;
    scene.environmentIntensity = 0.6;
    pmrem.dispose();

    this.sun = new THREE.DirectionalLight(a.sunColor, a.sunIntensity);
    this.sun.castShadow = shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -45;
    sc.right = sc.top = 45;
    sc.near = 1;
    sc.far = 220;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.group.add(this.sun, this.sun.target);

    this.group.add(new THREE.HemisphereLight(a.hemiSky, a.hemiGround, 1.25));

    scene.fog = new THREE.FogExp2(a.fogColor, a.fogDensity);
    scene.background = new THREE.Color(a.fogColor);
    scene.add(this.group);
  }

  /** Keeps the shadow frustum centred on the player. */
  follow(focus: THREE.Vector3, elapsed = 0): void {
    this.sky.position.copy(focus);
    (this.sky.material as THREE.ShaderMaterial).uniforms.time.value = elapsed;
    // Snap to texel-ish steps to reduce shadow shimmering while moving.
    const step = 2;
    const fx = Math.round(focus.x / step) * step;
    const fz = Math.round(focus.z / step) * step;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx, focus.y, fz).addScaledVector(this.sunDir, 110);
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.envTarget?.dispose();
    this.scene.environment = null;
  }
}
