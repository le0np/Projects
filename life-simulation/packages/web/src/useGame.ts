/**
 * Socket.IO connection and all realtime game state. The client only displays what the
 * server sends and submits choices; it never computes outcomes (server-authoritative).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { Attribute, LifeRecap, Notice, OfferView, OtherCharacterView, ParticipantInfo } from "@lifesim/core";

export type PublicEntry =
  | { kind: "event"; t: number; instanceId: string; title: string; text: string; participants: ParticipantInfo[] }
  | { kind: "ended"; t: number; characterId: string; name: string; status: string; cause: string }
  | { kind: "season"; t: number; year: number; season: string }
  | { kind: "upheaval"; t: number; id: string; title: string; text: string; active: boolean }
  | { kind: "move"; t: number; characterId: string; from: [number, number]; path: [number, number][]; departAt: number; msPerTile: number; to: string | null };

export interface Walk {
  pos: [number, number];
  trip: { from: [number, number]; path: [number, number][]; departAt: number; msPerTile: number } | null;
}

export interface Snapshot {
  sessionId: string;
  characterId?: string;
  state: string;
  sessionTime: number;
  durationSeconds: number;
  timeScale: number;
  roster: { characterId: string; name: string; career: string; isBot: boolean }[];
  pending: OfferView | null;
  history: Notice[];
  feed: PublicEntry[];
  positions?: { characterId: string; pos: [number, number]; trip: Walk["trip"]; status: string }[];
  mischief?: { charges: number; options: { id: string; label: string; description: string }[] } | null;
}

export interface MatchStatus {
  position: number;
  queueSize: number;
  waitedMs: number;
  fillInMs: number;
}

export interface GameState {
  sessionId: string;
  characterId?: string;
  timeScale: number;
  durationSeconds: number;
  roster: Snapshot["roster"];
  /** Session time and wall-clock time at the last sync, to run local clocks. */
  sync: { sessionTime: number; wall: number };
  pending: OfferView | null;
  /** Wall-clock time the current offer was received. */
  pendingReceivedAt: number;
  submitted: string | null;
  history: Notice[];
  feed: PublicEntry[];
  attrs?: Record<Attribute, number>;
  /** Life calendar; age is derived from the last view's age plus the years since. */
  calendar?: { year: number; season: string };
  ageBase?: { age: number; year: number };
  others: OtherCharacterView[];
  ended?: { status: string; cause: string };
  recap?: LifeRecap;
  /** Upheaval currently hitting the town, if any. */
  upheaval?: { title: string; text: string } | null;
  /** Where everyone is walking (server-computed routes; the client only animates them). */
  walks: Record<string, Walk>;
  mischief?: Snapshot["mischief"];
}

export interface Lobby {
  online: number;
  inQueue: number;
  activeSessions: number;
}

function stateFromSnapshot(s: Snapshot): GameState {
  const lastView = [...s.history].reverse().find((n): n is Extract<Notice, { kind: "event" }> => n.kind === "event")?.view;
  const ended = s.history.find((n): n is Extract<Notice, { kind: "ended" }> => n.kind === "ended");
  return {
    sessionId: s.sessionId,
    characterId: s.characterId,
    timeScale: s.timeScale,
    durationSeconds: s.durationSeconds,
    roster: s.roster,
    sync: { sessionTime: s.sessionTime, wall: Date.now() },
    pending: s.pending,
    pendingReceivedAt: Date.now() - (s.pending ? (s.sessionTime - s.pending.offeredAt) / s.timeScale : 0),
    submitted: null,
    history: s.history,
    feed: s.feed,
    attrs: lastView?.self.attrs,
    calendar: [...s.feed].reverse().find((f): f is Extract<PublicEntry, { kind: "season" }> => f.kind === "season") ?? lastView?.calendar,
    ageBase: lastView ? { age: lastView.self.age, year: lastView.calendar.year } : undefined,
    others: lastView?.others ?? [],
    ...(ended ? { ended: { status: ended.status, cause: ended.cause } } : {}),
    upheaval: (() => {
      const last = [...s.feed].reverse().find((f): f is Extract<PublicEntry, { kind: "upheaval" }> => f.kind === "upheaval");
      return last?.active ? { title: last.title, text: last.text } : null;
    })(),
    mischief: s.mischief,
    walks: Object.fromEntries((s.positions ?? []).map((p) => [p.characterId, { pos: p.pos, trip: p.trip }])),
  };
}

