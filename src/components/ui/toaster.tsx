"use client";

import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/components/ui/use-toast";

const ICONS = {
  default: Info,
  success: CheckCircle2,
  error: AlertCircle,
} as const;

const ICON_TONE = {
  default: "text-brand-500",
  success: "text-green-600",
  error: "text-rose-600",
} as const;

/**
 * Toaster — single mount point for the toast queue. Drop once near the root of
 * the dashboard layout; trigger toasts anywhere with `toast({ ... })`.
 */
export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(({ id, title, description, variant = "default", open, onOpenChange, duration }) => {
        const Icon = ICONS[variant];
        return (
          <Toast
            key={id}
            variant={variant}
            open={open}
            onOpenChange={onOpenChange}
            duration={duration}
          >
            <Icon size={18} className={`mt-0.5 shrink-0 ${ICON_TONE[variant]}`} aria-hidden="true" />
            <div className="grid gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
