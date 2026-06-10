import type { Commitment, Note } from "./types.js";

export const USDC_DECIMALS = 6;

export function formatUSDCAmount(microAmount: number | bigint): string {
  return (Number(microAmount) / 10 ** USDC_DECIMALS).toFixed(USDC_DECIMALS);
}

export function parseUSDCAmount(amountStr: string): number {
  const clean = amountStr.replace(/[$,]/g, "");
  const num = parseFloat(clean);
  if (isNaN(num) || num < 0) throw new Error(`invalid USDC amount: ${amountStr}`);
  return Math.round(num * 10 ** USDC_DECIMALS);
}

export function getNoteBalance(note: Note | null): number {
  if (!note) return 0;
  return note.commitments.reduce((sum, c) => sum + c.amount, 0);
}

export function hasEnoughBalance(note: Note | null, amountMicroUsdc: number | bigint): boolean {
  return getNoteBalance(note) >= Number(amountMicroUsdc);
}

export function getCommitmentCount(note: Note | null): number {
  if (!note) return 0;
  return note.commitments.length;
}

export function getLargestCommitment(note: Note | null): Commitment | null {
  if (!note || note.commitments.length === 0) return null;
  return note.commitments.reduce((max, c) => (c.amount > max.amount ? c : max));
}

const DEFAULT_FEE_BPS = 100; // 1%
const FEE_THRESHOLD_MICRO = 10_000_000; // 10 USDC

export function calculateFee(
  amountMicroUsdc: number | bigint,
  feeBps: number = DEFAULT_FEE_BPS,
  thresholdMicroUsdc: number | bigint = FEE_THRESHOLD_MICRO,
): number {
  const amt = Number(amountMicroUsdc);
  if (amt < Number(thresholdMicroUsdc)) return 0;
  return Math.round(amt * feeBps / 10000);
}
