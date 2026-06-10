// =============================================================================
// qietr_payment.test.js
//
// End-to-end tests for the spend circuit. Uses snarkjs against the pre-built
// wasm + dev zkey produced by `npm run compile` and `npm run setup:dev`.
//
// Coverage:
//   1. Happy path: full Groth16 prove + verify passes.
//   2. Wrong nullifierHash rejected at witness-generation time.
//   3. Zero paymentAmount rejected at witness-generation time.
//   4. Oversized paymentAmount (> tier amount) rejected at witness time.
//   5. Wrong Merkle root rejected at witness time.
//   6. Recipient retarget: a valid proof verified against a different
//      recipient public signal is rejected at verify time.
//
// Note: in-circuit tier binding is intentional. The circuit does not assert
// that `amount` equals a specific tier value; that binding happens at the
// on-chain verifier via the Denomination account. Here we use 10 USDC.
// =============================================================================

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const assert = require("node:assert/strict");
const { describe, it, before, after } = require("node:test");
const { buildPoseidon } = require("circomlibjs");
const snarkjs = require("snarkjs");

const ROOT = path.join(__dirname, "..");
const WASM_PATH = path.join(
  ROOT,
  "build",
  "qietr_payment_js",
  "qietr_payment.wasm",
);
const ZKEY_PATH = path.join(ROOT, "keys", "qietr_payment_dev.zkey");
const VKEY_PATH = path.join(ROOT, "keys", "qietr_payment_dev_vk.json");

const DEPTH = 20;
const TIER = 10_000_000n; // 10 USDC in micro-USDC

// -----------------------------------------------------------------------------
// PoseidonTree: minimal append-only depth-20 Merkle tree using Poseidon-2.
// Mirrors what qietr_pool's MerkleTree account computes on-chain.
// -----------------------------------------------------------------------------
class PoseidonTree {
  constructor(depth, poseidon) {
    this.depth = depth;
    this.poseidon = poseidon;
    this.F = poseidon.F;

    // zeros[i] = hash of two empty subtrees at level i. zeros[0] = 0.
    this.zeros = [0n];
    for (let i = 0; i < depth; i++) {
      const h = poseidon([this.zeros[i], this.zeros[i]]);
      this.zeros.push(this.F.toObject(h));
    }

    this.leaves = [];
  }

  insert(leaf) {
    this.leaves.push(BigInt(leaf));
  }

  root() {
    return this._walk();
  }

  proof(index) {
    return this._walk(index);
  }

  _walk(queryIndex) {
    let level = this.leaves.slice();
    const pathElements = [];
    const pathIndices = [];
    let idx = queryIndex !== undefined ? queryIndex : -1;

    for (let d = 0; d < this.depth; d++) {
      if (idx >= 0) {
        const isRight = idx & 1;
        pathIndices.push(isRight);
        const sibIdx = idx ^ 1;
        const sibling = sibIdx < level.length ? level[sibIdx] : this.zeros[d];
        pathElements.push(sibling);
        idx = idx >> 1;
      }

      const next = [];
      const half = Math.ceil(level.length / 2);
      for (let i = 0; i < half; i++) {
        const l = level[2 * i];
        const r = 2 * i + 1 < level.length ? level[2 * i + 1] : this.zeros[d];
        next.push(this.F.toObject(this.poseidon([l, r])));
      }
      level = next;
    }

    const root = level.length === 0 ? this.zeros[this.depth] : level[0];

    return queryIndex !== undefined
      ? { root, pathElements, pathIndices }
      : root;
  }
}

function randomFieldElement() {
  // 31 random bytes fits comfortably in BN254's scalar field.
  return BigInt("0x" + crypto.randomBytes(31).toString("hex"));
}

// Build a valid input set. Caller can override fields to produce
// adversarial cases.
async function buildValidInputs({ paymentAmount, recipient }) {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  const secret = randomFieldElement();
  const nullifier = randomFieldElement();
  const amount = TIER;
  const newSecret = randomFieldElement();
  const newNullifier = randomFieldElement();

  const commitment = F.toObject(poseidon([secret, nullifier, amount]));
  const nullifierHash = F.toObject(poseidon([nullifier]));
  const change = amount - paymentAmount;
  const changeCommitment = F.toObject(
    poseidon([newSecret, newNullifier, change]),
  );

  const tree = new PoseidonTree(DEPTH, poseidon);
  tree.insert(commitment);
  const { root, pathElements, pathIndices } = tree.proof(0);

  return {
    secret: secret.toString(),
    nullifier: nullifier.toString(),
    amount: amount.toString(),
    newSecret: newSecret.toString(),
    newNullifier: newNullifier.toString(),
    pathElements: pathElements.map((x) => x.toString()),
    pathIndices: pathIndices.map((x) => x.toString()),
    root: root.toString(),
    nullifierHash: nullifierHash.toString(),
    recipient: recipient.toString(),
    paymentAmount: paymentAmount.toString(),
    changeCommitment: changeCommitment.toString(),
  };
}

