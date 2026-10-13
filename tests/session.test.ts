import test from "node:test";
import assert from "node:assert/strict";
import {
  createSession,
  loginConfiguration,
  sameOrigin,
  sessionUser,
  SESSION_SECONDS,
} from "../lib/session";

test("user sessions require a signing secret and reject forged, swapped, expired, and future tokens", () => {
  const old = {
    secret: process.env.SESSION_SECRET,
    nodeEnv: process.env.NODE_ENV,
  };
  Object.assign(process.env, {
    NODE_ENV: "production",
    SESSION_SECRET: "test-signing-secret-long-enough-for-unit-tests",
  });
  try {
    assert.equal(loginConfiguration(), "protected");
    const now = 1000000;
    const token = createSession("maya", now);
    assert.equal(sessionUser(token, now), "maya");
    assert.equal(sessionUser(token, now + SESSION_SECONDS * 1000), undefined);
    assert.equal(
      sessionUser(createSession("maya", now + 1000), now),
      undefined,
    );
    assert.equal(
      sessionUser(token.slice(0, -1) + (token.endsWith("0") ? "1" : "0"), now),
      undefined,
    );
    // A valid signature for one user must not sign in another.
    assert.equal(sessionUser(token.replace(/^maya/, "salah"), now), undefined);
    assert.equal(sessionUser(token + ".extra", now), undefined);
    assert.equal(sessionUser("garbage", now), undefined);
    assert.equal(sessionUser(undefined, now), undefined);
    delete process.env.SESSION_SECRET;
    assert.equal(loginConfiguration(), "missing");
    assert.equal(sessionUser(token, now), undefined);
    Object.assign(process.env, { NODE_ENV: "development" });
    assert.equal(loginConfiguration(), "open-local");
  } finally {
    for (const [key, value] of Object.entries({
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
