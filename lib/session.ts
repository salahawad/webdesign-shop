import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "sa-studio-session";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;

export function loginConfiguration(): "open-local" | "protected" | "missing" {
  if (
    !process.env.STUDIO_PASSWORD &&
    process.env.NODE_ENV !== "production" &&
    !process.env.VERCEL
  )
    return "open-local";
  if (
    (process.env.STUDIO_PASSWORD?.length ?? 0) < 16 ||
    (process.env.SESSION_SECRET?.length ?? 0) < 32
  )
    return "missing";
  return "protected";
}

export function validPassword(password: string) {
  if (loginConfiguration() !== "protected") return false;
  return timingSafeEqual(
    createHash("sha256").update(password).digest(),
    createHash("sha256").update(process.env.STUDIO_PASSWORD!).digest(),
  );
}

export function createSession(now = Date.now()) {
  if (loginConfiguration() !== "protected")
    throw new Error("Team login is not configured.");
  const payload = String(now + SESSION_SECONDS * 1000);
  return `${payload}.${createHmac("sha256", process.env.SESSION_SECRET!).update(payload).digest("hex")}`;
}

export function validSession(token: string | undefined, now = Date.now()) {
  if (loginConfiguration() !== "protected" || !token) return false;
  const [payload, signature, extra] = token.split(".");
  if (
    extra ||
    !/^\d+$/.test(payload) ||
    !/^[a-f0-9]{64}$/.test(signature ?? "")
  )
    return false;
  if (Number(payload) <= now || Number(payload) > now + SESSION_SECONDS * 1000)
    return false;
  const expected = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(payload)
    .digest();
  return timingSafeEqual(Buffer.from(signature, "hex"), expected);
}

export async function authorized() {
  if (loginConfiguration() === "open-local") return true;
  return validSession((await cookies()).get(SESSION_COOKIE)?.value);
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
