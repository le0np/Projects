// Moves (techniques) and belts. `base` = seconds to learn level 1 as a white belt.

export const BELTS = ['white', 'blue', 'purple', 'brown', 'black'];
export const BELT_NAMES = { white: 'White', blue: 'Blue', purple: 'Purple', brown: 'Brown', black: 'Black' };

export const CATEGORIES = {
  movement: 'Movement and basics',
  takedown: 'Takedowns',
  guard: 'Guards',
  sweep: 'Sweeps',
  pass: 'Guard passes',
  top: 'Top positions',
  transition: 'Transitions',
  escape: 'Escapes',
  sub: 'Submissions',
  defense: 'Defenses',
};

const m = (id, name, category, belt, base, desc) => ({ id, name, category, belt, base, desc });

export const MOVES = [
  // Movement and basics
  m('shrimp', 'Shrimp', 'movement', 'white', 5, 'Hip escape, the base of every escape.'),
  m('upa', 'Bridge (upa)', 'movement', 'white', 5, 'Bridge with the hips to throw the opponent off.'),
  m('technicalStandUp', 'Technical stand-up', 'movement', 'white', 10, 'Getting up from the mat safely.'),
  m('sprawl', 'Sprawl', 'movement', 'white', 10, 'Takedown defense: legs back, hips down.'),
  m('guardPosture', 'Guard posture', 'movement', 'white', 10, 'Straight back, hands on the opponent’s hips.'),
  // Takedowns
  m('doubleLeg', 'Double leg', 'takedown', 'white', 20, 'Shoot in on both legs and take them down.'),
  m('singleLeg', 'Single leg', 'takedown', 'white', 20, 'Grab one leg and take them down.'),
  m('snapDown', 'Snap down', 'takedown', 'white', 25, 'Pull the head down into front control.'),
  m('guardPull', 'Guard pull', 'takedown', 'white', 10, 'Pull into guard (no points).'),
  // Guards
  m('closedGuard', 'Closed guard', 'guard', 'white', 10, 'Legs locked around the opponent.'),
  m('halfGuard', 'Half guard', 'guard', 'white', 15, 'One of the opponent’s legs trapped.'),
  m('butterflyGuard', 'Butterfly guard', 'guard', 'white', 20, 'Feet hooked under the opponent’s thighs.'),
  // Sweeps
  m('hipBump', 'Hip bump sweep', 'sweep', 'white', 20, 'Sit up, raise the hip and roll the opponent over.'),
  m('scissor', 'Scissor sweep', 'sweep', 'white', 25, 'Legs scissor the opponent down.'),
  m('flower', 'Flower sweep', 'sweep', 'white', 30, 'Leg pendulum from closed guard.'),
  m('butterflySweep', 'Butterfly sweep', 'sweep', 'white', 30, 'Lift the opponent with a hook and throw them over.'),
  m('underhookSweep', 'Underhook sweep', 'sweep', 'white', 35, 'Underhook from half guard and come up on top.'),
  // Passes
  m('openClosedGuard', 'Guard opening', 'pass', 'white', 15, 'Break open the opponent’s locked legs.'),
  m('kneeSlice', 'Knee slice', 'pass', 'white', 30, 'Slide the knee across the opponent’s thigh.'),
  m('toreando', 'Toreando', 'pass', 'white', 35, 'Push the legs aside and run around them.'),
  m('overUnder', 'Over-under', 'pass', 'white', 40, 'One arm over, one under the legs, heavy pressure.'),
  // Top positions
  m('sideControl', 'Side control', 'top', 'white', 15, 'Chest-to-chest control from the side.'),
  m('kneeOnBelly', 'Knee on belly', 'top', 'white', 20, 'Knee on the opponent’s belly.'),
  m('mount', 'Mount', 'top', 'white', 20, 'Sitting on top of the opponent.'),
  m('backControl', 'Back control', 'top', 'white', 30, 'Seatbelt grip and both hooks in.'),
  m('northSouth', 'North-south', 'top', 'white', 25, 'Head-to-belly control.'),
  // Transitions
  m('sideToMount', 'Side control → mount', 'transition', 'white', 25, 'Knee across the belly into mount.'),
  m('sideToKob', 'Side control → knee on belly', 'transition', 'white', 20, 'Rise up onto the knee.'),
  m('mountToBack', 'Mount → back', 'transition', 'white', 35, 'When the opponent turns, take the back.'),
  // Escapes
  m('mountUpa', 'Upa from mount', 'escape', 'white', 15, 'Trap an arm and a leg, bridge and roll.'),
  m('elbowKnee', 'Elbow-knee escape', 'escape', 'white', 25, 'Shrimp back into guard.'),
  m('sideShrimp', 'Shrimp from side control', 'escape', 'white', 20, 'Frame with the arms and shrimp into guard.'),
  m('sideUnderhook', 'Underhook to knees', 'escape', 'white', 30, 'Get the underhook and come up to the knees.'),
  m('backEscape', 'Back escape', 'escape', 'white', 35, 'Shoulder to the mat and turn into guard.'),
  m('kobEscape', 'Knee on belly escape', 'escape', 'white', 20, 'Push the knee away and shrimp.'),
  // Submissions
  m('rnc', 'Rear naked choke', 'sub', 'white', 30, 'Choke from the back.'),
  m('guillotine', 'Guillotine', 'sub', 'white', 30, 'Choke with the head under the armpit.'),
  m('triangle', 'Triangle', 'sub', 'white', 45, 'Leg choke from guard.'),
  m('armbar', 'Armbar', 'sub', 'white', 40, 'Elbow lock.'),
  m('kimura', 'Kimura', 'sub', 'white', 35, 'Shoulder lock, arm behind the back.'),
  m('americana', 'Americana', 'sub', 'white', 30, 'Shoulder lock, arm toward the head.'),
  m('straightAnkle', 'Straight ankle lock', 'sub', 'white', 40, 'Straight foot lock.'),
  // Defenses
  m('guillotineDefense', 'Guillotine defense', 'defense', 'white', 25, 'Arm over the shoulder, turn toward the open side.'),
  m('triangleDefense', 'Triangle defense', 'defense', 'white', 30, 'Posture up and pull the arm out.'),
  m('armbarDefense', 'Armbar defense', 'defense', 'white', 30, 'Clasp the hands, hitchhiker escape.'),
  m('rncDefense', 'RNC defense', 'defense', 'white', 25, 'Hand fight, chin down.'),
  m('shoulderLockDefense', 'Kimura/Americana defense', 'defense', 'white', 25, 'Arm tight to the body, grab your own shorts.'),
  m('legLockDefense', 'Leg lock defense', 'defense', 'white', 35, 'Roll with the lock and pull the heel out.'),
  // Higher belts
  m('darce', "D'arce choke", 'sub', 'blue', 120, 'Choke under the armpit from a front headlock.'),
  m('armTriangle', 'Arm triangle', 'sub', 'blue', 120, 'Choke with your head and the opponent’s arm.'),
  m('legDrag', 'Leg drag', 'pass', 'blue', 150, 'Drag the legs across your body and pass.'),
  m('kneebar', 'Kneebar', 'sub', 'purple', 240, 'Knee lock.'),
  m('toeHold', 'Toe hold', 'sub', 'purple', 240, 'Twisting foot lock.'),
  m('heelHook', 'Heel hook', 'sub', 'brown', 420, 'Heel twist, a dangerous knee lock.'),
  m('insideHeelHook', 'Inside heel hook', 'sub', 'black', 600, 'Inside heel hook from the saddle.'),
];

export const MOVE_BY_ID = Object.fromEntries(MOVES.map((mv) => [mv.id, mv]));

// Colour class of each move for quick recognition in critical moments.
// Three colours on the cards: attack (submissions, passes, takedowns, moving to a better spot on top),
// sweep, and defense (defenses, escapes, guards, basic movement).
export const CATEGORY_CLASS = {
  sub: 'attack', pass: 'attack', takedown: 'attack', top: 'attack', transition: 'attack',
  sweep: 'sweep',
  defense: 'defense', escape: 'defense', guard: 'defense', movement: 'defense',
};
export const MOVE_CLASS = Object.fromEntries(MOVES.map((mv) => [mv.id, CATEGORY_CLASS[mv.category]]));
