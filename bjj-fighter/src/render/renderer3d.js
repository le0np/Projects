// Three.js fight renderer with the model fighters. Same contract as renderer2d.js: it reads the fight
// state and never changes it. draw(view, dtReal, { slowmo, mode }) and resize().
// Commentary, technique names and the slow-motion vignette go on a 2D overlay canvas above the 3D one,
// so the HTML HUD and effects (fightFx.js) stay exactly as they are.
import * as THREE from 'three';
import { createFighter3d } from './fighter3d.js';
import { createMat } from './gym3d.js';
import { POSES3D, blendPose, poseTravel } from './poses3d.js';
import { settle, sampleSkin, overlap, contactPush } from './contact3d.js';
import { ACTION_BY_ID } from '../data/positions.js';
import { MOVE_BY_ID } from '../data/moves.js';

const W = 800;
const H = 450;
const LOOK = {
  p: { skin: 'light', hair: 'buzzed', hairColor: '#4a301c', shirt: '#2f6fd6', shorts: '#16181d' },
  o: { skin: 'dark', hair: 'parted', beard: true, hairColor: '#17110d', shirt: '#d23f3f', shorts: '#1d1d1f' },
};

// Smootherstep: starts and ends with zero speed and zero acceleration, so blends never jerk.
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
// Smooth wobble from layered sines (cheap stand-in for noise), roughly -1..1.
const wobble = (t, seed) => (Math.sin(t * 0.9 + seed) * 0.5 + Math.sin(t * 1.7 + seed * 2.3) * 0.3 + Math.sin(t * 2.9 + seed * 4.1) * 0.2);
const SMOOTH_JOINTS = ['Head', 'pelvis', 'hand_l', 'hand_r', 'foot_l', 'foot_r', 'calf_l', 'calf_r', 'lowerarm_l', 'lowerarm_r'];
const TRANSITION = 0.85; // default seconds for a change of position
const PULSE = 0.95; // seconds for a technique movement
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
  floor.position.y = -0.06; // well below the mat tops, or the floor flickers through them
  floor.receiveShadow = true;
  g.add(floor);
  const mat = new THREE.Mesh(new THREE.BoxGeometry(8, 0.04, 8), new THREE.MeshStandardMaterial({ color: '#3a3f4b', roughness: 0.85 }));
  mat.position.y = -0.032; // top at -12 mm
  mat.receiveShadow = true;
  g.add(mat);
  const inner = new THREE.Mesh(new THREE.BoxGeometry(6, 0.042, 6), new THREE.MeshStandardMaterial({ color: '#b8bcc6', roughness: 0.8 }));
  inner.position.y = -0.021; // top at 0, where the fighters stand
  inner.receiveShadow = true;
  g.add(inner);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.041, 6.4), new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.8 }));
  edge.position.y = -0.0265; // top at -6 mm
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
    fighters: null, poses: {}, ready: false, failed: null, key: '', t: 1, from: null, time: 0, pulses: [], lastSeq: -1,
    tapT: 0, labels: [], captions: [], logLen: 0, cam: null, frameMs: [], quality: 'high', fps: 0,
  };

  // Load both fighters, then settle every position once (out of the mat and out of each other).
  // One position per tick, so the page never freezes for long.
  const ready = Promise.all([createFighter3d(LOOK.p), createFighter3d(LOOK.o)]).then(async ([p, o]) => {
    for (const key of Object.keys(POSES3D)) {
      state.poses[key] = settle(p, o, POSES3D[key].T, POSES3D[key].B);
      await new Promise((r) => setTimeout(r, 0));
    }
    state.fighters = { p, o };
    scene.add(p.object, o.object);
    state.ready = true;
  }).catch((err) => { state.failed = err; throw err; });

  // Frame rate watch: if frames take longer than 25 ms on average, drop to plain resolution and
  // cheaper, smaller shadows. Once lowered it stays low for this page visit.
  function watchFrameRate(dtReal) {
    if (dtReal <= 0 || dtReal >= 0.1) return; // skip the first frame and stalls (tab switch)
    state.frameMs.push(dtReal * 1000);
    if (state.frameMs.length < 90) return;
    const avg = state.frameMs.reduce((a, b) => a + b, 0) / state.frameMs.length;
    state.frameMs = [];
    state.fps = Math.round(1000 / avg);
    if (avg > 25 && state.quality === 'high') {
      state.quality = 'low';
      gl.shadowMap.type = THREE.PCFShadowMap;
      for (const light of [sun, spot]) {
        light.shadow.mapSize.set(1024, 1024);
        light.shadow.map?.dispose();
        light.shadow.map = null;
      }
      resize();
    }
  }

  function resize() {
    const dpr = state.quality === 'low' ? 1 : Math.min(2, window.devicePixelRatio || 1);
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
    if (state.mode === mode) return;
    state.mode = mode;
    const comp = mode === 'comp';
    gym.visible = !comp;
    arena.visible = comp;
    spot.visible = comp;
    sun.intensity = comp ? 0.6 : 2.6;
    hemi.intensity = comp ? 0.55 : 1.4;
    scene.background = new THREE.Color(comp ? '#07080c' : '#1b2030');
    scene.fog = comp ? new THREE.Fog('#07080c', 8, 20) : new THREE.Fog('#1b2030', 9, 18);
  }

  // Envelope of a technique movement (t in seconds): a short wind-up away from the opponent, the drive,
  // then a slow settle. Zero speed at the start and the end, so a movement never pops in or out.
  function envelope(t) {
    const a = Math.min(1, Math.max(0, t / PULSE));
    if (a < 0.18) return -0.25 * Math.sin(Math.PI * a / 0.18);
    if (a < 0.5) return ease((a - 0.18) / 0.32);
    return 1 - ease((a - 0.5) / 0.5);
  }

  // Offsets of one technique movement for the fighter who does it.
  function attack(p, kind, k, dir, success, t) {
    switch (kind) {
      case 'takedown': shift(p, ['pelvis', ...UPPER], [dir * 0.3, -0.2, 0], k); shift(p, LOWER, [dir * 0.08, 0, 0], k); break; // shoot in low
      case 'sweep': shift(p, ['pelvis'], [dir * 0.04, 0.05, 0], k); shift(p, LOWER, [dir * 0.04, 0.2, 0], k); break; // hooks elevate
      case 'pass': shift(p, ['pelvis', ...UPPER], [dir * 0.22, 0.04, 0], k); shift(p, LOWER, [dir * 0.1, 0, 0], k); break; // drive around the legs
      case 'escape': shift(p, ['pelvis', ...LOWER], [-dir * 0.2, 0.03, 0], k); break; // shrimp away
      case 'sub': shift(p, ['handL', 'handR'], [-dir * 0.1, Math.sin(t * 40) * 0.02 * Math.abs(k), 0], k); break; // squeeze
      default: shift(p, ['pelvis', ...UPPER], [dir * 0.12, 0.02, 0], k);
    }
    if (success === false) shift(p, ['pelvis', ...UPPER], [-dir * 0.07, 0, 0], Math.max(0, k) * 0.6); // botched: falls back
  }

  // Breathing, weight shifts, hand fighting, technique movements and the tap, applied to the pose targets.
  function liven(pose, who, other, view) {
    const p = clonePose(pose);
    const seed = who === 'p' ? 0 : 2.1;
    const t = state.time;
    const standing = view.pos === 'standing';
    const breathe = Math.sin(t * 2.1 + seed) * 0.012;
    if (p.chestUp) p.chestUp = add(p.chestUp, [0, breathe * 4, 0]);
    if (p.headFwd) p.headFwd = add(p.headFwd, [0, 0, wobble(t * 0.7, seed + 5) * 0.25]); // looks around a little
    if (standing) {
      // Moving feet and weight: the pair circles and pushes; feet follow the hips at a quarter of the distance.
      const sway = [wobble(t * 0.8, seed) * 0.08, -Math.abs(Math.sin(t * 2.2 + seed)) * 0.025, wobble(t * 0.6, seed + 1) * 0.06];
      shift(p, ['pelvis', ...UPPER], sway);
      shift(p, LOWER, sway, 0.25);
      if (p.chestFwd) p.chestFwd = add(p.chestFwd, [0, 0, wobble(t * 0.9, seed + 3) * 0.3]); // shoulders turn with the grips
    } else {
      // On the ground: the top fighter shifts pressure, the bottom one keeps the hips and knees moving.
      shift(p, ['pelvis'], [wobble(t * 0.6, seed) * 0.03, breathe + wobble(t * 0.5, seed + 2) * 0.01, wobble(t * 0.5, seed + 4) * 0.025]);
      ['kneeL', 'kneeR'].forEach((k, i) => { if (p[k]) p[k] = add(p[k], [0, wobble(t * 0.9, seed + i * 3) * 0.04, wobble(t * 0.7, seed + i) * 0.04]); });
    }
    ['handL', 'handR'].forEach((h, i) => { // hand fighting: slow loops, not a buzz
      const ph = seed + i * 1.9;
      p[h] = add(p[h], [wobble(t * 1.3, ph) * 0.05, wobble(t * 1.1, ph + 7) * 0.04, wobble(t * 1.2, ph + 11) * 0.03]);
    });
    for (const pulse of state.pulses) {
      const k = envelope(pulse.t) * (pulse.success === false ? 0.6 : 1);
      if (pulse.who === who) attack(p, pulse.kind, k, pulse.dir, pulse.success, pulse.t);
      else if (pulse.kind === 'sub' && pulse.success !== true) {
        // the one caught in a submission fights the grip
        const s = Math.sin(pulse.t * 22) * 0.05 * Math.max(0, k);
        shift(p, ['handL', 'handR'], [s, Math.abs(s), 0]);
      } else if (pulse.kind === 'takedown' || pulse.kind === 'sweep') {
        shift(p, ['pelvis', ...UPPER], [pulse.dir * 0.06, 0, 0], Math.max(0, k)); // the other one gets driven back
      }
    }
    if (view.ended && view.ended.method === 'sub' && view.ended.winner !== who) {
      p.handR = add(p.handR, [0, Math.abs(Math.sin(state.tapT * 9)) * 0.1, 0]); // the tap
    }
    return p;
  }

  // Persistent target offsets from contacts: a needed push is added gradually and fades out when the
  // contact is gone, so bodies slide apart instead of jumping.
  function easePush(w, need) {
    const off = (state.push ??= { p: {}, o: {} })[w];
    for (const key of new Set([...Object.keys(off), ...Object.keys(need)])) {
      const cur = off[key] ?? [0, 0, 0];
      const n = need[key] ?? [0, 0, 0];
      off[key] = cur.map((v, i) => v * 0.94 + n[i] * 0.55);
      if (Math.hypot(...off[key]) < 1e-4) delete off[key];
    }
  }
  function withPush(target, w) {
    const off = state.push?.[w];
    if (!off) return target;
    const out = { ...target };
    for (const [key, d] of Object.entries(off)) if (out[key]) out[key] = add(out[key], d);
    return out;
  }

  // Pose both fighters. A change of position blends the pose targets (points in straight lines with a small
  // step arc, the body turning on the sphere) and the IK places the limbs every frame, so legs and arms
  // do not swing through the mat the way blended bone rotations do.
  function pose(view, dt) {
    const s = slots(view);
    const key = `${view.pos}:${view.playerTop}`;
    const P = state.poses[view.pos] ?? state.poses.standing;
    const { p, o } = state.fighters;
    // Solve on the mat: any lift from the last frame comes off first, or the hips would be placed against it.
    for (const f of [p, o]) { f.object.position.y = 0; f.object.updateMatrixWorld(true); }
    if (key !== state.key) {
      // The first pose of a fight appears directly; later changes start from the pose shown right now.
      state.from = state.key && state.shown ? { ...state.shown } : null;
      if (state.from) {
        // Longer way, longer transition: a small adjustment takes 0.7 s, standing to the ground up to 1.6 s.
        const travel = Math.max(poseTravel(state.from.p, P[s.p]), poseTravel(state.from.o, P[s.o]));
        state.duration = Math.min(1.8, Math.max(0.7, 0.45 + travel * 0.75));
      }
      state.t = state.from ? 0 : 1;
      state.key = key;
    }
    state.t = Math.min(1, state.t + dt / (state.duration ?? TRANSITION));
    const k = ease(state.t);
    const moving = state.from && state.t < 1;
    const shown = {};
    for (const w of ['p', 'o']) {
      const other = w === 'p' ? 'o' : 'p';
      const base = moving ? blendPose(state.from[w], P[s[w]], k, 0.07) : P[s[w]];
      const otherBase = moving ? blendPose(state.from[other], P[s[other]], k) : P[s[other]];
      shown[w] = base;
      const f = state.fighters[w];
      f.setPose(withPush(liven(base, w, otherBase, view), w), true);
      // Ground check on a coarse skin sample: movements must not sink into the mat.
      const below = Math.max(0, -Math.min(...sampleSkin(f, 24).map((q) => q[1])));
      if (below > (state.maxBelow ?? 0)) {
        state.maxBelow = below;
        const low = sampleSkin(f, 24).reduce((m, q) => (q[1] < m[1] ? q : m));
        state.maxBelowWhen = `${w} ${state.key} t=${state.t.toFixed(2)} pulses=${state.pulses.map((q) => q.kind).join('+')} region=${low[3]}`;
      }
      const g = (state.ground ??= { p: 0, o: 0 });
      g[w] += (below - g[w]) * (below > g[w] ? 0.6 : 0.15); // rises quickly, settles back slowly
      f.object.position.y = state.tune?.ground === false ? 0 : g[w];
      f.object.updateMatrixWorld(true);
    }
    // Contact: measure how the posed bodies touch and ease the pose targets out of each other next frame.
    const top = s.p === 'T' ? 'p' : 'o';
    const push = contactPush(state.fighters[top], state.fighters[top === 'p' ? 'o' : 'p']);
    if (state.tune?.push !== false) {
      easePush(top, push.top);
      easePush(top === 'p' ? 'o' : 'p', push.bottom);
    }
    // Overlap check (for the browser checks): how deep one fighter's skin goes into the other.
    if (state.measure) {
      const d = Math.max(overlap(p, o, 24).depth, overlap(o, p, 24).depth);
      if (d > (state.maxOverlap ?? 0)) { state.maxOverlap = d; state.maxOverlapWhen = `${state.key} t=${state.t.toFixed(2)} pulses=${state.pulses.map((q) => q.kind).join('+')}`; }
    }
    // Remember the unanimated pose on screen, so the next transition starts exactly where this one is.
    state.shown = shown;
    if (!moving) state.from = null;
  }

  // Camera beside the pair, a little in front and above. It frames the heads, hands and feet of both
  // fighters, leaving room for the scoreboard on top and the commentary at the bottom.
  const FRAME_JOINTS = ['Head', 'pelvis', 'hand_l', 'hand_r', 'foot_l', 'foot_r'];
  const TAN_V = Math.tan(THREE.MathUtils.degToRad(36 / 2));
  function moveCamera(view, dtReal, slowmo) {
    const pts = ['p', 'o'].flatMap((w) => FRAME_JOINTS.map((j) => state.fighters[w].joint(j)));
    const min = [0, 1, 2].map((i) => Math.min(...pts.map((q) => q[i])));
    const max = [0, 1, 2].map((i) => Math.max(...pts.map((q) => q[i])));
    const height = max[1] - Math.min(0, min[1]) + 0.3;
    const width = Math.max(max[0] - min[0], (max[2] - min[2]) * 0.7) + 0.5;
    const fit = Math.max(height / 0.56 / 2 / TAN_V, width / 2 / (TAN_V * W / H));
    const standing = view.pos === 'standing';
    const want = {
      pitch: standing ? 0.2 : 0.42,
      x: (min[0] + max[0]) / 2, y: Math.max(0.2, (max[1] + Math.min(0, min[1])) / 2 + height * 0.06), z: (min[2] + max[2]) / 2,
      dist: Math.min(5, Math.max(2.2, fit)) * (slowmo ? 0.9 : 1),
    };
    if (!state.cam) state.cam = { ...want };
    const k = 1 - Math.exp(-dtReal * 1.8); // follows in real time, also in slow motion
    for (const key of Object.keys(want)) state.cam[key] += (want[key] - state.cam[key]) * k;
    const c = state.cam;
    const yaw = 0.32 + Math.sin(state.time * 0.15) * 0.07;
    const pitch = c.pitch;
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
      // Movements overlap instead of replacing each other, so a new action never cuts the last one short.
      // The direction (towards the opponent along the mat) is fixed when the move starts; worked out every
      // frame it would flip the moment the hips pass each other in a transition.
      const me = state.shown?.[view.lastAction.who]?.pelvis;
      const them = state.shown?.[view.lastAction.who === 'p' ? 'o' : 'p']?.pelvis;
      const dir = me && them ? Math.sign(them[0] - me[0]) || 1 : 1;
      state.pulses.push({ who: view.lastAction.who, success: view.lastAction.success, t: 0, kind: action?.kind, dir });
      if (state.pulses.length > 4) state.pulses.shift();
      if (action) {
        const mark = view.lastAction.success === true ? ' ✔' : view.lastAction.success === false ? ' ✘' : '…';
        state.labels.push({ who: view.lastAction.who, text: `${MOVE_BY_ID[action.move].name}${mark}`, ok: view.lastAction.success, t: 0 });
        if (state.labels.length > 3) state.labels.shift();
      }
    }
    for (const pulse of state.pulses) {
      pulse.t += dt;
      // A move still waiting for the player's decision holds at full stretch while time is slowed.
      if (slowmo && pulse.success === null) pulse.t = Math.min(pulse.t, PULSE * 0.45);
    }
    state.pulses = state.pulses.filter((pulse) => pulse.t < PULSE);
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
    watchFrameRate(dtReal);
    environment(opts.mode);
    pose(view, dt);
    // Smoothness check: the biggest move of a hand, foot, head or hip between two frames, per 1/60 s.
    const now = ['p', 'o'].flatMap((w) => SMOOTH_JOINTS.map((j) => state.fighters[w].joint(j)));
    if (state.lastJoints && dtReal > 0) {
      const steps = now.map((q, i) => Math.hypot(q[0] - state.lastJoints[i][0], q[1] - state.lastJoints[i][1], q[2] - state.lastJoints[i][2]));
      const step = Math.max(...steps);
      const perFrame = step * (1 / 60) / dtReal;
      if (perFrame > (state.maxStep ?? 0)) {
        state.maxStep = perFrame;
        const j = steps.indexOf(step);
        const joint = `${j < SMOOTH_JOINTS.length ? 'p' : 'o'}.${SMOOTH_JOINTS[j % SMOOTH_JOINTS.length]}`;
        state.maxStepWhen = `${joint} ${state.from && state.t < 1 ? `transition to ${state.key} t=${state.t.toFixed(2)}` : state.pulses.length ? `move ${state.pulses.map((q) => q.kind).join('+')}` : 'idle'}`;
      }
    }
    state.lastJoints = now;
    moveCamera(view, dtReal, slowmo);
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
    Object.assign(state, { lastJoints: null, maxStep: 0, maxBelow: 0, maxOverlap: 0, ground: null, shown: null, push: null, key: '', t: 1, from: null, pulses: [], lastSeq: -1, tapT: 0, labels: [], captions: [], logLen: 0, cam: null, frameMs: [] });
  }

  resize();
  return { peek: (j = 'Head') => ({ t: state.t, shown: state.shown, joint: state.fighters.o.joint(j), thigh: state.fighters.o.joint('thigh_r'), foot: state.fighters.o.joint('foot_r') }), measure: (on) => { state.measure = on; }, tune: (opts) => { state.tune = opts; }, fighters: () => state.fighters, draw, resize, reset, ready, isReady: () => state.ready, stats: () => ({ fps: state.fps, quality: state.quality, maxStep: state.maxStep ?? 0, maxStepWhen: state.maxStepWhen, maxBelow: state.maxBelow ?? 0, maxBelowWhen: state.maxBelowWhen, maxOverlap: state.maxOverlap ?? 0, maxOverlapWhen: state.maxOverlapWhen }) };
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}
