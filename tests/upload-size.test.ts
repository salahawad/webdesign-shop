import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { POST } from "../app/api/designs/route";
import { getVersionHtml, listDesigns } from "../lib/design-store";
import { MAX_UPLOAD_BYTES } from "../lib/upload";

test("uploads enforce the 4.5 MB JSON payload limit including UTF-8 and encoding overhead", async () => {
  const oldCwd = process.cwd();
  const keys = ["DATABASE_URL", "SESSION_SECRET", "NODE_ENV", "VERCEL"];
  const oldEnvironment = keys.map((key) => process.env[key]);
  const directory = mkdtempSync(join(tmpdir(), "studio-upload-size-"));
  process.chdir(directory);
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: "development" });
  const bodyOf = (html: string) =>
    JSON.stringify({
      name: "Large prototype",
      category: "Website",
      html,
      author: "Test designer",
      role: "Designer",
      notes: "",
      source: "HTML",
    });
  const upload = (html: string) =>
    POST(
      new Request("http://localhost/api/designs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: bodyOf(html),
      }),
    );
  try {
    assert.equal(MAX_UPLOAD_BYTES, 4_500_000);
    const head = '<!doctype html><h1>Large prototype</h1><!--"\\\n';
    const tail = "-->";
    const html =
      head +
      "x".repeat(MAX_UPLOAD_BYTES - Buffer.byteLength(bodyOf(head + tail))) +
      tail;
    assert.equal(Buffer.byteLength(bodyOf(html)), MAX_UPLOAD_BYTES);
    assert.ok(Buffer.byteLength(html) < MAX_UPLOAD_BYTES);
    const accepted = await upload(html);
    assert.equal(accepted.status, 201);
    const [design] = await listDesigns();
    assert.equal(await getVersionHtml(design.versions[0].id), html);
    assert.ok(Buffer.byteLength(JSON.stringify({ html })) < MAX_UPLOAD_BYTES);
    for (const oversized of [
      html + "x",
      "€".repeat(Math.floor(MAX_UPLOAD_BYTES / 3) + 1),
      "\\".repeat(Math.floor(MAX_UPLOAD_BYTES / 2) + 1),
    ]) {
      assert.ok(Buffer.byteLength(bodyOf(oversized)) > MAX_UPLOAD_BYTES);
      const response = await upload(oversized);
      assert.equal(response.status, 413);
      assert.match((await response.json()).error, /4\.5 MB/);
    }
    assert.equal((await upload(" ")).status, 400);
    const malformed = await POST(
      new Request("http://localhost/api/designs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: "{",
      }),
    );
    assert.equal(malformed.status, 400);
    assert.equal((await listDesigns()).length, 1);
    assert.equal((await listDesigns())[0].versions.length, 1);
  } finally {
    process.chdir(oldCwd);
    keys.forEach((key, index) => {
      if (oldEnvironment[index] === undefined) delete process.env[key];
      else process.env[key] = oldEnvironment[index];
    });
    rmSync(directory, { recursive: true, force: true });
  }
});
