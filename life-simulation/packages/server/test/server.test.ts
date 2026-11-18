import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import type { LifeRecap, Notice } from "@lifesim/core";
import { loadContent } from "@lifesim/content";
import { Matchmaker, buildApp, configFromEnv, migrate, openPglite, openPostgres, type App, type Database } from "../src";

const content = loadContent();
let db: Database;
let app: App;
let base: string;

beforeAll(async () => {
  // Real PostgreSQL when TEST_DATABASE_URL points to an empty database, embedded PGlite otherwise.
  db = process.env.TEST_DATABASE_URL ? await openPostgres(process.env.TEST_DATABASE_URL) : await openPglite();
  await migrate(db);
  app = await buildApp({
    db,
    content,
    config: { ...configFromEnv({}), sessionSize: 4, maxHumans: 2, fillAfterSeconds: 0.3, sessionDurationSeconds: 150, timeScale: 30 },
  });
  await app.http.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.http.server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

afterAll(async () => {
  await app.close();
  await db.close();
});

async function api(path: string, init: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(base + path, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, body: (res.status === 204 ? null : await res.json()) as any };
}

async function newPlayer(name: string): Promise<string> {
  const r = await api("/api/register", { body: { username: name, email: `${name}@example.com`, password: "password123" } });
  expect(r.status).toBe(201);
  return r.body.token as string;
}

/** Every received event is buffered from the first moment, so nothing sent on connect is missed. */
const received = new WeakMap<Socket, { event: string; payload: unknown }[]>();

function socketFor(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connect(base, { auth: { token }, transports: ["websocket"], forceNew: true });
    const buffer: { event: string; payload: unknown }[] = [];
    received.set(s, buffer);
    s.onAny((event: string, payload: unknown) => buffer.push({ event, payload }));
    s.once("connect", () => resolve(s));
    s.once("connect_error", reject);
  });
}

/** Resolves with the first `event` received since `since` (index into the buffer). */
function once<T>(s: Socket, event: string, ms = 15_000): Promise<T> {
  const buffer = received.get(s)!;
  return new Promise<T>((resolve, reject) => {
    const started = Date.now();
    const poll = setInterval(() => {
      const hit = buffer.find((e) => e.event === event);
      if (hit) {
        clearInterval(poll);
        resolve(hit.payload as T);
      } else if (Date.now() - started > ms) {
        clearInterval(poll);
        reject(new Error(`timeout waiting for ${event}`));
      }
    }, 10);
  });
}

/** Answers every offer with its first non-default choice. */
function autoPlay(s: Socket, sessionId: () => string | undefined) {
  s.on("game:notice", (n: Notice) => {
    if (n.kind !== "event" || n.view.offer.choices.length === 0) return;
    const choice = n.view.offer.choices.find((c) => !c.isDefault) ?? n.view.offer.choices[0]!;
    s.emit("game:decide", { sessionId: sessionId(), instanceId: n.view.offer.instanceId, choiceId: choice.id }, () => {});
  });
}

describe("auth", () => {
  it("registers, rejects duplicates and bad input, logs in, serves the profile", async () => {
    const token = await newPlayer("alice");
    expect((await api("/api/register", { body: { username: "Alice", email: "other@example.com", password: "password123" } })).status).toBe(409);
    expect((await api("/api/register", { body: { username: "a", email: "nope", password: "x" } })).status).toBe(400);
    expect((await api("/api/login", { body: { login: "alice", password: "wrong-password" } })).status).toBe(401);
    const login = await api("/api/login", { body: { login: "alice@example.com", password: "password123" } });
    expect(login.status).toBe(200);
    const me = await api("/api/me", { token: login.body.token });
    expect(me.body).toMatchObject({ username: "alice", stats: { gamesPlayed: 0 } });
    expect((await api("/api/me")).status).toBe(401);
    await api("/api/logout", { method: "POST", token });
    expect((await api("/api/me", { token })).status).toBe(401);
  });

  it("refuses sockets without a valid token", async () => {
    await expect(socketFor("not-a-token")).rejects.toThrow(/unauthorized/);
  });
});

