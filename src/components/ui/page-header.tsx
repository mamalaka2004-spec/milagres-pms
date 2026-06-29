import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * PageHeader — the consistent top-of-screen header: optional back button, an
 * eyebrow line (e.g. a booking code), the title with inline badges, a subtitle,
 * and right-aligned actions. Wraps so actions drop below the title on mobile.
 */
interface PageHeaderProps {
  title: React.ReactNode;
  /** Small line above the title (mono/code, breadcrumb-ish). */
  eyebrow?: React.ReactNode;
  /** Line below the title. */
  subtitle?: React.ReactNode;
  /** Inline content right of the title (status badges). */
  badges?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  badges,
  backHref,
  backLabel = "Voltar",
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start gap-3 flex-wrap", className)}>
      {backHref && (
        <Link
          href={backHref}
          aria-label={backLabel}
          className="mt-0.5 p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
      )}

      <div className="flex-1 min-w-0">
        {eyebrow && (
          <div className="font-mono text-xs text-gray-400 leading-tight">{eyebrow}</div>
        )}
        <h1 className="font-heading text-[1.6rem] lg:text-[2rem] font-semibold text-gray-900 leading-[1.1] inline-flex items-center gap-2.5 flex-wrap">
          <span className="min-w-0">{title}</span>
          {badges}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>

      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
