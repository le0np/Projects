/**
 * Server-authoritative game session (pure, deterministic, no I/O).
 *
 * The host (simulator, test, later the WebSocket server) drives it:
 *   - `start()` once,
 *   - `submitDecision()` when a player or bot decides,
 *   - `processTimers()` whenever the clock reaches `nextWakeAt()`.
 * The session reports to characters through `onNotice` and records everything in `log`.
 *
 * Events run in parallel (decision D1): every character is in at most one event at a time.
 */
import {
  ATTRIBUTES,
  Rng,
  ageAt,
  calendarAt,
  TimerQueue,
  evaluate,
  type Attribute,
  type CharacterView,
  type Choice,
  type Clock,
  type Condition,
  type Effect,
  type EventDefinition,
  type LifeRecap,
  type Notice,
  type OfferView,
  type ParticipantInfo,
  type VisibleChoice,
} from "@lifesim/core";
import type { ContentBundle } from "@lifesim/content";
import type { SessionConfig } from "./config";
import { makeContext, type Bindings, type WorldView } from "./context";
import type { Change, EndReason, LogEntry } from "./log";
import { pickNames } from "./names";
import { computeRecaps, type CharacterTracking } from "./recap";
import { Relations, clampAttr, factKey, type CharacterState } from "./state";

export type SessionState = "initializing" | "active" | "completed" | "cancelled";

export interface ParticipantSpec {
  id?: string;
  name?: string;
  career: string;
  isBot: boolean;
}

export type PublicEntry =
  | { kind: "event"; t: number; instanceId: string; title: string; text: string; participants: ParticipantInfo[] }
  | { kind: "ended"; t: number; characterId: string; name: string; status: string; cause: string }
  | { kind: "season"; t: number; year: number; season: string };

export type SubmitResult = { ok: true } | { ok: false; reason: string };

export interface SessionStats {
  eventsStarted: number;
  eventsResolved: number;
  /** Times the director looked for an event for a free character and found none. */
  directorIdle: number;
  decisionsSubmitted: number;
  decisionsDefaulted: number;
  decisionsRejected: number;
  followUpsScheduled: number;
  followUpsActivated: number;
  followUpsDropped: Record<string, number>;
}

export interface SessionResult {
  sessionId: string;
  seed: string;
  contentHash: string;
  state: SessionState;
  endReason?: EndReason;
  durationMs: number;
  log: LogEntry[];
  recaps: LifeRecap[];
  stats: SessionStats;
}

interface Instance {
  id: string;
  ev: EventDefinition;
  bindings: Record<string, string[]>;
  roleOf: Map<string, string>;
  participants: string[];
  deciders: string[];
  offered: Map<string, VisibleChoice[]>;
  decisions: Map<string, { choiceId: string; defaulted: boolean }>;
  parentId?: string;
  startedAt: number;
  deadlineAt: number;
  deadlineTimer: number;
  resolved: boolean;
}

interface PendingFollowUp {
  seq: number;
  dueAt: number;
  eventId: string;
  preset: Record<string, string[]>;
  sourceInstanceId: string;
  sourceBindings: Bindings;
  condition?: Condition;
}

type Timer = { kind: "deadline"; instanceId: string } | { kind: "tick" } | { kind: "end" } | { kind: "season" };

const MS = 1000;

export class Session {
  readonly id: string;
  readonly config: SessionConfig;
  readonly content: ContentBundle;
  readonly log: LogEntry[] = [];
  readonly stats: SessionStats = {
    eventsStarted: 0,
    eventsResolved: 0,
    directorIdle: 0,
    decisionsSubmitted: 0,
    decisionsDefaulted: 0,
    decisionsRejected: 0,
    followUpsScheduled: 0,
    followUpsActivated: 0,
    followUpsDropped: {},
  };
  /** Delivery of per-character messages; set by the host. */
  onNotice: (characterId: string, notice: Notice) => void = () => {};
  /** Public feed for everyone in the session, including spectators (hidden events never appear). */
  onPublic: (entry: PublicEntry) => void = () => {};

  private _state: SessionState = "initializing";
  private endReason?: EndReason;
  private endedAt?: number;
  private recaps: LifeRecap[] = [];

  private readonly clock: Clock;
  private readonly characters = new Map<string, CharacterState>();
  private readonly order: string[] = [];
  private readonly relations = new Relations();
  private readonly sessionFacts = new Set<string>();
  private readonly instances = new Map<string, Instance>();
  private readonly running = new Set<string>();
  private pending: PendingFollowUp[] = [];
  private readonly timers = new TimerQueue<Timer>();
  private readonly tickTimes = new Set<number>();
  /** Pending idle-retry tick; there is at most one retry chain. */
  private retryAt: number | undefined;
  private readonly eventStarts = new Map<string, { count: number; lastAt: number }>();
  private readonly directorEvents: EventDefinition[];
  private readonly tracking = new Map<string, CharacterTracking>();
  private accepting = true;
  private storyResolved = false;
  private instanceSeq = 0;
  private pendingSeq = 0;

  private readonly rngInit: Rng;
  private readonly rngSelect: Rng;
  private readonly rngOutcome: Rng;
  private readonly rngTiming: Rng;

