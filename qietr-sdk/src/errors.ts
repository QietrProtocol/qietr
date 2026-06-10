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

export class NullifierSpentError extends QietrSDKError {
  constructor(slot?: string) {
    super(`nullifier already spent${slot ? ` (slot ${slot})` : ""}`);
    this.name = "NullifierSpentError";
  }
}

export function formatUSDCAmount(microAmount: number | bigint): string {
  return (Number(microAmount) / 1_000_000).toFixed(2);
}
