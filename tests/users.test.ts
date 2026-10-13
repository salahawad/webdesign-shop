import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setUser, userExists, USERNAME, verifyUser } from "../lib/users";

test("users sign in with their own password, and re-adding a user resets it", async () => {
  const oldCwd = process.cwd();
  const oldUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.chdir(mkdtempSync(join(tmpdir(), "sa-studio-users-")));
  try {
    await setUser("maya", "first-password");
    await setUser("salah", "other-password");
    assert.equal(await verifyUser("maya", "first-password"), true);
    assert.equal(await verifyUser("maya", "other-password"), false);
    assert.equal(await verifyUser("nobody", "first-password"), false);
    assert.equal(await userExists("maya"), true);
    assert.equal(await userExists("nobody"), false);
    await setUser("maya", "reset-password");
    assert.equal(await verifyUser("maya", "first-password"), false);
    assert.equal(await verifyUser("maya", "reset-password"), true);
    assert.equal(await verifyUser("salah", "other-password"), true);
  } finally {
    process.chdir(oldCwd);
    if (oldUrl !== undefined) process.env.DATABASE_URL = oldUrl;
  }
});

test("usernames cannot contain the session token separator", () => {
  assert.equal(USERNAME.test("maya_r-2"), true);
  assert.equal(USERNAME.test("maya.r"), false);
  assert.equal(USERNAME.test("Maya"), false);
  assert.equal(USERNAME.test(""), false);
});
