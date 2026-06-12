// =============================================================================
// qietr_pool — shielded payments program.
//
// Source of truth: docs/02-TRD.md section 3.
//
// Public-signal layout (matches qietr-circuits/circuits/qietr_payment.circom):
//   [0] amount               (tier value, bound to Denomination.amount_micro_usdc)
//   [1] root
//   [2] nullifierHash
//   [3] recipient            (a 32-byte field element; for now treated as
//                             a hash; off-chain SDK is responsible for the
//                             mapping to a Solana pubkey)
//   [4] paymentAmount        (u64 BE in lower 8 bytes)
//   [5] changeCommitment
//
// NOTE: snarkjs orders public signals by their signal-input declaration
// order in the main template, NOT by the order listed in `public [...]`.
// In qietr_payment.circom the declaration order is `amount` (private but
// also-public), then `root, nullifierHash, recipient, paymentAmount,
// changeCommitment` (declared public). The .zkey bakes this same order
// into the verifier's IC elements, so the on-chain side has no choice but
// to match. If you reorder signal declarations in the circuit, update
// indices here AND regenerate the dev VK.
// =============================================================================

use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

pub mod dev_vk;
pub mod errors;
pub mod merkle;
pub mod state;
pub mod verifier;

use errors::QietrError;
use merkle::{poseidon_hash_two, MerkleAppend};
use state::*;
use verifier::{PROOF_BYTES, PUBLIC_SIGNAL_COUNT};

declare_id!("2zaHsJNoZ1adQtecG7yRv1NCCVzaX3yaRD6CeQBQimVc");

/// ~24h on mainnet at 400ms slots = 216,000. We use 432,000 (~48h) for
/// extra safety margin during VK rotations.
pub const PENDING_VK_LOCK_SLOTS: u64 = 432_000;

#[program]
pub mod qietr_pool {
    use super::*;

