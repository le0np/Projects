// Manga panels from the 3D fighters: one still frame of a pose and a camera, inked in black and white.
// Pass 1 renders the lit scene (colour + depth), pass 2 the normals; a full-screen shader turns them into
// ink lines (depth and normal edges), paper white, screentone dots and solid black. The background is
// transparent, so the page can draw speed lines and effects behind the fighters.
import * as THREE from 'three';
import { createFighter3d } from './fighter3d.js';
import { POSES3D, blendPose, completePose } from './poses3d.js';
import { settle } from './contact3d.js';
import { CLIPS, clipFor, applyClips } from './techniques3d.js';
import { ACTION_BY_ID } from '../data/positions.js';

// Black-and-white looks: the player in a white rashguard, the opponent in black.
const LOOK = {
  p: { skin: 'light', hair: 'buzzed', hairColor: '#2a2420', shirt: '#f2f2f2', shorts: '#202020' },
  o: { skin: 'dark', hair: 'parted', beard: true, hairColor: '#0c0c0c', shirt: '#1c1c1c', shorts: '#3a3a3a' },
};

const POST_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor, tNormal, tDepth;
uniform vec2 res;
uniform float near, far, dotSize, line;
float lin(float z) { float n = z * 2.0 - 1.0; return 2.0 * near * far / (far + near - n * (far - near)); }
float depthAt(vec2 uv) { return lin(texture2D(tDepth, uv).x); }
void main() {
  vec4 col = texture2D(tColor, vUv);
  vec2 px = line / res;
  // Ink lines: a jump in depth (outline) or a sharp turn of the surface (folds, limbs over limbs).
  float d = depthAt(vUv);
  float dd = 0.0;
  vec3 n = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
  float nn = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = i == 0 ? vec2(px.x, 0.0) : i == 1 ? vec2(-px.x, 0.0) : i == 2 ? vec2(0.0, px.y) : vec2(0.0, -px.y);
    dd = max(dd, abs(depthAt(vUv + o) - d));
    vec4 nb = texture2D(tNormal, vUv + o);
    nn = max(nn, nb.a < 0.5 ? 0.0 : 1.0 - dot(n, nb.xyz * 2.0 - 1.0));
  }
  float edgeA = texture2D(tColor, vUv + vec2(px.x, 0.0)).a + texture2D(tColor, vUv - vec2(px.x, 0.0)).a + texture2D(tColor, vUv + vec2(0.0, px.y)).a + texture2D(tColor, vUv - vec2(0.0, px.y)).a;
  bool silhouette = col.a > 0.5 && edgeA < 3.5;
  bool ink = silhouette || dd > 0.03 * d || nn > 0.35;
  if (col.a < 0.5) {
    // outside the bodies: only the outline that falls just outside
    gl_FragColor = edgeA > 0.5 ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(0.0);
    return;
  }
  float L = dot(col.rgb, vec3(0.299, 0.587, 0.114));
  // Screentone: dots on a 45-degree grid; bigger dots for darker tones.
  vec2 p = gl_FragCoord.xy / dotSize;
  p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
  vec2 cell = fract(p) - 0.5;
  float r = length(cell);
  float tone;
  if (L > 0.55) tone = 1.0;
  else if (L > 0.3) tone = r < mix(0.36, 0.1, (L - 0.3) / 0.25) ? 0.0 : 1.0;
  else if (L > 0.12) tone = r < mix(0.6, 0.38, (L - 0.12) / 0.18) ? 0.0 : 1.0;
  else tone = 0.0;
  float v = ink ? 0.0 : tone;
  gl_FragColor = vec4(vec3(v), 1.0);
}`;

export async function createMangaRenderer({ width = 800, height = 600 } = {}) {
  const canvas = document.createElement('canvas');
  const gl = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true });
  gl.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 30);
  // Hard key light from the front-top and a weak fill: clear light and shadow sides for the tones.
  scene.add(new THREE.HemisphereLight('#ffffff', '#666666', 1.1));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(2, 5, 4);
  // A light from the camera keeps the side we look at lit, the way a drawing shows faces.
  const front = new THREE.DirectionalLight('#ffffff', 1.6);
  scene.add(key, key.target, front, front.target);

  const [p, o] = await Promise.all([createFighter3d(LOOK.p), createFighter3d(LOOK.o)]);
  scene.add(p.object, o.object);
  const fighters = { p, o };
  const settled = {};
  for (const k of Object.keys(POSES3D)) settled[k] = settle(p, o, POSES3D[k].T, POSES3D[k].B);

  const normalMat = new THREE.MeshNormalMaterial();
  const post = new THREE.ShaderMaterial({
    vertexShader: POST_VERT, fragmentShader: POST_FRAG, transparent: true,
    uniforms: { tColor: { value: null }, tNormal: { value: null }, tDepth: { value: null }, res: { value: new THREE.Vector2() }, near: { value: camera.near }, far: { value: camera.far }, dotSize: { value: 5 }, line: { value: 1.5 } }, depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  const postScene = new THREE.Scene();
  postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let rtColor = null;
  let rtNormal = null;

  function targets(w, h) {
    if (rtColor && rtColor.width === w && rtColor.height === h) return;
    rtColor?.dispose();
    rtNormal?.dispose();
    rtColor = new THREE.WebGLRenderTarget(w, h, { depthTexture: new THREE.DepthTexture(w, h) });
    rtNormal = new THREE.WebGLRenderTarget(w, h);
  }

  const slotsFor = (pos, playerTop) => (pos === 'standing' || playerTop === null || playerTop ? { p: 'T', o: 'B' } : { p: 'B', o: 'T' });

  // Pose both fighters for a panel.
  // shot.pose: { pos, playerTop } or a move { from: {pos, playerTop}, to: {pos, playerTop}, t },
  // shot.clip: { action, who, t, outcome } (a technique at time t of its clip).
  function pose(shot) {
    const at = shot.pose.to ?? shot.pose;
    const from = shot.pose.from;
    const sTo = slotsFor(at.pos, at.playerTop);
    const k = shot.pose.t ?? 1;
    for (const w of ['p', 'o']) {
      let base = completePose(settled[at.pos][sTo[w]]);
      if (from) {
        const sFrom = slotsFor(from.pos, from.playerTop);
        const ease = k * k * k * (k * (k * 6 - 15) + 10);
        base = blendPose(settled[from.pos][sFrom[w]], settled[at.pos][sTo[w]], ease, 0.07);
      }
      if (shot.clip) {
        const action = ACTION_BY_ID[shot.clip.action];
        const mirror = CLIPS[action.id] ? action.role === 'neutral' && shot.clip.who === 'o' : false;
        base = applyClips(base, [{ clip: clipFor(action), t: shot.clip.t, outcome: shot.clip.outcome ?? 'success', side: shot.clip.who === w ? 'a' : 'd', mirror }]);
      }
      fighters[w].object.position.y = shot.lift?.[w] ?? 0;
      fighters[w].setPose(base);
    }
  }

  // Camera: looks at a fighter's joint (or the middle of both hips) from a direction.
  // cam: { at: 'p.Head' | 'mid', yaw, pitch, dist, fov, shift: [x, y, z] }
  function aim(cam) {
    let target;
    if (!cam.at || cam.at === 'mid') {
      const a = fighters.p.joint('pelvis'), b = fighters.o.joint('pelvis');
      target = new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.25, (a[2] + b[2]) / 2);
    } else {
      const [w, j] = cam.at.split('.');
      target = new THREE.Vector3(...fighters[w].joint(j));
    }
    if (cam.shift) target.add(new THREE.Vector3(...cam.shift));
    const yaw = cam.yaw ?? 0.3, pitch = cam.pitch ?? 0.25, dist = cam.dist ?? 3;
    camera.fov = cam.fov ?? 35;
    camera.position.set(target.x + dist * Math.cos(pitch) * Math.sin(yaw), target.y + dist * Math.sin(pitch), target.z + dist * Math.cos(pitch) * Math.cos(yaw));
    camera.up.set(Math.sin(cam.roll ?? 0), Math.cos(cam.roll ?? 0), 0);
    camera.lookAt(target);
    front.position.copy(camera.position).add(new THREE.Vector3(0, 0.6, 0));
    front.target.position.copy(target);
    front.target.updateMatrixWorld();
  }

  // Render one panel image (a canvas of w × h pixels, transparent outside the fighters).
  function render(shot, w, h) {
    pose(shot);
    aim(shot.cam ?? {});
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    gl.setPixelRatio(1);
    gl.setSize(w, h, false);
    targets(w, h);
    gl.setRenderTarget(rtColor);
    gl.clear();
    gl.render(scene, camera);
    scene.overrideMaterial = normalMat;
    gl.setRenderTarget(rtNormal);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(scene, camera);
    scene.overrideMaterial = null;
    gl.setRenderTarget(null);
    post.uniforms.tColor.value = rtColor.texture;
    post.uniforms.tNormal.value = rtNormal.texture;
    post.uniforms.tDepth.value = rtColor.depthTexture;
    post.uniforms.res.value.set(w, h);
    post.uniforms.near.value = camera.near;
    post.uniforms.far.value = camera.far;
    post.uniforms.dotSize.value = Math.max(4, Math.round(w / 140));
    post.uniforms.line.value = Math.max(1.2, w / 520);
    gl.clear();
    gl.render(postScene, postCam);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d').drawImage(canvas, 0, 0);
    return out;
  }

  // Screen position (0..1) of a joint in the last rendered panel, for placing bubbles and effects.
  function screenOf(who, joint) {
    const v = new THREE.Vector3(...fighters[who].joint(joint)).project(camera);
    return [(v.x + 1) / 2, (1 - v.y) / 2];
  }

  return { render, screenOf };
}
