import { describe, it } from "node:test";
import assert from "node:assert";
import { PublicKey, Keypair } from "@solana/web3.js";

describe("findMsgPda", () => {
  it("is deterministic for same inputs", async () => {
    const { findMsgPda } = await import("../dist/msg.js");
    const from = Keypair.generate().publicKey;
    const to = Keypair.generate().publicKey;
    const nonce = new Uint8Array(8).fill(0x42);
    const [a] = findMsgPda(from, to, nonce);
    const [b] = findMsgPda(from, to, nonce);
    assert.equal(a.toBase58(), b.toBase58());
  });

  it("differs for different nonces", async () => {
    const { findMsgPda } = await import("../dist/msg.js");
    const from = Keypair.generate().publicKey;
    const to = Keypair.generate().publicKey;
    const [a] = findMsgPda(from, to, new Uint8Array(8).fill(1));
    const [b] = findMsgPda(from, to, new Uint8Array(8).fill(2));
    assert.notEqual(a.toBase58(), b.toBase58());
  });
});

describe("buildSendMsgIx", () => {
  it("builds a valid instruction", async () => {
    const { buildSendMsgIx, QIETR_MSG_PROGRAM_ID } = await import("../dist/msg.js");
    const sender = Keypair.generate().publicKey;
    const to = Keypair.generate().publicKey;
    const nonce = new Uint8Array(8).fill(0xaa);
    const body = new TextEncoder().encode("hello world");

    const ix = buildSendMsgIx(to, nonce, body, { sender });
    assert.equal(ix.programId.toBase58(), QIETR_MSG_PROGRAM_ID.toBase58());
    assert.equal(ix.keys.length, 3);
    assert.equal(ix.keys[1].pubkey.toBase58(), sender.toBase58());
    assert.equal(ix.keys[1].isSigner, true);
    assert.equal(ix.keys[2].pubkey.toBase58(), "11111111111111111111111111111111");
    // data: disc(8) + to(32) + nonce(8) + vec_len(4) + body(11) = 63
    assert.equal(ix.data.length, 8 + 32 + 8 + 4 + 11);
  });

  it("rejects oversized body", async () => {
    const { buildSendMsgIx, MAX_MESSAGE_BYTES } = await import("../dist/msg.js");
    const pk = Keypair.generate().publicKey;
    const nonce = new Uint8Array(8);
    const body = new Uint8Array(MAX_MESSAGE_BYTES + 1);
    assert.throws(() => buildSendMsgIx(pk, nonce, body, { sender: pk }), /body exceeds/);
  });

  it("rejects bad nonce length", async () => {
    const { buildSendMsgIx } = await import("../dist/msg.js");
    const pk = Keypair.generate().publicKey;
    assert.throws(
      () => buildSendMsgIx(pk, new Uint8Array(4), new Uint8Array(1), { sender: pk }),
      /nonce must be 8 bytes/,
    );
  });
});

describe("buildDeleteMsgIx", () => {
  it("builds a valid instruction", async () => {
    const { buildDeleteMsgIx, QIETR_MSG_PROGRAM_ID, findMsgPda } = await import("../dist/msg.js");
    const from = Keypair.generate().publicKey;
    const to = Keypair.generate().publicKey;
    const nonce = new Uint8Array(8).fill(0xbb);
    const [pda] = findMsgPda(from, to, nonce);

    const ix = buildDeleteMsgIx(pda, to);
    assert.equal(ix.programId.toBase58(), QIETR_MSG_PROGRAM_ID.toBase58());
    assert.equal(ix.keys.length, 2);
    assert.equal(ix.keys[0].pubkey.toBase58(), pda.toBase58());
    assert.equal(ix.keys[1].pubkey.toBase58(), to.toBase58());
    assert.equal(ix.keys[1].isSigner, true);
    assert.equal(ix.data.length, 8);
  });
});

describe("parseMessageAccount", () => {
  it("parses a valid message account", async () => {
    const { parseMessageAccount, buildSendMsgIx, QIETR_MSG_PROGRAM_ID } = await import("../dist/msg.js");
    // Build a real data buffer mimicking on-chain layout.
    // discriminator(8) + from(32) + to(32) + nonce(8) + timestamp(8) + body_len(2) + bump(1) + body(1024) = 1115
    const from = Keypair.generate().publicKey;
    const to = Keypair.generate().publicKey;
    const body = new TextEncoder().encode("secret message");

    const data = new Uint8Array(1115);
    // First 8 bytes: Message discriminator
    const { sha256 } = await import("@noble/hashes/sha256");
    const disc = sha256(new TextEncoder().encode("account:Message")).slice(0, 8);
    data.set(disc, 0);
    let off = 8;
    data.set(from.toBytes(), off); off += 32;
    data.set(to.toBytes(), off); off += 32;
    off += 8; // nonce
    // timestamp (i64 LE) = 123456789
    new DataView(data.buffer).setBigInt64(off, BigInt(123456789), true); off += 8;
    // body_len (u16 LE)
    new DataView(data.buffer).setUint16(off, body.length, true); off += 2;
    off += 1; // bump
    data.set(body, off);

    const parsed = parseMessageAccount(data);
    assert(parsed !== null);
    assert.equal(parsed.from, from.toBase58());
    assert.equal(parsed.to, to.toBase58());
    assert.equal(parsed.timestamp, 123456789);
    assert.equal(
      Buffer.from(parsed.bodyBase64, "base64").toString(),
      "secret message",
    );
  });

  it("returns null for short data", async () => {
    const { parseMessageAccount } = await import("../dist/msg.js");
    assert.equal(parseMessageAccount(new Uint8Array(100)), null);
  });
});

describe("encryptMsgBody / decryptMsgBody", () => {
  it("round-trips a message", async () => {
    const { encryptMsgBody, decryptMsgBody } = await import("../dist/msg.js");
    const passphrase = "shared-secret-42";
    const plaintext = "Hello, agent! This is a private message.";

    const encrypted = await encryptMsgBody(plaintext, passphrase);
    const decrypted = await decryptMsgBody(encrypted, passphrase);
    assert.equal(decrypted, plaintext);
  });

  it("fails on wrong passphrase", async () => {
    const { encryptMsgBody, decryptMsgBody } = await import("../dist/msg.js");
    const encrypted = await encryptMsgBody("secret", "correct-passphrase");
    await assert.rejects(
      () => decryptMsgBody(encrypted, "wrong-passphrase"),
      /failed/i,
    );
  });
});

describe("buildCloseMsgIx (hardening)", () => {
  it("uses the close discriminator and recipient signer", async () => {
    const { Keypair } = await import("@solana/web3.js");
    const { buildCloseMsgIx, QIETR_MSG_PROGRAM_ID } = await import("../dist/msg.js");
    const { sha256 } = await import("@noble/hashes/sha256");
    const msgPda = Keypair.generate().publicKey;
    const recipient = Keypair.generate().publicKey;
    const ix = buildCloseMsgIx(msgPda, recipient);
    assert.equal(ix.programId.toBase58(), QIETR_MSG_PROGRAM_ID.toBase58());
    assert.equal(ix.keys.length, 2);
    assert.equal(ix.keys[0].pubkey.toBase58(), msgPda.toBase58());
    assert.equal(ix.keys[1].pubkey.toBase58(), recipient.toBase58());
    assert.equal(ix.keys[1].isSigner, true);
    assert.equal(ix.keys[1].isWritable, true);
    const disc = sha256(new TextEncoder().encode("global:close")).slice(0, 8);
    assert.deepEqual(Uint8Array.from(ix.data), disc);
  });
});
