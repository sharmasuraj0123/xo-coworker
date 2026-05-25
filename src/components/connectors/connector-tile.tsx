"use client";

import type { ConnectorCardStatus } from "@/components/connectors/connector-card";

const STATUS_DOT: Record<ConnectorCardStatus, string> = {
  connected: "bg-emerald-500",
  needs_auth: "bg-amber-500",
  failed: "bg-red-500",
  disconnected: "bg-zinc-400",
  pending: "bg-amber-500",
};

const STATUS_LABEL: Record<ConnectorCardStatus, string> = {
  connected: "Connected",
  needs_auth: "Needs auth",
  failed: "Failed",
  disconnected: "Not connected",
  pending: "Pending",
};

type Props = {
  icon: React.ReactNode;
  name: string;
  status: ConnectorCardStatus;
  onClick: () => void;
};

/**
 * Compact launcher tile — icon + name, with a small status dot in the
 * top-right corner. Click opens the connector's detail UI (either a custom
 * modal or the shared ConnectorDetailDialog).
 */
export function ConnectorTile({ icon, name, status, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex aspect-square min-h-[104px] flex-col items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] p-3 transition-colors hover:bg-[var(--surface-tertiary)]"
    >
      <span
        className={`absolute right-2 top-2 h-2 w-2 rounded-full ${STATUS_DOT[status]}`}
        title={STATUS_LABEL[status]}
        aria-label={STATUS_LABEL[status]}
      />
      <div className="flex h-9 w-9 items-center justify-center text-[var(--text-primary)]">
        {icon}
      </div>
      <span className="line-clamp-2 w-full text-center text-[11px] font-medium leading-tight text-[var(--text-primary)]">
        {name}
      </span>
    </button>
  );
}
