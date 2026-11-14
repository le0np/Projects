// UI: screens, game loop, saving. All rules live in src/engine; this file only wires them to the DOM.
import { BELTS, BELT_NAMES, CATEGORIES, MOVES, MOVE_BY_ID } from '../data/moves.js';
import { POSITIONS } from '../data/positions.js';
import {
  createState, learnTime, effectiveLevel, canTrain, startTraining, startActivity, advance, setSpeed,
  rollCompetitionLearn, promotionStatus, promote, serialize, deserialize, ACTIVITIES, MAX_LEVEL,
} from '../engine/progression.js';
import { createFight, stepFight, chooseOption, ROUND_SECONDS, ROUNDS, CLOCK_SPEED } from '../engine/fight.js';
import { makeOpponent, fighterFromState } from '../engine/opponent.js';
import { createRenderer } from '../render/renderer2d.js';
import { tickCriticalTimer } from './criticalTimer.js';

const SAVE_KEY = 'bjj-fighter-save-v1';
const SPAR_REWARD = 10;
const COMP_FEE = 20;
const COMP_STAGES = ['Četvrtfinale', 'Polufinale', 'Finale'];
const COMP_PRIZES = { gold: 100, silver: 40, bronze: 15 };
const BELT_COLORS = { white: '#f2f2f2', blue: '#2457c5', purple: '#7a3fb8', brown: '#7a4a24', black: '#000' };

const $ = (id) => document.getElementById(id);
const rng = Math.random;

// ---------- state & saving ----------
let state = load();
let activeTab = 'club';
let fightCtx = null; // { fight, mode: 'spar'|'comp', stage, timer, feedbackUntil }
let renderer = null;

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return deserialize(raw, Date.now());
  } catch { /* storage blocked: play without saving */ }
  return createState({ test: true, now: Date.now() });
}

function save() {
  try { localStorage.setItem(SAVE_KEY, serialize(state)); } catch { /* ignore */ }
}

// ---------- formatting ----------
function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return s ? `${m} min ${s} s` : `${m} min`;
  const h = Math.floor(m / 60), mm = m % 60;
  if (h < 24) return mm ? `${h} h ${mm} min` : `${h} h`;
  const d = Math.floor(h / 24), hh = h % 24;
  return hh ? `${d} d ${hh} h` : `${d} d`;
}
const realLeft = (endsAt) => (endsAt - state.gameTime) / state.speed;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

// ---------- header & status ----------
function renderHeader() {
  const b = $('belt');
  b.className = `belt belt-${state.belt}`;
  b.textContent = `${BELT_NAMES[state.belt]} pojas`;
  $('money').textContent = `${state.money} €`;
  $('record').textContent = `${state.wins}P / ${state.losses}I`;
}

function slotHtml(title, what, startedAt, endsAt, idle) {
  if (!what) return `<div class="slot"><h3>${title}</h3><div class="idle">${idle}</div></div>`;
  const pct = Math.min(100, ((state.gameTime - startedAt) / (endsAt - startedAt)) * 100);
  return `<div class="slot"><h3>${title}</h3><div class="what">${what}</div>
    <div class="bar"><div style="width:${pct.toFixed(1)}%"></div></div>
    <div class="eta">još ${fmtTime(realLeft(endsAt))}${state.speed > 1 ? ` (ubrzanje ${state.speed}x)` : ''}</div></div>`;
}

function renderStatus() {
  const t = state.training;
  const a = state.activity;
  $('status').innerHTML =
    slotHtml('Trening', t && `${esc(MOVE_BY_ID[t.moveId].name)} → razina ${t.toLevel}`, t?.startedAt, t?.endsAt, 'Nema treninga. Odaberi potez u klubu.')
    + slotHtml('Aktivnost', a && `${ACTIVITIES[a.type].name} (šansa za novi potez ${Math.round(a.chance * 100)} %)`, a?.startedAt, a?.endsAt, 'Slobodan. Idi na seminar ili open mat.');
}

// ---------- tabs ----------
function pips(level) {
  let html = '<span class="pips">';
  for (let i = 1; i <= MAX_LEVEL; i++) html += `<i class="${i <= level ? 'on' : ''}"></i>`;
  return `${html}</span>`;
}

