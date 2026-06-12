import type { FastifyInstance } from "fastify";
import type { RelayerConfig } from "../config.js";
import type { RateLimiter } from "../policy/rate-limit.js";

export interface QuoteDeps {
  config: RelayerConfig;
  ipLimiter: RateLimiter;
}

export async function quoteRoute(
  app: FastifyInstance,
  deps: QuoteDeps,
): Promise<void> {
  app.get("/quote", async (req, reply) => {
    const ip = req.ip ?? "unknown";
    const ipDecision = await deps.ipLimiter.check(
      `ip:${ip}`,
      deps.config.rateIpWindowSeconds,
      deps.config.rateIpLimit,
    );
    if (!ipDecision.allowed) {
      return reply.code(429).send({
        error: ipDecision.reason ?? "rate_limited",
        retryAfterSeconds: ipDecision.retryAfterSeconds,
      });
    }

    return reply.send({
      feePayer: deps.config.feePayer.publicKey.toBase58(),
      programId: deps.config.programId.toBase58(),
      feeBps: deps.config.feeBps,
      tiers: deps.config.denomTiers.map((t) => ({
        denomId: t.denomId,
        amountMicroUsdc: t.amountMicroUsdc.toString(),
      })),
      rate: {
        limit: ipDecision.limit,
        remaining: ipDecision.remaining,
        windowSeconds: deps.config.rateIpWindowSeconds,
      },
    });
  });
}