export function useGame(token: string | null, onUnauthorized: () => void) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lobby, setLobby] = useState<Lobby>({ online: 0, inQueue: 0, activeSessions: 0 });
  const [match, setMatch] = useState<MatchStatus | null>(null);
  const [searching, setSearching] = useState(false);
  const [game, setGame] = useState<GameState | null>(null);

  useEffect(() => {
    if (!token) return;
    const socket = io({ auth: { token }, transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) => {
      if (err.message === "unauthorized") onUnauthorized();
    });
    socket.on("lobby:state", setLobby);
    socket.on("match:status", (s: MatchStatus) => setMatch(s));

    const start = (s: Snapshot) => {
      setSearching(false);
      setMatch(null);
      setGame(stateFromSnapshot(s));
    };
    socket.on("game:started", start);
    socket.on("game:state", start);

    socket.on("game:feed", (entry: PublicEntry) =>
      setGame((g) =>
        !g
          ? g
          : entry.kind === "move" // positions feed the map, not the news list
            ? {
                ...g,
                walks: {
                  ...g.walks,
                  [entry.characterId]: {
                    pos: entry.path[entry.path.length - 1] ?? entry.from,
                    trip: { from: entry.from, path: entry.path, departAt: entry.departAt, msPerTile: entry.msPerTile },
                  },
                },
              }
            : {
              ...g,
              feed: [...g.feed, entry].slice(-50),
              ...(entry.kind === "season" ? { calendar: { year: entry.year, season: entry.season } } : {}),
              ...(entry.kind === "upheaval" ? { upheaval: entry.active ? { title: entry.title, text: entry.text } : null } : {}),
            },
      ),
    );

    socket.on("game:notice", (n: Notice) =>
      setGame((g) => {
        if (!g) return g;
        const history = [...g.history, n].slice(-30);
        if (n.kind === "event") {
          return {
            ...g,
            history,
            attrs: n.view.self.attrs,
            calendar: n.view.calendar,
            ageBase: { age: n.view.self.age, year: n.view.calendar.year },
            others: n.view.others,
            sync: { sessionTime: n.view.now, wall: Date.now() },
            pending: n.view.offer.choices.length > 0 ? n.view.offer : g.pending,
            pendingReceivedAt: n.view.offer.choices.length > 0 ? Date.now() : g.pendingReceivedAt,
            submitted: n.view.offer.choices.length > 0 ? null : g.submitted,
          };
        }
        if (n.kind === "resolved") {
          const attrs = g.attrs ? { ...g.attrs } : undefined;
          if (attrs) for (const [a, d] of Object.entries(n.selfChanges) as [Attribute, number][]) attrs[a] = Math.max(0, Math.min(100, attrs[a] + d));
          const clears = g.pending?.instanceId === n.instanceId;
          return {
            ...g,
            history,
            attrs,
            sync: { sessionTime: n.t, wall: Date.now() },
            pending: clears ? null : g.pending,
            submitted: clears ? null : g.submitted,
          };
        }
        if (n.kind === "ended") return { ...g, history, ended: { status: n.status, cause: n.cause }, pending: null };
        if (n.kind === "upheaval") {
          const attrs = g.attrs ? { ...g.attrs } : undefined;
          if (attrs) for (const [a, d] of Object.entries(n.selfChanges) as [Attribute, number][]) attrs[a] = Math.max(0, Math.min(100, attrs[a] + d));
          return { ...g, history, attrs };
        }
        return { ...g, history };
      }),
    );
    socket.on("game:mischief_state", (m: GameState["mischief"]) => setGame((g) => (g ? { ...g, mischief: m } : g)));
    socket.on("game:ended", (n: Notice) => {
      if (n.kind === "session_completed") setGame((g) => (g ? { ...g, pending: null, recap: n.recap } : g));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, onUnauthorized]);

  const findMatch = useCallback(async (career: string) => {
    const res = (await socketRef.current?.emitWithAck("match:find", { career })) as { ok: boolean; error?: string } | undefined;
    if (res?.ok) setSearching(true);
    return res;
  }, []);

  const cancelMatch = useCallback(async () => {
    await socketRef.current?.emitWithAck("match:cancel", {});
    setSearching(false);
    setMatch(null);
  }, []);

  const decide = useCallback(
    async (choiceId: string) => {
      if (!game?.pending) return;
      setGame((g) => (g ? { ...g, submitted: choiceId } : g));
      const res = (await socketRef.current?.emitWithAck("game:decide", {
        sessionId: game.sessionId,
        instanceId: game.pending.instanceId,
        choiceId,
      })) as { ok: boolean; reason?: string } | undefined;
      if (!res?.ok) setGame((g) => (g ? { ...g, submitted: null } : g));
      return res;
    },
    [game?.pending, game?.sessionId],
  );

  const playMischief = useCallback(
    async (mischiefId: string, targetId: string) => {
      if (!game) return;
      const res = (await socketRef.current?.emitWithAck("game:mischief", { sessionId: game.sessionId, mischiefId, targetId })) as
        | { ok: boolean; reason?: string; state?: GameState["mischief"] }
        | undefined;
      if (res?.state) setGame((g) => (g ? { ...g, mischief: res.state } : g));
      return res;
    },
    [game],
  );

  const leaveGame = useCallback(() => setGame(null), []);

  return { connected, lobby, match, searching, game, findMatch, cancelMatch, decide, playMischief, leaveGame };
}
