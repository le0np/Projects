// UI: screens, game loop, saving. All rules live in src/engine; this file only wires them to the DOM.
import { BELTS, BELT_NAMES, CATEGORIES, MOVES, MOVE_BY_ID } from '../data/moves.js';
import { POSITIONS, ACTION_BY_ID } from '../data/positions.js';
import {
  createState, learnTime, effectiveLevel, canTrain, startTraining, startActivity, advance, setSpeed,
  rollCompetitionLearn, recordFight, instantLevelUp, promotionStatus, promote, serialize, deserialize, competitionReady, ACTIVITIES, MAX_LEVEL,
  PHYSICAL, startWorkout, workoutTime, instantPhysicalUp, busyWith, slotProgress, slotRealLeft, finishActivityNow,
} from '../engine/progression.js';
import { createFight, stepFight, chooseOption, formatLog, logLine, fighterErrorChance, pct, ROUND_SECONDS, ROUNDS, CLOCK_SPEED } from '../engine/fight.js';
import { makeSparPartner, makeFirstSparPartner, makeCompetitor, fighterFromState } from '../engine/opponent.js';
import { COACH, BASICS, INTRO, sparringReady, storyStep, finishIntro, skipStory } from '../engine/story.js';
import { createRenderer } from '../render/renderer2d.js';
import { createGymView } from '../render/gymTopDown.js';
import { gymScene } from './gymScene.js';
import { tickCriticalTimer } from './criticalTimer.js';
import { energySegments, createFxMemo, nextFxEvents } from './fightFx.js';

const SAVE_KEY = 'bjj-fighter-save-v1';
const SPAR_REWARD = 10;
const COMP_FEE = 20;
const COMP_STAGES = ['Quarterfinal', 'Semifinal', 'Final'];
const COMP_PRIZES = { gold: 100, silver: 40, bronze: 15 };
const CLASS_NAMES = { attack: 'Attack', defense: 'Defense', sweep: 'Sweep' };
const BELT_COLORS = { white: '#f2f2f2', blue: '#2457c5', purple: '#7a3fb8', brown: '#7a4a24', black: '#000' };

const $ = (id) => document.getElementById(id);
const rng = Math.random;

// ---------- state & saving ----------
let state = load();
let activeTab = 'club';
let fightCtx = null; // { fight, mode: 'spar'|'comp', stage, timer, feedbackUntil }
let renderer = null;
let renderer2d = null;
let renderer3d = null;
// 3D fighters are the default; the test panel can switch back to the 2D figures (a per-browser setting).
const VIEW_KEY = 'bjj-fighter-view';
let view3d = (() => { try { return localStorage.getItem(VIEW_KEY) !== '2d'; } catch { return true; } })();
// The 3D module and the model load in the background so the first fight does not wait for them.
const load3d = import('../render/renderer3d.js').then((m) => {
  if (!m.webglAvailable()) throw new Error('WebGL is not available');
  renderer3d = m.createRenderer3d($('canvas3d'), $('canvas3d-ui'));
  window.__renderer3d = renderer3d; // for the browser checks (frame rate, smoothness)
  return renderer3d.ready;
}).catch((err) => { console.warn('3D view off:', err); renderer3d = null; });
load3d.then(() => { if (activeTab === 'test' && !fightCtx) renderTab(); }); // the test panel says whether 3D works
const gymView = createGymView($('gym-canvas'));

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
  b.textContent = `${BELT_NAMES[state.belt]} belt`;
  $('money').textContent = `${state.money} €`;
  $('record').textContent = `${state.wins}W / ${state.losses}L`;
}

function slotHtml(title, what, slot) {
  const now = Date.now();
  const pct = slotProgress(state, slot, now) * 100;
  const speedNote = slot.clock !== 'real' && state.speed > 1 ? ` (speed ${state.speed}x)` : '';
  return `<div class="slot"><h3>${title}</h3><div class="what">${what}</div>
    <div class="bar"><div style="width:${pct.toFixed(1)}%"></div></div>
    <div class="eta">${fmtTime(slotRealLeft(state, slot, now))} left${speedNote}</div></div>`;
}

