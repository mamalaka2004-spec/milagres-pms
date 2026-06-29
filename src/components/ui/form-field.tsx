import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

/**
 * FormField — pairs a Label with any control and renders an error or hint line
 * beneath it. Keeps form spacing and the uppercase label style consistent.
 * Pass `htmlFor` + the control's `id` for proper label association.
 */
interface FormFieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  error?: string | null;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
}
