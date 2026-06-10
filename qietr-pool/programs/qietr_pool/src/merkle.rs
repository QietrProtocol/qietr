// =============================================================================
// merkle.rs — append-only binary Merkle tree, Poseidon-2 internal hash.
//
// Matches the in-circuit MerkleTreeChecker template in
// qietr-circuits/circuits/qietr_payment.circom. Hash inputs and outputs
// are 32-byte big-endian BN254 field elements.
//
// On insert we compute the new root in O(depth) hashes by walking from the
// new leaf up using the stored frontier (filled_subtree). The root is then
// pushed onto a ring buffer of the last ROOT_HISTORY_LEN roots.
// =============================================================================

use anchor_lang::prelude::*;

use crate::errors::QietrError;
use crate::state::{MerkleTree, MERKLE_DEPTH, ROOT_HISTORY_LEN};

/// Two-input Poseidon-2 (BN254-X5, big-endian) over 32-byte field elements.
///
/// On-chain we delegate to the `sol_poseidon` syscall (~50 CU vs ~6.3 KB
/// stack frame for `light-poseidon`'s round-constant tables, which blow
/// the BPF stack). The syscall is implemented in Agave via the same
/// `light-poseidon` crate, so byte-for-byte parity with the SDK's
/// `circomlibjs` output is preserved (verified by the `poseidon_parity`
/// test below). Off-chain (host-side `cargo test`) we fall back to
/// `light-poseidon` directly because the syscall isn't available.
pub fn poseidon_hash_two(left: &[u8; 32], right: &[u8; 32]) -> Result<[u8; 32]> {
    #[cfg(target_os = "solana")]
    {
        use solana_poseidon::{hashv, Endianness, Parameters};
        let out = hashv(
            Parameters::Bn254X5,
            Endianness::BigEndian,
            &[left.as_slice(), right.as_slice()],
        )
        .map_err(|_| QietrError::HashFailure)?;
        Ok(out.to_bytes())
    }
    #[cfg(not(target_os = "solana"))]
    {
        use ark_bn254::Fr;
        use light_poseidon::{Poseidon, PoseidonBytesHasher};
        let mut hasher = Poseidon::<Fr>::new_circom(2).map_err(|_| QietrError::HashFailure)?;
        let out = hasher
            .hash_bytes_be(&[left.as_slice(), right.as_slice()])
            .map_err(|_| QietrError::HashFailure)?;
        Ok(out)
    }
}

/// Zero subtree hashes at each level: ZEROS[0] = 0,
/// ZEROS[i] = Poseidon(ZEROS[i-1], ZEROS[i-1]).
///
/// We populate the `MerkleTree.zero_hashes` field level-by-level from
/// `initialize_denomination` to keep the 640-byte array off the BPF
/// stack. Deposits read from the cached table to save ~30k CU per
/// append.

pub trait MerkleAppend {
    /// Append `leaf` and return the new root.
    fn append(&mut self, leaf: [u8; 32]) -> Result<[u8; 32]>;
}

impl MerkleAppend for MerkleTree {
    fn append(&mut self, leaf: [u8; 32]) -> Result<[u8; 32]> {
        let capacity: u64 = 1u64 << MERKLE_DEPTH;
        require!(self.next_leaf_index < capacity, QietrError::TreeFull);

        let mut current_index = self.next_leaf_index;
        let mut current_hash = leaf;

        for i in 0..MERKLE_DEPTH {
            if current_index & 1 == 0 {
                // current node is left child; sibling is the empty subtree
                self.filled_subtree[i] = current_hash;
                current_hash = poseidon_hash_two(&current_hash, &self.zero_hashes[i])?;
            } else {
                // current node is right child; sibling is the saved frontier
                let sibling = self.filled_subtree[i];
                current_hash = poseidon_hash_two(&sibling, &current_hash)?;
            }
            current_index >>= 1;
        }

        self.next_leaf_index = self
            .next_leaf_index
            .checked_add(1)
            .ok_or(QietrError::Overflow)?;

        // Push new root onto the ring buffer.
        let next_cursor = ((self.root_cursor as usize) + 1) % ROOT_HISTORY_LEN;
        self.root_history[next_cursor] = current_hash;
        self.root_cursor = next_cursor as u8;

        Ok(current_hash)
    }
}

