"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ConnectorCardStatus =
  | "connected"
  | "needs_auth"
  | "failed"
  | "disconnected"
  | "pending";

const STATUS_DOT: Record<ConnectorCardStatus, string> = {
  connected: "bg-emerald-500",
  needs_auth: "bg-amber-500",
  failed: "bg-red-500",
  disconnected: "bg-zinc-400",
  pending: "bg-amber-500",
};

const STATUS_DEFAULT_LABEL: Record<ConnectorCardStatus, string> = {
  connected: "Connected",
  needs_auth: "Needs auth",
  failed: "Failed",
  disconnected: "Not connected",
  pending: "Pending",
};

type Action = {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "outline";
};

type Props = {
  icon: React.ReactNode;
  name: string;
  description: string;
  status: ConnectorCardStatus;
  statusLabel?: string;
  primaryAction: Action;
  secondaryAction?: Action;
  badge?: React.ReactNode;
  children?: React.ReactNode;
};

/**
 * Shared visual chrome for every connector in the Connectors tab. Purely
 * presentational — connect/disconnect/poll logic lives in the caller.
 */
export function ConnectorCard({
  icon,
  name,
  description,
  status,
  statusLabel,
  primaryAction,
  secondaryAction,
  badge,
  children,
}: Props) {
  const label = statusLabel ?? STATUS_DEFAULT_LABEL[status];

  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] p-4">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-tertiary)] text-[var(--text-primary)]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">
              {name}
            </h3>
            {badge}
          </div>
          <p className="line-clamp-2 text-xs text-[var(--text-secondary)]">
            {description}
          </p>
        </div>
      </header>

      <div
        className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]"
        title={label}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} />
        <span className="max-w-[160px] truncate">{label}</span>
      </div>

      {children}

      <div className="mt-auto flex flex-col gap-1.5">
        <ActionButton {...primaryAction} fallbackIcon={<ExternalLink className="h-3.5 w-3.5" />} />
        {secondaryAction && <ActionButton {...secondaryAction} variant={secondaryAction.variant ?? "ghost"} />}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  icon,
  loading,
  disabled,
  variant = "primary",
  fallbackIcon,
}: Action & { fallbackIcon?: React.ReactNode }) {
  const buttonVariant =
    variant === "ghost" ? "ghost" : variant === "outline" ? "outline" : undefined;
  return (
    <Button
      className="w-full gap-2"
      variant={buttonVariant}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        icon ?? fallbackIcon
      )}
      <span className="text-xs">{label}</span>
    </Button>
  );
}
