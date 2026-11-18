// Bird's-eye view of your gym on the career screen. Reads a scene from gymScene(), never changes game state.
const W = 800;
const H = 280;
const MAT = { x: 170, y: 34, w: 450, h: 212 };
const BELT = { white: '#f2f2f2', blue: '#2457c5', purple: '#7a3fb8', brown: '#7a4a24', black: '#111' };
const YOU = { shirt: '#2f6fe0', hair: '#3a2a1e', skin: '#e9b68f' };
const PARTNER = { shirt: '#d64545', hair: '#161210', skin: '#c98d62' };
// Other club members rolling on the mat: position, shirt colours, belts and a phase so they do not move in sync.
const PAIRS = [
  { x: 250, y: 82, a: ['#3a3f4f', '#7b8aa8'], belts: ['white', 'blue'], ph: 0.3 },
  { x: 540, y: 84, a: ['#2e6b55', '#d8d8d8'], belts: ['purple', 'white'], ph: 2.1 },
  { x: 260, y: 196, a: ['#8a5a2a', '#1f2a44'], belts: ['blue', 'brown'], ph: 4.0 },
  { x: 548, y: 198, a: ['#5b2f6e', '#c9a227'], belts: ['white', 'white'], ph: 5.6 },
];
const SKINS = ['#e9b68f', '#c98d62', '#8d5a3b', '#f1c9a5'];

