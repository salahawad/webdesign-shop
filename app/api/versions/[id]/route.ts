import { getVersionHtml } from "@/lib/design-store";
import { authorized } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// JSON, never text/html: uploaded markup must not render on the studio origin.
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await authorized()))
    return json({ error: "Sign in to SA Studio." }, 401);
  const { id } = await params;
  try {
    const html = await getVersionHtml(id);
    if (html === undefined) return json({ error: "Version not found." }, 404);
    return json({ html });
  } catch {
    return json(
      { error: "Could not load this version. Retry the connection." },
      503,
    );
  }
}
