"use client";

// =============================================================================
// DepositBanner — SDK-state-aware status banner for the deposit page.
//
// The deposit flow is wired to the live SDK (see TierPicker). Whether it can
// actually submit depends on the indexer + prover env being configured, which
// is exactly the condition `useQietrSdk()` returns non-null on. So the banner
// must reflect that runtime state instead of being hardcoded "preview" copy:
//   - configured  -> real devnet deposits work; surface the devnet/unaudited/
//                     dev-key disclaimers (those always stay).
//   - unconfigured -> the old "preview, run locally" guidance.
// =============================================================================

import { Banner } from "../../_components/Banner";
import { useQietrSdk } from "../../_lib/use-sdk";

export function DepositBanner() {
  const sdk = useQietrSdk();

  if (sdk) {
    return (
      <Banner tone="warning">
        Connected to Solana <strong>devnet</strong> with a configured indexer
        and prover — deposits submit for real and the proof is generated in your
        browser. <strong>Not audited; uses a dev proving key.</strong> Use
        throwaway devnet USDC only — never real funds.
      </Banner>
    );
  }

  return (
    <Banner tone="warning">
      The pool program is live on Solana devnet. This build has no indexer/prover
      configured, so it cannot submit a real deposit — set the env and rebuild,
      or use the SDK directly. Devnet only; not audited.
    </Banner>
  );
}
