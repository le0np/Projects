// Position graph: who can do what from where, and the wrong choices offered in critical moments.
// Roles: 'top' / 'bottom' in ground positions, 'neutral' when standing.
// `to.actorTop`: the fighter who did the action ends on top (true) or bottom (false).

export const POSITIONS = {
  standing: { name: 'Standing' },
  closedGuard: { name: 'Closed guard' },
  halfGuard: { name: 'Half guard' },
  butterfly: { name: 'Butterfly guard' },
  sideControl: { name: 'Side control' },
  kneeOnBelly: { name: 'Knee on belly', scoring: 'kneeOnBelly' },
  mount: { name: 'Mount', scoring: 'mount' },
  back: { name: 'Back', scoring: 'back' },
  northSouth: { name: 'North-south' },
  turtle: { name: 'Turtle (front headlock)' },
};

const DEF_TAKEDOWN = ['td_standTall', 'td_turnAway', 'td_reachDown'];
const DEF_SWEEP = ['sw_handsOnMat', 'sw_armInside', 'sw_leanForward'];
const DEF_PASS = ['ps_flat', 'ps_turnAway', 'ps_pushStraight'];
const DEF_ADVANCE = ['mt_pushStraight', 'mt_turnBelly'];
const DEF_ESCAPE = ['es_highHips', 'es_relax', 'es_overreach'];

const a = (id, move, from, role, kind, to, defenses, mistakes) => ({ id, move, from, role, kind, to, defenses, mistakes });
const T = (pos, actorTop) => ({ pos, actorTop });

