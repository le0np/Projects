/**
 * Sprint 5: "Life in chapters". One life from 18 to 33 in six chapters. In each of the first five
 * the player picks a focus (3 cards), plays the event for it, sees "What changed" and moves on;
 * the sixth chapter is the finale for the player's dream. Content is JSON (packages/content/chapters),
 * validated by these schemas; the engine is in @lifesim/engine (`ChapterLife`).
 */
import { z } from "zod";

export const CHAPTER_AGES = [18, 21, 24, 27, 30, 33] as const;
export const FINALE_CHAPTER = 5;
/** The town twist (like the flood in the prototype) happens before the focus of this chapter. */
export const TWIST_CHAPTER = 3;

export const CAST_ROLES = ["friend", "crush", "rival"] as const;
export type CastRole = (typeof CAST_ROLES)[number];
/** `target` = the person a revenge event is about; `about` = the person a secret is about. */
export const PERSON_REFS = [...CAST_ROLES, "target", "about"] as const;
export type PersonRef = (typeof PERSON_REFS)[number];

export const FOCUSES = ["career", "love", "family", "money", "business", "fame", "town", "friends", "home", "revenge", "damage"] as const;
export type Focus = (typeof FOCUSES)[number];
/** Focuses that are not offered as a card: the twist, revealed secrets and the finale. */
export const EVENT_KINDS = [...FOCUSES, "twist", "finale"] as const;

export const LIFE_CHOICE_TAGS = ["brave", "lie", "refuse", "effort", "calm", "modest"] as const;
export type LifeChoiceTag = (typeof LIFE_CHOICE_TAGS)[number];

/** Numbers a condition or a finale factor can look at. */
export const LIFE_STATS = [
  "money",
  "rep",
  "fame",
  "jobLevel",
  "kids",
  "chapter",
  "secrets",
  "exposed",
  "lies",
  "helped",
  "hurt",
  "relMin",
  "relMax",
  "rel.friend",
  "rel.crush",
  "rel.rival",
  "rel.target",
] as const;
export type LifeStat = (typeof LIFE_STATS)[number];

const Id = z.string().regex(/^[a-z][a-z0-9_]*$/, "lower_snake_case id");
const Range = z.object({ min: z.number().optional(), max: z.number().optional() }).strict();

export const LifeCondSchema = z
  .object({
    flags: z.array(Id).optional(),
    notFlags: z.array(Id).optional(),
    stats: z.partialRecord(z.enum(LIFE_STATS), Range).optional(),
    /** `crush` = together with your crush, `none` = single, `any` = together with someone. */
    partner: z.enum(["crush", "none"]).optional(),
    married: z.boolean().optional(),
    /** Still living in the starting home. */
    homeStart: z.boolean().optional(),
    hasJob: z.boolean().optional(),
    dream: z.array(Id).optional(),
    flaw: z.array(Id).optional(),
    career: z.array(Id).optional(),
    dreamDone: z.boolean().optional(),
  })
  .strict();
export type LifeCond = z.infer<typeof LifeCondSchema>;

/** A text, or variants picked by condition (the first that matches; the last should have no `when`). */
const Variant = z.object({ when: LifeCondSchema.optional(), text: z.string().min(1), callback: z.boolean().optional() }).strict();
export const LifeTextSchema = z.union([z.string().min(1), z.array(Variant).min(1)]);
export type LifeText = z.infer<typeof LifeTextSchema>;

const RevealSchema = z.object({ text: z.string().min(1), emoji: z.string().min(1), effects: z.lazy(() => z.array(LifeEffectSchema)).optional() }).strict();

export const LifeEffectSchema: z.ZodType<LifeEffect> = z.union([
  z.object({ money: z.number().int() }).strict(),
  z.object({ rep: z.number().int() }).strict(),
  z.object({ fame: z.number().int() }).strict(),
  z.object({ rel: z.enum(PERSON_REFS), n: z.number().int() }).strict(),
  z.object({ job: z.number().int().min(0).max(2) }).strict(),
  z.object({ home: z.string().min(1) }).strict(),
  z.object({ partner: z.enum(["crush", "none"]) }).strict(),
  z.object({ marry: z.literal(true) }).strict(),
  z.object({ kid: z.literal(1) }).strict(),
  z.object({ flag: Id }).strict(),
  z.object({ unflag: Id }).strict(),
  z
    .object({
      secret: z
        .object({ id: Id, text: z.string().min(1), about: z.enum(PERSON_REFS).optional(), years: z.number().int().min(1).max(4), reveal: RevealSchema })
        .strict(),
    })
    .strict(),
  /** Damage control acts on the secret it is about. */
  z.object({ secretClear: z.literal(true) }).strict(),
  z.object({ secretDelay: z.number().int().min(1).max(3) }).strict(),
  z.object({ secretRevealNow: z.literal(true) }).strict(),
  z.object({ remember: LifeTextSchema }).strict(),
]);
export type LifeEffect =
  | { money: number }
  | { rep: number }
  | { fame: number }
  | { rel: PersonRef; n: number }
  | { job: number }
  | { home: string }
  | { partner: "crush" | "none" }
  | { marry: true }
  | { kid: 1 }
  | { flag: string }
  | { unflag: string }
  | { secret: { id: string; text: string; about?: PersonRef; years: number; reveal: { text: string; emoji: string; effects?: LifeEffect[] } } }
  | { secretClear: true }
  | { secretDelay: number }
  | { secretRevealNow: true }
  | { remember: LifeText };