  constructor(content: ContentBundle, config: SessionConfig, participants: readonly ParticipantSpec[], clock: Clock) {
    if (participants.length < 1 || participants.length > 8) {
      throw new RangeError(`a session needs 1–8 participants, got ${participants.length}`);
    }
    this.content = content;
    this.config = config;
    this.clock = clock;
    const root = new Rng(config.seed);
    this.id = `S-${root.fork("id").nextUint32().toString(36).toUpperCase()}`;
    this.rngInit = root.fork("init");
    this.rngSelect = root.fork("selection");
    this.rngOutcome = root.fork("outcomes");
    this.rngTiming = root.fork("timing");
    this.directorEvents = [...content.events.values()]
      .filter((e) => e.trigger === "director" && e.weight > 0)
      .sort((a, b) => a.id.localeCompare(b.id));
    this.createCharacters(participants);
  }

  get state(): SessionState {
    return this._state;
  }

  /** Time of the next timer the host must process, if any. */
  nextWakeAt(): number | undefined {
    return this.timers.nextAt();
  }

  // ================================================================== lifecycle

  start(): void {
    if (this._state !== "initializing") throw new Error(`cannot start a session in state ${this._state}`);
    const relations = this.createStartingRelations();
    this.log.push({
      t: this.now(),
      type: "session_started",
      sessionId: this.id,
      seed: this.config.seed,
      contentHash: this.content.hash,
      config: this.config,
      characters: this.order.map((id) => {
        const c = this.char(id);
        return { id, name: c.name, career: c.career.id, isBot: c.isBot, attrs: { ...c.attrs } };
      }),
      relations,
    });
    this._state = "active";
    this.timers.push(this.config.durationSeconds * MS, { kind: "end" });
    this.scheduleNextSeason();
    for (const id of this.order) this.scheduleTick(this.char(id).availableAt);
  }

  /** Process all timers due at the current clock time. */
  processTimers(): void {
    for (const timer of this.timers.popDue(this.now())) {
      if (this._state !== "active") return;
      switch (timer.kind) {
        case "deadline":
          this.onDeadline(timer.instanceId);
          break;
        case "tick":
          this.tickTimes.delete(this.now());
          if (this.retryAt !== undefined && this.retryAt <= this.now()) this.retryAt = undefined;
          this.fillIdle();
          break;
        case "season":
          this.onSeason();
          break;
        case "end":
          this.accepting = false;
          this.endReason ??= "time_limit";
          this.maybeComplete();
          break;
      }
    }
  }

  /** Season boundaries every quarter year; at each new year everyone ages (concept v2 §3). */
  private scheduleNextSeason(): void {
    const quarter = (this.config.yearSeconds * MS) / 4;
    const next = (Math.floor(this.now() / quarter) + 1) * quarter;
    if (next < this.config.durationSeconds * MS) this.timers.push(next, { kind: "season" });
  }

  private onSeason(): void {
    const { year, season } = calendarAt(this.now(), this.config.yearSeconds * MS);
    this.log.push({ t: this.now(), type: "season_changed", year, season });
    this.onPublic({ kind: "season", t: this.now(), year, season });
    if (season === "spring") {
      const changes: Change[] = [];
      for (const id of this.order) {
        const c = this.char(id);
        if (c.status !== "active" || this.age(id) <= this.config.aging.fromAge) continue;
        c.attrs.health = clampAttr(c.attrs.health - this.config.aging.healthPerYear);
        if (c.attrs.health <= 0 && c.busyWith === null) {
          this.setStatus(c, "dead", `Worn out by the years, at ${this.age(id)}`, changes);
          this.log.push({ t: this.now(), type: "character_ended", characterId: id, status: "dead", cause: c.cause ?? "" });
          this.onNotice(id, { kind: "ended", t: this.now(), status: "dead", cause: c.cause ?? "" });
        }
      }
      if (this.order.every((id) => this.char(id).status !== "active")) {
        this.accepting = false;
        this.endReason = "all_ended";
        this.maybeComplete();
      }
    }
    this.scheduleNextSeason();
  }

  private age(id: string): number {
    const c = this.char(id);
    return ageAt(this.config.startAge, c.endedAt ?? this.now(), this.config.yearSeconds * MS);
  }

  cancel(): void {
    if (this._state === "completed" || this._state === "cancelled") return;
    this.finish("cancelled", "cancelled");
  }

  result(): SessionResult {
    return {
      sessionId: this.id,
      seed: this.config.seed,
      contentHash: this.content.hash,
      state: this._state,
      endReason: this.endReason,
      durationMs: (this.endedAt ?? this.now()),
      log: this.log,
      recaps: this.recaps,
      stats: this.stats,
    };
  }

  // ================================================================== decisions