function renderClub() {
  let html = '<p class="hint">Svaka sljedeća razina poteza traje 2x duže. Viši pojas uči brže. Jedan trening istovremeno.</p>';
  for (const [cat, title] of Object.entries(CATEGORIES)) {
    const moves = MOVES.filter((m) => m.category === cat);
    html += `<h2>${title}</h2><div class="moves">`;
    for (const m of moves) {
      const lvl = effectiveLevel(state, m.id);
      const check = canTrain(state, m.id);
      const training = state.training?.moveId === m.id;
      const next = lvl < MAX_LEVEL ? learnTime(m.id, lvl + 1, state.belt) / state.speed : null;
      const locked = !check.ok && lvl === 0 && !state.training;
      html += `<div class="move${training ? ' training' : ''}${locked ? ' locked' : ''}">
        <div><span class="beltdot" style="background:${BELT_COLORS[m.belt]}" title="${BELT_NAMES[m.belt]} pojas"></span><span class="name">${esc(m.name)}</span>${pips(lvl)}</div>
        <button data-train="${m.id}" ${check.ok ? '' : `disabled title="${esc(check.reason)}"`}>${lvl === 0 ? 'Nauči' : 'Treniraj'}</button>
        <div class="desc">${esc(m.desc)}</div>
        <div class="meta">${training ? 'Trening u tijeku' : next === null ? 'Najviša razina' : `${lvl === 0 ? 'Učenje' : `Razina ${lvl + 1}`}: ${fmtTime(next)}`}${locked ? ` · ${esc(check.reason)}` : ''}</div>
      </div>`;
    }
    html += '</div>';
  }
  $('tab-club').innerHTML = html;
}

function renderActivities() {
  const busy = !!state.activity;
  const sem = ACTIVITIES.seminar, om = ACTIVITIES.openMat;
  $('tab-activities').innerHTML = `
    <p class="hint">Na aktivnostima se može naučiti nasumičan novi potez, pa i onaj višeg pojasa. Jedna aktivnost istovremeno, uz trening.</p>
    <div class="cards">
      <div class="card"><h3>Seminar</h3><p>Gostujući instruktor pokazuje tehnike.</p>
        <div class="row"><span>Cijena</span><b>${sem.cost} €</b></div>
        <div class="row"><span>Trajanje</span><b>${fmtTime(sem.duration / state.speed)}</b></div>
        <div class="row"><span>Šansa za novi potez</span><b>90 %</b></div>
        <button data-activity="seminar" ${busy || state.money < sem.cost ? 'disabled' : ''}>Idi na seminar</button></div>
      <div class="card"><h3>Open mat</h3><p>Slobodni sparing s ljudima iz drugih klubova.</p>
        <div class="row"><span>Cijena</span><b>besplatno</b></div>
        <div class="row"><span>Trajanje</span><b>${fmtTime(om.duration / state.speed)}</b></div>
        <div class="row"><span>Šansa za novi potez</span><b>10–20 %</b></div>
        <button data-activity="openMat" ${busy ? 'disabled' : ''}>Idi na open mat</button></div>
    </div>`;
}

