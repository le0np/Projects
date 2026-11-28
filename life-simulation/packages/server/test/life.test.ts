import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as connect } from "socket.io-client";
import { Rng, type LifeView } from "@lifesim/core";
import { loadContent } from "@lifesim/content";
import { botAction } from "@lifesim/engine";
import { buildApp, configFromEnv, migrate, openPglite, type App, type Database } from "../src";

describe("Sprint 5: a life in chapters over the socket", () => {
  let db: Database;
  let app: App;
  let base: string;
  beforeAll(async () => {
    db = await openPglite();
    await migrate(db);
    app = await buildApp({ db, content: loadContent(), config: configFromEnv({}) });
    await app.http.listen({ port: 0, host: "127.0.0.1" });
    const addr = app.http.server.address();
    base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  });
  afterAll(async () => {
    await app.close();
    await db.close();
  });

  it("creates a character, plays a whole life, stores the recap in the history, and resumes after a reconnect", async () => {
    const options = (await (await fetch(`${base}/api/life/options`)).json()) as { legacyTown: boolean; dreams: unknown[]; flaws: unknown[]; careers: unknown[] };
    expect(options.legacyTown).toBe(false);
    expect(options.dreams).toHaveLength(6);
    expect(options.flaws).toHaveLength(6);
    expect(options.careers).toHaveLength(10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const guest: any = await (await fetch(`${base}/api/guest`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Maja" }) })).json();
    const token = guest.token as string;
    const s = connect(base, { auth: { token }, transports: ["websocket"], forceNew: true });
    await new Promise<void>((r) => s.once("connect", () => r()));
    const call = (event: string, body: unknown) => new Promise<any>((r) => s.emit(event, body, r)); // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(await call("life:start", { name: "1", dream: "fame", flaw: "coward", career: "doctor" })).toEqual({ ok: false, error: "invalid_name" });
    const started = await call("life:start", { name: "Maja", dream: "mayor", flaw: "hothead", career: "teacher" });
    expect(started.ok).toBe(true);
    expect(started.view.step.kind).toBe("intro");
    expect(await call("life:act", { t: "choose", id: "x" })).toMatchObject({ ok: false, error: "no decision now" });

    // Play half the life, then reconnect: the server puts us back where we were.
    const rng = new Rng("socket-bot");
    let view: LifeView = started.view;
    for (let i = 0; i < 6; i++) view = (await call("life:act", botAction(view, ["town"], rng))).view;
    s.disconnect();
    const s2 = connect(base, { auth: { token }, transports: ["websocket"], forceNew: true });
    const resumed = await new Promise<any>((r) => s2.once("life:state", r)); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(JSON.stringify(resumed.view)).toBe(JSON.stringify(view));
    const call2 = (event: string, body: unknown) => new Promise<any>((r) => s2.emit(event, body, r)); // eslint-disable-line @typescript-eslint/no-explicit-any
    for (let i = 0; i < 100 && view.step.kind !== "done"; i++) view = (await call2("life:act", botAction(view, ["town"], rng))).view;
    expect(view.step.kind).toBe("done");

    // Stored: the lobby history has it, with its title, and the full log can be read.
    let me: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    for (let i = 0; i < 50; i++) {
      me = await (await fetch(`${base}/api/me`, { headers: { authorization: `Bearer ${token}` } })).json();
      if (me.recentLives.length > 0) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(me.recentLives[0].recap.mode).toBe("chapters");
    expect(me.titles.length).toBe(1);
    expect(me.stats.gamesPlayed).toBe(1);
    const log: any = await (await fetch(`${base}/api/sessions/${resumed.lifeId}/log`, { headers: { authorization: `Bearer ${token}` } })).json();
    expect(log.text).toContain("Life of Maja");
    expect(log.text).toContain("Title:");

    expect(await call2("life:leave", {})).toEqual({ ok: true });
    s2.disconnect();
  });
});
