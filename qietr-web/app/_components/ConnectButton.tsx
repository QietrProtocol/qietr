"use client";

// =============================================================================
// ConnectButton — wallet-adapter-react-ui's MultiButton with our color tokens
// reset so it matches the rest of the chrome.
//
// We intentionally don't show the full base58 address in the nav, just a
// short prefix. That keeps the bar visually quiet.
// =============================================================================

import dynamic from "next/dynamic";

// WalletMultiButton must be loaded client-side; without `ssr: false`,
// Next.js static export errors on the wallet-adapter CSS import.
const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);

export function ConnectButton() {
  return (
    <div className="qietr-connect-button">
      <WalletMultiButton />
    </div>
  );
}
