/**
 * HTTP API (Fastify) + realtime channel (Socket.IO) — the modular monolith's outer layer.
 *
 * HTTP:   register, login, logout, profile, careers, lobby info, session logs.
 * Socket: lobby presence, matchmaking, game notices, decisions, reconnect/resume.
 */
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { Server as SocketServer, type Socket } from "socket.io";
import { z } from "zod";
import { Rng } from "@lifesim/core";
import type { ContentBundle } from "@lifesim/content";
import { formatLog } from "@lifesim/engine";
import type { ServerConfig } from "./config";
import type { Database } from "./db/database";
import { LiveSession, type Seat } from "./live-session";
import { Matchmaker, type Ticket } from "./matchmaking";
import { Repo, type UserRow } from "./repo";

export interface App {
  http: FastifyInstance;
  io: SocketServer;
  repo: Repo;
  matchmaker: Matchmaker;
  live: ReadonlyMap<string, LiveSession>;
  close(): Promise<void>;
}

const RegisterBody = z.object({
  username: z.string().regex(/^[A-Za-z0-9_]{3,20}$/, "3–20 letters, digits or underscores"),
  email: z.email(),
  password: z.string().min(8, "at least 8 characters").max(200),
});
const LoginBody = z.object({ login: z.string().min(1), password: z.string().min(1) });
const AvatarBody = z.object({ avatar: z.string().regex(/^[a-z0-9_-]{1,32}$/) });
const FindMatch = z.object({ career: z.string() });
const Decide = z.object({ sessionId: z.string(), instanceId: z.string(), choiceId: z.string() });

type Ack = (response: unknown) => void;

