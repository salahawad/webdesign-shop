import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import pg from "pg";

loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) {
  console.error(
    "Set DATABASE_URL before running the PostgreSQL migration. Local development uses SQLite automatically.",
  );
  process.exit(1);
}
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(
    await readFile(new URL("../db/postgres.sql", import.meta.url), "utf8"),
  );
  await client.query("COMMIT");
  console.log("SA Studio database schema is ready.");
} catch {
  await client.query("ROLLBACK");
  console.error(
    "Database migration failed. Check DATABASE_URL and database connectivity.",
  );
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
