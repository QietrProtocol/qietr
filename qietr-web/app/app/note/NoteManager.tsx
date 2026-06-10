"use client";

import { useEffect, useState } from "react";
import {
  decryptNote,
  emptyNote,
  encryptNote,
} from "@qietr/sdk/note";
import type { Note } from "@qietr/sdk/types";
import { Card } from "../../_components/Card";
import {
  appendActivity,
  clearEncryptedNote,
  downloadBlob,
  formatUsdc,
  loadEncryptedNote,
  saveEncryptedNote,
  summarizeNote,
} from "../../_lib/storage";

type Mode = "idle" | "creating" | "restoring" | "clearing" | "loaded";

export function NoteManager() {
  const [mode, setMode] = useState<Mode>("idle");
  const [hasBlob, setHasBlob] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHasBlob(loadEncryptedNote() !== null);
  }, []);

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <Card>
        <SummaryRow note={note} hasBlob={hasBlob} />
      </Card>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-4)" }}>
        {!hasBlob && (
          <ActionButton
            label="Create a new note"
            onClick={() => {
              setMode("creating");
              setNote(null);
              setError(null);
            }}
            disabled={busy}
          />
        )}
        {hasBlob && (
          <ActionButton
            label="Unlock"
            onClick={() => {
              setMode("loaded");
              setNote(null);
              setError(null);
            }}
            disabled={busy}
          />
        )}
        <ActionButton
          label="Restore from backup"
          onClick={() => {
            setMode("restoring");
            setError(null);
          }}
          disabled={busy}
        />
        {hasBlob && (
          <ActionButton
            label="Clear from this device"
            onClick={() => {
              setMode("clearing");
              setError(null);
            }}
            disabled={busy}
            danger
          />
        )}
      </div>

      {mode === "creating" && (
        <CreateNoteForm
          busy={busy}
          onSubmit={async (passphrase) => {
            setBusy(true);
            setError(null);
            try {
              const fresh = emptyNote();
              const blob = await encryptNote(fresh, passphrase);
              saveEncryptedNote(blob);
              setHasBlob(true);
              setNote(fresh);
              setMode("loaded");
              appendActivity({ type: "backup", status: "ok", detail: "new empty note saved" });
            } catch (e) {
              setError(toMessage(e));
              appendActivity({ type: "backup", status: "error", detail: toMessage(e) });
            } finally {
              setBusy(false);
            }
          }}
          onCancel={() => setMode("idle")}
        />
      )}

      {mode === "loaded" && hasBlob && !note && (
        <UnlockForm
          busy={busy}
          onSubmit={async (passphrase) => {
            setBusy(true);
            setError(null);
            try {
              const blob = loadEncryptedNote();
              if (!blob) throw new Error("no encrypted note on this device");
              const dec = await decryptNote(blob, passphrase);
              setNote(dec);
            } catch (e) {
              setError(toMessage(e));
            } finally {
              setBusy(false);
            }
          }}
          onCancel={() => setMode("idle")}
        />
      )}

      {mode === "loaded" && note && (
        <BackupPanel
          note={note}
          busy={busy}
          onBackup={async (passphrase) => {
            setBusy(true);
            setError(null);
            try {
              const blob = await encryptNote(note, passphrase);
              saveEncryptedNote(blob);
              downloadBlob(
                `qietr-note-${new Date().toISOString().replace(/[:.]/g, "-")}.qietr.note`,
                blob,
              );
              appendActivity({ type: "backup", status: "ok", detail: "downloaded" });
            } catch (e) {
              setError(toMessage(e));
              appendActivity({ type: "backup", status: "error", detail: toMessage(e) });
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {mode === "restoring" && (
        <RestoreForm
          busy={busy}
          onSubmit={async (blob, passphrase) => {
            setBusy(true);
            setError(null);
            try {
              const dec = await decryptNote(blob.trim(), passphrase);
              saveEncryptedNote(blob.trim());
              setHasBlob(true);
              setNote(dec);
              setMode("loaded");
              appendActivity({ type: "restore", status: "ok", detail: `${dec.commitments.length} commitments` });
            } catch (e) {
              setError(toMessage(e));
              appendActivity({ type: "restore", status: "error", detail: toMessage(e) });
            } finally {
              setBusy(false);
            }
          }}
          onCancel={() => setMode("idle")}
        />
      )}

      {mode === "clearing" && (
        <ClearForm
          busy={busy}
          onSubmit={() => {
            clearEncryptedNote();
            setHasBlob(false);
            setNote(null);
            setMode("idle");
            appendActivity({ type: "clear", status: "ok" });
          }}
          onCancel={() => setMode("idle")}
        />
      )}
    </div>
  );
}

function SummaryRow({ note, hasBlob }: { note: Note | null; hasBlob: boolean }) {
  if (note) {
    const s = summarizeNote(note);
    const tiers = Object.entries(s.byTier).map(([id, n]) => `${n} × tier ${id}`).join(", ");
    return (
      <div>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Loaded note</h2>
        <p style={{ margin: 0 }}>
          {s.commitmentCount} commitments. Total {formatUsdc(s.totalMicroUsdc)}.
        </p>
        {tiers && (
          <p style={{ margin: "var(--space-2) 0 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            {tiers}
          </p>
        )}
      </div>
    );
  }
  if (hasBlob) {
    return (
      <div>
        <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Encrypted note on this device</h2>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          Enter your passphrase to decrypt and view the summary.
        </p>
      </div>
    );
  }
  return (
    <div>
      <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>No note loaded</h2>
      <p style={{ margin: 0, color: "var(--text-secondary)" }}>
        Create a fresh note or restore one from a backup file.
      </p>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-base)",
        border: `1px solid ${danger ? "var(--danger)" : "var(--border-strong)"}`,
        background: danger ? "var(--surface-0)" : "var(--surface-0)",
        color: danger ? "var(--danger)" : "var(--text-primary)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "0.9375rem",
        fontFamily: "inherit",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      style={{
        border: "1px solid var(--danger)",
        background: "var(--surface-0)",
        color: "var(--danger)",
        borderRadius: "var(--radius-base)",
        padding: "var(--space-3) var(--space-4)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span>{message}</span>
      <button
        onClick={onDismiss}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--danger)",
          cursor: "pointer",
          fontSize: "1rem",
        }}
        aria-label="dismiss"
      >
        ×
      </button>
    </div>
  );
}

function CreateNoteForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (passphrase: string) => void;
  onCancel: () => void;
}) {
  const [pp, setPp] = useState("");
  const [pp2, setPp2] = useState("");
  const mismatch = pp.length > 0 && pp2.length > 0 && pp !== pp2;

  return (
    <Card>
      <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Create a new note</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
        Pick a passphrase. Argon2id derives the encryption key. Losing the
        passphrase means losing the note. There is no recovery path.
      </p>
      <PassphraseInput value={pp} onChange={setPp} label="Passphrase" autoFocus />
      <PassphraseInput value={pp2} onChange={setPp2} label="Confirm passphrase" />
      {mismatch && (
        <p style={{ color: "var(--danger)", fontSize: "0.875rem", marginTop: "var(--space-2)" }}>
          Passphrases do not match.
        </p>
      )}
      <FormActions
        primary="Create"
        onPrimary={() => onSubmit(pp)}
        onCancel={onCancel}
        disabled={busy || pp.length < 8 || pp !== pp2}
        busy={busy}
      />
    </Card>
  );
}

function UnlockForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (passphrase: string) => void;
  onCancel: () => void;
}) {
  const [pp, setPp] = useState("");
  return (
    <Card>
      <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Unlock note</h2>
      <PassphraseInput value={pp} onChange={setPp} label="Passphrase" autoFocus />
      <FormActions
        primary="Unlock"
        onPrimary={() => onSubmit(pp)}
        onCancel={onCancel}
        disabled={busy || pp.length === 0}
        busy={busy}
      />
    </Card>
  );
}

