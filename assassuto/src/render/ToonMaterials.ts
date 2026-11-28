import * as THREE from 'three';

const gradients = new Map<string, THREE.DataTexture>();

function ramp(tones: number[]): THREE.DataTexture {
  const key = tones.join(',');
  let g = gradients.get(key);
  if (g) return g;
  const data = new Uint8Array(tones.length * 4);
  tones.forEach((t, i) => data.set([t, t, t, 255], i * 4));
  g = new THREE.DataTexture(data, tones.length, 1, THREE.RGBAFormat);
  g.minFilter = g.magFilter = THREE.NearestFilter;
  g.needsUpdate = true;
  gradients.set(key, g);
  return g;
}

/** Shared 4-band light ramp for the stylized (cel-shaded) look. */
export const toonGradient = () => ramp([90, 150, 210, 255]);
/** Low-contrast ramp for foliage and grass, so shaded sides never go black. */
export const softGradient = () => ramp([150, 185, 220, 255]);

export interface ToonOptions {
  color?: THREE.ColorRepresentation;
  vertexColors?: boolean;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  /** Adds an anime-style rim light. */
  rim?: { color: THREE.ColorRepresentation; strength: number; power?: number };
  side?: THREE.Side;
  /** Use the low-contrast ramp. */
  soft?: boolean;
  transparent?: boolean;
  opacity?: number;
}

export function toonMaterial(opts: ToonOptions = {}): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({
    color: opts.color ?? 0xffffff,
    gradientMap: opts.soft ? softGradient() : toonGradient(),
    vertexColors: opts.vertexColors ?? false,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
  if (opts.rim) addRim(m, opts.rim.color, opts.rim.strength, opts.rim.power ?? 3);
  return m;
}

/** Injects a view-dependent fresnel rim into any lit three.js material. */
export function addRim(material: THREE.Material, color: THREE.ColorRepresentation, strength: number, power = 3): void {
  const rimColor = new THREE.Color(color);
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    shader.uniforms.rimColor = { value: rimColor };
    shader.uniforms.rimStrength = { value: strength };
    shader.uniforms.rimPower = { value: power };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;\nuniform float rimPower;')
      .replace(
        '#include <opaque_fragment>',
        `float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), rimPower);
        outgoingLight += rimColor * rimF * rimStrength;
        #include <opaque_fragment>`,
      );
  };
  chainKey(material, `rim-${rimColor.getHexString()}-${strength}-${power}`);
}

/**
 * Makes any material sway in the wind. Expects vertex height (0 at root) in `position.y`
 * scaled by `heightRef`; used for grass and foliage.
 */
export function addWind(material: THREE.Material, uniforms: { time: { value: number } }, strength = 0.25, heightRef = 1): void {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    shader.uniforms.windTime = uniforms.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float windTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          float bend = pow(clamp(position.y / ${heightRef.toFixed(3)}, 0.0, 1.0), 1.6);
          float w = sin(windTime * 1.7 + wp.x * 0.35 + wp.z * 0.21) * 0.6 + sin(windTime * 3.1 + wp.x * 0.9) * 0.25;
          transformed.x += w * ${strength.toFixed(3)} * bend;
          transformed.z += w * ${(strength * 0.5).toFixed(3)} * bend;
        }`,
      );
  };
  chainKey(material, `wind-${strength}-${heightRef}`);
}

/**
 * Double-sided foliage normally flips its normal on back faces, which turns them black.
 * This keeps the authored (upward) normal on both sides so cards shade like the ground beneath them.
 */
export function keepNormalOnBackFaces(material: THREE.Material): void {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      `float faceDirection = 1.0;
      vec3 normal = normalize( vNormal );
      vec3 nonPerturbedNormal = normal;`,
    );
  };
  chainKey(material, 'keepnormal');
}

/** Shader patches stack, so their program cache keys must stack too. */
function chainKey(material: THREE.Material, key: string): void {
  const prev = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${prev()}|${key}`;
}
