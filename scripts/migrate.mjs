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
let client;
try {
  client = await pool.connect();
  await client.query("BEGIN");
  await client.query(
    await readFile(new URL("../db/postgres.sql", import.meta.url), "utf8"),
  );
  await client.query("COMMIT");
  console.log("SA Studio database schema is ready.");
} catch (error) {
  await client?.query("ROLLBACK").catch(() => {});
  // pg error messages describe the failure (auth, SSL, permissions) without the connection string.
  console.error(`Database migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
