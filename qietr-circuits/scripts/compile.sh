#!/usr/bin/env bash
# Compile qietr_payment.circom to r1cs / wasm / sym.
# Outputs land in build/.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p build

CIRCUIT="circuits/qietr_payment.circom"

if ! command -v circom >/dev/null 2>&1; then
  echo "error: circom not found on PATH" >&2
  echo "install: https://docs.circom.io/getting-started/installation/" >&2
  exit 1
fi

echo "compiling $CIRCUIT"
circom "$CIRCUIT" \
  --r1cs --wasm --sym \
  -l node_modules \
  -o build

echo "done. artifacts in build/"
