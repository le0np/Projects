/** Logical actions. Gameplay code only ever asks about actions, never raw keys, so rebinding is a config change. */
export type Action =
  | 'moveForward' | 'moveBack' | 'moveLeft' | 'moveRight'
  | 'sprint' | 'walk' | 'jump'
  | 'toggleHelp' | 'toggleDebug' | 'pause';

export const defaultBindings: Record<Action, string[]> = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBack: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  walk: ['ControlLeft', 'KeyC'],
  jump: ['Space'],
  toggleHelp: ['F1', 'KeyH'],
  toggleDebug: ['F3'],
  pause: ['Escape'],
};
