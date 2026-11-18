/**
 * Runs one engine `Session` in real time for connected players.
 *
 * - Session time = (wall time since start) × timeScale. timeScale 1 is normal play; tests and
 *   demos speed it up. The engine itself is unchanged: it only ever sees the `Clock`.
 * - Humans and bots use the same `submitDecision` entry point (TECHNICAL_ARCHITECTURE §6).
 * - A disconnected player simply does not answer: the deadline's default choice applies.
 *   On reconnect the player receives the current offer and recent history (`snapshot`).
 */
import { randomUUID } from "node:crypto";
import { BotController, createBotProfile, type BotProfile } from "@lifesim/bots";
import { Rng, type Clock, type Notice, type OfferView } from "@lifesim/core";
import type { ContentBundle } from "@lifesim/content";
import { Session, resolveConfig, type LogEntry, type PublicEntry, type SessionConfig, type SessionResult, type SubmitResult } from "@lifesim/engine";

export type Seat = { kind: "human"; userId: string; name: string; career: string } | { kind: "bot"; career: string };

export interface LiveSessionEvents {
  /** Deliver a message to one human player. */
  toUser(userId: string, event: string, payload: unknown): void;
  onDecision(sessionId: string, entry: Extract<LogEntry, { type: "decision" }>): void;
  onFinished(live: LiveSession, result: SessionResult): void;
}

interface HumanSeat {
  userId: string;
  characterId: string;
  pending?: OfferView;
  history: Notice[];
}

const HISTORY_LIMIT = 30;
const FEED_LIMIT = 50;

export class LiveSession {
  readonly id = randomUUID();
  readonly session: Session;
  readonly humans = new Map<string, HumanSeat>(); // userId → seat
  readonly bots = new Map<string, BotController>(); // characterId → bot
  readonly roster: { characterId: string; name: string; career: string; isBot: boolean; userId: string | null }[] = [];
  readonly feed: PublicEntry[] = [];
  private readonly startedAtWall: number;
  private readonly timeScale: number;
  private timer: NodeJS.Timeout | undefined;
  private readonly botTimers = new Set<NodeJS.Timeout>();
  private logCursor = 0;
  private finished = false;

  constructor(
    content: ContentBundle,
    config: Partial<SessionConfig>,
    seats: Seat[],
    private readonly events: LiveSessionEvents,
    options: { timeScale?: number; seed?: string } = {},
  ) {
    this.timeScale = options.timeScale ?? 1;
    this.startedAtWall = performance.now();
    const seed = options.seed ?? this.id;
    const clock: Clock = { now: () => (performance.now() - this.startedAtWall) * this.timeScale };
    const rng = new Rng(seed).fork("live-bots");
    const participants = seats.map((seat, i) => ({
      id: `c${i + 1}`,
      career: seat.career,
      isBot: seat.kind === "bot",
      ...(seat.kind === "human" ? { name: seat.name } : {}),
    }));
    this.session = new Session(content, resolveConfig({ ...config, seed }), participants, clock);

    seats.forEach((seat, i) => {
      const characterId = `c${i + 1}`;
      if (seat.kind === "human") this.humans.set(seat.userId, { userId: seat.userId, characterId, history: [] });
      else this.bots.set(characterId, new BotController(createBotProfile(rng.fork(characterId)), rng.fork(`${characterId}/decide`)));
    });

    this.session.onNotice = (characterId, notice) => this.route(characterId, notice);
    this.session.chooseLeisure = (characterId, options) => this.bots.get(characterId)?.chooseLeisure(options) as never;
    this.session.onPublic = (entry) => {
      if (entry.kind !== "move") {
        this.feed.push(entry);
        if (this.feed.length > FEED_LIMIT) this.feed.shift();
      }
      for (const h of this.humans.values()) this.events.toUser(h.userId, "game:feed", entry);
    };
  }

  /** Bot profiles, for persistence. */
  botProfile(characterId: string): BotProfile | undefined {
    return this.bots.get(characterId)?.profile;
  }

  start(): void {
    this.session.start();
    const started = this.session.log[0];
    if (started?.type === "session_started") {
      for (const c of started.characters) {
        const human = [...this.humans.values()].find((h) => h.characterId === c.id);
        this.roster.push({ characterId: c.id, name: c.name, career: c.career, isBot: c.isBot, userId: human?.userId ?? null });
      }
    }
    for (const h of this.humans.values()) this.events.toUser(h.userId, "game:started", this.snapshot(h.userId));
    this.afterChange();
  }

