// 3D fighters from the Quaternius "Universal Base Characters" model (CC0, assets/models/fighter/).
// The model has no clothes, so the rashguard and the shorts are painted in the shader from the skin
// weights (chest and upper-arm bones = rashguard, pelvis and thigh bones = shorts).
// Poses come from 3D targets (see poses3d.js): hip and chest position/direction, hands, feet, and
// elbow/knee hints. Arms and legs are solved with two-bone IK, using the model's real bone lengths.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/addons/loaders/GLTFLoader.js';

const MODEL_DIR = new URL('../../assets/models/fighter/', import.meta.url).href;
const SHIRT_BONES = ['spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r'];
const SHORTS_BONES = ['pelvis', 'thigh_l', 'thigh_r'];
const FINGERS = ['index', 'middle', 'ring', 'pinky'];

const loader = new GLTFLoader();
const load = (file) => loader.loadAsync(MODEL_DIR + file);

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

// Per-vertex weight of the rashguard (x) and shorts (y) bones.
function clothAttribute(mesh) {
  const names = mesh.skeleton.bones.map((b) => b.name);
  const shirt = new Set(SHIRT_BONES.map((n) => names.indexOf(n)));
  const shorts = new Set(SHORTS_BONES.map((n) => names.indexOf(n)));
  const idx = mesh.geometry.attributes.skinIndex;
  const wt = mesh.geometry.attributes.skinWeight;
  const out = new Float32Array(idx.count * 2);
  for (let i = 0; i < idx.count; i++) {
    for (let k = 0; k < 4; k++) {
      const bone = idx.getComponent(i, k);
      const w = wt.getComponent(i, k);
      if (shirt.has(bone)) out[i * 2] += w;
      if (shorts.has(bone)) out[i * 2 + 1] += w;
    }
  }
  mesh.geometry.setAttribute('cloth', new THREE.BufferAttribute(out, 2));
}

