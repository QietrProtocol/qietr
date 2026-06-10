# What is Qietr?

## Summary
Qietr is a zero-knowledge privacy layer built on top of x402, enabling anonymous payments for web services, API access, and agent transactions on Solana.

## How it works
### Step 1: Deposit
Deposit USDC into privacy pool at fixed denominations (0.1, 1, 10, 100 USDC)
- Choose denomination tier
- Receive encrypted note
- Commitment added to Merkle tree

### Step 2: Wait (Optional)
Privacy improves over time with more deposits.

### Step 3: Pay
Use note to pay any amount (flexible spending)
- Generate zero-knowledge proof
- Payment executes from pool
- Merchant receives payment, can't identify you

## Key Features
- Anonymous Payments - Hidden among all depositors
- Gasless Transactions - Relayer sponsors SOL fees
- Flexible Spending - Fixed deposits, flexible payments

## Use Cases
- AI Agent Payments
- Developer API Usage
- Content Access
- Business Operations

## Supported Networks
- Devnet: Solana devnet
- Mainnet: Solana mainnet-beta (planned)

## Deposit Denominations
0.1, 1, 10, 100 USDC (fixed tiers)

## Fees
- Devnet: FREE
- Mainnet: Deposit fee (configurable), Payments $0, Gas $0 (relayer-sponsored)
