"use client";

import { useState, useCallback, useEffect } from "react";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import {
  QIETR_ESCROW_PROGRAM_ID,
  JobState,
  buildCreateJobIx,
  buildAcceptJobIx,
  buildCompleteJobIx,
  buildReleasePaymentIx,
  buildDisputeJobIx,
  buildCancelJobIx,
  buildResolveDisputeIx,
  buildCloseJobIx,
  findJobPda,
  findEscrowVaultPda,
  parseJobAccount,
  findAssociatedTokenAddress,
  buildCreateAtaIdempotentIx,
  USDC_MINT_MAINNET,
  USDC_MINT_DEVNET,
  TOKEN_PROGRAM_ID,
  type ParsedJob,
} from "@qietr/sdk";
import { Card } from "../../_components/Card";
import { explorerTxUrl } from "../../_lib/explorer";
import { appendActivity } from "../../_lib/storage";
import { useWalletSigner } from "../../_lib/use-sdk";
import { sendAndConfirm } from "../../_lib/confirm-tx";

type Tab = "create" | "browse";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; signature: string }
  | { kind: "error"; message: string };

const JOB_ACCOUNT_SIZE = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1;
const USDC_DECIMALS = 1_000_000;
// Must match DISPUTE_TIMEOUT_SECONDS in the qietr_escrow program: a disputed
// job can only be resolved (auto-refund to the client) 7 days after completion.
const DISPUTE_TIMEOUT_SECONDS = 7 * 24 * 3600;
// Must match ACCEPT_TIMEOUT_SECONDS: an accepted-but-never-completed job can
// only be cancelled (refunded to the client) 7 days after acceptance.
const ACCEPT_TIMEOUT_SECONDS = 7 * 24 * 3600;

const STATE_LABELS: Record<JobState, string> = {
  [JobState.Created]: "Created",
  [JobState.Accepted]: "Accepted",
  [JobState.Completed]: "Completed",
  [JobState.Released]: "Released",
  [JobState.Disputed]: "Disputed",
  [JobState.Refunded]: "Refunded",
};

function microToUsdc(micro: bigint): string {
  const whole = Number(micro) / USDC_DECIMALS;
  return whole.toFixed(whole < 1 ? 6 : 2);
}

export function EscrowManager() {
  const [tab, setTab] = useState<Tab>("create");
  return (
    <div>
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: "var(--space-2)",
          borderBottom: "1px solid var(--border-subtle)",
          marginBottom: "var(--space-6)",
        }}
      >
        <TabBtn active={tab === "create"} onClick={() => setTab("create")} label="Create job" />
        <TabBtn active={tab === "browse"} onClick={() => setTab("browse")} label="My jobs" />
      </div>
      {tab === "create" ? <CreateJobForm /> : <BrowseJobs />}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "var(--space-3) var(--space-4)",
        background: "transparent",
        border: "none",
        borderBottom: active ? "2px solid var(--border-strong)" : "2px solid transparent",
        marginBottom: -1,
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        fontFamily: "inherit",
        fontSize: "0.9375rem",
        cursor: "pointer",
        fontWeight: active ? 500 : 400,
      }}
    >
      {label}
    </button>
  );
}

