// End-to-end SDK prover test: build a witness from a real commitment +
// Merkle proof, run Groth16, verify against the dev VK from qietr-circuits.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { buildPoseidon } from "circomlibjs";
import * as snarkjs from "snarkjs";

import {
  PoseidonMerkleTree,
  buildWitness,
  proveGroth16,
} from "../dist/index.js";

const CIRCUITS_ROOT = path.resolve(import.meta.dirname, "../../qietr-circuits");
const WASM = path.join(CIRCUITS_ROOT, "build", "qietr_payment_js", "qietr_payment.wasm");
const ZKEY = path.join(CIRCUITS_ROOT, "keys", "qietr_payment_dev.zkey");
const VKEY_JSON = path.join(CIRCUITS_ROOT, "keys", "qietr_payment_dev_vk.json");

const TIER = 10_000_000n;

// This is an end-to-end prover test that needs the compiled circuit + dev keys
// from qietr-circuits (gitignored build artifacts). They exist after running the
// circuit build locally, but not in a fresh CI checkout — skip cleanly there.
const ARTIFACTS_PRESENT = [WASM, ZKEY, VKEY_JSON].every((p) => fs.existsSync(p));

describe("sdk prover", { skip: ARTIFACTS_PRESENT ? false : "circuit artifacts not built" }, () => {
  it("builds a witness, proves, and verifies against the dev VK", async () => {
    const poseidon = await buildPoseidon();
    const F = poseidon.F;

    // Make a commitment and put it in the tree.
    const secret = 0x1234567890abcdefn;
    const nullifier = 0xfeedfacecafebeefn;
    const amount = TIER;
    const leaf = F.toObject(poseidon([secret, nullifier, amount]));

    const tree = await PoseidonMerkleTree.create(20);
    tree.insert(leaf);
    const inclusion = tree.proof(0);

    const commitment = {
      secret: secret.toString(),
      nullifier: nullifier.toString(),
      amount: Number(amount),
      denomId: 2,
    };

    const merkleProof = {
      root: inclusion.root.toString(),
      pathElements: inclusion.pathElements.map((x) => x.toString()),
      pathIndices: inclusion.pathIndices,
    };

    const recipient = "0xc0ffeebabe";
    const paymentAmount = 3_000_000n;

    const witness = await buildWitness(
      commitment,
      merkleProof,
      BigInt(recipient).toString(),
      paymentAmount,
    );

    const { proofBytes, publicSignals } = await proveGroth16(witness, WASM, ZKEY);

    assert.equal(proofBytes.length, 256);
    assert.equal(publicSignals.length, 6);
    for (const ps of publicSignals) assert.equal(ps.length, 32);

    // Cross-check by verifying with snarkjs in JSON form.
    // Convert our BE32 signals back to decimal strings.
    const psDec = publicSignals.map((u8) => {
      let n = 0n;
      for (const b of u8) n = (n << 8n) | BigInt(b);
      return n.toString();
    });

    // proveGroth16 pre-negates pi_a for groth16-solana; un-negate for
    // snarkjs verification (which uses standard Groth16 form).
    const BN254_Q =
      21888242871839275222246405745257275088696311157297823662689037894645226208583n;
    const piAyNeg = BigInt(beToDec(proofBytes.slice(32, 64)));
    const piAy = ((BN254_Q - (piAyNeg % BN254_Q)) % BN254_Q).toString();

    const proofJson = {
      pi_a: [
        beToDec(proofBytes.slice(0, 32)),
        piAy,
        "1",
      ],
      pi_b: [
        [beToDec(proofBytes.slice(64 + 32, 64 + 64)), beToDec(proofBytes.slice(64, 64 + 32))],
        [beToDec(proofBytes.slice(64 + 96, 64 + 128)), beToDec(proofBytes.slice(64 + 64, 64 + 96))],
        ["1", "0"],
      ],
      pi_c: [
        beToDec(proofBytes.slice(192, 224)),
        beToDec(proofBytes.slice(224, 256)),
        "1",
      ],
      protocol: "groth16",
      curve: "bn128",
    };

    const vk = JSON.parse(fs.readFileSync(VKEY_JSON, "utf8"));
    const verified = await snarkjs.groth16.verify(vk, psDec, proofJson);
    assert.equal(verified, true);

    // Release snarkjs worker pool so node:test can exit.
    if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
  });
});

function beToDec(u8) {
  let n = 0n;
  for (const b of u8) n = (n << 8n) | BigInt(b);
  return n.toString();
}
