/**
 * Shared vocabulary of the game. Content files may only use values listed here;
 * the content validator enforces it.
 */

/** Numeric character attributes, each in [ATTRIBUTE_MIN, ATTRIBUTE_MAX]. */
export const ATTRIBUTES = ["health", "mental", "money", "reputation", "career"] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
export const ATTRIBUTE_MIN = 0;
export const ATTRIBUTE_MAX = 100;

export const RELATION_TYPES = [
  "stranger",
  "acquaintance",
  "friend",
  "colleague",
  "partner",
  "family",
  "rival",
  "enemy",
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

/** Character status. Anything other than `active` means the character's story has ended or is paused. */
export const STATUSES = ["active", "hospitalized", "imprisoned", "left", "dead"] as const;
export type Status = (typeof STATUSES)[number];

/**
 * Thematic event categories. "Hidden" and "Consequence" from the spec are modelled as
 * event flags (`hidden`, `trigger: "followup_only"`), not categories — see IMPLEMENTATION_PLAN K6.
 */
export const EVENT_CATEGORIES = [
  "everyday",
  "social",
  "career",
  "relationships",
  "family",
  "financial",
  "health",
  "critical",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** Attitude tags of a choice (GDD §8). Bots use them for moral alignment scoring. */
export const CHOICE_TAGS = [
  "help",
  "refuse",
  "negotiate",
  "lie",
  "truth",
  "ignore",
  "threaten",
  "apologize",
  "take_responsibility",
  "avoid_responsibility",
  "risk",
  "sacrifice",
] as const;
export type ChoiceTag = (typeof CHOICE_TAGS)[number];

/** Decision importance; maps to a response deadline range in the session config. */
export const IMPORTANCE = ["simple", "multi", "important"] as const;
export type Importance = (typeof IMPORTANCE)[number];

export const SESSION_LIMITS = {
  minParticipants: 2,
  maxParticipants: 8,
} as const;

/** Identifier format for events, roles, choices, outcomes, careers, facts. */
export const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];
