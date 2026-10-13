import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import type { DatabaseSync } from "node:sqlite";

type Row = Record<string, unknown>;
export type Query = (
  sql: string,
  params?: (string | number)[],
) => Promise<Row[]>;
type Work<T> = (query: Query, postgres: boolean) => Promise<T>;
let pool: Pool | undefined;
let local: DatabaseSync | undefined;
let localQueue: Promise<unknown> = Promise.resolve();

async function localDatabase() {
  if (local) return local;
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error("DATABASE_URL is required in production.");
  }
  const { DatabaseSync } = await import("node:sqlite");
  mkdirSync(resolve(".data"), { recursive: true });
  local ??= new DatabaseSync(resolve(".data/studio.sqlite"));
  local.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS designs (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS versions (id TEXT PRIMARY KEY, design_id TEXT NOT NULL REFERENCES designs(id), number INTEGER NOT NULL, html TEXT NOT NULL, author TEXT NOT NULL, role TEXT NOT NULL, notes TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'In review');
    CREATE UNIQUE INDEX IF NOT EXISTS versions_number_idx ON versions(design_id,number);`);
  return local;
}

export async function database<T>(
  work: Work<T>,
  transaction = false,
): Promise<T> {
  if (process.env.DATABASE_URL) {
    pool ??= new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
    });
    const client = await pool.connect();
    const query: Query = async (sql, params = []) => {
      let n = 0;
      return (
        await client.query(
          sql.replace(/\?/g, () => `$${++n}`),
          params,
        )
      ).rows;
    };
    try {
      if (transaction) await client.query("BEGIN");
      const result = await work(query, true);
      if (transaction) await client.query("COMMIT");
      return result;
    } catch (error) {
      if (transaction) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  // Serialize local requests on the single SQLite connection, including reads.
  const run = localQueue.then(async () => {
    const db = await localDatabase();
    const query: Query = async (sql, params = []) =>
      db.prepare(sql).all(...params) as Row[];
    if (transaction) db.exec("BEGIN IMMEDIATE");
    try {
      const result = await work(query, false);
      if (transaction) db.exec("COMMIT");
      return result;
    } catch (error) {
      if (transaction) db.exec("ROLLBACK");
      throw error;
    }
  });
  localQueue = run.catch(() => undefined);
  return run;
}
