import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { createServer } from "node:http";
import { Keypair } from "@solana/web3.js";

// ---------------------------------------------------------------------------
// 1. buildTransferIx
// ---------------------------------------------------------------------------

describe("buildTransferIx", () => {
  it("imports and produces a valid instruction", async () => {
    const { buildTransferIx, TOKEN_PROGRAM_ID } = await import("../dist/program.js");
    const src = Keypair.generate().publicKey;
    const dst = Keypair.generate().publicKey;
    const auth = Keypair.generate().publicKey;

    const ix = buildTransferIx(src, dst, auth, 50000n);
    assert.strictEqual(ix.programId.toBase58(), TOKEN_PROGRAM_ID.toBase58());
    assert.strictEqual(ix.keys.length, 3);
    assert.strictEqual(ix.keys[0].pubkey.toBase58(), src.toBase58());
    assert.strictEqual(ix.keys[1].pubkey.toBase58(), dst.toBase58());
    assert.strictEqual(ix.keys[2].pubkey.toBase58(), auth.toBase58());
    assert.strictEqual(ix.keys[2].isSigner, true);
    assert.strictEqual(ix.data[0], 3);

    // Amount at bytes 1-8 is Little Endian u64.
    const buf = Buffer.from(ix.data);
    assert.strictEqual(buf.readBigUint64LE(1), 50000n);
  });

  it("accepts number for amount", async () => {
    const { buildTransferIx } = await import("../dist/program.js");
    const src = Keypair.generate().publicKey;
    const dst = Keypair.generate().publicKey;
    const auth = Keypair.generate().publicKey;

    const ix = buildTransferIx(src, dst, auth, 1000);
    const buf = Buffer.from(ix.data);
    assert.strictEqual(buf.readBigUint64LE(1), 1000n);
  });
});

// ---------------------------------------------------------------------------
// 2. RelayerClient — integration with a local HTTP server
// ---------------------------------------------------------------------------

describe("RelayerClient", () => {
  let server;
  let baseUrl;
  let requests;

  before(async () => {
    requests = [];
    server = createServer((req, res) => {
      requests.push({ method: req.method, url: req.url });
      if (req.url === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, feePayer: "11111111111111111111111111111111" }));
      } else if (req.url === "/deposit-quote") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          feePayer: "relayer111111111111111111111111111111111111",
          feeAta: "feeAta1111111111111111111111111111111111111",
          feeAmountMicro: 50000,
          blockhash: "11111111111111111111111111111111",
          lastValidBlockHeight: 1000,
          feeBps: 50,
        }));
      } else if (req.url === "/submit-deposit" && req.method === "POST") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          const parsed = JSON.parse(body);
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ signature: "sig123" }));
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(() => {
    server?.close();
  });

  it("health() returns OK", async () => {
    const { RelayerClient } = await import("../dist/relayer-client.js");
    const client = new RelayerClient({ baseUrl });
    const result = await client.health();
    assert.strictEqual(result.ok, true);
    assert.strictEqual(typeof result.feePayer, "string");
  });

  it("quote() returns deposit fee info", async () => {
    const { RelayerClient } = await import("../dist/relayer-client.js");
    const client = new RelayerClient({ baseUrl });
    const quote = await client.quote();
    assert.strictEqual(typeof quote.feePayer, "string");
    assert.strictEqual(typeof quote.feeAta, "string");
    assert.strictEqual(quote.feeAmountMicro, 50000);
    assert.strictEqual(typeof quote.blockhash, "string");
    assert.strictEqual(quote.lastValidBlockHeight, 1000);
  });

  it("submitDeposit() returns signature", async () => {
    const { RelayerClient } = await import("../dist/relayer-client.js");
    const client = new RelayerClient({ baseUrl });
    const result = await client.submitDeposit("dGVzdA==");
    assert.strictEqual(result.signature, "sig123");
  });
});


