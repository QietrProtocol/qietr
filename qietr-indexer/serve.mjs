// =============================================================================
// serve.mjs — single-container supervisor for Koyeb (and any one-service host).
//
// Koyeb's free tier is one service, so we run BOTH the indexer API (HTTP, what
// Koyeb health-checks on $PORT) and the poller (background loop draining chain
// state into Postgres) in the same container. If either child exits, we tear
// the other down and exit non-zero so the platform restarts the whole service.
// =============================================================================

import { spawn } from "node:child_process";

const procs = [
  { name: "api", entry: "api/dist/index.js" },
  { name: "poller", entry: "poller/dist/index.js" },
];

let shuttingDown = false;

const children = procs.map(({ name, entry }) => {
  const child = spawn("node", [entry], { stdio: "inherit", env: process.env });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(
      `[supervisor] ${name} exited (code=${code} signal=${signal}); stopping service`,
    );
    for (const other of children) {
      try {
        other.kill("SIGTERM");
      } catch {
        /* already gone */
      }
    }
    process.exit(code ?? 1);
  });
  return child;
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    shuttingDown = true;
    for (const child of children) {
      try {
        child.kill(sig);
      } catch {
        /* already gone */
      }
    }
    process.exit(0);
  });
}
