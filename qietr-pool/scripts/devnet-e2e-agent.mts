// =============================================================================
// scripts/devnet-e2e-agent.mts — end-to-end smoke test for qietr_escrow +
// qietr_msg against DEVNET.
//
// Escrow: create -> accept -> complete -> release  (happy path)
//         create -> cancel-with-wrong-ATA (must FAIL: security fix)
//                -> cancel with client ATA (refund) -> close_job
// Msg:    send encrypted -> fetch + decrypt -> close (rent reclaim)
//
// Run from qietr-pool/ (for node_modules):
//   RPC_URL=http://127.0.0.1:8899 node scripts/devnet-e2e-agent.mts
// =============================================================================

import {
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildAcceptJobIx,
  buildCancelJobIx,
  buildCloseJobIx,
  buildCloseMsgIx,
  buildCompleteJobIx,
  buildCreateJobIx,
  buildReleasePaymentIx,
  buildSendMsgIx,
  decryptMsgBody,
  encryptMsgBody,
  findEscrowVaultPda,
  findJobPda,
  findMsgPda,
  JobState,
  parseJobAccount,
  parseMessageAccount,
} from "@qietr/sdk";

const PRICE_MICRO = 10_000_000n; // 10 USDC job
const REFUND_MICRO = 5_000_000n; // 5 USDC job that gets cancelled

function loadWallet(): Keypair {
  const p =
    process.env.ANCHOR_WALLET ||
    path.join(os.homedir(), ".config", "solana", "id.json");
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf-8"))),
  );
}

async function fetchJob(connection: Connection, jobPda: PublicKey) {
  const info = await connection.getAccountInfo(jobPda);
  if (!info) return null;
  return parseJobAccount(info.data);
}

