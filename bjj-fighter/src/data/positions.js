// Position graph: who can do what from where, and the wrong choices offered in critical moments.
// Roles: 'top' / 'bottom' in ground positions, 'neutral' when standing.
// `to.actorTop`: the fighter who did the action ends on top (true) or bottom (false).

export const POSITIONS = {
  standing: { name: 'Stojeći' },
  closedGuard: { name: 'Zatvoreni gard' },
  halfGuard: { name: 'Polugard' },
  butterfly: { name: 'Butterfly gard' },
  sideControl: { name: 'Side control' },
  kneeOnBelly: { name: 'Knee on belly', scoring: 'kneeOnBelly' },
  mount: { name: 'Mount', scoring: 'mount' },
  back: { name: 'Leđa', scoring: 'back' },
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
  // Stojeći
  a('td_double', 'doubleLeg', 'standing', 'neutral', 'takedown', T('halfGuard', true), ['sprawl'], DEF_TAKEDOWN),
  a('td_single', 'singleLeg', 'standing', 'neutral', 'takedown', T('closedGuard', true), ['sprawl'], DEF_TAKEDOWN),
  a('snap', 'snapDown', 'standing', 'neutral', 'transition', T('turtle', true), ['technicalStandUp'], ['td_standTall', 'td_turnAway']),
  a('pull', 'guardPull', 'standing', 'neutral', 'pull', T('closedGuard', false), [], []),
  a('guill_st', 'guillotine', 'standing', 'neutral', 'sub', undefined, ['guillotineDefense'], ['gu_pullBack', 'gu_wrongSide']),
  // Zatvoreni gard
  a('hipBump', 'hipBump', 'closedGuard', 'bottom', 'sweep', T('mount', true), ['guardPosture'], DEF_SWEEP),
  a('scissor', 'scissor', 'closedGuard', 'bottom', 'sweep', T('mount', true), ['guardPosture'], DEF_SWEEP),
  a('flower', 'flower', 'closedGuard', 'bottom', 'sweep', T('mount', true), ['guardPosture'], DEF_SWEEP),
  a('triangle_cg', 'triangle', 'closedGuard', 'bottom', 'sub', undefined, ['triangleDefense', 'guardPosture'], ['tr_headDown', 'tr_armInside']),
  a('armbar_cg', 'armbar', 'closedGuard', 'bottom', 'sub', undefined, ['armbarDefense'], ['ab_pullStraight', 'ab_bridgeWrong']),
  a('kimura_cg', 'kimura', 'closedGuard', 'bottom', 'sub', undefined, ['shoulderLockDefense'], ['sh_straighten', 'sh_rollWrong']),
  a('guill_cg', 'guillotine', 'closedGuard', 'bottom', 'sub', undefined, ['guillotineDefense'], ['gu_pullBack', 'gu_wrongSide']),
  a('openGuard', 'openClosedGuard', 'closedGuard', 'top', 'transition', T('butterfly', true), ['closedGuard'], ['es_highHips', 'es_relax']),
  // Butterfly (otvoreni gard)
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
  // Polugard
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
  // Leđa
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
  // obrana od rušenja
  td_standTall: threat('Stojiš uspravno i čekaš da te uhvati.'),
  td_turnAway: pos('Okreneš mu leđa i pokušaš pobjeći.', 'back', false, 'transition'),
  td_reachDown: counter('Spustiš glavu i hvataš mu nogu.', 'guill_st'),
  // obrana od sweepa (ti si gore u gardu)
  sw_handsOnMat: threat('Spustiš ruke na strunjaču daleko od tijela.'),
  sw_armInside: counter('Gurneš jednu ruku između njegovih nogu.', 'triangle_cg'),
  sw_leanForward: threat('Nagneš se naprijed bez baze.'),
  // obrana od prolaza (ti si dolje)
  ps_flat: threat('Ostaneš ravno na leđima.'),
  ps_turnAway: pos('Okreneš se od njega.', 'back', false, 'transition'),
  ps_pushStraight: threat('Guraš ga ispruženim rukama.'),
  // obrana od napredovanja (mount, knee on belly, leđa)
  mt_pushStraight: threat('Guraš ga ispruženim rukama u prsa.'),
  mt_turnBelly: pos('Okreneš se na trbuh.', 'back', false, 'transition'),
  bk_handsForward: threat('Ostaviš ruke ispred sebe i pustiš ga iza.'),
  // ti si gore, on bježi
  es_highHips: threat('Digneš kukove previsoko.'),
  es_relax: threat('Opustiš pritisak da se odmoriš.'),
  es_overreach: threat('Posegneš preduboko za submissionom.'),
  // submissioni
  gu_pullBack: threat('Povlačiš glavu ravno unatrag.'),
  gu_wrongSide: threat('Okreneš se na stranu njegove ruke koja guši.'),
  tr_headDown: threat('Spustiš glavu i guraš naprijed.'),
  tr_armInside: threat('Ostaviš ruku unutra i čekaš.'),
  ab_pullStraight: threat('Izvlačiš ispruženu ruku ravno prema sebi.'),
  ab_bridgeWrong: threat('Mostiš prema njegovim nogama.'),
  sh_straighten: threat('Ispružiš ruku da se oslobodiš.'),
  sh_rollWrong: threat('Okreneš se od poluge.'),
  at_armAcross: threat('Ostaviš ruku preko svog lica.'),
  at_flat: threat('Ostaneš ravno i guraš mu glavu.'),
  ll_spinWrong: threat('Vrtiš se u suprotnu stranu od poluge.'),
  ll_pullKnee: threat('Povlačiš koljeno dok mu je peta zarobljena.'),
  ll_wait: threat('Čekaš da popusti.'),
  rnc_pushElbow: threat('Guraš mu lakat od sebe.'),
  rnc_wait: threat('Čekaš da mu nestane snage.'),
  // opće greške
  g_freeze: threat('Ukočiš se i čekaš.'),
  g_explode: threat('Eksplodiraš bez plana i potrošiš snagu.'),
  g_grabShorts: penalty('Uhvatiš ga za šorc (zabranjeno).'),
  stall: penalty('Samo ga držiš i ne radiš ništa (stalling).'),
  // tvoje prilike: krivi potezi
  op_st_reachLow: counter('Zaletiš se s glavom ispred nogu.', 'guill_st'),
  op_st_cross: pos('Prekrižiš noge dok se krećeš.', 'halfGuard', false, 'takedown'),
  op_cg_open: pos('Otvoriš noge bez plana.', 'butterfly', false, 'transition'),
  op_cgt_armIn: counter('Jedna ruka unutra, jedna vani.', 'triangle_cg'),
  op_cgt_lean: counter('Spustiš se naprijed i opustiš posturu.', 'guill_cg'),
  op_bb_flat: pos('Legneš ravno na leđa.', 'sideControl', false, 'pass'),
  op_bt_kneel: counter('Klekneš između njegovih nogu.', 'bSweep'),
  op_bt_legIn: counter('Ostaviš nogu duboko između njegovih.', 'heel_b'),
  op_hb_flat: counter('Ostaneš ravno, bez underhooka.', 'kneeSlice_h'),
  op_ht_handMat: counter('Ostaviš ruku na strunjači pored njega.', 'kimura_hg'),
  op_ht_highHips: counter('Digneš kukove bez pritiska.', 'uhSweep'),
  op_sc_highHips: counter('Digneš kukove i opustiš pritisak.', 'sideShrimp_e'),
  op_sc_reachFar: counter('Posegneš preko glave za ruku.', 'sideUnderhook_e'),
  op_sb_push: counter('Guraš ga ispruženim rukama.', 'americana_s'),
  op_sb_turnAway: pos('Okreneš mu leđa.', 'back', false, 'transition'),
  op_kt_overcommit: counter('Prebaciš svu težinu naprijed.', 'kobEscape_e'),
  op_kb_pushStraight: counter('Guraš mu koljeno ispruženim rukama.', 'armbar_k'),
  op_kb_turn: pos('Okreneš se na trbuh.', 'back', false, 'transition'),
  op_mt_handsMat: counter('Spustiš ruke na strunjaču pored glave.', 'mountUpa_e'),
  op_mt_lowKnees: counter('Raširiš koljena i spustiš se nisko.', 'elbowKnee_e'),
  op_mb_push: counter('Guraš ga ispruženim rukama.', 'armbar_m'),
  op_mb_turn: pos('Okreneš se na trbuh.', 'back', false, 'transition'),
  op_bkt_cross: counter('Prekrižiš stopala ispred njega.', 'backEscape_e'),
  op_bkt_noHooks: counter('Pustiš kuke i držiš samo rukama.', 'backEscape_e'),
  op_bkb_handsDown: counter('Spustiš ruke i guraš njegove noge.', 'rnc_b'),
  op_bkb_stand: counter('Pokušaš ustati s njim na leđima.', 'rnc_b'),
  op_nt_high: counter('Digneš se previsoko.', 'nsEscape'),
  op_nb_push: counter('Guraš mu glavu ispruženim rukama.', 'kimura_ns'),
  op_tt_overcommit: counter('Prebaciš se preko njega bez kontrole.', 'standUp_t'),
  op_tb_headUp: counter('Digneš glavu ravno gore.', 'guill_t'),
  op_tb_extend: counter('Ispružiš ruke ispred sebe.', 'turtleBack'),
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
