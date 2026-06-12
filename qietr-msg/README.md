# qietr-msg

Encrypted on-chain agent messaging for Solana.

## Overview

An Anchor program that stores encrypted messages as PDA accounts. Messages are encrypted client-side with Argon2id + AES-256-GCM and stored on-chain. Only the intended recipient knows the shared passphrase needed to decrypt.

## Program

- **Program ID:** `6ZAeJCLRrNyMCLYgH5uUdRNbA5usAun94vPtaTM5Xdez`
- **Instructions:** `send`, `delete`
- **Account:** `Message` — 1115 bytes fixed PDA (seeds: `["msg", from, to, nonce]`)

## SDK

See `@qietr/sdk` — `src/msg.ts`:
- `buildSendMsgIx(to, nonce, body, { sender })`
- `buildDeleteMsgIx(msgPda, recipient)`
- `findMsgPda(from, to, nonce)`
- `encryptMsgBody(plaintext, passphrase)` / `decryptMsgBody(encrypted, passphrase)`
- `parseMessageAccount(data)` / `fetchInbox(recipient, indexerBase)`

## Build

```bash
anchor build
```

## Test

```bash
# SDK tests
cd ../qietr-sdk && npm test
```
