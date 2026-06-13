// =============================================================================
// index.ts — qietr-indexer RPC poller.
//
// A drop-in replacement for the geyser plugin that needs only a standard
// Solana RPC endpoint (no validator, no .so). Each tick it:
//
//   1. Reads all program accounts (Denomination, MerkleTree, NullifierRecord)
//      and upserts denominations + roots + nullifiers from current state.
//   2. Walks new deposit transactions since the last checkpoint, oldest-first,
//      and inserts each commitment with a monotonically increasing leaf_index.
//   3. Advances the ingest_progress checkpoint (slot + last signature).
//
// The DB rows it writes are identical to writer.rs, so the existing indexer
// API serves merkle proofs unchanged. See geyser-plugin/README.md for the
// account/ix mapping this mirrors.
// =============================================================================

import { loadConfig, type PollerConfig } from "./config.js";
import { Db } from "./db.js";
import { Rpc } from "./rpc.js";
import {
  accountKind,
  decodeDenomination,
  decodeMerkleTree,
  decodeNullifierRecord,
  parseDepositIx,
  parseWithdrawIx,
} from "./decode.js";
import { PublicKey } from "@solana/web3.js";

async function syncAccountState(
  rpc: Rpc,
  db: Db,
): Promise<{ denoms: number; roots: number; nullifiers: number }> {
  const accounts = await rpc.getAllProgramAccounts();

  // getProgramAccounts returns accounts in arbitrary order, but roots,
  // nullifiers, and commitments all FK to denominations(denom_id). Bucket by
  // kind and write denominations FIRST so the FK parent always exists before
  // its children — otherwise a NullifierRecord seen before its Denomination
  // fails with a foreign_key_violation.
  const denomAccts: typeof accounts = [];
  const treeAccts: typeof accounts = [];
  const nullifierAccts: typeof accounts = [];
  for (const acc of accounts) {
    const kind = accountKind(acc.data);
    if (kind === "Denomination") denomAccts.push(acc);
    else if (kind === "MerkleTree") treeAccts.push(acc);
    else if (kind === "NullifierRecord") nullifierAccts.push(acc);
  }

  let denoms = 0;
  let roots = 0;
  let nullifiers = 0;

  for (const acc of denomAccts) {
    const d = decodeDenomination(acc.data);
    if (!d) continue;
    await db.upsertDenomination({
      denomId: d.denomId,
      amountMicroUsdc: d.amountMicroUsdc,
      depositCount: d.depositCount,
      vaultAddress: new PublicKey(d.vault).toBase58(),
      lastSeenSlot: acc.slot,
    });
    denoms++;
  }

  for (const acc of treeAccts) {
    const t = decodeMerkleTree(acc.data);
    if (!t) continue;
    if (t.latestRoot) {
      await db.upsertRoot({
        denomId: t.denomId,
        leafCount: t.nextLeafIndex,
        rootBe: t.latestRoot,
        insertedSlot: acc.slot,
      });
      roots++;
    } else {
      console.warn(
        `MerkleTree denom ${t.denomId} root_cursor ${t.rootCursor} out of range; skipping root`,
      );
    }
  }

  for (const acc of nullifierAccts) {
    const n = decodeNullifierRecord(acc.data);
    if (!n) continue;
    await db.insertNullifier({
      denomId: n.denomId,
      nullifierHashBe: n.nullifierHash,
      spentAtSlot: Number(n.spentAtSlot),
    });
    nullifiers++;
  }

  return { denoms, roots, nullifiers };
}

