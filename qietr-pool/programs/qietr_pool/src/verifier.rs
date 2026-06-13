// =============================================================================
// verifier.rs — Groth16 verification wrapper.
//
// Uses `groth16-solana` (alt-bn128 syscalls) against the program-embedded
// VERIFYINGKEY const. Public signal order MUST match snarkjs's witness
// ordering (signal-declaration order, NOT the `public [...]` list order) —
// authoritative source is qietr-circuits/build/qietr_payment.sym and
// lib.rs::withdraw, which both use:
//
//   public_signals[0] = amount           (tier value)
//   public_signals[1] = root
//   public_signals[2] = nullifierHash
//   public_signals[3] = recipient
//   public_signals[4] = paymentAmount
//   public_signals[5] = changeCommitment
//
// Each public signal is a 32-byte big-endian BN254 field element.
// =============================================================================

use anchor_lang::prelude::*;
use groth16_solana::groth16::Groth16Verifier;

use crate::dev_vk::VERIFYINGKEY;
use crate::errors::QietrError;

pub const PROOF_BYTES: usize = 256;
pub const PUBLIC_SIGNAL_COUNT: usize = 6;

/// Verify a Groth16 proof against the embedded VERIFYINGKEY.
///
/// Layout of `proof_bytes`:
///   bytes  0..64  : proof.a (G1, 64 bytes)
///   bytes 64..192 : proof.b (G2, 128 bytes)
///   bytes 192..256: proof.c (G1, 64 bytes)
pub fn verify(
    proof_bytes: &[u8; PROOF_BYTES],
    public_signals: &[[u8; 32]; PUBLIC_SIGNAL_COUNT],
) -> Result<()> {
    let proof_a: [u8; 64] = proof_bytes[0..64]
        .try_into()
        .map_err(|_| QietrError::InvalidProof)?;
    let proof_b: [u8; 128] = proof_bytes[64..192]
        .try_into()
        .map_err(|_| QietrError::InvalidProof)?;
    let proof_c: [u8; 64] = proof_bytes[192..256]
        .try_into()
        .map_err(|_| QietrError::InvalidProof)?;

    let mut verifier = Groth16Verifier::new(
        &proof_a,
        &proof_b,
        &proof_c,
        public_signals,
        &VERIFYINGKEY,
    )
    .map_err(|_| QietrError::InvalidProof)?;

    verifier
        .verify()
        .map_err(|_| QietrError::InvalidProof)?;

    Ok(())
}

/// Hash the embedded verifying key for use in PoolConfig.verifying_key_hash.
/// We hash the four group elements and all IC entries in a stable order.
pub fn embedded_vk_hash() -> [u8; 32] {
    use anchor_lang::solana_program::keccak::hashv;

    let mut ic_concat: Vec<u8> = Vec::with_capacity(VERIFYINGKEY.vk_ic.len() * 64);
    for entry in VERIFYINGKEY.vk_ic.iter() {
        ic_concat.extend_from_slice(entry);
    }

    hashv(&[
        &VERIFYINGKEY.vk_alpha_g1,
        &VERIFYINGKEY.vk_beta_g2,
        &VERIFYINGKEY.vk_gamme_g2,
        &VERIFYINGKEY.vk_delta_g2,
        &ic_concat,
    ])
    .to_bytes()
}
