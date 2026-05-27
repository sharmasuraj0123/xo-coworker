"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: React.ReactNode;
  name: string;
  description?: string;
  children: React.ReactNode;
};

/**
 * Shared modal shell for custom (non-Composio) connectors that have bespoke
 * auth flows (token forms, picker UIs, OAuth callbacks). Provides the same
 * Dialog chrome, icon-and-title header, and close affordance that the
 * Composio popover (ConnectorDetailDialog + ConnectorCard) uses, so every
 * tile click feels the same regardless of which connector backs it.
 *
 * Connectors retain their own body content (forms, ConnectedView, etc.) —
 * this only unifies the surrounding frame.
 */
export function ConnectorModalShell({
  open,
  onOpenChange,
  icon,
  name,
  description,
  children,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0">
        <DialogPrimitive.Title className="sr-only">{name}</DialogPrimitive.Title>
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start gap-3 border-b border-[var(--border-default)] px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-tertiary)] text-[var(--text-primary)]">
              {icon}
            </div>
            <div className="min-w-0 flex-1 pr-7">
              <h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {name}
              </h2>
              {description && (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--text-secondary)]">
                  {description}
                </p>
              )}
            </div>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