describe("a full session with two humans and bots", () => {
  it("matches, plays, survives a reconnect, ends with recaps and persists everything", async () => {
    const [t1, t2] = [await newPlayer("bob"), await newPlayer("cleo")];
    const s1 = await socketFor(t1);
    let s2 = await socketFor(t2);

    const bad = await s1.emitWithAck("match:find", { career: "astronaut" });
    expect(bad).toEqual({ ok: false, error: "unknown_career" });

    const started1 = once<{ sessionId: string; characterId: string; roster: unknown[] }>(s1, "game:started");
    const started2 = once<{ sessionId: string; characterId: string }>(s2, "game:started");
    expect((await s1.emitWithAck("match:find", { career: "doctor" })).ok).toBe(true);
    expect((await s2.emitWithAck("match:find", { career: "lawyer" })).ok).toBe(true);
    const [g1, g2] = await Promise.all([started1, started2]);
    expect(g1.sessionId).toBe(g2.sessionId);
    expect(g1.roster).toHaveLength(4); // 2 humans + 2 bots
    expect(g1.characterId).not.toBe(g2.characterId);

    const wrong = await s1.emitWithAck("game:decide", { sessionId: "other", instanceId: "E1", choiceId: "x" });
    expect(wrong).toMatchObject({ ok: false });

    autoPlay(s1, () => g1.sessionId);
    autoPlay(s2, () => g2.sessionId);

    // Player 2 drops out for a while, then reconnects into the same session.
    await new Promise((r) => setTimeout(r, 600));
    s2.disconnect();
    await new Promise((r) => setTimeout(r, 400));
    s2 = await socketFor(t2);
    const resumed = await once<{ sessionId: string; state: string }>(s2, "game:state", 2_000);
    expect(resumed).toMatchObject({ sessionId: g2.sessionId });
    autoPlay(s2, () => g2.sessionId);

    const [end1, end2] = await Promise.all([once<Notice>(s1, "game:ended", 20_000), once<Notice>(s2, "game:ended", 20_000)]);
    expect(end1.kind).toBe("session_completed");
    const recap = (end1 as Extract<Notice, { kind: "session_completed" }>).recap as LifeRecap;
    expect(recap.characterId).toBe(g1.characterId);
    expect(recap.outcomes.length).toBeGreaterThan(0);
    expect((end2 as Extract<Notice, { kind: "session_completed" }>).recap.characterId).toBe(g2.characterId);

    // Persistence (results are written right after the end notice).
    await new Promise((r) => setTimeout(r, 300));
    const sessions = await db.query<{ status: string }>("SELECT status FROM sessions WHERE id = $1", [g1.sessionId]);
    expect(sessions.rows[0]?.status).toBe("completed");
    const decisions = await db.query<{ source: string; n: number }>(
      "SELECT source, count(*)::int AS n FROM decisions WHERE session_id = $1 GROUP BY source",
      [g1.sessionId],
    );
    expect(decisions.rows.find((r) => r.source === "player")?.n ?? 0).toBeGreaterThan(0);
    const results = await db.query("SELECT 1 FROM session_results WHERE session_id = $1 AND user_id IS NOT NULL", [g1.sessionId]);
    expect(results.rows).toHaveLength(2);

    const me = await api("/api/me", { token: t1 });
    expect(me.body.stats.gamesPlayed).toBe(1);
    expect(me.body.recentLives[0].sessionId).toBe(g1.sessionId);

    const log = await api(`/api/sessions/${g1.sessionId}/log`, { token: t1 });
    expect(log.status).toBe(200);
    expect(log.body.text).toContain("Session completed");
    const outsider = await newPlayer("dave");
    expect((await api(`/api/sessions/${g1.sessionId}/log`, { token: outsider })).status).toBe(404);

    s1.disconnect();
    s2.disconnect();
  }, 30_000);
});

describe("matchmaker", () => {
  it("starts when enough humans queue, or fills with bots after the wait", () => {
    let now = 0;
    const matches: string[][] = [];
    const mm = new Matchmaker({ sessionSize: 6, maxHumans: 2, fillAfterMs: 1000, now: () => now, onMatch: (t) => matches.push(t.map((x) => x.userId)) });
    mm.enqueue("a", "A", "doctor");
    expect(matches).toEqual([]);
    expect(mm.status("a")).toMatchObject({ position: 1, queueSize: 1 });
    mm.enqueue("b", "B", "lawyer");
    expect(matches).toEqual([["a", "b"]]);
    mm.enqueue("c", "C", "civilian");
    now = 999;
    mm.tick();
    expect(matches).toHaveLength(1);
    now = 1000;
    mm.tick();
    expect(matches).toEqual([["a", "b"], ["c"]]);
    mm.enqueue("d", "D", "teacher");
    expect(mm.cancel("d")).toBe(true);
    now = 5000;
    mm.tick();
    expect(matches).toHaveLength(2);
  });
});