export const ACTIONS = [
  // Standing
  a('td_double', 'doubleLeg', 'standing', 'neutral', 'takedown', T('halfGuard', true), ['sprawl'], DEF_TAKEDOWN),
  a('td_single', 'singleLeg', 'standing', 'neutral', 'takedown', T('closedGuard', true), ['sprawl'], DEF_TAKEDOWN),
  a('snap', 'snapDown', 'standing', 'neutral', 'transition', T('turtle', true), ['technicalStandUp'], ['td_standTall', 'td_turnAway']),
  a('pull', 'guardPull', 'standing', 'neutral', 'pull', T('closedGuard', false), [], []),
  a('guill_st', 'guillotine', 'standing', 'neutral', 'sub', undefined, ['guillotineDefense'], ['gu_pullBack', 'gu_wrongSide']),
  // Closed guard
  a('hipBump', 'hipBump', 'closedGuard', 'bottom', 'sweep', T('mount', true), ['guardPosture'], DEF_SWEEP),
  a('scissor', 'scissor', 'closedGuard', 'bottom', 'sweep', T('mount', true), ['guardPosture'], DEF_SWEEP),
  a('flower', 'flower', 'closedGuard', 'bottom', 'sweep', T('mount', true), ['guardPosture'], DEF_SWEEP),
  a('triangle_cg', 'triangle', 'closedGuard', 'bottom', 'sub', undefined, ['triangleDefense', 'guardPosture'], ['tr_headDown', 'tr_armInside']),
  a('armbar_cg', 'armbar', 'closedGuard', 'bottom', 'sub', undefined, ['armbarDefense'], ['ab_pullStraight', 'ab_bridgeWrong']),
  a('kimura_cg', 'kimura', 'closedGuard', 'bottom', 'sub', undefined, ['shoulderLockDefense'], ['sh_straighten', 'sh_rollWrong']),
  a('guill_cg', 'guillotine', 'closedGuard', 'bottom', 'sub', undefined, ['guillotineDefense'], ['gu_pullBack', 'gu_wrongSide']),
  a('openGuard', 'openClosedGuard', 'closedGuard', 'top', 'transition', T('butterfly', true), ['closedGuard'], ['es_highHips', 'es_relax']),
  // Butterfly (open guard)
  a('bSweep', 'butterflySweep', 'butterfly', 'bottom', 'sweep', T('halfGuard', true), ['guardPosture'], DEF_SWEEP),
  a('recoverClosed', 'closedGuard', 'butterfly', 'bottom', 'transition', T('closedGuard', false), [], []),
  a('ankle_b', 'straightAnkle', 'butterfly', 'bottom', 'sub', undefined, ['legLockDefense'], ['ll_spinWrong', 'll_pullKnee']),
  a('heel_b', 'heelHook', 'butterfly', 'bottom', 'sub', undefined, ['legLockDefense'], ['ll_spinWrong', 'll_pullKnee', 'll_wait']),
  a('insideHeel_b', 'insideHeelHook', 'butterfly', 'bottom', 'sub', undefined, ['legLockDefense'], ['ll_spinWrong', 'll_pullKnee', 'll_wait']),
  a('guill_b', 'guillotine', 'butterfly', 'bottom', 'sub', undefined, ['guillotineDefense'], ['gu_pullBack', 'gu_wrongSide']),
  a('toreando', 'toreando', 'butterfly', 'top', 'pass', T('sideControl', true), ['shrimp', 'butterflyGuard'], DEF_PASS),
  a('kneeSlice_b', 'kneeSlice', 'butterfly', 'top', 'pass', T('sideControl', true), ['shrimp', 'halfGuard'], DEF_PASS),
  a('overUnder', 'overUnder', 'butterfly', 'top', 'pass', T('sideControl', true), ['shrimp'], DEF_PASS),
  a('legDrag', 'legDrag', 'butterfly', 'top', 'pass', T('sideControl', true), ['shrimp'], DEF_PASS),
  a('ankle_bt', 'straightAnkle', 'butterfly', 'top', 'sub', undefined, ['legLockDefense'], ['ll_spinWrong', 'll_pullKnee']),
  a('kneebar_bt', 'kneebar', 'butterfly', 'top', 'sub', undefined, ['legLockDefense'], ['ll_spinWrong', 'll_pullKnee']),
  a('toeHold_bt', 'toeHold', 'butterfly', 'top', 'sub', undefined, ['legLockDefense'], ['ll_spinWrong', 'll_wait']),
  // Half guard
  a('uhSweep', 'underhookSweep', 'halfGuard', 'bottom', 'sweep', T('halfGuard', true), ['halfGuard'], DEF_SWEEP),
  a('recoverHalf', 'shrimp', 'halfGuard', 'bottom', 'transition', T('closedGuard', false), [], []),
  a('kimura_hg', 'kimura', 'halfGuard', 'bottom', 'sub', undefined, ['shoulderLockDefense'], ['sh_straighten', 'sh_rollWrong']),
  a('kneeSlice_h', 'kneeSlice', 'halfGuard', 'top', 'pass', T('sideControl', true), ['halfGuard', 'shrimp'], DEF_PASS),
  a('darce_h', 'darce', 'halfGuard', 'top', 'sub', undefined, ['guillotineDefense'], ['gu_pullBack', 'gu_wrongSide']),
  // Side control
  a('sideToMount', 'sideToMount', 'sideControl', 'top', 'transition', T('mount', true), ['shrimp'], DEF_ADVANCE),
  a('sideToKob', 'sideToKob', 'sideControl', 'top', 'transition', T('kneeOnBelly', true), ['shrimp'], DEF_ADVANCE),
  a('toNS', 'northSouth', 'sideControl', 'top', 'transition', T('northSouth', true), [], []),
  a('americana_s', 'americana', 'sideControl', 'top', 'sub', undefined, ['shoulderLockDefense'], ['sh_straighten', 'sh_rollWrong']),
  a('kimura_s', 'kimura', 'sideControl', 'top', 'sub', undefined, ['shoulderLockDefense'], ['sh_straighten', 'sh_rollWrong']),
  a('armTriangle_s', 'armTriangle', 'sideControl', 'top', 'sub', undefined, ['shrimp'], ['at_armAcross', 'at_flat']),
  a('sideShrimp_e', 'sideShrimp', 'sideControl', 'bottom', 'escape', T('closedGuard', false), ['sideControl'], DEF_ESCAPE),
  a('sideUnderhook_e', 'sideUnderhook', 'sideControl', 'bottom', 'escape', T('standing', false), ['sideControl'], DEF_ESCAPE),
  // Knee on belly
  a('kobToMount', 'mount', 'kneeOnBelly', 'top', 'transition', T('mount', true), ['kobEscape'], DEF_ADVANCE),
  a('armbar_k', 'armbar', 'kneeOnBelly', 'top', 'sub', undefined, ['armbarDefense'], ['ab_pullStraight', 'ab_bridgeWrong']),
  a('kobEscape_e', 'kobEscape', 'kneeOnBelly', 'bottom', 'escape', T('halfGuard', false), ['kneeOnBelly'], DEF_ESCAPE),
  // Mount
  a('armbar_m', 'armbar', 'mount', 'top', 'sub', undefined, ['armbarDefense'], ['ab_pullStraight', 'ab_bridgeWrong']),
  a('americana_m', 'americana', 'mount', 'top', 'sub', undefined, ['shoulderLockDefense'], ['sh_straighten', 'sh_rollWrong']),
  a('armTriangle_m', 'armTriangle', 'mount', 'top', 'sub', undefined, ['elbowKnee'], ['at_armAcross', 'at_flat']),
  a('mountToBack', 'mountToBack', 'mount', 'top', 'transition', T('back', true), ['elbowKnee'], ['bk_handsForward', 'mt_turnBelly']),
  a('mountUpa_e', 'mountUpa', 'mount', 'bottom', 'escape', T('closedGuard', true), ['mount'], DEF_ESCAPE),
  a('elbowKnee_e', 'elbowKnee', 'mount', 'bottom', 'escape', T('closedGuard', false), ['mount'], DEF_ESCAPE),
  // Back
  a('rnc_b', 'rnc', 'back', 'top', 'sub', undefined, ['rncDefense'], ['rnc_pushElbow', 'rnc_wait']),
  a('backEscape_e', 'backEscape', 'back', 'bottom', 'escape', T('closedGuard', true), ['backControl'], DEF_ESCAPE),
  // North-south
  a('kimura_ns', 'kimura', 'northSouth', 'top', 'sub', undefined, ['shoulderLockDefense'], ['sh_straighten', 'sh_rollWrong']),
  a('nsToSide', 'sideControl', 'northSouth', 'top', 'transition', T('sideControl', true), [], []),
  a('nsEscape', 'shrimp', 'northSouth', 'bottom', 'escape', T('halfGuard', false), ['northSouth'], DEF_ESCAPE),
  // Turtle (front headlock)
  a('guill_t', 'guillotine', 'turtle', 'top', 'sub', undefined, ['guillotineDefense'], ['gu_pullBack', 'gu_wrongSide']),
  a('darce_t', 'darce', 'turtle', 'top', 'sub', undefined, ['guillotineDefense'], ['gu_pullBack', 'gu_wrongSide']),
  a('turtleBack', 'backControl', 'turtle', 'top', 'transition', T('back', true), ['technicalStandUp'], ['bk_handsForward', 'td_standTall']),
  a('standUp_t', 'technicalStandUp', 'turtle', 'bottom', 'escape', T('standing', false), ['snapDown'], DEF_ESCAPE),
];

