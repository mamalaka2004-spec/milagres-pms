// ===========================================================================
// Créditos / tokens de IA — tipos (Fase 9, #27, migration 030)
// Hand-written: as tabelas (ai_credit_accounts / ai_credit_ledger) são
// acessadas via `(supabase.from(...) as any)`, mesmo padrão de finance/funnel.
// PROVIDER-AGNOSTIC: nenhum gateway de pagamento envolvido aqui.
// ===========================================================================

export type AiCreditEntryType =
  | "consumption"
  | "topup"
  | "grant"
  | "refund"
  | "adjustment";

export interface AiCreditAccount {
  id: string;
  company_id: string;
  plan: string;
  balance_credits: number;
  monthly_included_credits: number;
  low_balance_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface AiCreditLedgerEntry {
  id: string;
  company_id: string;
  account_id: string;
  entry_type: AiCreditEntryType;
  credits: number;
  tokens_used: number | null;
  balance_after: number;
  source: string | null;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  created_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Resumo agregado do mês corrente para o painel de créditos. */
export interface AiCreditUsageSummary {
  consumption_credits: number;
  consumption_tokens: number;
  topup_credits: number;
  entries_count: number;
}

/** Payload completo da tela Ajustes → Créditos de IA. */
export interface AiCreditOverview {
  account: AiCreditAccount;
  usage_month: AiCreditUsageSummary;
  ledger: AiCreditLedgerEntry[];
  /** true quando balance_credits <= low_balance_threshold. */
  low_balance: boolean;
}

export const AI_CREDIT_ENTRY_META: Record<
  AiCreditEntryType,
  { label: string; tone: string }
> = {
  consumption: { label: "Consumo", tone: "text-rose-700 bg-rose-50" },
  topup: { label: "Recarga", tone: "text-emerald-700 bg-emerald-50" },
  grant: { label: "Franquia", tone: "text-brand-700 bg-brand-500/10" },
  refund: { label: "Estorno", tone: "text-blue-700 bg-blue-50" },
  adjustment: { label: "Ajuste", tone: "text-amber-700 bg-amber-50" },
};
