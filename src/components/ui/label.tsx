import * as React from "react";
import { cn } from "@/lib/utils/cn";

/** Field label — matches the app's uppercase tracked label style. */
export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("block text-[11px] font-semibold uppercase tracking-wider text-gray-500", className)}
      {...props}
    />
  )
);
Label.displayName = "Label";
