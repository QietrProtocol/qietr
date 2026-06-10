// =============================================================================
// qietr_msg — encrypted agent messaging program.
//
// Each message is a PDA: seeds = [b"msg", from, to, nonce]
// The body is stored inline (fixed 1024-byte buffer).
// =============================================================================

use anchor_lang::prelude::*;

declare_id!("2uA7fwAVXbmPNkYsjf5F1zQzxvmQvjNFLCHwSasYqWaL");

pub const MAX_MSG_BYTES: usize = 1024;

#[program]
pub mod qietr_msg {
    use super::*;

    pub fn send(ctx: Context<Send>, to: Pubkey, nonce: [u8; 8], body: Vec<u8>) -> Result<()> {
        require!(body.len() <= MAX_MSG_BYTES, MsgError::BodyTooLong);

        let msg = &mut ctx.accounts.message;
        msg.from = ctx.accounts.sender.key();
        msg.to = to;
        msg.nonce = nonce;
        msg.timestamp = Clock::get()?.unix_timestamp;
        msg.body_len = body.len() as u16;
        msg.bump = ctx.bumps.message;

        let arr: &mut [u8; MAX_MSG_BYTES] = &mut msg.body;
        let slice = &mut arr[..body.len()];
        slice.copy_from_slice(&body);

        Ok(())
    }

    pub fn delete(ctx: Context<Delete>) -> Result<()> {
        let msg = &mut ctx.accounts.message;
        msg.body_len = 0;
        msg.body = [0u8; MAX_MSG_BYTES];
        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct Message {
    pub from: Pubkey,
    pub to: Pubkey,
    pub nonce: [u8; 8],
    pub timestamp: i64,
    pub body_len: u16,
    pub bump: u8,
    pub body: [u8; MAX_MSG_BYTES],
}

#[error_code]
pub enum MsgError {
    #[msg("Message body exceeds 1024 bytes")]
    BodyTooLong,
    #[msg("Only the recipient can delete this message")]
    NotRecipient,
}

#[derive(Accounts)]
#[instruction(to: Pubkey, nonce: [u8; 8])]
pub struct Send<'info> {
    #[account(
        init,
        payer = sender,
        space = 8 + Message::INIT_SPACE,
        seeds = [b"msg", sender.key().as_ref(), to.as_ref(), nonce.as_ref()],
        bump,
    )]
    pub message: Account<'info, Message>,
    #[account(mut)]
    pub sender: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Delete<'info> {
    #[account(
        mut,
        seeds = [b"msg", message.from.as_ref(), message.to.as_ref(), &message.nonce],
        bump = message.bump,
        constraint = message.to == recipient.key() @ MsgError::NotRecipient,
    )]
    pub message: Account<'info, Message>,
    pub recipient: Signer<'info>,
}
