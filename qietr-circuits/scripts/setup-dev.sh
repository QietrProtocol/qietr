#!/usr/bin/env bash
# Dev-only Powers-of-Tau and zkey generation.
#
# WARNING: keys produced here are for LOCAL DEVELOPMENT ONLY. The production
# trusted setup is a multi-party ceremony coordinated at launch. Per TRD
# section 4.4, the production verifying-key hash is committed in the
# on-chain PoolConfig and must come from the real ceremony output, not this.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p ptau keys

# pot14 is large enough for the depth-20 spend circuit. Bump up if compile
# reports too few constraints fit.
PTAU_POWER=14
PTAU_FILE="ptau/pot${PTAU_POWER}_final.ptau"
R1CS="build/qietr_payment.r1cs"
ZKEY="keys/qietr_payment_dev.zkey"
VKEY="keys/qietr_payment_dev_vk.json"

if [ ! -f "$R1CS" ]; then
  echo "error: $R1CS not found. run 'npm run compile' first." >&2
  exit 1
fi

if [ ! -f "$PTAU_FILE" ]; then
  echo "generating dev ptau (pot${PTAU_POWER})"
  npx snarkjs powersoftau new bn128 "$PTAU_POWER" \
    "ptau/pot${PTAU_POWER}_0000.ptau" -v
  npx snarkjs powersoftau contribute \
    "ptau/pot${PTAU_POWER}_0000.ptau" \
    "ptau/pot${PTAU_POWER}_0001.ptau" \
    --name="dev" -v -e="dev-only randomness $(date +%s)"
  npx snarkjs powersoftau prepare phase2 \
    "ptau/pot${PTAU_POWER}_0001.ptau" \
    "$PTAU_FILE" -v
fi

echo "generating dev zkey"
npx snarkjs groth16 setup "$R1CS" "$PTAU_FILE" "${ZKEY}.0"
npx snarkjs zkey contribute "${ZKEY}.0" "$ZKEY" \
  --name="dev-contrib" -v -e="dev-only randomness $(date +%s)"

echo "exporting dev verifying key"
npx snarkjs zkey export verificationkey "$ZKEY" "$VKEY"

echo "done. dev keys in keys/"
echo "DO NOT use these keys outside of local development."
