// =============================================================================
// qietr-relayer — server entrypoint.
//
// Accepts pre-built `qietr_pool.withdraw` transactions from the SDK, signs
// them as fee-payer, applies rate-limit + sanctions policy, and forwards
// to either an upstream Kora instance or directly to an RPC.
// =============================================================================

import { Connection } from "@solana/web3.js";
import Fastify from "fastify";

import { loadConfig } from "./config.js";
import {
  createDirectRpcClient,
  createKoraJsonRpcClient,
  type KoraClient,
} from "./kora.js";
import { createInMemoryRateLimiter } from "./policy/rate-limit.js";
import {
  createSanctionsList,
  emptySanctionsList,
} from "./policy/sanctions.js";
import { requireAuth } from "./policy/auth.js";
import { quoteRoute } from "./routes/quote.js";
import { submitRoute } from "./routes/submit.js";
import { depositQuoteRoute } from "./routes/deposit-quote.js";
import { submitDepositRoute } from "./routes/submit-deposit.js";

async function main() {
  const config = loadConfig();
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: ["req.headers.authorization", "req.body.tx_base64"],
    },
  });

  const connection = new Connection(config.rpcUrl, "confirmed");
  const kora: KoraClient = config.koraUrl
    ? createKoraJsonRpcClient(config.koraUrl)
    : createDirectRpcClient({
        rpcUrl: config.rpcUrl,
        feePayer: config.feePayer,
      });

  const ipLimiter = createInMemoryRateLimiter();
  const recipientLimiter = createInMemoryRateLimiter();

  const sanctions = config.sanctionsSource
    ? createSanctionsList(config.sanctionsSource)
    : emptySanctionsList();
  if (config.sanctionsSource) {
    try {
      await sanctions.reload();
      app.log.info({ size: sanctions.size() }, "loaded sanctions list");
    } catch (e) {
      app.log.error({ err: (e as Error).message }, "sanctions list load failed");
    }
    // Refresh hourly. Errors logged, not fatal.
    setInterval(() => {
      sanctions
        .reload()
        .then(() => app.log.info({ size: sanctions.size() }, "sanctions reloaded"))
        .catch((e: Error) =>
          app.log.error({ err: e.message }, "sanctions reload failed"),
        );
    }, 3600 * 1000).unref();
  }

  const auth = requireAuth(config.apiKey);

  app.get("/health", async () => {
    const koraOk = await kora.ping().catch(() => false);
    return { ok: koraOk, feePayer: config.feePayer.publicKey.toBase58() };
  });

  // All other routes require auth (if configured).
  await app.register(async (api) => {
    api.addHook("preHandler", auth);
    await quoteRoute(api, { config, ipLimiter });
  });
  await app.register(async (api) => {
    api.addHook("preHandler", auth);
    await submitRoute(api, {
      config,
      kora,
      connection,
      ipLimiter,
      recipientLimiter,
      sanctions,
    });
  });

  await app.register(async (api) => {
    api.addHook("preHandler", auth);
    await depositQuoteRoute(api, { config, connection, ipLimiter });
  });
  await app.register(async (api) => {
    api.addHook("preHandler", auth);
    await submitDepositRoute(api, { config, kora, ipLimiter, sanctions });
  });

  await app.listen({ port: config.port, host: config.host });
}

main().catch((err: unknown) => {
  console.error("relayer: fatal", err);
  process.exit(1);
});
