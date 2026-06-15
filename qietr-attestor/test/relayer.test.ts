import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { VaaRelayer } from "../src/relayer.js";

describe("VaaRelayer", () => {
  it("relayNullifier throws when wormhole RPC fails", async () => {
    mock.method(globalThis, "fetch", () =>
      Promise.resolve(new Response("not found", { status: 404 })),
    );

    const relayer = new VaaRelayer({
      wormholeRpcUrl: "http://localhost:7071",
      emitterAddress: "0000000000000000000000000000000000000000000000000000000000000001",
      targetChain: "base",
      maxBatchSize: 10,
    });

    await assert.rejects(
      () => relayer.relayNullifier("abcd1234", 0, "solana"),
      /VAA relay failed/,
    );
  });
});
