import { cn } from "@/lib/utils/cn";

/** Initials avatar for chat. `accent` keeps each surface's color (no new hues). */
export function Avatar({ name, accent = "brand" }: { name: string; accent?: "brand" | "amber" }) {
  const initials = (name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
        accent === "amber" ? "bg-amber-500/15 text-amber-700" : "bg-brand-500/15 text-brand-700"
      )}
    >
      {initials.slice(0, 2)}
    </div>
  );
}
