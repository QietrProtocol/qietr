import { describe, it } from "node:test";
import assert from "node:assert";
import { Keypair, PublicKey } from "@solana/web3.js";

describe("findJobPda / findEscrowVaultPda", () => {
  it("are deterministic", async () => {
    const { findJobPda, findEscrowVaultPda } = await import("../dist/escrow.js");
    const client = Keypair.generate().publicKey;
    const nonce = new Uint8Array(8).fill(0x42);
    const [a] = findJobPda(client, nonce);
    const [b] = findJobPda(client, nonce);
    assert.equal(a.toBase58(), b.toBase58());

    const [va] = findEscrowVaultPda(client, nonce);
    const [vb] = findEscrowVaultPda(client, nonce);
    assert.equal(va.toBase58(), vb.toBase58());
  });

  it("differ for different nonces", async () => {
    const { findJobPda, findEscrowVaultPda } = await import("../dist/escrow.js");
    const client = Keypair.generate().publicKey;
    const [a] = findJobPda(client, new Uint8Array(8).fill(1));
    const [b] = findJobPda(client, new Uint8Array(8).fill(2));
    assert.notEqual(a.toBase58(), b.toBase58());

    const [va] = findEscrowVaultPda(client, new Uint8Array(8).fill(1));
    const [vb] = findEscrowVaultPda(client, new Uint8Array(8).fill(2));
    assert.notEqual(va.toBase58(), vb.toBase58());
  });

  it("job and vault PDAs are different for same (client, nonce)", async () => {
    const { findJobPda, findEscrowVaultPda } = await import("../dist/escrow.js");
    const client = Keypair.generate().publicKey;
    const nonce = new Uint8Array(8).fill(0xab);
    const [job] = findJobPda(client, nonce);
    const [vault] = findEscrowVaultPda(client, nonce);
    assert.notEqual(job.toBase58(), vault.toBase58());
  });
});

describe("buildCreateJobIx", () => {
  it("builds a valid instruction", async () => {
    const { buildCreateJobIx, QIETR_ESCROW_PROGRAM_ID } = await import("../dist/escrow.js");
    const client = Keypair.generate().publicKey;
    const clientAta = Keypair.generate().publicKey;
    const mint = Keypair.generate().publicKey;
    const nonce = new Uint8Array(8).fill(0xaa);
    const priceMicro = BigInt(1_000_000);

    const ix = buildCreateJobIx(nonce, priceMicro, client, clientAta, mint);
    assert.equal(ix.programId.toBase58(), QIETR_ESCROW_PROGRAM_ID.toBase58());
    // 6 account keys: job, vault, clientAta, client, mint, systemProgram, tokenProgram, rent
    assert.equal(ix.keys.length, 8);
    assert.equal(ix.keys[3].pubkey.toBase58(), client.toBase58());
    assert.equal(ix.keys[3].isSigner, true);
    // data: disc(8) + nonce(8) + priceMicro(8) = 24
    assert.equal(ix.data.length, 24);
  });

  it("rejects bad nonce length", async () => {
    const { buildCreateJobIx } = await import("../dist/escrow.js");
    const pk = Keypair.generate().publicKey;
    assert.throws(
      () => buildCreateJobIx(new Uint8Array(4), BigInt(0), pk, pk, pk),
      /nonce must be 8 bytes/,
    );
  });
});

