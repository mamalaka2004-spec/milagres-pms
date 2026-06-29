"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * ConfirmDialog — the project's "alert dialog": a focused yes/no confirmation
 * built on the Dialog primitive (Radix ships no alert-dialog package here).
 * Use for destructive or irreversible actions (cancel reservation, delete).
 * Controlled via `open`/`onOpenChange`; `onConfirm` may be async — the confirm
 * button shows a spinner while it resolves.
 */
export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  /** Optional extra content (e.g. a reason input) rendered above the actions. */
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  loading = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [busy, setBusy] = React.useState(false);
  const pending = loading || busy;

  const handleConfirm = async () => {
    try {
      setBusy(true);
      await onConfirm();
    } catch {
      // Caller surfaces the error (e.g. via toast); keep the dialog open.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md" hideClose>
        <DialogHeader className="pr-5">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                variant === "danger" ? "bg-rose-50 text-rose-600" : "bg-brand-50 text-brand-600"
              )}
            >
              <AlertTriangle size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription className="mt-1">{description}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>

        {children && <DialogBody className="pt-0">{children}</DialogBody>}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="primary"
            className={cn(
              variant === "danger" && "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-400/40"
            )}
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