  /** The single entry point for decisions from humans and bots alike (TECHNICAL_ARCHITECTURE §6). */
  submitDecision(characterId: string, instanceId: string, choiceId: string): SubmitResult {
    const reject = (reason: string): SubmitResult => {
      this.stats.decisionsRejected++;
      this.log.push({ t: this.now(), type: "decision_rejected", instanceId, characterId, choiceId, reason });
      return { ok: false, reason };
    };
    if (this._state !== "active") return reject("session is not active");
    const inst = this.instances.get(instanceId);
    if (!inst) return reject("unknown event");
    if (inst.resolved) return reject("event already resolved");
    if (!inst.deciders.includes(characterId)) return reject("character does not decide in this event");
    if (inst.decisions.has(characterId)) return reject("decision already submitted");
    if (!inst.offered.get(characterId)?.some((c) => c.id === choiceId)) return reject("choice not available");

    inst.decisions.set(characterId, { choiceId, defaulted: false });
    this.stats.decisionsSubmitted++;
    const label = inst.offered.get(characterId)?.find((c) => c.id === choiceId)?.label ?? choiceId;
    this.log.push({ t: this.now(), type: "decision", instanceId, characterId, choiceId, label, source: "player" });
    if (inst.decisions.size === inst.deciders.length) {
      this.resolve(inst);
      this.afterResolution();
    }
    return { ok: true };
  }

  private onDeadline(instanceId: string): void {
    const inst = this.instances.get(instanceId);
    if (!inst || inst.resolved) return;
    for (const id of inst.deciders) {
      if (inst.decisions.has(id)) continue;
      const def = inst.offered.get(id)?.find((c) => c.isDefault);
      if (!def) throw new Error(`no default choice for ${id} in ${inst.ev.id}`);
      inst.decisions.set(id, { choiceId: def.id, defaulted: true });
      this.stats.decisionsDefaulted++;
      this.log.push({ t: this.now(), type: "decision", instanceId, characterId: id, choiceId: def.id, label: def.label, source: "default" });
    }
    this.resolve(inst);
    this.afterResolution();
  }

  // ================================================================== setup

  private createCharacters(participants: readonly ParticipantSpec[]): void {
    const names = pickNames(participants.length, this.rngInit);
    const initFacts = [...this.content.facts.values()].filter((f) => f.setAtInit).map((f) => f.key);
    const [d0, d1] = this.config.initialDelaySeconds;
    participants.forEach((p, i) => {
      const career = this.content.careers.get(p.career);
      if (!career) throw new Error(`unknown career "${p.career}"`);
      const id = p.id ?? `c${i + 1}`;
      if (this.characters.has(id)) throw new Error(`duplicate character id "${id}"`);
      const attrs = {} as Record<Attribute, number>;
      for (const a of ATTRIBUTES) {
        const v = this.config.attributeVariation;
        attrs[a] = this.config.baseAttributes[a] + this.rngInit.int(-v, v);
      }
      for (const ability of career.abilities) {
        for (const m of ability.modifiers) if (m.type === "start_bonus") attrs[m.attribute] += m.amount;
      }
      for (const a of ATTRIBUTES) attrs[a] = clampAttr(attrs[a]);
      this.characters.set(id, {
        id,
        name: p.name ?? (names[i] as string),
        career,
        isBot: p.isBot,
        attrs,
        startAttrs: { ...attrs },
        status: "active",
        facts: new Set(initFacts),
        seen: new Map(),
        busyWith: null,
        availableAt: Math.round(this.rngTiming.range(d0, d1) * MS),
        eventsCompleted: 0,
      });
      this.order.push(id);
      this.tracking.set(id, { keyMoments: [], influence: new Map(), startTypes: new Map() });
    });
  }

  /** Decision D3: some characters start as colleagues, family or partners. */
  private createStartingRelations(): { a: string; b: string; type: "colleague" | "family" | "partner" }[] {
    const out: { a: string; b: string; type: "colleague" | "family" | "partner" }[] = [];
    const cfg = this.config.startingRelationships;
    const taken = new Set<string>();
    const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    const randomPair = (): [string, string] | null => {
      for (let attempt = 0; attempt < 20; attempt++) {
        const [a, b] = this.rngInit.shuffle(this.order) as [string, string];
        if (a && b && !taken.has(pairKey(a, b))) return [a, b];
      }
      return null;
    };
    const add = (type: "colleague" | "family" | "partner", affinity: number, trust: number) => {
      const pair = randomPair();
      if (!pair) return;
      const [a, b] = pair;
      taken.add(pairKey(a, b));
      this.relations.setType(a, b, type, type !== "colleague");
      for (const [x, y] of [pair, [b, a] as const]) {
        const rel = this.relations.ensure(x, y);
        rel.affinity = affinity;
        rel.trust = trust;
      }
      out.push({ a, b, type });
    };
    if (this.order.length >= 2) {
      const colleagues = Math.round(this.order.length * cfg.colleaguePairRatio);
      for (let i = 0; i < colleagues; i++) add("colleague", 10, 55);
      if (this.rngInit.chance(cfg.familyChance)) add("family", 40, 70);
      if (this.rngInit.chance(cfg.partnerChance)) add("partner", 60, 75);
    }
    for (const a of this.order) {
      const t = this.tracking.get(a) as CharacterTracking;
      for (const b of this.order) if (a !== b) t.startTypes.set(b, this.relations.get(a, b).type);
    }
    return out;
  }

  // ================================================================== director