function clothMaterial(base, colors) {
  const mat = base.clone();
  mat.userData.cloth = { shirtColor: { value: new THREE.Color(colors.shirt) }, shortsColor: { value: new THREE.Color(colors.shorts) } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.cloth);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 cloth;\nvarying vec2 vCloth;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloth = cloth;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCloth;\nuniform vec3 shirtColor;\nuniform vec3 shortsColor;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float clothShirt = smoothstep(0.42, 0.58, vCloth.x);
        float clothShorts = smoothstep(0.42, 0.58, vCloth.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, shirtColor * (0.75 + 0.25 * diffuseColor.r), clothShirt);
        diffuseColor.rgb = mix(diffuseColor.rgb, shortsColor, clothShorts);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.7, max(clothShirt, clothShorts));`);
  };
  mat.customProgramCacheKey = () => 'cloth';
  return mat;
}

// A skinned mesh from another file of the kit (hair, beard) moved onto this fighter's skeleton.
function attachToSkeleton(mesh, bonesByName, parent) {
  const bones = mesh.skeleton.bones.map((b) => bonesByName[b.name]);
  mesh.bind(new THREE.Skeleton(bones, mesh.skeleton.boneInverses), mesh.bindMatrix);
  parent.add(mesh);
}

function orthoBasis(up, fwd) {
  const u = up.clone().normalize();
  const f = fwd.clone().addScaledVector(u, -fwd.dot(u)).normalize();
  const r = new THREE.Vector3().crossVectors(f, u);
  return new THREE.Matrix4().makeBasis(r, u, f);
}

// Rotation that turns the rest basis (restUp, restFwd) into the target basis (up, fwd).
function basisDelta(restBasis, up, fwd) {
  const target = orthoBasis(up, fwd);
  const inv = restBasis.clone().transpose();
  return new THREE.Quaternion().setFromRotationMatrix(target.multiply(inv));
}

function setWorldQuaternion(bone, worldQ) {
  bone.parent.getWorldQuaternion(_q2);
  bone.quaternion.copy(_q2.invert().multiply(worldQ));
  bone.updateMatrixWorld(true);
}

// Turn `bone` so that its child joint points at `target` (smallest rotation, keeps the twist).
function aim(bone, child, target) {
  bone.getWorldPosition(_a);
  child.getWorldPosition(_b);
  const from = _b.sub(_a).normalize();
  const to = target.clone().sub(_a).normalize();
  if (from.lengthSq() < 1e-8 || to.lengthSq() < 1e-8) return;
  bone.getWorldQuaternion(_q);
  setWorldQuaternion(bone, new THREE.Quaternion().setFromUnitVectors(from, to).multiply(_q));
}

// Two-bone IK: root joint fixed, middle joint bends towards `pole`, end joint as close to `target` as the bones allow.
function twoBone(upper, lower, end, target, pole) {
  const A = upper.getWorldPosition(new THREE.Vector3());
  const l1 = lower.position.length();
  const l2 = end.position.length();
  const toT = target.clone().sub(A);
  const d = Math.min(Math.max(toT.length(), Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3);
  const dir = toT.normalize();
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const p = pole.clone().sub(A);
  const perp = p.addScaledVector(dir, -p.dot(dir));
  if (perp.lengthSq() < 1e-8) perp.set(0, 1, 0).addScaledVector(dir, -dir.y);
  perp.normalize();
  const mid = A.clone().addScaledVector(dir, l1 * cosA).addScaledVector(perp, l1 * sinA);
  aim(upper, lower, mid);
  aim(lower, end, A.addScaledVector(dir, d));
}

export async function createFighter3d({ skin = 'light', hair = 'buzzed', beard = false, hairColor = '#3a2618', shirt = '#2f6fd6', shorts = '#16181d' } = {}) {
  const files = [load('fighter.gltf'), hair ? load(`hair_${hair}.gltf`) : null, beard ? load('beard.gltf') : null];
  const [body, hairGltf, beardGltf] = await Promise.all(files);
  const root = body.scene;
  const bones = {};
  let skinned = null;
  root.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isSkinnedMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      if (o.material.name === 'MI_Superhero_Male') skinned = o;
    }
  });
  // The model file uses the dark skin texture; the light one is a drop-in replacement.
  if (skin === 'light') {
    const tex = await new THREE.TextureLoader().loadAsync(MODEL_DIR + 'skin_light.jpg');
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    skinned.material.map = tex;
  }
  // Hair, beard and eyebrows share a grey texture that is meant to be tinted.
  const hairMeshes = new Set();
  root.traverse((o) => { if (o.isMesh && o.material.name === 'MI_Hair_1') hairMeshes.add(o); });
  clothAttribute(skinned);
  skinned.material = clothMaterial(skinned.material, { shirt, shorts });
  const armature = skinned.parent;
  for (const extra of [hairGltf, beardGltf]) {
    if (!extra) continue;
    const meshes = [];
    extra.scene.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
    for (const o of meshes) {
      o.castShadow = true;
      o.frustumCulled = false;
      attachToSkeleton(o, bones, armature);
      hairMeshes.add(o);
    }
  }
  const tint = new THREE.Color(hairColor);
  for (const o of hairMeshes) {
    o.material = o.material.clone();
    o.material.color.copy(tint);
  }

  // Rest pose, kept to reset every frame so poses never accumulate.
  const rest = new Map(Object.values(bones).map((b) => [b, { q: b.quaternion.clone(), p: b.position.clone() }]));
  root.updateMatrixWorld(true);
  const wp = (n) => bones[n].getWorldPosition(new THREE.Vector3());
  const restRight = wp('thigh_r').sub(wp('thigh_l'));
  const restUp = wp('spine_03').sub(wp('pelvis'));
  const restFwd = new THREE.Vector3().crossVectors(restUp, restRight);
  const restBasis = orthoBasis(restUp, restFwd);
  const restWorld = (n) => bones[n].getWorldQuaternion(new THREE.Quaternion());
  const restQ = Object.fromEntries(['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head'].map((n) => [n, restWorld(n)]));
  const metrics = {
    hipHeight: wp('pelvis').y,
    shoulderHeight: wp('upperarm_l').y,
    headHeight: wp('Head').y,
    arm: bones.lowerarm_l.position.length() + bones.hand_l.position.length(),
    leg: bones.calf_l.position.length() + bones.foot_l.position.length(),
  };

  function resetPose() {
    for (const [b, r] of rest) {
      b.quaternion.copy(r.q);
      b.position.copy(r.p);
    }
    root.updateMatrixWorld(true);
  }

  // Grip: bend all finger joints (0 = open hand, 1 = closed grip).
  function grip(side, amount) {
    for (const f of FINGERS) {
      for (let j = 1; j <= 3; j++) {
        const b = bones[`${f}_0${j}_${side}`];
        if (b) b.quaternion.multiply(_q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), amount * (j === 1 ? 0.9 : 1.1)));
      }
    }
  }

  // `t`: target, all in world metres (x along the mat, y up, z depth). See poses3d.js.
  function setPose(t) {
    resetPose();
    const pelvis = bones.pelvis;
    pelvis.parent.updateMatrixWorld(true);
    pelvis.position.copy(pelvis.parent.worldToLocal(v3(t.pelvis)));
    const dHip = basisDelta(restBasis, v3(t.hipUp), v3(t.hipFwd));
    const dChest = basisDelta(restBasis, v3(t.chestUp ?? t.hipUp), v3(t.chestFwd ?? t.hipFwd));
    const dHead = basisDelta(restBasis, v3(t.headUp ?? t.chestUp ?? t.hipUp), v3(t.headFwd ?? t.chestFwd ?? t.hipFwd));
    setWorldQuaternion(pelvis, dHip.clone().multiply(restQ.pelvis));
    setWorldQuaternion(bones.spine_01, dHip.clone().slerp(dChest, 0.35).multiply(restQ.spine_01));
    setWorldQuaternion(bones.spine_02, dHip.clone().slerp(dChest, 0.7).multiply(restQ.spine_02));
    setWorldQuaternion(bones.spine_03, dChest.clone().multiply(restQ.spine_03));
    setWorldQuaternion(bones.neck_01, dChest.clone().slerp(dHead, 0.5).multiply(restQ.neck_01));
    setWorldQuaternion(bones.Head, dHead.clone().multiply(restQ.Head));
    for (const s of ['l', 'r']) {
      const S = s.toUpperCase();
      twoBone(bones[`upperarm_${s}`], bones[`lowerarm_${s}`], bones[`hand_${s}`], v3(t[`hand${S}`]), v3(t[`elbow${S}`]));
      twoBone(bones[`thigh_${s}`], bones[`calf_${s}`], bones[`foot_${s}`], v3(t[`foot${S}`]), v3(t[`knee${S}`]));
      if (t[`toe${S}`]) aim(bones[`foot_${s}`], bones[`ball_${s}`], v3(t[`toe${S}`]));
      grip(s, t.grip ?? 0.6);
    }
    root.updateMatrixWorld(true);
  }

  // Transitions: solve both poses once, then blend bone rotations (slerp) so turning never passes through zero.
  const boneList = Object.values(bones);
  function snapshot(t) {
    setPose(t);
    return boneList.map((b) => [b.quaternion.clone(), b.position.clone()]);
  }
  function applyBlend(a, b, k) {
    boneList.forEach((bone, i) => {
      bone.quaternion.copy(a[i][0]).slerp(b[i][0], k);
      bone.position.copy(a[i][1]).lerp(b[i][1], k);
    });
    root.updateMatrixWorld(true);
  }

  function setColors({ shirt: sc, shorts: hc }) {
    const u = skinned.material.userData.cloth;
    if (sc) u.shirtColor.value.set(sc);
    if (hc) u.shortsColor.value.set(hc);
  }

  // World position of a named joint (for tests in the browser and for placing effects).
  const joint = (name) => wp(name).toArray();

  return { object: root, setPose, snapshot, applyBlend, setColors, metrics, joint, bones };
}

export { THREE };
