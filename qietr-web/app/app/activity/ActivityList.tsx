"use client";

import { useEffect, useState } from "react";
import {
  ACTIVITY_CHANGED_EVENT,
  type ActivityEntry,
  clearActivity,
  loadActivity,
} from "../../_lib/storage";
import { Card } from "../../_components/Card";

export function ActivityList() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [confirming, setConfirming] = useState(false);

  const refresh = () => setEntries(loadActivity());

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    // `storage` covers other tabs; the custom event covers same-tab
    // updates (e.g. backup/restore/clear actions from /app/note in this
    // same page session).
    window.addEventListener("storage", handler);
    window.addEventListener(ACTIVITY_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener(ACTIVITY_CHANGED_EVENT, handler);
    };
  }, []);

  if (entries.length === 0) {
    return (
      <Card>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          No activity yet. Backup, restore, and clear actions from the note
          manager are recorded here.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}>
        {confirming ? (
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button
              onClick={() => {
                clearActivity();
                refresh();
                setConfirming(false);
              }}
              style={confirmBtn(true)}
            >
              Confirm clear
            </button>
            <button onClick={() => setConfirming(false)} style={confirmBtn(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            style={{
              background: "transparent",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-base)",
              padding: "var(--space-2) var(--space-4)",
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Clear activity log
          </button>
        )}
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.9375rem",
        }}
      >
        <thead>
          <tr style={{ textAlign: "left", color: "var(--text-secondary)" }}>
            <th style={th}>When</th>
            <th style={th}>Type</th>
            <th style={th}>Status</th>
            <th style={th}>Detail</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr
              key={e.id}
              style={{
                background: i % 2 === 0 ? "var(--surface-1)" : "transparent",
              }}
            >
              <td style={td}>{formatTimestamp(e.timestamp)}</td>
              <td style={td}>{e.type}</td>
              <td
                style={{
                  ...td,
                  color: e.status === "ok" ? "var(--success)" : "var(--danger)",
                }}
              >
                {e.status}
              </td>
              <td style={{ ...td, color: "var(--text-secondary)" }}>{e.detail ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "var(--space-3) var(--space-3)",
  borderBottom: "1px solid var(--border-subtle)",
  fontWeight: 500,
};

const td: React.CSSProperties = {
  padding: "var(--space-3) var(--space-3)",
  borderBottom: "1px solid var(--border-subtle)",
};

function confirmBtn(danger: boolean): React.CSSProperties {
  return {
    background: danger ? "var(--danger)" : "transparent",
    color: danger ? "var(--text-inverse)" : "var(--text-primary)",
    border: `1px solid ${danger ? "var(--danger)" : "var(--border-subtle)"}`,
    borderRadius: "var(--radius-base)",
    padding: "var(--space-2) var(--space-4)",
    fontSize: "0.875rem",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
