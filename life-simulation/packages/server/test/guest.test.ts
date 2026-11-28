import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadContent } from "@lifesim/content";
import { buildApp, configFromEnv, migrate, openPglite, type App, type Database } from "../src";

describe("T15: play as guest", () => {
  let db: Database;
  let app: App;
  beforeAll(async () => {
    db = await openPglite();
    await migrate(db);
    app = await buildApp({ db, content: loadContent(), config: { ...configFromEnv({}), guestsPerIpPerHour: 3 } });
  });
  afterAll(async () => {
    await app.close();
    await db.close();
  });

  const post = (url: string, body: unknown, token?: string) =>
    app.http.inject({ method: "POST", url, payload: body as object, headers: token ? { authorization: `Bearer ${token}` } : {} });

  it("creates a guest with only a name, then saves it as a real account keeping the same user", async () => {
    const res = await post("/api/guest", { name: "Maja" });
    expect(res.statusCode).toBe(201);
    const { token, user, name } = res.json();
    expect(name).toBe("Maja");
    expect(user.isGuest).toBe(true);
    expect(user.username).toMatch(/^guest_/);

    const me = await app.http.inject({ method: "GET", url: "/api/me", headers: { authorization: `Bearer ${token}` } });
    expect(me.json()).toMatchObject({ isGuest: true, email: "" });

    // A guest cannot log in (there is no password to know).
    expect((await post("/api/login", { login: user.username, password: "x" })).statusCode).toBe(401);

    const up = await post("/api/me/upgrade", { username: "maja_k", email: "maja@example.com", password: "password123" }, token);
    expect(up.statusCode).toBe(200);
    expect(up.json().user).toMatchObject({ id: user.id, username: "maja_k", isGuest: false });
    // The same token still works, and the account can now log in.
    const me2 = await app.http.inject({ method: "GET", url: "/api/me", headers: { authorization: `Bearer ${token}` } });
    expect(me2.json()).toMatchObject({ isGuest: false, username: "maja_k", email: "maja@example.com" });
    const login = await post("/api/login", { login: "maja_k", password: "password123" });
    expect(login.json().user.id).toBe(user.id);
    // Upgrading twice is refused.
    expect((await post("/api/me/upgrade", { username: "maja_x", email: "x@example.com", password: "password123" }, token)).statusCode).toBe(400);
  });

  it("refuses a taken username when saving, and invalid names", async () => {
    const { token } = (await post("/api/guest", { name: "Ivo" })).json();
    expect((await post("/api/me/upgrade", { username: "maja_k", email: "other@example.com", password: "password123" }, token)).statusCode).toBe(409);
    expect((await post("/api/guest", { name: "1" })).statusCode).toBe(400);
  });

  it("limits guests per IP per hour", async () => {
    // Two guests were created above (limit is 3); the third passes, the fourth is refused.
    expect((await post("/api/guest", { name: "Ana" })).statusCode).toBe(201);
    expect((await post("/api/guest", { name: "Ben" })).statusCode).toBe(429);
  });
});