// One thing at a time, so there is one status card. Saves from before that rule may still show several.
function renderStatus() {
  const t = state.training;
  const a = state.activity;
  const w = state.workout;
  let html = '';
  if (t) html += slotHtml('Training', `${esc(MOVE_BY_ID[t.moveId].name)} → level ${t.toLevel}`, t);
  if (w) html += slotHtml('Conditioning', `${PHYSICAL[w.attr].place}: ${PHYSICAL[w.attr].name.toLowerCase()} → level ${w.toLevel}`, w);
  if (a) html += slotHtml('Activity', `${ACTIVITIES[a.type].name} (new move chance ${Math.round(a.chance * 100)}%)`, a);
  $('status').innerHTML = html || '<div class="slot"><h3>You are free</h3><div class="idle">Pick one thing: a move in the club, the gym, cardio, a seminar or an open mat. One at a time.</div></div>';
}

// ---------- story start: the coach ----------
let introPage = 0;
const firstSpar = () => state.story && !state.story.skipped && state.story.spars === 0;

function renderIntro() {
  const show = !!state.story && !state.story.intro;
  $('story-intro').hidden = !show;
  if (!show) return;
  const page = INTRO[Math.min(introPage, INTRO.length - 1)];
  $('story-step').textContent = `${Math.min(introPage, INTRO.length - 1) + 1} / ${INTRO.length}`;
  $('story-title').textContent = page.title;
  $('story-text').textContent = page.text;
  $('story-next').textContent = introPage >= INTRO.length - 1 ? 'On the mat' : 'Next';
}

function coachActions(step) {
  if (step.id === 'basics') {
    const check = canTrain(state, step.move);
    return `<button data-train="${step.move}" ${check.ok ? '' : `disabled title="${esc(check.reason)}"`}>Train ${esc(MOVE_BY_ID[step.move].name)}</button>`;
  }
  if (step.id === 'spar') return '<button data-fight="spar">Start sparring</button>';
  if (step.id === 'activity') return '<button data-go-tab="activities">Activities</button>';
  if (step.id === 'comp' || step.id === 'belt') return '<button data-go-tab="fights">Fights</button>';
  return '';
}

function renderCoach() {
  const el = $('coach');
  const step = state.story?.intro ? storyStep(state) : null;
  el.hidden = !step;
  if (!step) return;
  const bar = step.total ? `<div class="bar"><div style="width:${((step.done / step.total) * 100).toFixed(1)}%"></div></div>` : '';
  el.innerHTML = `<div class="avatar" aria-hidden="true">🥋</div><div class="body">
    <div class="who">${COACH}</div><div class="title">${esc(step.title)}</div>
    <p class="line">“${esc(step.line)}”</p>${bar}
    <div class="acts">${coachActions(step)}<button class="ghost" data-skip-story>Skip the guide</button></div></div>`;
}

$('story-next').addEventListener('click', () => {
  if (introPage < INTRO.length - 1) { introPage += 1; renderIntro(); return; }
  finishIntro(state); save(); renderAll();
});
$('story-skip').addEventListener('click', () => { finishIntro(state); save(); renderAll(); });

function basicsList() {
  return `<ul class="basics">${BASICS.map((id) => `<li class="${effectiveLevel(state, id) >= 1 ? 'ok' : ''}">${esc(MOVE_BY_ID[id].name)}</li>`).join('')}</ul>`;
}

// ---------- tabs ----------
function pips(level) {
  let html = '<span class="pips">';
  for (let i = 1; i <= MAX_LEVEL; i++) html += `<i class="${i <= level ? 'on' : ''}"></i>`;
  return `${html}</span>`;
}

