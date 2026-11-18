// The start of the story: the coach welcomes you, teaches the basics and walks you to your first
// sparring, seminar, competition and belt. Pure logic, no DOM: the UI shows `storyStep` as the coach's panel.
import { MOVE_BY_ID } from '../data/moves.js';
import { effectiveLevel, promotionStatus } from './progression.js';

export const COACH = 'Coach Mirko';

// Sparring makes no sense without these: moving, a guard, keeping posture, an escape and one attack.
export const BASICS = ['shrimp', 'upa', 'closedGuard', 'guardPosture', 'elbowKnee', 'hipBump'];

const BASIC_TIPS = {
  shrimp: 'Shrimp first. Every escape starts with the hips; without it you are stuck under everyone.',
  upa: 'Now the bridge, the upa. When someone pins you from the top, bridging with your hips opens a way out.',
  closedGuard: 'Closed guard: legs around your opponent and lock them. You will spend half your life here.',
  guardPosture: 'When you are in someone’s guard: straight back, hands on the hips. Posture keeps you safe from triangles and armbars.',
  elbowKnee: 'The elbow-knee escape. When someone mounts you, this gets you back to guard.',
  hipBump: 'One attack to finish: the hip bump sweep from closed guard. Sit up, hip up, and he is on the bottom.',
};

export function sparringReady(state) {
  const missing = BASICS.filter((id) => effectiveLevel(state, id) < 1);
  return { ok: missing.length === 0, missing, have: BASICS.length - missing.length, need: BASICS.length };
}

export const INTRO = [
  { title: 'First day at the club', text: 'The gym door creaks. The smell of the mats, the sound of tapping, and someone in the corner shouting “Ten more seconds!”. You have a new rashguard in your bag, a little savings and one goal: to wear a black belt one day.' },
  { title: COACH, text: '“You’re new? I’m Mirko, I run this club. Know this from the start: nobody here gets a belt as a gift. But whoever shows up and works, gets better. I’ll show you the basics, and then we’ll see what you’re made of.”' },
  { title: 'The plan', text: '“Your first week you learn six basics. Without them there’s no point letting you spar, anyone would crush you. Once you know them, you go to your first sparring, then a seminar, then a competition. Let’s go, on the mat.”' },
];

// The coach's current task for you, or null once the story start is finished or skipped.
// Each step: { id, title, line, done, total } (done/total for a progress count).
export function storyStep(state) {
  const st = state.story;
  if (!st || st.skipped) return null;
  const basics = sparringReady(state);
  if (!basics.ok) {
    const next = basics.missing[0];
    return { id: 'basics', title: `First week: the basics (${basics.have}/${basics.need})`, line: BASIC_TIPS[next], move: next, short: `Learn: ${MOVE_BY_ID[next].name}`, done: basics.have, total: basics.need };
  }
  if (st.spars < 1) {
    return { id: 'spar', title: 'First sparring', line: 'You know the basics. Go spar in the Fights tab. I’ll give you an easier partner and shout from the edge what to do.', short: 'First sparring!' };
  }
  if (st.activities < 1) {
    return { id: 'activity', title: 'Seminar or open mat', line: 'Not bad for a first time. Now go to a seminar or an open mat, you learn things there that I don’t show in class. A seminar lasts an hour, and you don’t train here in the meantime.', short: 'Go to a seminar' };
  }
  if (st.comps < 1) {
    return { id: 'comp', title: 'First competition', line: 'Time for a competition. You need at least one attack, one defense and one control move, and a 20 € entry fee. Nerves are normal.', short: 'Sign up for a tournament' };
  }
  if (state.belt === 'white') {
    const p = promotionStatus(state);
    return { id: 'belt', title: 'Blue belt', line: `Now you know how it goes. For the blue belt you need ${p.need.moves} moves and ${p.need.wins} competition wins. You have ${p.have.moves} moves and ${p.have.wins} wins.`, short: 'Goal: blue belt', done: Math.min(p.have.moves, p.need.moves) + Math.min(p.have.wins, p.need.wins), total: p.need.moves + p.need.wins };
  }
  return null;
}

export function finishIntro(state) { state.story.intro = true; }
export function skipStory(state) { state.story.intro = true; state.story.skipped = true; }
