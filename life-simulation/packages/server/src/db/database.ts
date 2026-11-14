/**
 * Minimal database abstraction with two drivers that speak the same PostgreSQL SQL:
 *   - `pg` against a real PostgreSQL server (DATABASE_URL),
 *   - PGlite (PostgreSQL compiled to WebAssembly, in-process) for zero-setup development and tests.
 */
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface Database extends Queryable {
  /** Runs `fn` in a transaction; rolls back if it throws. */
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
  readonly driver: "pg" | "pglite";
}

export async function openPostgres(url: string): Promise<Database> {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: url });
  return {
    driver: "pg",
    query: async (sql, params) => ({ rows: (await pool.query(sql, params as unknown[])).rows }),
    exec: async (sql) => {
      await pool.query(sql);
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({ query: async (sql, params) => ({ rows: (await client.query(sql, params as unknown[])).rows }) });
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

/** `dataDir` undefined = in-memory. */
export async function openPglite(dataDir?: string): Promise<Database> {
  const { PGlite } = await import("@electric-sql/pglite");
  // PGlite creates only the last path segment; make sure the parents exist (e.g. ./data on a fresh clone).
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  await db.waitReady;
  return {
    driver: "pglite",
    query: async (sql, params) => ({ rows: (await db.query(sql, params)).rows as never[] }),
    exec: async (sql) => {
      await db.exec(sql);
    },
    transaction: (fn) => db.transaction((tx) => fn({ query: async (sql, params) => ({ rows: (await tx.query(sql, params)).rows as never[] }) })),
    close: () => db.close(),
  };
}

const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations", import.meta.url));

/** Applies pending `NNN_name.sql` migrations in order, each in its own transaction. */
export async function migrate(db: Database): Promise<string[]> {
  await db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const done = new Set((await db.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    await db.transaction(async (tx) => {
      for (const statement of splitSql(sql)) await tx.query(statement);
      await tx.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    });
    applied.push(file);
  }
  return applied;
}

/** Splits a migration file into statements (no procedural code in our migrations). */
function splitSql(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
