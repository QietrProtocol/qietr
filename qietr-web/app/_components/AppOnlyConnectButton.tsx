"use client";

// =============================================================================
// AppOnlyConnectButton — renders the wallet ConnectButton only on /app routes.
//
// The wallet is irrelevant on the marketing pages (home, docs, token,
// security, brand), so showing a connect control there just adds noise and
// invites a connection the visitor has no reason to make. We gate on the
// pathname so the button appears the moment the user enters the app and stays
// hidden everywhere else.
// =============================================================================

import { usePathname } from "next/navigation";
import { ConnectButton } from "./ConnectButton";

export function AppOnlyConnectButton() {
  const pathname = usePathname();
  // `/app`, `/app/`, and any `/app/...` subroute — but not e.g. `/applications`.
  const onApp = pathname === "/app" || pathname?.startsWith("/app/");
  if (!onApp) return null;
  return <ConnectButton />;
}