  private fillIdle(): void {
    if (this._state !== "active" || !this.accepting) return;
    this.activateFollowUps();

    const free = this.rngSelect.shuffle(this.order.filter((id) => this.isFree(id)));
    for (const anchor of free) {
      if (!this.isFree(anchor)) continue; // grabbed by an earlier event in this loop
      const candidates: { ev: EventDefinition; bindings: Record<string, string[]>; weight: number }[] = [];
      for (const ev of this.directorEvents) {
        if (!this.cooldownOk(ev, true)) continue;
        const pool = this.rngSelect.shuffle(this.order.filter((id) => id !== anchor && this.isFree(id)));
        const bindings = this.bind(ev, anchor, pool, {});
        if (bindings) candidates.push({ ev, bindings, weight: this.weight(ev, anchor, bindings) });
      }
      const pick = this.rngSelect.weighted(candidates, (c) => c.weight);
      if (!pick) {
        this.stats.directorIdle++;
        this.scheduleRetry();
        continue;
      }
      this.startInstance(pick.ev, pick.bindings);
    }
  }

  private isFree(id: string): boolean {
    const c = this.char(id);
    return c.status === "active" && c.busyWith === null && c.availableAt <= this.now();
  }

  private cooldownOk(ev: EventDefinition, director: boolean): boolean {
    const s = this.eventStarts.get(ev.id);
    if (!s) return true;
    if (ev.cooldown.maxPerSession !== undefined && s.count >= ev.cooldown.maxPerSession) return false;
    if (director && ev.cooldown.minGapSeconds !== undefined && this.now() - s.lastAt < ev.cooldown.minGapSeconds * MS) {
      return false;
    }
    return true;
  }

  /**
   * Greedy role binding in declaration order. With an `anchor`, tries each role the
   * anchor could take; `preset` roles (follow-ups) are fixed. Returns null if no valid binding.
   */
  private bind(
    ev: EventDefinition,
    anchor: string | null,
    pool: readonly string[],
    preset: Record<string, string[]>,
  ): Record<string, string[]> | null {
    const roles = Object.keys(ev.roles);
    const anchorRoles: (string | null)[] = anchor ? this.rngSelect.shuffle(roles.filter((r) => !preset[r])) : [null];
    for (const anchorRole of anchorRoles) {
      const bindings: Record<string, string[]> = { ...preset };
      const used = new Set<string>(Object.values(preset).flat());
      if (anchor) used.add(anchor);
      let ok = true;
      for (const role of roles) {
        if (preset[role]) continue;
        const def = ev.roles[role]!;
        const [min, max] = typeof def.count === "number" ? [def.count, def.count] : def.count;
        const target = this.rngSelect.int(min, max);
        const fits = (id: string) => {
          const c = this.char(id);
          if (c.status !== "active") return false;
          if (def.careers && !def.careers.includes(c.career.id)) return false;
          const max = ev.cooldown.maxPerCharacter;
          if (max !== undefined && (c.seen.get(ev.id) ?? 0) >= max) return false;
          return !def.conditions || evaluate(def.conditions, makeContext(this.world, bindings, id));
        };
        const members: string[] = [];
        if (role === anchorRole) {
          if (!fits(anchor as string)) {
            ok = false;
            break;
          }
          members.push(anchor as string);
        }
        for (const id of pool) {
          if (members.length >= target) break;
          if (used.has(id) || !fits(id)) continue;
          members.push(id);
          used.add(id);
        }
        if (members.length < min) {
          ok = false;
          break;
        }
        bindings[role] = members;
      }
      if (!ok) continue;
      if (ev.conditions && !evaluate(ev.conditions, makeContext(this.world, bindings))) continue;
      return bindings;
    }
    return null;
  }

  /** Contextual selection weight (EVENT_SYSTEM §5). */
  private weight(ev: EventDefinition, anchor: string, bindings: Record<string, string[]>): number {
    const c = this.char(anchor);
    let w = ev.weight;
    for (const ability of c.career.abilities) {
      for (const m of ability.modifiers) {
        if (m.type !== "selection_weight") continue;
        const byCategory = m.categories?.includes(ev.category) ?? false;
        const byTag = m.tags?.some((t) => ev.tags?.includes(t)) ?? false;
        if (byCategory || byTag) w *= m.factor;
      }
    }
    w *= 0.35 ** (c.seen.get(ev.id) ?? 0);
    if (c.lastCategory === ev.category) w *= 0.5;
    const others = Object.values(bindings).flat().filter((id) => id !== anchor);
    if (others.some((o) => this.relations.get(anchor, o).type !== "stranger")) w *= 1.5;
    if (ev.category === "critical") w *= 0.4 + this.progress();
    return w;
  }