  submit(userId: string, instanceId: string, choiceId: string): SubmitResult {
    const seat = this.humans.get(userId);
    if (!seat) return { ok: false, reason: "not a player in this session" };
    const result = this.session.submitDecision(seat.characterId, instanceId, choiceId);
    if (result.ok && seat.pending?.instanceId === instanceId) seat.pending = undefined;
    this.afterChange();
    return result;
  }

  /** A human plays a prank. */
  mischief(userId: string, mischiefId: string, targetId: string): SubmitResult {
    const seat = this.humans.get(userId);
    if (!seat) return { ok: false, reason: "not a player in this session" };
    const result = this.session.mischief(seat.characterId, mischiefId, targetId);
    this.afterChange();
    return result;
  }

  /** Everything a (re)connecting player needs to render the game. */
  snapshot(userId: string) {
    const seat = this.humans.get(userId);
    return {
      sessionId: this.id,
      characterId: seat?.characterId,
      state: this.session.state,
      sessionTime: this.session.result().durationMs,
      durationSeconds: this.session.config.durationSeconds,
      timeScale: this.timeScale,
      roster: this.roster.map(({ userId: _u, ...r }) => r),
      positions: this.session.positions(),
      mischief: seat ? this.session.mischiefState(seat.characterId) : null,
      homes: this.roster.map((r) => ({ characterId: r.characterId, home: this.homeOf(r.characterId) })),
      pending: seat?.pending ?? null,
      history: seat?.history ?? [],
      feed: this.feed,
    };
  }

  private homeOf(characterId: string): string | undefined {
    const start = this.session.log[0];
    return start?.type === "session_started" ? start.characters.find((c) => c.id === characterId)?.home : undefined;
  }

  cancel(): void {
    this.session.cancel();
    this.afterChange();
  }

  // ------------------------------------------------------------------ internals

  private route(characterId: string, notice: Notice): void {
    const bot = this.bots.get(characterId);
    if (bot) {
      bot.observe(notice);
      if (notice.kind === "event" && notice.view.offer.choices.length > 0) {
        const decision = bot.decide(notice.view);
        if (decision) {
          const handle = setTimeout(() => {
            this.botTimers.delete(handle);
            if (this.finished) return;
            this.session.submitDecision(characterId, notice.view.offer.instanceId, decision.choiceId);
            this.afterChange();
          }, decision.thinkMs / this.timeScale);
          this.botTimers.add(handle);
        }
      }
      if (notice.kind === "resolved") {
        const plan = bot.planMischief();
        if (plan) {
          const handle = setTimeout(() => {
            this.botTimers.delete(handle);
            if (this.finished) return;
            this.session.mischief(characterId, plan.mischiefId, plan.targetId);
            this.afterChange();
          }, 1200 / this.timeScale);
          this.botTimers.add(handle);
        }
      }
      return;
    }
    const seat = [...this.humans.values()].find((h) => h.characterId === characterId);
    if (!seat) return;
    if (notice.kind === "event") seat.pending = notice.view.offer.choices.length > 0 ? notice.view.offer : undefined;
    if (notice.kind === "resolved" && seat.pending?.instanceId === notice.instanceId) seat.pending = undefined;
    seat.history.push(notice);
    if (seat.history.length > HISTORY_LIMIT) seat.history.shift();
    this.events.toUser(seat.userId, notice.kind === "session_completed" ? "game:ended" : "game:notice", notice);
    if (notice.kind === "resolved") this.events.toUser(seat.userId, "game:mischief_state", this.session.mischiefState(characterId));
  }

  /** Persist new decisions, re-arm the engine timer, detect the end. */
  private afterChange(): void {
    const log = this.session.log;
    for (; this.logCursor < log.length; this.logCursor++) {
      const e = log[this.logCursor] as LogEntry;
      if (e.type === "decision") this.events.onDecision(this.id, e);
    }
    if (this.session.state !== "active") {
      this.finish();
      return;
    }
    if (this.timer) clearTimeout(this.timer);
    const next = this.session.nextWakeAt();
    if (next === undefined) return;
    const now = (performance.now() - this.startedAtWall) * this.timeScale;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.session.processTimers();
      this.afterChange();
    }, Math.max(0, (next - now) / this.timeScale));
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    if (this.timer) clearTimeout(this.timer);
    for (const t of this.botTimers) clearTimeout(t);
    this.botTimers.clear();
    this.events.onFinished(this, this.session.result());
  }
}
