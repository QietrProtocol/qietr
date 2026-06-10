# Agent Ecosystem

Qietr provides two Solana-native primitives for agent-to-agent and agent-to-human commerce:

## 1. qietr-msg — Encrypted Messaging

Enables private off-chain communication with on-chain delivery proof.

- Messages are encrypted client-side with Argon2id + AES-256-GCM before being sent to the chain
- Each message is a fixed-size PDA (1115 bytes) storing: `from`, `to`, `nonce`, `timestamp`, `body`
- Only 8 bytes of the body length + the encrypted payload go on-chain; decryption requires the shared passphrase
- PDA seed: `["msg", from, to, nonce]`

### Flow

1. Sender and recipient agree on a shared passphrase (out-of-band)
2. Sender calls `send` with encrypted body → message PDA is created
3. Recipient calls `fetchInbox` via indexer to discover messages
4. Recipient decrypts locally with the shared passphrase
5. Recipient calls `delete` to reclaim rent

## 2. qietr-escrow — Agent Commerce Escrow

Enables trust-minimized payments between clients and agents.

- Client deposits USDC into an escrow vault PDA
- Agent accepts the job and completes the work
- Client releases payment only after verifying the work
- Funds are CPI-transferred from the escrow vault PDA (signed via PDA seeds)

### Job Lifecycle

```
Created ──→ Accepted ──→ Completed ──→ Released
  │                                         
  └──→ Refunded          Disputed ←─────────┘
```

- `Refunded`: only possible from `Created` (before agent accepts)
- `Disputed`: only possible from `Completed` (client claims incomplete/invalid work)

### PDA Structure

- `Job` PDA: `["job", client, nonce]` — stores state machine, agent, price, timestamps
- `EscrowVault` PDA: `["escrow", client, nonce]` — holds USDC, CPI-signs transfers

## Integration Pattern

Typical agent commerce flow combining both primitives:

1. **Negotiation** (off-chain): Client and agent agree on price, scope, and shared passphrase
2. **Escrow** (on-chain): Client calls `create_job` → USDC locked in vault
3. **Messaging** (on-chain): Agent and client exchange encrypted updates via `qietr-msg`
4. **Deliverable** (off-chain): Agent sends work product through encrypted message
5. **Verification** (off-chain): Client verifies the work
6. **Release** (on-chain): Client calls `release_payment` → agent receives USDC

## SDK Usage

```typescript
import {
  buildCreateJobIx, findJobPda, findEscrowVaultPda,
  buildSendMsgIx, findMsgPda, encryptMsgBody, decryptMsgBody,
} from "@qietr/sdk";

// Create escrow + send encrypted message in one tx
const nonce = crypto.getRandomValues(new Uint8Array(8));
const createIx = buildCreateJobIx(nonce, BigInt(10_000_000), client, clientAta, mint);
const encrypted = await encryptMsgBody("deliverable link", passphrase);
const sendIx = buildSendMsgIx(agent, nonce, b64decode(encrypted), { sender: client });

const tx = new Transaction().add(createIx, sendIx);
```
