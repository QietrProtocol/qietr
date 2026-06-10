# UI / UX Spec — Qietr

**Version:** 0.1 (spec phase)
**Scope:** Web app at `qietr.com`, hosted documentation, and consistency rules for the SDK demo.

---

## 1. Design principles

1. **Calm, not loud.** The product is privacy infrastructure. The UI should feel like a serious tool, not a meme coin launch.
2. **Light by default.** No automatic dark mode. A dark theme may be added later as an explicit user toggle, never as the default.
3. **No gradients.** Backgrounds, buttons, cards: solid colors only.
4. **No AI-generated visuals.** No stable-diffusion hero images, no synthetic 3D blobs, no glow effects. Illustrations are simple geometric or typographic.
5. **Function over decoration.** Every UI element earns its place. If it does not help the user complete a task or understand state, remove it.
6. **Accessible by default.** Target WCAG 2.2 AA. Keyboard navigation works on every flow.

---

## 2. Design tokens

### 2.1 Color palette

Light theme (only theme at MVP):

| Token | Hex | Use |
|-------|-----|-----|
| `--surface-0` | `#FFFFFF` | App background |
| `--surface-1` | `#F7F7F5` | Cards, panels |
| `--surface-2` | `#EDEDE8` | Inset rows, table stripes |
| `--border-subtle` | `#E2E2DC` | Hairlines |
| `--border-strong` | `#1A1A1A` | Focus rings, primary outline |
| `--text-primary` | `#0E0E0C` | Body |
| `--text-secondary` | `#5B5B57` | Muted labels |
| `--text-inverse` | `#F7F7F5` | Text on dark buttons |
| `--accent` | `#1A1A1A` | Primary buttons, links |
| `--accent-pressed` | `#000000` | Pressed state |
| `--success` | `#2E7D4A` | Confirmations |
| `--warning` | `#7A5A00` | Caution states |
| `--danger` | `#9B1D1D` | Errors, destructive |

No gradients. No glows. No blurs.

### 2.2 Typography

- **Display / Headings:** `Inter Tight`, weights 500 / 600. Letter-spacing tight on large sizes.
- **Body:** `Inter`, weight 400 / 500.
- **Mono:** `JetBrains Mono`, weight 400. Used for: pubkeys, hashes, code, raw note blobs.

Scale (rem):

| Token | Size | Line height | Use |
|-------|------|-------------|-----|
| `display` | 2.5 | 1.1 | Hero only |
| `h1` | 1.875 | 1.2 | Page title |
| `h2` | 1.375 | 1.3 | Section |
| `h3` | 1.125 | 1.4 | Subsection |
| `body` | 1.0 | 1.5 | Default |
| `small` | 0.875 | 1.45 | Metadata |
| `caption` | 0.75 | 1.4 | Stamps, footnotes |

### 2.3 Spacing

8-pt grid. Tokens: `4, 8, 12, 16, 24, 32, 48, 64, 96`.

### 2.4 Radii

- Cards, buttons, inputs: `8px`.
- Pills (tier chips, status badges): `999px`.
- No oversized rounded corners. No "bubble" shapes.

### 2.5 Elevation

- Cards: 1px solid `--border-subtle`. No shadow.
- Modals: `box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08)` plus 1px border.
- Toasts: same as modals, smaller offset.

### 2.6 Motion

- Transitions on hover / focus only. Duration 120ms, easing `ease-out`.
- No parallax. No scroll-jacking. No auto-playing animations.
- Loading spinners: 1.2s rotation, 2px stroke, monochrome.

---

## 3. Logo and mark

- **Wordmark:** `Qietr` in Inter Tight 600, slight negative letter-spacing.
- **Mark candidates:** explored in [07-brand.md](07-brand.md). Default: a wordmark with no separate mark for v1.
- The logo never sits on a gradient or photo background. Solid color only.

---

## 4. Information architecture

```
qietr.com
├── /                      Marketing landing
├── /app                   Web app entry
│   ├── /app/deposit
│   ├── /app/pay
│   ├── /app/note          Note manager (load, back up, restore)
│   └── /app/activity      Local-only history (kept in localStorage)
├── /docs                  Hosted documentation
├── /token                 $QIET overview
├── /security              Audit reports, bug bounty
└── /brand                 Press kit, logos, color
```

The web app has no user accounts. State lives in the wallet + browser localStorage + the user's note file.

---

## 5. Screen-by-screen

### 5.1 Landing (`/`)

Single column on mobile, two-column on desktop ≥ 1024px.

```
┌──────────────────────────────────────────────────────────────────┐
│ Nav: Qietr · Docs · Token · Security                Connect wallet │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Private payments for the agent economy.                           │
│  Pay any x402 endpoint in USDC without revealing identity.         │
│                                                                    │
│  [Open app] [Read docs]                                            │
│                                                                    │
│  Built on Solana · Open source · Audited (Q2 2026)                 │
│                                                                    │
├──────────────────────────────────────────────────────────────────┤
│  Three sections, each one card:                                    │
│   1. "Deposit fixed amounts." Plain language.                      │
│   2. "Spend any amount, any time."                                 │
│   3. "Recipients see only USDC."                                   │
├──────────────────────────────────────────────────────────────────┤
│  Footer: GitHub · Twitter · License · Contact                      │
└──────────────────────────────────────────────────────────────────┘
```

No marketing screenshots of fake UIs. No counter widgets ("12,432 USDC deposited today") unless real and on-chain-verifiable.

### 5.2 Deposit (`/app/deposit`)

