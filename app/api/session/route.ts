import { cookies } from "next/headers";
import {
  createSession,
  loginConfiguration,
  sameOrigin,
  SESSION_COOKIE,
  SESSION_SECONDS,
  validPassword,
} from "@/lib/session";

export const runtime = "nodejs";
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json({ error: "Invalid request origin." }, 403);
  if (loginConfiguration() === "missing")
    return json(
      {
        error:
          "Team login is not configured. Set STUDIO_PASSWORD and SESSION_SECRET in the deployment settings.",
      },
      503,
    );
  if (loginConfiguration() === "open-local") return json({ ok: true });
  try {
    const body = await request.json();
    if (
      typeof body.password !== "string" ||
      body.password.length > 1024 ||
      !validPassword(body.password)
    ) {
      // Make guesses more costly without retaining IP addresses or passwords.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return json({ error: "Incorrect studio password." }, 401);
    }
    (await cookies()).set(SESSION_COOKIE, createSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    return json({ ok: true });
  } catch {
    return json({ error: "Could not sign in. Please retry." }, 400);
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return json({ error: "Invalid request origin." }, 403);
  (await cookies()).delete(SESSION_COOKIE);
  return json({ ok: true });
}
