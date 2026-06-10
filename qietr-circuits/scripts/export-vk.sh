#!/usr/bin/env bash
# Export the verifying key in the formats needed by downstream consumers.
#
# Outputs:
#   keys/<name>_vk.json       - snarkjs JSON form (for off-chain debugging)
#   keys/<name>_vk_solana.bin - packed bytes for the on-chain groth16-solana
#                               verifier. The packer lives in qietr-pool /
#                               qietr-sdk and is shelled out to once it
#                               exists. Until then this script only emits
#                               the JSON form.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ZKEY="${1:-keys/qietr_payment_dev.zkey}"
NAME="$(basename "${ZKEY%.zkey}")"
VKEY_JSON="keys/${NAME}_vk.json"

if [ ! -f "$ZKEY" ]; then
  echo "error: $ZKEY not found" >&2
  exit 1
fi

echo "exporting verifying key (json) from $ZKEY"
npx snarkjs zkey export verificationkey "$ZKEY" "$VKEY_JSON"

echo "done. JSON vk at $VKEY_JSON"
echo "note: solana-bytes packing tool not yet implemented; see qietr-pool."
