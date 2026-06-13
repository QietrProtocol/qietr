// =============================================================================
// x402.test.mjs — wrapFetch parse / pay / retry / guard tests.
//
// The wrapper is the most security-sensitive module in the SDK (it auto-pays
// on a merchant's 402). These tests pin the spend guard, asset/network
// negotiation, the x402 envelope shape, and typed-error propagation.
//
// Runs against the compiled dist output (mirrors the other test files).
// =============================================================================

import { describe, it } from "node:test";
import assert from "node:assert";
import { Keypair, PublicKey } from "@solana/web3.js";

const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v").toBase58();
const PAYEE = Keypair.generate().publicKey.toBase58();
const FEE_PAYER = { publicKey: Keypair.generate().publicKey, signTransaction: async (t) => t };

const NOTE = {
  version: "qietr.v1",
  commitments: [{ secret: "1", nullifier: "2", amount: 1_000_000, denomId: 1 }],
};

/** Build a 402 Response whose JSON body is an x402 accepts envelope. */
function res402(accepts, extra = {}) {
  return new Response(JSON.stringify({ x402Version: 1, accepts, ...extra }), {
    status: 402,
    headers: { "content-type": "application/json" },
  });
}

function requirement(over = {}) {
  return {
    scheme: "exact",
    network: "solana-devnet",
    asset: USDC,
    payTo: PAYEE,
    maxAmountRequired: "500000",
    resource: "https://api.example.com/data",
    ...over,
  };
}

/** Default options factory; callers override per test. */
function opts(over = {}) {
  let note = NOTE;
  const payCalls = [];
  return {
    payCalls,
    options: {
      getNote: () => note,
      setNote: (n) => { note = n; },
      pay: async (req) => {
        payCalls.push(req);
        return {
          updatedNote: { version: "qietr.v1", commitments: [] },
          withdrawSignature: "SIG_" + req.micro.toString(),
        };
      },
      getFeePayer: () => FEE_PAYER,
      networkId: "solana-devnet",
      usdcMint: USDC,
      maxAmountMicro: 1_000_000n,
      ...over,
    },
  };
}

