pragma circom 2.1.6;

// =============================================================================
// qietr_payment.circom
//
// Spend circuit for the Qietr shielded pool. One commitment is consumed;
// one change commitment is produced; `paymentAmount` USDC is released to an
// unshielded recipient (typically a freshly-generated burner pubkey).
//
// Source of truth: docs/02-TRD.md sections 2 (primitives) and 4 (circuit).
//
// Decisions in force (2026-06-08):
//   - Single parameterized circuit. `amount` is a PUBLIC input so the
//     on-chain verifier can bind it to Denomination.amount_micro_usdc.
//     (TRD §4.2 originally listed `amount` as private only; that left
//     the on-chain side with no way to tie a withdrawal to a tier. See
//     SESSION_STATE.md for the §4.2 amendment.)
//   - Merkle depth 20.
//   - Hash: Poseidon (circomlib). On-chain side must use the matching
//     parameterization in light-poseidon. This is verified by the test
//     suite via cross-implementation test vectors.
//   - Public signals (in order): nullifierHash, root, recipient,
//     paymentAmount, changeCommitment, amount.
// =============================================================================

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// -----------------------------------------------------------------------------
// HashLeftRight: Poseidon(2) over (left, right).
// -----------------------------------------------------------------------------
template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component h = Poseidon(2);
    h.inputs[0] <== left;
    h.inputs[1] <== right;
    hash <== h.out;
}

// -----------------------------------------------------------------------------
// DualMux: swap two inputs based on selector s in {0, 1}.
//   s = 0  ->  out = (in[0], in[1])
//   s = 1  ->  out = (in[1], in[0])
// Enforces s * (1 - s) = 0.
// -----------------------------------------------------------------------------
template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];

    s * (1 - s) === 0;

    out[0] <== (in[1] - in[0]) * s + in[0];
    out[1] <== (in[0] - in[1]) * s + in[1];
}

// -----------------------------------------------------------------------------
// MerkleTreeChecker: verifies `leaf` is at the position encoded by
// pathIndices in a tree with the given pathElements, computing to `root`.
// Binary tree, Poseidon-2 internal hash.
// -----------------------------------------------------------------------------
template MerkleTreeChecker(depth) {
    signal input leaf;
    signal input root;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    component selectors[depth];
    component hashers[depth];

    signal currentHash[depth + 1];
    currentHash[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        selectors[i] = DualMux();
        selectors[i].in[0] <== currentHash[i];
        selectors[i].in[1] <== pathElements[i];
        selectors[i].s <== pathIndices[i];

        hashers[i] = HashLeftRight();
        hashers[i].left  <== selectors[i].out[0];
        hashers[i].right <== selectors[i].out[1];

        currentHash[i + 1] <== hashers[i].hash;
    }

    root === currentHash[depth];
}

// -----------------------------------------------------------------------------
// QietrPayment(treeDepth)
//
// Constraint summary (TRD section 4.3):
//   1. commitment = Poseidon3(secret, nullifier, amount); leaf in tree at
//      pathIndices/pathElements computing to `root`.
//   2. nullifierHash = Poseidon1(nullifier).
//   3. paymentAmount > 0.
//   4. paymentAmount <= amount.
//   5. changeCommitment = Poseidon3(newSecret, newNullifier, amount - paymentAmount).
//   6. amount range-bound to 64 bits (fits in u64 micro-USDC). Tier binding
//      itself happens at the verifier; in-circuit we only assert the range.
//
// `recipient` is included as a public signal so the prover cannot retarget
// the withdrawal at submission time. A trivial multiplicative constraint
// binds it into the R1CS (Groth16 also commits to public inputs, but the
// constraint silences the unused-signal path and is cheap).
// -----------------------------------------------------------------------------
template QietrPayment(treeDepth) {
    // Private inputs (TRD section 4.1)
    signal input secret;
    signal input nullifier;
    signal input amount;

    signal input newSecret;
    signal input newNullifier;

    signal input pathElements[treeDepth];
    signal input pathIndices[treeDepth];

    // Public inputs (TRD section 4.2)
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input paymentAmount;
    signal input changeCommitment;

    // ----- 1. Commitment + Merkle inclusion ---------------------------------
    component commitmentHasher = Poseidon(3);
    commitmentHasher.inputs[0] <== secret;
    commitmentHasher.inputs[1] <== nullifier;
    commitmentHasher.inputs[2] <== amount;

    component tree = MerkleTreeChecker(treeDepth);
    tree.leaf <== commitmentHasher.out;
    tree.root <== root;
    for (var i = 0; i < treeDepth; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i]  <== pathIndices[i];
    }

    // ----- 2. nullifierHash = Poseidon1(nullifier) --------------------------
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHash === nullifierHasher.out;

    // ----- 6. amount in [0, 2^64) -------------------------------------------
    // (Range-check the source amount before any arithmetic uses it.)
    component amountBits = Num2Bits(64);
    amountBits.in <== amount;

    // ----- 3. paymentAmount > 0 ---------------------------------------------
    component paymentIsZero = IsZero();
    paymentIsZero.in <== paymentAmount;
    paymentIsZero.out === 0;

    // ----- 4. paymentAmount <= amount ---------------------------------------
    // Range-check paymentAmount to 64 bits so the LessEqThan comparator's
    // 64-bit width is sound (LessEqThan(n) requires both inputs in [0, 2^n)).
    component paymentBits = Num2Bits(64);
    paymentBits.in <== paymentAmount;

    component paymentLE = LessEqThan(64);
    paymentLE.in[0] <== paymentAmount;
    paymentLE.in[1] <== amount;
    paymentLE.out === 1;

    // ----- 5. changeCommitment = Poseidon3(newSecret, newNullifier, change) -
    signal change;
    change <== amount - paymentAmount;

    component changeHasher = Poseidon(3);
    changeHasher.inputs[0] <== newSecret;
    changeHasher.inputs[1] <== newNullifier;
    changeHasher.inputs[2] <== change;
    changeCommitment === changeHasher.out;

    // ----- Bind `recipient` into the R1CS -----------------------------------
    // Trivial constraint so the signal participates in the witness even
    // though no other constraint references it directly. The proof's
    // public-input commitment is what actually prevents retargeting.
    signal recipientBound;
    recipientBound <== recipient * recipient;
}

// Public-signal order must match the on-chain verifier exactly. `amount`
// is exposed so the on-chain verifier can bind it to the Denomination's
// configured tier value.
component main {
    public [nullifierHash, root, recipient, paymentAmount, changeCommitment, amount]
} = QietrPayment(20);
