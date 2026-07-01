// ===========================================================================
// CRM Funil (deals) + Tags — app-level types (Fase 2)
// Hand-written (the new tables live in migration 023 and are accessed via
// `(supabase.from(...) as any)`, same pattern as whatsapp_quick_replies).
// ===========================================================================
import type { WaLinePurpose } from "@/types/database";

export type FunnelType = "locacao" | "vendas";

export const FUNNEL_TYPES: readonly FunnelType[] = ["locacao", "vendas"] as const;

export const FUNNEL_TYPE_META: Record<FunnelType, { label: string; short: string }> = {
  locacao: { label: "Locação (Reservas)", short: "Locação" },
  vendas: { label: "Vendas (Corretagem)", short: "Vendas" },
};

/** Locação usa a linha WhatsApp `booking`; Vendas usa `sales`. */
export function linePurposeForType(type: FunnelType): WaLinePurpose {
  return type === "vendas" ? "sales" : "booking";
}

export function typeForLinePurpose(purpose: WaLinePurpose | string | null | undefined): FunnelType {
  return purpose === "sales" ? "vendas" : "locacao";
}

export interface FunnelPipeline {
  id: string;
  company_id: string;
  type: FunnelType;
  name: string;
  color: string;
  is_default: boolean;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FunnelStage {
  id: string;
  pipeline_id: string;
  name: string;
  color: string;
  slug: string | null;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  company_id: string;
  type: FunnelType;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export type DealStatus = "open" | "won" | "lost";

export interface FunnelDeal {
  id: string;
  company_id: string;
  pipeline_id: string;
  stage_id: string;
  conversation_id: string | null;
  contact_id: string | null;
  property_id: string | null;
  title: string;
  value: number;
  currency: string;
  expected_close_date: string | null;
  owner_id: string | null;
  status: DealStatus;
  lost_reason: string | null;
  notes: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Enriquecido para o kanban: deal + joins + tags. Deals "virtuais" são conversas
 *  sem negócio criado (ficam na coluna "Sem etapa" até serem arrastadas). */
export interface DealCardData extends Omit<FunnelDeal, "stage_id"> {
  stage_id: string | null;
  tags: Tag[];
  contact_name: string | null;
  contact_phone: string | null;
  property_name: string | null;
  unread_count: number;
  last_message_at: string | null;
  virtual?: boolean;
}

export interface BoardData {
  pipeline: FunnelPipeline | null;
  pipelines: FunnelPipeline[];
  stages: FunnelStage[];
  deals: DealCardData[];
}

/** Coluna virtual para conversas ainda sem negócio. */
export const VIRTUAL_STAGE_ID = "__unassigned__";
/** Prefixo do id de um deal virtual (conversa sem negócio). */
export const VIRTUAL_DEAL_PREFIX = "conv:";

export function isVirtualDealId(id: string): boolean {
  return id.startsWith(VIRTUAL_DEAL_PREFIX);
}
export function conversationIdFromVirtual(id: string): string {
  return id.slice(VIRTUAL_DEAL_PREFIX.length);
}

/** Paleta de cores para pipelines/stages/tags (mesma do Vita). */
export const TAG_COLORS = [
  "#94a3b8",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#ef4444",
  "#0ea5e9",
  "#c9a84c",
  "#6b7280",
] as const;
