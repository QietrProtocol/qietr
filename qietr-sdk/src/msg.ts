import { sha256 } from "@noble/hashes/sha2";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";

export const QIETR_MSG_PROGRAM_ID = new PublicKey(
  "2uA7fwAVXbmPNkYsjf5F1zQzxvmQvjNFLCHwSasYqWaL",
);

export const MAX_MESSAGE_BYTES = 1024;

// ---------------------------------------------------------------------------
// Program IDL helpers
// ---------------------------------------------------------------------------

function anchorDiscriminator(name: string): Uint8Array {
  return sha256(new TextEncoder().encode(`global:${name}`)).slice(0, 8);
}

// ---------------------------------------------------------------------------
// Instruction builders
// ---------------------------------------------------------------------------

export interface SendMsgAccounts {
  sender: PublicKey;
}

export function buildSendMsgIx(
  to: PublicKey,
  nonce: Uint8Array,
  body: Uint8Array,
  accts: SendMsgAccounts,
  programId: PublicKey = QIETR_MSG_PROGRAM_ID,
): TransactionInstruction {
  if (nonce.length !== 8) {
    throw new Error(`nonce must be 8 bytes, got ${nonce.length}`);
  }
  if (body.length > MAX_MESSAGE_BYTES) {
    throw new Error(`body exceeds ${MAX_MESSAGE_BYTES} bytes`);
  }

  const disc = anchorDiscriminator("send");
  const toBytes = to.toBytes();
  const data = new Uint8Array(8 + 32 + 8 + 4 + body.length);
  let offset = 0;
  data.set(disc, offset);
  offset += 8;
  data.set(toBytes, offset);
  offset += 32;
  data.set(nonce, offset);
  offset += 8;
  // Vec<u8> prefix: length as 4-byte LE
  const dv = new DataView(data.buffer);
  dv.setUint32(offset, body.length, true);
  offset += 4;
  data.set(body, offset);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: findMsgPda(accts.sender, to, nonce, programId)[0], isSigner: false, isWritable: true },
      { pubkey: accts.sender, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

export function buildDeleteMsgIx(
  msgPda: PublicKey,
  recipient: PublicKey,
  programId: PublicKey = QIETR_MSG_PROGRAM_ID,
): TransactionInstruction {
  const disc = anchorDiscriminator("delete");

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: msgPda, isSigner: false, isWritable: true },
      { pubkey: recipient, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(disc),
  });
}

export function buildCloseMsgIx(
  msgPda: PublicKey,
  recipient: PublicKey,
  programId: PublicKey = QIETR_MSG_PROGRAM_ID,
): TransactionInstruction {
  const disc = anchorDiscriminator("close");

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: msgPda, isSigner: false, isWritable: true },
      { pubkey: recipient, isSigner: true, isWritable: true },
    ],
    data: Buffer.from(disc),
  });
}

// ---------------------------------------------------------------------------
// PDA derivation
// ---------------------------------------------------------------------------

export function findMsgPda(
  from: PublicKey,
  to: PublicKey,
  nonce: Uint8Array,
  programId: PublicKey = QIETR_MSG_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("msg"), from.toBytes(), to.toBytes(), nonce],
    programId,
  );
}

// ---------------------------------------------------------------------------
// Encryption helpers (reuses note.ts pattern: Argon2id + AES-256-GCM)
// ---------------------------------------------------------------------------

/**
 * Encrypt a plaintext message for a recipient. Uses the shared passphrase
 * to derive an AES-256-GCM key via Argon2id.
 *
 * Returns: base64(salt(16) || nonce(12) || ciphertext+tag)
 */
export async function encryptMsgBody(
  plaintext: string,
  passphrase: string,
): Promise<string> {
  const crypto = getCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const ptBytes = new TextEncoder().encode(plaintext);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: asBuf(nonce) },
      key,
      asBuf(ptBytes),
    ),
  );

  const out = new Uint8Array(16 + 12 + ct.length);
  out.set(salt, 0);
  out.set(nonce, 16);
  out.set(ct, 28);
  return b64encode(out);
}

