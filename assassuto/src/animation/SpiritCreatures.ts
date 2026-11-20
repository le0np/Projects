import * as THREE from 'three';

/**
 * Procedural spirit-animal shapes for the Echo's wolf and bird forms. They are always rendered with the
 * spirit material, so simple rounded primitives read well. Replaced by Tripo models (echo_wolf, echo_bird) later.
 */
export interface SpiritShape {
  object: THREE.Group;
  update(t: number): void;
}

function ellipsoid(rx: number, ry: number, rz: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat);
  m.scale.set(rx, ry, rz);
  return m;
}

export function spiritWolf(mat: THREE.Material): SpiritShape {
  const g = new THREE.Group();
  const body = ellipsoid(0.3, 0.32, 0.62, mat);
  body.position.set(0, 0.78, 0);
  const chest = ellipsoid(0.32, 0.38, 0.32, mat);
  chest.position.set(0, 0.86, 0.38);
  const head = new THREE.Group();
  head.position.set(0, 1.12, 0.72);
  const skull = ellipsoid(0.2, 0.19, 0.24, mat);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 12), mat);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.05, 0.27);
  head.add(skull, snout);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), mat);
    ear.position.set(s * 0.1, 0.2, -0.04);
    ear.rotation.z = -s * 0.25;
    head.add(ear);
  }
  const legs: THREE.Mesh[] = [];
  for (const [x, z] of [[-0.17, 0.42], [0.17, 0.42], [-0.17, -0.42], [0.17, -0.42]]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.55, 4, 8), mat);
    leg.position.set(x, 0.36, z);
    legs.push(leg);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.95, -0.6);
  const tailMesh = ellipsoid(0.1, 0.1, 0.42, mat);
  tailMesh.position.z = -0.35;
  tail.add(tailMesh);
  tail.rotation.x = 0.5;
  g.add(body, chest, head, ...legs, tail);
  return {
    object: g,
    update(t) {
      body.scale.y = 0.32 * (1 + Math.sin(t * 2) * 0.03);
      head.rotation.y = Math.sin(t * 0.5) * 0.3;
      tail.rotation.y = Math.sin(t * 2.4) * 0.35;
    },
  };
}

export function spiritBird(mat: THREE.Material): SpiritShape {
  const g = new THREE.Group();
  const body = ellipsoid(0.22, 0.24, 0.42, mat);
  body.position.set(0, 1.3, 0);
  body.rotation.x = -0.3;
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.32, 4, 8), mat);
  neck.position.set(0, 1.62, 0.22);
  neck.rotation.x = 0.35;
  const head = ellipsoid(0.11, 0.1, 0.14, mat);
  head.position.set(0, 1.84, 0.3);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 8), mat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.82, 0.5);
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.18, 1.38, 0.05);
    const wing = ellipsoid(0.62, 0.04, 0.26, mat);
    wing.position.x = s * 0.6;
    pivot.add(wing);
    wings.push(pivot);
  }
  const tail = ellipsoid(0.16, 0.03, 0.45, mat);
  tail.position.set(0, 1.18, -0.55);
  tail.rotation.x = 0.3;
  g.add(body, neck, head, beak, tail, ...wings);
  return {
    object: g,
    update(t) {
      const flap = Math.sin(t * 2.2) * 0.45;
      wings[0].rotation.z = -flap - 0.1;
      wings[1].rotation.z = flap + 0.1;
      g.position.y = Math.sin(t * 1.1) * 0.12 + 0.4;
    },
  };
}
