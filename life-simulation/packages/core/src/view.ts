/**
 * What a single character is allowed to see. This is the ONLY input a decision
 * maker (human client or bot) receives, which structurally enforces bot fairness
 * (BOT_SYSTEM §8): no other characters' private info, hidden conditions, future
 * events or real outcome effects.
 */
import type { Attribute, ChoiceTag, EventCategory, Importance, MarkKind, RelationType, Season, Status } from "./constants";

/** T7: a lasting trace on the map: on a person (`placeId` null) or at a place (their home or workplace). */
export interface Mark {
  id: string;
  kind: MarkKind;
  characterId: string;
  placeId: string | null;
  since: number;
  /** Session time it disappears; undefined = stays until the end. */
  until?: number;
}
import type { TilePos } from "./map";
import type { Perceived } from "./schema";

export interface VisibleChoice {
  id: string;
  label: string;
  tags: ChoiceTag[];
  /** Perception after applying career insight. Missing fields = unknown. */
  perceived: Perceived;
  /** Extra insight text granted by the character's career. */
  note?: string;
  /** Career-exclusive choice. */
  special: boolean;
  isDefault: boolean;
}

export interface ParticipantInfo {
  characterId: string;
  name: string;
  role: string;
}

export interface OfferView {
  instanceId: string;
  eventId: string;
  title: string;
  category: EventCategory;
  importance: Importance;
  offeredAt: number;
  deadlineAt: number;
  role: string;
  participants: ParticipantInfo[];
  publicText: string;
  privateText?: string;
  /** Where it happens (null: on the street). */
  place: { id: string; name: string; kind: string } | null;
  /** T8: what you noticed (you caught who was behind it). */
  clue?: string;
  /** The tile where everyone gathers (T5: the card opens next to it). */
  tile: TilePos;
  /** Empty for passive roles (the character is involved but does not decide). */
  choices: VisibleChoice[];
}

export interface RelationSnapshot {
  type: RelationType;
  affinity: number;
  trust: number;
}

export interface SelfView {
  id: string;
  name: string;
  career: string;
  age: number;
  attrs: Record<Attribute, number>;
  status: Status;
  /** Own facts: `key` or `key:<otherCharacterId>`. */
  facts: string[];
}

export interface OtherCharacterView {
  id: string;
  name: string;
  career: string;
  status: Status;
  /** How THIS character feels about the other one (never the reverse). */
  relation: RelationSnapshot;
  /** T6: money between you: they owe you, you owe them (relationship lines on the map). */
  debt?: "owes_you" | "you_owe" | "both";
}

export interface CharacterView {
  now: number;
  /** 0..1 fraction of the configured session duration (players see a clock too). */
  sessionProgress: number;
  /** Life calendar: whole years since the session started and the current season. */
  calendar: { year: number; season: Season };
  self: SelfView;
  others: OtherCharacterView[];
  offer: OfferView;
  /** Pranks this character can still play (concept v2 §5). */
  mischief: MischiefState;
}

export interface MischiefState {
  charges: number;
  options: { id: string; label: string; description: string; career?: boolean }[];
  /** T8: your schemes, with what you know about them. */
  schemes?: SchemeView[];
  /** T8: people you may take revenge on with a free scheme. */
  revengeOn?: string[];
}

/** T10: a personal goal as its owner sees it during the session. */
export interface GoalView {
  id: string;
  label: string;
  mode: "ever" | "end" | "never";
  /** "done" for "end" goals is provisional until the end; "broken"/"failed" are final. */
  state: "open" | "done" | "broken";
}

export type SchemeBoost = "cover" | "wait" | "accomplice";
export type AccompliceAnswer = "helped" | "refused" | "betrayed";
export type SchemeResult = "worked" | "failed";

/** T8: a scheme as its plotter sees it. */
export interface SchemeView {
  id: string;
  mischiefId: string;
  label: string;
  targetId: string;
  startedAt: number;
  readyAt: number;
  success: number;
  risk: number;
  boost?: SchemeBoost;
  accomplice?: string;
  accompliceAnswer?: AccompliceAnswer;
  state: "preparing" | "done";
  /** A free scheme: revenge on someone who wronged you. */
  revenge?: boolean;
  result?: SchemeResult;
  discovered?: boolean;
}

export interface RevealedChoice {
  characterId: string;
  role: string;
  choiceId: string;
  label: string;
  tags: ChoiceTag[];
}

/** T6: how a character feels, shown as an emoji above their head on the map. */
export type Mood = "content" | "happy" | "angry" | "sad" | "shocked" | "in_love" | "in_debt" | "sick" | "stressed";

/** How someone visibly reacts to what just happened (T5: faces on the map before the outcome text). */
export type Reaction = "joy" | "angry" | "sad" | "shock" | "neutral";

