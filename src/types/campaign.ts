// ===========================================================================
// Campanhas + Disparo em massa — app-level types
// Tabelas das migrations 024 + 036. Acessadas via `(supabase.from(...) as any)`.
// ===========================================================================

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "paused"
  | "sent"
  | "failed"
  | "cancelled";

export type RecipientStatus =
  | "pending"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "skipped"
  | "replied"
  | "opted_out";

export const CAMPAIGN_STATUS_META: Record<CampaignStatus, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "#6b7280" },
  scheduled: { label: "Agendada", color: "#3b82f6" },
  sending: { label: "Enviando", color: "#f59e0b" },
  paused: { label: "Pausada", color: "#8b5cf6" },
  sent: { label: "Concluída", color: "#10b981" },
  failed: { label: "Falhou", color: "#ef4444" },
  cancelled: { label: "Cancelada", color: "#9ca3af" },
};

export const RECIPIENT_STATUS_META: Record<RecipientStatus, { label: string; color: string }> = {
  pending: { label: "Na fila", color: "#6b7280" },
  sending: { label: "Enviando", color: "#f59e0b" },
  sent: { label: "Enviada", color: "#3b82f6" },
  delivered: { label: "Entregue", color: "#10b981" },
  failed: { label: "Falhou", color: "#ef4444" },
  skipped: { label: "Pulado", color: "#9ca3af" },
  replied: { label: "Respondeu", color: "#10b981" },
  opted_out: { label: "Opt-out", color: "#ef4444" },
};

/** Janela de envio (dias 0=dom…6=sáb, horários locais do timezone). */
export interface CampaignSchedule {
  timezone: string;
  days: number[];
  start_time: string;
  end_time: string;
}

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
  /** @deprecated 024 — o motor usa min/max_interval_seconds. */
  throttle_seconds: number;
  min_interval_seconds: number;
  max_interval_seconds: number;
  daily_limit: number;
  hourly_limit: number;
  schedule: CampaignSchedule;
  simulate_typing: boolean;
  typing_seconds_min: number;
  typing_seconds_max: number;
  opt_out_keywords: string[];
  skip_active_conversations: boolean;
  audience: { list_ids?: string[] } | null;
  target_pipeline_id: string | null;
  target_stage_id: string | null;
  total_count: number;
  sent_count: number;
  failed_count: number;
  delivered_count: number;
  read_count: number;
  replied_count: number;
  opted_out_count: number;
  created_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  /** Derivado (não é coluna): próximo envio agendado das campanhas ativas. */
  next_send_at?: string | null;
}

export type CampaignStepKind = "template" | "ai";

export interface CampaignStep {
  id: string;
  campaign_id: string;
  order_index: number;
  kind: CampaignStepKind;
  body: string | null;
  ai_prompt: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  wait_hours: number;
  variant: string;
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
  scheduled_for: string | null;
  variables: Record<string, string>;
  attempts: number;
  current_step: number;
  variant: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  replied_at: string | null;
  opted_out_at: string | null;
  created_at: string;
}

// ─── Listas de contatos (contact_lists / contact_list_members) ─────────────
export interface ContactList {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Preenchido pelas queries de listagem (não é coluna). */
  member_count?: number;
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
  do_not_contact?: boolean;
  tags?: string[];
  rating?: number | null;
  notes?: string | null;
  source?: string | null;
  created_at?: string;
  /** Nome estruturado (migration 040) — base de {{primeiro_nome}}. */
  first_name?: string | null;
  last_name?: string | null;
  social_name?: string | null;
  name_reviewed_at?: string | null;
}

export const CONTACT_CATEGORY_LABELS: Record<string, string> = {
  guest: "Hóspede",
  guest_maybe: "Hóspede?",
  lead: "Lead",
  provider: "Fornecedor",
  spam: "Spam",
  personal: "Pessoal",
};
