import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Button — encodes the app's existing button language (brand-500 primary,
 * rounded-lg, 200ms transitions, brand focus ring). No new colors.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none motion-reduce:transition-none",
  {
    variants: {
      variant: {
        primary: "bg-brand-500 text-white hover:bg-brand-600 shadow-sm hover:shadow-card",
        secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50",
        ghost: "text-gray-600 hover:bg-gray-100",
        subtle: "bg-brand-50 text-brand-700 hover:bg-brand-100",
        danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-6 text-sm",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
            {children}
          </>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
