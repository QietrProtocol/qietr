// =============================================================================
// scripts/devnet-e2e.ts — end-to-end smoke test against DEVNET.
//
// Drives the deployed qietr_pool program through a full lifecycle using the
// local funded wallet (no airdrops): create mint -> initialize_pool ->
// initialize_denomination -> deposit -> Groth16 prove -> withdraw.
//
// Run:  npx ts-node scripts/devnet-e2e.ts
// (Reads the wallet from ANCHOR_WALLET or ~/.config/solana/id.json.)
// =============================================================================

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  getAssociatedTokenAddress,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import {
  buildDepositIx,
  buildWithdrawIx,
  buildWitness,
  commitmentHash,
  fieldDecToBE32,
  findDenominationPda,
  findMerkleTreePda,
  findNullifierPda,
  findPoolConfigPda,
  findVaultPda,
  nullifierHash,
  PoseidonMerkleTree,
  proveGroth16,
  pubkeyToFieldString,
  randomFieldDec,
} from "@qietr/sdk";

// Randomize the denom id so a partially-failed rerun never collides with an
// existing denomination PDA bound to a previous run's mint.
const DENOM_ID = 1 + Math.floor(Math.random() * 250);
const TIER_MICRO = 10_000_000n; // 10 USDC tier
const PAYMENT_MICRO = 4_000_000n; // pay 4 USDC, 6 USDC change

const WASM_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "qietr-circuits",
  "build",
  "qietr_payment_js",
  "qietr_payment.wasm",
);
const ZKEY_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "qietr-circuits",
  "keys",
  "qietr_payment_dev.zkey",
);

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
  const provider = new AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" },
  );
  anchor.setProvider(provider);

  const idl = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "..", "target", "idl", "qietr_pool.json"),
      "utf-8",
    ),
  );
  const program = new Program(idl, provider);
  const programId = program.programId;
  console.log("program:", programId.toBase58());
  console.log("wallet :", wallet.publicKey.toBase58());

  // --- create a test USDC-like mint we control (6 decimals) ---
  const mint = await createMint(connection, wallet, wallet.publicKey, null, 6);
  console.log("mint   :", mint.toBase58());

  // --- initialize_pool (idempotent: skip if already exists) ---
  const [configPda] = findPoolConfigPda(programId);
  const existing = await withRetry("getConfig", () =>
    connection.getAccountInfo(configPda),
  );
  if (!existing) {
    await program.methods
      .initializePool(50)
      .accounts({
        config: configPda,
        admin: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("initialize_pool: OK");
  } else {
    console.log("initialize_pool: config already exists, reusing");
  }

  // --- initialize_denomination for this fresh mint ---
  const [denomination] = findDenominationPda(DENOM_ID, programId);
  const [tree] = findMerkleTreePda(DENOM_ID, programId);
  const [vault] = findVaultPda(DENOM_ID, programId);
  const denomExists = await withRetry("getDenom", () =>
    connection.getAccountInfo(denomination),
  );
  if (!denomExists) {
    await program.methods
      .initializeDenomination(DENOM_ID, new BN(TIER_MICRO.toString()))
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
      .rpc();
    console.log("initialize_denomination: OK");
  } else {
    console.log(
      "initialize_denomination: denom already exists — must match mint; aborting to stay safe",
    );
    process.exit(1);
  }

  // --- fund a depositor ATA with the tier amount ---
  const depositorAta = await createAssociatedTokenAccount(
    connection,
    wallet,
    mint,
    wallet.publicKey,
  );
  await mintTo(
    connection,
    wallet,
    mint,
    depositorAta,
    wallet,
    Number(TIER_MICRO),
  );
  console.log("depositor ATA funded:", depositorAta.toBase58());

  // --- deposit ---
  const offChain = await PoseidonMerkleTree.create(20);
  const secret = randomFieldDec();
  const nullifier = randomFieldDec();
  const commitmentDec = await commitmentHash(secret, nullifier, TIER_MICRO);
  const commitmentBe = fieldDecToBE32(commitmentDec);

  const depositIx = buildDepositIx(
    DENOM_ID,
    commitmentBe,
    {
      config: configPda,
      denomination,
      tree,
      vault,
      depositorAta,
      depositor: wallet.publicKey,
    },
    programId,
  );
  const depSig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(depositIx),
    [wallet],
  );
  const leafIndex = offChain.insert(BigInt(commitmentDec)) - 1;
  console.log("deposit: OK", depSig);

  const vaultBalAfterDep = (await getAccount(connection, vault)).amount;
  console.log("vault balance after deposit:", vaultBalAfterDep.toString());

  // --- recipient ATA (pay to ourselves for the smoke test) ---
  const recipient = wallet.publicKey;
  const recipientAta = await getAssociatedTokenAddress(mint, recipient);

  // --- build witness + Groth16 proof ---
  const pathProof = offChain.proof(leafIndex);
  const witness = await buildWitness(
    {
      secret,
      nullifier,
      amount: Number(TIER_MICRO),
      denomId: DENOM_ID,
    },
    {
      pathElements: pathProof.pathElements.map((x) => x.toString()),
      pathIndices: pathProof.pathIndices,
      root: pathProof.root.toString(),
    },
    pubkeyToFieldString(recipient),
    PAYMENT_MICRO,
  );
  const groth = await proveGroth16(witness, WASM_PATH, ZKEY_PATH);
  console.log("groth16 proof: generated", groth.proofBytes.length, "bytes");

  const nullHashBe = fieldDecToBE32(await nullifierHash(nullifier));
  const [nullifierAcct] = findNullifierPda(DENOM_ID, nullHashBe, programId);

  const withdrawIx = buildWithdrawIx(
    DENOM_ID,
    nullHashBe,
    groth.proofBytes,
    groth.publicSignals,
    {
      config: configPda,
      denomination,
      tree,
      vault,
      nullifier: nullifierAcct,
      recipientAta,
      feePayer: wallet.publicKey,
    },
    programId,
  );
  const wSig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(withdrawIx),
    [wallet],
  );
  console.log("withdraw: OK", wSig);

  const recipBal = (await getAccount(connection, recipientAta)).amount;
  console.log("recipient balance after withdraw:", recipBal.toString());

  console.log("\n=== DEVNET E2E PASSED ===");
  console.log("deposit tx :", depSig);
  console.log("withdraw tx:", wSig);
}

main().catch((e) => {
  console.error("E2E FAILED:", e);
  process.exit(1);
});
