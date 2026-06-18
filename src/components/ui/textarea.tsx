import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-300 transition-colors duration-200 focus:outline-none focus:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-400/30 disabled:bg-gray-50 disabled:text-gray-400",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
