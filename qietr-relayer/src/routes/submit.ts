import type { FastifyInstance } from "fastify";
import { Connection } from "@solana/web3.js";
import type { RelayerConfig } from "../config.js";
import type { KoraClient } from "../kora.js";
import type { RateLimiter } from "../policy/rate-limit.js";
import type { SanctionsList } from "../policy/sanctions.js";
import type { ReplayGuard } from "../policy/replay-guard.js";
import type { SpendGuard } from "../policy/spend-guard.js";
import {
  ValidationError,
  decodeAndValidateWithdraw,
  decodeAtaOwner,
} from "../tx-validation.js";

export interface SubmitDeps {
  config: RelayerConfig;
  kora: KoraClient;
  connection: Connection;
  ipLimiter: RateLimiter;
  recipientLimiter: RateLimiter;
  sanctions: SanctionsList;
  spendGuard: SpendGuard;
  replayGuard: ReplayGuard;
}

interface SubmitBody {
  tx_base64?: string;
}

export async function submitRoute(
  app: FastifyInstance,
  deps: SubmitDeps,
): Promise<void> {
  app.post<{ Body: SubmitBody }>("/submit", async (req, reply) => {
    const ip = req.ip ?? "unknown";

    // Step 1: per-IP rate limit applies before any decode work.
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

    const { tx_base64 } = req.body ?? {};
    if (!tx_base64) {
      return reply.code(400).send({
        error: "missing_param",
        required: ["tx_base64"],
      });
    }

    // Step 1b: replay defense — reject the same tx within the TTL window.
    if (!deps.replayGuard.admit(tx_base64)) {
      return reply.code(409).send({ error: "replayed_tx" });
    }

    // Step 2: decode and structurally validate the tx.
    let validated;
    try {
      validated = decodeAndValidateWithdraw(
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

    const knownTier = deps.config.denomTiers.find(
      (t) => t.denomId === validated.denomId,
    );
    if (!knownTier) {
      return reply
        .code(400)
        .send({ error: "unknown_denom_id", denomId: validated.denomId });
    }

    // Step 3: resolve recipient ATA owner for policy checks.
    const ataInfo = await deps.connection.getAccountInfo(
      validated.recipientAta,
      "confirmed",
    );
    if (!ataInfo) {
      return reply.code(400).send({
        error: "recipient_ata_not_found",
        recipientAta: validated.recipientAta.toBase58(),
      });
    }
    let ownerPubkey;
    try {
      ownerPubkey = decodeAtaOwner(ataInfo.data);
    } catch (e) {
      if (e instanceof ValidationError) {
        return reply.code(400).send({ error: e.code, message: e.message });
      }
      throw e;
    }
    const ownerBase58 = ownerPubkey.toBase58();

    // Step 4: sanctions check on the recipient owner.
    if (deps.sanctions.isBlocked(ownerBase58)) {
      return reply.code(403).send({
        error: "sanctioned_recipient",
        recipient: ownerBase58,
      });
    }

    // Step 5: per-recipient rate limit (separately tunable so noisy
    // recipients can't get rate-limited solely by IP gymnastics).
    const recipientDecision = await deps.recipientLimiter.check(
      `recipient:${ownerBase58}`,
      deps.config.rateRecipientWindowSeconds,
      deps.config.rateRecipientLimit,
    );
    if (!recipientDecision.allowed) {
      return reply.code(429).send({
        error: recipientDecision.reason ?? "rate_limited_recipient",
        retryAfterSeconds: recipientDecision.retryAfterSeconds,
      });
    }

    // Step 6: economic guard — confirm the relayer can afford the fee and is
    // within its per-window spend cap before paying SOL to forward.
    const spend = await deps.spendGuard.check();
    if (!spend.allowed) {
      return reply.code(503).send({ error: spend.reason ?? "relayer_unavailable" });
    }

    // Step 7: forward to backend (Kora or direct RPC).
    let signature: string;
    try {
      signature = await deps.kora.sendTransaction(tx_base64);
      deps.spendGuard.commit();
    } catch (e) {
      const msg = (e as Error).message;
      // Surface program errors verbatim so the SDK can map them, but keep
      // anything that looks like a network failure as a 5xx.
      if (msg.toLowerCase().includes("rpc")) {
        return reply.code(502).send({ error: "rpc_error", message: msg });
      }
      return reply.code(400).send({ error: "submit_failed", message: msg });
    }

    return reply.send({ signature });
  });
}