  private activateFollowUps(): void {
    const keep: PendingFollowUp[] = [];
    for (const p of this.pending) {
      if (p.dueAt > this.now()) {
        keep.push(p);
        continue;
      }
      const ev = this.content.events.get(p.eventId) as EventDefinition;
      const mapped = Object.values(p.preset).flat();
      const drop = (reason: string) => this.dropFollowUp(p, reason);
      if (mapped.some((id) => this.char(id).status !== "active")) {
        drop("participant_unavailable");
        continue;
      }
      if (!this.cooldownOk(ev, false)) {
        drop("cooldown");
        continue;
      }
      if (p.condition && !evaluate(p.condition, makeContext(this.world, p.sourceBindings))) {
        drop("condition_failed");
        continue;
      }
      const expired = this.now() - p.dueAt > this.config.followUpMaxWaitSeconds * MS;
      if (mapped.some((id) => !this.isFree(id))) {
        if (expired) drop("participants_busy");
        else keep.push(p);
        continue;
      }
      const pool = this.rngSelect.shuffle(this.order.filter((id) => !mapped.includes(id) && this.isFree(id)));
      const bindings = this.bind(ev, null, pool, p.preset);
      if (!bindings) {
        if (expired) drop("no_valid_binding");
        else keep.push(p);
        continue;
      }
      const inst = this.startInstance(ev, bindings, p.sourceInstanceId);
      this.stats.followUpsActivated++;
      this.log.push({ t: this.now(), type: "followup_activated", sourceInstanceId: p.sourceInstanceId, eventId: ev.id, instanceId: inst.id });
    }
    this.pending = keep;
    // Waiting follow-ups need a retry even if no character frees up.
    if (keep.length > 0) {
      if (keep.some((p) => p.dueAt <= this.now())) this.scheduleRetry();
      else this.scheduleTick(Math.min(...keep.map((p) => p.dueAt)));
    }
  }

  private dropFollowUp(p: PendingFollowUp, reason: string): void {
    this.stats.followUpsDropped[reason] = (this.stats.followUpsDropped[reason] ?? 0) + 1;
    this.log.push({ t: this.now(), type: "followup_dropped", sourceInstanceId: p.sourceInstanceId, eventId: p.eventId, reason });
  }

  // ================================================================== instances

  private startInstance(ev: EventDefinition, bindings: Record<string, string[]>, parentId?: string): Instance {
    const id = `E${++this.instanceSeq}`;
    const roleOf = new Map<string, string>();
    for (const [role, ids] of Object.entries(bindings)) for (const c of ids) roleOf.set(c, role);
    const participants = [...roleOf.keys()];
    const deciders = participants.filter((c) => (ev.choices[roleOf.get(c) as string]?.length ?? 0) > 0);
    const [lo, hi] = ev.durationSeconds !== undefined ? [ev.durationSeconds, ev.durationSeconds] : this.config.deadlines[ev.importance];
    const deadlineAt = this.now() + this.rngTiming.int(lo, hi) * MS;
    const inst: Instance = {
      id,
      ev,
      bindings,
      roleOf,
      participants,
      deciders,
      offered: new Map(),
      decisions: new Map(),
      parentId,
      startedAt: this.now(),
      deadlineAt,
      deadlineTimer: this.timers.push(deadlineAt, { kind: "deadline", instanceId: id }),
      resolved: false,
    };
    this.instances.set(id, inst);
    this.running.add(id);
    const s = this.eventStarts.get(ev.id) ?? { count: 0, lastAt: 0 };
    this.eventStarts.set(ev.id, { count: s.count + 1, lastAt: this.now() });
    this.stats.eventsStarted++;

    for (const c of participants) {
      const ch = this.char(c);
      ch.busyWith = id;
      ch.seen.set(ev.id, (ch.seen.get(ev.id) ?? 0) + 1);
      inst.offered.set(c, this.visibleChoices(inst, c));
    }
    this.log.push({
      t: this.now(),
      type: "event_started",
      instanceId: id,
      eventId: ev.id,
      version: ev.version,
      title: ev.title,
      bindings,
      parentInstanceId: parentId,
      deadlineAt,
    });
    if (!ev.hidden) {
      this.onPublic({
        kind: "event",
        t: this.now(),
        instanceId: id,
        title: this.interpolate(ev.title, bindings),
        text: this.interpolate(ev.text.public, bindings),
        participants: participants.map((c) => ({ characterId: c, name: this.char(c).name, role: roleOf.get(c) as string })),
      });
    }
    for (const c of participants) {
      if (ev.roles[roleOf.get(c) as string]?.aware === false) continue; // involved without knowing it
      this.onNotice(c, { kind: "event", t: this.now(), view: this.view(c, inst) });
    }
    return inst;
  }

  private visibleChoices(inst: Instance, characterId: string): VisibleChoice[] {
    const role = inst.roleOf.get(characterId) as string;
    const career = this.char(characterId).career.id;
    return (inst.ev.choices[role] ?? [])
      .filter((c) => !c.careers || c.careers.includes(career))
      .filter((c) => !c.condition || evaluate(c.condition, makeContext(this.world, inst.bindings, characterId)))
      .map((c) => {
        const insight = c.insight?.careers.includes(career) ? c.insight : undefined;
        const perceived = insight
          ? {
              ...c.perceived,
              ...insight.perceived,
              relation: { ...c.perceived?.relation, ...insight.perceived.relation },
            }
          : { ...c.perceived };
        return {
          id: c.id,
          label: this.interpolate(c.label, inst.bindings),
          tags: [...c.tags],
          perceived,
          ...(insight?.note ? { note: insight.note } : {}),
          special: c.careers !== undefined,
          isDefault: c.default === true,
        };
      });
  }

