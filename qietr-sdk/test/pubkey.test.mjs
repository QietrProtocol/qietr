// pubkey.ts unit tests — must match on-chain `pubkey_to_field` byte for byte.
// On-chain reference: qietr-pool/programs/qietr_pool/src/lib.rs:251-255.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { pubkeyToField, pubkeyToFieldString } from "../dist/index.js";

describe("pubkeyToField", () => {
  it("clears the top 3 bits of byte 0 and leaves byte 1..31 untouched", () => {
    const input = new Uint8Array(32);
    input[0] = 0xff;
    for (let i = 1; i < 32; i++) input[i] = i;
    const out = pubkeyToField(input);
    assert.equal(out[0], 0x1f, "top 3 bits must be cleared");
    for (let i = 1; i < 32; i++) {
      assert.equal(out[i], i, `byte ${i} must be untouched`);
    }
  });

  it("masks an all-zero pubkey to all zero", () => {
    const out = pubkeyToField(new Uint8Array(32));
    for (const b of out) assert.equal(b, 0);
  });

  it("matches hand-computed values for a few top-byte cases", () => {
    // 0xE3 = 1110_0011, & 0x1f = 0000_0011 = 0x03
    // 0xA5 = 1010_0101, & 0x1f = 0000_0101 = 0x05
    // 0x20 = 0010_0000, & 0x1f = 0000_0000 = 0x00
    // 0x1f = 0001_1111, & 0x1f = 0001_1111 = 0x1f (unchanged — already < 2^5)
    const cases = [
      [0xe3, 0x03],
      [0xa5, 0x05],
      [0x20, 0x00],
      [0x1f, 0x1f],
      [0x00, 0x00],
    ];
    for (const [input, expected] of cases) {
      const buf = new Uint8Array(32);
      buf[0] = input;
      const out = pubkeyToField(buf);
      assert.equal(out[0], expected, `0x${input.toString(16)} -> 0x${expected.toString(16)}`);
    }
  });

  it("does not mutate the input buffer", () => {
    const input = new Uint8Array(32);
    input[0] = 0xff;
    input[5] = 0x42;
    const snapshot = new Uint8Array(input);
    pubkeyToField(input);
    assert.deepEqual(input, snapshot, "input must not be mutated");
  });

  it("accepts a {toBytes()} object (e.g. PublicKey)", () => {
    const raw = new Uint8Array(32);
    raw[0] = 0xff;
    raw[31] = 0x11;
    const pkLike = { toBytes: () => raw };
    const out = pubkeyToField(pkLike);
    assert.equal(out[0], 0x1f);
    assert.equal(out[31], 0x11);
  });

  it("rejects pubkeys that are not 32 bytes", () => {
    assert.throws(() => pubkeyToField(new Uint8Array(31)), /32-byte pubkey/);
    assert.throws(() => pubkeyToField(new Uint8Array(33)), /32-byte pubkey/);
  });

  it("returns a value < BN254 scalar modulus p for every possible top byte", () => {
    // p = 21888242871839275222246405745257275088548364400416034343698204186575808495617
    // Worst case after masking: byte 0 = 0x1f, rest = 0xff
    //   = 0x1fffffff...ffff (253 bits all set, except top 3) = 2^253 - 1
    // Since p ≈ 2^254 > 2^253, every masked value is < p.
    const worst = new Uint8Array(32).fill(0xff);
    const out = pubkeyToField(worst);
    assert.equal(out[0], 0x1f);
    // Reconstruct BigInt and compare.
    let n = 0n;
    for (const b of out) n = (n << 8n) | BigInt(b);
    const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    assert.ok(n < P, "masked value must be < BN254 scalar p");
    assert.equal(n, (1n << 253n) - 1n);
  });
});

describe("pubkeyToFieldString", () => {
  it("returns the BigInt decimal of the masked bytes", () => {
    const input = new Uint8Array(32);
    input[31] = 0x2a; // = 42
    const s = pubkeyToFieldString(input);
    assert.equal(s, "42");
  });

  it("agrees with pubkeyToField for a random-shaped input", () => {
    const input = new Uint8Array(32);
    input[0] = 0xab;
    input[1] = 0xcd;
    input[31] = 0xef;
    const bytes = pubkeyToField(input);
    let n = 0n;
    for (const b of bytes) n = (n << 8n) | BigInt(b);
    assert.equal(pubkeyToFieldString(input), n.toString());
  });
});
