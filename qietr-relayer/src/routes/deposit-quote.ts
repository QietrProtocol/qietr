import type { FastifyInstance } from "fastify";
import { Connection } from "@solana/web3.js";
import type { RelayerConfig } from "../config.js";
import type { RateLimiter } from "../policy/rate-limit.js";

export interface DepositQuoteDeps {
  config: RelayerConfig;
  connection: Connection;
  ipLimiter: RateLimiter;
}

export async function depositQuoteRoute(
  app: FastifyInstance,
  deps: DepositQuoteDeps,
): Promise<void> {
  app.get("/deposit-quote", async (req, reply) => {
    const ip = req.ip ?? "unknown";
    const ipDecision = await deps.ipLimiter.check(
      `deposit-quote:${ip}`,
      deps.config.rateIpWindowSeconds,
      deps.config.rateIpLimit,
    );
    if (!ipDecision.allowed) {
      return reply.code(429).send({
        error: ipDecision.reason ?? "rate_limited",
        retryAfterSeconds: ipDecision.retryAfterSeconds,
      });
    }

    const { blockhash, lastValidBlockHeight } =
      await deps.connection.getLatestBlockhash("confirmed");

    const feeAta = deps.config.feeAta?.toBase58();
    if (!feeAta) {
      return reply.code(500).send({ error: "fee_ata_not_configured" });
    }

    return reply.send({
      feePayer: deps.config.feePayer.publicKey.toBase58(),
      feeAta,
      feeAmountMicro: deps.config.feeAmountMicro,
      blockhash,
      lastValidBlockHeight,
      feeBps: deps.config.feeBps,
    });
  });
}