/** Messages the engine sends to one character. */
export type Notice =
  | { kind: "event"; t: number; view: CharacterView }
  /** T10: your goals changed (one reached, one broken). */
  | { kind: "goals"; t: number; goals: GoalView[] }
  /** T9: someone else is deciding right now; you may guess what they will do. */
  | { kind: "guessable"; t: number; instanceId: string; title: string; deciderId: string; name: string; choices: { id: string; label: string }[]; deadlineAt: number }
  /** T9: how your guess turned out. */
  | { kind: "guess_result"; t: number; instanceId: string; deciderId: string; name: string; guessed: string; actual: string; correct: boolean }
  /** T8: news about one of your schemes (planned, boosted, carried out, found out). */
  | { kind: "scheme"; t: number; scheme: SchemeView; text: string }
  /** T5: something is about to happen to you; the participants are walking there (the offer comes at `offerAt`). */
  | { kind: "coming"; t: number; instanceId: string; title: string; tile: TilePos; placeName: string | null; offerAt: number; participants: ParticipantInfo[] }
  | {
      kind: "resolved";
      t: number;
      instanceId: string;
      eventId: string;
      title: string;
      role: string;
      participants: ParticipantInfo[];
      myChoice?: { id: string; label: string; tags: ChoiceTag[]; defaulted: boolean };
      /** Other participants' choices, only when the outcome reveals them. */
      revealed: RevealedChoice[];
      outcomeText?: string;
      /** Changes to the character's own attributes. */
      selfChanges: Partial<Record<Attribute, number>>;
      /** Everyone else as the character sees them after this event (B2: relationships are current at once). */
      others?: CharacterView["others"];
      /** T5: who (of the visible participants) made a choice — their cards are turned over together. */
      deciders?: string[];
      /** T5: how each visible participant reacts (shown on the map for a moment). */
      reactions?: { characterId: string; reaction: Reaction }[];
    }
  | { kind: "ended"; t: number; status: Status; cause: string }
  /** A town-wide upheaval and what it did to you. */
  | { kind: "upheaval"; t: number; id: string; title: string; text: string; personal: string[]; selfChanges: Partial<Record<Attribute, number>> }
  | { kind: "session_completed"; t: number; recap: LifeRecap };

export const OUTCOME_TAGS = [
  "survived",
  "death",
  "imprisonment",
  "illness",
  "injury",
  "left",
  "career_advancement",
  "career_setback",
  "financial_success",
  "financial_failure",
  "relationship_success",
  "relationship_failure",
  "saved_another",
  "personal_sacrifice",
] as const;
export type OutcomeTag = (typeof OUTCOME_TAGS)[number];

export interface KeyMoment {
  t: number;
  instanceId: string;
  eventTitle: string;
  choiceLabel?: string;
  choiceTags?: ChoiceTag[];
  text?: string;
}

export interface LifeRecap {
  characterId: string;
  name: string;
  career: string;
  isBot: boolean;
  sessionDurationMs: number;
  lifeDurationMs: number;
  /** Age when the story ended (or at the end of the session). */
  ageAtEnd: number;
  eventsCount: number;
  finalStatus: Status;
  cause?: string;
  outcomes: OutcomeTag[];
  startAttrs: Record<Attribute, number>;
  finalAttrs: Record<Attribute, number>;
  keyMoments: KeyMoment[];
  relationshipsGained: { characterId: string; name: string; type: RelationType }[];
  relationshipsLost: { characterId: string; name: string; from: RelationType; to: RelationType }[];
  influencedBy: { characterId: string; name: string; events: number; impact: number }[];
  /** Revealed at the end: pranks this character played, and pranks played on them. */
  secrets: {
    played: {
      mischief: string;
      on: string;
      result?: SchemeResult;
      discovered?: boolean;
      revenge?: boolean;
      boost?: SchemeBoost;
      accomplice?: string;
      accompliceAnswer?: AccompliceAnswer;
    }[];
    /** `year`: the year of your life it happened in (0 = the first). */
    suffered: { mischief: string; by: string; discovered?: boolean; year?: number }[];
  };
  /** T11: what this life will be remembered as. */
  title: { id: string; label: string; why: string };
  /** T11: one emoji per year of life (for "Copy my life"). */
  years: string[];
  /** T10: the two personal goals and whether they were reached. */
  goals: { id: string; label: string; done: boolean }[];
  /** T9: guesses about other people's decisions while waiting. */
  oracle: { guesses: number; correct: number };
  /** Internal balancing metric; not shown to players as a "win". */
  lifeScore: number;
}

export interface Decision {
  choiceId: string;
  /** Simulated thinking time before the decision is submitted. */
  thinkMs: number;
}

/**
 * Decision maker for one character (bot, scripted test, or a human proxy).
 * It only ever sees `CharacterView` and its own notices — exactly what a human client sees.
 */
export interface Controller {
  /** Return null to not decide (the deadline default will apply). */
  decide(view: CharacterView): Decision | null;
  observe?(notice: Notice): void;
  /** Optionally play a prank after an event (bots). The host asks after each resolved event. */
  planMischief?(): { mischiefId: string; targetId: string } | null;
  /** T8: optionally boost one of your schemes after hearing about it (bots). */
  planBoost?(notice: Extract<Notice, { kind: "scheme" }>): { schemeId: string; boost: SchemeBoost; accompliceId?: string } | null;
  /** Passive play: where to spend free time (a place kind from `options`). Undefined = no preference. */
  chooseLeisure?(options: readonly string[]): string | undefined;
}