function renderFights() {
  const st = promotionStatus(state);
  const promo = st.next
    ? `<div class="card"><h3>Promocija: ${BELT_NAMES[st.next]} pojas</h3>
        <ul class="req"><li class="${st.have.moves >= st.need.moves ? 'ok' : 'no'}">Naučeni potezi: ${st.have.moves} / ${st.need.moves}</li>
        <li class="${st.have.wins >= st.need.wins ? 'ok' : 'no'}">Pobjede: ${st.have.wins} / ${st.need.wins}</li></ul>
        <button data-promote ${st.ok ? '' : 'disabled'}>Promocija</button></div>`
    : '<div class="card"><h3>Crni pojas</h3><p>Najviši pojas. Svaka čast.</p></div>';
  $('tab-fights').innerHTML = `
    <p class="hint">Borba: ${ROUNDS} runde po ${ROUND_SECONDS / 60} min (sat ide ${CLOCK_SPEED}x brže) ili do submissiona. U kritičnim trenucima vrijeme se uspori i biraš jednu od 5 opcija (tipke 1–5).</p>
    <div class="cards">
      <div class="card"><h3>Sparing</h3><p>Borba s protivnikom tvog pojasa.</p>
        <div class="row"><span>Nagrada za pobjedu</span><b>${SPAR_REWARD} €</b></div>
        <button data-fight="spar">Kreni u sparing</button></div>
      <div class="card"><h3>Natjecanje</h3><p>Do 3 borbe: četvrtfinale, polufinale, finale.</p>
        <div class="row"><span>Kotizacija</span><b>${COMP_FEE} €</b></div>
        <div class="row"><span>Nagrade</span><b>🥇 ${COMP_PRIZES.gold} · 🥈 ${COMP_PRIZES.silver} · 🥉 ${COMP_PRIZES.bronze} €</b></div>
        <div class="row"><span>Šansa za novi potez</span><b>5 %</b></div>
        <button data-fight="comp" ${state.money < COMP_FEE ? 'disabled' : ''}>Prijavi se</button></div>
      ${promo}
      <div class="card"><h3>Karijera</h3>
        <div class="row"><span>Pobjede / porazi</span><b>${state.wins} / ${state.losses}</b></div>
        <div class="row"><span>Medalje</span><b>🥇 ${state.medals.gold} · 🥈 ${state.medals.silver} · 🥉 ${state.medals.bronze}</b></div></div>
    </div>`;
}

function renderTest() {
  $('tab-test').innerHTML = `
    <p class="hint">Testni panel: ubrzava vrijeme i otključava sve kako bi se igra mogla brzo isprobati.</p>
    <div class="test-row"><label for="speed">Ubrzanje vremena</label>
      <input type="range" id="speed" min="1" max="10" step="1" value="${state.speed}"><b id="speed-val">${state.speed}x</b></div>
    <div class="test-row"><label for="unlock">Sve otključano</label>
      <input type="checkbox" id="unlock" ${state.unlockAll ? 'checked' : ''}>
      <span class="hint" style="margin:0">Uključeno: svi potezi su barem na razini 1 i svi se mogu trenirati. Isključeno: prava pravila.</span></div>
    <div class="test-row"><label for="belt-select">Pojas</label>
      <select id="belt-select">${BELTS.map((b) => `<option value="${b}" ${b === state.belt ? 'selected' : ''}>${BELT_NAMES[b]}</option>`).join('')}</select></div>
    <div class="test-row"><label>Novac</label><button class="secondary" data-money>+500 €</button></div>
    <div class="test-row"><label>Nova igra</label><button class="ghost" data-reset>Obriši napredak</button></div>`;
}

function renderTab() {
  ({ club: renderClub, activities: renderActivities, fights: renderFights, test: renderTest })[activeTab]();
}

function renderAll() {
  renderHeader();
  renderStatus();
  renderTab();
}

// ---------- career events ----------
function handleEvents(events) {
  for (const e of events) {
    if (e.type === 'trained') toast(`Trening gotov: ${MOVE_BY_ID[e.moveId].name}, razina ${e.level}.`);
    if (e.type === 'activityDone') {
      const name = ACTIVITIES[e.activity].name;
      toast(e.learned ? `${name}: naučio si novi potez — ${MOVE_BY_ID[e.learned].name}!` : `${name} gotov. Ovaj put bez novog poteza.`);
    }
  }
  if (events.length) { renderAll(); save(); }
}

document.querySelector('.tabs').addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-tab]');
  if (!btn) return;
  activeTab = btn.dataset.tab;
  for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('active', b === btn);
  for (const t of ['club', 'activities', 'fights', 'test']) $(`tab-${t}`).hidden = t !== activeTab;
  renderTab();
});

$('career').addEventListener('click', (ev) => {
  const t = ev.target.closest('button');
  if (!t || t.disabled) return;
  handleEvents(advance(state, Date.now()));
  if (t.dataset.train) {
    const r = startTraining(state, t.dataset.train);
    if (!r.ok) toast(r.reason);
  } else if (t.dataset.activity) {
    const r = startActivity(state, t.dataset.activity, rng);
    if (!r.ok) toast(r.reason);
  } else if (t.dataset.fight) {
    startFightFlow(t.dataset.fight);
    return;
  } else if ('promote' in t.dataset) {
    if (promote(state)) toast(`Čestitamo! Dobio si ${BELT_NAMES[state.belt].toLowerCase()} pojas.`);
  } else if ('money' in t.dataset) {
    state.money += 500;
  } else if ('reset' in t.dataset) {
    if (!confirm('Obrisati sav napredak?')) return;
    state = createState({ test: true, now: Date.now() });
  } else return;
  save();
  renderAll();
});

