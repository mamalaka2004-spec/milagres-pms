/* eslint-disable @typescript-eslint/no-explicit-any */
// ===========================================================================
// Financeiro — query layer (Fase 5)
// Tabelas da migration 027. Acessadas via `(supabase.from(...) as any)` porque
// não estão nos tipos gerados (mesmo padrão de pricing.ts/funnel.ts).
// O saldo atual de cada conta é COMPUTADO: saldo inicial + transações pagas
// vinculadas à conta + transferências recebidas − enviadas.
// ===========================================================================
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BankAccount,
  BankAccountWithBalance,
  CashFlowMonth,
  CashFlowReport,
  CostCenter,
  FinCategory,
  FinTransaction,
  FinTransfer,
} from "@/types/finance";

function db() {
  return createAdminClient();
}

// ─── Contas bancárias ────────────────────────────────────────────────────────

export async function listBankAccounts(companyId: string): Promise<BankAccount[]> {
  const { data, error } = await (db().from("bank_accounts") as any)
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as BankAccount[]) || [];
}

/** Contas + saldo atual computado (inicial + pagas na conta ± transferências). */
export async function listBankAccountsWithBalances(
  companyId: string
): Promise<BankAccountWithBalance[]> {
  const client = db();
  const [accountsRes, txRes, trRes] = await Promise.all([
    (client.from("bank_accounts") as any)
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
    (client.from("fin_transactions") as any)
      .select("bank_account_id, type, amount_cents")
      .eq("company_id", companyId)
      .eq("status", "paid")
      .not("bank_account_id", "is", null)
      .limit(10000),
    (client.from("fin_transfers") as any)
      .select("from_account_id, to_account_id, amount_cents")
      .eq("company_id", companyId)
      .limit(10000),
  ]);
  if (accountsRes.error) throw accountsRes.error;
  if (txRes.error) throw txRes.error;
  if (trRes.error) throw trRes.error;

  const deltas = new Map<string, number>();
  const add = (id: string | null, cents: number) => {
    if (!id) return;
    deltas.set(id, (deltas.get(id) || 0) + cents);
  };
  for (const t of (txRes.data as any[]) || []) {
    add(t.bank_account_id, t.type === "revenue" ? t.amount_cents : -t.amount_cents);
  }
  for (const tr of (trRes.data as any[]) || []) {
    add(tr.to_account_id, tr.amount_cents);
    add(tr.from_account_id, -tr.amount_cents);
  }

  return (((accountsRes.data as BankAccount[]) || []).map((a) => ({
    ...a,
    current_balance_cents: a.opening_balance_cents + (deltas.get(a.id) || 0),
  })) as BankAccountWithBalance[]);
}

