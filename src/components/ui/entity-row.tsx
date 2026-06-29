import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * EntityAvatar — the recurring "cover image or initial" tile used in list rows
 * (reservations, properties, calendar). Falls back to a brand-tinted initial,
 * or a custom icon node, when there's no image.
 */
interface EntityAvatarProps {
  src?: string | null;
  name?: string | null;
  icon?: React.ReactNode;
  size?: number;
  className?: string;
  rounded?: "lg" | "md" | "full";
}

export function EntityAvatar({
  src,
  name,
  icon,
  size = 36,
  className,
  rounded = "lg",
}: EntityAvatarProps) {
  const radius = rounded === "full" ? "rounded-full" : rounded === "md" ? "rounded-md" : "rounded-lg";
  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden bg-brand-500/10 text-brand-600 flex items-center justify-center text-sm font-bold",
        radius,
        className
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
      ) : icon ? (
        icon
      ) : (
        (name || "?").charAt(0).toUpperCase()
      )}
    </div>
  );
}

/**
 * DataList — a card that holds a vertical list of EntityRows with hairline
 * dividers. Use as the container around `EntityRow` items.
 */
export function DataList({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-gray-200 shadow-card overflow-hidden divide-y divide-gray-100",
        className
      )}
      {...props}
    />
  );
}

/**
 * EntityRow — one row in a DataList: leading visual, title (+ optional inline
 * extras), subtitle, optional meta block (hidden on small screens) and a
 * trailing slot (usually a StatusBadge). Renders as a Link when `href` is set.
 */
interface EntityRowProps {
  href?: string;
  onClick?: () => void;
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}

export function EntityRow({
  href,
  onClick,
  leading,
  title,
  subtitle,
  meta,
  trailing,
  className,
}: EntityRowProps) {
  const inner = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-semibold text-sm text-gray-900 truncate">
          {title}
        </div>
        {subtitle && <div className="text-xs text-gray-500 truncate">{subtitle}</div>}
      </div>
      {meta && (
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 tabular-nums shrink-0">
          {meta}
        </div>
      )}
      {trailing && <div className="shrink-0">{trailing}</div>}
    </>
  );

  const base =
    "flex items-center gap-3 px-4 py-3 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/30 focus-visible:ring-inset";

  if (href) {
    return (
      <Link href={href} className={cn(base, "hover:bg-brand-50/40", className)}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(base, "w-full text-left hover:bg-brand-50/40", className)}>
        {inner}
      </button>
    );
  }
  return <div className={cn(base, className)}>{inner}</div>;
}
