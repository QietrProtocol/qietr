# GitHub repository metadata (maintainer checklist)

These are outward-facing changes to the GitHub repo itself; run them manually
(they are not applied by CI). They sharpen the project's presentation to match
the README's x402 thesis.

## Description

The current description is the broad "Privacy infrastructure for autonomous AI
agents on Solana," which doesn't mention x402 — the core differentiator. Set:

```bash
gh repo edit QietrCom/qietr \
  --description "Zero-knowledge privacy layer for x402 micropayments on Solana — shielded USDC payments for AI agents."
```

## Topics

```bash
gh repo edit QietrCom/qietr \
  --add-topic solana \
  --add-topic x402 \
  --add-topic zero-knowledge \
  --add-topic privacy \
  --add-topic payments \
  --add-topic ai-agents \
  --add-topic zk-snarks \
  --add-topic groth16
```

## First release

Cut a clearly-labeled devnet pre-release once `CHANGELOG.md` is finalized:

```bash
git tag -a v0.1.0-devnet -m "Qietr v0.1.0-devnet — first public devnet release (unaudited)"
git push origin v0.1.0-devnet

gh release create v0.1.0-devnet \
  --title "v0.1.0-devnet" \
  --notes-file CHANGELOG.md \
  --prerelease
```

> Keep `--prerelease` until a multi-party trusted setup and an external audit
> land. The dev VK and change-note linkability (see `PRIVACY.md`) make this
> unsuitable for production.

## Enable Discussions

The issue-template `config.yml` links to Discussions for questions. Enable it:

Settings → General → Features → Discussions.