const OutcomeBase = {
  text: LifeTextSchema,
  emoji: z.string().min(1),
  effects: z.array(LifeEffectSchema).optional(),
  /** "{friend} paddled over in his canoe" — shown with the person's face. */
  cast: z.object({ who: z.enum(PERSON_REFS), did: LifeTextSchema }).strict().optional(),
};
const FlawOutcome = z.object({ text: LifeTextSchema, emoji: z.string().min(1).optional(), effects: z.array(LifeEffectSchema).optional() }).strict();
export const LifeOutcomeSchema = z
  .object({
    ...OutcomeBase,
    /** A flaw changes the outcome: other text (and, if given, other effects). */
    byFlaw: z.record(Id, FlawOutcome).optional(),
  })
  .strict();
export type LifeOutcome = z.infer<typeof LifeOutcomeSchema>;

export const LifeChoiceSchema = z
  .object({
    id: Id,
    label: LifeTextSchema,
    when: LifeCondSchema.optional(),
    /** Only offered to this career ("Your expertise"). */
    career: Id.optional(),
    tags: z.array(z.enum(LIFE_CHOICE_TAGS)).optional(),
    /** Chance in % that it works; without it the choice always works (unless your flaw gets in the way). */
    base: z.number().int().min(1).max(100).optional(),
    mods: z.array(z.object({ when: LifeCondSchema, add: z.number().int(), note: z.string().min(1) }).strict()).optional(),
    /** The person decides: `ok` if they help, `fail` if they don't (friends help, the people you hurt don't). */
    cast: z.enum(PERSON_REFS).optional(),
    /** If it fails because of your flaw, you end up doing this other choice instead ("you said yes anyway"). */
    failTo: Id.optional(),
    ok: LifeOutcomeSchema,
    fail: LifeOutcomeSchema.optional(),
  })
  .strict();
export type LifeChoice = z.infer<typeof LifeChoiceSchema>;

export const LifeEventSchema = z
  .object({
    id: Id,
    kind: z.enum(EVENT_KINDS),
    title: LifeTextSchema,
    when: LifeCondSchema.optional(),
    text: LifeTextSchema,
    /** What only you know (shown in italics). */
    private: LifeTextSchema.optional(),
    choices: z.array(LifeChoiceSchema).min(1).max(6),
  })
  .strict();
export type LifeEvent = z.infer<typeof LifeEventSchema>;

export const DreamSchema = z
  .object({
    id: Id,
    icon: z.string(),
    label: z.string(),
    note: z.string(),
    /** Focus cards that feed this dream (one of them is always offered when possible). */
    focus: z.array(z.enum(FOCUSES)).min(1),
    finale: z
      .object({
        title: LifeTextSchema,
        text: LifeTextSchema,
        base: z.number().int(),
        factors: z
          .array(
            z
              .object({
                label: LifeTextSchema,
                when: LifeCondSchema.optional(),
                add: z.number().optional(),
                per: z.object({ stat: z.enum(LIFE_STATS), mul: z.number() }).strict().optional(),
                /** Upper/lower bound of this factor (e.g. savings count at most +30). */
                cap: z.number().optional(),
                floor: z.number().optional(),
              })
              .strict(),
          )
          .min(1),
        success: z.object({ text: LifeTextSchema, emoji: z.string() }).strict(),
        failure: z.object({ text: LifeTextSchema, emoji: z.string() }).strict(),
      })
      .strict(),
  })
  .strict();
export type Dream = z.infer<typeof DreamSchema>;

export const FlawSchema = z
  .object({
    id: Id,
    icon: z.string(),
    label: z.string(),
    note: z.string(),
    /** Choices with this tag are harder: `add` to the odds; a choice that always works gets `certain` instead. */
    tag: z.enum(LIFE_CHOICE_TAGS),
    add: z.number().int().max(0),
    certain: z.number().int().min(1).max(99),
    /** What happens when a choice that would always work fails because of the flaw. */
    failText: z.string().min(1),
    failEmoji: z.string().min(1),
    /** Your secrets come out this many chapters sooner. */
    secretsSooner: z.number().int().min(0).max(2).optional(),
    /** Every chapter (from the second): these effects, with this line in "What changed". */
    everyChapter: z.object({ effects: z.array(LifeEffectSchema), note: z.string() }).strict().optional(),
  })
  .strict();
