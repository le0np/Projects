/**
 * T10: personal goals for a session (2 per character), checked as life goes on.
 * "ever" goals are done once reached, "end" goals count the state at the end,
 * "never" goals are done unless broken.
 */
import type { ChoiceTag, Goal, GoalCheck } from "@lifesim/core";
import type { CharacterState, Relations } from "./state";
import { factKey } from "./state";

export type GoalMode = "ever" | "end" | "never";

export function goalMode(check: GoalCheck): GoalMode {
  switch (check.type) {
    case "partner":
    case "friends":
    case "richer":
    case "attr_at_least":
    case "trusted":
      return "end";
    case "upheavals_unharmed":
    case "never_tag":
    case "clean_record":
      return "never";
    default:
      return "ever";
  }
}

/** What a character's life has done so far that goals look at (kept by the session). */
export interface GoalTrack {
  tags: Map<ChoiceTag, number>;
  sharedEvents: number;
  secretSchemes: number;
  caughtCulprits: number;
  oracleCorrect: number;
  /** Lowest health right after an upheaval (100 if none hit yet). */
  upheavalMinHealth: number;
}

export function newGoalTrack(): GoalTrack {
  return { tags: new Map(), sharedEvents: 0, secretSchemes: 0, caughtCulprits: 0, oracleCorrect: 0, upheavalMinHealth: 100 };
}

export interface GoalWorld {
  me: CharacterState;
  others: CharacterState[];
  relations: Relations;
  startTypes: ReadonlyMap<string, string>;
  age: number;
  track: GoalTrack;
}

/** Whether the goal's condition holds right now (for "never" goals: whether it is still unbroken). */
export function goalHolds(goal: Goal, w: GoalWorld): boolean {
  const c = goal.check;
  const rel = (o: CharacterState) => w.relations.get(w.me.id, o.id).type;
  switch (c.type) {
    case "owed_money":
      return w.others.filter((o) => o.facts.has(factKey("owes_money", w.me.id))).length >= c.n;
    case "career_gain_before_age":
      return w.age < c.age && w.me.attrs.career - w.me.startAttrs.career >= c.gain;
    case "stranger_to_friend":
      return w.others.some((o) => w.startTypes.get(o.id) === "stranger" && (rel(o) === "friend" || rel(o) === "partner"));
    case "upheavals_unharmed":
      return w.track.upheavalMinHealth >= c.minHealth;
    case "secret_scheme":
      return w.track.secretSchemes > 0;
    case "partner":
      return w.others.some((o) => o.status !== "dead" && rel(o) === "partner");
    case "friends":
      return w.others.filter((o) => rel(o) === "friend").length >= c.n;
    case "richer":
      return w.me.attrs.money - w.me.startAttrs.money >= c.gain;
    case "attr_at_least":
      return w.me.attrs[c.attribute] >= c.min;
    case "tag_count":
      return (w.track.tags.get(c.tag) ?? 0) >= c.n;
    case "never_tag":
      return (w.track.tags.get(c.tag) ?? 0) === 0;
    case "clean_record":
      return w.me.status === "active";
    case "oracle":
      return w.track.oracleCorrect >= c.n;
    case "shared_events":
      return w.track.sharedEvents >= c.n;
    case "rival":
      return w.others.some((o) => rel(o) === "rival" || rel(o) === "enemy");
    case "saved_someone":
      return w.others.some((o) => o.facts.has(factKey("saved_by", w.me.id)));
    case "caught_culprit":
      return w.track.caughtCulprits > 0;
    case "met":
      return w.others.filter((o) => rel(o) !== "stranger").length >= c.n;
    case "trusted": {
      const known = w.others.filter((o) => w.relations.get(o.id, w.me.id).type !== "stranger");
      if (known.length < 2) return false;
      return known.reduce((sum, o) => sum + w.relations.get(o.id, w.me.id).trust, 0) / known.length >= c.min;
    }
    default:
      return false;
  }
}
