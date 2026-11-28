import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import { loadContent } from "@lifesim/content";
import { Rooms, buildApp, configFromEnv, migrate, openPglite, type App, type Database } from "../src";

describe("T14: rooms (unit)", () => {
  it("creates short codes, lets friends join until it starts, hands over the host, and disappears when empty", () => {
    const rooms = new Rooms(3);
    const room = rooms.create({ userId: "a", name: "Ana", career: "doctor" });
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    expect(rooms.join(room.code.toLowerCase(), { userId: "b", name: "Ben", career: "lawyer" })).toMatchObject({ ok: true });
    expect(rooms.join("ZZZZ", { userId: "c", name: "Cid", career: "lawyer" })).toEqual({ ok: false, error: "not_found" });
    expect(rooms.start("b")).toEqual({ ok: false, error: "not_host" });
    expect(rooms.join(room.code, { userId: "c", name: "Cid", career: "teacher" })).toMatchObject({ ok: true });
    expect(rooms.join(room.code, { userId: "d", name: "Dan", career: "teacher" })).toEqual({ ok: false, error: "full" });
    expect(rooms.start("a")).toMatchObject({ ok: true });
    rooms.leave("c");
    expect(rooms.join(room.code, { userId: "e", name: "Eva", career: "teacher" })).toEqual({ ok: false, error: "started" });
    rooms.leave("a");
    expect(rooms.get(room.code)?.hostId).toBe("b");
    rooms.leave("b");
    expect(rooms.get(room.code)).toBeUndefined();
    expect(rooms.size).toBe(0);
  });
});

describe("T14: rooms over sockets", () => {
  let db: Database;
  let app: App;
  let base: string;
  beforeAll(async () => {
    db = await openPglite();
    await migrate(db);
    app = await buildApp({ db, content: loadContent(), config: { ...configFromEnv({}), sessionSize: 4, maxHumans: 1, fillAfterSeconds: 60, sessionDurationSeconds: 60, timeScale: 30, paceScale: 0.05 } });
    await app.http.listen({ port: 0, host: "127.0.0.1" });
    const addr = app.http.server.address();
    base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  });
  afterAll(async () => {
    await app.close();
    await db.close();
  });

  const player = async (name: string) => {
    const res = await fetch(`${base}/api/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: name, email: `${name}@example.com`, password: "password123" }) });
    const { token } = (await res.json()) as { token: string };
    const s = connect(base, { auth: { token }, transports: ["websocket"], forceNew: true });
    const events: { event: string; payload: any }[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    s.onAny((event, payload) => events.push({ event, payload }));
    await new Promise<void>((r) => s.once("connect", () => r()));
    return { s, events };
  };
  const waitFor = async (events: { event: string; payload: any }[], event: string, ms = 10_000) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const hit = events.find((e) => e.event === event);
      if (hit) return hit.payload;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`no ${event}`);
  };

  it("a host and a friend who has the code play one life together, with bots in the empty seats", async () => {
    const host = await player("roomhost");
    const friend = await player("roomfriend");
    const created = await host.s.emitWithAck("room:create", { career: "doctor", name: "Mila" });
    expect(created).toMatchObject({ ok: true, room: { members: [{ name: "Mila", isHost: true }] } });
    const code = created.room.code as string;
    expect(await friend.s.emitWithAck("room:join", { code: "ZZZZ", career: "lawyer", name: "Oskar" })).toEqual({ ok: false, error: "not_found" });
    const joined = await friend.s.emitWithAck("room:join", { code: code.toLowerCase(), career: "lawyer", name: "Oskar" });
    expect(joined.room.members.map((m: { name: string }) => m.name)).toEqual(["Mila", "Oskar"]);
    // The host sees the friend arrive.
    await new Promise((r) => setTimeout(r, 100));
    expect(host.events.filter((e) => e.event === "room:state").at(-1)?.payload.members).toHaveLength(2);
    expect(await friend.s.emitWithAck("room:start", {})).toEqual({ ok: false, error: "not_host" });
    expect(await host.s.emitWithAck("room:start", {})).toEqual({ ok: true });
    const [g1, g2] = await Promise.all([waitFor(host.events, "game:started"), waitFor(friend.events, "game:started")]);
    expect(g1.sessionId).toBe(g2.sessionId);
    expect(g1.roster.map((r: { name: string }) => r.name)).toEqual(expect.arrayContaining(["Mila", "Oskar"]));
    expect(g1.roster.filter((r: { isBot: boolean }) => r.isBot)).toHaveLength(2);
    // Late arrivals are turned away.
    const late = await player("roomlate");
    expect(await late.s.emitWithAck("room:join", { code, career: "teacher", name: "Rosa" })).toEqual({ ok: false, error: "started" });
    for (const p of [host, friend, late]) p.s.disconnect();
  }, 30_000);
});
