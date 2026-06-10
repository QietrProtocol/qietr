// =============================================================================
// note.ts — Note serialization, encryption, and storage
//
// TRD section 6: AES-256-GCM encrypted with a passphrase-derived key.
// On-disk format: `qietr.enc.v1:` + base64(header || ciphertext || tag),
// where header is `MAGIC || version || salt(16) || nonce(12)`.
//
// Key derivation: Argon2id from @noble/hashes (pure JS; works in browser
// and Node). Parameters chosen for "strong on 2025 hardware" defaults.
// =============================================================================

import { argon2id } from "@noble/hashes/argon2";
import type { Note } from "./types.js";

export const NOTE_VERSION = "qietr.v1" as const;
export const ENCRYPTED_MAGIC = "qietr.enc.v1:" as const;

// Argon2id parameters. Time cost 3, memory 64 MiB, parallelism 1.
const ARGON2_T = 3;
const ARGON2_M = 64 * 1024; // KiB
const ARGON2_P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;
const NONCE_LEN = 12;

export class NotImplemented extends Error {
  constructor(what: string) {
    super(`not implemented: ${what}`);
    this.name = "NotImplemented";
  }
}

export class DecryptError extends Error {
  constructor(reason: string) {
    super(`note decrypt failed: ${reason}`);
    this.name = "DecryptError";
  }
}

export function emptyNote(): Note {
  return { version: NOTE_VERSION, commitments: [] };
}

export function serializeNote(note: Note): string {
  if (note.version !== NOTE_VERSION) {
    throw new Error(`unexpected note version: ${note.version}`);
  }
  return JSON.stringify(note);
}

export function parseNote(json: string): Note {
  const obj = JSON.parse(json) as unknown;
  if (
    typeof obj !== "object" ||
    obj === null ||
    (obj as Note).version !== NOTE_VERSION ||
    !Array.isArray((obj as Note).commitments)
  ) {
    throw new Error("invalid note payload");
  }
  return obj as Note;
}

function getCrypto(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }
  return c;
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

function deriveKey(passphrase: string, salt: Uint8Array): Uint8Array {
  return argon2id(new TextEncoder().encode(passphrase), salt, {
    t: ARGON2_T,
    m: ARGON2_M,
    p: ARGON2_P,
    dkLen: KEY_LEN,
  });
}

/** Copy a Uint8Array into a fresh ArrayBuffer of matching length. WebCrypto
 *  types in @types/node 20 reject Uint8Array<ArrayBufferLike> directly. */
function asBuf(u: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u.byteLength);
  new Uint8Array(ab).set(u);
  return ab;
}

export function isEncryptedNote(str: string): boolean {
  return str.startsWith(ENCRYPTED_MAGIC);
}

export async function encryptNote(
  note: Note,
  passphrase: string,
): Promise<string> {
  const crypto = getCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LEN));
  const key = deriveKey(passphrase, salt);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    asBuf(key),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const plaintext = new TextEncoder().encode(serializeNote(note));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: asBuf(nonce) },
      cryptoKey,
      asBuf(plaintext),
    ),
  );

  // Layout: salt(16) || nonce(12) || ciphertext+tag
  const out = new Uint8Array(SALT_LEN + NONCE_LEN + ciphertext.length);
  out.set(salt, 0);
  out.set(nonce, SALT_LEN);
  out.set(ciphertext, SALT_LEN + NONCE_LEN);

  return ENCRYPTED_MAGIC + b64encode(out);
}

export async function decryptNote(
  encrypted: string,
  passphrase: string,
): Promise<Note> {
  if (!encrypted.startsWith(ENCRYPTED_MAGIC)) {
    throw new DecryptError("missing qietr.enc.v1: magic");
  }
  const blob = b64decode(encrypted.slice(ENCRYPTED_MAGIC.length));
  if (blob.length < SALT_LEN + NONCE_LEN + 16) {
    throw new DecryptError("blob too short");
  }

  const salt = blob.slice(0, SALT_LEN);
  const nonce = blob.slice(SALT_LEN, SALT_LEN + NONCE_LEN);
  const ciphertext = blob.slice(SALT_LEN + NONCE_LEN);

  const crypto = getCrypto();
  const key = deriveKey(passphrase, salt);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    asBuf(key),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  let plaintext: Uint8Array;
  try {
    plaintext = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: asBuf(nonce) },
        cryptoKey,
        asBuf(ciphertext),
      ),
    );
  } catch (_e) {
    throw new DecryptError("wrong passphrase or corrupted payload");
  }

  return parseNote(new TextDecoder().decode(plaintext));
}
