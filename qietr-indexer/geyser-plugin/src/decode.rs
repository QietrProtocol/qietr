// =============================================================================
// decode.rs — Anchor account discriminators + borsh layouts.
//
// Must stay byte-identical to qietr-pool/programs/qietr_pool/src/state.rs.
// If you add a field there, mirror it here. The discriminator is
// `sha256("account:<StructName>")[0..8]`; it only changes if the struct
// is renamed.
// =============================================================================

use borsh::BorshDeserialize;
use sha2::{Digest, Sha256};
use std::sync::OnceLock;

pub const MERKLE_DEPTH: usize = 20;
pub const ROOT_HISTORY_LEN: usize = 30;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AccountKind {
    PoolConfig,
    Denomination,
    MerkleTree,
    NullifierRecord,
}

fn anchor_disc(name: &str) -> [u8; 8] {
    let full = Sha256::digest(format!("account:{}", name).as_bytes());
    let mut out = [0u8; 8];
    out.copy_from_slice(&full[..8]);
    out
}

fn pool_config_disc() -> &'static [u8; 8] {
    static D: OnceLock<[u8; 8]> = OnceLock::new();
    D.get_or_init(|| anchor_disc("PoolConfig"))
}
fn denomination_disc() -> &'static [u8; 8] {
    static D: OnceLock<[u8; 8]> = OnceLock::new();
    D.get_or_init(|| anchor_disc("Denomination"))
}
fn merkle_tree_disc() -> &'static [u8; 8] {
    static D: OnceLock<[u8; 8]> = OnceLock::new();
    D.get_or_init(|| anchor_disc("MerkleTree"))
}
fn nullifier_record_disc() -> &'static [u8; 8] {
    static D: OnceLock<[u8; 8]> = OnceLock::new();
    D.get_or_init(|| anchor_disc("NullifierRecord"))
}

impl AccountKind {
    pub fn from_account_data(data: &[u8]) -> Option<Self> {
        if data.len() < 8 {
            return None;
        }
        let head = &data[..8];
        if head == pool_config_disc().as_slice() {
            return Some(Self::PoolConfig);
        }
        if head == denomination_disc().as_slice() {
            return Some(Self::Denomination);
        }
        if head == merkle_tree_disc().as_slice() {
            return Some(Self::MerkleTree);
        }
        if head == nullifier_record_disc().as_slice() {
            return Some(Self::NullifierRecord);
        }
        None
    }
}

#[derive(BorshDeserialize, Debug)]
pub struct Denomination {
    pub denom_id: u8,
    pub amount_micro_usdc: u64,
    pub deposit_count: u64,
    pub vault: [u8; 32],
    pub mint: [u8; 32],
    pub vault_bump: u8,
    pub bump: u8,
}

#[derive(BorshDeserialize, Debug)]
pub struct MerkleTree {
    pub denom_id: u8,
    pub next_leaf_index: u64,
    pub filled_subtree: [[u8; 32]; MERKLE_DEPTH],
    pub root_history: [[u8; 32]; ROOT_HISTORY_LEN],
    pub root_cursor: u8,
    pub bump: u8,
    pub zero_hashes: [[u8; 32]; MERKLE_DEPTH],
}

impl MerkleTree {
    /// Returns the active root (the latest one written via the ring-buffer),
    /// or `None` if `root_cursor` is out of range. The cursor is a `u8` read
    /// from on-chain data; a corrupt or malicious account could carry a value
    /// >= ROOT_HISTORY_LEN, and a direct index would panic on the validator's
    /// banking thread (taking the plugin — and potentially the validator —
    /// down). `get` makes this a safe, recoverable miss.
    pub fn latest_root(&self) -> Option<[u8; 32]> {
        self.root_history.get(self.root_cursor as usize).copied()
    }
}

#[derive(BorshDeserialize, Debug)]
pub struct NullifierRecord {
    pub denom_id: u8,
    pub nullifier_hash: [u8; 32],
    pub spent_at_slot: u64,
    pub bump: u8,
}

pub fn decode_denomination(data: &[u8]) -> Option<Denomination> {
    if data.len() < 8 {
        return None;
    }
    Denomination::try_from_slice(&data[8..]).ok()
}

pub fn decode_merkle_tree(data: &[u8]) -> Option<MerkleTree> {
    if data.len() < 8 {
        return None;
    }
    MerkleTree::try_from_slice(&data[8..]).ok()
}

pub fn decode_nullifier_record(data: &[u8]) -> Option<NullifierRecord> {
    if data.len() < 8 {
        return None;
    }
    NullifierRecord::try_from_slice(&data[8..]).ok()
}

/// Anchor instruction discriminator — `sha256("global:<method>")[0..8]`.
pub fn anchor_ix_disc(method: &str) -> [u8; 8] {
    let full = Sha256::digest(format!("global:{}", method).as_bytes());
    let mut out = [0u8; 8];
    out.copy_from_slice(&full[..8]);
    out
}

pub struct IxDescriptors {
    pub deposit: [u8; 8],
    pub withdraw: [u8; 8],
}

impl IxDescriptors {
    pub fn precomputed() -> Self {
        Self {
            deposit: anchor_ix_disc("deposit"),
            withdraw: anchor_ix_disc("withdraw"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Reference values produced by `sha256("account:<Name>")[0..8]` and
    // `sha256("global:<method>")[0..8]` via Python:
    //   import hashlib
    //   hashlib.sha256(b"account:Denomination").digest()[:8].hex()
    //
    // Locking these in catches accidental renames of the pool's Anchor
    // structs — which would silently break ingest by skipping every
    // account write.
    #[test]
    fn account_discriminator_pool_config() {
        assert_eq!(
            *pool_config_disc(),
            [0x1a, 0x6c, 0x0e, 0x7b, 0x74, 0xe6, 0x81, 0x2b],
        );
    }

    #[test]
    fn account_discriminator_denomination() {
        assert_eq!(
            *denomination_disc(),
            [0xff, 0x5f, 0xf6, 0x28, 0x38, 0xa3, 0x6b, 0x55],
        );
    }

    #[test]
    fn account_discriminator_merkle_tree() {
        assert_eq!(
            *merkle_tree_disc(),
            [0x62, 0x33, 0x33, 0xe2, 0xa2, 0x14, 0x49, 0xd4],
        );
    }

    #[test]
    fn account_discriminator_nullifier_record() {
        assert_eq!(
            *nullifier_record_disc(),
            [0x38, 0x12, 0x39, 0xaf, 0x45, 0xca, 0xbd, 0x46],
        );
    }

    #[test]
    fn ix_discriminator_deposit() {
        // sha256("global:deposit")[:8] = f2 23 c6 89 52 e1 f2 b6
        assert_eq!(
            anchor_ix_disc("deposit"),
            [0xf2, 0x23, 0xc6, 0x89, 0x52, 0xe1, 0xf2, 0xb6],
        );
    }

    #[test]
    fn ix_discriminator_withdraw() {
        // sha256("global:withdraw")[:8] = b7 12 46 9c 94 6d a1 22
        assert_eq!(
            anchor_ix_disc("withdraw"),
            [0xb7, 0x12, 0x46, 0x9c, 0x94, 0x6d, 0xa1, 0x22],
        );
    }
}
