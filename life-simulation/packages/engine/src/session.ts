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
  manhattan,
  type LocationKind,
  type MischiefState,
  type PlaceKind,
  type TilePos,
  TimerQueue,
  evaluate,
  walkCondition,
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
  type Reaction,
  type Mood,
  type SchemeBoost,
  type SchemeView,
  type AccompliceAnswer,
  type Mark,
  type MarkKind,
  MARK_PLACE,
  type VisibleChoice,
} from "@lifesim/core";
import type { ContentBundle } from "@lifesim/content";
import { STORY_PHASES, storyTimeline, type SessionConfig, type StoryPhase } from "./config";
import { makeContext, type Bindings, type WorldView } from "./context";
import type { Change, EndReason, LogEntry } from "./log";
import { pickNames } from "./names";
import { computeRecaps, type CharacterTracking } from "./recap";
import { Relations, arrivalOf, clampAttr, factKey, positionAt, type CharacterState, type Trip } from "./state";

export type SessionState = "initializing" | "active" | "completed" | "cancelled";

export interface ParticipantSpec {
  id?: string;
  name?: string;
  career: string;
  isBot: boolean;
}

export type PublicEntry =
  | { kind: "event"; t: number; instanceId: string; title: string; text: string; participants: ParticipantInfo[]; tile: TilePos }
  | { kind: "ended"; t: number; characterId: string; name: string; status: string; cause: string }
  | { kind: "season"; t: number; year: number; season: string }
  | { kind: "upheaval"; t: number; id: string; title: string; text: string; active: boolean }
  /** T7: a lasting trace appears on the map, or goes away. */
  | { kind: "mark"; t: number; mark: Mark }
  | { kind: "unmark"; t: number; id: string }
  /** T6: someone's mood changed (an emoji above their head). */
  | { kind: "mood"; t: number; characterId: string; mood: Mood }
  /** The tension curve moves on; `finale` also means everyone is about to gather (T3). */
  | { kind: "phase"; t: number; phase: StoryPhase }
  | { kind: "move"; t: number; characterId: string; from: TilePos; path: TilePos[]; departAt: number; msPerTile: number; to: string | null };

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
  /** When the participants have gathered and the choices are offered. */
  startedAt: number;
  deadlineAt: number;
  place: { tile: TilePos; placeId: string | null };
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

type Timer =
  | { kind: "deadline"; instanceId: string }
  | { kind: "offer"; instanceId: string }
  | { kind: "tick" }
  | { kind: "end" }
  | { kind: "season" }
  | { kind: "upheaval"; id: string }
  | { kind: "upheaval_end"; id: string }
  | { kind: "phase"; phase: StoryPhase }
  | { kind: "release"; characterId: string }
  | { kind: "unmark"; id: string }
  | { kind: "scheme"; id: string };

