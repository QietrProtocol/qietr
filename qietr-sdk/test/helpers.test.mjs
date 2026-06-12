import { describe, it } from "node:test";
import assert from "node:assert";
import {
  getNoteBalance,
  hasEnoughBalance,
  getCommitmentCount,
  getLargestCommitment,
  parseUSDCAmount,
} from "../dist/helpers.js";
// formatUSDCAmount moved to errors.ts (used in InsufficientBalanceError) and is
// re-exported from the package index.
import { formatUSDCAmount } from "../dist/errors.js";

const dummyCommitments = [
  { secret: "1", nullifier: "1", amount: 10_000_000, denomId: 0 },
  { secret: "2", nullifier: "2", amount: 25_000_000, denomId: 1 },
  { secret: "3", nullifier: "3", amount: 5_000_000, denomId: 0 },
];

const dummyNote = { version: "qietr.v1", commitments: dummyCommitments };

describe("helpers", () => {
  it("getNoteBalance sums commitment amounts", () => {
    assert.strictEqual(getNoteBalance(dummyNote), 40_000_000);
  });

  it("getNoteBalance returns 0 for null", () => {
    assert.strictEqual(getNoteBalance(null), 0);
  });

  it("hasEnoughBalance returns true when sufficient", () => {
    assert.strictEqual(hasEnoughBalance(dummyNote, 10_000_000), true);
  });

  it("hasEnoughBalance returns false when insufficient", () => {
    assert.strictEqual(hasEnoughBalance(dummyNote, 100_000_000), false);
  });

  it("hasEnoughBalance returns false for null note", () => {
    assert.strictEqual(hasEnoughBalance(null, 100), false);
  });

  it("getCommitmentCount returns correct count", () => {
    assert.strictEqual(getCommitmentCount(dummyNote), 3);
  });

  it("getCommitmentCount returns 0 for null", () => {
    assert.strictEqual(getCommitmentCount(null), 0);
  });

  it("getLargestCommitment returns the largest commitment", () => {
    const largest = getLargestCommitment(dummyNote);
    assert.strictEqual(largest?.amount, 25_000_000);
  });

  it("getLargestCommitment returns null for null", () => {
    assert.strictEqual(getLargestCommitment(null), null);
  });

  it("formatUSDCAmount formats correctly", () => {
    // Canonical formatter (errors.ts) renders USD-style, 2 decimals.
    assert.strictEqual(formatUSDCAmount(10_000_000), "10.00");
    assert.strictEqual(formatUSDCAmount(0), "0.00");
    assert.strictEqual(formatUSDCAmount(1_234_567), "1.23");
  });

  it("parseUSDCAmount parses valid strings", () => {
    assert.strictEqual(parseUSDCAmount("10"), 10_000_000);
    assert.strictEqual(parseUSDCAmount("$5.50"), 5_500_000);
    assert.strictEqual(parseUSDCAmount("1,234.56"), 1_234_560_000);
  });

  it("parseUSDCAmount throws on invalid input", () => {
    assert.throws(() => parseUSDCAmount("abc"), /invalid USDC amount/);
    assert.throws(() => parseUSDCAmount("-5"), /invalid USDC amount/);
  });
});
