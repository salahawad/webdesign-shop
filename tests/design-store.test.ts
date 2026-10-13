import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addVersion,
  countDesigns,
  deleteDesign,
  getVersionHtml,
  listDesigns,
  MissingDesignError,
  updateStatus,
} from "../lib/design-store";
import { demos } from "../lib/demo";

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
    // The list stays small; each version's HTML is loaded separately.
    assert.equal(design.versions[0].html, undefined);
    assert.equal(await getVersionHtml(design.versions[0].id), input.html);
    assert.equal(await getVersionHtml("missing"), undefined);
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
    assert.equal(
      await getVersionHtml(imported.versions[0].id),
      demos[0].versions[0].html,
    );

    // Server-side pagination, filtering, counting, and deletion
    await addVersion({
      ...input,
      name: "Analytics Portal",
      category: "Dashboard",
    });
    assert.equal(await countDesigns(), 3);
    assert.equal(await countDesigns({ category: "Dashboard" }), 1);
    assert.equal(
      (await listDesigns({ search: "analytics" }))[0].name,
      "Analytics Portal",
    );
    const paged = await listDesigns({ limit: 1, offset: 1 });
    assert.equal(paged.length, 1);

    assert.equal(await deleteDesign(id), true);
    assert.equal(await deleteDesign("missing"), false);
    assert.equal(await countDesigns(), 2);
  } finally {
    process.chdir(oldCwd);
    if (oldUrl !== undefined) process.env.DATABASE_URL = oldUrl;
  }
});