function BackupPanel({
  note,
  busy,
  onBackup,
}: {
  note: Note;
  busy: boolean;
  onBackup: (passphrase: string) => void;
}) {
  const [pp, setPp] = useState("");
  return (
    <Card>
      <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Back up</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
        Encrypt the current in-memory note ({note.commitments.length} commitments)
        with a passphrase and download it as a <code>.qietr.note</code> file.
      </p>
      <PassphraseInput value={pp} onChange={setPp} label="Passphrase" />
      <FormActions
        primary="Back up"
        onPrimary={() => {
          onBackup(pp);
          setPp("");
        }}
        disabled={busy || pp.length < 8}
        busy={busy}
      />
    </Card>
  );
}

function RestoreForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (blob: string, passphrase: string) => void;
  onCancel: () => void;
}) {
  const [blob, setBlob] = useState("");
  const [pp, setPp] = useState("");

  return (
    <Card>
      <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)" }}>Restore from backup</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
        Paste the contents of your <code>.qietr.note</code> file below.
      </p>
      <textarea
        value={blob}
        onChange={(e) => setBlob(e.target.value)}
        placeholder="qietr.enc.v1:..."
        rows={4}
        style={{
          width: "100%",
          padding: "var(--space-3)",
          borderRadius: "var(--radius-base)",
          border: "1px solid var(--border-subtle)",
          fontFamily: "var(--font-mono)",
          fontSize: "0.875rem",
          background: "var(--surface-0)",
          color: "var(--text-primary)",
          resize: "vertical",
          marginBottom: "var(--space-3)",
        }}
      />
      <PassphraseInput value={pp} onChange={setPp} label="Passphrase" />
      <FormActions
        primary="Restore"
        onPrimary={() => onSubmit(blob, pp)}
        onCancel={onCancel}
        disabled={busy || blob.length === 0 || pp.length === 0}
        busy={busy}
      />
    </Card>
  );
}

function ClearForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const ready = typed === "CLEAR";

  return (
    <Card>
      <h2 style={{ fontSize: "1.125rem", marginBottom: "var(--space-2)", color: "var(--danger)" }}>
        Clear from this device
      </h2>
      <p style={{ marginBottom: "var(--space-4)" }}>
        This removes the encrypted blob from local storage. If you do not have
        an off-device backup, the funds tied to commitments in that note are
        unrecoverable.
      </p>
      <p style={{ marginBottom: "var(--space-2)", fontSize: "0.875rem" }}>
        Type <code>CLEAR</code> to confirm.
      </p>
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        style={{
          width: "100%",
          padding: "var(--space-3)",
          borderRadius: "var(--radius-base)",
          border: `1px solid ${ready ? "var(--danger)" : "var(--border-subtle)"}`,
          fontFamily: "var(--font-mono)",
          fontSize: "0.9375rem",
          background: "var(--surface-0)",
          color: "var(--text-primary)",
          marginBottom: "var(--space-3)",
        }}
      />
      <FormActions
        primary="Clear"
        onPrimary={onSubmit}
        onCancel={onCancel}
        disabled={busy || !ready}
        busy={busy}
        danger
      />
    </Card>
  );
}

function PassphraseInput({
  value,
  onChange,
  label,
  autoFocus,
}: {
  value: string;
  onChange: (s: string) => void;
  label: string;
  autoFocus?: boolean;
}) {
  return (
    <label style={{ display: "block", marginBottom: "var(--space-3)" }}>
      <span
        style={{
          display: "block",
          fontSize: "0.875rem",
          color: "var(--text-secondary)",
          marginBottom: "var(--space-1)",
        }}
      >
        {label}
      </span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        style={{
          width: "100%",
          padding: "var(--space-3)",
          borderRadius: "var(--radius-base)",
          border: "1px solid var(--border-subtle)",
          fontFamily: "var(--font-mono)",
          fontSize: "0.9375rem",
          background: "var(--surface-0)",
          color: "var(--text-primary)",
        }}
      />
    </label>
  );
}

function FormActions({
  primary,
  onPrimary,
  onCancel,
  disabled,
  busy,
  danger,
}: {
  primary: string;
  onPrimary: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
      <button
        onClick={onPrimary}
        disabled={disabled}
        style={{
          padding: "var(--space-3) var(--space-6)",
          borderRadius: "var(--radius-base)",
          border: "none",
          background: danger ? "var(--danger)" : "var(--accent)",
          color: "var(--text-inverse)",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: "0.9375rem",
          fontWeight: 500,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {busy ? "Working…" : primary}
      </button>
      {onCancel && (
        <button
          onClick={onCancel}
          disabled={busy}
          style={{
            padding: "var(--space-3) var(--space-6)",
            borderRadius: "var(--radius-base)",
            border: "1px solid var(--border-subtle)",
            background: "transparent",
            color: "var(--text-primary)",
            cursor: busy ? "not-allowed" : "pointer",
            fontSize: "0.9375rem",
          }}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

function toMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