// Expect snarkjs.groth16.fullProve to fail. Used for cases where the
// circuit's constraints are violated by the inputs — witness generation
// throws before proof generation is reached, so the cost is just the
// witness step.
async function expectProveFail(input, label) {
  let threw = false;
  try {
    await snarkjs.groth16.fullProve(input, WASM_PATH, ZKEY_PATH);
  } catch (_e) {
    threw = true;
  }
  if (!threw) {
    throw new Error(`expected prove to be rejected for case: ${label}`);
  }
}

describe("qietr_payment", () => {
  let vKey;

  before(() => {
    vKey = JSON.parse(fs.readFileSync(VKEY_PATH, "utf8"));
  });

  it("happy path: valid witness + Groth16 verify passes", async () => {
    const input = await buildValidInputs({
      paymentAmount: 3_000_000n,
      recipient: 0xdeadbeefn,
    });

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      WASM_PATH,
      ZKEY_PATH,
    );

    assert.equal(publicSignals.length, 6);
    const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    assert.equal(verified, true);
  });

  it("rejects a wrong nullifierHash", async () => {
    const input = await buildValidInputs({
      paymentAmount: 1_000_000n,
      recipient: 0xc0ffeen,
    });
    input.nullifierHash = "12345";
    await expectProveFail(input, "wrong nullifierHash");
  });

  it("rejects zero paymentAmount", async () => {
    const input = await buildValidInputs({
      paymentAmount: 1n,
      recipient: 0xc0ffeen,
    });
    // Re-derive changeCommitment for paymentAmount = 0 so the ONLY constraint
    // that trips is `paymentAmount > 0`, not the changeCommitment match.
    const poseidon = await buildPoseidon();
    const F = poseidon.F;
    input.paymentAmount = "0";
    const cc = F.toObject(
      poseidon([
        BigInt(input.newSecret),
        BigInt(input.newNullifier),
        TIER,
      ]),
    );
    input.changeCommitment = cc.toString();
    await expectProveFail(input, "zero paymentAmount");
  });

  it("rejects paymentAmount > amount", async () => {
    const input = await buildValidInputs({
      paymentAmount: 1n,
      recipient: 0xc0ffeen,
    });
    const poseidon = await buildPoseidon();
    const F = poseidon.F;
    // paymentAmount = TIER + 1. change = TIER - (TIER+1) = -1 (underflows
    // in field). Re-derive changeCommitment with that field-element change
    // so the LessEqThan check is the one that fires.
    const newPayment = TIER + 1n;
    const fieldP = F.p;
    const changeFE = (TIER - newPayment + fieldP) % fieldP;
    const cc = F.toObject(
      poseidon([
        BigInt(input.newSecret),
        BigInt(input.newNullifier),
        changeFE,
      ]),
    );
    input.paymentAmount = newPayment.toString();
    input.changeCommitment = cc.toString();
    await expectProveFail(input, "paymentAmount > amount");
  });

  it("rejects a wrong Merkle root", async () => {
    const input = await buildValidInputs({
      paymentAmount: 2_000_000n,
      recipient: 0xfacen,
    });
    input.root = "1";
    await expectProveFail(input, "wrong root");
  });

  it("rejects recipient retargeting at verify time", async () => {
    const input = await buildValidInputs({
      paymentAmount: 5_000_000n,
      recipient: 0xa11cen,
    });

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      WASM_PATH,
      ZKEY_PATH,
    );

    // Public-signal order (declared in component main):
    //   [nullifierHash, root, recipient, paymentAmount, changeCommitment, amount]
    // Index 2 is the recipient.
    const tampered = publicSignals.slice();
    tampered[2] = "999999999";

    const verified = await snarkjs.groth16.verify(vKey, tampered, proof);
    assert.equal(verified, false);
  });

  after(async () => {
    // snarkjs holds an internal curve worker pool; release it so the
    // node:test runner can exit cleanly.
    if (typeof globalThis.curve_bn128 !== "undefined") {
      await globalThis.curve_bn128.terminate();
    }
  });
});
