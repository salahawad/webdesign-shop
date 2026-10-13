import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { userExists, USERNAME } from "./users";

export const SESSION_COOKIE = "sa-studio-session";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;

export function loginConfiguration(): "open-local" | "protected" | "missing" {
  if (
    !process.env.SESSION_SECRET &&
    process.env.NODE_ENV !== "production" &&
    !process.env.VERCEL
  )
    return "open-local";
  return (process.env.SESSION_SECRET?.length ?? 0) < 32
    ? "missing"
    : "protected";
}

const sign = (payload: string) =>
  createHmac("sha256", process.env.SESSION_SECRET!).update(payload).digest();

export function createSession(username: string, now = Date.now()) {
  if (loginConfiguration() !== "protected")
    throw new Error("Sign-in is not configured.");
  const payload = `${username}.${now + SESSION_SECONDS * 1000}`;
  return `${payload}.${sign(payload).toString("hex")}`;
}

export function sessionUser(token: string | undefined, now = Date.now()) {
  if (loginConfiguration() !== "protected" || !token) return undefined;
  const [username, expiry, signature, extra] = token.split(".");
  if (
    extra !== undefined ||
    !USERNAME.test(username) ||
    !/^\d+$/.test(expiry ?? "") ||
    !/^[a-f0-9]{64}$/.test(signature ?? "")
  )
    return undefined;
  if (Number(expiry) <= now || Number(expiry) > now + SESSION_SECONDS * 1000)
    return undefined;
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    sign(`${username}.${expiry}`),
  )
    ? username
    : undefined;
}

export async function authorized() {
  if (loginConfiguration() === "open-local") return true;
  const username = sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  // Checking the account on every request means deleting a user ends their sessions.
  return username !== undefined && (await userExists(username));
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const url = new URL(request.url);
  // Next.js may normalize request.url to localhost behind its HTTP server.
  // Compare the browser origin with the actual request host and proxy protocol.
  const host = request.headers.get("host") || url.host;
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.slice(0, -1);
  return (
    (protocol === "http" || protocol === "https") &&
    origin === `${protocol}://${host}`
  );
}
