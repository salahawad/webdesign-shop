import {
  addVersion,
  listDesigns,
  MissingDesignError,
  updateStatus,
} from "@/lib/design-store";
import { authorized, sameOrigin } from "@/lib/session";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const uploadSchema = z.object({
  designId: z.string().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(120),
  category: z.enum(["Website", "Dashboard", "Web app"]),
  html: z
    .string()
    .min(1)
    .refine(
      (html) =>
        html.trim().length > 0 && Buffer.byteLength(html, "utf8") <= 750000,
      "Upload an HTML file under 750 KB.",
    ),
  author: z.string().trim().min(1).max(120),
  role: z.enum(["Designer", "Product manager", "Developer"]),
  notes: z.string().max(3000),
  source: z.string().min(1).max(120),
});

export async function GET() {
  if (!(await authorized()))
    return json({ error: "Sign in to SA Studio." }, 401);
  try {
    return json(await listDesigns());
  } catch {
    return json(
      {
        error:
          "Could not load the studio. Check the database configuration and retry.",
      },
      503,
    );
  }
}

export async function POST(request: Request) {
  if (!(await authorized()))
    return json({ error: "Sign in before uploading." }, 401);
  if (!sameOrigin(request))
    return json({ error: "Invalid request origin." }, 403);
  try {
    const input = uploadSchema.safeParse(await request.json());
    if (!input.success)
      return json(
        { error: input.error.issues[0]?.message || "Invalid upload details." },
        400,
      );
    return json({ id: await addVersion(input.data) }, 201);
  } catch (error) {
    if (error instanceof MissingDesignError)
      return json({ error: "Design no longer exists." }, 404);
    if (error instanceof SyntaxError)
      return json({ error: "Invalid upload details." }, 400);
    return json({ error: "Upload failed. Keep your file and retry." }, 503);
  }
}

export async function PATCH(request: Request) {
  if (!(await authorized()))
    return json({ error: "Sign in before updating handoff status." }, 401);
  if (!sameOrigin(request))
    return json({ error: "Invalid request origin." }, 403);
  try {
    const input = z
      .object({
        id: z.string().min(1).max(120),
        status: z.enum(["In review", "Ready for dev"]),
      })
      .safeParse(await request.json());
    if (!input.success) return json({ error: "Invalid handoff status." }, 400);
    if (!(await updateStatus(input.data.id, input.data.status)))
      return json(
        {
          error: "Upload a revision of this example to start your own handoff.",
        },
        404,
      );
    return json({ ok: true });
  } catch {
    return json({ error: "Could not update status." }, 503);
  }
}