$('career').addEventListener('input', (ev) => {
  if (ev.target.id === 'speed') {
    handleEvents(setSpeed(state, Number(ev.target.value), Date.now()));
    $('speed-val').textContent = `${state.speed}x`;
    save();
    renderHeader();
    renderStatus();
  }
});

$('career').addEventListener('change', (ev) => {
  if (ev.target.id === 'unlock') state.unlockAll = ev.target.checked;
  else if (ev.target.id === 'belt-select') state.belt = ev.target.value;
  else return;
  save();
  renderAll();
});

// ---------- fights ----------
function startFightFlow(mode) {
  if (mode === 'comp') {
    if (state.money < COMP_FEE) { toast(`Kotizacija je ${COMP_FEE} €.`); return; }
    state.money -= COMP_FEE;
    save();
  }
  openFight(mode, 0);
}

function openFight(mode, stage) {
  const fight = createFight(fighterFromState(state), makeOpponent(state.belt, rng), rng);
  fightCtx = { fight, mode, stage, timer: null, feedbackUntil: 0, logLen: -1, critSeq: -1, done: false };
  $('career').hidden = true;
  $('fight').hidden = false;
  $('result').hidden = true;
  $('critical').hidden = true;
  $('feedback').hidden = true;
  $('sb-p-name').textContent = `Ti · ${BELT_NAMES[state.belt]}`;
  $('sb-o-name').textContent = `${fight.opponent.name} · ${BELT_NAMES[fight.opponent.belt]}`;
  if (!renderer) renderer = createRenderer($('canvas'));
  renderer.resize();
  window.scrollTo(0, 0);
}

function closeFight() {
  fightCtx = null;
  $('fight').hidden = true;
  $('career').hidden = false;
  renderAll();
}

function renderScore(f) {
  const s = (x) => `<b>${x.pts}</b>A ${x.adv} · K ${x.pen}`;
  $('sb-p').innerHTML = s(f.score.p);
  $('sb-o').innerHTML = s(f.score.o);
  const left = Math.max(0, ROUND_SECONDS - f.clock);
  $('sb-round').textContent = `Runda ${f.round}/${ROUNDS}${fightCtx.mode === 'comp' ? ` · ${COMP_STAGES[fightCtx.stage]}` : ''}`;
  $('sb-clock').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  const top = f.playerTop === null ? '' : f.playerTop ? ' · ti si gore' : ' · ti si dolje';
  $('pos-label').textContent = `${POSITIONS[f.pos].name}${top}`;
}

function renderLog(f) {
  if (fightCtx.logLen === f.log.length) return;
  fightCtx.logLen = f.log.length;
  $('log').innerHTML = f.log.slice(-5).map((l) => `<li class="${l.who ?? ''}">${esc(l.text)}</li>`).join('');
}

function renderCritical(f) {
  const c = f.critical;
  if (!c) { $('critical').hidden = true; return; }
  if (fightCtx.critSeq !== f.criticalCount) {
    fightCtx.critSeq = f.criticalCount;
    $('critical-text').textContent = c.text;
    $('critical-options').innerHTML = c.options
      .map((o, i) => `<button data-opt="${i}"><span class="k">${i + 1}</span> ${esc(o.label)}</button>`).join('');
    $('critical').hidden = false;
  }
  const left = fightCtx.timer?.seq === f.criticalCount ? fightCtx.timer.left : c.timeLimit;
  $('critical-timer').style.width = `${Math.max(0, left / c.timeLimit) * 100}%`;
}

function choose(index) {
  const f = fightCtx?.fight;
  if (!f?.critical) return;
  const opt = index === null ? null : f.critical.options[index];
  chooseOption(f, index);
  const fb = $('feedback');
  if (!opt) { fb.textContent = 'Prekasno!'; fb.className = 'feedback bad'; }
  else if (opt.correct) { fb.textContent = `✔ Dobar izbor: ${MOVE_BY_ID[opt.moveId].name}`; fb.className = 'feedback good'; }
  else { fb.textContent = '✘ Greška!'; fb.className = 'feedback bad'; }
  fb.hidden = false;
  fightCtx.feedbackUntil = performance.now() + 1600;
  $('critical').hidden = true;
}

