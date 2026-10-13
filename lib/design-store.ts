import { database } from "../db";
import { demos, type Design, type Version } from "./demo";

export type Upload = {
  designId?: string;
  name: string;
  category: string;
  html: string;
  author: string;
  role: string;
  notes: string;
  source: string;
};
export class MissingDesignError extends Error {}

function version(row: Record<string, unknown>): Version {
  return {
    id: String(row.id),
    designId: String(row.design_id),
    number: Number(row.number),
    html: String(row.html),
    author: String(row.author),
    role: String(row.role),
    notes: String(row.notes),
    source: String(row.source),
    createdAt: String(row.created_at),
    status: String(row.status),
  };
}

export async function listDesigns(): Promise<Design[]> {
  return database(async (query) => {
    const designs = await query(
      "SELECT * FROM designs ORDER BY created_at DESC",
    );
    const revisions = (
      await query("SELECT * FROM versions ORDER BY number")
    ).map(version);
    return designs
      .map((row) => ({
        id: String(row.id),
        name: String(row.name),
        category: String(row.category),
        createdAt: String(row.created_at),
        versions: revisions.filter((v) => v.designId === row.id),
      }))
      .filter((d) => d.versions.length);
  }, true);
}

export async function addVersion(input: Upload): Promise<string> {
  return database(async (query, postgres) => {
    const id = input.designId || crypto.randomUUID();
    const found = await query("SELECT id FROM designs WHERE id = ?", [id]);
    if (!found.length) {
      const example = demos.find((d) => d.id === id);
      if (input.designId && !example) throw new MissingDesignError();
      await query(
        "INSERT INTO designs (id,name,category,created_at) VALUES (?,?,?,?) ON CONFLICT (id) DO NOTHING",
        [id, input.name.trim(), input.category, new Date().toISOString()],
      );
      if (example)
        for (const v of example.versions) {
          await query(
            "INSERT INTO versions (id,design_id,number,html,author,role,notes,source,created_at,status) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING",
            [
              v.id,
              id,
              v.number,
              v.html,
              v.author,
              v.role,
              v.notes,
              v.source,
              v.createdAt,
              v.status,
            ],
          );
        }
    }
    // All PostgreSQL uploads for this design hold the same row lock until commit.
    if (postgres)
      await query("SELECT id FROM designs WHERE id = ? FOR UPDATE", [id]);
    const [row] = await query(
      "SELECT COALESCE(MAX(number),0)+1 AS next FROM versions WHERE design_id = ?",
      [id],
    );
    await query(
      "INSERT INTO versions (id,design_id,number,html,author,role,notes,source,created_at,status) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [
        crypto.randomUUID(),
        id,
        Number(row.next),
        input.html,
        input.author.trim(),
        input.role,
        input.notes,
        input.source,
        new Date().toISOString(),
        "In review",
      ],
    );
    return id;
  }, true);
}

export async function updateStatus(
  id: string,
  status: string,
): Promise<boolean> {
  return database(
    async (query) =>
      (
        await query(
          "UPDATE versions SET status = ? WHERE id = ? RETURNING id",
          [status, id],
        )
      ).length > 0,
    true,
  );
}
