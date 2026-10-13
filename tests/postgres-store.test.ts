import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import {
  addVersion,
  getVersionHtml,
  listDesigns,
  updateStatus,
} from "../lib/design-store";
import { setUser, userExists, verifyUser } from "../lib/users";

test(
  "PostgreSQL serializes simultaneous uploads for the same design",
  { skip: !process.env.STUDIO_TEST_DATABASE_URL },
  async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = process.env.STUDIO_TEST_DATABASE_URL;
    const input = {
      name: "PostgreSQL integration test",
      category: "Website",
      html: "<h1>Original</h1>",
      author: "Test designer",
      role: "Designer",
      notes: "Original revision",
      source: "Test",
    };
    let id: string | undefined;
    try {
      id = await addVersion(input);
      await Promise.all(
        Array.from({ length: 8 }, (_, n) =>
          addVersion({
            ...input,
            designId: id,
            html: `<h1>Iteration ${n}</h1>`,
          }),
        ),
      );
      const design = (await listDesigns()).find((d) => d.id === id)!;
      assert.deepEqual(
        design.versions.map((v) => v.number),
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
      );
      assert.equal(design.versions[0].html, undefined);
      assert.equal(await getVersionHtml(design.versions[0].id), input.html);
      assert.equal(
        await updateStatus(design.versions[8].id, "Ready for dev"),
        true,
      );
      assert.equal(
        (await listDesigns()).find((d) => d.id === id)!.versions[8].status,
        "Ready for dev",
      );
    } finally {
      if (id) {
        const pool = new Pool({
          connectionString: process.env.STUDIO_TEST_DATABASE_URL,
        });
        try {
          await pool.query("DELETE FROM versions WHERE design_id=$1", [id]);
          await pool.query("DELETE FROM designs WHERE id=$1", [id]);
        } finally {
          await pool.end();
        }
      }
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  },
);

test(
  "PostgreSQL stores users and resets an existing user's password",
  { skip: !process.env.STUDIO_TEST_DATABASE_URL },
  async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = process.env.STUDIO_TEST_DATABASE_URL;
    const username = `ci-${Date.now()}`;
    try {
      await setUser(username, "first-password");
      await setUser(username, "reset-password");
      assert.equal(await verifyUser(username, "first-password"), false);
      assert.equal(await verifyUser(username, "reset-password"), true);
      assert.equal(await userExists(username), true);
    } finally {
      const pool = new Pool({
        connectionString: process.env.STUDIO_TEST_DATABASE_URL,
      });
      try {
        await pool.query("DELETE FROM users WHERE username=$1", [username]);
      } finally {
        await pool.end();
      }
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  },
);
