import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/** Badge — pill using existing tones only (no new hues). */
const badgeVariants = cva(
  "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-gray-100 text-gray-600",
        brand: "bg-brand-50 text-brand-700",
        success: "bg-green-50 text-green-700",
        warning: "bg-amber-50 text-amber-700",
        danger: "bg-rose-50 text-rose-700",
        info: "bg-blue-50 text-blue-700",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