export async function buildApp(opts: { db: Database; content: ContentBundle; config: ServerConfig; logger?: boolean }): Promise<App> {
  const { content, config } = opts;
  const repo = new Repo(opts.db);
  const http = Fastify({ logger: opts.logger ?? false });
  const io = new SocketServer(http.server, { cors: { origin: true } });

  const live = new Map<string, LiveSession>(); // sessionId → session
  const liveByUser = new Map<string, LiveSession>();
  const sockets = new Map<string, Set<string>>(); // userId → socket ids
  const careerIds = [...content.careers.keys()];
  const seatRng = new Rng(`seats-${Date.now()}`);

  // ------------------------------------------------------------------ helpers

  const lobbyState = () => ({ online: sockets.size, inQueue: matchmaker.size, activeSessions: live.size });
  const broadcastLobby = () => io.emit("lobby:state", lobbyState());
  const toUser = (userId: string, event: string, payload: unknown) => io.to(`user:${userId}`).emit(event, payload);

  async function authUser(req: FastifyRequest, reply: FastifyReply): Promise<UserRow | null> {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const user = token ? await repo.userByToken(token) : null;
    if (!user) void reply.code(401).send({ error: "unauthorized" });
    return user;
  }

  function badRequest(reply: FastifyReply, error: z.ZodError) {
    return reply.code(400).send({ error: "invalid_request", details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  }

  // ------------------------------------------------------------------ matchmaking → sessions

  const matchmaker = new Matchmaker({
    sessionSize: config.sessionSize,
    maxHumans: config.maxHumans,
    fillAfterMs: config.fillAfterSeconds * 1000,
    onMatch: (tickets) => void startSession(tickets),
  });

  async function startSession(tickets: Ticket[]): Promise<void> {
    const seats: Seat[] = tickets.map((t) => ({ kind: "human", userId: t.userId, name: t.name, career: t.career }));
    while (seats.length < config.sessionSize) seats.push({ kind: "bot", career: seatRng.pick(careerIds) });
    const session = new LiveSession(
      content,
      { durationSeconds: config.sessionDurationSeconds },
      seats,
      {
        toUser,
        onDecision: (sessionId, entry) => void repo.decisionMade(sessionId, entry).catch((err) => http.log.error(err)),
        onFinished: (s, result) => {
          live.delete(s.id);
          for (const userId of s.humans.keys()) if (liveByUser.get(userId) === s) liveByUser.delete(userId);
          const userOf = (key: string) => s.roster.find((r) => r.characterId === key)?.userId ?? null;
          void repo
            .sessionFinished(s.id, result, userOf)
            .catch((err) => http.log.error(err))
            .finally(broadcastLobby);
        },
      },
      { timeScale: config.timeScale },
    );
    live.set(session.id, session);
    for (const t of tickets) liveByUser.set(t.userId, session);
    try {
      session.start();
      await repo.sessionStarted({
        id: session.id,
        engineId: session.session.id,
        seed: session.session.config.seed,
        config: session.session.config,
        content,
        participants: session.roster.map((r) => ({
          characterKey: r.characterId,
          userId: r.userId,
          name: r.name,
          career: r.career,
          isBot: r.isBot,
          botProfile: session.botProfile(r.characterId),
        })),
      });
    } catch (err) {
      http.log.error(err);
      session.cancel();
    }
    broadcastLobby();
  }

  const matchTimer = setInterval(() => {
    matchmaker.tick();
    for (const userId of sockets.keys()) {
      const status = matchmaker.status(userId);
      if (status) toUser(userId, "match:status", { state: "searching", ...status });
    }
  }, 1000);

  // ------------------------------------------------------------------ HTTP

  http.get("/api/health", async () => ({ ok: true, db: opts.db.driver, content: content.hash, ...lobbyState() }));

  http.post("/api/register", async (req, reply) => {
    const body = RegisterBody.safeParse(req.body);
    if (!body.success) return badRequest(reply, body.error);
    const result = await repo.register(body.data.username, body.data.email, body.data.password);
    if ("error" in result) return reply.code(409).send({ error: "username_or_email_taken" });
    return reply.code(201).send(result);
  });

  http.post("/api/login", async (req, reply) => {
    const body = LoginBody.safeParse(req.body);
    if (!body.success) return badRequest(reply, body.error);
    const result = await repo.login(body.data.login, body.data.password);
    if (!result) return reply.code(401).send({ error: "invalid_credentials" });
    return result;
  });

  http.post("/api/logout", async (req, reply) => {
    const header = req.headers.authorization ?? "";
    if (header.startsWith("Bearer ")) await repo.revokeToken(header.slice(7));
    return reply.code(204).send();
  });

  http.get("/api/me", async (req, reply) => {
    const user = await authUser(req, reply);
    if (!user) return;
    const profile = await repo.profile(user.id);
    const s = liveByUser.get(user.id);
    return { ...profile, email: user.email, activeSessionId: s?.id ?? null, inQueue: matchmaker.has(user.id) };
  });

  http.put("/api/me/avatar", async (req, reply) => {
    const user = await authUser(req, reply);
    if (!user) return;
    const body = AvatarBody.safeParse(req.body);
    if (!body.success) return badRequest(reply, body.error);
    await repo.setAvatar(user.id, body.data.avatar);
    return reply.code(204).send();
  });

  http.get("/api/careers", async () =>
    [...content.careers.values()].map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      abilities: c.abilities.map((a) => ({ name: a.name, description: a.description })),
      strengths: c.strengths,
      weaknesses: c.weaknesses,
    })),
  );

  http.get("/api/lobby", async () => lobbyState());

  /** Complete session log, for participants (acceptance criterion "complete session logs can be inspected"). */
  http.get<{ Params: { id: string } }>("/api/sessions/:id/log", async (req, reply) => {
    const user = await authUser(req, reply);
    if (!user) return;
    if (!(await repo.isParticipant(req.params.id, user.id))) return reply.code(404).send({ error: "not_found" });
    const log = await repo.sessionLog(req.params.id);
    if (!log) return reply.code(409).send({ error: "session_still_running" });
    return { log, text: formatLog(log) };
  });

  // ------------------------------------------------------------------ Socket.IO

  io.use(async (socket, next) => {
    const token = typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : "";
    const user = token ? await repo.userByToken(token) : null;
    if (!user) return next(new Error("unauthorized"));
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as UserRow;
    void socket.join(`user:${user.id}`);
    const set = sockets.get(user.id) ?? new Set();
    set.add(socket.id);
    sockets.set(user.id, set);
    broadcastLobby();

    // Reconnection: put the player straight back into their running session.
    const running = liveByUser.get(user.id);
    if (running) socket.emit("game:state", running.snapshot(user.id));
    socket.emit("lobby:state", lobbyState());

    socket.on("match:find", (raw: unknown, ack: Ack = () => {}) => {
      const body = FindMatch.safeParse(raw);
      if (!body.success || !content.careers.has(body.data.career)) return ack({ ok: false, error: "unknown_career" });
      if (liveByUser.has(user.id)) return ack({ ok: false, error: "already_in_session" });
      matchmaker.enqueue(user.id, user.username, body.data.career);
      ack({ ok: true, status: matchmaker.status(user.id) ?? { state: "matched" } });
      broadcastLobby();
    });

    socket.on("match:cancel", (_raw: unknown, ack: Ack = () => {}) => {
      ack({ ok: matchmaker.cancel(user.id) });
      broadcastLobby();
    });

    socket.on("game:decide", (raw: unknown, ack: Ack = () => {}) => {
      const body = Decide.safeParse(raw);
      if (!body.success) return ack({ ok: false, reason: "invalid request" });
      const s = liveByUser.get(user.id);
      if (!s || s.id !== body.data.sessionId) return ack({ ok: false, reason: "not in this session" });
      ack(s.submit(user.id, body.data.instanceId, body.data.choiceId));
    });

    socket.on("game:resume", (_raw: unknown, ack: Ack = () => {}) => {
      const s = liveByUser.get(user.id);
      ack(s ? s.snapshot(user.id) : null);
    });

    socket.on("disconnect", () => {
      const set = sockets.get(user.id);
      set?.delete(socket.id);
      if (set && set.size === 0) {
        sockets.delete(user.id);
        // An absent player should not be matched; a running session keeps their seat (defaults apply).
        matchmaker.cancel(user.id);
      }
      broadcastLobby();
    });
  });

  return {
    http,
    io,
    repo,
    matchmaker,
    live,
    async close() {
      clearInterval(matchTimer);
      for (const s of [...live.values()]) s.cancel();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await http.close().catch(() => {});
    },
  };
}
