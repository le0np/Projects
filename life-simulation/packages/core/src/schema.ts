/**
 * Zod schemas for all content files (event definitions, careers, fact registry).
 * Structural validation lives here; cross-reference checks live in @lifesim/content.
 */
import { z } from "zod";
import {
  ATTRIBUTES,
  CHOICE_TAGS,
  EVENT_CATEGORIES,
  ID_PATTERN,
  IMPORTANCE,
  RELATION_TYPES,
  STATUSES,
} from "./constants";
import type { Condition } from "./conditions";

/** Current version of the event file format. Bump on breaking schema changes. */
export const EVENT_SCHEMA_VERSION = 1;

const Id = z.string().regex(ID_PATTERN, "must be lower_snake_case starting with a letter");
const RefStr = z.string().regex(/^(self|session|role:[a-z][a-z0-9_]*)$/, 'must be "self" or "role:<name>"');
const Attribute = z.enum(ATTRIBUTES);
const RelationType = z.enum(RELATION_TYPES);
const Status = z.enum(STATUSES);
const Category = z.enum(EVENT_CATEGORIES);
const Probability = z.number().gt(0).lte(1);
const NonEmptyText = z.string().trim().min(1);

// ---------------------------------------------------------------- conditions

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ all: z.array(ConditionSchema).min(1) }),
    z.strictObject({ any: z.array(ConditionSchema).min(1) }),
    z.strictObject({ not: ConditionSchema }),
    z.strictObject({
      attr: Attribute,
      of: RefStr.optional(),
      gte: z.number().optional(),
      lte: z.number().optional(),
    }),
    z.strictObject({ careerIn: z.array(Id).min(1), of: RefStr.optional() }),
    z.strictObject({ statusIn: z.array(Status).min(1), of: RefStr.optional() }),
    z.strictObject({
      fact: Id,
      of: RefStr.optional(),
      about: RefStr.optional(),
      present: z.boolean().optional(),
    }),
    z.strictObject({ sessionFact: Id, present: z.boolean().optional() }),
    z.strictObject({
      relation: z.strictObject({
        from: RefStr.optional(),
        to: RefStr,
        typeIn: z.array(RelationType).min(1).optional(),
        affinityGte: z.number().optional(),
        affinityLte: z.number().optional(),
        trustGte: z.number().optional(),
        trustLte: z.number().optional(),
      }),
    }),
    z.strictObject({ seenEvent: Id, of: RefStr.optional(), present: z.boolean().optional() }),
    z.strictObject({
      progress: z.strictObject({ gte: z.number().min(0).max(1).optional(), lte: z.number().min(0).max(1).optional() }),
    }),
    z.strictObject({ chose: Id, role: Id, count: z.enum(["any", "all", "none"]).optional() }),
  ]),
);

// ---------------------------------------------------------------- effects

const Delta = z.number().int().min(-100).max(100);

export const EffectSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("attr"),
    target: RefStr,
    delta: z.partialRecord(Attribute, Delta).refine((d) => Object.keys(d).length > 0, "delta must not be empty"),
  }),
  z.strictObject({
    type: z.literal("relation"),
    from: RefStr,
    to: RefStr,
    affinity: Delta.optional(),
    trust: Delta.optional(),
    setType: RelationType.optional(),
    /** Apply the same change in both directions. */
    mutual: z.boolean().optional(),
  }),
  z.strictObject({
    type: z.literal("fact"),
    target: RefStr,
    key: Id,
    about: RefStr.optional(),
    remove: z.boolean().optional(),
  }),
  z.strictObject({
    type: z.literal("status"),
    target: RefStr,
    status: Status,
    /** Short human-readable cause, used in the Life Recap ("died after a heart attack"). */
    cause: NonEmptyText,
  }),
]);
export type Effect = z.infer<typeof EffectSchema>;

// ---------------------------------------------------------------- perception

/** -2 (very bad) .. +2 (very good) as the character perceives it. Missing = unknown. */
const Level = z.number().int().min(-2).max(2);

export const PerceivedSchema = z.strictObject({
  benefit: Level.optional(),
  /** 0 (safe) .. 2 (dangerous). */
  risk: z.number().int().min(0).max(2).optional(),
  health: Level.optional(),
  mental: Level.optional(),
  money: Level.optional(),
  reputation: Level.optional(),
  career: Level.optional(),
  /** Expected effect on the relationship with members of a role. */
  relation: z.record(Id, Level).optional(),
});
export type Perceived = z.infer<typeof PerceivedSchema>;

// ---------------------------------------------------------------- choices, outcomes, follow-ups

export const ChoiceSchema = z.strictObject({
  id: Id,
  label: NonEmptyText,
  tags: z.array(z.enum(CHOICE_TAGS)).min(1),
  /** Choice applied on timeout / disconnect. Exactly one per role, always available. */
  default: z.boolean().optional(),
  /** Career-exclusive ("special") choice. */
  careers: z.array(Id).min(1).optional(),
  /** Visibility condition, evaluated with `self` = the chooser. */
  condition: ConditionSchema.optional(),
  perceived: PerceivedSchema.optional(),
  /** More accurate perception for characters with these careers. */
  insight: z
    .strictObject({ careers: z.array(Id).min(1), perceived: PerceivedSchema, note: NonEmptyText.optional() })
    .optional(),
  /** Applied once per character who picks this choice; `self` = the chooser. */
  effects: z.array(EffectSchema).optional(),
});
export type Choice = z.infer<typeof ChoiceSchema>;

const Delay = z.union([
  z.number().min(0),
  z.tuple([z.number().min(0), z.number().min(0)]).refine(([a, b]) => a <= b, "delay range must be [min, max]"),
]);