export const ACTION_BY_ID = Object.fromEntries(ACTIONS.map((x) => [x.id, x]));

export function actionsFor(pos, role) {
  return ACTIONS.filter((x) => x.from === pos && x.role === role);
}

// effect: 'threat' = the opponent's attack goes through; 'tap' = you are submitted;
// 'pos' = you end up in `to` (selfTop = you on top), scored for the opponent as `kind`;
// 'counter' = the opponent immediately attacks with `counterAction`; 'penalty' = referee penalty.
const threat = (text) => ({ text, effect: 'threat' });
const counter = (text, counterAction) => ({ text, effect: 'counter', counterAction });
const pos = (text, p, selfTop, kind) => ({ text, effect: 'pos', to: { pos: p, selfTop }, kind });
const penalty = (text) => ({ text, effect: 'penalty' });

export const MISTAKES = {
  // takedown defense
  td_standTall: threat('You stand tall and wait for him to grab you.'),
  td_turnAway: pos('You turn your back and try to run.', 'back', false, 'transition'),
  td_reachDown: counter('You drop your head and reach for his leg.', 'guill_st'),
  // sweep defense (you are on top in the guard)
  sw_handsOnMat: threat('You post your hands on the mat far from your body.'),
  sw_armInside: counter('You push one arm between his legs.', 'triangle_cg'),
  sw_leanForward: threat('You lean forward with no base.'),
  // pass defense (you are on the bottom)
  ps_flat: threat('You stay flat on your back.'),
  ps_turnAway: pos('You turn away from him.', 'back', false, 'transition'),
  ps_pushStraight: threat('You push him with straight arms.'),
  // defending an advance (mount, knee on belly, back)
  mt_pushStraight: threat('You push his chest with straight arms.'),
  mt_turnBelly: pos('You turn onto your belly.', 'back', false, 'transition'),
  bk_handsForward: threat('You leave your arms out front and let him get behind you.'),
  // you are on top, he escapes
  es_highHips: threat('You lift your hips too high.'),
  es_relax: threat('You ease off the pressure to rest.'),
  es_overreach: threat('You reach too deep for a submission.'),
  // submissions
  gu_pullBack: threat('You pull your head straight back.'),
  gu_wrongSide: threat('You turn toward his choking arm.'),
  tr_headDown: threat('You drop your head and drive forward.'),
  tr_armInside: threat('You leave your arm inside and wait.'),
  ab_pullStraight: threat('You pull your straight arm back toward you.'),
  ab_bridgeWrong: threat('You bridge toward his legs.'),
  sh_straighten: threat('You straighten your arm to get free.'),
  sh_rollWrong: threat('You roll away from the lock.'),
  at_armAcross: threat('You leave your arm across your face.'),
  at_flat: threat('You stay flat and push his head.'),
  ll_spinWrong: threat('You spin the wrong way out of the lock.'),
  ll_pullKnee: threat('You pull your knee while he has your heel.'),
  ll_wait: threat('You wait for him to let go.'),
  rnc_pushElbow: threat('You push his elbow away.'),
  rnc_wait: threat('You wait for him to run out of strength.'),
  // general mistakes
  g_freeze: threat('You freeze and wait.'),
  g_explode: threat('You explode with no plan and burn your energy.'),
  g_grabShorts: penalty('You grab his shorts (illegal).'),
  stall: penalty('You just hold him and do nothing (stalling).'),
  // your opportunities: wrong moves
  op_st_reachLow: counter('You rush in with your head in front of your legs.', 'guill_st'),
  op_st_cross: pos('You cross your feet while moving.', 'halfGuard', false, 'takedown'),
  op_cg_open: pos('You open your legs with no plan.', 'butterfly', false, 'transition'),
  op_cgt_armIn: counter('One arm in, one arm out.', 'triangle_cg'),
  op_cgt_lean: counter('You sink forward and break your own posture.', 'guill_cg'),
  op_bb_flat: pos('You lie flat on your back.', 'sideControl', false, 'pass'),
  op_bt_kneel: counter('You kneel between his legs.', 'bSweep'),
  op_bt_legIn: counter('You leave your leg deep between his.', 'heel_b'),
  op_hb_flat: counter('You stay flat with no underhook.', 'kneeSlice_h'),
  op_ht_handMat: counter('You leave your hand on the mat next to him.', 'kimura_hg'),
  op_ht_highHips: counter('You lift your hips with no pressure.', 'uhSweep'),
  op_sc_highHips: counter('You lift your hips and ease the pressure.', 'sideShrimp_e'),
  op_sc_reachFar: counter('You reach over his head for the arm.', 'sideUnderhook_e'),
  op_sb_push: counter('You push him with straight arms.', 'americana_s'),
  op_sb_turnAway: pos('You turn your back to him.', 'back', false, 'transition'),
  op_kt_overcommit: counter('You throw all your weight forward.', 'kobEscape_e'),
  op_kb_pushStraight: counter('You push his knee with straight arms.', 'armbar_k'),
  op_kb_turn: pos('You turn onto your belly.', 'back', false, 'transition'),
  op_mt_handsMat: counter('You post your hands on the mat beside his head.', 'mountUpa_e'),
  op_mt_lowKnees: counter('You widen your knees and sit low.', 'elbowKnee_e'),
  op_mb_push: counter('You push him with straight arms.', 'armbar_m'),
  op_mb_turn: pos('You turn onto your belly.', 'back', false, 'transition'),
  op_bkt_cross: counter('You cross your feet in front of him.', 'backEscape_e'),
  op_bkt_noHooks: counter('You drop your hooks and hold on with your arms only.', 'backEscape_e'),
  op_bkb_handsDown: counter('You drop your hands and push his legs.', 'rnc_b'),
  op_bkb_stand: counter('You try to stand up with him on your back.', 'rnc_b'),
  op_nt_high: counter('You come up too high.', 'nsEscape'),
  op_nb_push: counter('You push his head with straight arms.', 'kimura_ns'),
  op_tt_overcommit: counter('You roll over him with no control.', 'standUp_t'),
  op_tb_headUp: counter('You lift your head straight up.', 'guill_t'),
  op_tb_extend: counter('You reach out with straight arms.', 'turtleBack'),
};

