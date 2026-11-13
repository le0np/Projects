import {
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  type Attribute,
  type Career,
  type EventCategory,
  type RelationType,
  type Status,
} from "@lifesim/core";

export interface CharacterState {
  id: string;
  name: string;
  career: Career;
  isBot: boolean;
  attrs: Record<Attribute, number>;
  startAttrs: Record<Attribute, number>;
  status: Status;
  cause?: string;
  endedAt?: number;
  /** `key` or `key:<aboutId>`. */
  facts: Set<string>;
  /** Event template id → times taken part. */
  seen: Map<string, number>;
  busyWith: string | null;
  /** Earliest time the director may give this character a new event. */
  availableAt: number;
  lastCategory?: EventCategory;
  eventsCompleted: number;
}

export function factKey(key: string, about?: string): string {
  return about === undefined ? key : `${key}:${about}`;
}

export function clampAttr(v: number): number {
  return Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, v));
}

export interface Relation {
  type: RelationType;
  affinity: number;
  trust: number;
  /**
   * Type is locked (family, partner, or set by an event); automatic derivation leaves it alone.
   * Colleagues are not locked: they can become friends or rivals, and stay colleagues when neutral.
   */
  explicit: boolean;
  /** Event instance ids that touched this relation. */
  history: string[];
}

export const DEFAULT_RELATION: Readonly<Omit<Relation, "history">> = {
  type: "stranger",
  affinity: 0,
  trust: 40,
  explicit: false,
};

/**
 * Directed relationships: affinity and trust are per direction (A's feelings about B),
 * the type label is symmetric and kept identical in both directions.
 */
export class Relations {
  private readonly map = new Map<string, Relation>();

  private static key(a: string, b: string): string {
    return `${a}>${b}`;
  }

  get(a: string, b: string): Readonly<Relation> {
    return this.map.get(Relations.key(a, b)) ?? { ...DEFAULT_RELATION, history: [] };
  }

  ensure(a: string, b: string): Relation {
    const k = Relations.key(a, b);
    let rel = this.map.get(k);
    if (!rel) {
      rel = { ...DEFAULT_RELATION, history: [] };
      this.map.set(k, rel);
    }
    return rel;
  }

  setType(a: string, b: string, type: RelationType, explicit: boolean): void {
    for (const [x, y] of [
      [a, b],
      [b, a],
    ] as const) {
      const rel = this.ensure(x, y);
      rel.type = type;
      rel.explicit = explicit;
    }
  }

  /** Re-derive the symmetric type from the average affinity, unless it was set explicitly. */
  derive(a: string, b: string): void {
    const ab = this.ensure(a, b);
    const ba = this.ensure(b, a);
    if (ab.explicit) return;
    const avg = (ab.affinity + ba.affinity) / 2;
    let type: RelationType = ab.type;
    if (avg <= -60) type = "enemy";
    else if (avg <= -25) type = "rival";
    else if (avg >= 40) type = "friend";
    else if (type !== "stranger" && type !== "colleague") type = "acquaintance";
    ab.type = type;
    ba.type = type;
  }

  /** Taking part in the same event turns strangers into acquaintances. */
  meet(a: string, b: string, instanceId: string): void {
    for (const [x, y] of [
      [a, b],
      [b, a],
    ] as const) {
      const rel = this.ensure(x, y);
      if (rel.type === "stranger") rel.type = "acquaintance";
      if (rel.history[rel.history.length - 1] !== instanceId) rel.history.push(instanceId);
    }
  }
}
