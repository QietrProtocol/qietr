import { describe, it } from "node:test";
import assert from "node:assert";
import { requireAuth } from "../src/policy/auth.js";

// Minimal Fastify req/reply mocks. `reply.code().send()` records the response;
// `done()` records that the hook allowed the request through.
function makeReply() {
  const state: { code: number | null; payload: unknown } = { code: null, payload: null };
  const reply = {
    code(n: number) {
      state.code = n;
      return reply;
    },
    send(payload: unknown) {
      state.payload = payload;
      return reply;
    },
  };
  return { reply, state };
}

function run(hook: ReturnType<typeof requireAuth>, headers: Record<string, unknown>) {
  const { reply, state } = makeReply();
  let passed = false;
  hook({ headers } as never, reply as never, () => {
    passed = true;
  });
  return { passed, ...state };
}

describe("requireAuth", () => {
  it("allows all requests in dev mode (no API key configured)", () => {
    const hook = requireAuth(undefined);
    const { passed, code } = run(hook, {});
    assert.equal(passed, true);
    assert.equal(code, null);
  });

  it("rejects a missing Authorization header with 401", () => {
    const hook = requireAuth("secret");
    const { passed, code, payload } = run(hook, {});
    assert.equal(passed, false);
    assert.equal(code, 401);
    assert.deepEqual(payload, { error: "missing_authorization" });
  });

  it("rejects a non-Bearer scheme with 401", () => {
    const hook = requireAuth("secret");
    const { passed, code, payload } = run(hook, { authorization: "Basic abc123" });
    assert.equal(passed, false);
    assert.equal(code, 401);
    assert.deepEqual(payload, { error: "invalid_auth_scheme" });
  });

  it("rejects a wrong API key with 403", () => {
    const hook = requireAuth("secret");
    const { passed, code, payload } = run(hook, { authorization: "Bearer wrong" });
    assert.equal(passed, false);
    assert.equal(code, 403);
    assert.deepEqual(payload, { error: "invalid_api_key" });
  });

  it("allows a correct Bearer token (case-insensitive scheme)", () => {
    const hook = requireAuth("secret");
    const { passed, code } = run(hook, { authorization: "Bearer secret" });
    assert.equal(passed, true);
    assert.equal(code, null);
  });

  it("accepts the scheme case-insensitively and trims the token", () => {
    const hook = requireAuth("secret");
    const { passed } = run(hook, { authorization: "bearer  secret  " });
    assert.equal(passed, true);
  });
});
