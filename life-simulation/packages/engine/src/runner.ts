/**
 * Runs a whole session in virtual time with synchronous controllers.
 * Used by tests and the simulator; the multiplayer server will drive `Session` with a real clock instead.
 */
import { Rng, TimerQueue, VirtualClock, type CharacterView, type Controller, type Decision, type Notice } from "@lifesim/core";
import type { ContentBundle } from "@lifesim/content";
import { resolveConfig, type SessionConfig } from "./config";
import { Session, type ParticipantSpec, type SessionResult } from "./session";

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
  /** Pranks to play at fixed times (replays). */
  mischief?: { t: number; characterId: string; mischiefId: string; targetId: string }[];
}

type Submission =
  | { kind: "decision"; characterId: string; instanceId: string; choiceId: string }
  | { kind: "mischief"; characterId: string; mischiefId: string; targetId: string };

export function runSession(opts: RunOptions): SessionResult {
  const clock = new VirtualClock();
  const config = resolveConfig(opts.config);
  const ids = opts.participants.map((p, i) => p.id ?? `c${i + 1}`);
  const session = new Session(opts.content, config, opts.participants.map((p, i) => ({ ...p, id: ids[i] })), clock);
  const controllers = new Map(opts.participants.map((p, i) => [ids[i] as string, p.controller]));
  const submissions = new TimerQueue<Submission>();
  for (const m of opts.mischief ?? []) submissions.push(m.t, { kind: "mischief", characterId: m.characterId, mischiefId: m.mischiefId, targetId: m.targetId });

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
    if (notice.kind === "resolved" && ctrl.planMischief) {
      const plan = ctrl.planMischief();
      if (plan) submissions.push(clock.now() + 1200, { kind: "mischief", characterId, ...plan });
    }
  };

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
