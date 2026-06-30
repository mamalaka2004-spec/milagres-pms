import type { Mode } from "./types";
import type { WaLinePurpose } from "@/types/database";

/**
 * Data-scope helper per mode (#8). Centralizes "what does this mode mean for the
 * data layer" so queries/components don't hardcode the Locação↔Vendas mapping.
 *
 * In Fase 1B this mainly powers nav + the WhatsApp/CRM split (booking vs sales
 * lines). Later phases (funnels, tags, contacts) reuse the same mapping.
 */
export interface ModeScope {
  /** WhatsApp line purpose backing this mode's chat. */
  waLinePurpose: WaLinePurpose;
  /** Route of this mode's chat inbox. */
  chatHref: string;
}

export const MODE_SCOPE: Record<Mode, ModeScope> = {
  locacao: { waLinePurpose: "booking", chatHref: "/conversations" },
  vendas: { waLinePurpose: "sales", chatHref: "/vendas" },
};

export function dataScopeForMode(mode: Mode): ModeScope {
  return MODE_SCOPE[mode];
}

/**
 * Maps a mode-specific route to the mode it belongs to. Routes shared by both
 * modes (dashboard, properties, settings…) return null. Useful to keep the
 * switcher in sync when the user deep-links into a mode-specific screen.
 */
const MODE_ROUTE_PREFIXES: Array<{ prefix: string; mode: Mode }> = [
  { prefix: "/conversations", mode: "locacao" },
  { prefix: "/reservations", mode: "locacao" },
  { prefix: "/calendar", mode: "locacao" },
  { prefix: "/guests", mode: "locacao" },
  { prefix: "/operations", mode: "locacao" },
  { prefix: "/market", mode: "locacao" },
  { prefix: "/vendas", mode: "vendas" },
];

export function modeForPathname(pathname: string): Mode | null {
  const match = MODE_ROUTE_PREFIXES.find((r) => pathname.startsWith(r.prefix));
  return match ? match.mode : null;
}
