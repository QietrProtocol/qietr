# Circuit artifacts (served by the web app)

These are fetched by the browser SDK at runtime when
`NEXT_PUBLIC_QIETR_PROVER_PATH=/circuits`:

| File | Source | Size |
|------|--------|------|
| `qietr_payment.wasm` | `qietr-circuits/build/qietr_payment_js/qietr_payment.wasm` | ~2.4 MB |
| `qietr_payment_final.zkey` | `qietr-circuits/keys/qietr_payment_dev.zkey` (renamed) | ~3.3 MB |
| `qietr_payment_vk.json` | `qietr-circuits/keys/qietr_payment_dev_vk.json` (renamed) | ~4 KB |

> ⚠️ **Dev key only.** `qietr_payment_final.zkey` here is the single-contributor
> **development** proving key (`pot14`). It is fine for **devnet** but must NEVER
> be used for real funds. A production deployment replaces it with a key from a
> multi-party trusted-setup ceremony — see `docs/dev/CEREMONY.md`.

To refresh after rebuilding circuits:

```bash
cp ../../qietr-circuits/build/qietr_payment_js/qietr_payment.wasm qietr_payment.wasm
cp ../../qietr-circuits/keys/qietr_payment_dev.zkey               qietr_payment_final.zkey
cp ../../qietr-circuits/keys/qietr_payment_dev_vk.json            qietr_payment_vk.json
```
