// =============================================================================
// prover.ts — witness construction and Groth16 proof generation.
//
// TRD sections 2 (primitives) and 4 (circuit).
//
// Witness inputs match qietr-circuits/circuits/qietr_payment.circom and use
// circomlibjs Poseidon, which is byte-equivalent to circomlib's in-circuit
// Poseidon and to light-poseidon on the chain side. (Verified by the
// qietr-circuits test suite.)
//
// snarkjs.groth16.fullProve returns { proof, publicSignals } where `proof`
// is a JSON shape; we pack it into the 256-byte layout the on-chain
// verifier expects: proof.a (G1, 64) || proof.b (G2, 128) || proof.c (G1, 64).
// =============================================================================

import { buildPoseidon } from "circomlibjs";
import * as snarkjs from "snarkjs";
import type { Commitment } from "./types.js";

export interface MerkleProof {
  pathElements: string[];
  pathIndices: number[];
  root: string;
}

export interface WitnessInputs {
  // private
  secret: string;
  nullifier: string;
  amount: string;
  newSecret: string;
  newNullifier: string;
  pathElements: string[];
  pathIndices: string[];
  // public
  root: string;
  nullifierHash: string;
  recipient: string;
  paymentAmount: string;
  changeCommitment: string;
}

export interface Groth16Proof {
  /** 256-byte packed proof for the on-chain verifier. */
  proofBytes: Uint8Array;
  /**
   * Public signals as 32-byte BE field elements in the verifier's expected
   * order: [amount, root, nullifierHash, recipient, paymentAmount, changeCommitment].
   *
   * NOTE: snarkjs orders public signals by signal-input *declaration* order
   * in the main template (filtered to those listed in `public [...]`), NOT
   * by the order of the `public [...]` directive itself. In
   * qietr_payment.circom the declaration order is `amount` (declared first
   * because it's also a private operand), then root, nullifierHash,
   * recipient, paymentAmount, changeCommitment. The on-chain program reads
   * indices in this same order — keep them in sync if you reorder signal
   * declarations in the circuit.
   */
  publicSignals: Uint8Array[];
}

let cachedPoseidon: Awaited<ReturnType<typeof buildPoseidon>> | null = null;
async function getPoseidon(): Promise<Awaited<ReturnType<typeof buildPoseidon>>> {
  if (!cachedPoseidon) cachedPoseidon = await buildPoseidon();
  return cachedPoseidon;
}

function randomFieldString(): string {
  const bytes = new Uint8Array(31);
  (globalThis.crypto as Crypto).getRandomValues(bytes);
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return BigInt(hex).toString();
}

function decStringToBE32(dec: string): Uint8Array {
  let hex = BigInt(dec).toString(16).padStart(64, "0");
  if (hex.length > 64) hex = hex.slice(-64); // shouldn't happen for BN254 fr
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Build the spend witness inputs for a single commitment and a chosen
 * payment amount + recipient.
 *
 * IMPORTANT: `recipient` is the BN254 field-element representation of the
 * destination ATA's owner pubkey — the same value the on-chain
 * `pubkey_to_field` helper produces (top 3 bits of byte 0 cleared). Pass
 * the decimal-string form of that field element, which `pubkeyToFieldString`
 * from `./pubkey` produces. If you pass a raw 32-byte pubkey here, the
 * on-chain verifier will reject the withdraw with `RecipientMismatch`.
 */
export async function buildWitness(
  commitment: Commitment,
  merkleProof: MerkleProof,
  recipient: string,
  paymentAmount: bigint,
): Promise<WitnessInputs> {
  const poseidon = await getPoseidon();
  const F = poseidon.F as { toObject: (x: unknown) => bigint };

  const secret = BigInt(commitment.secret);
  const nullifier = BigInt(commitment.nullifier);
  const amount = BigInt(commitment.amount);

  const newSecret = BigInt(randomFieldString());
  const newNullifier = BigInt(randomFieldString());

  const nullifierHash = F.toObject(poseidon([nullifier]));
  const change = amount - paymentAmount;
  const changeCommitment = F.toObject(
    poseidon([newSecret, newNullifier, change]),
  );

  return {
    secret: secret.toString(),
    nullifier: nullifier.toString(),
    amount: amount.toString(),
    newSecret: newSecret.toString(),
    newNullifier: newNullifier.toString(),
    pathElements: merkleProof.pathElements,
    pathIndices: merkleProof.pathIndices.map((x) => x.toString()),
    root: merkleProof.root,
    nullifierHash: nullifierHash.toString(),
    recipient,
    paymentAmount: paymentAmount.toString(),
    changeCommitment: changeCommitment.toString(),
  };
}

/**
 * BN254 base-field modulus (q). For the affine y-coordinate, the additive
 * inverse is `q - y`.
 */
const BN254_Q =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n;

function negateG1(triple: string[]): string[] {
  const x = triple[0]!;
  const y = BigInt(triple[1]!);
  const yNeg = (BN254_Q - (y % BN254_Q)) % BN254_Q;
  return [x, yNeg.toString(), triple[2] ?? "1"];
}

/**
 * Run snarkjs Groth16 prover against the given wasm + zkey paths/buffers.
 * Returns proof and public signals in the on-chain packed format.
 *
 * In a browser, `wasm` and `zkey` can be URLs that snarkjs will fetch.
 * In Node, they should be filesystem paths.
 *
 * Pack layout (matches groth16-solana Groth16Verifier::new):
 *   proof.a:  G1 (64 bytes) — NEGATED (groth16-solana folds the negation
 *             into the pairing check, so callers must pre-negate pi_a)
 *   proof.b:  G2 (128 bytes, x1||x0||y1||y0 order)
 *   proof.c:  G1 (64 bytes)
 *
 * snarkjs returns these as decimal-string arrays in affine form; we
 * convert to BE bytes here.
 */
export async function proveGroth16(
  witness: WitnessInputs,
  wasm: string,
  zkey: string,
): Promise<Groth16Proof> {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    witness as unknown as Record<string, unknown>,
    wasm,
    zkey,
  );

  // proof.pi_a: [x, y, "1"]; proof.pi_c: [x, y, "1"]
  // proof.pi_b: [[x0, x1], [y0, y1], ["1", "0"]]
  const a = packG1(negateG1(proof.pi_a as string[]));
  const b = packG2(proof.pi_b as string[][]);
  const c = packG1(proof.pi_c as string[]);

  const proofBytes = new Uint8Array(64 + 128 + 64);
  proofBytes.set(a, 0);
  proofBytes.set(b, 64);
  proofBytes.set(c, 64 + 128);

  return {
    proofBytes,
    publicSignals: (publicSignals as string[]).map(decStringToBE32),
  };
}

function packG1(triple: string[]): Uint8Array {
  const x = decStringToBE32(triple[0]!);
  const y = decStringToBE32(triple[1]!);
  const out = new Uint8Array(64);
  out.set(x, 0);
  out.set(y, 32);
  return out;
}

function packG2(triple: string[][]): Uint8Array {
  const x0 = decStringToBE32(triple[0]![0]!);
  const x1 = decStringToBE32(triple[0]![1]!);
  const y0 = decStringToBE32(triple[1]![0]!);
  const y1 = decStringToBE32(triple[1]![1]!);
  // Solana syscall order: x1 || x0 || y1 || y0
  const out = new Uint8Array(128);
  out.set(x1, 0);
  out.set(x0, 32);
  out.set(y1, 64);
  out.set(y0, 96);
  return out;
}
