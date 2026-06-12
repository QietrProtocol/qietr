# Brand — Qietr

**Version:** 0.1 (spec phase)

---

## 1. Identity

- **Brand name:** Qietr
- **Token ticker:** $QIET
- **Domain:** `qietr.com`
- **GitHub organization:** `QietrProtocol`
- **X (Twitter):** `@QietrCom`
- **GitHub user (project lead):** `qietr`

### Name origin

Qietr is "quiet" with the `u` dropped, ending with `r` for grammatical agency — the actor that quiets things. It signals the product thesis (private, unobtrusive payments) without being literal about the technology underneath. Short, ticker-friendly, and brandable in mono and display contexts.

Pronunciation: **"kwite-er"** (rhymes with *writer*).

---

## 2. Voice and tone

| Trait | What it means | What it does not mean |
|-------|---------------|----------------------|
| Plain | Specific words, real numbers, no jargon in primary copy | Dumbed down |
| Calm | Quiet confidence, no exclamation marks in product copy | Boring |
| Technical when needed | Documentation is precise, links to primitives, shows code | Doc-dumping in marketing |
| Honest about tradeoffs | Privacy has costs (anonymity-set size, latency); we say so | Negativity for its own sake |
| Internationally readable | English only at launch, but written so non-native readers parse easily | Translation-ready by ignoring all idiom |

### Things we don't do in copy

- "Revolutionary", "next-generation", "Web3-native", "AI-powered" — never.
- Exclamation marks in product UI.
- All-caps shouting outside of one-word ticker references.
- Hashtags inside body copy.
- Vague metric claims ("up to 10x faster") without a baseline.

### Taglines (working drafts)

- *Private payments for the agent economy.*
- *Pay any x402 endpoint in USDC, without identity attached.*
- *USDC privacy on Solana. Open source. Open standards.*

The marketing site picks one and uses it consistently. The others surface in social and docs.

---

## 3. Visual identity

### 3.1 Wordmark

`Qietr` in Inter Tight 600, optical kerning, slight negative letter-spacing on display sizes. Black on white as the default. A reversed variant (white on black) is reserved for inverted contexts, never for general marketing.

The wordmark is the primary mark for v1. No separate icon-mark is shipped at launch. If a mark is added later, it must work as a 16px favicon while remaining recognizable.

### 3.2 Color

See [05-uiux.md §2.1](05-uiux.md). Brand uses the same tokens as the product. No special brand-only palette.

Critical rules:

- **No gradients.** Anywhere. Ever.
- **No dark default.** Light theme always. Inverted variants exist but are used sparingly.
- **No glow effects.** No drop-shadows on text.
- **No "Tron" or "cyberpunk" aesthetics.** This is not the visual world we are in.

### 3.3 Typography in long-form

- Headings: Inter Tight 600.
- Body: Inter 400.
- Mono: JetBrains Mono.
- Line length: max 72 characters for body copy.
- Justification: left-aligned only. No justified text.

### 3.4 Photography and illustration

- No AI-generated imagery.
- No stock photos of "cyber" themes (binary streams, hooded figures, blue grids).
- Acceptable: simple geometric diagrams, system architecture diagrams in monochrome, screenshots of real product UI, charts of real on-chain data.
- If we ever commission illustration, the brief is "editorial line drawing" — clean, monochrome, restrained.

### 3.5 Iconography

- 24px grid.
- 2px stroke, square caps.
- Monochrome by default.
- Filled variants only for status indicators (success / warning / danger).

---

## 4. Logo usage rules

- Minimum clear space around the wordmark: equal to the cap height of the `Q`.
- Minimum size on screen: 80px wide. Below that, switch to favicon.
- Do not stretch, rotate, recolor, outline, or apply effects to the wordmark.
- Do not overlay the wordmark on images. Place on solid color only.

---

## 5. Naming conventions

| Asset | Convention |
|-------|------------|
| Programs | `qietr_pool`, `qietr_revenue` (snake_case) |
| TypeScript packages | `@qietr/sdk`, `@qietr/hooks`, `@qietr/indexer-client` |
| Domains | `qietr.com`, `api.qietr.com`, `docs.qietr.com`, `prover.qietr.com`, `relay.qietr.com` |
| Repos under GitHub org | `QietrProtocol/qietr-pool`, `QietrProtocol/qietr-sdk`, `QietrProtocol/qietr-indexer`, `QietrProtocol/qietr-relayer`, `QietrProtocol/qietr-web`, `QietrProtocol/qietr-docs`, `QietrProtocol/qietr-circuits` |
| Token | $QIET — uppercase ticker. Brand name "Qietr" remains capitalized as a regular word. |

---

## 6. Social presence

- **X:** `@QietrCom`. Updates, milestones, no shilling, no engagement-bait threads.
- **GitHub:** `QietrProtocol`. All source, public.
- **Docs site:** `docs.qietr.com`.
- **Telegram / Discord:** considered post-launch. Not at TGE. Community channels invite scams; we delay until we can staff moderation.

---

## 7. Brand do / don't list

### Do

- Use real screenshots of real product UI in announcements.
- Cite open standards (HTTP 402, Groth16, BN254, Poseidon) by name in technical content.
- Publish post-mortems publicly when incidents occur.
- Write release notes that explain what changed and why, in plain English.

### Don't

- Use any AI-generated visuals.
- Run paid promotions through influencer accounts whose audiences are mostly token speculators.
- Promise specific token returns, ever.
- Compare ourselves favorably by name to specific competitor products in marketing. Compare against the open standards instead.
- Hold any branded event labeled as a "summit" or "conclave". We do meetups and workshops.

---

## 8. Press kit

`qietr.com/brand` hosts:

- Wordmark in SVG and PNG.
- Color tokens as CSS, JSON, and ASE.
- A one-page about doc.
- Architecture diagrams in SVG.
- Contact for press inquiries: `press@qietr.com`.

---

## 9. Trademark and legal copy

- "Qietr" and the wordmark are unregistered trademarks at MVP. Trademark filing is considered post-mainnet launch.
- "Solana", "USDC", "x402" appear with their canonical capitalization in all copy.
- Any time we reference an open standard (HTTP 402, x402, Groth16, BN254, Poseidon, SPL Token), we link to a canonical source on first use in a document.
