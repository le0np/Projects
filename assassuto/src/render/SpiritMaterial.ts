import * as THREE from 'three';
import { toonMaterial } from './ToonMaterials';

/** Glowing, translucent "spirit" look for the Echo: dark core, strong fresnel rim, additive so bloom picks it up. */
export function spiritMaterial(hue: number, opacity = 0.6): THREE.MeshToonMaterial {
  const c = new THREE.Color(hue);
  const m = toonMaterial({
    color: c.clone().multiplyScalar(0.25),
    emissive: c,
    emissiveIntensity: 0.55,
    rim: { color: c, strength: 2.2, power: 2.2 },
    transparent: true,
    opacity,
  });
  m.blending = THREE.AdditiveBlending;
  m.depthWrite = false;
  return m;
}