  /** The projection a character is allowed to see (BOT_SYSTEM §8). */
  private view(characterId: string, inst: Instance): CharacterView {
    const self = this.char(characterId);
    const role = inst.roleOf.get(characterId) as string;
    const participants: ParticipantInfo[] = inst.participants.map((c) => ({
      characterId: c,
      name: this.char(c).name,
      role: inst.roleOf.get(c) as string,
    }));
    const privateText = inst.ev.text.private?.[role];
    const offer: OfferView = {
      instanceId: inst.id,
      eventId: inst.ev.id,
      title: this.interpolate(inst.ev.title, inst.bindings),
      category: inst.ev.category,
      importance: inst.ev.importance,
      offeredAt: inst.startedAt,
      deadlineAt: inst.deadlineAt,
      role,
      participants,
      publicText: this.interpolate(inst.ev.text.public, inst.bindings),
      ...(privateText ? { privateText: this.interpolate(privateText, inst.bindings) } : {}),
      choices: structuredClone(inst.offered.get(characterId) ?? []),
    };
    return {
      now: this.now(),
      sessionProgress: this.progress(),
      calendar: (({ year, season }) => ({ year, season }))(calendarAt(this.now(), this.config.yearSeconds * MS)),
      self: {
        id: self.id,
        name: self.name,
        career: self.career.id,
        age: this.age(characterId),
        attrs: { ...self.attrs },
        status: self.status,
        facts: [...self.facts].sort(),
      },
      others: this.order
        .filter((id) => id !== characterId)
        .map((id) => {
          const o = this.char(id);
          const r = this.relations.get(characterId, id);
          return { id, name: o.name, career: o.career.id, status: o.status, relation: { type: r.type, affinity: r.affinity, trust: r.trust } };
        }),
      offer,
    };
  }

  // ================================================================== resolution

  private resolve(inst: Instance): void {
    inst.resolved = true;
    this.timers.cancel(inst.deadlineTimer);
    this.running.delete(inst.id);
    const ev = inst.ev;
    const changes: Change[] = [];

    // 1. Per-chooser choice effects (self = chooser).
    for (const id of inst.deciders) {
      const choice = this.choiceDef(inst, id);
      for (const effect of choice.effects ?? []) this.applyEffect(effect, inst, changes, id);
    }

    // 2. First matching outcome.
    const choicesOf = (role: string) => (inst.bindings[role] ?? []).map((id) => inst.decisions.get(id)?.choiceId ?? "");
    const ctx = makeContext(this.world, inst.bindings, undefined, choicesOf);
    const outcome =
      ev.outcomes.find(
        (o) => (o.when === undefined || evaluate(o.when, ctx)) && (o.chance === undefined || this.rngOutcome.chance(o.chance)),
      ) ?? (ev.outcomes[ev.outcomes.length - 1] as (typeof ev.outcomes)[number]);
    for (const effect of outcome.effects ?? []) this.applyEffect(effect, inst, changes);

    // 3. Taking part together makes people acquainted.
    for (const a of inst.participants) for (const b of inst.participants) if (a < b) this.relations.meet(a, b, inst.id);

    // 4. Health or mental condition at zero ends the story.
    for (const id of inst.participants) {
      const c = this.char(id);
      if (c.status !== "active") continue;
      if (c.attrs.health <= 0) this.setStatus(c, "dead", `Health gave out during "${ev.title}"`, changes);
      else if (c.attrs.mental <= 0) this.setStatus(c, "hospitalized", `Mental breakdown during "${ev.title}"`, changes);
    }

    // 5. Follow-ups.
    for (const fu of outcome.followUps ?? []) {
      if (fu.chance !== undefined && !this.rngOutcome.chance(fu.chance)) continue;
      const [d0, d1] = fu.delaySeconds === undefined ? [0, 0] : typeof fu.delaySeconds === "number" ? [fu.delaySeconds, fu.delaySeconds] : fu.delaySeconds;
      const dueAt = this.now() + Math.round(this.rngTiming.range(d0, d1 + 1e-9) * MS);
      const preset: Record<string, string[]> = {};
      for (const [targetRole, ref] of Object.entries(fu.roles)) preset[targetRole] = [...(inst.bindings[ref.slice(5)] ?? [])];
      this.pending.push({
        seq: ++this.pendingSeq,
        dueAt,
        eventId: fu.event,
        preset,
        sourceInstanceId: inst.id,
        sourceBindings: inst.bindings,
        condition: fu.condition,
      });
      this.pending.sort((a, b) => a.dueAt - b.dueAt || a.seq - b.seq);
      this.stats.followUpsScheduled++;
      this.log.push({ t: this.now(), type: "followup_scheduled", sourceInstanceId: inst.id, eventId: fu.event, dueAt });
      this.scheduleTick(dueAt);
    }

    if (outcome.endsSession) this.storyResolved = true;
    this.stats.eventsResolved++;
    this.log.push({ t: this.now(), type: "event_resolved", instanceId: inst.id, eventId: ev.id, outcomeId: outcome.id, changes });

    // 6. Tracking for the Life Recap, notices, and freeing the participants.
    const important = outcome.important === true || ev.importance === "important";
    for (const id of inst.participants) {
      const c = this.char(id);
      const role = inst.roleOf.get(id) as string;
      const decision = inst.decisions.get(id);
      const choice = decision ? this.choiceDef(inst, id) : undefined;
      const text = outcome.text?.[role] ? this.interpolate(outcome.text[role], inst.bindings) : undefined;
      const track = this.tracking.get(id) as CharacterTracking;

      if (important) {
        track.keyMoments.push({
          t: this.now(),
          instanceId: inst.id,
          eventTitle: this.interpolate(ev.title, inst.bindings),
          ...(choice ? { choiceLabel: this.interpolate(choice.label, inst.bindings), choiceTags: [...choice.tags] } : {}),
          ...(text ? { text } : {}),
        });
      }
      const selfChanges: Partial<Record<Attribute, number>> = {};
      let impact = 0;
      for (const ch of changes) {
        if (ch.kind === "attr" && ch.characterId === id) {
          selfChanges[ch.attribute] = (selfChanges[ch.attribute] ?? 0) + ch.delta;
          impact += Math.abs(ch.delta);
        }
      }
      if (impact > 0) {
        for (const other of inst.deciders) {
          if (other === id) continue;
          const inf = track.influence.get(other) ?? { events: 0, impact: 0 };
          track.influence.set(other, { events: inf.events + 1, impact: inf.impact + impact });
        }
      }

      c.busyWith = null;
      c.lastCategory = ev.category;
      c.eventsCompleted++;
      const [r0, r1] = this.config.restSeconds;
      c.availableAt = this.now() + Math.round(this.rngTiming.range(r0, r1) * MS);
      if (c.status === "active") this.scheduleTick(c.availableAt);

      this.onNotice(id, {
        kind: "resolved",
        t: this.now(),
        instanceId: inst.id,
        eventId: ev.id,
        title: this.interpolate(ev.title, inst.bindings),
        role,
        participants: inst.participants.map((p) => ({ characterId: p, name: this.char(p).name, role: inst.roleOf.get(p) as string })),
        ...(choice && decision
          ? { myChoice: { id: choice.id, label: this.interpolate(choice.label, inst.bindings), tags: [...choice.tags], defaulted: decision.defaulted } }
          : {}),
        revealed: outcome.revealChoices
          ? inst.deciders
              .filter((d) => d !== id)
              .map((d) => {
                const ch = this.choiceDef(inst, d);
                return {
                  characterId: d,
                  role: inst.roleOf.get(d) as string,
                  choiceId: ch.id,
                  label: this.interpolate(ch.label, inst.bindings),
                  tags: [...ch.tags],
                };
              })
          : [],
        ...(text ? { outcomeText: text } : {}),
        selfChanges,
      });
    }
    for (const ch of changes) {
      if (ch.kind === "status" && ch.status !== "active") {
        this.log.push({ t: this.now(), type: "character_ended", characterId: ch.characterId, status: ch.status, cause: ch.cause });
        this.onNotice(ch.characterId, { kind: "ended", t: this.now(), status: ch.status, cause: ch.cause });
        this.onPublic({ kind: "ended", t: this.now(), characterId: ch.characterId, name: this.char(ch.characterId).name, status: ch.status, cause: ch.cause });
      }
    }
  }

