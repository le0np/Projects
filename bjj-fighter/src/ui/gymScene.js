// What the bird's-eye gym view shows: where you are and what you are doing. Pure, no DOM, so it can be tested.
import { MOVE_BY_ID } from '../data/moves.js';
import { PHYSICAL, ACTIVITIES, slotProgress } from '../engine/progression.js';
import { storyStep } from '../engine/story.js';


// The player does one thing at a time. Saves from before that rule can still have several timers running:
// technique training wins over the gym corner and the others are listed in `side` as signs.
export function gymScene(state, realNow = state.lastReal) {
  const progress = (slot) => slotProgress(state, slot, realNow);
  const t = state.training;
  const w = state.workout;
  const a = state.activity;
  const side = [];
  let you;
  if (t) {
    const move = MOVE_BY_ID[t.moveId];
    you = { spot: 'mat', label: `${move.name} → ${t.toLevel}`, progress: progress(t), category: move.category };
  } else if (w) {
    you = { spot: w.attr === 'strength' ? 'weights' : 'cardio', label: `${PHYSICAL[w.attr].name} → ${w.toLevel}`, progress: progress(w) };
  } else if (a) {
    you = { spot: 'away', label: ACTIVITIES[a.type].name, progress: progress(a) };
  } else {
    you = { spot: 'bench', label: 'Resting', progress: null };
  }
  if (w && you.spot === 'mat') side.push({ spot: w.attr === 'strength' ? 'weights' : 'cardio', label: `${PHYSICAL[w.attr].name} → ${w.toLevel}`, progress: progress(w) });
  if (a && you.spot !== 'away') side.push({ spot: 'away', label: ACTIVITIES[a.type].name, progress: progress(a) });
  // The coach's short line from the story start (null once it is done or skipped).
  const coach = state.story?.intro ? storyStep(state)?.short ?? null : null;
  return { you, side, belt: state.belt, coach };
}