    // ------------------------------------------------------------------------
    pub fn initialize_pool(ctx: Context<InitializePool>, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= 10000, QietrError::FeeBpsTooHigh);
        let cfg = &mut ctx.accounts.config;
        cfg.admin = ctx.accounts.admin.key();
        cfg.fee_bps = fee_bps;
        cfg.paused = false;
        cfg.verifying_key_hash = verifier::embedded_vk_hash();
        cfg.pending_vk_hash = [0u8; 32];
        cfg.pending_applies_at_slot = 0;
        cfg.fee_vault = Pubkey::default();
        cfg.bump = ctx.bumps.config;
        Ok(())
    }

    // ------------------------------------------------------------------------
    pub fn initialize_denomination(
        ctx: Context<InitializeDenomination>,
        denom_id: u8,
        amount_micro_usdc: u64,
    ) -> Result<()> {
        let denom = &mut ctx.accounts.denomination;
        denom.denom_id = denom_id;
        denom.amount_micro_usdc = amount_micro_usdc;
        denom.deposit_count = 0;
        denom.vault = ctx.accounts.vault.key();
        denom.mint = ctx.accounts.mint.key();
        denom.vault_bump = ctx.bumps.vault;
        denom.bump = ctx.bumps.denomination;

        let tree = &mut ctx.accounts.tree;
        tree.denom_id = denom_id;
        tree.next_leaf_index = 0;
        // `init` already zero-allocates the account, so `filled_subtree`,
        // `root_history`, and `zero_hashes[0]` are already zero. Writing
        // 640+960+32 bytes of explicit zeros here puts arrays on the BPF
        // stack (4 KB total), which combined with Anchor's multi-init
        // try_accounts frame blows the stack at runtime.
        tree.root_cursor = 0;
        tree.bump = ctx.bumps.tree;
        // Pre-compute the zero-subtree hash table by writing each level
        // directly to the account (no large temporary on the stack).
        // Deposits read these back instead of re-hashing 19 values each.
        for i in 1..MERKLE_DEPTH {
            let prev = tree.zero_hashes[i - 1];
            tree.zero_hashes[i] = poseidon_hash_two(&prev, &prev)?;
        }

        Ok(())
    }

    // ------------------------------------------------------------------------
    pub fn deposit(
        ctx: Context<Deposit>,
        _denom_id: u8,
        commitment: [u8; 32],
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, QietrError::Paused);

        // Transfer tier amount of USDC from depositor to vault.
        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.depositor_ata.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        );
        token::transfer(cpi, ctx.accounts.denomination.amount_micro_usdc)?;

        // Append commitment to the tree and stamp the new root.
        ctx.accounts.tree.append(commitment)?;

        let denom = &mut ctx.accounts.denomination;
        denom.deposit_count = denom
            .deposit_count
            .checked_add(1)
            .ok_or(QietrError::Overflow)?;

        Ok(())
    }

    // ------------------------------------------------------------------------
    pub fn withdraw(
        ctx: Context<Withdraw>,
        denom_id: u8,
        nullifier_hash_arg: [u8; 32],
        proof: [u8; PROOF_BYTES],
        public_signals: [[u8; 32]; PUBLIC_SIGNAL_COUNT],
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, QietrError::Paused);

        let amount_field = public_signals[0];
        let root = public_signals[1];
        let nullifier_hash = public_signals[2];
        let recipient_field = public_signals[3];
        let payment_amount_field = public_signals[4];
        let change_commitment = public_signals[5];

        // 1. The `nullifier_hash` instruction arg drives the NullifierRecord
        //    PDA seed. It MUST equal the proof's public nullifierHash —
        //    otherwise an attacker could pass a fresh seed each call and
        //    replay the same proof to drain the vault.
        require!(
            nullifier_hash_arg == nullifier_hash,
            QietrError::NullifierMismatch
        );

        // 2. The `recipient_ata`'s owner pubkey is part of the proof's
        //    public-signal commitment (TRD §4.2). We bind it on-chain via a
        //    keccak-truncated mapping (pubkey -> 32 bytes -> field element).
        //    Without this check, fee_payer could redirect payment to any ATA.
        require!(
            recipient_field == pubkey_to_field(&ctx.accounts.recipient_ata.owner),
            QietrError::RecipientMismatch
        );

        // 2b. Require that `recipient_ata` is the canonical Associated Token
        //     Account for (owner, mint). Owners can hold the same mint in
        //     multiple non-canonical token accounts; enforcing the canonical
        //     one removes a class of dust-trap and griefing setups where the
        //     payment lands in an account the owner can't easily find.
        let canonical_ata = get_associated_token_address(
            &ctx.accounts.recipient_ata.owner,
            &ctx.accounts.denomination.mint,
        );
        require!(
            canonical_ata == ctx.accounts.recipient_ata.key(),
            QietrError::NonCanonicalAta
        );

        // 3. Root must be in the recent-roots window.
        require!(
            ctx.accounts.tree.is_known_root(&root),
            QietrError::StaleRoot
        );

        // 4. `amount` public signal must equal this denomination's tier value.
        let tier_amount_field = field_from_u64(ctx.accounts.denomination.amount_micro_usdc);
        require!(amount_field == tier_amount_field, QietrError::AmountMismatch);

        // 5. Verify the Groth16 proof against the program-embedded VK.
        verifier::verify(&proof, &public_signals)?;

        // 6. Mark nullifier spent (PDA `init` constraint prevents replay).
        let nul = &mut ctx.accounts.nullifier;
        nul.denom_id = denom_id;
        nul.nullifier_hash = nullifier_hash;
        nul.spent_at_slot = Clock::get()?.slot;
        nul.bump = ctx.bumps.nullifier;

        // 7. Decode paymentAmount from the 32-byte BE field element. The
        //    circuit constrains it to 64 bits, so the high 24 bytes are zero.
        for i in 0..24 {
            require!(
                payment_amount_field[i] == 0,
                QietrError::PaymentAmountOverflow
            );
        }
        let mut amt_bytes = [0u8; 8];
        amt_bytes.copy_from_slice(&payment_amount_field[24..32]);
        let payment_amount = u64::from_be_bytes(amt_bytes);

        // 8. Calculate protocol fee and transfer payment to recipient.
        //    If fee_vault is configured, deduct fee_bps from the payment.
        let denom_id_bytes = [denom_id];
        let vault_bump = ctx.accounts.denomination.vault_bump;
        let vault_seeds: &[&[u8]] = &[b"vault", denom_id_bytes.as_ref(), &[vault_bump]];
        let signer_seeds: &[&[&[u8]]] = &[vault_seeds];

        let fee_vault_pk = ctx.accounts.config.fee_vault;
        if fee_vault_pk != Pubkey::default() {
            let fee_bps = ctx.accounts.config.fee_bps;
            let fee_amount = payment_amount
                .checked_mul(fee_bps as u64)
                .ok_or(QietrError::Overflow)?
                .checked_div(10000)
                .ok_or(QietrError::Overflow)?;
            let amount_after_fee = payment_amount
                .checked_sub(fee_amount)
                .ok_or(QietrError::Overflow)?;

            let fee_vault_acct = ctx
                .accounts
                .fee_vault
                .as_ref()
                .ok_or(QietrError::FeeVaultNotSet)?;
            require!(
                fee_vault_acct.key() == fee_vault_pk,
                QietrError::FeeVaultMismatch
            );

            // Transfer net amount to recipient.
            let cpi_to_recipient = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.recipient_ata.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            );
            token::transfer(cpi_to_recipient, amount_after_fee)?;

            // Transfer fee to fee_vault.
            let cpi_fee = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: fee_vault_acct.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            );
            token::transfer(cpi_fee, fee_amount)?;
        } else {
            // No fee vault configured — send full amount to recipient.
            let cpi = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.recipient_ata.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            );
            token::transfer(cpi, payment_amount)?;
        }

        // 9. Append the change commitment to the tree.
        ctx.accounts.tree.append(change_commitment)?;

        Ok(())
    }

    // ------------------------------------------------------------------------
    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        Ok(())
    }

    // ------------------------------------------------------------------------
    pub fn queue_vk_upgrade(ctx: Context<AdminOnly>, new_vk_hash: [u8; 32]) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        let now = Clock::get()?.slot;
        cfg.pending_vk_hash = new_vk_hash;
        cfg.pending_applies_at_slot = now
            .checked_add(PENDING_VK_LOCK_SLOTS)
            .ok_or(QietrError::Overflow)?;
        Ok(())
    }

    pub fn apply_vk_upgrade(ctx: Context<AdminOnly>) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        require!(cfg.pending_applies_at_slot != 0, QietrError::NoPendingUpgrade);
        let now = Clock::get()?.slot;
        require!(
            now >= cfg.pending_applies_at_slot,
            QietrError::VkUpgradeLocked
        );
        cfg.verifying_key_hash = cfg.pending_vk_hash;
        cfg.pending_vk_hash = [0u8; 32];
        cfg.pending_applies_at_slot = 0;
        Ok(())
    }

    // ------------------------------------------------------------------------
    pub fn set_fee_vault(ctx: Context<SetFeeVault>) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.fee_vault = ctx.accounts.fee_vault.key();
        Ok(())
    }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/// Encode a u64 as a 32-byte big-endian BN254 field element (high 24 bytes zero).
