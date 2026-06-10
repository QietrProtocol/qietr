use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("BqAeDVPRdokf5q5XQmHoanwEYgyNwV9xWjbUMGQJRmJE");

pub const MAX_SPEC_BYTES: usize = 1024;

#[derive(InitSpace, Clone, Copy, PartialEq, Eq, AnchorSerialize, AnchorDeserialize)]
pub enum JobState {
    Created,
    Accepted,
    Completed,
    Released,
    Disputed,
    Refunded,
}

#[account]
#[derive(InitSpace)]
pub struct Job {
    pub client: Pubkey,
    pub agent: Pubkey,
    pub nonce: [u8; 8],
    pub price_micro: u64,
    pub created_at: i64,
    pub accepted_at: i64,
    pub completed_at: i64,
    pub state: JobState,
    pub bump: u8,
    pub escrow_bump: u8,
}

#[program]
pub mod qietr_escrow {
    use super::*;

    pub fn create_job(
        ctx: Context<CreateJob>,
        nonce: [u8; 8],
        price_micro: u64,
    ) -> Result<()> {
        let job = &mut ctx.accounts.job;
        job.client = ctx.accounts.client.key();
        job.agent = Pubkey::default();
        job.nonce = nonce;
        job.price_micro = price_micro;
        job.created_at = Clock::get()?.unix_timestamp;
        job.accepted_at = 0;
        job.completed_at = 0;
        job.state = JobState::Created;
        job.bump = ctx.bumps.job;
        job.escrow_bump = ctx.bumps.escrow_vault;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.client_ata.to_account_info(),
                    to: ctx.accounts.escrow_vault.to_account_info(),
                    authority: ctx.accounts.client.to_account_info(),
                },
            ),
            price_micro,
        )?;

        Ok(())
    }

    pub fn accept_job(ctx: Context<AcceptJob>) -> Result<()> {
        let job = &mut ctx.accounts.job;
        require!(job.state == JobState::Created, EscrowError::InvalidState);
        job.agent = ctx.accounts.agent.key();
        job.accepted_at = Clock::get()?.unix_timestamp;
        job.state = JobState::Accepted;
        Ok(())
    }

    pub fn complete_job(ctx: Context<CompleteJob>) -> Result<()> {
        let job = &mut ctx.accounts.job;
        require!(job.state == JobState::Accepted, EscrowError::InvalidState);
        require!(ctx.accounts.agent.key() == job.agent, EscrowError::NotAgent);
        job.completed_at = Clock::get()?.unix_timestamp;
        job.state = JobState::Completed;
        Ok(())
    }

    pub fn release_payment(ctx: Context<ReleasePayment>) -> Result<()> {
        let job = &mut ctx.accounts.job;
        require!(job.state == JobState::Completed, EscrowError::InvalidState);
        require!(ctx.accounts.client.key() == job.client, EscrowError::NotClient);

        let seeds = &[
            b"escrow".as_ref(),
            job.client.as_ref(),
            &job.nonce,
            &[job.escrow_bump],
        ];
        let signer: &[&[&[u8]]] = &[seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_vault.to_account_info(),
                    to: ctx.accounts.agent_ata.to_account_info(),
                    authority: ctx.accounts.escrow_vault.to_account_info(),
                },
                signer,
            ),
            job.price_micro,
        )?;

        job.state = JobState::Released;
        Ok(())
    }

    pub fn dispute_job(ctx: Context<DisputeJob>) -> Result<()> {
        let job = &mut ctx.accounts.job;
        require!(job.state == JobState::Completed, EscrowError::InvalidState);
        require!(ctx.accounts.client.key() == job.client, EscrowError::NotClient);
        job.state = JobState::Disputed;
        Ok(())
    }

    pub fn refund_job(ctx: Context<RefundJob>) -> Result<()> {
        let job = &mut ctx.accounts.job;
        require!(job.state == JobState::Created, EscrowError::InvalidState);
        require!(ctx.accounts.client.key() == job.client, EscrowError::NotClient);

        let seeds = &[
            b"escrow".as_ref(),
            job.client.as_ref(),
            &job.nonce,
            &[job.escrow_bump],
        ];
        let signer: &[&[&[u8]]] = &[seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_vault.to_account_info(),
                    to: ctx.accounts.client_ata.to_account_info(),
                    authority: ctx.accounts.escrow_vault.to_account_info(),
                },
                signer,
            ),
            job.price_micro,
        )?;

        job.state = JobState::Refunded;
        Ok(())
    }
}

#[error_code]
pub enum EscrowError {
    #[msg("Job state does not allow this action")]
    InvalidState,
    #[msg("Only the agent can perform this action")]
    NotAgent,
    #[msg("Only the client can perform this action")]
    NotClient,
}

// ---------------------------------------------------------------------------
// Account contexts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(nonce: [u8; 8], price_micro: u64)]
pub struct CreateJob<'info> {
    #[account(
        init,
        payer = client,
        space = 8 + Job::INIT_SPACE,
        seeds = [b"job", client.key().as_ref(), nonce.as_ref()],
        bump,
    )]
    pub job: Account<'info, Job>,
    #[account(
        init,
        payer = client,
        seeds = [b"escrow", client.key().as_ref(), nonce.as_ref()],
        bump,
        token::mint = mint,
        token::authority = escrow_vault,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub client_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub client: Signer<'info>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AcceptJob<'info> {
    #[account(
        mut,
        seeds = [b"job", job.client.as_ref(), &job.nonce],
        bump = job.bump,
    )]
    pub job: Account<'info, Job>,
    pub agent: Signer<'info>,
}

#[derive(Accounts)]
pub struct CompleteJob<'info> {
    #[account(
        mut,
        seeds = [b"job", job.client.as_ref(), &job.nonce],
        bump = job.bump,
    )]
    pub job: Account<'info, Job>,
    #[account(
        address = job.agent,
    )]
    pub agent: Signer<'info>,
}

#[derive(Accounts)]
pub struct ReleasePayment<'info> {
    #[account(
        mut,
        seeds = [b"job", job.client.as_ref(), &job.nonce],
        bump = job.bump,
    )]
    pub job: Account<'info, Job>,
    #[account(
        mut,
        seeds = [b"escrow", job.client.as_ref(), &job.nonce],
        bump = job.escrow_bump,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub agent_ata: Account<'info, TokenAccount>,
    pub client: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DisputeJob<'info> {
    #[account(
        mut,
        seeds = [b"job", job.client.as_ref(), &job.nonce],
        bump = job.bump,
    )]
    pub job: Account<'info, Job>,
    pub client: Signer<'info>,
}

#[derive(Accounts)]
pub struct RefundJob<'info> {
    #[account(
        mut,
        seeds = [b"job", job.client.as_ref(), &job.nonce],
        bump = job.bump,
    )]
    pub job: Account<'info, Job>,
    #[account(
        mut,
        seeds = [b"escrow", job.client.as_ref(), &job.nonce],
        bump = job.escrow_bump,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub client_ata: Account<'info, TokenAccount>,
    pub client: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
