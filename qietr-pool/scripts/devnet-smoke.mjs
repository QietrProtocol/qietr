// =============================================================================
// scripts/devnet-smoke.mjs — devnet end-to-end smoke test (pure ESM).
//
// Runs against the deployed program at the declared id, using the local
// `solana config get` keypair as admin + fee_payer + depositor + recipient.
// Creates a fresh 6-decimal mint (test USDC), inits one tier (10 USDC),
// deposits, then withdraws to a fresh ATA. Validates balances move.
//
// Usage:  node scripts/devnet-smoke.mjs
// =============================================================================

import * as anchor from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
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

const { AnchorProvider, BN, Program, Wallet } = anchor;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_URL = process.env.DEVNET_RPC ?? "https://api.devnet.solana.com";
const KEYPAIR_PATH =
  process.env.SOLANA_KEYPAIR ?? path.join(os.homedir(), ".config/solana/id.json");
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
const IDL_PATH = path.resolve(__dirname, "..", "target", "idl", "qietr_pool.json");
const MERKLE_DEPTH = 20;
const TIER_MICRO = 10_000_000n;
const DENOM_ID = Number(process.env.DENOM_ID ?? 1);

function loadKeypair(p) {
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  const admin = loadKeypair(KEYPAIR_PATH);
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(admin), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
  const program = new Program(idl, provider);
  const programId = program.programId;

  console.log("[devnet-smoke] program id:", programId.toBase58());
  console.log("[devnet-smoke] admin:", admin.publicKey.toBase58());
  console.log(
    "[devnet-smoke] balance:",
    (await connection.getBalance(admin.publicKey)) / 1e9,
    "SOL",
  );

  const [configPda] = findPoolConfigPda(programId);
  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) {
    console.log("[devnet-smoke] initializing PoolConfig…");
    await program.methods
      .initializePool(50)
      .accounts({
        config: configPda,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
  } else {
    console.log("[devnet-smoke] PoolConfig already initialized");
  }

  console.log("[devnet-smoke] creating test mint (6 decimals)…");
  const mint = await createMint(connection, admin, admin.publicKey, null, 6);
  console.log("[devnet-smoke] mint:", mint.toBase58());

  const [denomination] = findDenominationPda(DENOM_ID, programId);
  const [tree] = findMerkleTreePda(DENOM_ID, programId);
  const [vault] = findVaultPda(DENOM_ID, programId);
  const denomInfo = await connection.getAccountInfo(denomination);
  if (denomInfo) {
    throw new Error(
      `[devnet-smoke] denom #${DENOM_ID} already exists on chain — rotate DENOM_ID`,
    );
  }
  console.log(`[devnet-smoke] initializing denom #${DENOM_ID} @ 10 USDC…`);
  await program.methods
    .initializeDenomination(DENOM_ID, new BN(TIER_MICRO.toString()))
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
    .signers([admin])
    .rpc();

  console.log("[devnet-smoke] minting 30 test-USDC to admin ATA…");
  const adminAta = await createAssociatedTokenAccount(
    connection,
    admin,
    mint,
    admin.publicKey,
  );
  await mintTo(connection, admin, mint, adminAta, admin, Number(TIER_MICRO * 3n));

  const offChainTree = await PoseidonMerkleTree.create(MERKLE_DEPTH);
  const secret = randomFieldDec();
  const nullifier = randomFieldDec();
  const commitmentDec = await commitmentHash(secret, nullifier, TIER_MICRO);
  const commitmentBe = fieldDecToBE32(commitmentDec);

  console.log("[devnet-smoke] depositing 10 test-USDC…");
  const depositIx = buildDepositIx(
    DENOM_ID,
    commitmentBe,
    {
      config: configPda,
      denomination,
      tree,
      vault,
      depositorAta: adminAta,
      depositor: admin.publicKey,
    },
    programId,
  );
  const depositSig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(depositIx),
    [admin],
  );
  console.log("[devnet-smoke] deposit sig:", depositSig);
  offChainTree.insert(BigInt(commitmentDec));

  const vaultAfterDeposit = await getAccount(connection, vault);
  console.log(
    "[devnet-smoke] vault after deposit (micro):",
    vaultAfterDeposit.amount.toString(),
  );
  if (vaultAfterDeposit.amount !== TIER_MICRO) {
    throw new Error("vault balance mismatch after deposit");
  }

  const recipient = Keypair.generate();
  const recipientAta = await createAssociatedTokenAccount(
    connection,
    admin,
    mint,
    recipient.publicKey,
  );
  const paymentMicro = 7_000_000n;

  const proofPath = offChainTree.proof(0);
  const witness = await buildWitness(
    {
      secret,
      nullifier,
      amount: Number(TIER_MICRO),
      denomId: DENOM_ID,
    },
    {
      pathElements: proofPath.pathElements.map((x) => x.toString()),
      pathIndices: proofPath.pathIndices,
      root: proofPath.root.toString(),
    },
    pubkeyToFieldString(recipient.publicKey),
    paymentMicro,
  );
  console.log("[devnet-smoke] proving Groth16…");
  const groth = await proveGroth16(witness, WASM_PATH, ZKEY_PATH);

  const nullHashDec = await nullifierHash(nullifier);
  const nullHashBe = fieldDecToBE32(nullHashDec);
  const [nullifierAcct] = findNullifierPda(DENOM_ID, nullHashBe, programId);

  const beToDec = (u8) => {
    let n = 0n;
    for (const b of u8) n = (n << 8n) | BigInt(b);
    return n.toString();
  };
  console.log("[devnet-smoke] DIAGNOSTIC: nullifier decimal:", nullifier);
  console.log("[devnet-smoke] DIAGNOSTIC: SDK nullHashDec   :", nullHashDec);
  console.log("[devnet-smoke] DIAGNOSTIC: publicSignals as decimal:");
  for (const [i, ps] of groth.publicSignals.entries()) {
    console.log(`  [${i}] ${beToDec(ps)}`);
  }
  console.log("[devnet-smoke] DIAGNOSTIC: expected order: [nullifierHash, root, recipient, paymentAmount, changeCommitment, amount]");
  console.log("[devnet-smoke] DIAGNOSTIC: witness.nullifierHash   :", witness.nullifierHash);
  console.log("[devnet-smoke] DIAGNOSTIC: witness.root            :", witness.root);
  console.log("[devnet-smoke] DIAGNOSTIC: witness.recipient       :", witness.recipient);
  console.log("[devnet-smoke] DIAGNOSTIC: witness.paymentAmount   :", witness.paymentAmount);
  console.log("[devnet-smoke] DIAGNOSTIC: witness.changeCommitment:", witness.changeCommitment);
  console.log("[devnet-smoke] DIAGNOSTIC: witness.amount          :", witness.amount);

  console.log("[devnet-smoke] submitting withdraw…");
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
      feePayer: admin.publicKey,
    },
    programId,
  );
  const withdrawSig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(withdrawIx),
    [admin],
  );
  console.log("[devnet-smoke] withdraw sig:", withdrawSig);

  const recipientAfter = await getAccount(connection, recipientAta);
  console.log(
    "[devnet-smoke] recipient after withdraw (micro):",
    recipientAfter.amount.toString(),
  );
  if (recipientAfter.amount !== paymentMicro) {
    throw new Error("recipient balance mismatch after withdraw");
  }

  console.log("\n[devnet-smoke] PASS");
  console.log("  program: ", programId.toBase58());
  console.log("  deposit: ", depositSig);
  console.log("  withdraw:", withdrawSig);
}

main().catch((err) => {
  console.error("[devnet-smoke] FAILED:", err);
  process.exit(1);
});
