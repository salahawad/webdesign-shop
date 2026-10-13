import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { database } from "../db";

const derive = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  length: number,
) => Promise<Buffer>;

// No dots: the session token uses "." to separate the username from its signature.
export const USERNAME = /^[a-z0-9][a-z0-9_-]{0,39}$/;

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${(await derive(password, salt, 64)).toString("hex")}`;
}

// Unknown usernames are checked against this hash so response time does not reveal which accounts exist.
const decoy = hashPassword(randomBytes(16).toString("hex"));

export async function verifyUser(username: string, password: string) {
  const [row] = await database((query) =>
    query("SELECT password_hash FROM users WHERE username = ?", [username]),
  );
  const [salt, hash] = (row ? String(row.password_hash) : await decoy).split(
    ":",
  );
  const actual = await derive(password, Buffer.from(salt, "hex"), 64);
  return timingSafeEqual(actual, Buffer.from(hash, "hex")) && Boolean(row);
}

export async function userExists(username: string) {
  return (
    (
      await database((query) =>
        query("SELECT 1 FROM users WHERE username = ?", [username]),
      )
    ).length > 0
  );
}

export async function setUser(username: string, password: string) {
  const hash = await hashPassword(password);
  await database((query) =>
    query(
      "INSERT INTO users (username,password_hash,created_at) VALUES (?,?,?) ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash",
      [username, hash, new Date().toISOString()],
    ),
  );
}
