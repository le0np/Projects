// Moves (techniques) and belts. `base` = seconds to learn level 1 as a white belt.

export const BELTS = ['white', 'blue', 'purple', 'brown', 'black'];
export const BELT_NAMES = { white: 'Bijeli', blue: 'Plavi', purple: 'Ljubičasti', brown: 'Smeđi', black: 'Crni' };

export const CATEGORIES = {
  movement: 'Kretanje i osnove',
  takedown: 'Rušenja',
  guard: 'Gardovi',
  sweep: 'Sweepovi',
  pass: 'Prolazi garda',
  top: 'Gornje pozicije',
  transition: 'Prijelazi',
  escape: 'Bijegovi',
  sub: 'Submissioni',
  defense: 'Obrane',
};

const m = (id, name, category, belt, base, desc) => ({ id, name, category, belt, base, desc });

export const MOVES = [
  // Kretanje i osnove
  m('shrimp', 'Shrimp', 'movement', 'white', 5, 'Bijeg kukovima, temelj svih bijegova.'),
  m('upa', 'Bridge (upa)', 'movement', 'white', 5, 'Most kukovima za izbacivanje protivnika.'),
  m('technicalStandUp', 'Technical stand-up', 'movement', 'white', 10, 'Sigurno ustajanje s poda.'),
  m('sprawl', 'Sprawl', 'movement', 'white', 10, 'Obrana od rušenja: noge nazad, kukovi dolje.'),
  m('guardPosture', 'Postura u gardu', 'movement', 'white', 10, 'Uspravna leđa i ruke na kukovima protivnika.'),
  // Rušenja
  m('doubleLeg', 'Double leg', 'takedown', 'white', 20, 'Ulaz na obje noge i rušenje.'),
  m('singleLeg', 'Single leg', 'takedown', 'white', 20, 'Hvat jedne noge i rušenje.'),
  m('snapDown', 'Snap down', 'takedown', 'white', 25, 'Povlačenje glave dolje u prednju kontrolu.'),
  m('guardPull', 'Guard pull', 'takedown', 'white', 10, 'Povlačenje u gard (bez bodova).'),
  // Gardovi
  m('closedGuard', 'Zatvoreni gard', 'guard', 'white', 10, 'Noge zaključane oko protivnika.'),
  m('halfGuard', 'Polugard', 'guard', 'white', 15, 'Jedna noga protivnika zarobljena.'),
  m('butterflyGuard', 'Butterfly gard', 'guard', 'white', 20, 'Stopala kao kuke ispod bedara protivnika.'),
  // Sweepovi
  m('hipBump', 'Hip bump sweep', 'sweep', 'white', 20, 'Sjedneš, podigneš kuk i prevrneš protivnika.'),
  m('scissor', 'Scissor sweep', 'sweep', 'white', 25, 'Noge kao škare ruše protivnika.'),
  m('flower', 'Flower sweep', 'sweep', 'white', 30, 'Njihalo nogom iz zatvorenog garda.'),
  m('butterflySweep', 'Butterfly sweep', 'sweep', 'white', 30, 'Kukom podigneš protivnika i prebaciš ga.'),
  m('underhookSweep', 'Underhook sweep', 'sweep', 'white', 35, 'Iz polugarda underhook i izlaz na vrh.'),
  // Prolazi
  m('openClosedGuard', 'Otvaranje garda', 'pass', 'white', 15, 'Otvoriš zaključane noge protivnika.'),
  m('kneeSlice', 'Knee slice', 'pass', 'white', 30, 'Koljeno klizi preko bedra protivnika.'),
  m('toreando', 'Toreando', 'pass', 'white', 35, 'Odgurneš noge u stranu i obiđeš ih.'),
  m('overUnder', 'Over-under', 'pass', 'white', 40, 'Jedna ruka preko, druga ispod nogu, pritisak.'),
  // Gornje pozicije
  m('sideControl', 'Side control', 'top', 'white', 15, 'Bočna kontrola prsa na prsa.'),
  m('kneeOnBelly', 'Knee on belly', 'top', 'white', 20, 'Koljeno na trbuhu protivnika.'),
  m('mount', 'Mount', 'top', 'white', 20, 'Sjediš na protivniku.'),
  m('backControl', 'Back control', 'top', 'white', 30, 'Seatbelt hvat i dvije kuke.'),
  m('northSouth', 'North-south', 'top', 'white', 25, 'Kontrola glava na trbuh.'),
  // Prijelazi
  m('sideToMount', 'Side control → mount', 'transition', 'white', 25, 'Koljeno preko trbuha u mount.'),
  m('sideToKob', 'Side control → knee on belly', 'transition', 'white', 20, 'Podigneš se na koljeno.'),
  m('mountToBack', 'Mount → leđa', 'transition', 'white', 35, 'Kad se protivnik okrene, uzmeš leđa.'),
  // Bijegovi
  m('mountUpa', 'Upa iz mounta', 'escape', 'white', 15, 'Zarobiš ruku i nogu, most i prevrtanje.'),
  m('elbowKnee', 'Elbow-knee bijeg', 'escape', 'white', 25, 'Shrimp nazad u gard.'),
  m('sideShrimp', 'Shrimp iz side controla', 'escape', 'white', 20, 'Okviri rukama i shrimp u gard.'),
  m('sideUnderhook', 'Underhook na koljena', 'escape', 'white', 30, 'Underhook i izlazak na koljena.'),
  m('backEscape', 'Bijeg s leđa', 'escape', 'white', 35, 'Rame na pod i okretanje u gard.'),
  m('kobEscape', 'Bijeg iz knee on bellyja', 'escape', 'white', 20, 'Guraš koljeno i shrimp.'),
  // Submissioni
  m('rnc', 'Rear naked choke', 'sub', 'white', 30, 'Gušenje s leđa.'),
  m('guillotine', 'Guillotine', 'sub', 'white', 30, 'Gušenje glave pod pazuhom.'),
  m('triangle', 'Triangle', 'sub', 'white', 45, 'Gušenje nogama iz garda.'),
  m('armbar', 'Armbar', 'sub', 'white', 40, 'Poluga na lakat.'),
  m('kimura', 'Kimura', 'sub', 'white', 35, 'Poluga na rame, ruka iza leđa.'),
  m('americana', 'Americana', 'sub', 'white', 30, 'Poluga na rame, ruka prema glavi.'),
  m('straightAnkle', 'Straight ankle lock', 'sub', 'white', 40, 'Ravna poluga na stopalo.'),
  // Obrane
  m('guillotineDefense', 'Obrana od guillotine', 'defense', 'white', 25, 'Ruka preko ramena, okret prema slobodnoj strani.'),
  m('triangleDefense', 'Obrana od triangla', 'defense', 'white', 30, 'Postura i izvlačenje ruke.'),
  m('armbarDefense', 'Obrana od armbara', 'defense', 'white', 30, 'Spojene ruke, hitchhiker bijeg.'),
  m('rncDefense', 'Obrana od RNC-a', 'defense', 'white', 25, 'Borba za ruke, brada dolje.'),
  m('shoulderLockDefense', 'Obrana od kimure/americane', 'defense', 'white', 25, 'Ruka uz tijelo, hvataš vlastiti šorc.'),
  m('legLockDefense', 'Obrana od leg locka', 'defense', 'white', 35, 'Okreneš se s polugom i izvučeš petu.'),
  // Viši pojasevi
  m('darce', "D'arce choke", 'sub', 'blue', 120, 'Gušenje ispod pazuha iz front headlocka.'),
  m('armTriangle', 'Arm triangle', 'sub', 'blue', 120, 'Gušenje glavom i rukom protivnika.'),
  m('legDrag', 'Leg drag', 'pass', 'blue', 150, 'Povučeš noge preko sebe i prođeš.'),
  m('kneebar', 'Kneebar', 'sub', 'purple', 240, 'Poluga na koljeno.'),
  m('toeHold', 'Toe hold', 'sub', 'purple', 240, 'Poluga na stopalo uvijanjem.'),
  m('heelHook', 'Heel hook', 'sub', 'brown', 420, 'Uvijanje pete, opasna poluga na koljeno.'),
  m('insideHeelHook', 'Inside heel hook', 'sub', 'black', 600, 'Unutarnji heel hook iz saddlea.'),
];

export const MOVE_BY_ID = Object.fromEntries(MOVES.map((mv) => [mv.id, mv]));

// Colour class of each move for quick recognition in critical moments.
export const CATEGORY_CLASS = {
  sub: 'napad', sweep: 'napad', pass: 'napad', takedown: 'napad',
  defense: 'obrana', escape: 'obrana',
  top: 'kontrola', guard: 'kontrola', transition: 'kontrola',
  movement: 'pozicija',
};
export const MOVE_CLASS = Object.fromEntries(MOVES.map((mv) => [mv.id, CATEGORY_CLASS[mv.category]]));