  private afterResolution(): void {
    if (this.storyResolved && this.accepting) {
      this.accepting = false;
      this.endReason = "story_resolved";
    }
    if (this.order.every((id) => this.char(id).status !== "active")) {
      this.accepting = false;
      this.endReason = "all_ended";
    }
    if (!this.maybeComplete()) this.fillIdle();
  }

  private maybeComplete(): boolean {
    if (this.accepting || this.running.size > 0) return false;
    this.finish("completed", this.endReason ?? "time_limit");
    return true;
  }

  private finish(state: "completed" | "cancelled", reason: EndReason): void {
    this.endReason = reason;
    this.endedAt = this.now();
    for (const id of [...this.running]) {
      const inst = this.instances.get(id) as Instance;
      inst.resolved = true;
      this.timers.cancel(inst.deadlineTimer);
      this.running.delete(id);
    }
    for (const p of this.pending) this.dropFollowUp(p, "session_ended");
    this.pending = [];
    this._state = state;
    this.log.push({ t: this.now(), type: "session_completed", reason });
    this.recaps = computeRecaps({
      characters: this.order.map((id) => this.char(id)),
      relations: this.relations,
      tracking: this.tracking,
      facts: this.content.facts,
      sessionDurationMs: this.now(),
      ageAt: (t) => ageAt(this.config.startAge, t, this.config.yearSeconds * MS),
    });
    for (const recap of this.recaps) {
      this.onNotice(recap.characterId, { kind: "session_completed", t: this.now(), recap });
    }
  }

  // ================================================================== effects