async function main() {
  const client = loadWallet();
  const agent = Keypair.generate(); // fresh agent; client pays all fees
  const connection = new Connection(
    process.env.RPC_URL || "https://api.devnet.solana.com",
    "confirmed",
  );
  console.log("client:", client.publicKey.toBase58());
  console.log("agent :", agent.publicKey.toBase58());

  // --- test mint + ATAs ---
  const mint = await createMint(connection, client, client.publicKey, null, 6);
  const clientAta = await createAssociatedTokenAccount(
    connection, client, mint, client.publicKey,
  );
  const agentAta = await createAssociatedTokenAccount(
    connection, client, mint, agent.publicKey,
  );
  await mintTo(
    connection, client, mint, clientAta, client,
    Number(PRICE_MICRO + REFUND_MICRO),
  );
  console.log("mint  :", mint.toBase58(), "(client funded 15 USDC)");

  // =========================================================================
  // Escrow happy path: create -> accept -> complete -> release
  // =========================================================================
  const nonce1 = Uint8Array.from(randomBytes(8));
  const [job1] = findJobPda(client.publicKey, nonce1);
  const [vault1] = findEscrowVaultPda(client.publicKey, nonce1);

  let sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      buildCreateJobIx(agent.publicKey, nonce1, PRICE_MICRO, client.publicKey, clientAta, mint),
    ),
    [client],
  );
  const vaultBal = (await getAccount(connection, vault1)).amount;
  if (vaultBal !== PRICE_MICRO) throw new Error(`vault holds ${vaultBal}, expected ${PRICE_MICRO}`);
  console.log("create_job: OK", sig, `(vault = ${vaultBal})`);

  sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(buildAcceptJobIx(job1, agent.publicKey)),
    [client, agent], // client = fee payer (tx built with client first)
  );
  console.log("accept_job: OK", sig);

  sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(buildCompleteJobIx(job1, agent.publicKey)),
    [client, agent],
  );
  console.log("complete_job: OK", sig);

  sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      buildReleasePaymentIx(job1, vault1, agentAta, client.publicKey),
    ),
    [client],
  );
  const agentBal = (await getAccount(connection, agentAta)).amount;
  if (agentBal !== PRICE_MICRO) throw new Error(`agent got ${agentBal}, expected ${PRICE_MICRO}`);
  const job1State = (await fetchJob(connection, job1))?.state;
  if (job1State !== JobState.Released) throw new Error(`job1 state ${job1State}, expected Released`);
  console.log("release_payment: OK", sig, `(agent = ${agentBal})`);

  sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(buildCloseJobIx(job1, client.publicKey)),
    [client],
  );
  if (await connection.getAccountInfo(job1)) throw new Error("job1 still exists after close");
  console.log("close_job: OK", sig, "(rent reclaimed)");

  // =========================================================================
  // Security fix verification: cancel_job with an ATA NOT owned by the
  // job's client must be rejected (ClientAtaMismatch).
  // =========================================================================
  const nonce2 = Uint8Array.from(randomBytes(8));
  const [job2] = findJobPda(client.publicKey, nonce2);
  const [vault2] = findEscrowVaultPda(client.publicKey, nonce2);

  sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      buildCreateJobIx(agent.publicKey, nonce2, REFUND_MICRO, client.publicKey, clientAta, mint),
    ),
    [client],
  );
  console.log("create_job #2: OK", sig);

  let rejected = false;
  try {
    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(
        // attacker-style call: refund destination = agent's ATA
        buildCancelJobIx(job2, vault2, agentAta, client.publicKey),
      ),
      [client],
    );
  } catch (e: any) {
    rejected = true;
    const msg = String(e?.transactionLogs ?? e?.logs ?? e);
    console.log("cancel_job with wrong ATA: REJECTED as expected ✔");
    if (!/ClientAtaMismatch|custom program error/i.test(msg)) {
      console.log("  (note: rejection reason not parsed, raw error follows)");
      console.log(" ", String(e).slice(0, 200));
    }
  }
  if (!rejected) throw new Error("SECURITY FAIL: cancel_job accepted a non-client ATA");

  sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      buildCancelJobIx(job2, vault2, clientAta, client.publicKey),
    ),
    [client],
  );
  const clientBal = (await getAccount(connection, clientAta)).amount;
  if (clientBal !== REFUND_MICRO) throw new Error(`client refund ${clientBal}, expected ${REFUND_MICRO}`);
  const job2State = (await fetchJob(connection, job2))?.state;
  if (job2State !== JobState.Refunded) throw new Error(`job2 state ${job2State}, expected Refunded`);
  console.log("cancel_job (proper): OK", sig, `(client refunded ${clientBal})`);

  // =========================================================================
  // Msg: send encrypted -> fetch + decrypt -> close
  // =========================================================================
  const msgNonce = Uint8Array.from(randomBytes(8));
  const passphrase = "devnet-e2e-shared-secret";
  const body = await encryptMsgBody("hello from devnet e2e", passphrase);
  const [msgPda] = findMsgPda(client.publicKey, agent.publicKey, msgNonce);

  sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      buildSendMsgIx(agent.publicKey, msgNonce, Buffer.from(body, "base64"), {
        sender: client.publicKey,
      }),
    ),
    [client],
  );
  console.log("msg send: OK", sig);

  const msgInfo = await connection.getAccountInfo(msgPda);
  if (!msgInfo) throw new Error("msg PDA missing");
  const parsed = parseMessageAccount(msgInfo.data);
  if (!parsed) throw new Error("msg account failed to parse");
  const plain = await decryptMsgBody(parsed.bodyBase64, passphrase);
  if (plain !== "hello from devnet e2e") throw new Error(`decrypt mismatch: ${plain}`);
  console.log("msg fetch + decrypt: OK ('" + plain + "')");

  sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(buildCloseMsgIx(msgPda, agent.publicKey)),
    [client, agent], // recipient signs, client pays the fee
  );
  if (await connection.getAccountInfo(msgPda)) throw new Error("msg PDA still exists after close");
  console.log("msg close: OK", sig);

  console.log("\n=== AGENT (ESCROW + MSG) DEVNET E2E PASSED ===");
}

main().catch((e) => {
  console.error("E2E FAILED:", e);
  process.exit(1);
});
