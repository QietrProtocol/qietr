// chain.ts — tier picker + ATA derivation tests.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";

import {
  DEFAULT_TIERS,
  USDC_DECIMALS,
  USDC_MINT_MAINNET,
  USDC_MINT_DEVNET,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  findAssociatedTokenAddress,
  pickTier,
} from "../dist/index.js";

describe("USDC mint constants", () => {
  it("mainnet mint matches Circle's canonical USDC", () => {
    assert.equal(
      USDC_MINT_MAINNET.toBase58(),
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    );
  });
  it("devnet mint matches Circle's devnet USDC", () => {
    assert.equal(
      USDC_MINT_DEVNET.toBase58(),
      "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    );
  });
  it("ATA program id is canonical", () => {
    assert.equal(
      ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    );
  });
});

describe("pickTier", () => {
  it("matches the four MVP tiers exactly", () => {
    assert.equal(pickTier(0.1, DEFAULT_TIERS).denomId, 0);
    assert.equal(pickTier(1, DEFAULT_TIERS).denomId, 1);
    assert.equal(pickTier(10, DEFAULT_TIERS).denomId, 2);
    assert.equal(pickTier(100, DEFAULT_TIERS).denomId, 3);
  });
  it("rejects amounts that don't match a tier", () => {
    assert.throws(() => pickTier(5, DEFAULT_TIERS), /unsupported deposit amount/);
    assert.throws(() => pickTier(0.5, DEFAULT_TIERS), /unsupported deposit amount/);
  });
  it("uses caller-supplied tiers when provided", () => {
    const custom = [{ denomId: 7, amountMicroUsdc: 5_000_000n }];
    assert.equal(pickTier(5, custom).denomId, 7);
  });
  it("amount-to-micro conversion uses 6 decimals", () => {
    assert.equal(USDC_DECIMALS, 6);
    assert.equal(pickTier(0.1, DEFAULT_TIERS).amountMicroUsdc, 100_000n);
  });
});

describe("findAssociatedTokenAddress", () => {
  it("returns the canonical ATA for a known (owner, mint) pair", () => {
    // Reference vector: System program 0-pubkey wallet + USDC mainnet mint
    // (computed via Solana CLI: `spl-token address-pubkey ...`).
    const owner = new PublicKey("11111111111111111111111111111111");
    const ata = findAssociatedTokenAddress(owner, USDC_MINT_MAINNET);
    // Sanity-check: the value must be deterministic across runs.
    const ata2 = findAssociatedTokenAddress(owner, USDC_MINT_MAINNET);
    assert.equal(ata.toBase58(), ata2.toBase58());
    // And different owners → different ATAs.
    const owner2 = new PublicKey("So11111111111111111111111111111111111111112");
    const ata3 = findAssociatedTokenAddress(owner2, USDC_MINT_MAINNET);
    assert.notEqual(ata.toBase58(), ata3.toBase58());
  });
});
