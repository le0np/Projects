// Canvas 2D renderer. Reads fight state, never changes it, so it can be swapped for a 3D one.
import { POSES, JOINTS, GROUND } from './poses.js';
import { ACTION_BY_ID } from '../data/positions.js';
import { MOVE_BY_ID } from '../data/moves.js';

// Fixed pseudo-random numbers for scenery (crowd, gym partners) so it does not flicker between frames.
const scatter = (n, seed) => Array.from({ length: n }, (_, i) => {
  const x = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
});
const CROWD = scatter(160, 1);
const PARTNERS = scatter(12, 2);

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
  const state = { camX: 380, camY: 320, p: null, o: null, from: null, t: 1, key: '', time: 0, pulse: null, lastSeq: -1, tapT: 0, labels: [], captions: [], logLen: 0 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || W;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round((w * H / W) * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    state.base = ctx.getTransform();
  }

  // Sparring happens in your gym: warm walls, windows, a belt rack and other pairs rolling in the back.
  function gymBackground() {
    const wall = ctx.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, '#3b342c');
    wall.addColorStop(1, '#4b4236');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H);
    const shift = -(state.camX * 0.25) % 260;
    for (let x = shift - 260; x < W + 260; x += 260) {
      ctx.fillStyle = 'rgba(190,215,255,0.16)'; // window
      ctx.fillRect(x + 30, 34, 120, 84);
      ctx.fillStyle = 'rgba(40,32,24,0.9)';
      ctx.fillRect(x + 88, 34, 4, 84);
      ctx.fillRect(x + 30, 74, 120, 4);
    }
    // belt rack
    const rackX = W - 170 + shift * 0.3;
    ['#f2f2f2', '#2f6fe0', '#7b3fbf', '#7a4b26', '#111'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(rackX, 140 + i * 9, 110, 5);
    });
    for (let x = shift - 260; x < W + 260; x += 260) { // club banner between the windows
      ctx.fillStyle = '#8c2f2f';
      ctx.fillRect(x + 168, 40, 104, 46);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BJJ CLUB', x + 220, 69);
      ctx.textAlign = 'start';
    }
    ctx.fillStyle = '#6b5233'; // wooden wall panel
    ctx.fillRect(0, 190, W, 70);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = shift % 40; x < W; x += 40) ctx.fillRect(x, 190, 2, 70);
    // other pairs training in the back
    for (let i = 0; i < 4; i++) {
      const x = ((PARTNERS[i] * 900 + i * 230 - state.camX * 0.5) % 1000 + 1000) % 1000 - 100;
      const bob = Math.sin(state.time * (1.5 + PARTNERS[i + 4]) + i) * 4;
      ctx.fillStyle = 'rgba(20,16,12,0.45)';
      ctx.beginPath();
      ctx.ellipse(x, 252 + bob, 34, 14, 0.2, 0, Math.PI * 2);
      ctx.ellipse(x + 30, 246 - bob, 30, 16, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 30, 244 + bob, 8, 0, Math.PI * 2);
      ctx.arc(x + 58, 236 - bob, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Competitions: dark arena, spotlights and a crowd.
  function arenaBackground() {
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(0, 0, W, H);
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 40; i++) {
        const k = CROWD[(row * 40 + i) % CROWD.length];
        const x = ((i * 24 + row * 12 - state.camX * (0.15 + row * 0.05)) % 980 + 980) % 980 - 90;
        const y = 120 + row * 34 + Math.sin(state.time * (2 + k * 3) + i) * (k > 0.8 ? 3 : 1);
        ctx.fillStyle = `rgba(${60 + row * 18},${60 + row * 16},${80 + row * 14},${0.5 + row * 0.12})`;
        ctx.beginPath();
        ctx.arc(x, y, 8 + row, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x - 11 - row, y + 7, 22 + row * 2, 22);
      }
    }
    ctx.fillStyle = '#151a28';
    ctx.fillRect(0, 248, W, 26);
    ctx.fillStyle = '#e8c547';
    ctx.font = 'bold 15px system-ui, sans-serif';
    for (let x = -(state.camX * 0.4) % 260 - 260; x < W; x += 260) ctx.fillText('TOURNAMENT · NO-GI GRAPPLING', x, 266);
    for (const lx of [W * 0.25, W * 0.75]) {
      const g = ctx.createLinearGradient(lx, 0, lx, H);
      g.addColorStop(0, 'rgba(255,240,200,0.20)');
      g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(lx - 20, 0); ctx.lineTo(lx + 20, 0); ctx.lineTo(lx + 220, H); ctx.lineTo(lx - 220, H);
      ctx.fill();
    }
  }

  // Mat in world coordinates (drawn inside the camera transform).
  function mat(mode) {
    const comp = mode === 'comp';
    ctx.fillStyle = comp ? '#1c1f2b' : '#2c6e8f';
    ctx.fillRect(-400, 300, 1600, 300);
    ctx.fillStyle = comp ? '#c23b3b' : '#c9a646';
    ctx.fillRect(-400, 300, 1600, 6);
    ctx.fillStyle = comp ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.12)';
    for (let x = -400; x < 1200; x += 80) ctx.fillRect(x, 306, 2, 300);
    if (!comp) for (let x = -400; x < 1200; x += 160) { ctx.fillStyle = 'rgba(30,60,90,0.35)'; ctx.fillRect(x, 306, 80, 300); }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
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
      // Scramble: both fighters come off the mat a little while they change position.
      const lift = Math.sin(Math.PI * state.t) * 22;
      const up = (pose) => pose.map(([x, y]) => [x, y - lift]);
      state.p = up(lerpPose(state.from.p, target.p, ease(state.t)));
      state.o = up(lerpPose(state.from.o, target.o, ease(state.t)));
    } else {
      state.p = target.p;
      state.o = target.o;
      state.from = null;
    }
    return s;
  }

  // Breathing, hand fighting, attack animations by technique type, and the tap.
  // Joint index: 0 head, 1 neck, 2 hip, 3/4 near elbow/hand, 5/6 far elbow/hand, 7/8 near knee/foot, 9/10 far knee/foot.
  function liven(pose, who, view) {
    const ph = who === 'p' ? 0 : 1.7;
    const t = state.time;
    const breathe = Math.sin(t * 2.4 + ph) * 1.6;
    const standing = view.pos === 'standing';
    const sway = standing ? Math.sin(t * 1.3 + ph) * 7 : Math.sin(t * 0.9 + ph) * 2;
    const bounce = standing ? Math.abs(Math.sin(t * 2.6 + ph)) * 4 : 0;
    const hand = (i) => [Math.sin(t * 3.1 + ph + i) * 4, Math.cos(t * 2.3 + ph + i) * 3];
    let out = pose.map(([x, y], i) => {
      let nx = x + (i <= 6 ? sway : sway * 0.4);
      let ny = y + (i <= 1 || i === 4 || i === 6 ? breathe : 0) - (i <= 6 ? bounce : 0);
      if (i === 4 || i === 6) { const [hx, hy] = hand(i); nx += hx; ny += hy; } // hand fighting
      return [nx, ny];
    });
    const other = who === 'p' ? state.o : state.p;
    const dir = Math.sign(other[2][0] - pose[2][0]) || 1;
    const pulse = state.pulse;
    if (pulse && pulse.who === who) {
      const a = Math.min(1, pulse.t / 0.6);
      const k = Math.sin(a * Math.PI) * (pulse.success === false ? 7 : 12);
      const move = (idx, dx, dy) => { out = out.map(([x, y], i) => (idx.includes(i) ? [x + dx, y + dy] : [x, y])); };
      switch (pulse.kind) {
        case 'takedown': move([0, 1, 2, 3, 4, 5, 6], dir * k * 2, k * 1.4); break; // shoot in low
        case 'sweep': move([2, 7, 8, 9, 10], dir * k * 0.6, -k * 1.6); break; // hips and legs elevate
        case 'pass': move([0, 1, 2, 3, 4, 5, 6], dir * k * 1.6, -k * 0.4); break; // drive around the legs
        case 'escape': move([2, 7, 8, 9, 10], -dir * k * 1.5, 0); move([0, 1], -dir * k * 0.6, -k * 0.5); break; // shrimp away
        case 'sub': { // squeeze: arms pull in and shake
          const shake = Math.sin(pulse.t * 45) * 3 * Math.sin(a * Math.PI);
          move([3, 4, 5, 6], -dir * k * 0.5, shake);
          break;
        }
        default: move([0, 1, 3, 4, 5, 6], dir * k, -k * 0.3);
      }
      if (pulse.success === false && a > 0.5) move([0, 1], -dir * 4, 5); // botched: stumbles back
    } else if (pulse && pulse.kind === 'sub' && pulse.success !== true) {
      // the one caught in a submission fights the grip
      const struggle = Math.sin(pulse.t * 30) * 4 * Math.sin(Math.min(1, pulse.t / 0.6) * Math.PI);
      out = out.map(([x, y], i) => (i === 4 || i === 6 ? [x + struggle, y - Math.abs(struggle)] : [x, y]));
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
    // Commentary: the newest log lines, without the numbers in brackets.
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
    if (opts.mode === 'comp') arenaBackground(); else gymBackground();
    ctx.save();
    ctx.translate(W / 2, H * 0.58);
    ctx.scale(zoom, zoom);
    ctx.translate(-state.camX, -Math.min(state.camY, 335));
    mat(opts.mode);
    const livedP = liven(state.p, 'p', view);
    const livedO = liven(state.o, 'o', view);
    const P = fighterLayers(livedP, LOOK.p);
    const O = fighterLayers(livedO, LOOK.o);
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
    // Technique name floating up from the fighter who tried it.
    for (const l of state.labels) {
      const head = (l.who === 'p' ? livedP : livedO)[0];
      const a = Math.min(1, l.t / 1.6);
      ctx.globalAlpha = 1 - a * a;
      ctx.font = `bold ${14 / Math.max(1, zoom * 0.8)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4 / zoom;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      const y = head[1] - 26 - a * 30;
      ctx.strokeText(l.text, head[0], y);
      ctx.fillStyle = l.ok === false ? '#ff8a8a' : l.ok === true ? '#8dffb0' : '#ffe27a';
      ctx.fillText(l.text, head[0], y);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'start';
    }
    ctx.restore();
    captions();
    if (slowmo) {
      const g = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 470);
      g.addColorStop(0, 'rgba(10,14,30,0)');
      g.addColorStop(1, 'rgba(10,14,30,0.72)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Running commentary at the bottom of the picture.
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

  resize();
  return { draw, resize };
}
