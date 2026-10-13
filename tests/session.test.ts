import test from "node:test";
import assert from "node:assert/strict";
import {
  createSession,
  loginConfiguration,
  sameOrigin,
  validPassword,
  validSession,
  SESSION_SECONDS,
} from "../lib/session";

test("team sessions require configured secrets and reject forged, expired, and future tokens", () => {
  const old = {
    password: process.env.STUDIO_PASSWORD,
    secret: process.env.SESSION_SECRET,
    nodeEnv: process.env.NODE_ENV,
  };
  Object.assign(process.env, {
    NODE_ENV: "production",
    STUDIO_PASSWORD: "test-password-for-unit-tests",
    SESSION_SECRET: "test-signing-secret-long-enough-for-unit-tests",
  });
  try {
    assert.equal(loginConfiguration(), "protected");
    assert.equal(validPassword("test-password-for-unit-tests"), true);
    assert.equal(validPassword("wrong"), false);
    const now = 1000000;
    const token = createSession(now);
    assert.equal(validSession(token, now), true);
    assert.equal(validSession(token, now + SESSION_SECONDS * 1000), false);
    assert.equal(validSession(createSession(now + 1000), now), false);
    assert.equal(
      validSession(token.slice(0, -1) + (token.endsWith("0") ? "1" : "0"), now),
      false,
    );
    assert.equal(validSession(token + ".extra", now), false);
    assert.equal(validSession("garbage", now), false);
    assert.equal(validSession(undefined, now), false);
    delete process.env.STUDIO_PASSWORD;
    assert.equal(loginConfiguration(), "missing");
    assert.equal(validSession(token, now), false);
  } finally {
    for (const [key, value] of Object.entries({
      STUDIO_PASSWORD: old.password,
      SESSION_SECRET: old.secret,
      NODE_ENV: old.nodeEnv,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("mutations reject absent, foreign, and sandboxed origins", () => {
  const request = (origin?: string) =>
    new Request("https://studio.example/api/designs", {
      headers: origin ? { Origin: origin } : {},
    });
  assert.equal(sameOrigin(request("https://studio.example")), true);
  assert.equal(sameOrigin(request("https://other.example")), false);
  assert.equal(sameOrigin(request("null")), false);
  assert.equal(sameOrigin(request()), false);
  assert.equal(
    sameOrigin(
      new Request("http://localhost:5173/api/designs", {
        headers: { Origin: "http://127.0.0.1:5173", Host: "127.0.0.1:5173" },
      }),
    ),
    true,
  );
  assert.equal(
    sameOrigin(
      new Request("http://localhost/api/designs", {
        headers: {
          Origin: "https://studio.example",
          Host: "studio.example",
          "x-forwarded-proto": "https",
        },
      }),
    ),
    true,
  );
  assert.equal(
    sameOrigin(
      new Request("http://localhost/api/designs", {
        headers: {
          Origin: "https://other.example",
          Host: "studio.example",
          "x-forwarded-proto": "https",
        },
      }),
    ),
    false,
  );
});
