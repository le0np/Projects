// Low-poly fighters for Three.js: every body part is a simple flat-shaded shape placed between two joints
// from pose3d(). No model files: shirt, shorts, skin and rank colours are plain materials.
import * as THREE from '../../vendor/three/three.module.min.js';
import { LIMBS } from './pose3d.js';

const UP = new THREE.Vector3(0, 1, 0);
const v = (a) => new THREE.Vector3(a[0], a[1], a[2]);

function mat(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0 });
}

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// `look`: { shirt, shorts, skin, hair, rank } colours.
export function createFighter(look) {
  const m = { shirt: mat(look.shirt), shorts: mat(look.shorts), skin: mat(look.skin), hair: mat(look.hair), rank: mat(look.rank) };
  const group = new THREE.Group();
  const add = (geo, material) => { const mesh = shadowed(new THREE.Mesh(geo, material)); group.add(mesh); return mesh; };

  // A limb is a 6-sided tapered cylinder of height 1, stretched between its two joints each frame.
  const limbs = LIMBS.map(([from, to, rFrom, rTo, material]) => ({
    from, to, mesh: add(new THREE.CylinderGeometry(rTo, rFrom, 1, 6, 1), m[material]),
  }));
  const neck = add(new THREE.CylinderGeometry(0.045, 0.05, 1, 6, 1), m.skin);
  const joints = ['elbowN', 'elbowF', 'kneeN', 'kneeF'].map((name) => ({
    name, mesh: add(new THREE.IcosahedronGeometry(name.startsWith('knee') ? 0.062 : 0.047, 0), name.startsWith('knee') ? m.skin : m.skin),
  }));
  const hands = ['handN', 'handF'].map((name) => ({ name, mesh: add(new THREE.IcosahedronGeometry(0.045, 0), m.skin) }));
  const feet = ['footN', 'footF'].map((name) => ({ name, mesh: add(new THREE.BoxGeometry(0.2, 0.07, 0.09), m.skin) }));
  // Torso: chest (rashguard) on the upper part of the pelvis→neck line, hips (shorts) on the lower part,
  // and a thin band in the rank colour at the waist (no-gi: the rashguard shows the belt colour).
  const chest = add(new THREE.CylinderGeometry(0.2, 0.15, 1, 6, 1), m.shirt);
  chest.geometry.rotateY(Math.PI / 6);
  const hips = add(new THREE.CylinderGeometry(0.15, 0.14, 1, 6, 1), m.shorts);
  const band = add(new THREE.CylinderGeometry(0.155, 0.155, 0.035, 6, 1), m.rank);
  const head = add(new THREE.IcosahedronGeometry(0.105, 1), m.skin);
  const hair = add(new THREE.IcosahedronGeometry(0.11, 0), m.hair);

  const tmpQ = new THREE.Quaternion();
  const basis = new THREE.Matrix4();

  // Stretch a unit-height mesh from point a to point b.
  function between(mesh, a, b, scaleXZ = 1) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = Math.max(0.001, dir.length());
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.copy(tmpQ.setFromUnitVectors(UP, dir.normalize()));
    mesh.scale.set(scaleXZ, len, scaleXZ);
  }

  // The torso keeps its flat side facing the camera axis (z), so a body lying on its back looks flat.
  function torsoPart(mesh, a, b, depth) {
    const y = new THREE.Vector3().subVectors(b, a);
    const len = Math.max(0.001, y.length());
    y.normalize();
    let z = new THREE.Vector3(0, 0, 1).addScaledVector(y, -y.z).normalize();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    z = new THREE.Vector3().crossVectors(x, y);
    basis.makeBasis(x, y, z);
    mesh.position.copy(a).addScaledVector(y, len / 2);
    mesh.quaternion.setFromRotationMatrix(basis);
    mesh.scale.set(depth, len, 1.25);
  }

  // `breath` 0..1 swells the chest a little.
  function setPose(j, breath = 0) {
    const P = Object.fromEntries(Object.entries(j).map(([k, a]) => [k, v(a)]));
    for (const l of limbs) between(l.mesh, P[l.from], P[l.to]);
    for (const x of joints) x.mesh.position.copy(P[x.name]);
    for (const x of hands) x.mesh.position.copy(P[x.name]);
    // Feet stay flat and point the way the fighter faces (towards the hands).
    const facing = Math.sign((P.handN.x + P.handF.x) / 2 - P.pelvis.x) || 1;
    for (const x of feet) {
      x.mesh.position.copy(P[x.name]);
      x.mesh.position.x += 0.05 * facing;
    }
    const waist = P.pelvis.clone().lerp(P.neck, 0.32);
    torsoPart(chest, waist, P.neck, 0.62 + breath * 0.06);
    torsoPart(hips, P.pelvis.clone().lerp(P.neck, -0.08), waist, 0.85);
    torsoPart(band, waist.clone().lerp(P.pelvis, 0.03), waist.clone().lerp(P.neck, 0.03), 0.9);
    band.scale.y = 1;
    const headDir = new THREE.Vector3().subVectors(P.head, P.neck);
    between(neck, P.neck, P.neck.clone().addScaledVector(headDir, 0.6));
    head.position.copy(P.head);
    hair.position.copy(P.head).addScaledVector(headDir.normalize(), 0.03);
    hair.scale.set(1, 0.8, 1);
  }

  return { group, setPose };
}

// A small low-poly gym: tatami tiles with seams, a red border, wooden floor around and two walls.
export function createMat() {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.1, 14), mat('#7a5a38'));
  floor.position.y = -0.06;
  floor.receiveShadow = true;
  g.add(floor);
  const tile = new THREE.BoxGeometry(0.98, 0.04, 0.98);
  for (let x = -4; x < 4; x++) {
    for (let z = -4; z < 4; z++) {
      const edge = x === -4 || x === 3 || z === -4 || z === 3;
      const t = new THREE.Mesh(tile, mat(edge ? '#b8322f' : ((x + z) & 1 ? '#2b5fc7' : '#2756b8')));
      t.position.set(x + 0.5, -0.02, z + 0.5);
      t.receiveShadow = true;
      g.add(t);
    }
  }
  const wallMat = mat('#d9d2c3');
  const back = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 0.2), wallMat);
  back.position.set(0, 1.45, -5.5);
  back.receiveShadow = true;
  g.add(back);
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 14), wallMat);
  side.position.set(-6, 1.45, 0);
  side.receiveShadow = true;
  g.add(side);
  // club banner on the back wall
  const banner = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 0.05), mat('#111'));
  banner.position.set(0, 2.1, -5.38);
  g.add(banner);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 0.06), mat('#e3b341'));
  stripe.position.set(0, 1.82, -5.37);
  g.add(stripe);
  return g;
}

export { THREE };
