import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

const AUTH_HEADER = "authorization";
const BEARER_PREFIX = "bearer ";

/** Constant-time string compare that doesn't leak length via early return. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf-8");
  const bb = Buffer.from(b, "utf-8");
  // timingSafeEqual requires equal lengths; hash to a fixed width so a
  // length mismatch is itself constant-time.
  if (ab.length !== bb.length) {
    // Compare against self to burn the same time, then fail.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export function requireAuth(apiKey: string | undefined) {
  if (!apiKey) {
    // No API key configured — allow all requests (dev mode). index.ts emits a
    // loud startup warning when this is combined with a public bind address.
    return (_req: FastifyRequest, _reply: FastifyReply, done: () => void) => done();
  }

  return (req: FastifyRequest, reply: FastifyReply, done: () => void) => {
    const header = req.headers[AUTH_HEADER];
    if (!header || typeof header !== "string") {
      return reply.code(401).send({ error: "missing_authorization" });
    }
    const lower = header.toLowerCase();
    if (!lower.startsWith(BEARER_PREFIX)) {
      return reply.code(401).send({ error: "invalid_auth_scheme" });
    }
    const token = header.slice(BEARER_PREFIX.length).trim();
    // Constant-time compare to avoid leaking the key via response timing.
    if (!safeEqual(token, apiKey)) {
      return reply.code(403).send({ error: "invalid_api_key" });
    }
    done();
  };
}
