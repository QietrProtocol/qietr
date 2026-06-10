# qietr-escrow

Agent commerce escrow for Solana.

## Overview

An Anchor program that holds USDC in escrow while an agent completes a job for a client. Supports the lifecycle: `create → accept → complete → release`. Dispute and refund paths are also available.

## Program

- **Program ID:** `BqAeDVPRdokf5q5XQmHoanwEYgyNwV9xWjbUMGQJRmJE`
- **Instructions:** `create_job`, `accept_job`, `complete_job`, `release_payment`, `dispute_job`, `refund_job`
- **Accounts:**
  - `Job` — state PDA (seeds: `["job", client, nonce]`)
  - `EscrowVault` — token account PDA (seeds: `["escrow", client, nonce]`)

### Lifecycle

| Step | Action | Who | Next state |
|------|--------|-----|------------|
| 1 | `create_job` | Client | `Created` |
| 2 | `accept_job` | Agent | `Accepted` |
| 3 | `complete_job` | Agent | `Completed` |
| 4 | `release_payment` | Client | `Released` |
| — | `dispute_job` | Client | `Disputed` (from `Completed`) |
| — | `refund_job` | Client | `Refunded` (from `Created`) |

## SDK

See `@qietr/sdk` — `src/escrow.ts`:
- `buildCreateJobIx(nonce, priceMicro, client, clientAta, mint)`
- `buildAcceptJobIx(jobPda, agent)`
- `buildCompleteJobIx(jobPda, agent)`
- `buildReleasePaymentIx(jobPda, escrowVault, agentAta, client)`
- `buildDisputeJobIx(jobPda, client)`
- `buildRefundJobIx(jobPda, escrowVault, clientAta, client)`
- `findJobPda(client, nonce)` / `findEscrowVaultPda(client, nonce)`
- `parseJobAccount(data)`

## Build

```bash
anchor build
```

## Test

```bash
# SDK tests
cd ../qietr-sdk && npm test
```