export const GENERIC_MISTAKES = ['g_freeze', 'g_explode', 'g_grabShorts'];

// Wrong choices offered when the player has an opportunity, by `position:playerRole`.
export const OPPORTUNITY_MISTAKES = {
  'standing:neutral': ['op_st_reachLow', 'op_st_cross'],
  'closedGuard:bottom': ['op_cg_open', 'stall'],
  'closedGuard:top': ['op_cgt_armIn', 'op_cgt_lean', 'stall'],
  'butterfly:bottom': ['op_bb_flat', 'stall'],
  'butterfly:top': ['op_bt_kneel', 'op_bt_legIn'],
  'halfGuard:bottom': ['op_hb_flat', 'stall'],
  'halfGuard:top': ['op_ht_handMat', 'op_ht_highHips'],
  'sideControl:top': ['op_sc_highHips', 'op_sc_reachFar'],
  'sideControl:bottom': ['op_sb_push', 'op_sb_turnAway'],
  'kneeOnBelly:top': ['op_kt_overcommit', 'stall'],
  'kneeOnBelly:bottom': ['op_kb_pushStraight', 'op_kb_turn'],
  'mount:top': ['op_mt_handsMat', 'op_mt_lowKnees'],
  'mount:bottom': ['op_mb_push', 'op_mb_turn'],
  'back:top': ['op_bkt_cross', 'op_bkt_noHooks'],
  'back:bottom': ['op_bkb_handsDown', 'op_bkb_stand'],
  'northSouth:top': ['op_nt_high', 'stall'],
  'northSouth:bottom': ['op_nb_push', 'stall'],
  'turtle:top': ['op_tt_overcommit', 'stall'],
  'turtle:bottom': ['op_tb_headUp', 'op_tb_extend'],
};
