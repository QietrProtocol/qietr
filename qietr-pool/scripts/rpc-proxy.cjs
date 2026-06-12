// Local RPC proxy: forwards JSON-RPC to api.devnet.solana.com over IPv4 only,
// with per-request retry. Works around flaky NAT64/IPv6 on this network.
// Usage: node scripts/rpc-proxy.cjs   then   solana ... -u http://127.0.0.1:8899
const http = require("node:http");
const https = require("node:https");

const UPSTREAM = "api.devnet.solana.com";
const agent = new https.Agent({ keepAlive: true, family: 4, maxSockets: 16 });

function forward(body, attempt, res) {
  let responded = false;
  const upstream = https.request(
    {
      host: UPSTREAM,
      method: "POST",
      path: "/",
      agent,
      timeout: 60_000,
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) },
    },
    (ur) => {
      // Buffer the entire upstream response before replying, so a mid-stream
      // upstream failure can still be retried instead of corrupting the reply.
      const chunks = [];
      ur.on("data", (c) => chunks.push(c));
      ur.on("end", () => {
        if (responded) return;
        responded = true;
        res.writeHead(ur.statusCode || 200, { "content-type": "application/json" });
        res.end(Buffer.concat(chunks));
      });
      ur.on("error", () => fail(new Error("upstream response error")));
    },
  );
  const fail = (e) => {
    if (responded) return;
    responded = true;
    upstream.destroy();
    if (attempt < 4) {
      setTimeout(() => forward(body, attempt + 1, res), 500 * attempt);
    } else {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: String(e) }, id: null }));
    }
  };
  upstream.on("timeout", () => fail(new Error("upstream timeout")));
  upstream.on("error", fail);
  upstream.end(body);
}

process.on("uncaughtException", (e) => console.error("uncaught:", e.message));

const server = http.createServer((req, res) => {
  res.on("error", () => {});
  req.on("error", () => {});
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => forward(Buffer.concat(chunks), 1, res));
});
server.listen(8899, "127.0.0.1", () =>
  console.log("rpc-proxy listening on http://127.0.0.1:8899 -> " + UPSTREAM),
);

// WebSocket pass-through on 8900 -> wss://UPSTREAM (the CLI derives ws://host:8900
// from the RPC URL for pubsub). Raw byte piping after the TLS handshake; the
// HTTP Upgrade exchange itself is forwarded verbatim.
const tls = require("node:tls");
const wsServer = http.createServer();
wsServer.on("upgrade", (req, clientSock, head) => {
  clientSock.on("error", () => {});
  const upSock = tls.connect({ host: UPSTREAM, port: 443, servername: UPSTREAM, family: 4 }, () => {
    let raw = `${req.method} / HTTP/1.1\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const k = req.rawHeaders[i];
      const v = /^host$/i.test(k) ? UPSTREAM : req.rawHeaders[i + 1];
      raw += `${k}: ${v}\r\n`;
    }
    raw += "\r\n";
    upSock.write(raw);
    if (head?.length) upSock.write(head);
    clientSock.pipe(upSock).pipe(clientSock);
  });
  upSock.on("error", () => clientSock.destroy());
});
wsServer.listen(8900, "127.0.0.1", () =>
  console.log("ws-proxy listening on ws://127.0.0.1:8900 -> wss://" + UPSTREAM),
);
