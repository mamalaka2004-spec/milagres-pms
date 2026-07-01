// ===========================================================================
// Campanhas + Disparo em massa — app-level types (Fase 2 / Etapa B)
// Tabelas da migration 024. Acessadas via `(supabase.from(...) as any)`.
// ===========================================================================

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";
export type RecipientStatus = "pending" | "sending" | "sent" | "delivered" | "failed" | "skipped";

export const CAMPAIGN_STATUS_META: Record<CampaignStatus, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "#6b7280" },
  scheduled: { label: "Agendada", color: "#3b82f6" },
  sending: { label: "Enviando", color: "#f59e0b" },
  sent: { label: "Concluída", color: "#10b981" },
  failed: { label: "Falhou", color: "#ef4444" },
  cancelled: { label: "Cancelada", color: "#9ca3af" },
};

export interface Campaign {
  id: string;
  company_id: string;
  name: string;
  line_id: string | null;
  message_template: string;
  media_url: string | null;
  media_mime_type: string | null;
  status: CampaignStatus;
  scheduled_at: string | null;
  throttle_seconds: number;
  target_pipeline_id: string | null;
  target_stage_id: string | null;
  total_count: number;
  sent_count: number;
  failed_count: number;
  created_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  deal_id: string | null;
  phone_e164: string;
  phone_canonical: string | null;
  name: string | null;
  status: RecipientStatus;
  error: string | null;
  external_id: string | null;
  sent_at: string | null;
  created_at: string;
}

/** Contato do fonebook (whatsapp_contacts) — usado nos seletores cross-base. */
export interface ContactLite {
  id: string;
  display_name: string | null;
  phone_e164: string | null;
  phone_canonical: string;
  category: string | null;
  unit_hint: string | null;
  line_id: string | null;
}

export const CONTACT_CATEGORY_LABELS: Record<string, string> = {
  guest: "Hóspede",
  guest_maybe: "Hóspede?",
  lead: "Lead",
  provider: "Fornecedor",
  spam: "Spam",
  personal: "Pessoal",
};