function renderPhysical() {
  let html = '<h2>Conditioning</h2><p class="hint">Gym and cardio keep you busy just like technique training: one thing at a time. Strength adds 3% chance per level of difference to every attack and defense. Cardio: you tire more slowly and recover faster between rounds.</p><div class="physical">';
  const busyNow = busyWith(state);
  for (const [attr, def] of Object.entries(PHYSICAL)) {
    const lvl = state.physical[attr];
    const busy = state.workout?.attr === attr;
    const next = lvl < MAX_LEVEL ? workoutTime(attr, lvl + 1) / state.speed : null;
    html += `<div class="move${busy ? ' training' : ''}">
      <div><span class="name">${def.place} · ${def.name}</span>${pips(lvl)}</div>
      <div class="move-btns">${state.test && lvl < MAX_LEVEL ? `<button class="instant" data-instant-phys="${attr}" title="Test: +1 level now">⚡ +1</button>` : ''}<button data-workout="${attr}" ${busyNow || lvl >= MAX_LEVEL ? 'disabled' : ''}${busyNow ? ` title="${esc(busyNow.reason)}"` : ''}>Train</button></div>
      <div class="desc">${esc(def.desc)}</div>
      <div class="meta">${busy ? 'Training in progress' : next === null ? 'Highest level' : `Level ${lvl + 1}: ${fmtTime(next)}`}</div>
    </div>`;
  }
  return `${html}</div>`;
}

function renderClub() {
  let html = renderPhysical() + '<p class="hint">Each next level of a move takes twice as long. Higher belts learn faster. One thing at a time: a move, the gym, cardio or an activity.</p>';
  for (const [cat, title] of Object.entries(CATEGORIES)) {
    const moves = MOVES.filter((m) => m.category === cat);
    html += `<h2>${title}</h2><div class="moves">`;
    for (const m of moves) {
      const lvl = effectiveLevel(state, m.id);
      const check = canTrain(state, m.id);
      const training = state.training?.moveId === m.id;
      const next = lvl < MAX_LEVEL ? learnTime(m.id, lvl + 1, state.belt) / state.speed : null;
      const locked = !check.ok && lvl === 0 && !busyWith(state);
      html += `<div class="move${training ? ' training' : ''}${locked ? ' locked' : ''}">
        <div><span class="beltdot" style="background:${BELT_COLORS[m.belt]}" title="${BELT_NAMES[m.belt]} belt"></span><span class="name">${esc(m.name)}</span>${pips(lvl)}</div>
        <div class="move-btns">${state.test && lvl < MAX_LEVEL ? `<button class="instant" data-instant="${m.id}" title="Test: +1 level now">⚡ +1</button>` : ''}<button data-train="${m.id}" ${check.ok ? '' : `disabled title="${esc(check.reason)}"`}>${lvl === 0 ? 'Learn' : 'Train'}</button></div>
        <div class="desc">${esc(m.desc)}</div>
        <div class="meta">${training ? 'Training in progress' : next === null ? 'Highest level' : `${lvl === 0 ? 'Learning' : `Level ${lvl + 1}`}: ${fmtTime(next)}`}${locked ? ` · ${esc(check.reason)}` : ''}</div>
      </div>`;
    }
    html += '</div>';
  }
  $('tab-club').innerHTML = html;
}

function renderActivities() {
  const busy = busyWith(state);
  const busyAttr = busy ? ` title="${esc(busy.reason)}"` : '';
  const sem = ACTIVITIES.seminar, om = ACTIVITIES.openMat;
  $('tab-activities').innerHTML = `
    <p class="hint">Activities can teach you a random new move, even one from a higher belt. While you are at an activity you do not train in the club, and while you train you cannot go to an activity.</p>
    ${busy ? `<p class="hint"><b>${esc(busy.reason)}</b></p>` : ''}
    <div class="cards">
      <div class="card"><h3>Seminar</h3><p>A visiting instructor shows techniques.</p>
        <div class="row"><span>Price</span><b>${sem.cost} €</b></div>
        <div class="row"><span>Duration</span><b>${fmtTime(sem.realDuration)} of real time</b></div>
        <div class="row"><span>New move chance</span><b>90%</b></div>
        <button data-activity="seminar" ${busy || state.money < sem.cost ? 'disabled' : ''}${busyAttr}>Go to the seminar</button></div>
      <div class="card"><h3>Open mat</h3><p>Free rolling with people from other clubs.</p>
        <div class="row"><span>Price</span><b>free</b></div>
        <div class="row"><span>Duration</span><b>${fmtTime(om.duration / state.speed)}</b></div>
        <div class="row"><span>New move chance</span><b>10–20%</b></div>
        <button data-activity="openMat" ${busy ? 'disabled' : ''}${busyAttr}>Go to the open mat</button></div>
    </div>`;
}

