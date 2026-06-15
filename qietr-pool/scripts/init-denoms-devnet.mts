// =============================================================================
// scripts/init-denoms-devnet.mts — initialize the production tier set on DEVNET.
//
// The deployed pool's config exists but its per-tier `denomination` PDAs were
// never created (e.g. after a program-id rotation), so deposits fail with
// AnchorError 3012 AccountNotInitialized on `denomination`. This script calls
// `initialize_denomination` for every tier in DEFAULT_TIERS, bound to the real
// devnet USDC-Dev mint. It is idempotent: existing denominations are left alone
// (and verified to point at the expected mint).
//
// Run:  npx ts-node scripts/init-denoms-devnet.mts
// (Reads the admin wallet from ANCHOR_WALLET or ~/.config/solana/id.json.)
// =============================================================================

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_TIERS,
  USDC_MINT_DEVNET,
  findDenominationPda,
  findMerkleTreePda,
  findPoolConfigPda,
  findVaultPda,
} from "@qietr/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < 6; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      console.log(`  ${label}: retry ${i + 1}/6 after error`);
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw lastErr;
}

function loadWallet(): Keypair {
  const p =
    process.env.ANCHOR_WALLET ||
    path.join(os.homedir(), ".config", "solana", "id.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  const wallet = loadWallet();
  const connection = new Connection(
    process.env.RPC_URL || "https://api.devnet.solana.com",
    "confirmed",
  );
  const provider = new AnchorProvider(connection, new anchor.Wallet(wallet), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const idl = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "..", "target", "idl", "qietr_pool.json"),
      "utf-8",
    ),
  );
  const program = new Program(idl, provider);
  const programId = program.programId;
  const mint = USDC_MINT_DEVNET;

  console.log("program:", programId.toBase58());
  console.log("admin  :", wallet.publicKey.toBase58());
  console.log("mint   :", mint.toBase58(), "(USDC-Dev)");

  const [configPda] = findPoolConfigPda(programId);
  const cfg = await withRetry("getConfig", () =>
    connection.getAccountInfo(configPda),
  );
  if (!cfg) {
    console.error(
      "pool config does not exist — run initialize_pool first (devnet-e2e.mts).",
    );
    process.exit(1);
  }

  for (const { denomId, amountMicroUsdc } of DEFAULT_TIERS) {
    const [denomination] = findDenominationPda(denomId, programId);
    const [tree] = findMerkleTreePda(denomId, programId);
    const [vault] = findVaultPda(denomId, programId);

    const existing = await withRetry(`getDenom#${denomId}`, () =>
      connection.getAccountInfo(denomination),
    );
    if (existing) {
      // Denomination layout: 8 disc | denom_id u8 | amount u64 | deposit_count
      // u64 | vault Pubkey(32) | mint Pubkey(32) | ... — read mint at offset
      // 8 + 1 + 8 + 8 + 32 = 57.
      const onchainMint = new PublicKey(existing.data.subarray(57, 57 + 32));
      const ok = onchainMint.equals(mint);
      console.log(
        `denom ${denomId} (${Number(amountMicroUsdc) / 1e6} USDC): already exists, mint ${onchainMint.toBase58()} ${ok ? "✓ matches" : "✗ MISMATCH"}`,
      );
      if (!ok) {
        console.error(
          `  refusing to continue — denom ${denomId} is bound to a different mint.`,
        );
        process.exit(1);
      }
      continue;
    }

    process.stdout.write(
      `denom ${denomId} (${Number(amountMicroUsdc) / 1e6} USDC): initializing… `,
    );
    const sig = await withRetry(`initDenom#${denomId}`, () =>
      program.methods
        .initializeDenomination(denomId, new BN(amountMicroUsdc.toString()))
        .accounts({
          config: configPda,
          denomination,
          tree,
          vault,
          mint,
          admin: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc(),
    );
    console.log(`OK (${sig})`);
  }

  console.log("\nAll tiers initialized. Deposits should now succeed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