describe("accept / complete / release / dispute / refund instructions", () => {
  it("buildAcceptJobIx builds correctly", async () => {
    const { buildAcceptJobIx, QIETR_ESCROW_PROGRAM_ID } = await import("../dist/escrow.js");
    const jobPda = Keypair.generate().publicKey;
    const agent = Keypair.generate().publicKey;
    const ix = buildAcceptJobIx(jobPda, agent);
    assert.equal(ix.keys.length, 2);
    assert.equal(ix.keys[0].pubkey.toBase58(), jobPda.toBase58());
    assert.equal(ix.keys[1].pubkey.toBase58(), agent.toBase58());
    assert.equal(ix.keys[1].isSigner, true);
    assert.equal(ix.data.length, 8);
  });

  it("buildCompleteJobIx builds correctly", async () => {
    const { buildCompleteJobIx, QIETR_ESCROW_PROGRAM_ID } = await import("../dist/escrow.js");
    const jobPda = Keypair.generate().publicKey;
    const agent = Keypair.generate().publicKey;
    const ix = buildCompleteJobIx(jobPda, agent);
    assert.equal(ix.keys.length, 2);
    assert.equal(ix.keys[0].pubkey.toBase58(), jobPda.toBase58());
    assert.equal(ix.keys[1].pubkey.toBase58(), agent.toBase58());
    assert.equal(ix.keys[1].isSigner, true);
  });

  it("buildReleasePaymentIx builds correctly", async () => {
    const { buildReleasePaymentIx, QIETR_ESCROW_PROGRAM_ID } = await import("../dist/escrow.js");
    const jobPda = Keypair.generate().publicKey;
    const vault = Keypair.generate().publicKey;
    const agentAta = Keypair.generate().publicKey;
    const client = Keypair.generate().publicKey;
    const ix = buildReleasePaymentIx(jobPda, vault, agentAta, client);
    assert.equal(ix.keys.length, 5);
    assert.equal(ix.keys[3].pubkey.toBase58(), client.toBase58());
    assert.equal(ix.keys[3].isSigner, true);
  });

  it("buildDisputeJobIx builds correctly", async () => {
    const { buildDisputeJobIx } = await import("../dist/escrow.js");
    const jobPda = Keypair.generate().publicKey;
    const client = Keypair.generate().publicKey;
    const ix = buildDisputeJobIx(jobPda, client);
    assert.equal(ix.keys.length, 2);
    assert.equal(ix.keys[1].pubkey.toBase58(), client.toBase58());
    assert.equal(ix.keys[1].isSigner, true);
  });

  it("buildRefundJobIx builds correctly", async () => {
    const { buildRefundJobIx } = await import("../dist/escrow.js");
    const jobPda = Keypair.generate().publicKey;
    const vault = Keypair.generate().publicKey;
    const clientAta = Keypair.generate().publicKey;
    const client = Keypair.generate().publicKey;
    const ix = buildRefundJobIx(jobPda, vault, clientAta, client);
    assert.equal(ix.keys.length, 5);
    assert.equal(ix.keys[3].pubkey.toBase58(), client.toBase58());
    assert.equal(ix.keys[3].isSigner, true);
  });
});

describe("parseJobAccount", () => {
  it("parses a valid job account", async () => {
    const { parseJobAccount, findJobPda, JOB_ACCOUNT_SIZE, JobState } = await import("../dist/escrow.js");
    const { sha256 } = await import("@noble/hashes/sha256");
    const client = Keypair.generate().publicKey;
    const agent = Keypair.generate().publicKey;
    const nonce = new Uint8Array(8).fill(0x77);

    const data = new Uint8Array(JOB_ACCOUNT_SIZE);
    const disc = sha256(new TextEncoder().encode("account:Job")).slice(0, 8);
    data.set(disc, 0);
    let off = 8;
    data.set(client.toBytes(), off); off += 32;
    data.set(agent.toBytes(), off); off += 32;
    data.set(nonce, off); off += 8;
    new DataView(data.buffer).setBigUint64(off, BigInt(5_000_000), true); off += 8; // priceMicro
    new DataView(data.buffer).setBigInt64(off, BigInt(1000), true); off += 8; // createdAt
    new DataView(data.buffer).setBigInt64(off, BigInt(2000), true); off += 8; // acceptedAt
    new DataView(data.buffer).setBigInt64(off, BigInt(3000), true); off += 8; // completedAt
    data[off] = JobState.Created; off += 1;
    data[off] = 0xff; off += 1; // bump
    data[off] = 0xfe; // escrowBump

    const parsed = parseJobAccount(data);
    assert(parsed !== null);
    assert.equal(parsed.client, client.toBase58());
    assert.equal(parsed.agent, agent.toBase58());
    assert.equal(parsed.priceMicro, BigInt(5_000_000));
    assert.equal(parsed.createdAt, 1000);
    assert.equal(parsed.acceptedAt, 2000);
    assert.equal(parsed.completedAt, 3000);
    assert.equal(parsed.state, JobState.Created);
    assert.equal(parsed.bump, 0xff);
    assert.equal(parsed.escrowBump, 0xfe);
  });

  it("returns null for short data", async () => {
    const { parseJobAccount } = await import("../dist/escrow.js");
    assert.equal(parseJobAccount(new Uint8Array(10)), null);
  });

  it("returns null for wrong discriminator", async () => {
    const { parseJobAccount } = await import("../dist/escrow.js");
    assert.equal(parseJobAccount(new Uint8Array(200).fill(0xff)), null);
  });
});

describe("JobState enum", () => {
  it("has expected values", async () => {
    const { JobState } = await import("../dist/escrow.js");
    assert.equal(JobState.Created, 0);
    assert.equal(JobState.Accepted, 1);
    assert.equal(JobState.Completed, 2);
    assert.equal(JobState.Released, 3);
    assert.equal(JobState.Disputed, 4);
    assert.equal(JobState.Refunded, 5);
  });
});
