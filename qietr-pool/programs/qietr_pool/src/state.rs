// =============================================================================
// state.rs — account layouts.
//
// TRD section 3.2 (PDAs) and section 3.4 (Merkle tree).
// =============================================================================

use anchor_lang::prelude::*;

pub const MERKLE_DEPTH: usize = 20;
pub const ROOT_HISTORY_LEN: usize = 30;

// -----------------------------------------------------------------------------
// PoolConfig — seeds = [b"config"]
// -----------------------------------------------------------------------------
#[account]
#[derive(InitSpace)]
pub struct PoolConfig {
    pub admin: Pubkey,
    pub fee_bps: u16,
    pub paused: bool,
    /// Time-locked admin queue for the active verifying-key hash. The
    /// VERIFYINGKEY const itself lives in the program binary; this hash
    /// is the cryptographic commitment to it and is updated via the
    /// `queue_vk_upgrade` + `apply_vk_upgrade` pair when the program is
    /// re-deployed with a new VK.
    pub verifying_key_hash: [u8; 32],
    pub pending_vk_hash: [u8; 32],
    pub pending_applies_at_slot: u64,
    /// ATA where accumulated protocol USDC fees are sent. Set by admin
    /// via `set_fee_vault`. If Pubkey::default(), fee deduction is
    /// skipped on withdraws.
    pub fee_vault: Pubkey,
    pub bump: u8,
}

// -----------------------------------------------------------------------------
// Denomination — seeds = [b"denom", denom_id_u8]
// -----------------------------------------------------------------------------
#[account]
#[derive(InitSpace)]
pub struct Denomination {
    pub denom_id: u8,
    pub amount_micro_usdc: u64,
    pub deposit_count: u64,
    pub vault: Pubkey,
    pub mint: Pubkey,
    pub vault_bump: u8,
    pub bump: u8,
}

// -----------------------------------------------------------------------------
// MerkleTree — seeds = [b"tree", denom_id_u8]
//
// Append-only depth-20 Merkle tree. We store the "filled subtree" frontier
// (one node per level) and the last ROOT_HISTORY_LEN roots. Compute is
// O(depth) per insert.
// -----------------------------------------------------------------------------
#[account]
#[derive(InitSpace)]
pub struct MerkleTree {
    pub denom_id: u8,
    pub next_leaf_index: u64,
    pub filled_subtree: [[u8; 32]; MERKLE_DEPTH],
    pub root_history: [[u8; 32]; ROOT_HISTORY_LEN],
    pub root_cursor: u8,
    pub bump: u8,
    /// Cached `Poseidon-2(zeros[i-1], zeros[i-1])` table. Computed once at
    /// `initialize_denomination` and read on every deposit so we don't
    /// burn ~30k CU re-hashing the same 19 values per append. The values
    /// are deterministic for a given (Poseidon config, MERKLE_DEPTH), so
    /// caching them here is safe.
    pub zero_hashes: [[u8; 32]; MERKLE_DEPTH],
}

impl MerkleTree {
    /// Returns true if `root` matches any of the last ROOT_HISTORY_LEN
    /// recorded roots (TRD section 3.4: 30-root window).
    pub fn is_known_root(&self, root: &[u8; 32]) -> bool {
        if root == &[0u8; 32] {
            return false;
        }
        self.root_history.iter().any(|r| r == root)
    }
}

// -----------------------------------------------------------------------------
// NullifierRecord — seeds = [b"nullifier", denom_id, nullifier_hash]
//
// Existence-as-storage. Created at spend; never modified after. The PDA
// init constraint fails on the second create, which prevents replay.
// -----------------------------------------------------------------------------
#[account]
#[derive(InitSpace)]
pub struct NullifierRecord {
    pub denom_id: u8,
    pub nullifier_hash: [u8; 32],
    pub spent_at_slot: u64,
    pub bump: u8,
}
