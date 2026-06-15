"use client";

// =============================================================================
// ConfiguredBanner — runtime-aware status banner.
//
// The deposit / pay / spend flows are wired to the live SDK, but whether they
// can actually submit depends on the indexer + prover env being configured —
// exactly the condition `useQietrSdk()` returns non-null on. Pages must reflect
// that runtime state instead of hardcoding "preview, run locally" copy that is
// wrong on a configured build (which is what the live qietr.com deploy is).
//
//   sdk != null  -> render `configured`
//   sdk == null  -> render `unconfigured`
// =============================================================================

import type { ReactNode } from "react";
import { Banner } from "./Banner";
import { useQietrSdk } from "../_lib/use-sdk";

export function ConfiguredBanner({
  configured,
  unconfigured,
  tone = "warning",
}: {
  configured: ReactNode;
  unconfigured: ReactNode;
  tone?: "info" | "warning";
}) {
  const sdk = useQietrSdk();
  return <Banner tone={tone}>{sdk ? configured : unconfigured}</Banner>;
}
