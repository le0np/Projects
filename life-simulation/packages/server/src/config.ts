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
  /** T8b (QA only): a bot schemes against the first human right away, and every scheme works and is found out. */
  qaForceSchemeOnHuman: boolean;
  /** T12 (QA only): the first human's story ends after 20 session seconds, so the ghost can be seen. */
  qaGhost: boolean;
  /** Shortens every real-time duration for humans (deadlines, rests); 1 = normal. Only for tests. */
  paceScale: number;
  /** T15: how many guest accounts one IP may create per hour. */
  guestsPerIpPerHour: number;
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
    paceScale: num(env.PACE_SCALE, 1),
    qaForceSchemeOnHuman: env.QA_FORCE_SCHEME_ON_HUMAN === "1",
    qaGhost: env.QA_GHOST === "1",
    guestsPerIpPerHour: num(env.GUESTS_PER_IP_PER_HOUR, 20),
    webDist: env.WEB_DIST || (existsSync(DEFAULT_WEB_DIST) ? DEFAULT_WEB_DIST : undefined),
  };
}