function renderFights() {
  const st = promotionStatus(state);
  const ready = competitionReady(state);
  const basics = sparringReady(state);
  const promo = st.next
    ? `<div class="card"><h3>Promotion: ${BELT_NAMES[st.next]} belt</h3>
        <ul class="req"><li class="${st.have.moves >= st.need.moves ? 'ok' : 'no'}">Moves learned: ${st.have.moves} / ${st.need.moves}</li>
        <li class="${st.have.wins >= st.need.wins ? 'ok' : 'no'}">Competition wins: ${st.have.wins} / ${st.need.wins}</li></ul>
        <button data-promote ${st.ok ? '' : 'disabled'}>Promote</button></div>`
    : '<div class="card"><h3>Black belt</h3><p>The highest belt. Respect.</p></div>';
  $('tab-fights').innerHTML = `
    <p class="hint">Fight: ${ROUNDS} rounds of ${ROUND_SECONDS / 60} min (the clock runs ${CLOCK_SPEED}x faster) or until a submission. In critical moments time slows down and you pick one of up to 5 options (keys 1–5).</p>
    <div class="cards">
      <div class="card"><h3>Sparring</h3><p>Roll with a training partner from your gym, white to blue belt. Does not count toward promotion.</p>
        <div class="row"><span>Prize for a win</span><b>${SPAR_REWARD} €</b></div>
        ${basics.ok ? (firstSpar() ? '<p>First sparring: the coach gives you an easier partner and shouts advice at every decision.</p>' : '')
    : `<p>${COACH} will not let you spar until you learn the basics (${basics.have}/${basics.need}):</p>${basicsList()}`}
        <button data-fight="spar" ${basics.ok ? '' : 'disabled title="Learn the basics first."'}>Start sparring</button></div>
      <div class="card"><h3>Competition</h3><p>Up to 3 fights: quarterfinal, semifinal, final.</p>
        <div class="row"><span>Entry fee</span><b>${COMP_FEE} €</b></div>
        <div class="row"><span>Prizes</span><b>🥇 ${COMP_PRIZES.gold} · 🥈 ${COMP_PRIZES.silver} · 🥉 ${COMP_PRIZES.bronze} €</b></div>
        <div class="row"><span>New move chance</span><b>5%</b></div>
        ${ready.ok ? '' : `<p>Before a competition you need at least one attack, one defense and one control move. Missing: <b>${ready.missing.join(', ')}</b>.</p>`}
        <button data-fight="comp" ${state.money < COMP_FEE || !ready.ok ? 'disabled' : ''}>Sign up</button></div>
      ${promo}
      <div class="card"><h3>Career</h3>
        <div class="row"><span>Wins / losses</span><b>${state.wins} / ${state.losses}</b></div>
        <div class="row"><span>Competition wins</span><b>${state.compWins}</b></div>
        <div class="row"><span>Medals</span><b>🥇 ${state.medals.gold} · 🥈 ${state.medals.silver} · 🥉 ${state.medals.bronze}</b></div></div>
    </div>`;
}

function renderTest() {
  $('tab-test').innerHTML = `
    <p class="hint">Test panel: speeds up time and unlocks everything so the game can be tried quickly.</p>
    <div class="test-row"><label for="speed">Time speed</label>
      <input type="range" id="speed" min="1" max="10" step="1" value="${state.speed}"><b id="speed-val">${state.speed}x</b></div>
    <div class="test-row"><label for="unlock">Unlock everything</label>
      <input type="checkbox" id="unlock" ${state.unlockAll ? 'checked' : ''}>
      <span class="hint" style="margin:0">On: every move is at least level 1 and every move can be trained. Off: the real rules.</span></div>
    <div class="test-row"><label for="belt-select">Belt</label>
      <select id="belt-select">${BELTS.map((b) => `<option value="${b}" ${b === state.belt ? 'selected' : ''}>${BELT_NAMES[b]}</option>`).join('')}</select></div>
    <div class="test-row"><label>Activity</label><button class="secondary" data-finish-activity ${state.activity ? '' : 'disabled'}>⚡ Finish now</button>
      <span class="hint" style="margin:0">A seminar lasts one hour of real time and the speed setting does not affect it.</span></div>
    <div class="test-row"><label>Money</label><button class="secondary" data-money>+500 €</button></div>
    <div class="test-row"><label for="view3d-toggle">3D fighters</label>
      <input type="checkbox" id="view3d-toggle" ${view3d ? 'checked' : ''}>
      <span class="hint" style="margin:0">${renderer3d ? `On: the 3D model. Off: the 2D figures.${renderer3d.stats().fps ? ` Last 3D fight: ${renderer3d.stats().fps} fps (${renderer3d.stats().quality} quality).` : ''}` : 'The 3D view is not available in this browser, so fights use the 2D figures.'}</span></div>
    <div class="test-row"><label>New game</label><button class="ghost" data-reset>Delete progress</button></div>`;
}

