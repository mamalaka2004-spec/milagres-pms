import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Spinner — consistent loading indicator. */
export function Spinner({ className, size = 16 }: { className?: string; size?: number }) {
  return <Loader2 className={cn("animate-spin text-gray-400", className)} size={size} aria-hidden="true" />;
}
