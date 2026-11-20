/** Echo (spirit companion) creation options and the lines it speaks during the intro. */
export const echoRelationships = [
  'Father', 'Mother', 'Brother', 'Sister', 'Friend', 'Mentor', 'Partner', 'Beloved animal', 'Fictional guardian',
] as const;
export type EchoRelationship = (typeof echoRelationships)[number];

export const echoPersonalities = {
  warm: { label: 'Warm', blurb: 'Gentle and encouraging. Believes in you before you do.' },
  stern: { label: 'Stern', blurb: 'Demanding but fair. Pushes you to be stronger.' },
  playful: { label: 'Playful', blurb: 'Teasing and light-hearted, even in danger.' },
  wise: { label: 'Wise', blurb: 'Calm and thoughtful. Speaks in lessons.' },
} as const;
export type EchoPersonality = keyof typeof echoPersonalities;

export const echoForms = {
  human: { label: 'Human', blurb: 'A luminous figure, the way you remember them.' },
  wolf: { label: 'Wolf', blurb: 'A great spirit wolf that never leaves your side.' },
  bird: { label: 'Bird', blurb: 'A graceful spirit bird of light and wind.' },
} as const;
export type EchoForm = keyof typeof echoForms;

export const echoConnections = [
  'Protector', 'Teacher', 'Companion', 'Unfinished promise', 'Guiding light',
] as const;
export type EchoConnection = (typeof echoConnections)[number];

/** Spirit colour choices (hex). */
export const echoHues = [0xbfefff, 0xffe2a8, 0xd7c2ff, 0xb8ffd9, 0xffc4d6];

export const echoMemoryExamples = [
  'Courage is being afraid and going anyway.',
  'We protect what we love, even when it costs us.',
  'Every storm runs out of rain.',
  'You are never as alone as you feel.',
];

/** Intro greeting by personality. {player} and {echo} are replaced. */
export const echoIntroLines: Record<EchoPersonality, string[]> = {
  warm: ['{player}... it is really you. I am still here.', 'Wherever this road leads, you will not walk it alone.'],
  stern: ['On your feet, {player}. The world will not wait.', 'I will watch. You will grow stronger.'],
  playful: ['Took you long enough, {player}! Did you miss me?', 'Come on, the world is huge and we have a lot of mischief to catch up on.'],
  wise: ['Breathe, {player}. Every journey begins with a single, honest step.', 'Listen to the land. It remembers more than people do.'],
};

export const echoDefaults = {
  /** Seconds. Phase 5 uses these; stored in saves from the start so the format stays stable. */
  guardianEmbraceCooldown: 600,
  spiritWardCooldown: 25,
};
