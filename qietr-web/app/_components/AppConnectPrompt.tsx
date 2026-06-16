"use client";

// =============================================================================
// AppConnectPrompt — one-time wallet-connect nudge for first-time visitors.
//
// Mounted once on the /app landing page. If the visitor has never connected a
// wallet (no wallet name persisted by wallet-adapter) and isn't already
// connected, we open the wallet modal a single time so the connect step is the
// obvious first action. Returning users are reconnected silently by
// `autoConnect` in WalletAdapterProvider and never see this.
//
// We guard with a per-session sessionStorage flag so dismissing the modal
// doesn't reopen it on re-render or client-side navigation back to /app.
// =============================================================================

import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

const PROMPTED_KEY = "qietr.connect-prompted.v1";
// wallet-adapter persists the last-selected wallet name under this key; its
// presence means the user has connected before (so autoConnect handles them).
const ADAPTER_WALLET_KEY = "walletName";

export function AppConnectPrompt() {
  const { connected, connecting, wallet } = useWallet();
  const { visible, setVisible } = useWalletModal();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (typeof window === "undefined") return;

    // Already connected, mid-connect, or an adapter is selected (returning
    // user → autoConnect will handle it): never prompt.
    if (connected || connecting || wallet) return;

    // Only ever prompt once per browser session.
    if (sessionStorage.getItem(PROMPTED_KEY)) return;

    // Returning user with a remembered wallet: let autoConnect do its thing
    // silently instead of popping the modal.
    if (window.localStorage.getItem(ADAPTER_WALLET_KEY)) {
      sessionStorage.setItem(PROMPTED_KEY, "1");
      return;
    }

    firedRef.current = true;
    sessionStorage.setItem(PROMPTED_KEY, "1");
    if (!visible) setVisible(true);
  }, [connected, connecting, wallet, visible, setVisible]);

  return null;
}
