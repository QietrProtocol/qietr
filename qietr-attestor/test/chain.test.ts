import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isCrossChain, getChainEid, chainFromEid, formatChainPair } from "../src/chain.js";

describe("chain utils", () => {
  it("isCrossChain returns true for different chains", () => {
    assert.equal(isCrossChain("solana", "base"), true);
  });

  it("isCrossChain returns false for same chain", () => {
    assert.equal(isCrossChain("solana", "solana"), false);
  });

  it("getChainEid returns expected values", () => {
    assert.equal(getChainEid("solana"), 1);
    assert.equal(getChainEid("ethereum"), 4);
  });

  it("chainFromEid round-trips", () => {
    assert.equal(chainFromEid(2), "base");
    assert.equal(chainFromEid(3), "polygon");
  });

  it("formatChainPair produces readable key", () => {
    assert.equal(formatChainPair("solana", "base"), "solana→base");
  });
});
