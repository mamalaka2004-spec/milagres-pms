"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Rating 1–5 estrelas. Sem onChange = somente leitura. */
export function StarRating({
  value,
  onChange,
  size = 14,
}: {
  value: number | null | undefined;
  onChange?: (v: number | null) => void;
  size?: number;
}) {
  const v = value ?? 0;
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n === v ? null : n)}
          className={cn(!onChange && "cursor-default", onChange && "hover:scale-110")}
          title={onChange ? `${n} estrela(s)${n === v ? " — clique para limpar" : ""}` : undefined}
        >
          <Star
            size={size}
            className={n <= v ? "fill-amber-400 text-amber-400" : "text-gray-200"}
          />
        </button>
      ))}
    </div>
  );
}
