// =============================================================================
// randomness.ts — field-element randomness for commitments and nullifiers.
//
// BN254 scalar field p = 21888242871839275222246405745257275088548364400416034343698204186575808495617
// We sample 31 bytes (248 bits) so the value is always < p without rejection.
// Identical strategy to qietr-circuits/test fixtures and the prover.
// =============================================================================

/** Decimal-string field element drawn uniformly from [0, 2^248). */
export function randomFieldDec(): string {
  const bytes = new Uint8Array(31);
  (globalThis.crypto as Crypto).getRandomValues(bytes);
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return BigInt(hex).toString();
}

/** 32-byte big-endian encoding of a decimal field-element string. */
export function fieldDecToBE32(dec: string): Uint8Array {
  let hex = BigInt(dec).toString(16);
  if (hex.length > 64) hex = hex.slice(-64);
  hex = hex.padStart(64, "0");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** 32-byte big-endian → decimal string (round-trip with fieldDecToBE32). */
export function be32ToFieldDec(bytes: Uint8Array): string {
  if (bytes.length !== 32) throw new Error(`expected 32 bytes, got ${bytes.length}`);
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return n.toString();
}
