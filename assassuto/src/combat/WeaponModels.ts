import * as THREE from 'three';
import { toonMaterial } from '../render/ToonMaterials';

/**
 * Procedural weapon meshes (until Tripo weapon_sword / weapon_spear are generated).
 * Built pointing along +Y from the grip, so a hand socket only needs one rotation.
 */
export function buildWeapon(id: string, accent: number, dark = false): THREE.Group {
  const g = new THREE.Group();
  g.name = `weapon:${id}`;
  const metal = new THREE.MeshStandardMaterial({ color: dark ? 0x8a8f99 : 0xdfe6ef, metalness: 0.85, roughness: 0.28 });
  const trim = toonMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.25 });
  const wrap = toonMaterial({ color: dark ? 0x2a1d18 : 0x3b2a22 });
  if (id === 'bow') {
    // Limbs span the weapon's local Z (vertical in the hand), bulging forward along +Y; the grip is at the origin.
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.2, -0.62), new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(0, -0.2, 0.62));
    const limb = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.018, 6), wrap);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.24, 4), toonMaterial({ color: 0xe8e2d0 }));
    string.rotation.x = Math.PI / 2;
    string.position.y = -0.2;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.14, 8), trim);
    grip.rotation.x = Math.PI / 2;
    g.add(limb, string, grip);
  } else if (id === 'club') {
    const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.0, 8), wrap);
    haft.position.y = 0.35;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.36, 8), metal);
    head.position.y = 0.9;
    g.add(haft, head);
    for (let i = 0; i < 6; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 5), metal);
      const a = (i / 6) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.13, 0.9, Math.sin(a) * 0.13);
      spike.rotation.set(0, -a, -Math.PI / 2);
      g.add(spike);
    }
  } else if (id === 'spear') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.9, 8), wrap);
    shaft.position.y = 0.55;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.32, 4), metal);
    head.scale.z = 0.35;
    head.position.y = 1.66;
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.004), trim);
    ribbon.position.set(0.03, 1.42, 0);
    ribbon.rotation.z = 0.3;
    g.add(shaft, head, ribbon);
  } else {
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.028, 0);
    bladeShape.lineTo(0.028, 0);
    bladeShape.lineTo(0.022, 0.72);
    bladeShape.lineTo(0, 0.82);
    bladeShape.lineTo(-0.022, 0.72);
    bladeShape.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 1 });
    bladeGeo.translate(0, 0.1, -0.004);
    const blade = new THREE.Mesh(bladeGeo, metal);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.04), trim);
    guard.position.y = 0.09;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.16, 8), wrap);
    grip.position.y = 0;
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), trim);
    pommel.position.y = -0.09;
    g.add(blade, guard, grip, pommel);
    g.userData.tip = new THREE.Vector3(0, 0.9, 0);
  }
  g.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).castShadow = true) : null));
  return g;
}

/**
 * How a weapon sits in each kind of hand socket. On the Tripo biped R_Hand bone, local +Y runs along the
 * fingers and +Z points forward (thumb side), so the blade (+Y of the weapon) is rotated onto +Z.
 */
export const gripPose = {
  gltf: { position: new THREE.Vector3(0.0, 0.075, 0.0), rotation: new THREE.Euler(Math.PI / 2, 0.4, 0, 'YXZ') },
  placeholder: { position: new THREE.Vector3(0, -0.02, 0), rotation: new THREE.Euler(Math.PI / 2, 0, 0) },
};

/** Removes whatever weapon the hand holds (unarmed / sheathed). */
export function detachWeapon(socket: THREE.Object3D): void {
  for (const c of [...socket.children]) if (c.name.startsWith('weapon:') || c.name === 'sword') c.removeFromParent();
}

export function attachWeapon(socket: THREE.Object3D, source: 'gltf' | 'placeholder', weapon: THREE.Object3D): void {
  detachWeapon(socket);
  const pose = gripPose[source];
  weapon.position.copy(pose.position);
  weapon.rotation.copy(pose.rotation);
  socket.add(weapon);
}