```
┌──────────────────────────────────────────────────────────────────┐
│  Step 1 of 3 — Choose denomination                                 │
│                                                                    │
│  [ 0.1 USDC ]  [ 1 USDC ]  [ 10 USDC ]  [ 100 USDC ]               │
│   ^ selected: outlined with --border-strong                        │
│                                                                    │
│  Anonymity set for 10 USDC tier: 982 active notes                  │
│  Fee: 1.0% (0.10 USDC). You receive 9.90 USDC into the pool.       │
│                                                                    │
│  [Continue]                                                        │
└──────────────────────────────────────────────────────────────────┘
```

Step 2 is the **Save your note** modal. Force download or copy, plus a checkbox: "I have saved this note. I understand losing it means losing the funds." Continue button disabled until checked.

Step 3 is wallet sign + confirmation. Live status: "Sending… Confirming… Done."

### 5.3 Pay (`/app/pay`)

Two tabs: **Direct payment** and **x402 endpoint**.

Direct payment form:
- Recipient (Solana address) — input with paste button, address validation, ENS-style nick lookup deferred to V2.
- Amount (USDC) — number input with `0.000001` precision (matches USDC decimals).
- Loaded note balance (read-only).
- Estimated time: under 25 seconds.
- Big primary button: **Send privately**.

x402 endpoint form:
- URL — text input.
- "Fetch payment details" button. Shows `{ payTo, amount, network }` parsed from the 402 response.
- Same primary button.

### 5.4 Note manager (`/app/note`)

- Top: currently loaded note summary (balance, denomination breakdown, count of commitments).
- Actions: **Back up**, **Restore from backup**, **Consolidate**, **Clear from this device**.
- Each action opens a modal with explicit confirmation. Destructive actions (clear) require typing the word `CLEAR`.

### 5.5 Activity (`/app/activity`)

- Local-only event log.
- Columns: Timestamp · Type (Deposit / Payment / Consolidate) · Amount · Status · Tx signature (link to Solana explorer).
- Filter: by type, by date range.
- Note: this is *local history*, not server-side. Cleared with the browser data.

### 5.6 Docs (`/docs`)

Two-column: nav left, content right. Mono code blocks. No syntax-highlighting theme that uses many colors — three-color scheme (text, keyword, comment).

### 5.7 Token (`/token`)

Tabular and dry. No price chart. No countdowns. Just:
- Supply
- Allocation table
- Vesting schedule
- Utility summary
- Contract address (once deployed)
- Audit links

---

## 6. Component inventory

| Component | States |
|-----------|--------|
| Button (primary, secondary, ghost, destructive) | default, hover, focus, pressed, disabled, loading |
| Input (text, number, address) | default, focus, error, disabled |
| Tier chip | default, selected, disabled |
| Status badge | success, warning, danger, neutral |
| Modal | open with focus trap, scroll lock |
| Toast | info, success, warning, error |
| Card | default, with header, with footer |
| Skeleton loader | line, block |
| Code block | mono, copy button, optional line numbers |
| Wallet adapter button | disconnected, connected, switching |
| Confirmation dialog | with required typed phrase |

All components have a keyboard-only interaction path documented in the component table in code.

---

## 7. Accessibility checklist

- All interactive elements have visible focus states using `--border-strong` outline.
- Color contrast: body text on `--surface-0` and `--surface-1` ≥ 7:1 (AAA). Primary button ≥ 4.5:1 (AA).
- Form fields have programmatic labels.
- Modals trap focus and restore it on close.
- All icons used with text labels have `aria-hidden`; icons used alone have `aria-label`.
- Animations respect `prefers-reduced-motion`. If set, transitions drop to 0ms and spinners switch to static state.
- Text remains readable at 200% zoom.
- The web app works without JavaScript at the layout level (server-rendered shell), though wallet flows require JS.

---

## 8. Mobile considerations

- App is responsive down to 360px width.
- Tier chips wrap to two rows on narrow screens.
- The save-note modal becomes a full-screen sheet on mobile.
- Wallet adapters: Phantom mobile deep link, Solflare mobile, plus WalletConnect.

Native apps are not in scope for MVP.

---

## 9. Things explicitly excluded from MVP UI

- Dark mode (defer to user toggle in V2).
- Custom themes / branding for embedded SDK.
- Multi-language (English only at launch; copy is structured for i18n later).
- Push notifications.
- Marketing pop-ups, email-capture modals, exit-intent dialogs.
- Token price tickers anywhere in the app.

---

## 10. Component library and stack

- Framework: Next.js (App Router) for the web app.
- Styling: CSS variables for tokens, plain CSS modules. No utility framework, no styled-components.
- Wallet adapter: `@solana/wallet-adapter-react` plus mobile WalletConnect.
- Forms: native `<form>` with controlled inputs. No heavy form library.
- Icons: a small custom icon set (~20 icons), SVG, monochrome. No icon framework.

Rationale: small bundle, no third-party UI dependency that would constrain future redesigns.

---

## 11. Copy guidelines

- Address the user as **you**. Never **we** for system actions ("you saved a note", "your payment is sent").
- Use specific numbers. "9.90 USDC" not "about ten dollars".
- Never call funds "lost forever" without offering the recovery option immediately after.
- Errors describe what happened and what to do next. No blame ("you entered an invalid address" → "this is not a valid Solana address — check for typos").
- Avoid jargon in the main flow. Technical terms (nullifier, commitment, Merkle root) appear in the docs and tooltips, never in the primary task copy.
