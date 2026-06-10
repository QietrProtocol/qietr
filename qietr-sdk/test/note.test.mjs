// note encryption round-trip
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  emptyNote,
  encryptNote,
  decryptNote,
  ENCRYPTED_MAGIC,
  DecryptError,
} from "../dist/index.js";

describe("note encryption", () => {
  it("round-trips an empty note", async () => {
    const note = emptyNote();
    const enc = await encryptNote(note, "correct horse battery staple");
    assert.ok(enc.startsWith(ENCRYPTED_MAGIC));
    const dec = await decryptNote(enc, "correct horse battery staple");
    assert.equal(dec.version, "qietr.v1");
    assert.equal(dec.commitments.length, 0);
  });

  it("round-trips a note with commitments", async () => {
    const note = {
      version: "qietr.v1",
      commitments: [
        {
          secret: "111111111111",
          nullifier: "222222222222",
          amount: 10_000_000,
          denomId: 2,
        },
      ],
    };
    const enc = await encryptNote(note, "passphrase-A");
    const dec = await decryptNote(enc, "passphrase-A");
    assert.deepEqual(dec, note);
  });

  it("rejects a wrong passphrase", async () => {
    const note = emptyNote();
    const enc = await encryptNote(note, "right");
    await assert.rejects(decryptNote(enc, "wrong"), DecryptError);
  });

  it("rejects a corrupted ciphertext", async () => {
    const note = emptyNote();
    let enc = await encryptNote(note, "x");
    // flip a byte in the base64 region
    enc = enc.slice(0, -10) + "AAAAAAAAAA";
    await assert.rejects(decryptNote(enc, "x"), DecryptError);
  });

  it("rejects missing magic", async () => {
    await assert.rejects(decryptNote("not-a-qietr-blob", "x"), DecryptError);
  });
});
