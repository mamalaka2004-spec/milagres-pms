import type { Json } from "@/types/database";

/**
 * App mode (#8). One login, one base — the whole shell flips between Locação
 * (short-stay rentals) and Vendas (real-estate brokerage / corretagem). The
 * active mode drives nav visibility and data scope.
 */
export type Mode = "locacao" | "vendas";

export const MODES: readonly Mode[] = ["locacao", "vendas"] as const;
export const DEFAULT_MODE: Mode = "locacao";

/** localStorage key mirroring the active mode for instant client-side restore. */
export const MODE_STORAGE_KEY = "milagres:mode";

export const MODE_META: Record<Mode, { label: string; short: string; description: string }> = {
  locacao: {
    label: "Locação",
    short: "Locação",
    description: "Reservas, hóspedes e operação das hospedagens",
  },
  vendas: {
    label: "Vendas",
    short: "Vendas",
    description: "Corretagem imobiliária — venda de imóveis",
  },
};

export function isMode(value: unknown): value is Mode {
  return value === "locacao" || value === "vendas";
}

/** Reads the active mode out of a user's `preferences` blob; null when unset. */
export function modeFromPreferences(preferences: Json | null | undefined): Mode | null {
  if (preferences && typeof preferences === "object" && !Array.isArray(preferences)) {
    const m = (preferences as Record<string, unknown>).mode;
    if (isMode(m)) return m;
  }
  return null;
}
