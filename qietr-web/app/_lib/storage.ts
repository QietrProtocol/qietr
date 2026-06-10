// =============================================================================
// storage.ts — small localStorage helpers used by /app/note and /app/activity.
//
// We do NOT store plaintext notes here. The note manager keeps the
// encrypted blob (qietr.enc.v1:...). Decryption only ever happens in
// memory, in response to user passphrase entry.
// =============================================================================

import type { Note } from "@qietr/sdk/types";

const KEY_NOTE_BLOB = "qietr.note.v1.encrypted";
const KEY_ACTIVITY = "qietr.activity.v1";

/**
 * Custom event fired after every write to `qietr.activity.v1`. The native
 * `storage` event only fires across tabs, so same-tab listeners (the
 * /app/activity table) miss updates from /app/note actions on the same
 * page session without this hook.
 */
export const ACTIVITY_CHANGED_EVENT = "qietr:activity-changed";

function emitActivityChanged(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(ACTIVITY_CHANGED_EVENT));
}

export type ActivityType =
  | "backup"
  | "restore"
  | "clear"
  | "deposit"
  | "payment";

export interface ActivityEntry {
  id: string;
  timestamp: number;
  type: ActivityType;
  status: "ok" | "error";
  detail?: string;
}

export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadEncryptedNote(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(KEY_NOTE_BLOB);
}

export function saveEncryptedNote(blob: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY_NOTE_BLOB, blob);
}

export function clearEncryptedNote(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEY_NOTE_BLOB);
}

export function loadActivity(): ActivityEntry[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(KEY_ACTIVITY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ActivityEntry[];
  } catch {
    return [];
  }
}

export function appendActivity(entry: Omit<ActivityEntry, "id" | "timestamp">): void {
  if (!isBrowser()) return;
  const all = loadActivity();
  const full: ActivityEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  all.unshift(full);
  // Bound the log so localStorage can't grow without limit.
  const bounded = all.slice(0, 200);
  window.localStorage.setItem(KEY_ACTIVITY, JSON.stringify(bounded));
  emitActivityChanged();
}

export function clearActivity(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEY_ACTIVITY);
  emitActivityChanged();
}

/** Summary derived from a decrypted note. Safe to render. */
export interface NoteSummary {
  commitmentCount: number;
  totalMicroUsdc: number;
  byTier: Record<number, number>;
}

export function summarizeNote(note: Note): NoteSummary {
  const byTier: Record<number, number> = {};
  let total = 0;
  for (const c of note.commitments) {
    byTier[c.denomId] = (byTier[c.denomId] ?? 0) + 1;
    total += c.amount;
  }
  return {
    commitmentCount: note.commitments.length,
    totalMicroUsdc: total,
    byTier,
  };
}

export function formatUsdc(microUsdc: number): string {
  const n = microUsdc / 1_000_000;
  return n.toFixed(n < 1 ? 6 : 2) + " USDC";
}

export function downloadBlob(filename: string, contents: string): void {
  if (!isBrowser()) return;
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
