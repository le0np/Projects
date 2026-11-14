/**
 * Starts the game server.
 *   npm run server                     # embedded PGlite in ./data/pglite, port 3000
 *   DATABASE_URL=postgres://… npm run server
 *   TIME_SCALE=10 npm run server       # 10× faster sessions for demos
 */
import { loadContent } from "@lifesim/content";
import { buildApp } from "./app";
import { configFromEnv } from "./config";
import { migrate, openPglite, openPostgres } from "./db/database";
import { Repo } from "./repo";

const config = configFromEnv();
const content = loadContent();
const db = config.databaseUrl ? await openPostgres(config.databaseUrl) : await openPglite(config.pgliteDir);
const applied = await migrate(db);
const orphaned = await new Repo(db).cancelOrphanedSessions();
const app = await buildApp({ db, content, config, logger: true });
await app.http.listen({ port: config.port, host: config.host });
app.http.log.info(
  `Life Simulation server on :${config.port} — db ${db.driver}${config.databaseUrl ? "" : ` (${config.pgliteDir ?? "in-memory"})`}, ` +
    `content ${content.hash} (${content.events.size} events), migrations applied: ${applied.length}, orphaned sessions cancelled: ${orphaned}`,
);

const shutdown = async () => {
  await app.close();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
