import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addVersion,
  listDesigns,
  MissingDesignError,
  updateStatus,
} from "../lib/design-store";

test("concurrent uploads preserve originals and assign distinct revisions; handoff persists", async () => {
  const oldCwd = process.cwd();
  const oldUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.chdir(mkdtempSync(join(tmpdir(), "sa-studio-test-")));
  const input = {
    name: "Test design",
    category: "Website",
    html: "<h1>Original</h1>",
    author: "Test designer",
    role: "Designer",
    notes: "First draft",
    source: "Claude",
  };
  try {
    const id = await addVersion(input);
    await Promise.all(
      [2, 3, 4].map((n) =>
        addVersion({ ...input, designId: id, html: `<h1>Draft ${n}</h1>` }),
      ),
    );
    const [design] = await listDesigns();
    assert.deepEqual(
      design.versions.map((v) => v.number),
      [1, 2, 3, 4],
    );
    assert.equal(design.versions[0].html, input.html);
    assert.equal(design.versions[0].notes, "First draft");
    assert.equal(
      await updateStatus(design.versions[3].id, "Ready for dev"),
      true,
    );
    assert.equal((await listDesigns())[0].versions[3].status, "Ready for dev");
    assert.equal(await updateStatus("missing", "Ready for dev"), false);
    await assert.rejects(
      addVersion({ ...input, designId: "missing" }),
      MissingDesignError,
    );
    assert.equal((await listDesigns()).length, 1);
    const demo = await addVersion({ ...input, designId: "demo-evergreen" });
    const imported = (await listDesigns()).find((d) => d.id === demo)!;
    assert.deepEqual(
      imported.versions.map((v) => v.number),
      [1, 2, 3, 4],
    );
  } finally {
    process.chdir(oldCwd);
    if (oldUrl !== undefined) process.env.DATABASE_URL = oldUrl;
  }
});
