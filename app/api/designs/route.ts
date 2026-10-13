import {
  addVersion,
  countDesigns,
  deleteDesign,
  listDesigns,
  MissingDesignError,
  updateStatus,
} from "@/lib/design-store";
import { authorized, sameOrigin } from "@/lib/session";
import { z } from "zod";
import { MAX_UPLOAD_BYTES } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
const uploadSchema = z.object({
  designId: z.string().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(120),
  category: z.enum(["Website", "Dashboard", "Web app"]),
  html: z
    .string()
    .min(1)
    .refine(
      (html) =>
        html.trim().length > 0 &&
        Buffer.byteLength(html, "utf8") <= MAX_UPLOAD_BYTES,
      "Upload an HTML file up to 4.5 MB.",
    ),
  author: z.string().trim().min(1).max(120),
  role: z.enum(["Designer", "Product manager", "Developer"]),
  notes: z.string().max(3000),
  source: z.string().min(1).max(120),
});

export async function GET(request: Request) {
  if (!(await authorized()))
    return json({ error: "Sign in to SA Studio." }, 401);
  try {
    if (!request?.url) return json(await listDesigns());
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("q") || undefined;
    const limit =
      limitParam !== null && Number.isFinite(Number(limitParam))
        ? Math.min(200, Math.max(1, Number(limitParam)))
        : undefined;
    const offset =
      offsetParam !== null && Number.isFinite(Number(offsetParam))
        ? Math.max(0, Number(offsetParam))
        : undefined;

    if (limit !== undefined || category || search) {
      const [items, total] = await Promise.all([
        listDesigns({ limit, offset, category, search }),
        countDesigns({ category, search }),
      ]);
      return json(items, 200, { "X-Total-Count": String(total) });
    }
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
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > MAX_UPLOAD_BYTES) {
      return json({ error: "The file and upload details exceed 4.5 MB." }, 413);
    }
    const input = uploadSchema.safeParse(JSON.parse(body));
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

export async function DELETE(request: Request) {
  if (!(await authorized()))
    return json({ error: "Sign in before deleting a design." }, 401);
  if (!sameOrigin(request))
    return json({ error: "Invalid request origin." }, 403);
  try {
    const input = z
      .object({
        id: z.string().min(1).max(120),
      })
      .safeParse(await request.json());
    if (!input.success) return json({ error: "Invalid design ID." }, 400);
    if (!(await deleteDesign(input.data.id)))
      return json(
        {
          error: "Built-in example projects can be archived, not deleted.",
        },
        404,
      );
    return json({ ok: true });
  } catch {
    return json({ error: "Could not delete design." }, 503);
  }
}