fn field_from_u64(v: u64) -> [u8; 32] {
    let mut out = [0u8; 32];
    out[24..32].copy_from_slice(&v.to_be_bytes());
    out
}

/// Map a Solana pubkey to a BN254 field element by zeroing the top three
/// bits (BN254's scalar field is ~254 bits, a 32-byte pubkey is 256 bits).
/// The SDK MUST produce the matching `recipient` public input by applying
/// the same masking before passing the burner pubkey through the witness.
/// This avoids a Poseidon call on-chain (cheap CU) and stays well below
/// the field modulus 2^254 ≈ p.
fn pubkey_to_field(pk: &Pubkey) -> [u8; 32] {
    let mut out = pk.to_bytes();
    out[0] &= 0x1f; // clear top 3 bits, giving a 253-bit value (<p)
    out
}

// =============================================================================
// Account contexts
// =============================================================================

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + PoolConfig::INIT_SPACE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, PoolConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(denom_id: u8)]
pub struct InitializeDenomination<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin @ QietrError::NotAdmin,
    )]
    pub config: Account<'info, PoolConfig>,
    #[account(
        init,
        payer = admin,
        space = 8 + Denomination::INIT_SPACE,
        seeds = [b"denom", denom_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub denomination: Account<'info, Denomination>,
    #[account(
        init,
        payer = admin,
        space = 8 + MerkleTree::INIT_SPACE,
        seeds = [b"tree", denom_id.to_le_bytes().as_ref()],
        bump,
    )]
    // Heap-allocated: MerkleTree is ~2.3 KB (filled_subtree + root_history
    // + zero_hashes). Keeping it on the BPF stack here exceeds the 4 KB
    // frame budget during Anchor's try_accounts expansion.
    pub tree: Box<Account<'info, MerkleTree>>,
    #[account(
        init,
        payer = admin,
        seeds = [b"vault", denom_id.to_le_bytes().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vault,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(denom_id: u8)]