export type Flaw = z.infer<typeof FlawSchema>;

export const LifeCareerSchema = z
  .object({
    id: Id,
    icon: z.string(),
    label: z.string(),
    color: z.string(),
    workplace: z.string(),
    jobs: z.tuple([z.string(), z.string()]),
  })
  .strict();
export type LifeCareer = z.infer<typeof LifeCareerSchema>;

export const CastMemberSchema = z
  .object({
    id: Id,
    role: z.enum(CAST_ROLES),
    name: z.string(),
    trait: z.string(),
    color: z.string(),
    pronouns: z.enum(["he", "she"]),
    /** At a neutral relationship, how likely they help when they decide. */
    helpsAtZero: z.number().min(0).max(1),
    /** Starting relationship (−4…4). */
    start: z.number().int().min(-4).max(4),
  })
  .strict();
export type CastMember = z.infer<typeof CastMemberSchema>;

export const FocusDefSchema = z.object({ id: z.enum(FOCUSES), icon: z.string(), label: z.string(), hint: LifeTextSchema }).strict();
export type FocusDef = z.infer<typeof FocusDefSchema>;

export const LifeTitleSchema = z.object({ id: Id, label: z.string(), why: LifeTextSchema, when: LifeCondSchema.optional() }).strict();
export type LifeTitleDef = z.infer<typeof LifeTitleSchema>;

export const ChapterSetupSchema = z
  .object({
    startHome: z.string(),
    start: z.object({ money: z.number().int(), rep: z.number().int(), fame: z.number().int() }).strict(),
    dreams: z.array(DreamSchema).min(1),
    flaws: z.array(FlawSchema).min(1),
    careers: z.array(LifeCareerSchema).min(1),
    cast: z.array(CastMemberSchema).min(3),
    focuses: z.array(FocusDefSchema).min(1),
    titles: z.array(LifeTitleSchema).min(1),
  })
  .strict();
export type ChapterSetup = z.infer<typeof ChapterSetupSchema>;

export interface ChapterContent extends ChapterSetup {
  events: LifeEvent[];
  hash: string;
}

// ------------------------------------------------------------------ views (engine → UI)

export interface LifeChange {
  text: string;
  tone: "good" | "bad" | "warn";
}

export interface CastView {
  role: CastRole;
  id: string;
  name: string;
  trait: string;
  color: string;
  rel: number;
  relLabel: string;
  tone: "pos" | "neu" | "neg";
}

export interface LifeBoard {
  name: string;
  age: number;
  chapter: number;
  dream: { id: string; icon: string; label: string; note: string };
  flaw: { id: string; icon: string; label: string; note: string };
  career: { id: string; icon: string; label: string; color: string };
  job: string | null;
  home: string;
  partner: string;
  money: number;
  fame: number;
  rep: number;
  kids: number;
  years: (string | null)[];
  cast: CastView[];
  secrets: { text: string; left: number }[];
  mood: "good" | "ok" | "bad";
}

export interface ChoiceView {
  id: string;
  label: string;
  /** Chance it works, if not certain. */
  odds?: number;
  notes: string[];
  cast?: { name: string; relLabel: string };
  expertise?: boolean;
  mayBecomeSecret?: boolean;
}

export type LifeStep =
  | { kind: "intro"; cast: CastView[] }
  | { kind: "focus"; age: number; cards: { id: string; icon: string; label: string; hint: string }[] }
  | {
      kind: "event";
      age: number;
      eventId: string;
      eventKind: string;
      focusLabel: string;
      title: string;
      text: string;
      private?: string;
      /** A callback: someone in this event remembers what you did with them earlier. */
      recall?: { name: string; color: string; text: string };
      /** The finale: moments from earlier in your life flash before your eyes. */
      memories?: string[];
      factors?: { label: string; value: number }[];
      choices: ChoiceView[];
    }
  | {
      kind: "outcome";
      age: number;
      title: string;
      choiceLabel: string;
      roll?: { roll: number; odds: number; ok: boolean };
      flawKickedIn?: boolean;
      cast?: { name: string; color: string; did: string; tone: "good" | "bad" };
      text: string;
      emoji: string;
      changes: LifeChange[];
      next: string;
      finale: boolean;
    }
  | { kind: "done"; recap: ChapterRecap };

export interface LifeView {
  board: LifeBoard;
  step: LifeStep;
}

export interface ChapterRecap {
  mode: "chapters";
  name: string;
  career: string;
  title: { id: string; label: string; why: string };
  years: string[];
  dream: { id: string; icon: string; label: string; done: boolean };
  flaw: string;
  moments: { age: number; text: string }[];
  people: { role: CastRole; name: string; color: string; relLabel: string; helped: number; hurt: number }[];
  secretsKept: string[];
  factors: { label: string; value: number }[];
  callbacks: number;
  share: string;
}
