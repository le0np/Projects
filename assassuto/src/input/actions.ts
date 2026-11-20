/** Logical actions. Gameplay code only ever asks about actions, never raw keys, so rebinding is a config change. */
export type Action =
  | 'moveForward' | 'moveBack' | 'moveLeft' | 'moveRight'
  | 'sprint' | 'walk' | 'jump'
  | 'attackLight' | 'attackHeavy' | 'block' | 'dodge' | 'lockOn' | 'finisher' | 'weapon1' | 'weapon2' | 'weapon3' | 'sheathe'
  | 'toggleHelp' | 'toggleDebug' | 'pause';

/** Mouse buttons use the codes Mouse0 (left), Mouse1 (middle), Mouse2 (right). */
export const defaultBindings: Record<Action, string[]> = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBack: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  walk: ['ControlLeft'],
  jump: ['Space'],
  attackLight: ['Mouse0', 'KeyJ'],
  attackHeavy: ['Mouse2', 'KeyK'],
  block: ['KeyQ', 'KeyL'],
  dodge: ['KeyC', 'AltLeft'],
  lockOn: ['Tab', 'Mouse1'],
  finisher: ['KeyF'],
  weapon1: ['Digit1'],
  weapon2: ['Digit2'],
  weapon3: ['Digit3'],
  sheathe: ['KeyX'],
  toggleHelp: ['F1', 'KeyH'],
  toggleDebug: ['F3'],
  pause: ['Escape'],
};