export function createGymView(canvas) {
  const ctx = canvas.getContext('2d');
  let time = 0;
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || W;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round((w * H / W) * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function room() {
    ctx.fillStyle = '#6e5435'; // wooden floor
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < H; y += 14) ctx.fillRect(0, y, W, 1);
    for (let y = 0, i = 0; y < H; y += 14, i++) for (let x = (i % 3) * 37; x < W; x += 110) ctx.fillRect(x, y, 1, 14);
    ctx.strokeStyle = '#2a2119'; // walls
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, W - 10, H - 10);
    ctx.fillStyle = '#6e5435'; // door gap, bottom right
    ctx.fillRect(700, H - 11, 64, 12);
    ctx.fillStyle = 'rgba(190,215,255,0.35)'; // windows on the top wall
    for (const x of [200, 360, 520]) ctx.fillRect(x, 1, 90, 6);

    // tatami
    ctx.fillStyle = '#1d4f7a';
    ctx.fillRect(MAT.x - 8, MAT.y - 8, MAT.w + 16, MAT.h + 16); // darker mat edge
    ctx.fillStyle = '#2b6aa0';
    ctx.fillRect(MAT.x, MAT.y, MAT.w, MAT.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1;
    for (let x = MAT.x; x <= MAT.x + MAT.w; x += 50) { ctx.beginPath(); ctx.moveTo(x, MAT.y); ctx.lineTo(x, MAT.y + MAT.h); ctx.stroke(); }
    for (let y = MAT.y; y <= MAT.y + MAT.h; y += 53) { ctx.beginPath(); ctx.moveTo(MAT.x, y); ctx.lineTo(MAT.x + MAT.w, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.font = 'italic 800 34px "Barlow Condensed", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BJJ KLUB', MAT.x + MAT.w / 2, MAT.y + MAT.h / 2 + 12);

    // weights corner (left)
    ctx.fillStyle = '#2b2b30';
    rr(20, 24, 130, 120, 8); ctx.fill();
    ctx.fillStyle = '#4a4a52'; // squat rack
    ctx.fillRect(34, 36, 8, 50); ctx.fillRect(84, 36, 8, 50);
    ctx.fillStyle = '#9aa0ab';
    ctx.fillRect(28, 58, 70, 4);
    ctx.fillStyle = '#1a1a1e';
    ctx.fillRect(24, 52, 6, 16); ctx.fillRect(96, 52, 6, 16);
    ctx.fillStyle = '#5a3d2a'; // bench
    rr(110, 40, 22, 56, 5); ctx.fill();
    for (let i = 0; i < 5; i++) { // dumbbells
      ctx.fillStyle = '#1a1a1e';
      ctx.fillRect(30 + i * 22, 118, 14, 6);
      ctx.fillStyle = '#9aa0ab';
      ctx.fillRect(34 + i * 22, 120, 6, 2);
    }
    label('TERETANA', 85, 18);

    // cardio corner (right)
    ctx.fillStyle = '#2b2b30';
    rr(650, 24, 130, 120, 8); ctx.fill();
    for (const x of [664, 720]) { // treadmills
      ctx.fillStyle = '#16161a'; rr(x, 34, 40, 90, 6); ctx.fill();
      ctx.fillStyle = '#3a3a42'; ctx.fillRect(x + 6, 52, 28, 66);
      ctx.fillStyle = '#4b8df0'; ctx.fillRect(x + 10, 38, 20, 8);
    }
    label('KARDIO', 715, 18);

    // bench and belt rack by the door
    ctx.fillStyle = '#5a3d2a';
    rr(30, H - 46, 120, 20, 5); ctx.fill();
    Object.values(BELT).forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(30 + i * 24, H - 18, 18, 4); });
    label('KLUPA', 90, H - 32);
    label('IZLAZ', 732, H - 20);
  }

  function label(text, x, y, color = 'rgba(255,255,255,0.55)') {
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  // A person seen from above: shoulders, arms, head. `reach` 0..1 moves the arms forward, `lying` draws a body on its back.
  function person(x, y, angle, look, { reach = 0.3, lying = false, belt = null, skin } = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.lineCap = 'round';
    if (lying) {
      ctx.strokeStyle = '#1b2233'; // legs
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(-10, 22 + reach * 4); ctx.moveTo(4, 4); ctx.lineTo(10, 22 + reach * 4); ctx.stroke();
      ctx.fillStyle = look.shirt;
      rr(-10, -12, 20, 20, 7); ctx.fill();
    }
    ctx.strokeStyle = skin || look.skin; // arms reach forward (negative y)
    ctx.lineWidth = 4.5;
    const fy = -6 - reach * 12;
    ctx.beginPath();
    ctx.moveTo(-10, -2); ctx.lineTo(-9 + reach * 3, fy);
    ctx.moveTo(10, -2); ctx.lineTo(9 - reach * 3, fy);
    ctx.stroke();
    ctx.fillStyle = look.shirt;
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 7.5, 0, 0, Math.PI * 2); ctx.fill();
    if (belt) { ctx.fillStyle = BELT[belt]; ctx.fillRect(-9, 4, 18, 2.5); }
    ctx.fillStyle = look.hair;
    ctx.beginPath(); ctx.arc(0, -1, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Two people rolling: standing grip fighting, then one ends up on the ground under the other.
  function pair(cx, cy, t, a, b, opts = {}) {
    const cycle = (t * (opts.tempo || 0.35)) % 2; // 0-1 standing, 1-2 ground
    const spin = opts.spin ?? t * 0.25;
    const ground = opts.ground ?? cycle > 1;
    if (ground) {
      const pulse = Math.sin(t * 3) * 0.5 + 0.5;
      person(cx, cy + 4, spin + Math.PI, a, { lying: true, reach: pulse, belt: opts.belts?.[0], skin: opts.skins?.[0] });
      person(cx + Math.sin(t * 2) * 2, cy - 4, spin + Math.PI, b, { reach: 0.6 + pulse * 0.4, belt: opts.belts?.[1], skin: opts.skins?.[1] });
    } else {
      const gap = 13 + Math.sin(t * 2.4) * 3;
      const dx = Math.sin(spin) * gap, dy = -Math.cos(spin) * gap;
      const reach = 0.5 + Math.sin(t * 4) * 0.3;
      person(cx - dx, cy - dy, spin, a, { reach, belt: opts.belts?.[0], skin: opts.skins?.[0] });
      person(cx + dx, cy + dy, spin + Math.PI, b, { reach: 1 - reach, belt: opts.belts?.[1], skin: opts.skins?.[1] });
    }
  }

  function tag(x, y, text, progress, accent = '#e3b341') {
    ctx.font = '700 12px system-ui, sans-serif';
    const w = Math.max(90, ctx.measureText(text).width + 18);
    const left = Math.max(8, Math.min(W - w - 8, x - w / 2));
    ctx.fillStyle = 'rgba(8,10,16,0.82)';
    rr(left, y - 30, w, progress === null ? 20 : 26, 6); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(text, left + w / 2, y - 16);
    if (progress !== null) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(left + 8, y - 10, w - 16, 3);
      ctx.fillStyle = accent;
      ctx.fillRect(left + 8, y - 10, (w - 16) * progress, 3);
    }
  }

  // Drilling: you and the partner repeat the move in reps. Takedowns shoot in, everything else is on the ground.
  function you(scene, t) {
    const { spot, label: text, progress, category } = scene.you;
    const look = YOU;
    if (spot === 'mat') {
      const x = MAT.x + MAT.w / 2, y = MAT.y + MAT.h / 2;
      ctx.strokeStyle = 'rgba(227,179,65,0.7)'; // highlight ring
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, 42, 34, 0, 0, Math.PI * 2); ctx.stroke();
      const standing = category === 'takedown';
      if (standing) {
        const rep = (t * 0.8) % 1;
        const shoot = rep < 0.35 ? Math.sin((rep / 0.35) * Math.PI) : 0;
        person(x - 20 + shoot * 12, y, Math.PI / 2, look, { reach: 0.3 + shoot * 0.7, belt: scene.belt });
        person(x + 18, y, -Math.PI / 2, PARTNER, { reach: 0.4 });
      } else {
        pair(x, y, t, PARTNER, look, { ground: true, spin: Math.PI / 2 + Math.sin(t * 0.8) * 0.25, belts: [null, scene.belt] });
      }
      tag(x, y - 30, text, progress);
    } else if (spot === 'weights') {
      const press = Math.sin(t * 2.2) * 0.5 + 0.5;
      ctx.fillStyle = '#9aa0ab';
      ctx.fillRect(104, 52 - press * 4, 34, 3);
      person(121, 70, 0, look, { reach: press, lying: true, belt: scene.belt });
      tag(85, 150, text, progress);
    } else if (spot === 'cardio') {
      const bob = Math.sin(t * 9);
      person(684, 88 + bob * 1.5, Math.PI, look, { reach: 0.3 + bob * 0.3, belt: scene.belt });
      tag(715, 150, text, progress);
    } else if (spot === 'bench') {
      person(90, H - 36, Math.PI, look, { reach: 0.1, belt: scene.belt });
      tag(90, H - 62, 'Odmor', null);
    }
    if (spot === 'away') tag(732, H - 30, `${text} (izvan kluba)`, progress, '#3fb27f');
    for (const s of scene.side) { // other running timers as signs where they happen
      if (s.spot === 'weights') tag(85, 150, s.label, s.progress, '#4b8df0');
      if (s.spot === 'cardio') tag(715, 150, s.label, s.progress, '#4b8df0');
      if (s.spot === 'away') tag(732, H - 30, `${s.label} (izvan kluba)`, s.progress, '#3fb27f');
    }
  }

  // Speech bubble with the coach's short line from the story (white, so it reads as talk, not a status sign).
  function bubble(x, y, text) {
    ctx.font = '700 12px system-ui, sans-serif';
    const w = ctx.measureText(text).width + 18;
    const left = Math.max(8, Math.min(W - w - 8, x - w / 2));
    const top = y < 60 ? y + 18 : y - 40;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    rr(left, top, w, 22, 8); ctx.fill();
    ctx.beginPath();
    const tx = Math.max(left + 10, Math.min(left + w - 10, x));
    if (top > y) { ctx.moveTo(tx - 5, top); ctx.lineTo(tx, top - 7); ctx.lineTo(tx + 5, top); }
    else { ctx.moveTo(tx - 5, top + 22); ctx.lineTo(tx, top + 29); ctx.lineTo(tx + 5, top + 22); }
    ctx.fill();
    ctx.fillStyle = '#1a1d26';
    ctx.textAlign = 'center';
    ctx.fillText(text, left + w / 2, top + 15);
    ctx.textAlign = 'start';
  }

  function coach(t) {
    // walks a loop around the mat edge
    const u = (t * 0.03) % 1;
    const per = 2 * (MAT.w + MAT.h);
    let d = u * per, x, y, ang;
    if (d < MAT.w) { x = MAT.x + d; y = MAT.y - 2; ang = Math.PI / 2; }
    else if ((d -= MAT.w) < MAT.h) { x = MAT.x + MAT.w + 2; y = MAT.y + d; ang = Math.PI; }
    else if ((d -= MAT.h) < MAT.w) { x = MAT.x + MAT.w - d; y = MAT.y + MAT.h + 2; ang = -Math.PI / 2; }
    else { d -= MAT.w; x = MAT.x - 2; y = MAT.y + MAT.h - d; ang = 0; }
    person(x, y, ang, { shirt: '#111', hair: '#555', skin: '#d9a47c' }, { reach: 0.2 + Math.abs(Math.sin(t * 5)) * 0.15, belt: 'black' });
    return { x, y };
  }

  function draw(scene, dt) {
    if (!still?.matches) time += dt;
    const t = time;
    ctx.textAlign = 'start';
    room();
    PAIRS.forEach((p, i) => pair(p.x, p.y, t + p.ph, { shirt: p.a[0], hair: '#2a1d14' }, { shirt: p.a[1], hair: '#111' },
      { belts: p.belts, skins: [SKINS[i % 4], SKINS[(i + 2) % 4]], tempo: 0.3 + i * 0.04, spin: (t + p.ph) * 0.2 }));
    const c = coach(t);
    you(scene, t);
    ctx.textAlign = 'start';
    if (scene.coach) bubble(c.x, c.y, `Mirko: ${scene.coach}`);
  }

  return { draw, resize };
}