/**
 * Decrypt a message body previously encrypted with `encryptMsgBody`.
 */
export async function decryptMsgBody(
  encrypted: string,
  passphrase: string,
): Promise<string> {
  const blob = b64decode(encrypted);
  if (blob.length < 16 + 12 + 16) {
    throw new Error("encrypted body too short");
  }
  const salt = blob.slice(0, 16);
  const nonce = blob.slice(16, 28);
  const ct = blob.slice(28);
  const crypto = getCrypto();
  const key = await deriveKey(passphrase, salt);

  const pt = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asBuf(nonce) },
      key,
      asBuf(ct),
    ),
  );
  return new TextDecoder().decode(pt);
}

// ---------------------------------------------------------------------------
// Inbox helper — fetch via indexer or direct account scan
// ---------------------------------------------------------------------------

export interface EncryptedMessage {
  pda: string;
  from: string;
  to: string;
  timestamp: number;
  bodyBase64: string;
}

/**
 * Parse raw Message account data (Borsh-decoded) into a readable shape.
 * The on-chain layout is:
 *   from (32) | to (32) | nonce (8) | timestamp (8 LE i64) |
 *   body_len (2 LE u16) | bump (1) | body (1024)
 *
 * Total: 32+32+8+8+2+1+1024 = 1107 bytes + 8-byte discriminator = 1115.
 */
export function parseMessageAccount(data: Uint8Array): EncryptedMessage | null {
  if (data.length < 1115) return null;

  const expectedDisc = sha256(new TextEncoder().encode("account:Message")).slice(0, 8);
  for (let i = 0; i < 8; i++) {
    if (data[i] !== expectedDisc[i]) return null;
  }

  const pubkeyFromSlice = (off: number): string =>
    new PublicKey(data.slice(off, off + 32)).toBase58();

  const buf = Buffer.from(data);
  const from = pubkeyFromSlice(8);
  const to = pubkeyFromSlice(40);
  const timestamp = Number(buf.readBigInt64LE(80));
  const bodyLen = buf.readUInt16LE(88);
  const body = data.slice(91, 91 + bodyLen);

  const nonce = data.slice(72, 80);
  const pda = PublicKey.findProgramAddressSync(
    [Buffer.from("msg"), new PublicKey(data.slice(8, 40)).toBytes(), new PublicKey(data.slice(40, 72)).toBytes(), nonce],
    QIETR_MSG_PROGRAM_ID,
  )[0].toBase58();

  return {
    pda,
    from,
    to,
    timestamp,
    bodyBase64: b64encode(body),
  };
}

/**
 * Fetch inbox for a recipient from the relayer's indexer or via RPC.
 * Expects an indexer at `indexerBase` with a `GET /messages?to=<pubkey>` endpoint.
 */
export async function fetchInbox(
  recipient: PublicKey,
  indexerBase: string,
): Promise<EncryptedMessage[]> {
  const base = indexerBase.replace(/\/+$/, "");
  const res = await fetch(`${base}/messages?to=${recipient.toBase58()}`);
  if (!res.ok) {
    throw new Error(`indexer returned ${res.status} for inbox`);
  }
  return res.json() as Promise<EncryptedMessage[]>;
}

// ---------------------------------------------------------------------------
// Low-level crypto helpers
// ---------------------------------------------------------------------------

function getCrypto(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new Error("Web Crypto API is not available");
  }
  return c;
}

function asBuf(u: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u.byteLength);
  new Uint8Array(ab).set(u);
  return ab;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const { argon2id } = await import("@noble/hashes/argon2");
  const keyBytes = argon2id(new TextEncoder().encode(passphrase), salt, {
    t: 3,
    m: 64 * 1024,
    p: 1,
    dkLen: 32,
  });
  return getCrypto().subtle.importKey(
    "raw",
    asBuf(keyBytes),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

function b64encode(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(s, "base64"));
  }
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