function renderTab() {
  ({ club: renderClub, activities: renderActivities, fights: renderFights, test: renderTest })[activeTab]();
}

function renderAll() {
  renderIntro();
  renderCoach();
  renderHeader();
  renderStatus();
  renderTab();
}

// ---------- career events ----------
function handleEvents(events) {
  for (const e of events) {
    if (e.type === 'trained') toast(`Training done: ${MOVE_BY_ID[e.moveId].name}, level ${e.level}.`);
    if (e.type === 'workout') toast(`${PHYSICAL[e.attr].place} done: ${PHYSICAL[e.attr].name.toLowerCase()} is now level ${e.level}.`);
    if (e.type === 'activityDone') {
      const name = ACTIVITIES[e.activity].name;
      toast(e.learned ? `${name}: you learned a new move, ${MOVE_BY_ID[e.learned].name}!` : `${name} is over. No new move this time.`);
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
  if (t.dataset.instantPhys) {
    const r = instantPhysicalUp(state, t.dataset.instantPhys);
    if (!r.ok) toast(r.reason);
  } else if (t.dataset.workout) {
    const r = startWorkout(state, t.dataset.workout);
    if (!r.ok) toast(r.reason);
  } else if (t.dataset.instant) {
    const r = instantLevelUp(state, t.dataset.instant);
    if (!r.ok) toast(r.reason);
  } else if (t.dataset.train) {
    const r = startTraining(state, t.dataset.train);
    if (!r.ok) toast(r.reason);
  } else if (t.dataset.activity) {
    const r = startActivity(state, t.dataset.activity, rng, Date.now());
    if (!r.ok) toast(r.reason);
  } else if ('finishActivity' in t.dataset) {
    const r = finishActivityNow(state, Date.now());
    if (!r.ok) toast(r.reason);
    else handleEvents(advance(state, Date.now()));
  } else if ('skipStory' in t.dataset) {
    skipStory(state);
    toast('The guide is off. Sparring still needs the basics.');
  } else if (t.dataset.goTab) {
    document.querySelector(`.tabs button[data-tab="${t.dataset.goTab}"]`).click();
    return;
  } else if (t.dataset.fight) {
    startFightFlow(t.dataset.fight);
    return;
  } else if ('promote' in t.dataset) {
    if (promote(state)) toast(`Congratulations! You got your ${BELT_NAMES[state.belt].toLowerCase()} belt.`);
  } else if ('money' in t.dataset) {
    state.money += 500;
  } else if ('reset' in t.dataset) {
    if (!confirm('Delete all progress?')) return;
    state = createState({ test: true, now: Date.now() });
    introPage = 0;
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
  if (ev.target.id === 'view3d-toggle') {
    view3d = ev.target.checked;
    try { localStorage.setItem(VIEW_KEY, view3d ? '3d' : '2d'); } catch { /* ignore */ }
    return;
  }
  if (ev.target.id === 'unlock') state.unlockAll = ev.target.checked;
  else if (ev.target.id === 'belt-select') state.belt = ev.target.value;
  else return;
  save();
  renderAll();
});

// ---------- fights ----------
function startFightFlow(mode) {
  if (mode === 'spar' && !sparringReady(state).ok) { toast('Learn the basics first: the coach won’t let you spar yet.'); return; }
  if (mode === 'comp') {
    const ready = competitionReady(state);
    if (!ready.ok) { toast(`For a competition you need at least one move from: ${ready.missing.join(', ')}.`); return; }
    if (state.money < COMP_FEE) { toast(`The entry fee is ${COMP_FEE} €.`); return; }
    state.money -= COMP_FEE;
    save();
  }
  openFight(mode, 0);
}

function openFight(mode, stage) {
  const me = fighterFromState(state);
  // Sparring: a random partner from the gym (white to blue belt). Competition: your belt, typical skill for it.
  // Your first sparring (story start): an easy partner and the coach shouts the best card at every decision.
  const coached = mode === 'spar' && firstSpar();
  const opponent = mode === 'spar' ? (coached ? makeFirstSparPartner(rng) : makeSparPartner(rng)) : makeCompetitor(state.belt, stage, rng);
  const fight = createFight(me, opponent, rng, { coach: coached });
  fightCtx = { fight, mode, stage, timer: null, feedbackUntil: 0, logLen: -1, critSeq: -1, done: false, fx: createFxMemo(fight) };
  $('fx').innerHTML = '';
  $('career').hidden = true;
  $('fight').hidden = false;
  $('result').hidden = true;
  $('critical').hidden = true;
  $('feedback').hidden = true;
  const stats = (x) => `mistakes ${pct(fighterErrorChance(x))} · strength ${x.strength ?? 1} · cardio ${x.cardio ?? 1}`;
  for (const [w, x, name, belt] of [['p', fight.player, 'You', state.belt], ['o', fight.opponent, fight.opponent.name, fight.opponent.belt]]) {
    $(`sb-${w}-name`).textContent = `${name} · ${BELT_NAMES[belt]}`;
    $(`sb-${w}-name`).title = `${name} · ${BELT_NAMES[belt]} belt`;
    $(`sb-${w}-stats`).textContent = stats(x);
    $(`sb-${w}-portrait`).style.borderColor = BELT_COLORS[belt];
    $(`sb-${w}-portrait`).dataset.belt = belt;
  }
  pickRenderer();
  window.scrollTo(0, 0);
}

// 3D when it is switched on and loaded, otherwise the 2D figures. Chosen once per fight.
function pickRenderer() {
  const use3d = view3d && renderer3d?.isReady();
  $('canvas').hidden = !!use3d;
  $('view3d').hidden = !use3d;
  if (use3d) {
    renderer = renderer3d;
    renderer.reset();
  } else {
    renderer2d ??= createRenderer($('canvas'));
    renderer = renderer2d;
  }
  renderer.resize();
}

function closeFight() {
  fightCtx = null;
  $('fight').hidden = true;
  $('career').hidden = false;
  gymView.resize();
  renderAll();
}

function renderScore(f) {
  const s = (x) => `<b>${x.pts}</b><span>A ${x.adv} · K ${x.pen}</span>`;
  $('sb-p').innerHTML = s(f.score.p);
  $('sb-o').innerHTML = s(f.score.o);
  for (const w of ['p', 'o']) {
    const bar = $(`sb-${w}-en`);
    const e = f.energy[w];
    const seg = energySegments(e);
    bar.className = seg.level;
    [...bar.children].forEach((el, i) => el.classList.toggle('on', i < seg.on));
    bar.parentElement.title = `Energy ${Math.round(e)} / 100`;
  }
  const left = Math.max(0, ROUND_SECONDS - f.clock);
  $('sb-round').textContent = `Round ${f.round}/${ROUNDS}${fightCtx.mode === 'comp' ? ` · ${COMP_STAGES[fightCtx.stage]}` : ''}`;
  $('sb-clock').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  const top = f.playerTop === null ? '' : f.playerTop ? ' · you on top' : ' · you on bottom';
  $('pos-label').textContent = `${POSITIONS[f.pos].name}${top}`;
}

function renderLog(f) {
  if (fightCtx.logLen === f.log.length) return;
  fightCtx.logLen = f.log.length;
  const box = $('log');
  const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
  box.innerHTML = f.log.map((l) => `<li class="${l.who ?? ''}">${esc(logLine(l))}</li>`).join('');
  if (atBottom) box.scrollTop = box.scrollHeight;
}

function renderCritical(f) {
  const c = f.critical;
  if (!c) { $('critical').hidden = true; return; }
  if (fightCtx.critSeq !== f.criticalCount) {
    fightCtx.critSeq = f.criticalCount;
    // From blue belt on: a gut feeling about the best card, not always right.
    const hint = c.hint?.coach ? `<span class="hint-line">🥋 Coach shouts from the edge: <b>${esc(c.options[c.hint.index].label)}!</b></span>`
      : c.hint ? `<span class="hint-line">💭 Your gut says: <b>${esc(c.options[c.hint.index].label)}</b> · reliability ${pct(c.hint.accuracy)}</span>` : '';
    $('critical-text').innerHTML = `${esc(c.text)}${hint}`;
    $('critical-options').innerHTML = c.options.map((o, i) => {
      const hinted = c.hint?.index === i;
      const dots = Array.from({ length: 10 }, (_, d) => `<i${d < o.level ? ' class="on"' : ''}></i>`).join('');
      return `<button data-opt="${i}" class="opt cls-${o.cls}${hinted ? ' hinted' : ''}">
        <span class="opt-head"><span>${CLASS_NAMES[o.cls] ?? o.cls}</span>${o.counter ? '<span class="hint-tag" title="Counter-attack: works with your level, but the timing makes it harder">↺ counter</span>' : ''}${hinted ? `<span class="hint-tag">${c.hint.coach ? '🥋 coach' : '💭 gut'}</span>` : ''}<span class="k">${i + 1}</span></span>
        <b class="opt-name">${esc(o.label)}</b>
        <span class="dots" title="Level ${o.level}">${dots}</span>
        <small>${esc(o.detail ?? '')}</small></button>`;
    }).join('');
    $('critical').hidden = false;
  }
  const left = fightCtx.timer?.seq === f.criticalCount ? fightCtx.timer.left : c.timeLimit;
  $('critical-timer').style.width = `${Math.max(0, left / c.timeLimit) * 100}%`;
  $('critical-timer').classList.toggle('low', left / c.timeLimit < 1 / 3);
}

function choose(index) {
  const f = fightCtx?.fight;
  if (!f?.critical) return;
  const opt = index === null ? null : f.critical.options[index];
  const limit = f.critical.timeLimit;
  const left = fightCtx.timer?.seq === f.criticalCount ? fightCtx.timer.left : limit;
  const fast = opt !== null && left > (limit * 2) / 3; // answered within the first third
  chooseOption(f, index, { fast });
  const r = f.lastResult;
  const fb = $('feedback');
  let ms = 1800;
  if (!opt) { fb.textContent = 'Too late!'; fb.className = 'feedback bad'; }
  else if (opt.counter) {
    // A counter-attack: a real try against the timing, not a wrong card.
    fb.textContent = r.success
      ? `↺ Counter! ${opt.label} caught him (level ${r.myLevel} vs ${r.theirLevel}, chance ${pct(r.chance)})`
      : `↺ The counter came too late: ${opt.label} (level ${r.myLevel} vs ${r.theirLevel}, chance ${pct(r.chance)})`;
    fb.className = r.success ? 'feedback good' : 'feedback mixed';
    if (!r.success) ms = 3000;
  }
  else if (!opt.correct) {
    fb.textContent = `✘ ${opt.label} doesn't help here.`;
    fb.className = 'feedback bad';
  }
  else if (r.success) { fb.textContent = `✔ ${opt.label} worked! (level ${r.myLevel} vs ${r.theirLevel}${fast ? ', quick decision +10%' : ''})`; fb.className = 'feedback good'; }
  else {
    fb.textContent = `✔ Good choice, but ${f.opponent.name} overpowered you: your level ${r.myLevel} vs his ${r.theirLevel} (chance ${pct(r.chance)}). Train ${opt.label}!`;
    fb.className = 'feedback mixed';
    ms = 3500;
  }
  fb.hidden = false;
  fightCtx.feedbackUntil = performance.now() + ms;
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

async function copyLog() {
  const f = fightCtx?.fight;
  if (!f) return;
  const text = formatLog(f);
  try {
    await navigator.clipboard.writeText(text);
    toast('Log copied. Paste it into the chat.');
  } catch {
    // Clipboard API blocked (e.g. plain http on a phone): select the text so it can be copied by hand.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.className = 'log-copy';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand && document.execCommand('copy');
    toast(ok ? 'Log copied. Paste it into the chat.' : 'Select the text and copy it by hand.');
    if (ok) ta.remove();
    else ta.addEventListener('blur', () => ta.remove());
  }
}

$('copy-log').addEventListener('click', copyLog);

$('give-up').addEventListener('click', () => {
  const f = fightCtx?.fight;
  if (!f || f.ended) return;
  if (!confirm('Give up the fight? It counts as a loss.')) return;
  f.critical = null;
  f.ended = { winner: 'o', method: 'sub', detail: 'gave up' };
});

function finishFight(f) {
  fightCtx.done = true;
  const won = f.ended.winner === 'p';
  recordFight(state, fightCtx.mode, won);
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
        lines.push(`${{ gold: '🥇 Gold', silver: '🥈 Silver', bronze: '🥉 Bronze' }[medal]}: +${COMP_PRIZES[medal]} €`);
      } else lines.push('You went out in the quarterfinal.');
      const learned = rollCompetitionLearn(state, rng);
      if (learned) lines.push(`You picked up a new move at the competition: ${MOVE_BY_ID[learned].name}!`);
    }
  }
  save();
  const how = f.ended.method === 'sub' ? `submission (${f.ended.detail})` : f.ended.detail;
  const score = `${f.score.p.pts} : ${f.score.o.pts}`;
  $('result').innerHTML = `<h2>${won ? 'Victory!' : 'Defeat'}</h2>
    <p>${esc(how)} · points ${score}</p>
    ${lines.map((l) => `<p>${esc(l)}</p>`).join('')}
    <button id="result-next">${next !== null ? `Next: ${COMP_STAGES[next]}` : 'Back to the club'}</button>`;
  $('result').hidden = false;
  $('critical').hidden = true;
  $('result-next').addEventListener('click', () => (next !== null ? openFight('comp', next) : closeFight()));
}

