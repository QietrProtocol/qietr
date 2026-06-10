# qietr-web

Next.js app for [Qietr](../README.md) at `qietr.com`. Static export, deployed to Cloudflare Pages.

**Status:** implemented. 12 static routes, wallet adapter, SDK integration, note manager, activity log. Static export ready for Cloudflare Pages.

## Layout

```
qietr-web/
  package.json                  # next 14, react 18
  next.config.mjs               # output: "export"  (CF Pages)
  tsconfig.json
  app/
    layout.tsx                  # root layout with Nav + Footer + WalletAdapter
    page.tsx                    # landing page (marketing + pricing)
    globals.css                 # design tokens from UI/UX section 2
    app/
      page.tsx                  # dashboard
      deposit/page.tsx          # tier picker + deposit flow
      deposit/TierPicker.tsx    # interactive tier selection
      pay/page.tsx              # pay flow (direct + x402 tabs)
      pay/PayForms.tsx          # payment form components
      note/page.tsx             # note manager
      note/NoteManager.tsx      # encrypt/decrypt/backup/restore/clear
      activity/page.tsx         # activity log
      activity/ActivityList.tsx # activity log component
    token/page.tsx              # token info
    security/page.tsx           # security page
    brand/page.tsx              # brand page
    _components/
      Nav.tsx                   # navigation
      Footer.tsx                # footer
      WalletAdapterProvider.tsx # Solana wallet adapter
      ConnectButton.tsx         # wallet connect button
    _lib/
      use-sdk.ts                # QietrSDK hooks
      storage.ts                # localStorage helpers
  public/                       # static assets
  out/                          # generated static export (gitignored)
```

## Design rules locked

- **Light theme only** at MVP. No automatic dark mode.
- **No gradients, no glows, no AI imagery, no shadows on text.**
- **Typography:** Inter Tight (display), Inter (body), JetBrains Mono (code).
- All design tokens live in `app/globals.css` and mirror `docs/05-uiux.md` section 2 exactly.

## Prerequisites

- Node.js 20+
- npm or pnpm

## Quick start

```bash
npm install
npm run dev           # http://localhost:3000
npm run build         # static export to ./out
```

The exported `./out/` directory is what gets deployed to Cloudflare Pages.

## Next pass

1. WCAG 2.2 AA audit: keyboard nav on every flow, focus rings visible.
2. Deploy to Cloudflare Pages.

## Security

- No user accounts. State lives in the wallet, browser localStorage, and the user's encrypted note file.
- No third-party analytics that exfiltrate route data (privacy product, privacy hosting).
- Notes are never sent to a server. The prover runs in WASM client-side by default.
