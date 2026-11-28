import { progressionConfig } from '../config/skills';

export interface ProgressionState {
  level: number;
  xp: number;
  skillPoints: number;
}

/** Adds experience; every `xpPerPoint` earns a skill point and a character level. Returns points gained. */
export function gainXp(p: ProgressionState, xp: number): number {
  if (!(xp > 0)) return 0;
  const per = progressionConfig.xpPerPoint;
  const before = Math.floor(p.xp / per);
  p.xp += xp;
  const gained = Math.floor(p.xp / per) - before;
  p.skillPoints += gained;
  p.level += gained;
  return gained;
}

/** Progress towards the next skill point, 0..1. */
export function xpProgress(p: ProgressionState): number {
  const per = progressionConfig.xpPerPoint;
  return (p.xp % per) / per;
}
