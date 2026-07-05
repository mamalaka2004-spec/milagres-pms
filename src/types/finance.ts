// ===========================================================================
// Financeiro — tipos (Fase 5, migration 027)
// Contas bancárias · centros de custo · categorias · transações · transferências
// ===========================================================================

export type FinTransactionType = "revenue" | "expense";
export type FinTransactionStatus = "pending" | "paid" | "canceled";
export type FinPaymentMethod =
  | "pix"
  | "credit_card"
  | "debit_card"
  | "bank_transfer"
  | "boleto"
  | "cash"
  | "other";
export type FinRecurrence =
  | "none"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "yearly";
export type BankAccountType = "corrente" | "poupanca" | "investimento" | "caixa";

export interface BankAccount {
  id: string;
  company_id: string;
  name: string;
  type: BankAccountType;
  opening_balance_cents: number;
  opening_balance_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Conta com saldo atual computado (saldo inicial + pagas + transferências). */
export interface BankAccountWithBalance extends BankAccount {
  current_balance_cents: number;
}

export interface CostCenter {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinCategory {
  id: string;
  company_id: string;
  type: FinTransactionType;
  name: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinTransaction {
  id: string;
  company_id: string;
  type: FinTransactionType;
  status: FinTransactionStatus;
  date_ref: string;
  date_due: string | null;
  date_paid: string | null;
  amount_cents: number;
  description: string;
  counterparty: string | null;
  category_id: string | null;
  cost_center_id: string | null;
  bank_account_id: string | null;
  payment_method: FinPaymentMethod | null;
  recurrence: FinRecurrence;
  property_id: string | null;
  reservation_id: string | null;
  notes: string | null;
  legacy_entry_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joins populados pela query layer
  category?: { id: string; name: string; parent_id: string | null } | null;
  cost_center?: { id: string; name: string } | null;
  bank_account?: { id: string; name: string } | null;
  property?: { id: string; name: string } | null;
}

export interface FinTransfer {
  id: string;
  company_id: string;
  from_account_id: string;
  to_account_id: string;
  amount_cents: number;
  date: string;
  description: string;
  created_by: string | null;
  created_at: string;
  // joins populados pela query layer
  from_account?: { id: string; name: string } | null;
  to_account?: { id: string; name: string } | null;
}

export interface CashFlowMonth {
  month: string; // YYYY-MM
  revenue_cents: number;
  expense_cents: number;
  net_cents: number;
}

export interface CashFlowReport {
  balances: BankAccountWithBalance[];
  total_balance_cents: number;
  months: CashFlowMonth[];
  /** pendentes (não pagas, não canceladas) */
  pending_in_cents: number;
  pending_out_cents: number;
  /** parcela dos pendentes já vencida (date_due < hoje) */
  overdue_in_cents: number;
  overdue_out_cents: number;
}

// ─── Labels (pt-BR) ──────────────────────────────────────────────────────────

export const FIN_TYPE_LABELS: Record<FinTransactionType, string> = {
  revenue: "Entrada",
  expense: "Saída",
};

export const FIN_STATUS_LABELS: Record<FinTransactionStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  canceled: "Cancelado",
};

export const FIN_METHOD_LABELS: Record<FinPaymentMethod, string> = {
  pix: "PIX",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  bank_transfer: "Transferência",
  boleto: "Boleto",
  cash: "Dinheiro",
  other: "Outro",
};

export const FIN_RECURRENCE_LABELS: Record<FinRecurrence, string> = {
  none: "Não repete",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  yearly: "Anual",
};

export const BANK_ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  investimento: "Investimento",
  caixa: "Caixa (dinheiro)",
};

/** Vencida = pendente com vencimento anterior a hoje (derivado, não persiste). */
export function isOverdue(t: Pick<FinTransaction, "status" | "date_due">): boolean {
  if (t.status !== "pending" || !t.date_due) return false;
  return t.date_due < new Date().toISOString().slice(0, 10);
}
