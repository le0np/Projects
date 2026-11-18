// What the bird's-eye gym view shows: where you are and what you are doing. Pure, no DOM, so it can be tested.
import { MOVE_BY_ID } from '../data/moves.js';
import { PHYSICAL, ACTIVITIES } from '../engine/progression.js';

const progress = (slot, gameTime) => Math.max(0, Math.min(1, (gameTime - slot.startedAt) / (slot.endsAt - slot.startedAt)));

// You can only stand in one place, so technique training wins over the gym corner.
// The other running timers are still listed in `side` so the view can show them as signs.
export function gymScene(state) {
  const t = state.training;
  const w = state.workout;
  const a = state.activity;
  const side = [];
  let you;
  if (t) {
    const move = MOVE_BY_ID[t.moveId];
    you = { spot: 'mat', label: `${move.name} → ${t.toLevel}`, progress: progress(t, state.gameTime), category: move.category };
  } else if (w) {
    you = { spot: w.attr === 'strength' ? 'weights' : 'cardio', label: `${PHYSICAL[w.attr].name} → ${w.toLevel}`, progress: progress(w, state.gameTime) };
  } else if (a) {
    you = { spot: 'away', label: ACTIVITIES[a.type].name, progress: progress(a, state.gameTime) };
  } else {
    you = { spot: 'bench', label: 'Odmor', progress: null };
  }
  if (w && you.spot === 'mat') side.push({ spot: w.attr === 'strength' ? 'weights' : 'cardio', label: `${PHYSICAL[w.attr].name} → ${w.toLevel}`, progress: progress(w, state.gameTime) });
  if (a && you.spot !== 'away') side.push({ spot: 'away', label: ACTIVITIES[a.type].name, progress: progress(a, state.gameTime) });
  return { you, side, belt: state.belt };
}
