"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

/**
 * Modal frame for a single connector's full UI. The body is intentionally a
 * thin wrapper — the caller passes its existing <ConnectorCard>...</ConnectorCard>
 * tree as children, so all inline content (token forms, scheme picker, error
 * alerts, switches) keeps working unchanged.
 */
export function ConnectorDetailDialog({ open, onOpenChange, children }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0">
        <DialogPrimitive.Title className="sr-only">
          Connector details
        </DialogPrimitive.Title>
        <div className="p-2">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
