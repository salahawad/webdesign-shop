import { randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import { setUser, USERNAME } from "../lib/users";

// Same environment loading as next dev: DATABASE_URL in .env.local targets PostgreSQL.
nextEnv.loadEnvConfig(process.cwd());
const username = (process.argv[2] ?? "").trim().toLowerCase();
if (!USERNAME.test(username)) {
  console.error(
    "Usage: npm run user:add -- <username>  (lowercase letters, digits, - or _; up to 40 characters)",
  );
  process.exit(1);
}
const password = randomBytes(18).toString("base64url");
await setUser(username, password);
console.log(
  `Saved "${username}" to ${process.env.DATABASE_URL ? "PostgreSQL" : "local SQLite"}. Re-running this command resets the password.`,
);
console.log(`Password (shown once): ${password}`);
// The PostgreSQL pool would otherwise keep the process alive until idle connections close.
process.exit(0);
