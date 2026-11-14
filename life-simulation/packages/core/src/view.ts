/**
 * What a single character is allowed to see. This is the ONLY input a decision
 * maker (human client or bot) receives, which structurally enforces bot fairness
 * (BOT_SYSTEM §8): no other characters' private info, hidden conditions, future
 * events or real outcome effects.
 */
import type { Attribute, ChoiceTag, EventCategory, Importance, RelationType, Season, Status } from "./constants";
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
  options: { id: string; label: string; description: string }[];
}

export interface RevealedChoice {
  characterId: string;
  role: string;
  choiceId: string;
  label: string;
  tags: ChoiceTag[];
}

/** Messages the engine sends to one character. */
export type Notice =
  | { kind: "event"; t: number; view: CharacterView }
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
  secrets: { played: { mischief: string; on: string }[]; suffered: { mischief: string; by: string }[] };
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
  /** Passive play: where to spend free time (a place kind from `options`). Undefined = no preference. */
  chooseLeisure?(options: readonly string[]): string | undefined;
}
