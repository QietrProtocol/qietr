// =============================================================================
// kora.ts — thin HTTP client around an upstream Kora instance.
//
// Kora's `transaction/sign_and_send` accepts a base64-encoded versioned or
// legacy Solana transaction, adds its fee-payer signature, and forwards
// to an RPC. The relayer uses this as the gasless backend for withdraws.
//
// When KORA_URL is not configured, we fall back to a direct RPC submit
// where the relayer's own Keypair signs as fee-payer in-process. That
// path is preferred for self-hosted deployments where Kora isn't desired.
// =============================================================================

import { Connection, Keypair, Transaction } from "@solana/web3.js";

export interface KoraClient {
  /** Forward a base64-encoded transaction. Returns the on-chain signature. */
  sendTransaction(txBase64: string): Promise<string>;
  /** Health probe for upstream Kora; used by /health. */
  ping(): Promise<boolean>;
}

export interface DirectRpcConfig {
  rpcUrl: string;
  feePayer: Keypair;
}

/**
 * Direct-RPC backend: relayer holds its own Keypair, signs as fee-payer,
 * and submits via `Connection.sendRawTransaction`. Used when a Kora
 * upstream isn't configured.
 */
export function createDirectRpcClient(config: DirectRpcConfig): KoraClient {
  const connection = new Connection(config.rpcUrl, "confirmed");

  return {
    async sendTransaction(txBase64: string): Promise<string> {
      const buf = Buffer.from(txBase64, "base64");
      const tx = Transaction.from(buf);
      if (!tx.recentBlockhash) {
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
      }
      // Ensure our keypair is set as fee-payer if the client didn't already.
      if (!tx.feePayer) {
        tx.feePayer = config.feePayer.publicKey;
      }
      tx.partialSign(config.feePayer);
      const raw = tx.serialize({ requireAllSignatures: false });
      return connection.sendRawTransaction(raw, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
    },
    async ping(): Promise<boolean> {
      try {
        await connection.getLatestBlockhash("confirmed");
        return true;
      } catch {
        return false;
      }
    },
  };
}

interface KoraJsonRpcResponse {
  jsonrpc: string;
  id: number | string;
  result?: { signature: string };
  error?: { code: number; message: string };
}

/**
 * Upstream-Kora backend: POSTs to a Kora JSON-RPC endpoint. The exact
 * method name is configurable to accommodate Kora's evolving schema; the
 * default `transaction_signAndSend` matches the May 2026 release.
 */
export function createKoraJsonRpcClient(
  url: string,
  method = "transaction_signAndSend",
): KoraClient {
  return {
    async sendTransaction(txBase64: string): Promise<string> {
      const body = {
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params: { transaction: txBase64, encoding: "base64" },
      };
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`kora ${res.status}: ${await res.text()}`);
      }
      const json = (await res.json()) as KoraJsonRpcResponse;
      if (json.error) {
        throw new Error(`kora rpc error: ${json.error.message}`);
      }
      if (!json.result?.signature) {
        throw new Error("kora rpc returned no signature");
      }
      return json.result.signature;
    },
    async ping(): Promise<boolean> {
      try {
        const res = await fetch(url, { method: "GET" });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
