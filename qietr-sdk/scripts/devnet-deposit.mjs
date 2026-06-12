// End-to-end devnet deposit against the live (upgraded) qietr-pool program.
// Uses the real SDK code path (Poseidon commitment + buildDepositIx). Mints
// test USDC to ourselves (we are the mint authority) via raw web3 ixs so no
// spl-token dependency is needed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  Connection, Keypair, PublicKey, Transaction, TransactionInstruction,
  SystemProgram, sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  QIETR_POOL_PROGRAM_ID, buildDepositIx, commitmentHash, fieldDecToBE32,
  randomFieldDec, findPoolConfigPda, findDenominationPda, findMerkleTreePda,
  findVaultPda, findAssociatedTokenAddress,
} from "../dist/index.js";

const RPC = "https://api.devnet.solana.com";
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const DENOM_ID = 0;
const MINT = new PublicKey("HKm8navJ12Q9HjLUYcXj7z3835ZgyEVAg6AVxZS1EekZ");
const AMOUNT = 10_000_000n; // 10 USDC (6 decimals)

function loadWallet() {
  const p = path.join(os.homedir(), ".config", "solana", "id.json");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8"))));
}

function createAtaIdempotentIx(payer, ata, owner, mint) {
  return new TransactionInstruction({
    programId: ATA_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]), // CreateIdempotent
  });
}

function mintToIx(mint, dest, authority, amount) {
  const data = Buffer.alloc(9);
  data[0] = 7; // MintTo
  data.writeBigUInt64LE(amount, 1);
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

const tokenAmount = (info) =>
  info ? Buffer.from(info.data).readBigUInt64LE(64).toString() : "n/a";
const treeNextLeaf = (info) =>
  info ? Buffer.from(info.data).readBigUInt64LE(9).toString() : "n/a";

async function main() {
  const conn = new Connection(RPC, "confirmed");
  const wallet = loadWallet();
  console.log("depositor / mint-authority:", wallet.publicKey.toBase58());

  const [config] = findPoolConfigPda(QIETR_POOL_PROGRAM_ID);
  const [denomination] = findDenominationPda(DENOM_ID, QIETR_POOL_PROGRAM_ID);
  const [tree] = findMerkleTreePda(DENOM_ID, QIETR_POOL_PROGRAM_ID);
  const [vault] = findVaultPda(DENOM_ID, QIETR_POOL_PROGRAM_ID);
  const depositorAta = findAssociatedTokenAddress(wallet.publicKey, MINT);

  // ---- state BEFORE ----
  const treeBefore = treeNextLeaf(await conn.getAccountInfo(tree));
  const vaultBefore = tokenAmount(await conn.getAccountInfo(vault));
  console.log("BEFORE  tree.nextLeafIndex:", treeBefore, "| vault balance(micro):", vaultBefore);

  // ---- real commitment (Poseidon3) ----
  const secret = randomFieldDec();
  const nullifier = randomFieldDec();
  const commitmentDec = await commitmentHash(secret, nullifier, AMOUNT);
  const commitmentBe = fieldDecToBE32(commitmentDec);
  console.log("commitment:", "0x" + Buffer.from(commitmentBe).toString("hex"));

  const depositIx = buildDepositIx(DENOM_ID, commitmentBe, {
    config, denomination, tree, vault, depositorAta, depositor: wallet.publicKey,
  }, QIETR_POOL_PROGRAM_ID);

  const tx = new Transaction().add(
    createAtaIdempotentIx(wallet.publicKey, depositorAta, wallet.publicKey, MINT),
    mintToIx(MINT, depositorAta, wallet.publicKey, AMOUNT),
    depositIx,
  );

  const sig = await sendAndConfirmTransaction(conn, tx, [wallet], {
    commitment: "confirmed", skipPreflight: false,
  });
  console.log("DEPOSIT TX:", sig);

  // ---- state AFTER ----
  const treeAfter = treeNextLeaf(await conn.getAccountInfo(tree));
  const vaultAfter = tokenAmount(await conn.getAccountInfo(vault));
  console.log("AFTER   tree.nextLeafIndex:", treeAfter, "| vault balance(micro):", vaultAfter);

  const leafOk = BigInt(treeAfter) === BigInt(treeBefore) + 1n;
  const vaultOk = BigInt(vaultAfter) === BigInt(vaultBefore) + AMOUNT;
  console.log("\nRESULT:",
    "leaf+1:", leafOk ? "OK" : "FAIL",
    "| vault+10USDC:", vaultOk ? "OK" : "FAIL");
  if (!leafOk || !vaultOk) process.exit(1);
  console.log("✅ End-to-end deposit verified on devnet.");
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
