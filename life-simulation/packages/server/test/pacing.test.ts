import { describe, expect, it } from "vitest";
import type { Notice, OfferView } from "@lifesim/core";
import { loadContent, type ContentBundle } from "@lifesim/content";
import { LiveSession, type Seat } from "../src";
import { buildContent, event } from "../../engine/test/helpers";

const content = loadContent();
const seats: Seat[] = [
  { kind: "human", userId: "u1", name: "Ana", career: "lawyer" },
  { kind: "bot", career: "doctor" },
  { kind: "bot", career: "teacher" },
  { kind: "bot", career: "mechanic" },
  { kind: "bot", career: "civilian" },
  { kind: "bot", career: "journalist" },
];

const duoChoices = [
  { id: "yes", label: "Yes", tags: ["help"] },
  { id: "no", label: "No", tags: ["refuse"], default: true },
];

interface Hooks {
  onOffer: (s: LiveSession, offer: OfferView, userId: string) => void;
  onResolved?: (s: LiveSession, n: Extract<Notice, { kind: "resolved" }>, userId: string) => void;
}

/** A live session that reports every event offered to (and resolved for) the human. */
function live(
  timeScale: number,
  paceScale: number,
  hooks: Hooks,
  bundle: ContentBundle = content,
  roster: Seat[] = seats,
  durationSeconds = 480,
  seed = `pace-${timeScale}-${paceScale}`,
): LiveSession {
  const s: LiveSession = new LiveSession(
    bundle,
    { durationSeconds },
    roster,
    {
      toUser: (userId, ev, payload) => {
        if (ev !== "game:notice") return;
        const n = payload as Notice;
        if (n.kind === "event" && n.view.offer.choices.length > 0) hooks.onOffer(s, n.view.offer, userId);
        if (n.kind === "resolved") hooks.onResolved?.(s, n, userId);
      },
      onDecision: () => {},
      onFinished: () => {},
    },
    { timeScale, paceScale, seed },
  );
  return s;
}

describe("T1: live deadlines are in real seconds", () => {
  for (const timeScale of [6, 1]) {
    it(`the first offer at TIME_SCALE=${timeScale} leaves ≥ 15 s (important ≥ 25 s) of real time`, async () => {
      const offer = await new Promise<OfferView>((resolve) => {
        live(timeScale, 1, {
          onOffer: (s, o) => {
            s.cancel();
            resolve(o);
          },
        }).start();
      });
      const realSeconds = (offer.deadlineAt - offer.offeredAt) / timeScale / 1000;
      expect(realSeconds).toBeGreaterThanOrEqual(offer.importance === "important" ? 25 : 15);
      expect(realSeconds).toBeLessThanOrEqual(45);
    }, 20_000);
  }

  it("with two humans in one event: +10 s, and it resolves the moment the second one decides", async () => {
    const duo = buildContent([event({ id: "duo", roles: { a: { count: 1 }, b: { count: 1 } }, choices: { a: duoChoices, b: duoChoices }, outcomes: [{ id: "done" }] })]);
    const two: Seat[] = [
      { kind: "human", userId: "u1", name: "Ana", career: "lawyer" },
      { kind: "human", userId: "u2", name: "Ben", career: "doctor" },
    ];
    let offer: OfferView | undefined;
    let answeredAt = 0;
    const lag = await new Promise<number>((resolve) => {
      live(
        6,
        1,
        {
          onOffer: (s, o, userId) => {
            offer = o;
            if (userId === "u1") setTimeout(() => expect(s.submit("u1", o.instanceId, "yes")).toEqual({ ok: true }), 20);
            else
              setTimeout(() => {
                answeredAt = performance.now();
                s.submit("u2", o.instanceId, "no");
              }, 100);
          },
          onResolved: (s, _n, userId) => {
            if (userId !== "u2") return;
            s.cancel();
            resolve(performance.now() - answeredAt);
          },
        },
        duo,
        two,
      ).start();
    });
    expect((offer!.deadlineAt - offer!.offeredAt) / 6 / 1000).toBeGreaterThanOrEqual(25); // 15 s minimum + 10 s
    expect(lag).toBeLessThan(50);
  }, 20_000);

  it("resolves a shared event as soon as the human has decided, without waiting for thinking bots", async () => {
    // Every event pairs the human with a bot who decides too.
    const duo = buildContent([event({ id: "duo", roles: { a: { count: 1 }, b: { count: 1 } }, choices: { a: duoChoices, b: duoChoices }, outcomes: [{ id: "done" }] })]);
    const answered = new Map<string, number>();
    const lags: { ms: number; others: number }[] = [];
    await new Promise<void>((resolve) => {
      live(
        6,
        0.5,
        {
          onOffer: (s, o) =>
            // Like a real player: the answer arrives after everyone has been offered the event.
            setTimeout(() => {
              answered.set(o.instanceId, performance.now());
              expect(s.submit("u1", o.instanceId, o.choices[0]!.id)).toEqual({ ok: true });
            }, 20),
          onResolved: (s, n) => {
            if (!answered.has(n.instanceId)) return;
            lags.push({ ms: performance.now() - answered.get(n.instanceId)!, others: n.participants.length - 1 });
            if (lags.length >= 2) {
              s.cancel();
              resolve();
            }
          },
        },
        duo,
      ).start();
    });
    // The bot thinks for a share of a ≥ 7.5 s deadline (≥ 0.6 s); the event resolved in the same tick instead.
    for (const l of lags) {
      expect(l.others).toBe(1);
      expect(l.ms).toBeLessThan(50);
    }
  }, 40_000);
});

describe("T3: the finale live", () => {
  it("bots still thinking answer at once when the finale is due, so the human does not wait for them", async () => {
    const timeScale = 4;
    let lastResolved = 0;
    const result = await new Promise<{ gap: number; eventId: string }>((resolve, reject) => {
      const s = live(
        timeScale,
        0.3,
        {
          onOffer: (session, o) => {
            if (o.eventId.startsWith("finale_")) {
              session.cancel();
              resolve({ gap: performance.now() - lastResolved, eventId: o.eventId });
              return;
            }
            setTimeout(() => session.submit("u1", o.instanceId, o.choices[0]!.id), 20);
          },
          onResolved: (_s, n) => {
            if (n.myChoice) lastResolved = performance.now();
          },
        },
        content,
        seats,
        60,
        "finale-live",
      );
      setTimeout(() => reject(new Error("no finale within 40 s")), 40_000);
      s.start();
    });
    // Rest is 2–3 s at PACE_SCALE 0.3; bot-only events would otherwise take up to 10 s more.
    expect(result.gap).toBeLessThan(5_000);
  }, 45_000);
});
