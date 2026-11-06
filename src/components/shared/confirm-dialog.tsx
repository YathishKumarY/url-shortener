"use client";

import { useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { pill } from "@/components/shared/ui-kit";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<unknown> | unknown;
}

/** Confirmation step for destructive actions (previously links deleted on one click). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <div className="flex gap-4">
          {destructive && (
            <div className="bg-destructive/12 text-destructive flex size-10 shrink-0 items-center justify-center rounded-full">
              <TriangleAlert className="size-5" />
            </div>
          )}
          <div className="min-w-0">
            <DialogTitle className="text-foreground text-base font-semibold">{title}</DialogTitle>
            {description && (
              <DialogDescription className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                {description}
              </DialogDescription>
            )}
          </div>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            className={cn(pill.secondary, pill.small)}
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(destructive ? pill.danger : pill.primary, pill.small)}
            onClick={handleConfirm}
            disabled={busy}
            autoFocus
          >
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
