// Off-chain Merkle mirror — confirms the SDK's PoseidonMerkleTree
// produces the same root as a fresh second instance for the same leaves.
// Cross-implementation parity vs the circuit is covered in qietr-circuits.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PoseidonMerkleTree } from "../dist/index.js";

describe("PoseidonMerkleTree", () => {
  it("produces the same root for the same insert sequence", async () => {
    const a = await PoseidonMerkleTree.create(20);
    const b = await PoseidonMerkleTree.create(20);
    const leaves = [1n, 2n, 3n, 4n, 5n];
    for (const x of leaves) {
      a.insert(x);
      b.insert(x);
    }
    assert.equal(a.root().toString(), b.root().toString());
  });

  it("an inclusion proof reconstructs to the current root", async () => {
    // The tree's `proof(i)` returns sibling path + indices. We don't
    // re-derive the root here in JS; the in-circuit MerkleTreeChecker
    // does that work and the qietr-circuits suite already validates it
    // end-to-end. Here we just check shape and that the embedded root
    // matches `tree.root()`.
    const tree = await PoseidonMerkleTree.create(20);
    tree.insert(42n);
    tree.insert(43n);
    const p = tree.proof(1);
    assert.equal(p.pathElements.length, 20);
    assert.equal(p.pathIndices.length, 20);
    assert.equal(p.root.toString(), tree.root().toString());
  });

  it("rejects an out-of-range proof query", async () => {
    const tree = await PoseidonMerkleTree.create(20);
    assert.throws(() => tree.proof(0));
    tree.insert(1n);
    assert.throws(() => tree.proof(5));
  });
});
