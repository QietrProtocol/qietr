import type { FastifyInstance } from "fastify";
import type { RelayerConfig } from "../config.js";
import type { KoraClient } from "../kora.js";
import type { RateLimiter } from "../policy/rate-limit.js";
import type { SanctionsList } from "../policy/sanctions.js";
import {
  ValidationError,
  decodeAndValidateDeposit,
} from "../tx-validation.js";

export interface SubmitDepositDeps {
  config: RelayerConfig;
  kora: KoraClient;
  ipLimiter: RateLimiter;
  sanctions: SanctionsList;
}

interface SubmitDepositBody {
  tx_base64?: string;
}

export async function submitDepositRoute(
  app: FastifyInstance,
  deps: SubmitDepositDeps,
): Promise<void> {
  app.post<{ Body: SubmitDepositBody }>("/submit-deposit", async (req, reply) => {
    const ip = req.ip ?? "unknown";

    // Step 1: per-IP rate limit.
    const ipDecision = await deps.ipLimiter.check(
      `deposit:${ip}`,
      deps.config.rateIpWindowSeconds,
      deps.config.rateIpLimit,
    );
    if (!ipDecision.allowed) {
      return reply.code(429).send({
        error: ipDecision.reason ?? "rate_limited",
        retryAfterSeconds: ipDecision.retryAfterSeconds,
      });
    }

    const { tx_base64 } = req.body ?? {};
    if (!tx_base64) {
      return reply.code(400).send({
        error: "missing_param",
        required: ["tx_base64"],
      });
    }

    // Step 2: decode and validate the deposit tx.
    let validated;
    try {
      validated = decodeAndValidateDeposit(
        tx_base64,
        deps.config.programId,
        deps.config.feePayer.publicKey,
      );
    } catch (e) {
      if (e instanceof ValidationError) {
        return reply.code(400).send({ error: e.code, message: e.message });
      }
      throw e;
    }

    // Step 3: check depositor is not sanctioned.
    const depositorBase58 = validated.depositor.toBase58();
    if (deps.sanctions.isBlocked(depositorBase58)) {
      return reply.code(403).send({
        error: "sanctioned_depositor",
        depositor: depositorBase58,
      });
    }

    // Step 4: sign with feePayer and forward to backend.
    let signature: string;
    try {
      signature = await deps.kora.sendTransaction(tx_base64);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.toLowerCase().includes("rpc")) {
        return reply.code(502).send({ error: "rpc_error", message: msg });
      }
      return reply.code(400).send({ error: "submit_failed", message: msg });
    }

    return reply.send({ signature });
  });
}
