// 3D surroundings for the model fighters: the club gym (sparring) used by renderer3d.js and tools/model.html.
import * as THREE from 'three';

function mat(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0 });
}

// The club: tatami tiles: tatami tiles with seams, a red border, wooden floor around and two walls.
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
