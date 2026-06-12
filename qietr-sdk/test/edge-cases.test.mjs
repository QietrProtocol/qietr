import { describe, it } from "node:test";
import assert from "node:assert";
import { Keypair } from "@solana/web3.js";

describe("parseJobAccount edge cases", () => {
  it("parses all JobState values correctly", async () => {
    const { parseJobAccount, JOB_ACCOUNT_SIZE, JobState } = await import("../dist/escrow.js");
    const { sha256 } = await import("@noble/hashes/sha256");
    const client = Keypair.generate().publicKey;

    const states = [JobState.Created, JobState.Accepted, JobState.Completed,
      JobState.Released, JobState.Disputed, JobState.Refunded];

    for (const state of states) {
      const data = new Uint8Array(JOB_ACCOUNT_SIZE);
      const disc = sha256(new TextEncoder().encode("account:Job")).slice(0, 8);
      data.set(disc, 0);
      let off = 8;
      data.set(client.toBytes(), off); off += 32;
      // skip agent(32) + nonce(8) + price(8) + created(8) + accepted(8) + completed(8) + resolved(8)
      off += 32 + 8 + 8 + 8 + 8 + 8 + 8;
      data[off] = state;

      const parsed = parseJobAccount(data);
      assert(parsed !== null, `should parse state ${state}`);
      assert.equal(parsed.state, state, `state should be ${state}`);
    }
  });

  it("rejects data smaller than JOB_ACCOUNT_SIZE", async () => {
    const { parseJobAccount, JOB_ACCOUNT_SIZE } = await import("../dist/escrow.js");
    assert.equal(parseJobAccount(new Uint8Array(JOB_ACCOUNT_SIZE - 1)), null);
    assert.equal(parseJobAccount(new Uint8Array(8)), null);
    assert.equal(parseJobAccount(new Uint8Array(0)), null);
  });

  it("rejects data with wrong discriminator", async () => {
    const { parseJobAccount } = await import("../dist/escrow.js");
    const data = new Uint8Array(200);
    data[0] = 0xff; data[1] = 0xff;
    assert.equal(parseJobAccount(data), null);
  });
});

describe("parseMessageAccount edge cases", () => {
  it("returns null for exactly 1114 bytes (one short)", async () => {
    const { parseMessageAccount } = await import("../dist/msg.js");
    assert.equal(parseMessageAccount(new Uint8Array(1114)), null);
  });

  it("returns null for empty buffer", async () => {
    const { parseMessageAccount } = await import("../dist/msg.js");
    assert.equal(parseMessageAccount(new Uint8Array(0)), null);
  });
});

describe("helpers edge cases", () => {
  it("getNoteBalance handles empty commitments array", async () => {
    const { getNoteBalance } = await import("../dist/helpers.js");
    assert.strictEqual(getNoteBalance({ version: "qietr.v1", commitments: [] }), 0);
  });

  it("hasEnoughBalance returns false for empty commitments", async () => {
    const { hasEnoughBalance } = await import("../dist/helpers.js");
    assert.strictEqual(hasEnoughBalance({ version: "qietr.v1", commitments: [] }, 1), false);
  });

  it("getLargestCommitment returns null for empty commitments", async () => {
    const { getLargestCommitment } = await import("../dist/helpers.js");
    assert.strictEqual(getLargestCommitment({ version: "qietr.v1", commitments: [] }), null);
  });

  it("getLargestCommitment picks the single commitment when only one", async () => {
    const { getLargestCommitment } = await import("../dist/helpers.js");
    const note = {
      version: "qietr.v1",
      commitments: [{ secret: "a", nullifier: "b", amount: 42, denomId: 0 }],
    };
    assert.strictEqual(getLargestCommitment(note)?.amount, 42);
  });

  it("parseUSDCAmount rejects empty string", async () => {
    const { parseUSDCAmount } = await import("../dist/helpers.js");
    assert.throws(() => parseUSDCAmount(""), /invalid USDC amount/);
    assert.throws(() => parseUSDCAmount("   "), /invalid USDC amount/);
  });

  it("parseUSDCAmount rejects negative values", async () => {
    const { parseUSDCAmount } = await import("../dist/helpers.js");
    assert.throws(() => parseUSDCAmount("-1"), /invalid USDC amount/);
    assert.throws(() => parseUSDCAmount("-0.01"), /invalid USDC amount/);
  });

  it("formatUSDCAmount handles very large amounts", async () => {
    const { formatUSDCAmount } = await import("../dist/errors.js");
    assert.strictEqual(formatUSDCAmount(1_000_000_000_000), "1000000.00");
    assert.strictEqual(formatUSDCAmount(999_999_990_000), "999999.99");
  });
});

describe("encryptMsgBody edge cases", () => {
  it("handles empty string", async () => {
    const { encryptMsgBody, decryptMsgBody } = await import("../dist/msg.js");
    const encrypted = await encryptMsgBody("", "pass");
    const decrypted = await decryptMsgBody(encrypted, "pass");
    assert.equal(decrypted, "");
  });

  it("rejects corrupt encrypted data", async () => {
    const { decryptMsgBody } = await import("../dist/msg.js");
    const corrupt = Buffer.from("aaaa").toString("base64");
    await assert.rejects(() => decryptMsgBody(corrupt, "pass"), /too short/);
  });
});

describe("error classes", () => {
  it("all error classes have correct names", async () => {
    const mod = await import("../dist/errors.js");
    const cases = [
      { name: "InsufficientBalanceError", args: [100, 200], msg: "insufficient balance:" },
      { name: "InvalidNoteError", args: ["bad format"], msg: "invalid note:" },
      { name: "DecryptionError", args: ["wrong key"], msg: "decryption failed:" },
      { name: "MerkleProofError", args: ["invalid path"], msg: "Merkle proof error:" },
      { name: "ProofGenerationError", args: ["witness failed"], msg: "ZK proof generation failed:" },
      { name: "RelayerError", args: ["timeout"], msg: "relayer error:" },
      { name: "NetworkError", args: ["disconnected"], msg: "network error:" },
      { name: "PaymentRequiredError", args: [], msg: "HTTP 402" },
      { name: "NullifierSpentError", args: [], msg: "nullifier already spent" },
    ];

    for (const c of cases) {
      const err = new (mod[c.name])(...c.args);
      assert(err instanceof mod.QietrSDKError, `${c.name} should extend QietrSDKError`);
      assert.equal(err.name, c.name);
      assert(err.message.includes(c.msg), `${c.name}.message should include "${c.msg}", got "${err.message}"`);
    }
  });
});