async function syncCommitments(
  rpc: Rpc,
  db: Db,
  cfg: PollerConfig,
): Promise<{ commitments: number; newCheckpoint: string | null; maxSlot: number }> {
  const checkpoint = await db.getCheckpoint(cfg.component);
  const since = checkpoint?.lastSignature ?? null;

  const sigs = await rpc.getNewSignatures(since);
  if (sigs.length === 0) {
    return { commitments: 0, newCheckpoint: null, maxSlot: checkpoint?.lastSlot ?? 0 };
  }

  // Per-denom next leaf index, seeded from what's already in Postgres so a
  // restart resumes the counter instead of restarting at 0.
  const nextLeaf = new Map<number, number>();
  const leafFor = async (denomId: number): Promise<number> => {
    if (!nextLeaf.has(denomId)) {
      nextLeaf.set(denomId, (await db.maxLeafIndex(denomId)) + 1);
    }
    const idx = nextLeaf.get(denomId)!;
    nextLeaf.set(denomId, idx + 1);
    return idx;
  };

  let commitments = 0;
  let lastSig: string | null = since;
  let maxSlot = checkpoint?.lastSlot ?? 0;

  // Oldest-first: leaf_index must increment in chain-append order. BOTH a
  // deposit AND a withdraw append a leaf — deposit's commitment, withdraw's
  // change commitment (public_signals[5]). We replay them interleaved in the
  // exact tx/ix order the chain saw, so the reconstructed tree matches.
  // Insert one appended leaf (deposit commitment or withdraw change
  // commitment) at the next per-denom index — unless we've already indexed
  // that exact commitment value, in which case skip without consuming an
  // index (idempotent re-scan).
  const appendLeaf = async (
    denomId: number,
    commitmentBe: Buffer,
    slot: number,
  ): Promise<boolean> => {
    if (await db.commitmentExists(denomId, commitmentBe)) return false;
    await db.insertCommitment({
      denomId,
      leafIndex: await leafFor(denomId),
      commitmentBe,
      insertedSlot: slot,
    });
    return true;
  };

  for (const sig of sigs) {
    const ixs = await rpc.getPoolIxs(sig);
    for (const ix of ixs) {
      const dep = parseDepositIx(ix.ixData);
      if (dep) {
        if (await appendLeaf(dep.denomId, dep.commitment, ix.slot)) commitments++;
        continue;
      }
      const wd = parseWithdrawIx(ix.ixData);
      if (wd) {
        if (await appendLeaf(wd.denomId, wd.changeCommitment, ix.slot)) commitments++;
      }
    }
    lastSig = sig.signature;
    if (sig.slot > maxSlot) maxSlot = sig.slot;

    // Checkpoint after every signature so a crash mid-batch resumes cleanly
    // rather than re-scanning (and the leaf counter re-seeds from Postgres).
    await db.checkpoint({
      component: cfg.component,
      lastSlot: sig.slot,
      lastSignature: sig.signature,
    });
  }

  return { commitments, newCheckpoint: lastSig, maxSlot };
}

async function tick(rpc: Rpc, db: Db, cfg: PollerConfig): Promise<void> {
  const accountStats = await syncAccountState(rpc, db);
  const depositStats = await syncCommitments(rpc, db, cfg);

  if (
    accountStats.denoms ||
    accountStats.roots ||
    accountStats.nullifiers ||
    depositStats.commitments
  ) {
    console.log(
      `[poll] denoms=${accountStats.denoms} roots=${accountStats.roots} ` +
        `nullifiers=${accountStats.nullifiers} commitments=+${depositStats.commitments} ` +
        `slot=${depositStats.maxSlot}`,
    );
  }
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  console.log(
    `qietr-indexer poller starting: program=${cfg.programId} ` +
      `component=${cfg.component} interval=${cfg.intervalMs}ms`,
  );

  const db = new Db(cfg.databaseUrl);
  await db.ping();
  console.log("postgres connection ok");

  const rpc = new Rpc(cfg.rpcUrl, cfg.programId);

  let stopping = false;
  const shutdown = async (sig: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`\n${sig} received, shutting down...`);
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  // Run forever; never let a transient RPC/DB error kill the loop.
  for (;;) {
    if (stopping) break;
    try {
      await tick(rpc, db, cfg);
    } catch (err) {
      console.error("[poll] tick failed (will retry):", (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, cfg.intervalMs));
  }
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
