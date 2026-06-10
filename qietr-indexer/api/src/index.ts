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
