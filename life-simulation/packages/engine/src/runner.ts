/**
 * Runs a whole session in virtual time with synchronous controllers.
 * Used by tests and the simulator; the multiplayer server will drive `Session` with a real clock instead.
 */
import { Rng, TimerQueue, VirtualClock, type CharacterView, type Controller, type Decision, type Notice, type SchemeBoost } from "@lifesim/core";
import type { ContentBundle } from "@lifesim/content";
import { resolveConfig, type SessionConfig } from "./config";
import { Session, type ParticipantSpec, type PublicEntry, type SessionResult } from "./session";

export type { Controller, Decision } from "@lifesim/core";

export interface ParticipantSetup extends ParticipantSpec {
  controller: Controller;
}

export interface RunOptions {
  content: ContentBundle;
  config: Partial<SessionConfig> & { seed: string };
  participants: ParticipantSetup[];
  /** Optional hook for every notice (e.g. tests asserting on what characters see). */
  onNotice?: (characterId: string, notice: Notice) => void;
  /** Optional hook for the public feed (moods, events, phases…). */
  onPublic?: (entry: PublicEntry) => void;
  /** Pranks to play at fixed times (replays). */
  mischief?: { t: number; characterId: string; mischiefId: string; targetId: string }[];
  /** T12: ghost actions at fixed times (replays). */
  ghost?: { t: number; characterId: string; action: "nudge" | "vote" | "will"; target: string }[];
  /** T9: guesses at fixed times (replays). */
  guesses?: { t: number; characterId: string; instanceId: string; deciderId: string; choiceId: string }[];
  /** T8: scheme boosts at fixed times (replays). */
  boosts?: { t: number; characterId: string; schemeId: string; boost: SchemeBoost; accompliceId?: string }[];
}

type Submission =
  | { kind: "decision"; characterId: string; instanceId: string; choiceId: string }
  | { kind: "mischief"; characterId: string; mischiefId: string; targetId: string }
  | { kind: "boost"; characterId: string; schemeId: string; boost: SchemeBoost; accompliceId?: string }
  | { kind: "guess"; characterId: string; instanceId: string; deciderId: string; choiceId: string }
  | { kind: "ghost"; characterId: string; action: "nudge" | "vote" | "will"; target: string };

export function runSession(opts: RunOptions): SessionResult {
  const clock = new VirtualClock();
  const config = resolveConfig(opts.config);
  const ids = opts.participants.map((p, i) => p.id ?? `c${i + 1}`);
  const session = new Session(opts.content, config, opts.participants.map((p, i) => ({ ...p, id: ids[i] })), clock);
  const controllers = new Map(opts.participants.map((p, i) => [ids[i] as string, p.controller]));
  const submissions = new TimerQueue<Submission>();
  for (const m of opts.mischief ?? []) submissions.push(m.t, { kind: "mischief", characterId: m.characterId, mischiefId: m.mischiefId, targetId: m.targetId });
  for (const b of opts.boosts ?? []) submissions.push(b.t, { kind: "boost", ...b });
  for (const g of opts.guesses ?? []) submissions.push(g.t, { kind: "guess", ...g });
  for (const g of opts.ghost ?? []) submissions.push(g.t, { kind: "ghost", ...g });

  session.onNotice = (characterId, notice) => {
    opts.onNotice?.(characterId, notice);
    const ctrl = controllers.get(characterId);
    if (!ctrl) return;
    ctrl.observe?.(notice);
    if (notice.kind === "event" && notice.view.offer.choices.length > 0) {
      const d = ctrl.decide(notice.view);
      if (d) {
        submissions.push(clock.now() + Math.max(0, Math.round(d.thinkMs)), {
          kind: "decision",
          characterId,
          instanceId: notice.view.offer.instanceId,
          choiceId: d.choiceId,
        });
      }
    }
    if (notice.kind === "scheme" && ctrl.planBoost) {
      const plan = ctrl.planBoost(notice);
      if (plan) submissions.push(clock.now() + 800, { kind: "boost", characterId, ...plan });
    }
    if (notice.kind === "resolved" && ctrl.planMischief) {
      const plan = ctrl.planMischief();
      if (plan) submissions.push(clock.now() + 1200, { kind: "mischief", characterId, ...plan });
    }
  };

  if (opts.onPublic) session.onPublic = opts.onPublic;
  session.chooseLeisure = (characterId, options) => controllers.get(characterId)?.chooseLeisure?.(options) as never;
  session.start();
  let guard = 0;
  while (session.state === "active") {
    if (++guard > 1_000_000) throw new Error("session did not terminate");
    const a = session.nextWakeAt();
    const b = submissions.nextAt();
    const t = a === undefined ? b : b === undefined ? a : Math.min(a, b);
    if (t === undefined) throw new Error("session stalled: nothing scheduled");
    clock.advanceTo(t);
    // Decisions arriving exactly at a deadline still count.
    for (const s of submissions.popDue(t)) {
      if (s.kind === "decision") session.submitDecision(s.characterId, s.instanceId, s.choiceId);
      else if (s.kind === "boost") session.boostScheme(s.characterId, s.schemeId, s.boost, s.accompliceId);
      else if (s.kind === "guess") session.guess(s.characterId, s.instanceId, s.deciderId, s.choiceId);
      else if (s.kind === "ghost") {
        if (s.action === "nudge") session.ghostNudge(s.characterId, s.target);
        else if (s.action === "vote") session.ghostVote(s.characterId, s.target);
        else session.ghostWill(s.characterId, s.target);
      }
      else session.mischief(s.characterId, s.mischiefId, s.targetId);
    }
    session.processTimers();
  }
  return session.result();
}

/** Uniformly random decisions; used to test the engine independently of the bot engine. */
export class RandomController implements Controller {
  constructor(
    private readonly rng: Rng,
    /** Probability of not answering at all (exercises timeouts and defaults). */
    private readonly silence = 0.05,
  ) {}

  decide(view: CharacterView): Decision | null {
    if (this.rng.chance(this.silence)) return null;
    const window = view.offer.deadlineAt - view.now;
    return {
      choiceId: this.rng.pick(view.offer.choices).id,
      thinkMs: this.rng.int(800, Math.max(1000, Math.floor(window * 0.9))),
    };
  }
}