$('critical-options').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-opt]');
  if (b) choose(Number(b.dataset.opt));
});

document.addEventListener('keydown', (ev) => {
  if (!fightCtx?.fight.critical) return;
  const n = Number(ev.key);
  if (n >= 1 && n <= 5) choose(n - 1);
});

$('give-up').addEventListener('click', () => {
  const f = fightCtx?.fight;
  if (!f || f.ended) return;
  if (!confirm('Odustati od borbe? Računa se kao poraz.')) return;
  f.critical = null;
  f.ended = { winner: 'o', method: 'sub', detail: 'predaja' };
});

function finishFight(f) {
  fightCtx.done = true;
  const won = f.ended.winner === 'p';
  if (won) state.wins += 1; else state.losses += 1;
  const lines = [];
  let next = null;
  if (fightCtx.mode === 'spar') {
    if (won) { state.money += SPAR_REWARD; lines.push(`+${SPAR_REWARD} €`); }
  } else {
    const stage = fightCtx.stage;
    let medal = null;
    if (won && stage < 2) next = stage + 1;
    else if (won) medal = 'gold';
    else if (stage === 2) medal = 'silver';
    else if (stage === 1) medal = 'bronze';
    if (next === null) {
      if (medal) {
        state.medals[medal] += 1;
        state.money += COMP_PRIZES[medal];
        lines.push(`${{ gold: '🥇 Zlato', silver: '🥈 Srebro', bronze: '🥉 Bronca' }[medal]}: +${COMP_PRIZES[medal]} €`);
      } else lines.push('Ispao si u četvrtfinalu.');
      const learned = rollCompetitionLearn(state, rng);
      if (learned) lines.push(`Na natjecanju si pokupio novi potez: ${MOVE_BY_ID[learned].name}!`);
    }
  }
  save();
  const how = f.ended.method === 'sub' ? `submission (${f.ended.detail})` : f.ended.detail;
  const score = `${f.score.p.pts} : ${f.score.o.pts}`;
  $('result').innerHTML = `<h2>${won ? 'Pobjeda!' : 'Poraz'}</h2>
    <p>${esc(how)} · bodovi ${score}</p>
    ${lines.map((l) => `<p>${esc(l)}</p>`).join('')}
    <button id="result-next">${next !== null ? `Dalje: ${COMP_STAGES[next]}` : 'Natrag u klub'}</button>`;
  $('result').hidden = false;
  $('critical').hidden = true;
  $('result-next').addEventListener('click', () => (next !== null ? openFight('comp', next) : closeFight()));
}

// ---------- main loop ----------
let lastFrame = performance.now();
let lastUi = 0;
let lastSave = 0;

function frame(now) {
  const dtReal = Math.min(0.1, (now - lastFrame) / 1000); // a hidden tab must not skip half a round
  lastFrame = now;
  handleEvents(advance(state, Date.now(), rng));

  if (fightCtx) {
    const f = fightCtx.fight;
    if (!f.ended) {
      if (f.critical) {
        const tick = tickCriticalTimer(fightCtx.timer, f.critical, f.criticalCount, dtReal);
        fightCtx.timer = tick.timer;
        if (tick.expired) choose(null);
      } else {
        stepFight(f, dtReal * CLOCK_SPEED * state.speed);
      }
    }
    renderer.draw(f, dtReal, { slowmo: !!f.critical });
    renderScore(f);
    renderLog(f);
    renderCritical(f);
    if (fightCtx.feedbackUntil && now > fightCtx.feedbackUntil) { $('feedback').hidden = true; fightCtx.feedbackUntil = 0; }
    if (f.ended && !fightCtx.done) finishFight(f);
  }

  if (now - lastUi > 250) {
    lastUi = now;
    renderStatus();
  }
  if (now - lastSave > 2000) { lastSave = now; save(); }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);
window.addEventListener('resize', () => renderer?.resize());

renderAll();
requestAnimationFrame(frame);
