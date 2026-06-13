// =============================================================================
// qietr-indexer api — server entrypoint.
//
// Routes query Postgres (schema in ../db/schema.sql) for denominations,
// Merkle proofs, and nullifier status. Requires DATABASE_URL env var.
// =============================================================================

import Fastify from "fastify";

import { denominationsRoute } from "./routes/denominations.js";
import { merkleProofRoute } from "./routes/merkle-proof.js";
import { nullifierStatusRoute } from "./routes/nullifier-status.js";

const PORT = Number(process.env.PORT ?? 4040);
const HOST = process.env.HOST ?? "0.0.0.0";

async function main() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
  });

  // Centralized error handler so an unexpected throw in any route (e.g. a
  // transient DB error) returns a clean 500 instead of leaking a stack trace
  // or surfacing as an unhandled rejection that takes down the process.
  app.setErrorHandler((err, _req, reply) => {
    app.log.error({ err: err.message }, "unhandled route error");
    reply.code(500).send({ error: "internal_error" });
  });

  app.get("/health", async () => ({ ok: true }));

  await app.register(denominationsRoute);
  await app.register(merkleProofRoute);
  await app.register(nullifierStatusRoute);

  await app.listen({ port: PORT, host: HOST });
}

main().catch((err: unknown) => {
  console.error("indexer-api: fatal", err);
  process.exit(1);
});
