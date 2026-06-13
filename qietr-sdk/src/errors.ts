export class QietrSDKError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QietrSDKError";
  }
}

export class InsufficientBalanceError extends QietrSDKError {
  constructor(available: number, required: number) {
    super(
      `insufficient balance: ${formatUSDCAmount(required)} USDC required, ${formatUSDCAmount(available)} USDC available`,
    );
    this.name = "InsufficientBalanceError";
  }
}

export class InvalidNoteError extends QietrSDKError {
  constructor(reason: string) {
    super(`invalid note: ${reason}`);
    this.name = "InvalidNoteError";
  }
}

export class DecryptionError extends QietrSDKError {
  constructor(reason: string) {
    super(`decryption failed: ${reason}`);
    this.name = "DecryptionError";
  }
}

export class MerkleProofError extends QietrSDKError {
  constructor(reason: string) {
    super(`Merkle proof error: ${reason}`);
    this.name = "MerkleProofError";
  }
}

export class ProofGenerationError extends QietrSDKError {
  constructor(reason: string) {
    super(`ZK proof generation failed: ${reason}`);
    this.name = "ProofGenerationError";
  }
}

export class RelayerError extends QietrSDKError {
  constructor(reason: string) {
    super(`relayer error: ${reason}`);
    this.name = "RelayerError";
  }
}

export class NetworkError extends QietrSDKError {
  constructor(reason: string) {
    super(`network error: ${reason}`);
    this.name = "NetworkError";
  }
}

export class PaymentRequiredError extends QietrSDKError {
  constructor() {
    super("HTTP 402 — payment required");
    this.name = "PaymentRequiredError";
  }
}

// -----------------------------------------------------------------------------
// x402 wrapFetch errors. These are thrown (not silently swallowed) so an
// automated agent can distinguish "no payment attempted" from "guard tripped"
// from "payment failed". See qietr-sdk/src/x402.ts.
// -----------------------------------------------------------------------------

/** Base class for every error surfaced by `wrapFetch`. */
export class X402Error extends QietrSDKError {
  constructor(message: string) {
    super(message);
    this.name = "X402Error";
  }
}

/** The merchant's 402 body could not be parsed as a valid x402 envelope. */
export class X402MalformedRequirementsError extends X402Error {
  constructor(reason: string) {
    super(`x402 requirements malformed: ${reason}`);
    this.name = "X402MalformedRequirementsError";
  }
}

/** No advertised requirement matched our scheme + network + asset. */
export class X402NoMatchingRequirementError extends X402Error {
  constructor(reason: string) {
    super(`no payable x402 requirement: ${reason}`);
    this.name = "X402NoMatchingRequirementError";
  }
}

/** The requested amount exceeds the caller's configured `maxAmountMicro` cap. */
export class X402AmountExceededError extends X402Error {
  readonly requested: bigint;
  readonly cap: bigint;
  constructor(requested: bigint, cap: bigint) {
    super(
      `x402 amount ${requested} micro-USDC exceeds maxAmountMicro cap ${cap}`,
    );
    this.name = "X402AmountExceededError";
    this.requested = requested;
    this.cap = cap;
  }
}

/** The merchant's `payTo` is not on the caller's allowlist. */
export class X402PayToNotAllowedError extends X402Error {
  readonly payTo: string;
  constructor(payTo: string) {
    super(`x402 payTo ${payTo} is not on the configured allowlist`);
    this.name = "X402PayToNotAllowedError";
    this.payTo = payTo;
  }
}

/** The requirement's `asset` is not the configured USDC mint. */
export class X402AssetMismatchError extends X402Error {
  constructor(got: string, expected: string) {
    super(`x402 asset ${got} is not the configured USDC mint ${expected}`);
    this.name = "X402AssetMismatchError";
  }
}

/** Payment was attempted on-chain but failed (proof, funds, or submission). */
export class X402PaymentFailedError extends X402Error {
  constructor(reason: string) {
    super(`x402 payment failed: ${reason}`);
    this.name = "X402PaymentFailedError";
  }
}

export class NullifierSpentError extends QietrSDKError {
  constructor(slot?: string) {
    super(`nullifier already spent${slot ? ` (slot ${slot})` : ""}`);
    this.name = "NullifierSpentError";
  }
}

export function formatUSDCAmount(microAmount: number | bigint): string {
  return (Number(microAmount) / 1_000_000).toFixed(2);
}