describe("wrapFetch — spend guard", () => {
  it("pays a valid 402 and retries with X-PAYMENT envelope", async () => {
    const { wrapFetch, X402_VERSION } = await import("../dist/x402.js");
    let seenHeader = null;
    const base = async (_input, init) => {
      if (init?.headers?.["X-PAYMENT"]) {
        seenHeader = init.headers["X-PAYMENT"];
        return new Response("ok", { status: 200 });
      }
      return res402([requirement()]);
    };
    const { options, payCalls } = opts();
    const f = wrapFetch(base, options);
    const r = await f("https://api.example.com/data");
    assert.equal(r.status, 200);
    assert.equal(payCalls.length, 1);
    assert.equal(payCalls[0].micro, 500_000n, "pays maxAmountRequired as bigint");

    const env = JSON.parse(Buffer.from(seenHeader, "base64").toString("utf-8"));
    assert.equal(env.x402Version, X402_VERSION);
    assert.equal(env.scheme, "exact");
    assert.equal(env.network, "solana-devnet");
    assert.equal(env.payload.amount, "500000");
    assert.equal(env.payload.payTo, PAYEE);
    assert.ok(env.payload.signature?.startsWith("SIG_"), "carries settlement signature");
    assert.equal(env.payload.resource, "https://api.example.com/data");
  });

  it("throws X402AmountExceededError when amount > maxAmountMicro", async () => {
    const { wrapFetch } = await import("../dist/x402.js");
    const { X402AmountExceededError } = await import("../dist/errors.js");
    const base = async () => res402([requirement({ maxAmountRequired: "2000000" })]);
    const { options, payCalls } = opts();
    const f = wrapFetch(base, options);
    await assert.rejects(() => f("https://api.example.com/data"), X402AmountExceededError);
    assert.equal(payCalls.length, 0, "never pays when over cap");
  });

  it("reads x402 v1 maxAmountRequired and falls back to legacy amount", async () => {
    const { wrapFetch } = await import("../dist/x402.js");
    const base = async (_i, init) =>
      init?.headers?.["X-PAYMENT"]
        ? new Response("ok", { status: 200 })
        : res402([requirement({ maxAmountRequired: undefined, amount: "400000" })]);
    const { options, payCalls } = opts();
    const f = wrapFetch(base, options);
    const r = await f("https://api.example.com/data");
    assert.equal(r.status, 200);
    assert.equal(payCalls[0].micro, 400_000n);
  });

  it("throws X402PayToNotAllowedError when payTo not on allowlist", async () => {
    const { wrapFetch } = await import("../dist/x402.js");
    const { X402PayToNotAllowedError } = await import("../dist/errors.js");
    const base = async () => res402([requirement()]);
    const { options, payCalls } = opts({ payToAllowlist: [Keypair.generate().publicKey.toBase58()] });
    const f = wrapFetch(base, options);
    await assert.rejects(() => f("https://api.example.com/data"), X402PayToNotAllowedError);
    assert.equal(payCalls.length, 0);
  });

  it("allows payTo that is on the allowlist", async () => {
    const { wrapFetch } = await import("../dist/x402.js");
    const base = async (_i, init) =>
      init?.headers?.["X-PAYMENT"]
        ? new Response("ok", { status: 200 })
        : res402([requirement()]);
    const { options, payCalls } = opts({ payToAllowlist: [PAYEE] });
    const f = wrapFetch(base, options);
    const r = await f("https://api.example.com/data");
    assert.equal(r.status, 200);
    assert.equal(payCalls.length, 1);
  });

  it("throws X402AssetMismatchError on non-USDC asset", async () => {
    const { wrapFetch } = await import("../dist/x402.js");
    const { X402AssetMismatchError } = await import("../dist/errors.js");
    const other = Keypair.generate().publicKey.toBase58();
    const base = async () => res402([requirement({ asset: other })]);
    const { options, payCalls } = opts();
    const f = wrapFetch(base, options);
    await assert.rejects(() => f("https://api.example.com/data"), X402AssetMismatchError);
    assert.equal(payCalls.length, 0);
  });

  it("throws X402NoMatchingRequirementError when network doesn't match", async () => {
    const { wrapFetch } = await import("../dist/x402.js");
    const { X402NoMatchingRequirementError } = await import("../dist/errors.js");
    const base = async () => res402([requirement({ network: "ethereum" })]);
    const { options } = opts();
    const f = wrapFetch(base, options);
    await assert.rejects(() => f("https://api.example.com/data"), X402NoMatchingRequirementError);
  });

  it("matches network aliases (mainnet-beta ~ solana)", async () => {
    const { wrapFetch } = await import("../dist/x402.js");
    const base = async (_i, init) =>
      init?.headers?.["X-PAYMENT"]
        ? new Response("ok", { status: 200 })
        : res402([requirement({ network: "mainnet-beta" })]);
    const { options, payCalls } = opts({ networkId: "solana", maxAmountMicro: 1_000_000n });
    const f = wrapFetch(base, options);
    const r = await f("https://api.example.com/data");
    assert.equal(r.status, 200);
    assert.equal(payCalls.length, 1);
  });

  it("requires a positive maxAmountMicro at construction", async () => {
    const { wrapFetch } = await import("../dist/x402.js");
    const { options } = opts({ maxAmountMicro: 0n });
    assert.throws(() => wrapFetch(async () => new Response(), options));
  });

  it("does not double-settle a re-requested 402 within one call", async () => {
    const { wrapFetch } = await import("../dist/x402.js");
    const { X402PaymentFailedError } = await import("../dist/errors.js");
    // Merchant keeps returning 402 even after payment.
    const base = async () => res402([requirement()]);
    const { options, payCalls } = opts({ maxRetries: 3 });
    const f = wrapFetch(base, options);
    await assert.rejects(() => f("https://api.example.com/data"), X402PaymentFailedError);
    assert.equal(payCalls.length, 1, "pays at most once for the same requirement");
  });

  it("throws X402PaymentFailedError with no note loaded", async () => {
    const { wrapFetch } = await import("../dist/x402.js");
    const { X402PaymentFailedError } = await import("../dist/errors.js");
    const base = async () => res402([requirement()]);
    const { options } = opts({ getNote: () => null });
    const f = wrapFetch(base, options);
    await assert.rejects(() => f("https://api.example.com/data"), X402PaymentFailedError);
  });

  it("passes through non-402 responses untouched", async () => {
    const { wrapFetch } = await import("../dist/x402.js");
    const base = async () => new Response("hi", { status: 200 });
    const { options, payCalls } = opts();
    const f = wrapFetch(base, options);
    const r = await f("https://api.example.com/data");
    assert.equal(r.status, 200);
    assert.equal(payCalls.length, 0);
  });
});

describe("normalizeNetwork", () => {
  it("collapses solana mainnet aliases", async () => {
    const { normalizeNetwork } = await import("../dist/x402.js");
    for (const a of ["solana", "solana-mainnet", "mainnet-beta", "solana:mainnet"]) {
      assert.equal(normalizeNetwork(a), "solana");
    }
    assert.equal(normalizeNetwork("solana-devnet"), "solana-devnet");
    assert.equal(normalizeNetwork("devnet"), "solana-devnet");
  });
});