function CreateJobForm() {
  const { connection } = useConnection();
  const { signer, connected, address } = useWalletSigner();
  const [agent, setAgent] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [balance, setBalance] = useState<string | null>(null);

  const cluster = (process.env.NEXT_PUBLIC_QIETR_CLUSTER ?? "devnet").toLowerCase();
  const usdcMint = cluster.includes("mainnet") ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;

  async function handleCreate(): Promise<void> {
    if (!signer || !connected) {
      setStatus({ kind: "error", message: "Connect a wallet first." });
      return;
    }
    let agentPubkey: PublicKey;
    try {
      agentPubkey = new PublicKey(agent);
    } catch {
      setStatus({ kind: "error", message: "Invalid agent Solana address." });
      return;
    }
    const amt = Number.parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setStatus({ kind: "error", message: "Enter a positive USDC amount." });
      return;
    }
    const priceMicro = BigInt(Math.round(amt * USDC_DECIMALS));

    setStatus({ kind: "submitting" });
    try {
      const nonce = crypto.getRandomValues(new Uint8Array(8));
      const clientAta = findAssociatedTokenAddress(signer.publicKey, usdcMint);

      // Pre-flight balance check: create_job moves the full escrow amount out
      // of the client's USDC ATA immediately, so a low balance fails on-chain
      // with a raw "insufficient funds" (Token 0x1) simulation error. Catch it
      // here and point the tester at the faucet instead. A missing ATA throws
      // (no account) → treat as zero balance.
      let balanceMicro = 0n;
      try {
        const bal = await connection.getTokenAccountBalance(clientAta);
        balanceMicro = BigInt(bal.value.amount);
      } catch {
        balanceMicro = 0n;
      }
      if (balanceMicro < priceMicro) {
        const fundHint = cluster.includes("mainnet")
          ? `Fund your wallet with USDC (mint ${usdcMint.toBase58()}).`
          : `Claim devnet USDC at faucet.circle.com (Solana Devnet) for mint ${usdcMint.toBase58()}.`;
        setStatus({
          kind: "error",
          message: `Insufficient USDC: you have ${microToUsdc(balanceMicro)}, need ${amt}. ${fundHint}`,
        });
        return;
      }

      // `create_job` requires client_ata to already exist (it transfers from it
      // into the escrow vault). A wallet that has never held this mint has no
      // ATA yet → AccountNotInitialized (0xbc4 / 3012). Prepend an idempotent
      // create so the first escrow from a fresh wallet succeeds; it's a no-op
      // when the ATA already exists.
      const createAtaIx = buildCreateAtaIdempotentIx(
        signer.publicKey,
        signer.publicKey,
        usdcMint,
      );

      const ix = buildCreateJobIx(
        agentPubkey,
        nonce,
        priceMicro,
        signer.publicKey,
        clientAta,
        usdcMint,
      );

      const tx = new Transaction();
      tx.add(createAtaIx, ix);
      tx.feePayer = signer.publicKey;

      const bh = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = bh.blockhash;

      const signed = await signer.signTransaction(tx);
      const sig = await sendAndConfirm(connection, signed.serialize(), bh.lastValidBlockHeight);

      appendActivity({
        type: "payment",
        status: "ok",
        detail: `escrow ${amt} USDC to ${agent.slice(0, 4)}…${agent.slice(-4)} · ${sig.slice(0, 8)}…`,
      });
      setStatus({ kind: "success", signature: sig });
      setAgent("");
      setAmount("");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      appendActivity({
        type: "payment",
        status: "error",
        detail: `escrow create · ${message.slice(0, 100)}`,
      });
      setStatus({ kind: "error", message });
    }
  }

  async function checkBalance(): Promise<void> {
    if (!signer || !connected) {
      setStatus({ kind: "error", message: "Connect a wallet first." });
      return;
    }
    setBalance("…");
    try {
      const owner = signer.publicKey;
      const ata = findAssociatedTokenAddress(owner, usdcMint);
      const short = `${owner.toBase58().slice(0, 4)}…${owner.toBase58().slice(-4)}`;
      // Distinguish "no token account yet" (legit zero) from an RPC failure —
      // otherwise both look like a flat 0 and hide why funds aren't showing.
      const info = await connection.getAccountInfo(ata);
      if (!info) {
        setBalance(`0.000000 USDC — ${short} has no USDC account yet`);
        return;
      }
      const bal = await connection.getTokenAccountBalance(ata);
      setBalance(`${microToUsdc(BigInt(bal.value.amount))} USDC — ${short}`);
    } catch (e) {
      setBalance(null);
      setStatus({
        kind: "error",
        message: `Balance check failed (RPC): ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return (
    <Card>
      <Field label="Agent (Solana address)">
        <input
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          placeholder="e.g. 7xKXtg2C..."
          style={inputStyle}
        />
      </Field>
      <Field label="Amount (USDC)">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="10.00"
          style={inputStyle}
        />
      </Field>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", marginTop: "-0.5rem", marginBottom: "var(--space-4)" }}>
        USDC is transferred from your wallet into the escrow vault on creation.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <PrimaryBtn
          label={status.kind === "submitting" ? "Creating…" : "Create escrow"}
          disabled={!connected || status.kind === "submitting"}
          onClick={() => void handleCreate()}
        />
        <button
          type="button"
          onClick={() => void checkBalance()}
          disabled={!connected}
          style={{
            padding: "var(--space-2) var(--space-4)",
            borderRadius: "var(--radius-base)",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-0)",
            cursor: connected ? "pointer" : "not-allowed",
            opacity: connected ? 1 : 0.5,
            fontFamily: "inherit",
            fontSize: "0.875rem",
            color: "var(--text-primary)",
          }}
        >
          Check balance
        </button>
        {balance !== null ? (
          <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            {balance}
          </span>
        ) : null}
      </div>
      <StatusLine status={status} />
    </Card>
  );
}

function BrowseJobs() {
  const { connection } = useConnection();
  const { signer, connected, address } = useWalletSigner();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  interface JobRow extends ParsedJob {
    jobPda: string;
  }

  const fetchJobs = useCallback(async () => {
    if (!address || !connected) return;
    setLoading(true);
    setError(null);
    try {
      const pubkey = new PublicKey(address);
      // A wallet can be on either side of a job: the client (Job.client, byte
      // offset 8) or the agent/receiver (Job.agent, offset 40). Query both
      // positions and merge so receivers actually see jobs assigned to them
      // (otherwise the agent could never Accept).
      const [asClient, asAgent] = await Promise.all([
        connection.getProgramAccounts(QIETR_ESCROW_PROGRAM_ID, {
          filters: [
            { dataSize: JOB_ACCOUNT_SIZE },
            { memcmp: { offset: 8, bytes: pubkey.toBase58() } },
          ],
        }),
        connection.getProgramAccounts(QIETR_ESCROW_PROGRAM_ID, {
          filters: [
            { dataSize: JOB_ACCOUNT_SIZE },
            { memcmp: { offset: 40, bytes: pubkey.toBase58() } },
          ],
        }),
      ]);

      const seen = new Set<string>();
      const all: JobRow[] = [];
      for (const { account, pubkey: pk } of [...asClient, ...asAgent]) {
        const key = pk.toBase58();
        if (seen.has(key)) continue;
        seen.add(key);
        const job = parseJobAccount(account.data as Uint8Array);
        if (job) {
          all.push({ ...job, jobPda: key });
        }
      }
      all.sort((a, b) => b.createdAt - a.createdAt);
      setJobs(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [connection, address, connected]);

  useEffect(() => {
    if (connected && address) {
      fetchJobs();
    } else {
      setJobs([]);
    }
  }, [connected, address, fetchJobs]);

  async function handleAction(job: JobRow, action: string): Promise<void> {
    if (!signer) return;
    setStatus({ kind: "submitting" });
    try {
      const jobPda = new PublicKey(job.jobPda);
      let ix;
      // Instructions to run before the action ix (e.g. ensuring a payout ATA
      // exists). Kept separate so each action opts in explicitly.
      const preIxs: TransactionInstruction[] = [];

      switch (action) {
        case "accept":
          ix = buildAcceptJobIx(jobPda, signer.publicKey);
          break;
        case "complete":
          ix = buildCompleteJobIx(jobPda, signer.publicKey);
          break;
        case "release":
          {
            const [vaultPda] = findEscrowVaultPda(
              new PublicKey(job.client),
              Buffer.from(job.nonce, "hex"),
            );
            const agent = new PublicKey(job.agent);
            const agentAta = findAssociatedTokenAddress(agent, USDC_MINT_DEVNET);
            // release_payment pays into agent_ata, which must already exist (a
            // plain Account<TokenAccount>). If the receiver never held USDC the
            // ATA is missing → AccountNotInitialized. The client (signer) funds
            // an idempotent create so the payout lands on the first try.
            preIxs.push(
              buildCreateAtaIdempotentIx(signer.publicKey, agent, USDC_MINT_DEVNET),
            );
            ix = buildReleasePaymentIx(jobPda, vaultPda, agentAta, signer.publicKey);
          }
          break;
        case "dispute":
          ix = buildDisputeJobIx(jobPda, signer.publicKey);
          break;
        case "resolve":
          {
            // resolve_dispute auto-refunds the client, but only after the
            // 7-day cooling-off. Guard client-side so the user gets a clear
            // message instead of a raw DisputeTimeoutNotElapsed error.
            const readyAt = job.completedAt + DISPUTE_TIMEOUT_SECONDS;
            const now = Math.floor(Date.now() / 1000);
            if (now < readyAt) {
              setStatus({
                kind: "error",
                message:
                  `Disputed jobs auto-refund the client 7 days after completion. ` +
                  `Available ${new Date(readyAt * 1000).toLocaleString()}.`,
              });
              return;
            }
            const [vaultPda] = findEscrowVaultPda(
              new PublicKey(job.client),
              Buffer.from(job.nonce, "hex"),
            );
            const clientAta = findAssociatedTokenAddress(
              new PublicKey(job.client),
              USDC_MINT_DEVNET,
            );
            ix = buildResolveDisputeIx(jobPda, vaultPda, clientAta, signer.publicKey);
          }
          break;
        case "cancel":
          {
            // cancel_job is instant while Created, but an Accepted job can only
            // be cancelled after the 7-day accept timeout (so an agent can't be
            // rugged mid-work). Guard client-side for a clear message.
            if (job.state === JobState.Accepted) {
              const readyAt = job.acceptedAt + ACCEPT_TIMEOUT_SECONDS;
              const now = Math.floor(Date.now() / 1000);
              if (now < readyAt) {
                setStatus({
                  kind: "error",
                  message:
                    `An accepted job can only be cancelled 7 days after acceptance ` +
                    `if the agent never completes it. Available ${new Date(readyAt * 1000).toLocaleString()}.`,
                });
                return;
              }
            }
            const [vaultPda] = findEscrowVaultPda(
              new PublicKey(job.client),
              Buffer.from(job.nonce, "hex"),
            );
            const clientAta = findAssociatedTokenAddress(
              new PublicKey(job.client),
              USDC_MINT_DEVNET,
            );
            ix = buildCancelJobIx(jobPda, vaultPda, clientAta, signer.publicKey);
          }
          break;
        case "close":
          ix = buildCloseJobIx(jobPda, signer.publicKey);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      const tx = new Transaction();
      tx.add(...preIxs, ix);
      tx.feePayer = signer.publicKey;

      const bh = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = bh.blockhash;

      const signed = await signer.signTransaction(tx);
      const sig = await sendAndConfirm(connection, signed.serialize(), bh.lastValidBlockHeight);

      setStatus({ kind: "success", signature: sig });
      fetchJobs();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStatus({ kind: "error", message });
    }
  }

  function availableActions(job: JobRow): Array<{ label: string; action: string }> {
    const isClient = address === job.client;
    const isAgent = address === job.agent;
    const state = job.state;

    if (state === JobState.Created && (isClient || isAgent)) {
      const actions: Array<{ label: string; action: string }> = [];
      if (isClient) actions.push({ label: "Cancel", action: "cancel" });
      if (isAgent) actions.push({ label: "Accept", action: "accept" });
      return actions;
    }
    if (state === JobState.Accepted) {
      if (isAgent) return [{ label: "Complete", action: "complete" }];
      // The client cannot dispute yet (dispute_job needs Completed). Their only
      // recourse is a timeout-gated cancel if the agent never completes.
      if (isClient) {
        const readyAt = job.acceptedAt + ACCEPT_TIMEOUT_SECONDS;
        const now = Math.floor(Date.now() / 1000);
        const label =
          now >= readyAt
            ? "Cancel (refund)"
            : `Cancel — available ${new Date(readyAt * 1000).toLocaleDateString()}`;
        return [{ label, action: "cancel" }];
      }
    }
    if (state === JobState.Completed) {
      // Now the client chooses: pay the agent, or dispute (starts the 7-day
      // refund timer). dispute_job is only valid in this state.
      if (isClient)
        return [
          { label: "Release payment", action: "release" },
          { label: "Dispute", action: "dispute" },
        ];
    }
    if (state === JobState.Disputed && isClient) {
      const readyAt = job.completedAt + DISPUTE_TIMEOUT_SECONDS;
      const now = Math.floor(Date.now() / 1000);
      const label =
        now >= readyAt
          ? "Resolve (refund)"
          : `Resolve — available ${new Date(readyAt * 1000).toLocaleDateString()}`;
      return [{ label, action: "resolve" }];
    }
    if ((state === JobState.Released || state === JobState.Refunded) && isClient) {
      // Only the client should close: close_job refunds the account rent to the
      // signer (claimant), and the client is the one who paid it on creation.
      return [{ label: "Close", action: "close" }];
    }
    return [];
  }

  if (!connected) {
    return (
      <Card>
        <p style={{ color: "var(--text-secondary)" }}>Connect your wallet to view your jobs.</p>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}>
        <button
          onClick={fetchJobs}
          disabled={loading}
          style={{
            padding: "var(--space-2) var(--space-4)",
            borderRadius: "var(--radius-base)",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-0)",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "0.875rem",
            color: "var(--text-primary)",
          }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Loading jobs…</p>
      ) : error ? (
        <p style={{ color: "var(--danger)", fontSize: "0.875rem" }}>{error}</p>
      ) : jobs.length === 0 ? (
        <Card>
          <p style={{ color: "var(--text-secondary)" }}>No escrow jobs found for your wallet.</p>
        </Card>
      ) : (
        jobs.map((job) => {
          const actions = availableActions(job);
          return (
            <Card key={job.jobPda} style={{ marginBottom: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                <span style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-pill)",
                  background: stateBg(job.state),
                  color: stateFg(job.state),
                }}>
                  {STATE_LABELS[job.state]}
                </span>
                <code style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {job.jobPda.slice(0, 8)}…{job.jobPda.slice(-8)}
                </code>
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "max-content 1fr",
                gap: "var(--space-1) var(--space-4)",
                fontSize: "0.875rem",
                marginBottom: "var(--space-3)",
              }}>
                <span style={{ color: "var(--text-secondary)" }}>Client</span>
                <code style={{ margin: 0, color: address === job.client ? "var(--accent)" : undefined }}>
                  {job.client.slice(0, 4)}…{job.client.slice(-4)}
                </code>
                <span style={{ color: "var(--text-secondary)" }}>Agent</span>
                <code style={{ margin: 0, color: address === job.agent ? "var(--accent)" : undefined }}>
                  {job.agent.slice(0, 4)}…{job.agent.slice(-4)}
                </code>
                <span style={{ color: "var(--text-secondary)" }}>Amount</span>
                <span style={{ margin: 0 }}>{microToUsdc(job.priceMicro)} USDC</span>
              </div>

              {actions.length > 0 && (
                <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  {actions.map((a) => (
                    <button
                      key={a.action}
                      onClick={() => void handleAction(job, a.action)}
                      disabled={status.kind === "submitting"}
                      style={{
                        padding: "var(--space-1) var(--space-3)",
                        borderRadius: "var(--radius-base)",
                        border: "1px solid var(--border-subtle)",
                        background: "var(--surface-0)",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontSize: "0.8125rem",
                        color: "var(--text-primary)",
                      }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          );
        })
      )}
      <StatusLine status={status} />
    </div>
  );
}

function stateBg(state: JobState): string {
  if (state === JobState.Released) return "var(--success)";
  if (state === JobState.Disputed) return "var(--danger)";
  if (state === JobState.Refunded) return "var(--text-secondary)";
  if (state === JobState.Accepted || state === JobState.Completed) return "var(--warning)";
  return "var(--surface-2)";
}

function stateFg(state: JobState): string {
  if (state === JobState.Released || state === JobState.Disputed) return "var(--text-inverse)";
  if (state === JobState.Refunded) return "var(--text-inverse)";
  if (state === JobState.Accepted || state === JobState.Completed) return "var(--text-primary)";
  return "var(--text-secondary)";
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === "success") {
    return (
      <p style={{ marginTop: "var(--space-4)", color: "var(--success)", fontSize: "0.875rem", wordBreak: "break-all" }}>
        Tx submitted.{" "}
        <a href={explorerTxUrl(status.signature)} target="_blank" rel="noopener noreferrer"
           style={{ color: "var(--accent)", fontWeight: 500 }}>
          <code>{status.signature.slice(0, 8)}…{status.signature.slice(-8)}</code> ↗
        </a>
      </p>
    );
  }
  if (status.kind === "error") {
    return (
      <p style={{ marginTop: "var(--space-4)", color: "var(--danger)", fontSize: "0.875rem", wordBreak: "break-word" }}>
        {status.message}
      </p>
    );
  }
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: "var(--space-4)" }}>
      <span style={{ display: "block", fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "var(--space-1)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "var(--space-3)",
  borderRadius: "var(--radius-base)",
  border: "1px solid var(--border-subtle)",
  fontFamily: "var(--font-mono)",
  fontSize: "0.9375rem",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
};

function PrimaryBtn({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "var(--space-3) var(--space-6)",
        borderRadius: "var(--radius-base)",
        border: "none",
        background: "var(--accent)",
        color: "var(--text-inverse)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "0.9375rem",
        fontWeight: 500,
        opacity: disabled ? 0.5 : 1,
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}