export async function createBankAccount(
  companyId: string,
  input: Partial<BankAccount>
): Promise<BankAccount> {
  const { data, error } = await (db().from("bank_accounts") as any)
    .insert({ company_id: companyId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as BankAccount;
}

export async function updateBankAccount(
  companyId: string,
  id: string,
  input: Partial<BankAccount>
): Promise<BankAccount | null> {
  const { data, error } = await (db().from("bank_accounts") as any)
    .update(input)
    .eq("id", id)
    .eq("company_id", companyId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as BankAccount | null) ?? null;
}

export async function deleteBankAccount(companyId: string, id: string): Promise<boolean> {
  const { error, count } = await (db().from("bank_accounts") as any)
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ─── Centros de custo ────────────────────────────────────────────────────────

export async function listCostCenters(companyId: string): Promise<CostCenter[]> {
  const { data, error } = await (db().from("cost_centers") as any)
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as CostCenter[]) || [];
}

export async function createCostCenter(
  companyId: string,
  input: Partial<CostCenter>
): Promise<CostCenter> {
  const { data, error } = await (db().from("cost_centers") as any)
    .insert({ company_id: companyId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as CostCenter;
}

export async function updateCostCenter(
  companyId: string,
  id: string,
  input: Partial<CostCenter>
): Promise<CostCenter | null> {
  const { data, error } = await (db().from("cost_centers") as any)
    .update(input)
    .eq("id", id)
    .eq("company_id", companyId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as CostCenter | null) ?? null;
}

export async function deleteCostCenter(companyId: string, id: string): Promise<boolean> {
  const { error, count } = await (db().from("cost_centers") as any)
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ─── Categorias ──────────────────────────────────────────────────────────────

export async function listFinCategories(companyId: string): Promise<FinCategory[]> {
  const { data, error } = await (db().from("fin_categories") as any)
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as FinCategory[]) || [];
}

export async function createFinCategory(
  companyId: string,
  input: Partial<FinCategory>
): Promise<FinCategory> {
  const { data, error } = await (db().from("fin_categories") as any)
    .insert({ company_id: companyId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as FinCategory;
}

export async function updateFinCategory(
  companyId: string,
  id: string,
  input: Partial<FinCategory>
): Promise<FinCategory | null> {
  const { data, error } = await (db().from("fin_categories") as any)
    .update(input)
    .eq("id", id)
    .eq("company_id", companyId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as FinCategory | null) ?? null;
}

export async function deleteFinCategory(companyId: string, id: string): Promise<boolean> {
  const { error, count } = await (db().from("fin_categories") as any)
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ─── Transações ──────────────────────────────────────────────────────────────

export interface FinTransactionFilters {
  from?: string;
  to?: string;
  type?: "revenue" | "expense";
  status?: "pending" | "paid" | "canceled";
  bank_account_id?: string;
  category_id?: string;
  cost_center_id?: string;
  q?: string;
  limit?: number;
}

const TX_SELECT = `
  *,
  category:fin_categories (id, name, parent_id),
  cost_center:cost_centers (id, name),
  bank_account:bank_accounts (id, name),
  property:properties (id, name)
`;

export async function listFinTransactions(
  companyId: string,
  filters: FinTransactionFilters = {}
): Promise<FinTransaction[]> {
  let query = (db().from("fin_transactions") as any)
    .select(TX_SELECT)
    .eq("company_id", companyId)
    .order("date_ref", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 500);
  if (filters.from) query = query.gte("date_ref", filters.from);
  if (filters.to) query = query.lte("date_ref", filters.to);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.bank_account_id) query = query.eq("bank_account_id", filters.bank_account_id);
  if (filters.category_id) query = query.eq("category_id", filters.category_id);
  if (filters.cost_center_id) query = query.eq("cost_center_id", filters.cost_center_id);
  if (filters.q) {
    const term = filters.q.replace(/[%,()]/g, " ").trim();
    if (term) query = query.or(`description.ilike.%${term}%,counterparty.ilike.%${term}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data as FinTransaction[]) || [];
}

export async function createFinTransaction(
  companyId: string,
  input: Partial<FinTransaction>
): Promise<FinTransaction> {
  const { data, error } = await (db().from("fin_transactions") as any)
    .insert({ company_id: companyId, ...input })
    .select(TX_SELECT)
    .single();
  if (error) throw error;
  return data as FinTransaction;
}

export async function updateFinTransaction(
  companyId: string,
  id: string,
  input: Partial<FinTransaction>
): Promise<FinTransaction | null> {
  const { data, error } = await (db().from("fin_transactions") as any)
    .update(input)
    .eq("id", id)
    .eq("company_id", companyId)
    .select(TX_SELECT)
    .maybeSingle();
  if (error) throw error;
  return (data as FinTransaction | null) ?? null;
}

export async function deleteFinTransaction(companyId: string, id: string): Promise<boolean> {
  const { error, count } = await (db().from("fin_transactions") as any)
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ─── Transferências ──────────────────────────────────────────────────────────

const TRANSFER_SELECT = `
  *,
  from_account:bank_accounts!fin_transfers_from_account_id_fkey (id, name),
  to_account:bank_accounts!fin_transfers_to_account_id_fkey (id, name)
`;

export async function listFinTransfers(companyId: string): Promise<FinTransfer[]> {
  const { data, error } = await (db().from("fin_transfers") as any)
    .select(TRANSFER_SELECT)
    .eq("company_id", companyId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data as FinTransfer[]) || [];
}

export async function createFinTransfer(
  companyId: string,
  input: Partial<FinTransfer>
): Promise<FinTransfer> {
  const { data, error } = await (db().from("fin_transfers") as any)
    .insert({ company_id: companyId, ...input })
    .select(TRANSFER_SELECT)
    .single();
  if (error) throw error;
  return data as FinTransfer;
}

export async function deleteFinTransfer(companyId: string, id: string): Promise<boolean> {
  const { error, count } = await (db().from("fin_transfers") as any)
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ─── Fluxo de caixa ──────────────────────────────────────────────────────────

/**
 * Relatório de fluxo de caixa dos últimos `months` meses (inclui o atual):
 * realizadas (pagas) agrupadas pelo mês de pagamento (fallback: competência),
 * saldos por conta e totais pendentes/vencidos.
 */
export async function getCashFlow(companyId: string, months = 12): Promise<CashFlowReport> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().slice(0, 10);

  const client = db();
  const [balances, paidRes, pendingRes] = await Promise.all([
    listBankAccountsWithBalances(companyId),
    (client.from("fin_transactions") as any)
      .select("type, amount_cents, date_ref, date_paid")
      .eq("company_id", companyId)
      .eq("status", "paid")
      .or(`date_paid.gte.${startStr},and(date_paid.is.null,date_ref.gte.${startStr})`)
      .limit(10000),
    (client.from("fin_transactions") as any)
      .select("type, amount_cents, date_due")
      .eq("company_id", companyId)
      .eq("status", "pending")
      .limit(10000),
  ]);
  if (paidRes.error) throw paidRes.error;
  if (pendingRes.error) throw pendingRes.error;

  // Esqueleto de meses (sempre `months` pontos, mesmo sem lançamentos)
  const monthMap = new Map<string, CashFlowMonth>();
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, { month: key, revenue_cents: 0, expense_cents: 0, net_cents: 0 });
  }
  for (const t of (paidRes.data as any[]) || []) {
    const key = String(t.date_paid || t.date_ref).slice(0, 7);
    const m = monthMap.get(key);
    if (!m) continue;
    if (t.type === "revenue") m.revenue_cents += t.amount_cents;
    else m.expense_cents += t.amount_cents;
  }
  for (const m of monthMap.values()) m.net_cents = m.revenue_cents - m.expense_cents;

  let pendingIn = 0;
  let pendingOut = 0;
  let overdueIn = 0;
  let overdueOut = 0;
  for (const t of (pendingRes.data as any[]) || []) {
    const overdue = t.date_due && t.date_due < today;
    if (t.type === "revenue") {
      pendingIn += t.amount_cents;
      if (overdue) overdueIn += t.amount_cents;
    } else {
      pendingOut += t.amount_cents;
      if (overdue) overdueOut += t.amount_cents;
    }
  }

  return {
    balances,
    total_balance_cents: balances.reduce((s, b) => s + b.current_balance_cents, 0),
    months: Array.from(monthMap.values()),
    pending_in_cents: pendingIn,
    pending_out_cents: pendingOut,
    overdue_in_cents: overdueIn,
    overdue_out_cents: overdueOut,
  };
}
