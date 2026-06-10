// =============================================================================
// pubkey.ts — pubkey → BN254 field-element conversion.
//
// MUST stay byte-equivalent to `pubkey_to_field` in
// qietr-pool/programs/qietr_pool/src/lib.rs. Both sides feed the same
// value into the withdraw circuit's `recipient` public signal (index 2).
// If they diverge, every real withdrawal will fail with RecipientMismatch.
//
// On-chain reference:
//   fn pubkey_to_field(pk: &Pubkey) -> [u8; 32] {
//       let mut out = pk.to_bytes();
//       out[0] &= 0x1f; // clear top 3 bits, giving a 253-bit value (<p)
//       out
//   }
// =============================================================================

export type PubkeyLike = Uint8Array | { toBytes(): Uint8Array };

function asBytes(pubkey: PubkeyLike): Uint8Array {
  const bytes = pubkey instanceof Uint8Array ? pubkey : pubkey.toBytes();
  if (bytes.length !== 32) {
    throw new Error(`pubkeyToField: expected 32-byte pubkey, got ${bytes.length}`);
  }
  return bytes;
}

/**
 * Mask a 32-byte Solana pubkey down to a BN254 scalar-field element by
 * clearing the top 3 bits of byte 0. Returns big-endian 32 bytes.
 *
 * Always allocates a fresh Uint8Array — the input is not mutated.
 */
export function pubkeyToField(pubkey: PubkeyLike): Uint8Array {
  const out = new Uint8Array(asBytes(pubkey));
  out[0]! &= 0x1f;
  return out;
}

/**
 * Decimal-string form of `pubkeyToField`, suitable for use as a circuit
 * witness input (snarkjs accepts decimal strings for field elements).
 */
export function pubkeyToFieldString(pubkey: PubkeyLike): string {
  const bytes = pubkeyToField(pubkey);
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return n.toString();
}