// ---------- fight effects (banners, score badges, shake) ----------
// Each effect removes itself when its CSS animation ends; the timeout covers animations that never run.
function addFx(el, ms) {
  const done = () => el.remove();
  el.addEventListener('animationend', done, { once: true });
  setTimeout(done, ms);
  $('fx').appendChild(el);
}

function showBanner({ who, text, shake }) {
  $('fx').querySelector('.fx-banner')?.remove();
  const el = document.createElement('div');
  el.className = `fx-banner ${who}`;
  el.innerHTML = `<span>${esc(text)}</span>`;
  addFx(el, 2000);
  if (shake) {
    const stage = document.querySelector('#fight .stage');
    stage.classList.remove('shake');
    void stage.offsetWidth; // restart the animation if it is still running
    stage.classList.add('shake');
    setTimeout(() => stage.classList.remove('shake'), 350);
  }
}

function showBadge({ who, pts }) {
  const el = document.createElement('div');
  el.className = `fx-badge ${who}`;
  el.textContent = `+${pts}`;
  addFx(el, 2200);
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
    renderer.draw(f, dtReal, { slowmo: !!f.critical, mode: fightCtx.mode });
    const fx = nextFxEvents(fightCtx.fx, f, ACTION_BY_ID);
    fightCtx.fx = fx.memo;
    for (const ev of fx.events) (ev.type === 'banner' ? showBanner : showBadge)(ev);
    renderScore(f);
    renderLog(f);
    renderCritical(f);
    if (fightCtx.feedbackUntil && now > fightCtx.feedbackUntil) { $('feedback').hidden = true; fightCtx.feedbackUntil = 0; }
    if (f.ended && !fightCtx.done) finishFight(f);
  }

  if (!fightCtx) gymView.draw(gymScene(state, Date.now()), dtReal);

  if (now - lastUi > 250) {
    lastUi = now;
    renderStatus();
  }
  if (now - lastSave > 2000) { lastSave = now; save(); }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);
window.addEventListener('resize', () => { renderer?.resize(); gymView.resize(); });

$('boot-hint').remove(); // the game loaded, so the 'how to start' hint is not needed
gymView.resize();
renderAll();
requestAnimationFrame(frame);
