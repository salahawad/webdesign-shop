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
    author: String(row.author),
    role: String(row.role),
    notes: String(row.notes),
    source: String(row.source),
    createdAt: String(row.created_at),
    status: String(row.status),
  };
}

export type ListDesignsOptions = {
  limit?: number;
  offset?: number;
  category?: string;
  search?: string;
};

function buildDesignWhere(
  options?: Omit<ListDesignsOptions, "limit" | "offset">,
) {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (options?.category) {
    clauses.push("category = ?");
    params.push(options.category);
  }
  const q = options?.search?.trim().toLowerCase();
  if (q) {
    const pattern = `%${q}%`;
    clauses.push(
      "(LOWER(name) LIKE ? OR LOWER(category) LIKE ? OR EXISTS (SELECT 1 FROM versions v WHERE v.design_id = designs.id AND (LOWER(v.author) LIKE ? OR LOWER(v.source) LIKE ? OR LOWER(v.notes) LIKE ?)))",
    );
    params.push(pattern, pattern, pattern, pattern, pattern);
  }
  return {
    whereSql: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export async function countDesigns(
  options?: Omit<ListDesignsOptions, "limit" | "offset">,
): Promise<number> {
  return database(async (query) => {
    const { whereSql, params } = buildDesignWhere(options);
    const [row] = await query(
      `SELECT COUNT(*) AS total FROM designs${whereSql}`,
      params,
    );
    return Number(row?.total ?? 0);
  });
}

export async function listDesigns(
  options?: ListDesignsOptions,
): Promise<Design[]> {
  return database(async (query) => {
    const { whereSql, params } = buildDesignWhere(options);
    let sql = `SELECT * FROM designs${whereSql} ORDER BY created_at DESC`;
    const queryParams = [...params];
    const hasPagination =
      typeof options?.limit === "number" &&
      Number.isFinite(options.limit) &&
      options.limit > 0;
    if (hasPagination) {
      sql += " LIMIT ? OFFSET ?";
      queryParams.push(
        Math.floor(options!.limit!),
        Math.max(0, Math.floor(options?.offset ?? 0)),
      );
    }
    const designs = await query(sql, queryParams);
    if (!designs.length) return [];

    // HTML is fetched per version: the full set would exceed Vercel's 4.5 MB response limit.
    const isScoped =
      hasPagination ||
      Boolean(options?.category) ||
      Boolean(options?.search?.trim());
    const placeholders = designs.map(() => "?").join(",");
    const revisions = (
      await query(
        isScoped
          ? `SELECT id,design_id,number,author,role,notes,source,created_at,status FROM versions WHERE design_id IN (${placeholders}) ORDER BY number`
          : "SELECT id,design_id,number,author,role,notes,source,created_at,status FROM versions ORDER BY number",
        isScoped ? designs.map((d) => String(d.id)) : [],
      )
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

export async function deleteDesign(id: string): Promise<boolean> {
  return database(async (query) => {
    await query("DELETE FROM versions WHERE design_id = ?", [id]);
    const deleted = await query(
      "DELETE FROM designs WHERE id = ? RETURNING id",
      [id],
    );
    return deleted.length > 0;
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
              v.html ?? "",
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

export async function getVersionHtml(id: string): Promise<string | undefined> {
  return database(async (query) => {
    const [row] = await query("SELECT html FROM versions WHERE id = ?", [id]);
    return row ? String(row.html) : undefined;
  });
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
