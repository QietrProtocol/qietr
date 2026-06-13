use anchor_lang::prelude::*;

#[error_code]
pub enum QietrError {
    #[msg("Pool is paused")]
    Paused,
    #[msg("Caller is not the configured admin")]
    NotAdmin,
    #[msg("Denomination not initialized or does not match")]
    UnknownDenomination,
    #[msg("Merkle tree is full")]
    TreeFull,
    #[msg("Merkle root is not in the recent-roots window")]
    StaleRoot,
    #[msg("Nullifier has already been spent")]
    NullifierSpent,
    #[msg("Groth16 proof failed verification")]
    InvalidProof,
    #[msg("Payment amount field does not fit in u64")]
    PaymentAmountOverflow,
    #[msg("Public signal `amount` does not match the tier denomination")]
    AmountMismatch,
    #[msg("Nullifier hash argument does not match the proof's public signal")]
    NullifierMismatch,
    #[msg("Recipient ATA owner does not match the proof's public signal")]
    RecipientMismatch,
    #[msg("Recipient token account is not the canonical ATA for (owner, mint)")]
    NonCanonicalAta,
    #[msg("Verifying key upgrade is still time-locked")]
    VkUpgradeLocked,
    #[msg("Embedded verifying key does not match the timelocked config hash")]
    VkHashMismatch,
    #[msg("Verifying key upgrade has not been queued")]
    NoPendingUpgrade,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Poseidon hashing failed")]
    HashFailure,
    #[msg("Fee vault is not configured")]
    FeeVaultNotSet,
    #[msg("Fee vault account does not match the configured fee vault")]
    FeeVaultMismatch,
    #[msg("Fee basis points must be <= 10000")]
    FeeBpsTooHigh,
}
