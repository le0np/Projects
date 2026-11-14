// Canvas 2D renderer. Reads fight state, never changes it, so it can be swapped for a 3D one.
import { POSES, JOINTS, GROUND } from './poses.js';

const W = 800;
const H = 450;
const LOOK = {
  p: { shirt: '#2f6fe0', shirtDark: '#1f4fae', shorts: '#1b2233', skin: '#e9b68f', skinDark: '#c9946c', hair: '#3a2a1e' },
  o: { shirt: '#d64545', shirtDark: '#a43030', shorts: '#2b1d1d', skin: '#c98d62', skinDark: '#a8714b', hair: '#161210' },
};

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpPose = (a, b, t) => a.map((p, i) => [lerp(p[0], b[i][0], t), lerp(p[1], b[i][1], t)]);

// Which pose slot (T or B) each fighter takes.
function slots(view) {
  if (view.pos === 'standing' || view.playerTop === null) return { p: 'T', o: 'B' };
  return view.playerTop ? { p: 'T', o: 'B' } : { p: 'B', o: 'T' };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const state = { camX: 380, camY: 320, p: null, o: null, from: null, t: 1, key: '', time: 0, pulse: null, lastSeq: -1, tapT: 0 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || W;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round((w * H / W) * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    state.base = ctx.getTransform();
  }

  function background() {
    const wall = ctx.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, '#1d2230');
    wall.addColorStop(1, '#2b3346');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let x = 40 - (state.camX % 120); x < W; x += 120) ctx.fillRect(x, 30, 70, 120);
  }

  // Mat in world coordinates (drawn inside the camera transform).
  function mat() {
    ctx.fillStyle = '#2f7d5b';
    ctx.fillRect(-400, 300, 1600, 300);
    ctx.fillStyle = '#c9a646';
    ctx.fillRect(-400, 300, 1600, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = -400; x < 1200; x += 80) ctx.fillRect(x, 306, 2, 300);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(state.camX, GROUND + 4, 150, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function seg(a, b, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }

  function dot(p, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    ctx.fill();
  }

  const J = (pose) => Object.fromEntries(JOINTS.map((n, i) => [n, pose[i]]));

  function arm(j, look, side) {
    const e = j[`e${side}`], h = j[`h${side}`];
    const dark = side === 'F';
    seg(j.neck, e, 13, dark ? look.shirtDark : look.shirt);
    seg(e, h, 11, dark ? look.shirtDark : look.shirt);
    dot(h, 6, dark ? look.skinDark : look.skin);
  }

  function leg(j, look, side) {
    const k = j[`k${side}`], f = j[`f${side}`];
    const dark = side === 'F';
    const thighEnd = [lerp(j.hip[0], k[0], 0.55), lerp(j.hip[1], k[1], 0.55)];
    seg(k, f, 13, dark ? look.skinDark : look.skin);
    seg(j.hip, k, 17, dark ? look.skinDark : look.skin);
    seg(j.hip, thighEnd, 19, look.shorts);
    dot(f, 6, dark ? look.skinDark : look.skin);
  }

  function body(j, look) {
    seg(j.neck, j.hip, 30, look.shirt);
    dot(j.hip, 14, look.shorts);
    const dx = j.head[0] - j.neck[0], dy = j.head[1] - j.neck[1];
    seg(j.neck, [j.neck[0] + dx * 0.5, j.neck[1] + dy * 0.5], 10, look.skin);
    dot(j.head, 14, look.skin);
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.arc(j.head[0], j.head[1], 14, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
  }

  function fighterLayers(pose, look) {
    const j = J(pose);
    return {
      far: () => { arm(j, look, 'F'); leg(j, look, 'F'); },
      body: () => body(j, look),
      nearArm: () => arm(j, look, 'N'),
      nearLeg: () => leg(j, look, 'N'),
    };
  }

  function animated(view, dt) {
    const key = `${view.pos}:${view.playerTop}`;
    const s = slots(view);
    const pose = POSES[view.pos];
    const target = { p: pose[s.p], o: pose[s.o] };
    if (!state.p) { state.p = target.p; state.o = target.o; state.key = key; }
    if (key !== state.key) {
      state.from = { p: state.p, o: state.o };
      state.t = 0;
      state.key = key;
    }
    state.t = Math.min(1, state.t + dt / 0.55);
    if (state.from && state.t < 1) {
      state.p = lerpPose(state.from.p, target.p, ease(state.t));
      state.o = lerpPose(state.from.o, target.o, ease(state.t));
    } else {
      state.p = target.p;
      state.o = target.o;
      state.from = null;
    }
    return s;
  }

  // Breathing, attack pulses and the tap.
  function liven(pose, who, view) {
    const breathe = Math.sin(state.time * 2.4 + (who === 'p' ? 0 : 1.7)) * 1.6;
    let out = pose.map(([x, y], i) => (i <= 1 || i === 4 || i === 6 ? [x, y + breathe] : [x, y]));
    if (state.pulse && state.pulse.who === who) {
      const k = Math.sin(Math.min(1, state.pulse.t / 0.45) * Math.PI) * (state.pulse.success === false ? 6 : 10);
      const other = who === 'p' ? state.o : state.p;
      const dir = Math.sign(other[2][0] - pose[2][0]) || 1;
      out = out.map(([x, y], i) => ([0, 1, 3, 4, 5, 6].includes(i) ? [x + dir * k, y - k * 0.3] : [x, y]));
    }
    if (view.ended && view.ended.method === 'sub' && view.ended.winner !== who) {
      const tap = Math.abs(Math.sin(state.tapT * 9)) * 8;
      out[4] = [out[4][0], out[4][1] - tap];
    }
    return out;
  }

  function draw(view, dtReal, opts = {}) {
    const slowmo = !!opts.slowmo;
    const dt = dtReal * (slowmo ? 0.15 : 1);
    state.time += dt;
    if (view.lastAction && view.lastAction.seq !== state.lastSeq) {
      state.lastSeq = view.lastAction.seq;
      state.pulse = { who: view.lastAction.who, success: view.lastAction.success, t: 0 };
    }
    if (state.pulse) {
      state.pulse.t += dt;
      if (state.pulse.t > 0.45 && !(slowmo && state.pulse.success === null)) state.pulse = null;
      else if (slowmo && state.pulse.success === null) state.pulse.t = Math.min(state.pulse.t, 0.22);
    }
    if (view.ended) state.tapT += dt;
    const s = animated(view, dt);
    // Camera follows the pair and zooms in.
    const xs = [...state.p, ...state.o].map((q) => q[0]);
    const ys = [...state.p, ...state.o].map((q) => q[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const k = state.camInit ? Math.min(1, dt * 3) : 1;
    state.camInit = true;
    state.camX += (cx - state.camX) * k;
    state.camY += (cy - state.camY) * k;
    const fit = Math.min(W * 0.62 / (Math.max(...xs) - Math.min(...xs) + 40), H * 0.5 / (Math.max(...ys) - Math.min(...ys) + 40));
    const want = Math.min(2.1, fit) * (slowmo ? 1.08 : 1);
    state.zoom = state.zoom ? state.zoom + (want - state.zoom) * k : want;
    const zoom = state.zoom;
    background();
    ctx.save();
    ctx.translate(W / 2, H * 0.58);
    ctx.scale(zoom, zoom);
    ctx.translate(-state.camX, -Math.min(state.camY, 335));
    mat();
    const P = fighterLayers(liven(state.p, 'p', view), LOOK.p);
    const O = fighterLayers(liven(state.o, 'o', view), LOOK.o);
    const T = s.p === 'T' ? P : O;
    const B = s.p === 'T' ? O : P;
    const pose = POSES[view.pos];
    if (pose.topBehind) {
      T.far(); T.body(); B.far(); B.body(); B.nearLeg(); T.nearLeg(); B.nearArm(); T.nearArm();
    } else {
      B.far(); T.far(); B.body(); T.body();
      if (pose.bottomLegsOver) { T.nearLeg(); B.nearArm(); T.nearArm(); B.nearLeg(); }
      else { B.nearLeg(); B.nearArm(); T.nearLeg(); T.nearArm(); }
    }
    ctx.restore();
    if (slowmo) {
      const g = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 470);
      g.addColorStop(0, 'rgba(10,14,30,0)');
      g.addColorStop(1, 'rgba(10,14,30,0.72)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  resize();
  return { draw, resize };
}
