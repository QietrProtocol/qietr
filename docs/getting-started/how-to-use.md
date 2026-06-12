# How to Use Qietr

> **Status:** Qietr is deployed on Solana **devnet**. There is no hosted public
> app yet — run the web UI locally (`cd qietr-web && npm run dev`) or use the SDK
> directly. Mainnet is not live.

## What You Need
- Phantom or Solflare wallet (set to devnet)
- Devnet USDC
- Small amount of devnet SOL for transaction fees

## Steps
1. **Connect Wallet** - Open the locally-running web app and connect your wallet
2. **Get Test Tokens** (Devnet) - Use the devnet faucet
3. **Deposit** - Choose denomination (0.1, 1, 10, 100 USDC), make deposit, save your encrypted note
4. **Wait** (Optional but Recommended) - Privacy improves over time
5. **Make Payment** - Load note, enter recipient/amount, generate ZK proof, pay

## Deposit vs Spending
- Deposits: Fixed denominations (better privacy)
- Spending: Flexible amounts (any amount up to balance)
