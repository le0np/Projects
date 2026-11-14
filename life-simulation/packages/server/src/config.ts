/** Server configuration from environment variables (see .env.example). */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The web client's build output (`npm run web:build`), served by the game server if present. */
const DEFAULT_WEB_DIST = fileURLToPath(new URL("../../web/dist", import.meta.url));
export interface ServerConfig {
  port: number;
  host: string;
  /** PostgreSQL connection string; if empty, an embedded PGlite database is used. */
  databaseUrl: string | undefined;
  /** PGlite data directory; empty = in-memory (data is lost on restart). */
  pgliteDir: string | undefined;
  sessionSize: number;
  maxHumans: number;
  fillAfterSeconds: number;
  sessionDurationSeconds: number;
  /** Speeds up session time (1 = real time). Useful for demos and tests. */
  timeScale: number;
  /** Directory with the built web client to serve, if any. */
  webDist: string | undefined;
}

const num = (v: string | undefined, fallback: number) => (v === undefined || v === "" ? fallback : Number(v));

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: num(env.PORT, 3000),
    host: env.HOST || "0.0.0.0",
    databaseUrl: env.DATABASE_URL || undefined,
    pgliteDir: env.PGLITE_DIR === undefined ? "./data/pglite" : env.PGLITE_DIR || undefined,
    sessionSize: num(env.SESSION_SIZE, 6),
    maxHumans: num(env.MAX_HUMANS, 4),
    fillAfterSeconds: num(env.FILL_AFTER_SECONDS, 10),
    sessionDurationSeconds: num(env.SESSION_DURATION_SECONDS, 480),
    timeScale: num(env.TIME_SCALE, 1),
    webDist: env.WEB_DIST || (existsSync(DEFAULT_WEB_DIST) ? DEFAULT_WEB_DIST : undefined),
  };
}
