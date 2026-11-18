// Three.js fight renderer with the model fighters. Same contract as renderer2d.js: it reads the fight
// state and never changes it. draw(view, dtReal, { slowmo, mode }) and resize().
// Commentary, technique names and the slow-motion vignette go on a 2D overlay canvas above the 3D one,
// so the HTML HUD and effects (fightFx.js) stay exactly as they are.
import * as THREE from 'three';
import { createFighter3d } from './fighter3d.js';
import { createMat } from './gym3d.js';
import { POSES3D } from './poses3d.js';
import { ACTION_BY_ID } from '../data/positions.js';
import { MOVE_BY_ID } from '../data/moves.js';

const W = 800;
const H = 450;
const LOOK = {
  p: { skin: 'light', hair: 'buzzed', hairColor: '#4a301c', shirt: '#2f6fd6', shorts: '#16181d' },
  o: { skin: 'dark', hair: 'parted', beard: true, hairColor: '#17110d', shirt: '#d23f3f', shorts: '#1d1d1f' },
};

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const POINTS = ['pelvis', 'handL', 'handR', 'elbowL', 'elbowR', 'footL', 'footR', 'kneeL', 'kneeR', 'toeL', 'toeR'];
const UPPER = ['handL', 'handR', 'elbowL', 'elbowR'];
const LOWER = ['footL', 'footR', 'kneeL', 'kneeR', 'toeL', 'toeR'];

// Which pose slot (T or B) each fighter takes; same rule as the 2D renderer.
function slots(view) {
  if (view.pos === 'standing' || view.playerTop === null) return { p: 'T', o: 'B' };
  return view.playerTop ? { p: 'T', o: 'B' } : { p: 'B', o: 'T' };
}

const clonePose = (p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]));
const shift = (p, keys, d, k = 1) => { for (const key of keys) if (p[key]) p[key] = add(p[key], d, k); };

// Competition arena: dark hall, a grey competition mat with a red square and spotlights.
function createArena() {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#15171d', roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  const mat = new THREE.Mesh(new THREE.BoxGeometry(8, 0.04, 8), new THREE.MeshStandardMaterial({ color: '#3a3f4b', roughness: 0.85 }));
  mat.position.y = -0.021;
  mat.receiveShadow = true;
  g.add(mat);
  const inner = new THREE.Mesh(new THREE.BoxGeometry(6, 0.042, 6), new THREE.MeshStandardMaterial({ color: '#b8bcc6', roughness: 0.8 }));
  inner.position.y = -0.021;
  inner.receiveShadow = true;
  g.add(inner);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.041, 6.4), new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.8 }));
  edge.position.y = -0.021;
  edge.receiveShadow = true;
  g.add(edge);
  // Stands: dark steps with a few lit dots for the crowd.
  const stand = new THREE.MeshStandardMaterial({ color: '#1e2230', roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(18, 0.6, 1), stand);
    step.position.set(0, 0.3 + i * 0.6, -6 - i * 1);
    g.add(step);
  }
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: '#c7cbe0' }), 140);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 140; i++) {
    const r = Math.sin((i + 1) * 12.9898) * 43758.5453;
    const f = r - Math.floor(r);
    const row = i % 4;
    m.setPosition(-8.5 + ((i * 7.3) % 17), 0.75 + row * 0.6, -6 - row);
    dots.setMatrixAt(i, m);
    dots.setColorAt(i, new THREE.Color().setHSL(f, 0.35, 0.55));
  }
  g.add(dots);
  return g;
}