pub struct Deposit<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, PoolConfig>>,
    #[account(
        mut,
        seeds = [b"denom", denom_id.to_le_bytes().as_ref()],
        bump = denomination.bump,
    )]
    pub denomination: Box<Account<'info, Denomination>>,
    #[account(
        mut,
        seeds = [b"tree", denom_id.to_le_bytes().as_ref()],
        bump = tree.bump,
    )]
    pub tree: Box<Account<'info, MerkleTree>>,
    #[account(
        mut,
        seeds = [b"vault", denom_id.to_le_bytes().as_ref()],
        bump = denomination.vault_bump,
        constraint = vault.key() == denomination.vault @ QietrError::UnknownDenomination,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = depositor_ata.mint == denomination.mint @ QietrError::UnknownDenomination,
        constraint = depositor_ata.owner == depositor.key() @ QietrError::UnknownDenomination,
    )]
    pub depositor_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(denom_id: u8, nullifier_hash: [u8; 32])]
pub struct Withdraw<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, PoolConfig>>,
    #[account(
        seeds = [b"denom", denom_id.to_le_bytes().as_ref()],
        bump = denomination.bump,
    )]
    pub denomination: Box<Account<'info, Denomination>>,
    #[account(
        mut,
        seeds = [b"tree", denom_id.to_le_bytes().as_ref()],
        bump = tree.bump,
    )]
    pub tree: Box<Account<'info, MerkleTree>>,
    #[account(
        mut,
        seeds = [b"vault", denom_id.to_le_bytes().as_ref()],
        bump = denomination.vault_bump,
        constraint = vault.key() == denomination.vault @ QietrError::UnknownDenomination,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        payer = fee_payer,
        space = 8 + NullifierRecord::INIT_SPACE,
        seeds = [b"nullifier", denom_id.to_le_bytes().as_ref(), nullifier_hash.as_ref()],
        bump,
    )]
    pub nullifier: Box<Account<'info, NullifierRecord>>,
    #[account(
        mut,
        constraint = recipient_ata.mint == denomination.mint @ QietrError::UnknownDenomination,
    )]
    pub recipient_ata: Box<Account<'info, TokenAccount>>,
    /// CHECK: validated in withdraw body; only used when config.fee_vault != default.
    #[account(mut)]
    pub fee_vault: Option<Box<Account<'info, TokenAccount>>>,
    #[account(mut)]
    pub fee_payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin @ QietrError::NotAdmin,
    )]
    pub config: Account<'info, PoolConfig>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetFeeVault<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin @ QietrError::NotAdmin,
    )]
    pub config: Account<'info, PoolConfig>,
    pub admin: Signer<'info>,
    /// The token account that will receive protocol fees.
    pub fee_vault: Account<'info, TokenAccount>,
}
