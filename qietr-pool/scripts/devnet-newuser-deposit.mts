// =============================================================================
// scripts/devnet-newuser-deposit.mts — prove a brand-new (non-admin) wallet can
// deposit into the deployed devnet pool.
//
// USDC-Dev is mint-controlled by Circle (no programmatic mint), so this uses a
// throwaway test mint + a throwaway test denomination to exercise the exact
// deposit code path from a fresh signer. The real USDC-Dev tiers (0-3) behave
// identically — a real user just funds their wallet from faucet.circle.com.
//
// Admin (local wallet) only: funds the new wallet with SOL, creates the test
// mint, and initializes the test tier (initialize_denomination is admin-only).
// The DEPOSIT itself is signed by the fresh wallet — that is the thing we test.
//
// Run:  npx ts-node scripts/devnet-newuser-deposit.mts
// =============================================================================

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildDepositIx,
  commitmentHash,
  fieldDecToBE32,
  findDenominationPda,
  findMerkleTreePda,
  findPoolConfigPda,
  findVaultPda,
  randomFieldDec,
} from "@qietr/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TIER_MICRO = 10_000_000n; // 10 "USDC" test tier
// Fresh high denom id so we never collide with the real tiers (0-3) or a prior run.
const TEST_DENOM_ID = 200 + Math.floor(Math.random() * 50);

function loadAdmin(): Keypair {
  const p =
    process.env.ANCHOR_WALLET ||
    path.join(os.homedir(), ".config", "solana", "id.json");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf-8"))));
}

async function main() {
  const admin = loadAdmin();
  const user = Keypair.generate(); // <-- brand new address
  const connection = new Connection(
    process.env.RPC_URL || "https://api.devnet.solana.com",
    "confirmed",
  );
  const provider = new AnchorProvider(connection, new anchor.Wallet(admin), {
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

  console.log("program  :", programId.toBase58());
  console.log("admin    :", admin.publicKey.toBase58());
  console.log("NEW user :", user.publicKey.toBase58());
  console.log("test tier:", TEST_DENOM_ID, `(${Number(TIER_MICRO) / 1e6} test-USDC)`);

  // 1) admin funds the new wallet with SOL (fees only).
  const fundSig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: user.publicKey,
        lamports: 0.05 * LAMPORTS_PER_SOL,
      }),
    ),
    [admin],
  );
  console.log("fund new wallet 0.05 SOL: OK", fundSig);

  // 2) admin creates a throwaway test mint and mints the tier amount to the user.
  const mint = await createMint(connection, admin, admin.publicKey, null, 6);
  console.log("test mint:", mint.toBase58());
  const userAta = await getOrCreateAssociatedTokenAccount(
    connection,
    admin, // admin pays for the user's ATA
    mint,
    user.publicKey,
  );
  await mintTo(connection, admin, mint, userAta.address, admin, Number(TIER_MICRO));
  console.log("user ATA funded:", userAta.address.toBase58(), `(${Number(TIER_MICRO) / 1e6})`);

  // 3) admin initializes the test denomination (admin-only instruction).
  const [configPda] = findPoolConfigPda(programId);
  const [denomination] = findDenominationPda(TEST_DENOM_ID, programId);
  const [tree] = findMerkleTreePda(TEST_DENOM_ID, programId);
  const [vault] = findVaultPda(TEST_DENOM_ID, programId);
  await program.methods
    .initializeDenomination(TEST_DENOM_ID, new BN(TIER_MICRO.toString()))
    .accounts({
      config: configPda,
      denomination,
      tree,
      vault,
      mint,
      admin: admin.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .rpc();
  console.log("initialize_denomination: OK");

  // 4) THE TEST: the new wallet signs and sends the deposit.
  const secret = randomFieldDec();
  const nullifier = randomFieldDec();
  const commitmentDec = await commitmentHash(secret, nullifier, TIER_MICRO);
  const commitmentBe = fieldDecToBE32(commitmentDec);

  const depositIx = buildDepositIx(
    TEST_DENOM_ID,
    commitmentBe,
    {
      config: configPda,
      denomination,
      tree,
      vault,
      depositorAta: userAta.address,
      depositor: user.publicKey,
    },
    programId,
  );
  const depSig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(depositIx),
    [user], // signed by the NEW wallet only
  );
  console.log("\n>>> DEPOSIT from new wallet: OK", depSig);

  // 5) verify on-chain effects.
  const vaultBal = (await getAccount(connection, vault)).amount;
  const denomAcct = await program.account.denomination.fetch(denomination);
  console.log("vault balance     :", vaultBal.toString(), "(expected", TIER_MICRO.toString() + ")");
  console.log("denom.depositCount:", denomAcct.depositCount.toString(), "(expected 1)");
  const ok = vaultBal === TIER_MICRO && denomAcct.depositCount.toString() === "1";
  console.log(ok ? "\n✅ PASS — a new address can deposit." : "\n❌ FAIL — unexpected state.");
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
