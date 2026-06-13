// =============================================================================
// config.ts — poller configuration from environment.
// =============================================================================

export interface PollerConfig {
  rpcUrl: string;
  programId: string;
  databaseUrl: string;
  component: string;
  intervalMs: number;
}

const DEFAULT_PROGRAM_ID = "4XH6f74UFTvqx4j9UarXGrRZRrAwbnNNsRFBTfNqmWib";

export function loadConfig(): PollerConfig {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) {
    throw new Error(
      "SOLANA_RPC_URL not set (e.g. https://devnet.helius-rpc.com/?api-key=...)",
    );
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL not set");
  }
  return {
    rpcUrl,
    programId: process.env.PROGRAM_ID ?? DEFAULT_PROGRAM_ID,
    databaseUrl,
    // Distinct from the geyser plugin's "geyser-devnet" so the two can run
    // side by side against the same DB without clobbering each other's
    // checkpoint row.
    component: process.env.POLLER_COMPONENT ?? "poller-devnet",
    intervalMs: Number(process.env.POLL_INTERVAL_MS ?? 8000),
  };
}
