// =============================================================================
// @qietr/sdk — public entrypoint
// =============================================================================

export { QietrSDK, emptyNote, generateBurnerWallet } from "./sdk.js";
export {
  DecryptError,
  NotImplemented,
  NOTE_VERSION,
  ENCRYPTED_MAGIC,
  serializeNote,
  parseNote,
  encryptNote,
  decryptNote,
  isEncryptedNote,
} from "./note.js";
export { wrapFetch } from "./x402.js";
export { PoseidonMerkleTree } from "./merkle.js";
export { buildWitness, proveGroth16 } from "./prover.js";
export { commitmentHash, nullifierHash, getPoseidon } from "./hash.js";
export { pubkeyToField, pubkeyToFieldString } from "./pubkey.js";
export {
  IndexerClient,
  IndexerError,
} from "./indexer-client.js";
export {
  DEFAULT_TIERS,
  USDC_DECIMALS,
  QIET_DECIMALS,
  USDC_MINT_MAINNET,
  USDC_MINT_DEVNET,
  QIET_MINT_MAINNET,
  QIET_MINT_DEVNET,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  findAssociatedTokenAddress,
  pickTier,
  isCrossChain,
  getChainEid,
  type ChainId,
} from "./chain.js";
export {
  QIETR_POOL_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  buildDepositIx,
  buildTransferIx,
  buildWithdrawIx,
  findPoolConfigPda,
  findDenominationPda,
  findMerkleTreePda,
  findVaultPda,
  findNullifierPda,
} from "./program.js";
export {
  randomFieldDec,
  fieldDecToBE32,
  be32ToFieldDec,
} from "./randomness.js";
export {
  QietrSDKError,
  InsufficientBalanceError,
  InvalidNoteError,
  DecryptionError,
  MerkleProofError,
  ProofGenerationError,
  RelayerError,
  NetworkError,
  PaymentRequiredError,
  NullifierSpentError,
  formatUSDCAmount,
} from "./errors.js";
export { Logger, type LogLevel } from "./logger.js";
export { AttestorClient, type NullifierAttestation } from "./attestor-client.js";
export { RelayerClient } from "./relayer-client.js";
export {
  QIETR_MSG_PROGRAM_ID,
  MAX_MESSAGE_BYTES,
  buildSendMsgIx,
  buildDeleteMsgIx,
  findMsgPda,
  encryptMsgBody,
  decryptMsgBody,
  parseMessageAccount,
  fetchInbox,
  type EncryptedMessage,
} from "./msg.js";
export {
  getNoteBalance,
  hasEnoughBalance,
  getCommitmentCount,
  getLargestCommitment,
  parseUSDCAmount,
  calculateFee,
} from "./helpers.js";
export {
  QIETR_ESCROW_PROGRAM_ID,
  JOB_ACCOUNT_SIZE,
  JobState,
  buildCreateJobIx,
  buildAcceptJobIx,
  buildCompleteJobIx,
  buildReleasePaymentIx,
  buildDisputeJobIx,
  buildRefundJobIx,
  findJobPda,
  findEscrowVaultPda,
  parseJobAccount,
  type ParsedJob,
} from "./escrow.js";
export type { PubkeyLike } from "./pubkey.js";
export type { TierDefinition } from "./chain.js";
export type {
  DenominationInfo,
  MerkleProofResponse,
  NullifierStatusResponse,
} from "./indexer-client.js";
export type {
  Cluster,
  Commitment,
  DepositArgs,
  DepositGaslessArgs,
  DepositGaslessResult,
  Note,
  PayArgs,
  PaymentResult,
  QietrSDKConfig,
  RelayerQuote,
  SignerLike,
} from "./types.js";
export type {
  Accepts402Body,
  FetchLike,
  PaymentRequirement,
  WrapFetchOptions,
} from "./x402.js";
export type { Groth16Proof, MerkleProof, WitnessInputs } from "./prover.js";
export type { MerkleInclusionProof } from "./merkle.js";