export const FollowUpSchema = z.strictObject({
  event: Id,
  /** Target role → source ref (`role:<name>` of the current event). */
  roles: z.record(Id, RefStr),
  /** Seconds of session time before the follow-up becomes eligible. Default 0. */
  delaySeconds: Delay.optional(),
  chance: Probability.optional(),
  /** Re-checked at activation time against the source event's role bindings. */
  condition: ConditionSchema.optional(),
});
export type FollowUp = z.infer<typeof FollowUpSchema>;

export const OutcomeSchema = z.strictObject({
  id: Id,
  /** Omitted = always matches. Outcomes are tried in order; the first match wins. */
  when: ConditionSchema.optional(),
  /** If set, a matching outcome still only applies with this probability; otherwise evaluation continues. */
  chance: Probability.optional(),
  effects: z.array(EffectSchema).optional(),
  followUps: z.array(FollowUpSchema).optional(),
  /** Narration per role shown after resolution. */
  text: z.record(Id, NonEmptyText).optional(),
  /** Whether participants learn what the others chose. Default false. */
  revealChoices: z.boolean().optional(),
  /** Marks this outcome as important for the Life Recap. */
  important: z.boolean().optional(),
  /** Resolves the session's story; the session ends after this event. */
  endsSession: z.boolean().optional(),
});
export type Outcome = z.infer<typeof OutcomeSchema>;

// ---------------------------------------------------------------- event

const Count = z.union([
  z.number().int().min(1),
  z.tuple([z.number().int().min(1), z.number().int().min(1)]).refine(([a, b]) => a <= b, "count must be [min, max]"),
]);

export const RoleSchema = z.strictObject({
  count: Count,
  description: NonEmptyText.optional(),
  careers: z.array(Id).min(1).optional(),
  /** Evaluated with `self` = the candidate. May reference only roles declared earlier. */
  conditions: ConditionSchema.optional(),
});
export type Role = z.infer<typeof RoleSchema>;

export const EventSchema = z.strictObject({
  schemaVersion: z.literal(EVENT_SCHEMA_VERSION),
  id: Id,
  version: z.number().int().min(1),
  title: NonEmptyText,
  category: Category,
  /** `director` events are picked by the selector; `followup_only` only start as follow-ups. */
  trigger: z.enum(["director", "followup_only"]),
  /** Hidden events are not announced to non-participants and never shown in lobby stats. */
  hidden: z.boolean().optional(),
  importance: z.enum(IMPORTANCE),
  /** Overrides the importance-based deadline. */
  durationSeconds: z.number().int().min(5).max(120).optional(),
  /** Base selection weight. */
  weight: z.number().min(0).default(10),
  cooldown: z
    .strictObject({
      /** Max times this event may occur in one session. */
      maxPerSession: z.number().int().min(1).optional(),
      /** Max times one character may take part in it. */
      maxPerCharacter: z.number().int().min(1).optional(),
      /** Minimum session seconds between two occurrences. */
      minGapSeconds: z.number().min(0).optional(),
    })
    .default({}),
  tags: z.array(Id).optional(),
  roles: z.record(Id, RoleSchema).refine((r) => Object.keys(r).length > 0, "at least one role is required"),
  /** Activation condition over the bound roles (no `self`). */
  conditions: ConditionSchema.optional(),
  text: z.strictObject({
    public: NonEmptyText,
    private: z.record(Id, NonEmptyText).optional(),
  }),
  /** Choices per role. Roles without an entry are passive (they do not decide). */
  choices: z.record(Id, z.array(ChoiceSchema)),
  outcomes: z.array(OutcomeSchema).min(1),
});
export type EventDefinition = z.infer<typeof EventSchema>;

// ---------------------------------------------------------------- careers

export const ModifierSchema = z.discriminatedUnion("type", [
  /** Scales attribute changes of the given direction (optionally only in some categories). */
  z.strictObject({
    type: z.literal("effect_multiplier"),
    attribute: Attribute,
    direction: z.enum(["loss", "gain"]),
    factor: z.number().min(0).max(3),
    categories: z.array(Category).min(1).optional(),
  }),
  /** Scales selection weight of matching events for this character. */
  z.strictObject({
    type: z.literal("selection_weight"),
    factor: z.number().min(0).max(5),
    categories: z.array(Category).min(1).optional(),
    tags: z.array(Id).min(1).optional(),
  }),
  /** Adjusts a starting attribute. */
  z.strictObject({ type: z.literal("start_bonus"), attribute: Attribute, amount: z.number().int().min(-30).max(30) }),
]);
export type Modifier = z.infer<typeof ModifierSchema>;

export const CareerSchema = z.strictObject({
  id: Id,
  name: NonEmptyText,
  description: NonEmptyText,
  abilities: z
    .array(z.strictObject({ id: Id, name: NonEmptyText, description: NonEmptyText, modifiers: z.array(ModifierSchema).min(1) }))
    .min(2)
    .max(3),
  strengths: z.array(NonEmptyText).min(1),
  weaknesses: z.array(NonEmptyText).min(1),
});
export type Career = z.infer<typeof CareerSchema>;
export const CareersFileSchema = z.strictObject({ careers: z.array(CareerSchema).min(1) });

// ---------------------------------------------------------------- fact registry

export const FactSchema = z.strictObject({
  key: Id,
  /** `character`: about one character; `pair`: character → other character (`about`); `session`: global. */
  scope: z.enum(["character", "pair", "session"]),
  description: NonEmptyText,
  /** Set by the engine at character creation, not by events. */
  setAtInit: z.boolean().optional(),
});
export type Fact = z.infer<typeof FactSchema>;
export const FactsFileSchema = z.strictObject({ facts: z.array(FactSchema).min(1) });