  private applyEffect(effect: Effect, inst: Instance, changes: Change[], self?: string): void {
    const resolve = (ref: string): string[] => {
      if (ref === "self") return self === undefined ? [] : [self];
      if (ref.startsWith("role:")) return [...(inst.bindings[ref.slice(5)] ?? [])];
      return [];
    };
    switch (effect.type) {
      case "attr":
        for (const id of resolve(effect.target)) {
          const c = this.char(id);
          for (const [attribute, raw] of Object.entries(effect.delta) as [Attribute, number][]) {
            const before = c.attrs[attribute];
            c.attrs[attribute] = clampAttr(before + this.scaleDelta(c, attribute, raw, inst.ev));
            const delta = c.attrs[attribute] - before;
            if (delta !== 0) changes.push({ kind: "attr", characterId: id, attribute, delta, value: c.attrs[attribute] });
          }
        }
        break;
      case "relation":
        for (const a of resolve(effect.from)) {
          for (const b of resolve(effect.to)) {
            if (a === b) continue;
            const pairs: [string, string][] = effect.mutual ? [[a, b], [b, a]] : [[a, b]];
            for (const [x, y] of pairs) {
              const rel = this.relations.ensure(x, y);
              rel.affinity = Math.max(-100, Math.min(100, rel.affinity + (effect.affinity ?? 0)));
              rel.trust = Math.max(0, Math.min(100, rel.trust + (effect.trust ?? 0)));
              if (rel.history[rel.history.length - 1] !== inst.id) rel.history.push(inst.id);
            }
            if (effect.setType) this.relations.setType(a, b, effect.setType, true);
            else this.relations.derive(a, b);
            for (const [x, y] of pairs) {
              const rel = this.relations.get(x, y);
              changes.push({ kind: "relation", from: x, to: y, affinity: rel.affinity, trust: rel.trust, type: rel.type });
            }
          }
        }
        break;
      case "fact": {
        if (effect.target === "session") {
          if (effect.remove) this.sessionFacts.delete(effect.key);
          else this.sessionFacts.add(effect.key);
          changes.push({ kind: "fact", target: "session", key: effect.key, removed: effect.remove === true });
          break;
        }
        const abouts = effect.about === undefined ? [undefined] : resolve(effect.about);
        for (const id of resolve(effect.target)) {
          for (const about of abouts) {
            if (about === id) continue;
            const facts = this.char(id).facts;
            const key = factKey(effect.key, about);
            if (effect.remove) facts.delete(key);
            else facts.add(key);
            changes.push({ kind: "fact", target: id, key: effect.key, ...(about ? { about } : {}), removed: effect.remove === true });
          }
        }
        break;
      }
      case "status":
        for (const id of resolve(effect.target)) this.setStatus(this.char(id), effect.status, effect.cause, changes);
        break;
    }
  }

  /** Career abilities scale attribute changes (e.g. doctors lose less health in health events). */
  private scaleDelta(c: CharacterState, attribute: Attribute, delta: number, ev: EventDefinition): number {
    let factor = 1;
    for (const ability of c.career.abilities) {
      for (const m of ability.modifiers) {
        if (m.type !== "effect_multiplier" || m.attribute !== attribute) continue;
        if (m.direction === "loss" ? delta >= 0 : delta <= 0) continue;
        if (m.categories && !m.categories.includes(ev.category)) continue;
        factor *= m.factor;
      }
    }
    return Math.round(delta * factor);
  }

  private setStatus(c: CharacterState, status: CharacterState["status"], cause: string, changes: Change[]): void {
    if (c.status === status) return;
    c.status = status;
    c.cause = cause;
    if (status !== "active") c.endedAt = this.now();
    changes.push({ kind: "status", characterId: c.id, status, cause });
  }

  // ================================================================== helpers

  private choiceDef(inst: Instance, characterId: string): Choice {
    const role = inst.roleOf.get(characterId) as string;
    const id = inst.decisions.get(characterId)?.choiceId;
    const choice = inst.ev.choices[role]?.find((c) => c.id === id);
    if (!choice) throw new Error(`no decision for ${characterId} in ${inst.id}`);
    return choice;
  }

  private interpolate(text: string, bindings: Record<string, string[]>): string {
    return text.replace(/\{([a-z][a-z0-9_]*)\}/g, (m, role: string) => {
      const ids = bindings[role];
      return ids ? ids.map((id) => this.char(id).name).join(" and ") : m;
    });
  }

  private scheduleRetry(): void {
    if (this.retryAt !== undefined && this.retryAt > this.now()) return;
    this.retryAt = this.now() + this.config.idleRetrySeconds * MS;
    this.scheduleTick(this.retryAt);
  }

  private scheduleTick(at: number): void {
    const t = Math.max(at, this.now());
    if (this.tickTimes.has(t)) return;
    this.tickTimes.add(t);
    this.timers.push(t, { kind: "tick" });
  }

  private char(id: string): CharacterState {
    const c = this.characters.get(id);
    if (!c) throw new Error(`unknown character ${id}`);
    return c;
  }

  private now(): number {
    return this.clock.now();
  }

  private progress(): number {
    return Math.min(1, this.now() / (this.config.durationSeconds * MS));
  }

  private get world(): WorldView {
    return {
      characters: this.characters,
      relations: this.relations,
      sessionFacts: this.sessionFacts,
      progress: () => this.progress(),
      age: (id) => this.age(id),
      season: () => calendarAt(this.now(), this.config.yearSeconds * MS).season,
    };
  }
}
