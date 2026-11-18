// The start of the story: the coach welcomes you, teaches the basics and walks you to your first
// sparring, seminar, competition and belt. Pure logic, no DOM: the UI shows `storyStep` as the coach's panel.
import { MOVE_BY_ID } from '../data/moves.js';
import { effectiveLevel, promotionStatus } from './progression.js';

export const COACH = 'Trener Mirko';

// Sparring makes no sense without these: moving, a guard, keeping posture, an escape and one attack.
export const BASICS = ['shrimp', 'upa', 'closedGuard', 'guardPosture', 'elbowKnee', 'hipBump'];

const BASIC_TIPS = {
  shrimp: 'Prvo shrimp. Svaki bijeg počinje kukovima, bez njega si zaglavljen ispod svakoga.',
  upa: 'Sad bridge, upa. Kad te netko pritisne odozgo, most kukovima ti otvara izlaz.',
  closedGuard: 'Zatvoreni gard: noge oko protivnika i zaključaj. Tu ćeš provesti pola života.',
  guardPosture: 'Kad si ti u nečijem gardu: uspravna leđa, ruke na kukove. Postura te čuva od triangla i armbara.',
  elbowKnee: 'Elbow-knee bijeg. Kad te zajašu u mount, ovo te vraća u gard.',
  hipBump: 'Za kraj jedan napad: hip bump sweep iz zatvorenog garda. Sjedneš, kuk gore i on je dolje.',
};

export function sparringReady(state) {
  const missing = BASICS.filter((id) => effectiveLevel(state, id) < 1);
  return { ok: missing.length === 0, missing, have: BASICS.length - missing.length, need: BASICS.length };
}

export const INTRO = [
  { title: 'Prvi dan u klubu', text: 'Vrata dvorane škripe. Miris strunjača, zvuk tapkanja i netko u kutu viče „Još deset sekundi!”. Imaš novi rashguard u ruksaku, nešto ušteđevine i jedan cilj: jednog dana nositi crni pojas.' },
  { title: COACH, text: '„Ti si novi? Ja sam Mirko, vodim ovaj klub. Odmah da znaš: ovdje nitko ne dobije pojas na poklon. Ali tko dolazi i radi, napreduje. Pokazat ću ti osnove, a onda ćemo vidjeti od čega si.”' },
  { title: 'Plan', text: '„Prvi tjedan učiš šest osnova. Bez njih te na sparingu nema smisla puštati, svatko bi te zgnječio. Kad ih naučiš, ideš na prvi sparing, pa na seminar, pa na natjecanje. Idemo, na tatami.”' },
];

// The coach's current task for you, or null once the story start is finished or skipped.
// Each step: { id, title, line, done, total } (done/total for a progress count).
export function storyStep(state) {
  const st = state.story;
  if (!st || st.skipped) return null;
  const basics = sparringReady(state);
  if (!basics.ok) {
    const next = basics.missing[0];
    return { id: 'basics', title: `Prvi tjedan: osnove (${basics.have}/${basics.need})`, line: BASIC_TIPS[next], move: next, short: `Nauči: ${MOVE_BY_ID[next].name}`, done: basics.have, total: basics.need };
  }
  if (st.spars < 1) {
    return { id: 'spar', title: 'Prvi sparing', line: 'Znaš osnove. Idi na sparing u kartici Borbe. Dat ću ti lakšeg partnera i vikat ću ti s ruba što da radiš.', short: 'Prvi sparing!' };
  }
  if (st.activities < 1) {
    return { id: 'activity', title: 'Seminar ili open mat', line: 'Nije loše za prvi put. Sad idi na seminar ili open mat, tamo se nauče stvari koje ja ne pokazujem na treningu. Seminar traje sat vremena, za to vrijeme ne treniraš ovdje.', short: 'Idi na seminar' };
  }
  if (st.comps < 1) {
    return { id: 'comp', title: 'Prvo natjecanje', line: 'Vrijeme je za natjecanje. Treba ti barem po jedan potez iz napada, obrane i kontrole, i 20 € kotizacije. Nervoza je normalna.', short: 'Prijavi se na turnir' };
  }
  if (state.belt === 'white') {
    const p = promotionStatus(state);
    return { id: 'belt', title: 'Plavi pojas', line: `Sad znaš kako to ide. Za plavi pojas trebaš ${p.need.moves} poteza i ${p.need.wins} pobjeda na natjecanjima. Imaš ${p.have.moves} poteza i ${p.have.wins} pobjeda.`, short: 'Cilj: plavi pojas', done: Math.min(p.have.moves, p.need.moves) + Math.min(p.have.wins, p.need.wins), total: p.need.moves + p.need.wins };
  }
  return null;
}

export function finishIntro(state) { state.story.intro = true; }
export function skipStory(state) { state.story.intro = true; state.story.skipped = true; }
