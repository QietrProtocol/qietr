// One-shot script: emit Poseidon-2 / Poseidon-3 golden vectors via
// circomlibjs. The output is consumed by the pool's parity test
// (qietr-pool/programs/qietr_pool/src/merkle.rs) to confirm
// light-poseidon produces byte-identical results.
//
// Run: node scripts/poseidon-vectors.mjs
import { buildPoseidon } from "circomlibjs";

const poseidon = await buildPoseidon();
const F = poseidon.F;

function be32(big) {
  let hex = big.toString(16).padStart(64, "0");
  return hex;
}

const cases2 = [
  [0n, 0n],
  [1n, 2n],
  [0xabcdn, 0xef01n],
  [(1n << 250n) - 1n, (1n << 200n) + 7n],
];

const cases3 = [
  [0n, 0n, 0n],
  [1n, 2n, 3n],
  [0xdeadbeefn, 0xfeedfacen, 1_000_000n],
  [(1n << 250n) - 1n, (1n << 200n) + 7n, 42n],
];

console.log("// Poseidon-2 (circomlibjs)");
for (const args of cases2) {
  const out = F.toObject(poseidon(args));
  console.log(`// in: ${args.map((a) => "0x" + a.toString(16)).join(", ")}`);
  console.log(`//   = 0x${be32(out)}`);
}
console.log("// Poseidon-3 (circomlibjs)");
for (const args of cases3) {
  const out = F.toObject(poseidon(args));
  console.log(`// in: ${args.map((a) => "0x" + a.toString(16)).join(", ")}`);
  console.log(`//   = 0x${be32(out)}`);
}