/** "Ana", "Ana and Ben", "Ana, Ben and Clara" (T4b N4). */
export function listNames(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** T8: a scheme as the engine keeps it (the plotter's view plus who the plotter is). */
interface Scheme extends SchemeView {
  plotter: string;
}

/** T8: hidden events the scheme machinery starts (content may leave them out). */
const ACCOMPLICE_EVENT = "scheme_accomplice";
const CAUGHT_EVENT = "scheme_caught";

const LEISURE: PlaceKind[] = ["cafe", "park", "shop", "bar", "home"];

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
  /** Host hook: where a character spends free time (bots decide by personality). Default: random. */
  chooseLeisure: (characterId: string, options: readonly PlaceKind[]) => PlaceKind | undefined = () => undefined;
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
  /** Destinations set by "move" effects, applied once the event is over. */
  private readonly pendingMoves = new Map<string, { to: LocationKind; stay: number }>();
  private storyResolved = false;
  private instanceSeq = 0;
  private pendingSeq = 0;

  private readonly rngInit: Rng;
  private readonly rngSelect: Rng;
  private readonly rngOutcome: Rng;
  private readonly rngTiming: Rng;
  private readonly rngChaos: Rng;
  private readonly mischiefUsed = new Map<string, number>();
  private mischiefSeq = 0;
  /** T3: the finale closes the session once everyone alive is free. */
  private finale: "none" | "waiting" | "running" | "done" = "none";
  /** T8: schemes in preparation or done. */
  private readonly schemes = new Map<string, Scheme>();
  /** T7: lasting traces on the map. */
  private readonly marks = new Map<string, Mark>();
  private markSeq = 0;
  private readonly finaleEvents: EventDefinition[];
  private readonly timeline: Record<StoryPhase, number>;
  /** Session facts each event refers to (events tied to an upheaval get a boost while it lasts). */
  private readonly eventSessionFacts = new Map<string, Set<string>>();

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
    this.rngChaos = root.fork("chaos");
    this.directorEvents = [...content.events.values()]
      .filter((e) => e.trigger === "director" && e.weight > 0)
      .sort((a, b) => a.id.localeCompare(b.id));
    this.finaleEvents = [...content.events.values()]
      .filter((e) => e.trigger === "finale" && e.weight > 0)
      .sort((a, b) => a.id.localeCompare(b.id));
    this.timeline = storyTimeline(config);
    this.createCharacters(participants);
    for (const ev of content.events.values()) {
      const facts = new Set<string>();
      const scan = (c?: Condition) => c && walkCondition(c, (n) => "sessionFact" in n && (n.present ?? true) && facts.add(n.sessionFact));
      scan(ev.conditions);
      for (const role of Object.values(ev.roles)) scan(role.conditions);
      if (facts.size) this.eventSessionFacts.set(ev.id, facts);
    }
  }

  get state(): SessionState {
    return this._state;
  }

  /** Current position and trip of every character, for (re)connecting clients. */
  positions(): { characterId: string; pos: TilePos; trip: Trip | null; status: string }[] {
    return this.order.map((id) => {
      const c = this.char(id);
      return { characterId: id, pos: c.pos, trip: c.trip && arrivalOf(c.trip) > this.now() ? c.trip : null, status: c.status };
    });
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
        return { id, name: c.name, career: c.career.id, isBot: c.isBot, attrs: { ...c.attrs }, home: c.home, work: c.work };
      }),
      relations,
    });
    this._state = "active";
    this.log.push({ t: this.now(), type: "phase_changed", phase: "intro" });
    for (const phase of STORY_PHASES) {
      if (phase !== "intro" && this.timeline[phase] > this.timeline.intro) this.timers.push(this.timeline[phase], { kind: "phase", phase });
    }
    this.timers.push(this.config.durationSeconds * MS, { kind: "end" });
    this.scheduleNextSeason();
    this.scheduleUpheavals();
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
        case "offer":
          this.offer(timer.instanceId);
          break;
        case "upheaval":
          this.onUpheaval(timer.id);
          break;
        case "upheaval_end":
          this.endUpheaval(timer.id);
          break;
        case "phase":
          this.onPhase(timer.phase);
          break;
        case "unmark":
          this.removeMark(timer.id);
          break;
        case "scheme":
          this.onScheme(timer.id);
          break;
        case "release": {
          // T5b R2: the lingering after an event is over; now go wherever life takes you.
          const c = this.char(timer.characterId);
          if (c.busyWith === null) this.afterEventMovement(c);
          if (c.status === "active") this.scheduleTick(this.now());
          break;
        }
        case "end":
          this.accepting = false;
          this.endReason ??= "time_limit";
          if (!this.maybeComplete()) this.fillIdle();
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
          this.onPublic({ kind: "ended", t: this.now(), characterId: id, name: c.name, status: "dead", cause: c.cause ?? "" });
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

  // ================================================================== chaos (concept v2 §5)

  /** 2–3 town-wide upheavals, spread over the middle of the session, never the same twice. */
  private scheduleUpheavals(): void {
    const pool = [...this.content.upheavals.values()].filter((u) => u.weight > 0);
    if (pool.length === 0) return;
    const [lo, hi] = this.config.chaos.upheavals;
    const count = Math.min(pool.length, this.rngChaos.int(lo, hi));
    const span = this.config.durationSeconds * MS;
    // T3: the last upheaval is the climax (around 60–70 %); the others are spread over the growth phase.
    const [c0, c1] = this.config.story.climaxUpheaval;
    const growthStart = Math.max(this.timeline.growth, 0.2 * span);
    const growthEnd = Math.max(growthStart, Math.min(0.55 * span, this.timeline.climax));
    for (let k = 0; k < count; k++) {
      const pick = this.rngChaos.weighted(pool, (u) => u.weight)!;
      pool.splice(pool.indexOf(pick), 1);
      const others = count - 1;
      const at =
        k === others
          ? Math.min(span * this.rngChaos.range(c0, c1), this.timeline.respite)
          : growthStart + ((k + this.rngChaos.range(0.15, 0.85)) / others) * (growthEnd - growthStart);
      this.timers.push(Math.round(at), { kind: "upheaval", id: pick.id });
    }
  }

  private onUpheaval(id: string): void {
    const u = this.content.upheavals.get(id);
    if (!u) return;
    this.sessionFacts.add(u.sessionFact);
    const changes: Change[] = [];
    for (const cid of this.order) {
      const c = this.char(cid);
      if (c.status !== "active") continue;
      const personal: string[] = [];
      const selfChanges: Partial<Record<Attribute, number>> = {};
      for (const e of u.effects) {
        if (!this.rngChaos.chance(e.chance)) continue;
        personal.push(e.text);
        for (const [a, d] of Object.entries(e.delta) as [Attribute, number][]) {
          const before = c.attrs[a];
          c.attrs[a] = clampAttr(before + d);
          const delta = c.attrs[a] - before;
          if (delta === 0) continue;
          selfChanges[a] = (selfChanges[a] ?? 0) + delta;
          changes.push({ kind: "attr", characterId: cid, attribute: a, delta, value: c.attrs[a] });
        }
      }
      this.onNotice(cid, { kind: "upheaval", t: this.now(), id: u.id, title: u.title, text: u.text, personal, selfChanges });
    }
    this.log.push({ t: this.now(), type: "upheaval_started", upheavalId: u.id, title: u.title, changes });
    for (const cid of this.order) this.updateMood(cid, this.reaction(cid, changes), changes);
    this.onPublic({ kind: "upheaval", t: this.now(), id: u.id, title: u.title, text: u.text, active: true });
    for (const cid of this.order) {
      const c = this.char(cid);
      if (c.status === "active" && c.busyWith === null && c.attrs.health <= 0) {
        const death: Change[] = [];
        this.setStatus(c, "dead", `Did not survive ${u.title.toLowerCase()}`, death);
        this.log.push({ t: this.now(), type: "character_ended", characterId: cid, status: "dead", cause: c.cause ?? "" });
        this.onNotice(cid, { kind: "ended", t: this.now(), status: "dead", cause: c.cause ?? "" });
        this.onPublic({ kind: "ended", t: this.now(), characterId: cid, name: c.name, status: "dead", cause: c.cause ?? "" });
      }
    }
    this.timers.push(this.now() + u.durationSeconds * MS, { kind: "upheaval_end", id: u.id });
    this.fillIdle();
  }

  private endUpheaval(id: string): void {
    const u = this.content.upheavals.get(id);
    if (!u) return;
    this.sessionFacts.delete(u.sessionFact);
    this.log.push({ t: this.now(), type: "upheaval_ended", upheavalId: id });
    this.onPublic({ kind: "upheaval", t: this.now(), id, title: u.title, text: u.text, active: false });
  }

  // ================================================================== story curve (T3)

  /** Current phase of the tension curve. */
  phase(): StoryPhase {
    let current: StoryPhase = "intro";
    for (const p of STORY_PHASES) if (this.now() >= this.timeline[p]) current = p;
    return current;
  }

  private onPhase(phase: StoryPhase): void {
    this.log.push({ t: this.now(), type: "phase_changed", phase });
    this.onPublic({ kind: "phase", t: this.now(), phase });
    if (phase === "finale" && this.finaleEvents.length > 0 && this.finale === "none") {
      this.finale = "waiting";
      this.log.push({ t: this.now(), type: "finale_waiting" });
      this.tryStartFinale();
    }
  }

  /** Starts the finale as soon as nobody alive is in an event (no new events start meanwhile). */
  private tryStartFinale(): void {
    if (this.finale !== "waiting") return;
    const alive = this.order.filter((id) => this.char(id).status === "active");
    if (alive.some((id) => this.char(id).busyWith !== null)) return;
    // Humans get their breather first (bots do not mind).
    const rested = Math.max(this.now(), ...alive.filter((id) => !this.char(id).isBot).map((id) => this.char(id).availableAt));
    if (rested > this.now()) {
      this.scheduleTick(rested);
      return;
    }
    const pool = this.rngSelect.shuffle(alive);
    const candidates: { ev: EventDefinition; bindings: Record<string, string[]> }[] = [];
    for (const ev of this.finaleEvents) {
      const bindings = alive.length > 0 ? this.bind(ev, null, pool, {}, true) : null;
      if (bindings) candidates.push({ ev, bindings });
    }
    const pick = this.rngSelect.weighted(candidates, (c) => c.ev.weight);
    if (!pick) {
      this.finale = "done";
      this.maybeComplete();
      return;
    }
    this.finale = "running";
    this.startInstance(pick.ev, pick.bindings);
  }

  /** What a character can still play, and their schemes (T8). */
  mischiefState(characterId: string): MischiefState {
    const c = this.characters.get(characterId);
    return {
      charges: Math.max(0, this.config.chaos.mischiefCharges - (this.mischiefUsed.get(characterId) ?? 0)),
      options: [...this.content.mischief.values()]
        .filter((m) => !m.careers || (c !== undefined && m.careers.includes(c.career.id)))
        .map((m) => ({ id: m.id, label: m.label, description: m.description, ...(m.careers ? { career: true } : {}) })),
      schemes: [...this.schemes.values()].filter((s) => s.plotter === characterId).map((s) => this.schemeView(s)),
      revengeOn: c ? [...c.facts].filter((f) => f.startsWith("revenge_on:")).map((f) => f.slice("revenge_on:".length)) : [],
    };
  }

  // ================================================================== schemes (T8: plan → prepare → carry out)

  /** Why a scheme cannot be planned right now, or null. */
  private schemeProblem(plotter: string, mischiefId: string, targetId: string): string | null {
    if (this._state !== "active" || !this.accepting) return "session is not active";
    if (this.finale !== "none") return "the finale has begun";
    const def = this.content.mischief.get(mischiefId);
    if (!def) return "unknown prank";
    const actor = this.characters.get(plotter);
    const target = this.characters.get(targetId);
    if (!actor || actor.status !== "active") return "you cannot play pranks now";
    if (def.careers && !def.careers.includes(actor.career.id)) return "only some careers can do this";
    if (!target || target.status !== "active" || targetId === plotter) return "invalid target";
    const free = actor.facts.has(factKey("revenge_on", targetId));
    if (!free && this.mischiefState(plotter).charges <= 0) return "no pranks left";
    if (def.targetCondition && !evaluate(def.targetCondition, makeContext(this.world, {}, targetId))) return "this prank does not work on them";
    // T2: nobody gets the same prank twice (it would be the same solo event again).
    const already = [...this.schemes.values()].some((s) => s.mischiefId === mischiefId && s.targetId === targetId);
    if (target.seen.has(def.event) || already || this.pending.some((p) => p.eventId === def.event && p.preset.victim?.[0] === targetId)) {
      return "they already had this one";
    }
    return null;
  }

  /**
   * T8: chance that a scheme works and risk of being found out. Your career helps with career
   * schemes; friends trust you (it works more often) but they know you (they see through you
   * more easily); strangers rarely suspect you; working in the same place is risky.
   */
  private schemeChances(plotter: string, mischiefId: string, targetId: string): { success: number; risk: number } {
    const def = this.content.mischief.get(mischiefId)!;
    const p = this.char(plotter);
    const t = this.char(targetId);
    let success = def.success;
    let risk = def.risk;
    if (def.careers?.includes(p.career.id)) {
      success += 0.15;
      risk -= 0.05;
    }
    const seen = this.relations.get(targetId, plotter).type;
    if (seen === "friend" || seen === "partner" || seen === "family") {
      success += 0.1;
      risk += 0.15;
    } else if (seen === "rival" || seen === "enemy") risk += 0.1;
    else if (seen === "stranger") risk -= 0.1;
    if (p.work === t.work) risk += 0.1;
    const clamp = (x: number) => Math.round(Math.min(0.95, Math.max(0.05, x)) * 100) / 100;
    return { success: clamp(success), risk: clamp(risk) };
  }

  /** T8: what a scheme would look like, before you commit to it. */
  schemePreview(plotter: string, mischiefId: string, targetId: string): { ok: true; success: number; risk: number; free: boolean } | { ok: false; reason: string } {
    const problem = this.schemeProblem(plotter, mischiefId, targetId);
    if (problem) return { ok: false, reason: problem };
    return { ok: true, ...this.schemeChances(plotter, mischiefId, targetId), free: this.char(plotter).facts.has(factKey("revenge_on", targetId)) };
  }

  /**
   * T8, step 1: plan a scheme against someone (concept v2 §5 pranks, now in three steps). It is
   * prepared for 1–2 years of the life calendar, then carried out; the victim gets the consequence
   * as a hidden event in which the culprit is an unaware role, unless they catch them.
   */
  mischief(characterId: string, mischiefId: string, targetId: string): SubmitResult {
    const problem = this.schemeProblem(characterId, mischiefId, targetId);
    if (problem) {
      this.log.push({ t: this.now(), type: "mischief_rejected", characterId, targetId, mischiefId, reason: problem });
      return { ok: false, reason: problem };
    }
    const def = this.content.mischief.get(mischiefId)!;
    const plotter = this.char(characterId);
    // Revenge is free: it uses up the revenge, not a charge.
    const free = plotter.facts.delete(factKey("revenge_on", targetId));
    if (!free) this.mischiefUsed.set(characterId, (this.mischiefUsed.get(characterId) ?? 0) + 1);
    const { success, risk } = this.schemeChances(characterId, mischiefId, targetId);
    const [p0, p1] = this.config.chaos.schemePrepSeconds;
    const scheme: Scheme = {
      id: `M${++this.mischiefSeq}`,
      plotter: characterId,
      mischiefId,
      label: def.label,
      targetId,
      startedAt: this.now(),
      readyAt: this.now() + Math.round(this.rngChaos.range(p0, p1) * MS),
      success,
      risk,
      state: "preparing",
    };
    this.schemes.set(scheme.id, scheme);
    this.timers.push(scheme.readyAt, { kind: "scheme", id: scheme.id });
    this.log.push({ t: this.now(), type: "mischief", characterId, targetId, mischiefId, dueAt: scheme.readyAt, schemeId: scheme.id });
    const pct = (x: number) => `${Math.round(x * 100)} %`;
    this.schemeNotice(scheme, `${free ? "Revenge, for free: " : ""}you start planning "${def.label}" against ${this.char(targetId).name}: ${pct(success)} chance it works, ${pct(risk)} risk they find out.`);
    return { ok: true };
  }

  /** T8, step 2: one boost per scheme while it is being prepared. */
  boostScheme(characterId: string, schemeId: string, boost: SchemeBoost, accompliceId?: string): SubmitResult {
    const s = this.schemes.get(schemeId);
    const reject = (reason: string): SubmitResult => {
      this.log.push({ t: this.now(), type: "scheme_rejected", characterId, schemeId, boost, ...(accompliceId ? { accompliceId } : {}), reason });
      return { ok: false, reason };
    };
    if (this._state !== "active") return reject("session is not active");
    if (!s || s.plotter !== characterId) return reject("unknown scheme");
    if (s.state !== "preparing") return reject("it is already over");
    if (s.boost) return reject("you already did something for this one");
    if (boost === "accomplice") {
      const a = accompliceId ? this.characters.get(accompliceId) : undefined;
      if (!a || a.status !== "active" || a.id === characterId || a.id === s.targetId) return reject("invalid accomplice");
      // Nobody is asked twice (T2: never the same solo event again).
      const asked = a.seen.has(ACCOMPLICE_EVENT) || [...this.schemes.values()].some((x) => x.accomplice === a.id);
      if (asked) return reject("they have already been asked once");
    } else if (boost !== "cover" && boost !== "wait") return reject("unknown boost");
    s.boost = boost;
    this.log.push({ t: this.now(), type: "scheme_boost", characterId, schemeId, boost, ...(boost === "accomplice" ? { accompliceId } : {}) });
    const target = this.char(s.targetId).name;
    if (boost === "cover") {
      s.risk = Math.round(s.risk * 50) / 100;
      this.schemeNotice(s, `You cover your tracks. Risk of being found out: ${Math.round(s.risk * 100)} %.`);
    } else if (boost === "wait") {
      s.success = Math.min(0.95, Math.round((s.success + 0.15) * 100) / 100);
      s.readyAt += 15 * MS;
      this.timers.push(s.readyAt, { kind: "scheme", id: s.id });
      this.schemeNotice(s, `You wait for the right moment, when ${target} is not looking. Chance it works: ${Math.round(s.success * 100)} %.`);
    } else {
      s.accomplice = accompliceId;
      const ev = this.content.events.get(ACCOMPLICE_EVENT);
      if (ev) {
        const preset = { accomplice: [accompliceId as string], plotter: [characterId], target: [s.targetId] };
        this.pending.push({ seq: ++this.pendingSeq, dueAt: this.now(), eventId: ev.id, preset, sourceInstanceId: s.id, sourceBindings: preset });
        this.pending.sort((a, b) => a.dueAt - b.dueAt || a.seq - b.seq);
        this.scheduleTick(this.now());
      }
      this.schemeNotice(s, `You ask ${this.char(accompliceId as string).name} to help you with ${target}. Now you wait for an answer.`);
    }
    return { ok: true };
  }

  /** T8: the accomplice answered (the hidden accomplice event resolved). */
  private onAccompliceAnswer(inst: Instance, outcomeId: string): void {
    const s = inst.parentId ? this.schemes.get(inst.parentId) : undefined;
    if (!s || s.state !== "preparing") return;
    const answer: AccompliceAnswer = outcomeId === "helped" ? "helped" : outcomeId === "betrayed" ? "betrayed" : "refused";
    s.accompliceAnswer = answer;
    if (answer === "helped") s.success = Math.min(0.95, Math.round((s.success + 0.25) * 100) / 100);
    const a = this.char(s.accomplice as string).name;
    this.schemeNotice(
      s,
      answer === "helped"
        ? `${a} is in. Chance it works: ${Math.round(s.success * 100)} %.`
        : answer === "betrayed"
          ? `${a} said yes… and then went straight to ${this.char(s.targetId).name}.`
          : `${a} wants nothing to do with it.`,
    );
  }

  /** T8, step 3: the scheme is carried out. */
  private onScheme(id: string): void {
    const s = this.schemes.get(id);
    if (!s || s.state !== "preparing" || this.now() < s.readyAt) return; // a stale timer (the scheme waited)
    const def = this.content.mischief.get(s.mischiefId)!;
    const plotter = this.char(s.plotter);
    const target = this.char(s.targetId);
    s.state = "done";
    if (plotter.status !== "active" || target.status !== "active" || this.finale !== "none" || !this.accepting) {
      s.result = "failed";
      this.schemeNotice(s, `Your plan against ${target.name} never happened. Life got in the way.`);
      return;
    }
    const worked = this.rngChaos.chance(s.success);
    const discovered = s.accompliceAnswer === "betrayed" || this.rngChaos.chance(s.risk);
    s.result = worked ? "worked" : "failed";
    s.discovered = discovered;
    if (discovered) target.facts.add(factKey("spotted", s.plotter));
    this.log.push({ t: this.now(), type: "scheme_result", schemeId: s.id, characterId: s.plotter, targetId: s.targetId, result: s.result, discovered });
    (this.tracking.get(s.plotter) as CharacterTracking).played.push({
      mischief: def.label,
      on: s.targetId,
      result: s.result,
      ...(s.boost ? { boost: s.boost } : {}),
      ...(s.accomplice ? { accomplice: s.accomplice } : {}),
      ...(s.accompliceAnswer ? { accompliceAnswer: s.accompliceAnswer } : {}),
    });
    if (worked || discovered) (this.tracking.get(s.targetId) as CharacterTracking).suffered.push({ mischief: def.label, by: s.plotter, discovered });
    // The victim's event: the prank itself, or (if it failed but they caught you) being caught at it.
    const eventId = worked ? def.event : discovered ? CAUGHT_EVENT : null;
    if (eventId && this.content.events.has(eventId)) {
      const [d0, d1] = def.delaySeconds === undefined ? [5, 15] : typeof def.delaySeconds === "number" ? [def.delaySeconds, def.delaySeconds] : def.delaySeconds;
      const dueAt = this.now() + Math.round(this.rngChaos.range(Math.min(d0, 4), Math.min(d1, 8) + 1e-9) * MS);
      const preset = { victim: [s.targetId], culprit: [s.plotter] };
      this.pending.push({ seq: ++this.pendingSeq, dueAt, eventId, preset, sourceInstanceId: s.id, sourceBindings: preset });
      this.pending.sort((a, b) => a.dueAt - b.dueAt || a.seq - b.seq);
      this.scheduleTick(dueAt);
      this.stats.followUpsScheduled++;
    }
    this.schemeNotice(
      s,
      worked && !discovered
        ? `"${def.label}": it worked, and nobody saw a thing.`
        : worked
          ? `"${def.label}": it worked… but ${target.name} saw you.`
          : discovered
            ? `"${def.label}" went wrong, and ${target.name} caught you at it.`
            : `"${def.label}" did not work out. At least nobody noticed.`,
    );
  }

  private schemeView(s: Scheme): SchemeView {
    const { plotter: _p, ...view } = s;
    return { ...view };
  }

  private schemeNotice(s: Scheme, text: string): void {
    this.onNotice(s.plotter, { kind: "scheme", t: this.now(), scheme: this.schemeView(s), text });
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
    if (inst.startedAt > this.now()) return reject("participants are still gathering");
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

  /** Deciders of a running event who have not decided yet (empty if the event is unknown or over). */
  undecided(instanceId: string): string[] {
    const inst = this.instances.get(instanceId);
    if (!inst || inst.resolved) return [];
    return inst.deciders.filter((id) => !inst.decisions.has(id));
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
    // B4: bots never get a name a player chose for their character.
    const chosen = new Set(participants.flatMap((p) => (p.name ? [p.name.toLowerCase()] : [])));
    const names = pickNames(participants.length + chosen.size, this.rngInit).filter((n) => !chosen.has(n.toLowerCase()));
    const initFacts = [...this.content.facts.values()].filter((f) => f.setAtInit).map((f) => f.key);
    const [d0, d1] = this.config.initialDelaySeconds;
    const homes = this.rngInit.shuffle(this.content.map.placesOf("home"));
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
        name: p.name ?? (names.shift() as string),
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
        home: (homes[i % homes.length] as { id: string }).id,
        work: "",
        pos: [0, 0],
        trip: null,
        stayUntil: 0,
      });
      const ch = this.char(id);
      const home = this.content.map.place(ch.home)!;
      ch.pos = [...home.door] as TilePos;
      ch.work = (this.content.map.nearest(career.workplace, ch.pos) ?? home).id;
      this.order.push(id);
      this.tracking.set(id, { keyMoments: [], influence: new Map(), startTypes: new Map(), played: [], suffered: [] });
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
    if (this._state !== "active") return;
    if (this.finale !== "none") {
      // T3: no new events around the finale; whoever is free keeps living their routine.
      this.tryStartFinale();
      if (this._state === "active") this.runRoutine();
      return;
    }
    if (!this.accepting) return;
    this.activateFollowUps();

    // T7b: people a due follow-up is waiting for are kept free for it (its story continues as soon as the others are free too).
    const reserved = this.reservedForFollowUps();
    const free = this.rngSelect.shuffle(this.order.filter((id) => this.isFree(id) && !reserved.has(id)));
    for (const anchor of free) {
      if (!this.isFree(anchor)) continue; // grabbed by an earlier event in this loop
      const candidates: { ev: EventDefinition; bindings: Record<string, string[]>; weight: number }[] = [];
      const impatient = this.isImpatient(anchor);
      for (const ev of this.directorEvents) {
        if (this.phaseFactor(ev) === 0) continue;
        // T3: a human who has waited too long may get a solo event even if its session quota is used up.
        const extra = impatient && this.isSoloEvent(ev);
        if (!this.cooldownOk(ev, true) && !(extra && this.cooldownOk(ev, true, true))) continue;
        const bindings = this.bind(ev, anchor, this.nearbyPool(anchor), {});
        if (bindings) candidates.push({ ev, bindings, weight: this.weight(ev, anchor, bindings) * (extra ? 1 / this.config.director.soloFactor : 1) });
      }
      const pick = this.rngSelect.weighted(candidates, (c) => c.weight);
      if (!pick) {
        this.stats.directorIdle++;
        this.scheduleRetry();
        continue;
      }
      this.startInstance(pick.ev, pick.bindings);
    }
    this.runRoutine();
  }

  /**
   * Free characters ordered by distance to `anchor` (with jitter): events draw in the people nearby,
   * and people the anchor has a relationship with count as closer (T2: relationship chains).
   */
  private nearbyPool(anchor: string): string[] {
    const at = this.posOf(anchor);
    const pull = this.config.director.relatedPullTiles;
    // A waiting human may also be joined by bots who are only on their breather (bots do not need one).
    const human = this.config.humanPacing !== undefined && !this.char(anchor).isBot;
    const available = (id: string) => {
      const c = this.char(id);
      return this.isFree(id) || (human && c.isBot && c.status === "active" && c.busyWith === null);
    };
    const reserved = this.reservedForFollowUps();
    return this.order
      .filter((id) => id !== anchor && available(id) && !reserved.has(id))
      .map((id) => ({ id, d: manhattan(this.posOf(id), at) + this.rngSelect.range(0, 6) - (this.isRelated(anchor, id) ? pull : 0) }))
      .sort((a, b) => a.d - b.d)
      .map((x) => x.id);
  }

  // ================================================================== town: positions, trips, routine

  private posOf(id: string): TilePos {
    return positionAt(this.char(id), this.now());
  }

  /** Place the tile belongs to (inside a place or at its door), if any. */
  private placeAt(tile: TilePos): string | null {
    for (const p of this.content.map.places) {
      if ((tile[0] === p.door[0] && tile[1] === p.door[1]) || (tile[0] >= p.x && tile[0] < p.x + p.w && tile[1] >= p.y && tile[1] < p.y + p.h)) return p.id;
    }
    return null;
  }

  /** Starts walking; returns the arrival time. */
  private walkTo(c: CharacterState, tile: TilePos, to: string | null, reason: Trip["reason"]): number {
    const from = positionAt(c, this.now());
    const path = this.content.map.route(from, tile);
    c.pos = path.length > 0 ? (path[path.length - 1] as TilePos) : from;
    if (path.length === 0) {
      c.trip = null;
      return this.now();
    }
    const msPerTile = MS / this.config.walkTilesPerSecond;
    c.trip = { from, path, departAt: this.now(), msPerTile, to, reason };
    const arriveAt = arrivalOf(c.trip);
    this.log.push({ t: this.now(), type: "moved", characterId: c.id, from, to: c.pos, placeId: to, arriveAt, reason });
    this.onPublic({ kind: "move", t: this.now(), characterId: c.id, from, path, departAt: this.now(), msPerTile, to });
    return arriveAt;
  }

  private goToPlace(c: CharacterState, placeId: string, reason: Trip["reason"]): number {
    const place = this.content.map.place(placeId);
    if (!place) return this.now();
    // Inside walkable places (the park) people spread out instead of queueing at the gate.
    let tile: TilePos = place.door;
    if (place.walkable) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const t: TilePos = [place.x + this.rngTiming.int(0, place.w - 1), place.y + this.rngTiming.int(0, place.h - 1)];
        if (this.content.map.isWalkable(t[0], t[1])) {
          tile = t;
          break;
        }
      }
    }
    return this.walkTo(c, tile, placeId, reason);
  }

  /** After an event: go where an effect sent you, or where your new status takes you. */
  private afterEventMovement(c: CharacterState): void {
    const move = this.pendingMoves.get(c.id);
    this.pendingMoves.delete(c.id);
    if (c.status === "imprisoned" || c.status === "hospitalized") {
      const kind: PlaceKind = c.status === "imprisoned" ? "police" : "hospital";
      const place = this.content.map.nearest(kind, c.pos);
      if (place) this.goToPlace(c, place.id, "status");
      return;
    }
    if (!move || c.status !== "active") return;
    let placeId: string | null = null;
    if (move.to === "home") placeId = c.home;
    else if (move.to === "work") placeId = c.work;
    else if (move.to === "street") {
      const tiles = this.content.map.streetTiles();
      c.stayUntil = this.walkTo(c, this.rngTiming.pick(tiles), null, "effect") + move.stay;
      return;
    } else placeId = this.content.map.nearest(move.to as PlaceKind, c.pos)?.id ?? null;
    if (placeId) c.stayUntil = this.goToPlace(c, placeId, "effect") + move.stay;
  }

  /** Passive play (concept v2 §2): sleep at home, work, free time — for everyone not in an event. */
  private runRoutine(): void {
    const quarter = (this.config.yearSeconds * MS) / 4;
    const qStart = Math.floor(this.now() / quarter) * quarter;
    const f = (this.now() - qStart) / quarter;
    const { night, workEnd, leisureStaySeconds } = this.config.routine;
    for (const id of this.order) {
      const c = this.char(id);
      if (c.status !== "active" || c.busyWith !== null || this.now() < c.stayUntil) continue;
      if (c.trip && arrivalOf(c.trip) > this.now()) continue;
      c.trip = null;
      let target: string;
      let until: number;
      if (f < night) {
        target = c.home;
        until = qStart + night * quarter;
      } else if (f < workEnd && c.facts.has("employed")) {
        target = c.work;
        until = qStart + workEnd * quarter;
      } else {
        // Draw the fallback first so the random stream does not depend on who chose (replays stay identical).
        const fallback = this.rngTiming.pick(LEISURE);
        const chosen = this.chooseLeisure(id, LEISURE);
        const kind = chosen && (LEISURE as string[]).includes(chosen) ? chosen : fallback;
        this.log.push({ t: this.now(), type: "leisure", characterId: id, kind });
        target = kind === "home" ? c.home : (this.content.map.nearest(kind, c.pos)?.id ?? c.home);
        until = Math.min(qStart + quarter, this.now() + this.rngTiming.range(leisureStaySeconds[0], leisureStaySeconds[1]) * MS);
      }
      const here = this.placeAt(c.pos);
      const arrive = here === target ? this.now() : this.goToPlace(c, target, "routine");
      c.stayUntil = Math.max(until, arrive);
      this.scheduleTick(c.stayUntil);
    }
  }

  /** Where an event happens: the nearest of its location options, seen from its anchor. */
  private eventPlace(ev: EventDefinition, bindings: Record<string, string[]>): { tile: TilePos; placeId: string | null } {
    const ofRole = ev.location?.of?.startsWith("role:") ? ev.location.of.slice(5) : Object.keys(ev.roles)[0]!;
    const anchor = this.char((bindings[ofRole] ?? Object.values(bindings).flat())[0] as string);
    const from = positionAt(anchor, this.now());
    let best: { tile: TilePos; placeId: string | null } | null = null;
    let bestLen = Infinity;
    for (const at of (ev.location?.at ?? ["here"]) as LocationKind[]) {
      let option: { tile: TilePos; placeId: string | null } | null = null;
      if (at === "here") option = { tile: from, placeId: this.placeAt(from) };
      else if (at === "home") option = { tile: this.content.map.place(anchor.home)!.door, placeId: anchor.home };
      else if (at === "work") option = { tile: this.content.map.place(anchor.work)!.door, placeId: anchor.work };
      else if (at === "street") {
        const near = this.content.map.streetTiles().filter((t) => manhattan(t, from) <= 6);
        option = near.length > 0 ? { tile: this.rngTiming.pick(near), placeId: null } : null;
      } else {
        const p = this.content.map.nearest(at, from);
        option = p ? { tile: p.door, placeId: p.id } : null;
      }
      if (!option) continue;
      const len = this.content.map.route(from, option.tile).length;
      if (len < bestLen) {
        best = option;
        bestLen = len;
      }
    }
    return best ?? { tile: from, placeId: this.placeAt(from) };
  }

  /** Participants walk to the event; returns when the last one arrives. */
  private gather(inst: Instance): number {
    const offsets: TilePos[] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    let arrival = this.now();
    let slot = 0;
    for (const id of inst.participants) {
      if (inst.ev.roles[inst.roleOf.get(id) as string]?.aware === false) continue; // they do not know: they stay put
      const c = this.char(id);
      let tile = inst.place.tile;
      for (; slot < offsets.length; slot++) {
        const o = offsets[slot] as TilePos;
        const t: TilePos = [inst.place.tile[0] + o[0], inst.place.tile[1] + o[1]];
        if (this.content.map.isWalkable(t[0], t[1])) {
          tile = t;
          slot++;
          break;
        }
      }
      arrival = Math.max(arrival, this.walkTo(c, tile, inst.place.placeId, "event"));
    }
    return arrival;
  }

  /** An event in which only one person decides (whatever the role counts turn out to be). */
  private isSoloEvent(ev: EventDefinition): boolean {
    const min = (r: string) => {
      const c = ev.roles[r]!.count;
      return typeof c === "number" ? c : c[0];
    };
    return Object.keys(ev.roles).reduce((n, r) => n + ((ev.choices[r]?.length ?? 0) > 0 ? min(r) : 0), 0) < 2;
  }

  /** A human who has been free for longer than their patience. */
  private isImpatient(id: string): boolean {
    const pacing = this.config.humanPacing;
    const c = this.char(id);
    return pacing !== undefined && !c.isBot && this.now() - c.availableAt >= pacing.patienceSeconds * MS * pacing.timeScale;
  }

  /**
   * A real relationship: more than strangers or people who have only met — or something between them,
   * like a debt, a favour or a secret (a pair fact either way).
   */
  private isRelated(a: string, b: string): boolean {
    const type = this.relations.get(a, b).type;
    if (type !== "stranger" && type !== "acquaintance") return true;
    const linked = (x: string, y: string) => [...this.char(x).facts].some((f) => f.endsWith(`:${y}`));
    return linked(a, b) || linked(b, a);
  }

  private isFree(id: string): boolean {
    const c = this.char(id);
    return c.status === "active" && c.busyWith === null && c.availableAt <= this.now();
  }

  private cooldownOk(ev: EventDefinition, director: boolean, ignoreSessionQuota = false): boolean {
    const s = this.eventStarts.get(ev.id);
    if (!s) return true;
    if (!ignoreSessionQuota && ev.cooldown.maxPerSession !== undefined && s.count >= ev.cooldown.maxPerSession) return false;
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
    /** Finale: every role takes as many people as it can (up to its maximum). */
    fillAll = false,
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
        const target = fillAll ? max : this.rngSelect.int(min, max);
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
    const dir = this.config.director;
    if (others.some((o) => this.isRelated(anchor, o))) w *= dir.relationBoost;
    else if (others.some((o) => this.relations.get(anchor, o).type !== "stranger")) w *= dir.acquaintanceBoost;
    const deciders = Object.entries(bindings).reduce((n, [role, ids]) => n + ((ev.choices[role]?.length ?? 0) > 0 ? ids.length : 0), 0);
    if (deciders < 2) w *= this.phase() === "intro" ? dir.soloFactor * dir.soloFactor : dir.soloFactor; // T3: the intro brings people together
    if (ev.category === "critical") w *= 0.4 + this.progress();
    w *= this.phaseFactor(ev);
    const tied = this.eventSessionFacts.get(ev.id);
    if (tied && [...tied].some((f) => this.sessionFacts.has(f))) w *= 4;
    const here = this.placeAt(this.posOf(anchor));
    const herePlace = here ? this.content.map.place(here) : undefined;
    if (herePlace && ev.location?.at.includes(herePlace.kind)) w *= 1.5;
    return w;
  }

  /**
   * T3: what fits the current phase. Intro: light, everyday and social events that bring people
   * together, nothing critical; climax: drama; respite: nothing critical or important.
   */
  private phaseFactor(ev: EventDefinition): number {
    // T7b: early on, events that create ties (partners, friends, debts, favours) come first, so later events have something to work with.
    const ties = this.createsTies(ev) ? 2 : 1;
    switch (this.phase()) {
      case "intro":
        if (ev.category === "critical" || ev.importance === "important") return 0;
        return (ev.category === "everyday" || ev.category === "social" ? 1.5 : 1) * ties;
      case "growth":
        return ties;
      case "climax":
        return ev.category === "critical" ? 2 : ev.importance === "important" ? 1.5 : 1;
      case "respite":
        return ev.category === "critical" ? 0 : ev.importance === "important" ? 0.3 : 1;
      default:
        return 1;
    }
  }

  /** Characters a due (not yet expired) follow-up is waiting for. */
  private reservedForFollowUps(): Set<string> {
    const out = new Set<string>();
    for (const p of this.pending) {
      if (p.dueAt > this.now() || this.now() - p.dueAt > this.config.followUpMaxWaitSeconds * MS) continue;
      const ev = this.content.events.get(p.eventId) as EventDefinition;
      for (const [role, ids] of Object.entries(p.preset)) if (!this.isUnaware(ev, role)) for (const id of ids) out.add(id);
    }
    return out;
  }

  private readonly tieEvents = new Map<string, boolean>();

  /** Whether some outcome can make a partner or friend, or leave a debt, a favour or a life saved. */
  private createsTies(ev: EventDefinition): boolean {
    let known = this.tieEvents.get(ev.id);
    if (known === undefined) {
      known = ev.outcomes.some((o) =>
        (o.effects ?? []).some(
          (e) => (e.type === "relation" && (e.setType === "partner" || e.setType === "friend")) || (e.type === "fact" && ["owes_money", "owes_favor", "saved_by"].includes(e.key)),
        ),
      );
      this.tieEvents.set(ev.id, known);
    }
    return known;
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
      const mustBeFree = Object.entries(p.preset)
        .filter(([role]) => !this.isUnaware(ev, role))
        .flatMap(([, ids]) => ids);
      const drop = (reason: string) => this.dropFollowUp(p, reason);
      if (mustBeFree.some((id) => this.char(id).status !== "active")) {
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
      if (mustBeFree.some((id) => !this.isFree(id))) {
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
    const duration = this.rngTiming.int(lo, hi) * MS;
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
      deadlineAt: this.now(),
      deadlineTimer: -1,
      resolved: false,
      place: this.eventPlace(ev, bindings),
    };
    this.instances.set(id, inst);
    this.running.add(id);
    const s = this.eventStarts.get(ev.id) ?? { count: 0, lastAt: 0 };
    this.eventStarts.set(ev.id, { count: s.count + 1, lastAt: this.now() });
    this.stats.eventsStarted++;

    for (const c of participants) {
      const ch = this.char(c);
      inst.offered.set(c, this.visibleChoices(inst, c));
      // Someone who does not know they are involved keeps living their life (and may be in another event).
      if (this.isUnaware(ev, roleOf.get(c))) continue;
      ch.busyWith = id;
      ch.stayUntil = 0;
      ch.seen.set(ev.id, (ch.seen.get(ev.id) ?? 0) + 1);
    }
    inst.startedAt = this.gather(inst);
    inst.deadlineAt = inst.startedAt + (this.humanDeadline(inst) ?? duration);
    inst.deadlineTimer = this.timers.push(inst.deadlineAt, { kind: "deadline", instanceId: id });
    this.log.push({
      t: this.now(),
      type: "event_started",
      instanceId: id,
      eventId: ev.id,
      version: ev.version,
      title: ev.title,
      bindings,
      parentInstanceId: parentId,
      offerAt: inst.startedAt,
      deadlineAt: inst.deadlineAt,
      place: inst.place,
      phase: this.phase(),
    });
    if (!ev.hidden) {
      this.onPublic({
        kind: "event",
        t: this.now(),
        instanceId: id,
        title: this.interpolate(ev.title, bindings),
        text: this.interpolate(ev.text.public, bindings),
        participants: participants.map((c) => ({ characterId: c, name: this.char(c).name, role: roleOf.get(c) as string })),
        tile: inst.place.tile,
      });
    }
    if (inst.startedAt > this.now()) {
      // T5: the event begins on the map; the card opens once everyone has arrived.
      const placeName = inst.place.placeId ? (this.content.map.place(inst.place.placeId)?.name ?? null) : null;
      for (const c of participants) {
        if (this.isUnaware(ev, roleOf.get(c))) continue;
        this.onNotice(c, {
          kind: "coming",
          t: this.now(),
          instanceId: id,
          title: this.interpolate(ev.title, bindings),
          tile: inst.place.tile,
          placeName,
          offerAt: inst.startedAt,
          participants: this.visibleParticipants(inst, c).map((p) => ({ characterId: p, name: this.char(p).name, role: roleOf.get(p) as string })),
        });
      }
    }
    if (inst.startedAt > this.now()) this.timers.push(inst.startedAt, { kind: "offer", instanceId: id });
    else this.offer(id);
    return inst;
  }

  /**
   * T1: events with a human decider get a deadline in real seconds that depends on how much there is
   * to read. Returned in session milliseconds; undefined without human pacing or human deciders.
   */
  private humanDeadline(inst: Instance): number | undefined {
    const pacing = this.config.humanPacing;
    if (!pacing) return undefined;
    const humans = inst.deciders.filter((id) => !this.char(id).isBot);
    if (humans.length === 0) return undefined;
    const d = pacing.deadline;
    const words = (text: string | undefined) => (text ? this.interpolate(text, inst.bindings).split(/\s+/).filter(Boolean).length : 0);
    let seconds = 0;
    for (const id of humans) {
      const role = inst.roleOf.get(id) as string;
      const n =
        words(inst.ev.text.public) + words(inst.ev.text.private?.[role]) + (inst.offered.get(id) ?? []).reduce((sum, c) => sum + words(c.label), 0);
      const min = inst.ev.importance === "important" ? d.importantMinSeconds : d.minSeconds;
      seconds = Math.max(seconds, Math.min(d.maxSeconds, Math.max(min, d.baseSeconds + d.perWordSeconds * n)));
    }
    if (humans.length > 1) seconds += d.multiHumanBonusSeconds;
    return Math.round(seconds * MS * pacing.timeScale);
  }

  /** Everyone has arrived: show the event to the participants who know about it. */
  private offer(instanceId: string): void {
    const inst = this.instances.get(instanceId);
    if (!inst || inst.resolved) return;
    for (const c of inst.participants) {
      if (inst.ev.roles[inst.roleOf.get(c) as string]?.aware === false) continue; // involved without knowing it
      this.onNotice(c, { kind: "event", t: this.now(), view: this.view(c, inst) });
    }
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

  private isUnaware(ev: EventDefinition, role: string | undefined): boolean {
    return role !== undefined && ev.roles[role]?.aware === false;
  }

  /** Participants `viewer` may know about: unaware ones are hidden from everyone but themselves. */
  private visibleParticipants(inst: Instance, viewer: string): string[] {
    return inst.participants.filter((c) => c === viewer || inst.ev.roles[inst.roleOf.get(c) as string]?.aware !== false);
  }

  /** The projection a character is allowed to see (BOT_SYSTEM §8). */
  private view(characterId: string, inst: Instance): CharacterView {
    const self = this.char(characterId);
    const role = inst.roleOf.get(characterId) as string;
    // People who do not know they are involved (the prankster, the person gossiped about) stay invisible.
    const participants: ParticipantInfo[] = this.visibleParticipants(inst, characterId).map((c) => ({
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
      place: inst.place.placeId ? (({ id, name, kind }) => ({ id, name, kind }))(this.content.map.place(inst.place.placeId)!) : null,
      ...this.clueFor(inst, characterId),
      tile: [...inst.place.tile] as TilePos,
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
      others: this.othersFor(characterId),
      offer,
      mischief: this.mischiefState(characterId),
    };
  }

  /** T8: a victim who caught the culprit sees what gave them away. */
  private clueFor(inst: Instance, characterId: string): { clue?: string } {
    if (inst.roleOf.get(characterId) !== "victim") return {};
    const culprit = inst.bindings.culprit?.[0];
    if (!culprit || !this.char(characterId).facts.has(factKey("spotted", culprit))) return {};
    const def = [...this.content.mischief.values()].find((m) => m.event === inst.ev.id);
    const clue = def?.clue ?? "You caught {culprit} at it.";
    return { clue: this.interpolate(clue, inst.bindings) };
  }

  /** Everyone else, with the viewer's relationship to them. */
  private othersFor(characterId: string): CharacterView["others"] {
    const me = this.char(characterId);
    return this.order
      .filter((id) => id !== characterId)
      .map((id) => {
        const o = this.char(id);
        const r = this.relations.get(characterId, id);
        const youOwe = me.facts.has(factKey("owes_money", id));
        const owesYou = o.facts.has(factKey("owes_money", characterId));
        const debt = youOwe && owesYou ? "both" : youOwe ? "you_owe" : owesYou ? "owes_you" : undefined;
        return { id, name: o.name, career: o.career.id, status: o.status, relation: { type: r.type, affinity: r.affinity, trust: r.trust }, ...(debt ? { debt } : {}) };
      });
  }

  /** T5b R3: what a character sees of themselves and others right now (for the first screen and reconnects). */
  selfView(characterId: string): Pick<CharacterView, "self" | "others" | "calendar"> | undefined {
    const c = this.characters.get(characterId);
    if (!c) return undefined;
    return {
      self: { id: c.id, name: c.name, career: c.career.id, age: this.age(characterId), attrs: { ...c.attrs }, status: c.status, facts: [...c.facts].sort() },
      others: this.othersFor(characterId),
      calendar: (({ year, season }) => ({ year, season }))(calendarAt(this.now(), this.config.yearSeconds * MS)),
    };
  }

  /** T7: the traces currently on the map. */
  currentMarks(): Mark[] {
    return [...this.marks.values()];
  }

  /** T7: put a trace on the map (one of a kind per person: a new one replaces the old). */
  private addMark(kind: MarkKind, characterId: string, seconds?: number): void {
    const c = this.char(characterId);
    for (const m of this.marks.values()) if (m.kind === kind && m.characterId === characterId) this.removeMark(m.id);
    const where = MARK_PLACE[kind];
    const mark: Mark = {
      id: `K${++this.markSeq}`,
      kind,
      characterId,
      placeId: where === "home" ? c.home : where === "work" ? c.work : null,
      since: this.now(),
      ...(seconds !== undefined ? { until: this.now() + seconds * MS } : {}),
    };
    this.marks.set(mark.id, mark);
    if (mark.until !== undefined) this.timers.push(mark.until, { kind: "unmark", id: mark.id });
    this.onPublic({ kind: "mark", t: this.now(), mark });
  }

  private removeMark(id: string): void {
    if (!this.marks.delete(id)) return;
    this.onPublic({ kind: "unmark", t: this.now(), id });
  }

  /** T6: everyone's current mood (for (re)connecting clients). */
  moods(): { characterId: string; mood: Mood }[] {
    return this.order.map((id) => ({ characterId: id, mood: this.char(id).mood ?? "content" }));
  }

  /**
   * T6: a lasting mood from the latest reaction and the character's situation. Strong news wins
   * (shock, a new partner, a fight); otherwise the situation shows (debt, illness, stress).
   */
  private updateMood(id: string, reaction: Reaction | undefined, changes: readonly Change[]): void {
    const c = this.char(id);
    if (c.status !== "active") return;
    const newPartner = changes.some((ch) => ch.kind === "relation" && ch.type === "partner" && (ch.from === id || ch.to === id));
    const inDebt = [...c.facts].some((f) => f.startsWith("owes_money:"));
    const mood: Mood =
      reaction === "shock"
        ? "shocked"
        : newPartner
          ? "in_love"
          : reaction === "angry"
            ? "angry"
            : c.attrs.health < 30
              ? "sick"
              : inDebt
                ? "in_debt"
                : c.attrs.mental < 30
                  ? "stressed"
                  : reaction === "sad"
                    ? "sad"
                    : reaction === "joy"
                      ? "happy"
                      : // T6b M1: an event that did not touch you settles you down (no sticky sad faces).
                        reaction === "neutral"
                        ? "content"
                        : (c.mood ?? "content");
    if (mood === c.mood) return;
    c.mood = mood;
    this.onPublic({ kind: "mood", t: this.now(), characterId: id, mood });
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
    // (People who do not know they were involved do not "meet": that would give the secret away.)
    const met = inst.participants.filter((c) => !this.isUnaware(ev, inst.roleOf.get(c)));
    for (const a of met) for (const b of met) if (a < b) this.relations.meet(a, b, inst.id);

    // 4. Health or mental condition at zero ends the story.
    for (const id of inst.participants) {
      const c = this.char(id);
      if (c.status !== "active") continue;
      if (c.attrs.health <= 0) this.setStatus(c, "dead", `Health gave out during "${ev.title}"`, changes);
      else if (c.attrs.mental <= 0) this.setStatus(c, "hospitalized", `Mental breakdown during "${ev.title}"`, changes);
    }

    // 5. Follow-ups.
    for (const fu of outcome.followUps ?? []) {
      if (fu.chance !== undefined && !this.rngOutcome.chance(Math.min(1, fu.chance * this.config.chaos.followUpBoost))) continue;
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
    if (ev.trigger === "finale") {
      this.finale = "done";
      this.accepting = false;
      if (this.endReason === undefined || this.endReason === "time_limit") this.endReason = "finale";
    }
    this.stats.eventsResolved++;
    this.log.push({ t: this.now(), type: "event_resolved", instanceId: inst.id, eventId: ev.id, outcomeId: outcome.id, changes });
    // T8: the accomplice answered; and a victim who caught their culprit only "sees" them in this event.
    if (ev.id === ACCOMPLICE_EVENT) this.onAccompliceAnswer(inst, outcome.id);
    for (const v of inst.bindings.victim ?? []) for (const c of inst.bindings.culprit ?? []) this.char(v).facts.delete(factKey("spotted", c));

    // 6. Tracking for the Life Recap, notices, and freeing the participants.
    const important = outcome.important === true || ev.importance === "important";
    const reactionOf = (id: string) => this.reaction(id, changes);
    const humanThere = inst.participants.some((id) => !this.char(id).isBot && !this.isUnaware(ev, inst.roleOf.get(id)));
    for (const id of inst.participants) this.updateMood(id, reactionOf(id), changes);
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

      if (this.isUnaware(ev, role)) {
        this.onNotice(id, {
          kind: "resolved",
          t: this.now(),
          instanceId: inst.id,
          eventId: ev.id,
          title: this.interpolate(ev.title, inst.bindings),
          role,
          participants: this.visibleParticipants(inst, id).map((p) => ({ characterId: p, name: this.char(p).name, role: inst.roleOf.get(p) as string })),
          revealed: [],
          ...(text ? { outcomeText: text } : {}),
          selfChanges,
          others: this.othersFor(id),
          reactions: this.visibleParticipants(inst, id).map((p) => ({ characterId: p, reaction: reactionOf(p) })),
          deciders: inst.deciders.filter((d) => this.visibleParticipants(inst, id).includes(d)),
        });
        continue;
      }
      c.busyWith = null;
      c.lastCategory = ev.category;
      c.eventsCompleted++;
      const [r0, r1] = this.config.restSeconds;
      let rest = this.rngTiming.range(r0, r1) * MS;
      const pacing = this.config.humanPacing;
      if (pacing && !c.isBot) {
        const [p0, p1] = important ? pacing.restAfterImportantSeconds : pacing.restSeconds;
        rest = this.rngTiming.range(p0, p1) * MS * pacing.timeScale;
      }
      c.availableAt = this.now() + Math.round(rest);
      c.stayUntil = this.now();
      // T5b R2 (live only): everyone stays at the spot while the choices are revealed and people react.
      const linger = pacing && humanThere ? Math.round(pacing.lingerSeconds * MS * pacing.timeScale) : 0;
      if (linger > 0) {
        c.stayUntil = this.now() + linger;
        c.availableAt = Math.max(c.availableAt, c.stayUntil);
        this.timers.push(c.stayUntil, { kind: "release", characterId: id });
      } else this.afterEventMovement(c);
      if (c.status === "active") this.scheduleTick(Math.max(c.availableAt, c.stayUntil));

      this.onNotice(id, {
        kind: "resolved",
        t: this.now(),
        instanceId: inst.id,
        eventId: ev.id,
        title: this.interpolate(ev.title, inst.bindings),
        role,
        participants: this.visibleParticipants(inst, id).map((p) => ({ characterId: p, name: this.char(p).name, role: inst.roleOf.get(p) as string })),
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
        others: this.othersFor(id),
        reactions: this.visibleParticipants(inst, id).map((p) => ({ characterId: p, reaction: reactionOf(p) })),
        deciders: inst.deciders.filter((d) => this.visibleParticipants(inst, id).includes(d)),
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

  /** T5: how a character visibly reacts to an event's changes. */
  private reaction(id: string, changes: readonly Change[]): Reaction {
    let sum = 0;
    let hurt = false;
    let fell = false;
    for (const ch of changes) {
      if (ch.kind === "attr" && ch.characterId === id) {
        sum += ch.delta;
        if (ch.attribute === "health" && ch.delta <= -10) hurt = true;
      } else if (ch.kind === "status" && ch.characterId === id && ch.status !== "active") hurt = true;
      else if (ch.kind === "relation" && ch.from === id && (ch.type === "rival" || ch.type === "enemy")) fell = true;
    }
    if (hurt) return "shock";
    if (fell) return "angry";
    // T6b M1: small ups and downs do not show on a face; it takes a real win or a real loss.
    if (sum >= 6) return "joy";
    if (sum <= -8) return "sad";
    return "neutral";
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
    if (this.finale === "waiting" && this.order.every((id) => this.char(id).status !== "active")) this.finale = "done";
    if (this.accepting || this.running.size > 0 || this.finale === "waiting") return false;
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
      case "move":
        for (const id of resolve(effect.target)) this.pendingMoves.set(id, { to: effect.to, stay: (effect.staySeconds ?? 10) * MS });
        break;
      case "mark":
        for (const id of resolve(effect.target)) this.addMark(effect.mark, id, effect.seconds);
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
    // T7: how the town remembers you.
    if (status === "dead") {
      for (const m of [...this.marks.values()]) if (m.characterId === c.id && MARK_PLACE[m.kind] === "character") this.removeMark(m.id);
      this.addMark("flowers", c.id);
    } else if (status === "imprisoned") this.addMark("handcuffs", c.id);
    else if (status === "hospitalized") this.addMark("bandage", c.id);
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
    // {role} → "Ana, Ben and Clara"; {role|is|are} → the verb agreeing with how many they are (T6c).
    return text.replace(/\{([a-z][a-z0-9_]*)(?:\|([^|{}]*)\|([^|{}]*))?\}/g, (m, role: string, one?: string, many?: string) => {
      const ids = bindings[role];
      if (!ids) return m;
      if (one !== undefined && many !== undefined) return ids.length > 1 ? many : one;
      return listNames(ids.map((id) => this.char(id).name));
    });
  }

  private scheduleRetry(): void {
    const pacing = this.config.humanPacing;
    // Idle humans are looked after more often than bots (in real seconds).
    const humanWaiting = pacing !== undefined && this.order.some((id) => !this.char(id).isBot && this.isFree(id));
    const delay = humanWaiting ? Math.min(this.config.idleRetrySeconds * MS, pacing.retrySeconds * MS * pacing.timeScale) : this.config.idleRetrySeconds * MS;
    const at = this.now() + delay;
    if (this.retryAt !== undefined && this.retryAt > this.now() && this.retryAt <= at) return;
    this.retryAt = at;
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
