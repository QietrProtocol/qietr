// =============================================================================
// ssl.ts — decide the `pg` SSL option from the connection string + env.
//
// Local Postgres (docker, `localhost`) speaks plaintext — TLS there fails the
// handshake. Managed Postgres (Neon, Supabase, RDS) requires TLS and signals
// it via `sslmode=require` (or `?ssl=true`) in the URL. We turn TLS on whenever
// the URL asks for it, or when PGSSL=require is set explicitly.
//
// `rejectUnauthorized: false` is intentional for devnet: Neon/Supabase present
// certs from a CA that isn't in Node's default bundle on every host, and we are
// only reading PUBLIC on-chain data — there is no secret in this DB to protect
// with strict cert pinning. For a hardened deployment, set PGSSL_CA to a CA
// bundle path and we verify against it instead.
// =============================================================================

import fs from "node:fs";
import type { ConnectionOptions } from "node:tls";

export function resolveSsl(
  connectionString: string,
): boolean | ConnectionOptions {
  const url = connectionString.toLowerCase();
  const envMode = (process.env.PGSSL ?? "").toLowerCase();

  const wantsTls =
    envMode === "require" ||
    envMode === "true" ||
    url.includes("sslmode=require") ||
    url.includes("sslmode=verify") ||
    url.includes("ssl=true");

  // Explicit opt-out (local docker Postgres).
  if (envMode === "disable" || envMode === "false") return false;
  if (!wantsTls) return false;

  const caPath = process.env.PGSSL_CA;
  if (caPath) {
    return { ca: fs.readFileSync(caPath, "utf8"), rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}