export function createRenderer3d(canvas, overlay) {
  const gl = new THREE.WebGLRenderer({ canvas, antialias: true });
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  const ctx = overlay.getContext('2d');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 60);

  const hemi = new THREE.HemisphereLight('#dfe8ff', '#4a3a2a', 1.4);
  const sun = new THREE.DirectionalLight('#fff4e0', 2.6);
  sun.position.set(3, 6, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 });
  const rim = new THREE.DirectionalLight('#9fb8ff', 1.0);
  rim.position.set(-4, 3, -3);
  scene.add(hemi, sun, sun.target, rim);
  // Arena lighting: a spotlight from above instead of the warm gym light.
  const spot = new THREE.SpotLight('#ffffff', 60, 14, 0.55, 0.5, 1.2);
  spot.position.set(0, 7, 1.5);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  scene.add(spot, spot.target);

  const gym = createMat();
  const arena = createArena();
  scene.add(gym, arena);

  const state = {
    fighters: null, ready: false, failed: null, key: '', t: 1, from: null, time: 0, pulse: null, lastSeq: -1,
    tapT: 0, labels: [], captions: [], logLen: 0, cam: null, zoom: 1,
  };

  const ready = Promise.all([createFighter3d(LOOK.p), createFighter3d(LOOK.o)]).then(([p, o]) => {
    state.fighters = { p, o };
    scene.add(p.object, o.object);
    state.ready = true;
  }).catch((err) => { state.failed = err; throw err; });

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || W;
    const h = Math.round(w * H / W);
    gl.setPixelRatio(dpr);
    gl.setSize(w, h, false);
    overlay.width = Math.round(w * dpr);
    overlay.height = Math.round(h * dpr);
    ctx.setTransform(overlay.width / W, 0, 0, overlay.height / H, 0, 0);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }

  function environment(mode) {
    const comp = mode === 'comp';
    gym.visible = !comp;
    arena.visible = comp;
    spot.visible = comp;
    sun.intensity = comp ? 0.6 : 2.6;
    hemi.intensity = comp ? 0.55 : 1.4;
    scene.background = new THREE.Color(comp ? '#07080c' : '#1b2030');
    scene.fog = comp ? new THREE.Fog('#07080c', 8, 20) : new THREE.Fog('#1b2030', 9, 18);
  }

  // Breathing, hand fighting, attack movements by technique type, and the tap, applied to the pose targets.
  function liven(pose, who, other, view) {
    const p = clonePose(pose);
    const ph = who === 'p' ? 0 : 1.7;
    const t = state.time;
    const standing = view.pos === 'standing';
    const breathe = Math.sin(t * 2.4 + ph) * 0.012;
    if (p.chestUp) p.chestUp = add(p.chestUp, [0, breathe * 4, 0]);
    if (standing) {
      const sway = [Math.sin(t * 1.3 + ph) * 0.06, -Math.abs(Math.sin(t * 2.6 + ph)) * 0.03, 0];
      shift(p, ['pelvis', ...UPPER], sway);
      shift(p, LOWER, sway, 0.25);
    } else {
      shift(p, ['pelvis'], [Math.sin(t * 0.9 + ph) * 0.015, breathe, 0]);
    }
    ['handL', 'handR'].forEach((h, i) => { // hand fighting
      p[h] = add(p[h], [Math.sin(t * 3.1 + ph + i) * 0.03, Math.cos(t * 2.3 + ph + i) * 0.02, 0]);
    });
    const dir = Math.sign(other.pelvis[0] - pose.pelvis[0]) || 1;
    const pulse = state.pulse;
    if (pulse && pulse.who === who) {
      const a = Math.min(1, pulse.t / 0.6);
      const k = Math.sin(a * Math.PI) * (pulse.success === false ? 0.6 : 1);
      switch (pulse.kind) {
        case 'takedown': shift(p, ['pelvis', ...UPPER], [dir * 0.3, -0.22, 0], k); break; // shoot in low
        case 'sweep': shift(p, ['pelvis'], [dir * 0.04, 0.05, 0], k); shift(p, LOWER, [dir * 0.04, 0.2, 0], k); break; // hooks elevate
        case 'pass': shift(p, ['pelvis', ...UPPER], [dir * 0.22, 0.04, 0], k); break; // drive around the legs
        case 'escape': shift(p, ['pelvis', ...LOWER], [-dir * 0.2, 0.03, 0], k); break; // shrimp away
        case 'sub': { // squeeze: hands pull in and shake
          const shake = Math.sin(pulse.t * 45) * 0.025 * Math.sin(a * Math.PI);
          shift(p, ['handL', 'handR'], [-dir * 0.1, shake, 0], k);
          break;
        }
        default: shift(p, ['pelvis', ...UPPER], [dir * 0.12, 0.02, 0], k);
      }
      if (pulse.success === false && a > 0.5) shift(p, ['pelvis', ...UPPER], [-dir * 0.06, 0, 0]); // botched: falls back
    } else if (pulse && pulse.kind === 'sub' && pulse.success !== true) {
      // the one caught in a submission fights the grip
      const s = Math.sin(pulse.t * 30) * 0.05 * Math.sin(Math.min(1, pulse.t / 0.6) * Math.PI);
      shift(p, ['handL', 'handR'], [s, Math.abs(s), 0]);
    }
    if (view.ended && view.ended.method === 'sub' && view.ended.winner !== who) {
      p.handR = add(p.handR, [0, Math.abs(Math.sin(state.tapT * 9)) * 0.1, 0]); // the tap
    }
    return p;
  }

  // Pose both fighters; a change of position blends from the current bones with a short scramble lift.
  function pose(view, dt) {
    const s = slots(view);
    const key = `${view.pos}:${view.playerTop}`;
    const P = POSES3D[view.pos] ?? POSES3D.standing;
    const target = { p: P[s.p], o: P[s.o] };
    const { p, o } = state.fighters;
    if (key !== state.key) {
      // The first pose of a fight appears directly; later changes blend from where the bones are now.
      state.from = state.key ? { p: p.capture(), o: o.capture() } : null;
      state.t = state.from ? 0 : 1;
      state.key = key;
    }
    state.t = Math.min(1, state.t + dt / 0.55);
    const live = { p: p.snapshot(liven(target.p, 'p', target.o, view)), o: o.snapshot(liven(target.o, 'o', target.p, view)) };
    const lift = state.t < 1 ? Math.sin(Math.PI * state.t) * 0.05 : 0;
    for (const w of ['p', 'o']) {
      const f = state.fighters[w];
      if (state.from && state.t < 1) f.applyBlend(state.from[w], live[w], ease(state.t));
      f.object.position.y = lift;
    }
    if (state.t >= 1) state.from = null;
  }

  // Camera beside the pair, a little in front and above. It frames the heads, hands and feet of both
  // fighters, leaving room for the scoreboard on top and the commentary at the bottom.
  const FRAME_JOINTS = ['Head', 'pelvis', 'hand_l', 'hand_r', 'foot_l', 'foot_r'];
  const TAN_V = Math.tan(THREE.MathUtils.degToRad(36 / 2));
  function moveCamera(view, dt, slowmo) {
    const pts = ['p', 'o'].flatMap((w) => FRAME_JOINTS.map((j) => state.fighters[w].joint(j)));
    const min = [0, 1, 2].map((i) => Math.min(...pts.map((q) => q[i])));
    const max = [0, 1, 2].map((i) => Math.max(...pts.map((q) => q[i])));
    const height = max[1] - Math.min(0, min[1]) + 0.3;
    const width = Math.max(max[0] - min[0], (max[2] - min[2]) * 0.7) + 0.5;
    const fit = Math.max(height / 0.56 / 2 / TAN_V, width / 2 / (TAN_V * W / H));
    const standing = view.pos === 'standing';
    const want = {
      x: (min[0] + max[0]) / 2, y: Math.max(0.2, (max[1] + Math.min(0, min[1])) / 2 + height * 0.06), z: (min[2] + max[2]) / 2,
      dist: Math.min(5, Math.max(2.2, fit)) * (slowmo ? 0.9 : 1),
    };
    if (!state.cam) state.cam = { ...want };
    const k = Math.min(1, dt * 3);
    for (const key of Object.keys(want)) state.cam[key] += (want[key] - state.cam[key]) * k;
    const yaw = 0.32 + Math.sin(state.time * 0.15) * 0.07;
    const pitch = standing ? 0.2 : 0.42;
    const c = state.cam;
    camera.position.set(c.x + c.dist * Math.cos(pitch) * Math.sin(yaw), c.y + c.dist * Math.sin(pitch), c.z + c.dist * Math.cos(pitch) * Math.cos(yaw));
    camera.lookAt(c.x, c.y, c.z);
  }

  const screen = (pos) => {
    const v = new THREE.Vector3(...pos).project(camera);
    return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H];
  };

  function draw(view, dtReal, opts = {}) {
    const slowmo = !!opts.slowmo;
    const dt = dtReal * (slowmo ? 0.15 : 1);
    state.time += dt;
    if (view.lastAction && view.lastAction.seq !== state.lastSeq) {
      state.lastSeq = view.lastAction.seq;
      const action = ACTION_BY_ID[view.lastAction.actionId];
      state.pulse = { who: view.lastAction.who, success: view.lastAction.success, t: 0, kind: action?.kind };
      if (action) {
        const mark = view.lastAction.success === true ? ' ✔' : view.lastAction.success === false ? ' ✘' : '…';
        state.labels.push({ who: view.lastAction.who, text: `${MOVE_BY_ID[action.move].name}${mark}`, ok: view.lastAction.success, t: 0 });
        if (state.labels.length > 3) state.labels.shift();
      }
    }
    if (state.pulse) {
      state.pulse.t += dt;
      if (state.pulse.t > 0.6 && !(slowmo && state.pulse.success === null)) state.pulse = null;
      else if (slowmo && state.pulse.success === null) state.pulse.t = Math.min(state.pulse.t, 0.3);
    }
    for (const l of state.labels) l.t += dtReal;
    state.labels = state.labels.filter((l) => l.t < 1.6);
    const log = view.log ?? [];
    if (log.length < state.logLen) state.logLen = 0;
    for (const line of log.slice(state.logLen)) {
      if (line.text.startsWith('⚡') || line.text.startsWith('Mistake chance')) continue;
      state.captions.push({ text: line.text.replace(/ \(.*\)/, ''), who: line.who, t: 0 });
    }
    state.logLen = log.length;
    for (const c of state.captions) c.t += dtReal;
    state.captions = state.captions.slice(-3).filter((c) => c.t < 4);
    if (view.ended) state.tapT += dt;

    ctx.clearRect(0, 0, W, H);
    if (!state.ready) {
      gl.clear();
      ctx.fillStyle = '#98a1b8';
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.failed ? '3D view failed to load' : 'Loading the 3D view…', W / 2, H / 2);
      ctx.textAlign = 'start';
      return;
    }
    environment(opts.mode);
    pose(view, dt);
    moveCamera(view, dt, slowmo);
    gl.render(scene, camera);

    // Technique name floating up from the fighter who tried it.
    state.labels.forEach((l, i) => {
      const [x, y0] = screen(state.fighters[l.who].joint('Head'));
      const a = Math.min(1, l.t / 1.6);
      ctx.globalAlpha = 1 - a * a;
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      const y = Math.max(96 + i * 20, y0 - 34 - a * 30 + i * 20); // stacked, below the scoreboard
      ctx.strokeText(l.text, x, y);
      ctx.fillStyle = l.ok === false ? '#ff8a8a' : l.ok === true ? '#8dffb0' : '#ffe27a';
      ctx.fillText(l.text, x, y);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'start';
    });
    captions();
    if (slowmo) {
      const g = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 470);
      g.addColorStop(0, 'rgba(10,14,30,0)');
      g.addColorStop(1, 'rgba(10,14,30,0.72)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Running commentary at the bottom of the picture (same as the 2D renderer).
  function captions() {
    if (!state.captions.length) return;
    const lines = state.captions.slice(-2);
    ctx.fillStyle = 'rgba(8,10,18,0.62)';
    ctx.fillRect(0, H - 22 - lines.length * 22, W, lines.length * 22 + 14);
    ctx.font = '600 15px system-ui, sans-serif';
    lines.forEach((c, i) => {
      ctx.globalAlpha = Math.min(1, (4 - c.t) / 0.6);
      ctx.fillStyle = c.who === 'p' ? '#9cc0ff' : c.who === 'o' ? '#ff9c9c' : '#e8e8e8';
      ctx.fillText(c.text.length > 90 ? `${c.text.slice(0, 88)}…` : c.text, 16, H - 16 - (lines.length - 1 - i) * 22);
    });
    ctx.globalAlpha = 1;
  }

  // A fresh fight starts without the previous fight's camera, captions and animations.
  function reset() {
    Object.assign(state, { key: '', t: 1, from: null, pulse: null, lastSeq: -1, tapT: 0, labels: [], captions: [], logLen: 0, cam: null });
  }

  resize();
  return { draw, resize, reset, ready, isReady: () => state.ready };
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}
