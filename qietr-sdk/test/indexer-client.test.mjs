// indexer-client.ts — verify the SDK speaks the routes the indexer serves.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { IndexerClient, IndexerError } from "../dist/index.js";

function mockFetchFactory(handlers) {
  return async (url, _init) => {
    const u = new URL(url);
    const fn = handlers[u.pathname];
    if (!fn) {
      return new Response("not_found", { status: 404 });
    }
    return fn(u);
  };
}

describe("IndexerClient.denominations", () => {
  it("parses the response body", async () => {
    const fetchImpl = mockFetchFactory({
      "/denominations": () =>
        new Response(
          JSON.stringify({
            denominations: [
              {
                denomId: 0,
                amountMicroUsdc: "100000",
                depositCount: "42",
                vaultAddress: "vault1",
                lastSeenSlot: "12345",
                currentRoot: "0x" + "ab".repeat(32),
                leafCount: "42",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    });
    const client = new IndexerClient("https://test.example.com/", fetchImpl);
    const out = await client.denominations();
    assert.equal(out.length, 1);
    assert.equal(out[0].denomId, 0);
    assert.equal(out[0].depositCount, "42");
  });

  it("strips trailing slash from base url", async () => {
    let calledPath;
    const fetchImpl = async (url) => {
      calledPath = new URL(url).pathname;
      return new Response('{"denominations":[]}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = new IndexerClient("https://test.example.com////", fetchImpl);
    await client.denominations();
    assert.equal(calledPath, "/denominations");
  });
});

describe("IndexerClient.merkleProof", () => {
  it("encodes denomId + commitment as querystring", async () => {
    let calledUrl;
    const fetchImpl = async (url) => {
      calledUrl = url;
      return new Response(
        JSON.stringify({
          denomId: 0,
          leafIndex: 7,
          leafCount: 8,
          root: "0xdead",
          pathElements: ["0x01"],
          pathIndices: [0],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = new IndexerClient("https://x.com", fetchImpl);
    const out = await client.merkleProof(2, "0xcafe");
    const u = new URL(calledUrl);
    assert.equal(u.searchParams.get("denomId"), "2");
    assert.equal(u.searchParams.get("commitment"), "0xcafe");
    assert.equal(out.leafIndex, 7);
  });
});

describe("IndexerClient.nullifierStatus", () => {
  it("maps spent/unspent payload", async () => {
    let path;
    const fetchImpl = async (url) => {
      path = new URL(url).pathname + new URL(url).search;
      return new Response(JSON.stringify({ spent: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = new IndexerClient("https://x.com", fetchImpl);
    const out = await client.nullifierStatus(0, "0xab");
    assert.match(path, /\/nullifier-status\?/);
    assert.equal(out.spent, false);
  });

  it("throws IndexerError on non-2xx", async () => {
    const fetchImpl = async () =>
      new Response("boom", { status: 500 });
    const client = new IndexerClient("https://x.com", fetchImpl);
    await assert.rejects(
      () => client.nullifierStatus(0, "0xab"),
      IndexerError,
    );
  });
});
