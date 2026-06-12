import type { FastifyReply, FastifyRequest } from "fastify";

const AUTH_HEADER = "authorization";
const BEARER_PREFIX = "bearer ";

export function requireAuth(apiKey: string | undefined) {
  if (!apiKey) {
    // No API key configured — allow all requests (dev mode).
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
    if (token !== apiKey) {
      return reply.code(403).send({ error: "invalid_api_key" });
    }
    done();
  };
}
