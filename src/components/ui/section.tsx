import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Section — the standard padded card section used across detail/settings
 * screens: white rounded-xl surface with an optional uppercase eyebrow title,
 * description, and right-aligned actions. Replaces the per-screen `Section`
 * helpers that were copy-pasted around the app.
 */
interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Remove inner padding (e.g. when wrapping a flush list/table). */
  flush?: boolean;
  /** Apply the default vertical rhythm between children. */
  stack?: boolean;
}

export function Section({
  title,
  description,
  actions,
  flush = false,
  stack = true,
  className,
  children,
  ...props
}: SectionProps) {
  const hasHeader = Boolean(title || actions || description);
  return (
    <section
      className={cn(
        "bg-white rounded-2xl border border-gray-200 shadow-card",
        !flush && "p-5",
        className
      )}
      {...props}
    >
      {hasHeader && (
        <div className={cn("flex items-start justify-between gap-3", flush ? "px-5 pt-5 pb-3" : "mb-3")}>
          <div className="min-w-0">
            {title && (
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">{title}</h2>
            )}
            {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(stack && "space-y-3")}>{children}</div>
    </section>
  );
}
