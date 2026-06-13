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
import { createReplayGuard } from "./policy/replay-guard.js";
import { createSpendGuard } from "./policy/spend-guard.js";
import { quoteRoute } from "./routes/quote.js";
import { submitRoute } from "./routes/submit.js";
import { depositQuoteRoute } from "./routes/deposit-quote.js";
import { submitDepositRoute } from "./routes/submit-deposit.js";

async function main() {
  const config = loadConfig();
  const app = Fastify({
    // Trust the proxy hop when deployed behind a CDN/LB so req.ip is the real
    // client (otherwise every request shares one rate-limit bucket).
    trustProxy: config.trustProxy,
    logger: {
      level: config.logLevel,
      redact: ["req.headers.authorization", "req.body.tx_base64"],
    },
  });

  // Loud warning when running open to the world with no auth.
  const publicBind = config.host === "0.0.0.0" || config.host === "::";
  if (!config.apiKey && publicBind) {
    app.log.warn(
      "SECURITY: relayer is bound to a public interface (%s) with NO API_KEY set — every caller can spend the fee-payer's SOL. Set API_KEY or bind to 127.0.0.1.",
      config.host,
    );
  }
  if (publicBind && !config.trustProxy) {
    app.log.warn(
      "rate-limit: bound publicly with TRUST_PROXY=false — behind a proxy/CDN all clients share one IP bucket. Set TRUST_PROXY=true if fronted by a trusted proxy.",
    );
  }

  const connection = new Connection(config.rpcUrl, "confirmed");

  const spendGuard = createSpendGuard(connection, {
    feePayer: config.feePayer.publicKey,
    minBalanceLamports: config.minBalanceLamports,
    maxPerWindow: config.maxTxPerWindow,
    windowSeconds: config.spendWindowSeconds,
  });
  const replayGuard = createReplayGuard(config.replayTtlSeconds);
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
      // Fail CLOSED: a sanctions source was configured but we couldn't load it.
      // Starting with an empty (fail-open) list would silently disable
      // screening — refuse to start instead.
      app.log.fatal(
        { err: (e as Error).message },
        "sanctions list configured but initial load failed — refusing to start (fail-closed)",
      );
      throw new Error("sanctions list initial load failed");
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
      spendGuard,
      replayGuard,
    });
  });

  await app.register(async (api) => {
    api.addHook("preHandler", auth);
    await depositQuoteRoute(api, { config, connection, ipLimiter });
  });
  await app.register(async (api) => {
    api.addHook("preHandler", auth);
    await submitDepositRoute(api, {
      config,
      kora,
      ipLimiter,
      sanctions,
      spendGuard,
      replayGuard,
    });
  });

  await app.listen({ port: config.port, host: config.host });
}

main().catch((err: unknown) => {
  console.error("relayer: fatal", err);
  process.exit(1);
});