// =============================================================================
// Poseidon parity tests — closes audit finding #7.
//
// circomlib (in-circuit) ↔ circomlibjs (SDK) parity is verified end-to-end
// by qietr-sdk/test/prover.test.mjs (snarkjs.verify against the dev VK).
//
// This test closes the third leg: circomlibjs (SDK) ↔ light-poseidon (pool).
// Golden vectors below are produced by qietr-sdk/scripts/poseidon-vectors.mjs
// using circomlibjs. If light-poseidon ever drifts (config change, library
// upgrade) the test will fail and every real withdraw would otherwise have
// silently failed Groth16 verification on chain.
// =============================================================================
#[cfg(test)]
mod poseidon_parity {
    use ark_bn254::Fr;
    use light_poseidon::{Poseidon, PoseidonBytesHasher};

    fn be32(big_be_hex_low: &str) -> [u8; 32] {
        // Accept a left-trimmed hex string and left-pad to 32 bytes.
        let h = big_be_hex_low.trim_start_matches("0x");
        let mut padded = String::new();
        for _ in 0..(64 - h.len()) {
            padded.push('0');
        }
        padded.push_str(h);
        let mut out = [0u8; 32];
        for i in 0..32 {
            out[i] = u8::from_str_radix(&padded[i * 2..i * 2 + 2], 16).unwrap();
        }
        out
    }

    fn hash_n(arity: usize, inputs: &[[u8; 32]]) -> [u8; 32] {
        let mut hasher = Poseidon::<Fr>::new_circom(arity).expect("poseidon init");
        let slices: Vec<&[u8]> = inputs.iter().map(|x| x.as_slice()).collect();
        let out = hasher
            .hash_bytes_be(&slices)
            .expect("poseidon hash");
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&out);
        arr
    }

    #[test]
    fn poseidon2_matches_circomlibjs() {
        // (inputs_hex_be, expected_output_hex_be) — from circomlibjs.
        let cases: &[([&str; 2], &str)] = &[
            (
                ["0", "0"],
                "2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864",
            ),
            (
                ["1", "2"],
                "115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a",
            ),
            (
                ["abcd", "ef01"],
                "06095cdb426bd5519af6c15cff4026e3601fca742c9d82543e09d78832f51b77",
            ),
            (
                [
                    "3ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
                    "100000000000000000000000000000000000000000000000007",
                ],
                "045a6f18639204387578e6636527ede35981828f05d84a49c274ae700045a50e",
            ),
        ];
        for (ins, expected) in cases {
            let inputs = [be32(ins[0]), be32(ins[1])];
            let got = hash_n(2, &inputs);
            assert_eq!(
                got,
                be32(expected),
                "poseidon2 mismatch for inputs {:?}",
                ins
            );
        }
    }

    #[test]
    fn poseidon3_matches_circomlibjs() {
        let cases: &[([&str; 3], &str)] = &[
            (
                ["0", "0", "0"],
                "0bc188d27dcceadc1dcfb6af0a7af08fe2864eecec96c5ae7cee6db31ba599aa",
            ),
            (
                ["1", "2", "3"],
                "0e7732d89e6939c0ff03d5e58dab6302f3230e269dc5b968f725df34ab36d732",
            ),
            (
                ["deadbeef", "feedface", "f4240"],
                "28c42776aabac12298fd7da48d491c394bed3d94f5a9583754956553481edcb3",
            ),
            (
                [
                    "3ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
                    "100000000000000000000000000000000000000000000000007",
                    "2a",
                ],
                "0b980853420f5653f33f298591b0c1762986bb9cb456224d6f5654359e2d3766",
            ),
        ];
        for (ins, expected) in cases {
            let inputs = [be32(ins[0]), be32(ins[1]), be32(ins[2])];
            let got = hash_n(3, &inputs);
            assert_eq!(
                got,
                be32(expected),
                "poseidon3 mismatch for inputs {:?}",
                ins
            );
        }
    }
}
