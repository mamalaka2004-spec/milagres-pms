import * as React from "react";
import { cn } from "@/lib/utils/cn";

/** Skeleton placeholder — neutral pulse, used in loading states. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-gray-100", className)} {...props} />;
}
