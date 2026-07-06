/* eslint-disable @typescript-eslint/no-explicit-any */
// ===========================================================================
// Créditos / tokens de IA — camada de serviço (Fase 9, #27, migration 030)
//
// Fluxo:
//   - Consumo: cada chamada de IA debita créditos (debitAiCredits).
//   - Recarga manual: ação administrativa interna (topUpAiCredits) — suporte/teste.
//   - Recarga por PAGAMENTO (#27): compra de créditos via Stripe. O webhook
//     checkout.session.completed chama topUpAiCredits(source='gateway',
//     stripeSessionId) de forma IDEMPOTENTE. Ver src/lib/billing/stripe.ts e
//     src/app/api/webhooks/stripe/route.ts.
//   - Leitura: getCreditOverview alimenta a tela Ajustes → Créditos de IA.
//
// IMPORTANTE: Stripe aqui é SÓ para créditos de IA. Cobranças de RESERVAS usam
// Asaas (migration 017). NENHUM segredo de gateway vive neste arquivo — as chaves
// Stripe ficam só em src/lib/billing/stripe.ts, lidas de env.
// ===========================================================================
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AiCreditAccount,
  AiCreditEntryType,
  AiCreditLedgerEntry,
  AiCreditOverview,
  AiCreditUsageSummary,
} from "@/types/ai-credits";

/**
 * Conversão tokens → créditos. 1 crédito = 1000 tokens (arredonda p/ cima, mas
 * nunca cobra 0 de uma chamada que consumiu tokens). Constante única para toda
 * a app; um plano/pricing real pode multiplicar por um fator de modelo depois.
 */
export const TOKENS_PER_CREDIT = 1000;

export function tokensToCredits(tokens: number): number {
  if (!Number.isFinite(tokens) || tokens <= 0) return 0;
  return Math.max(1, Math.ceil(tokens / TOKENS_PER_CREDIT));
}

function db() {
  return createAdminClient();
}

/**
 * Garante que a empresa tem uma conta de créditos e retorna o registro atual.
 * Idempotente: cria com plano 'free' e saldo 0 se não existir.
 */
export async function ensureCreditAccount(companyId: string): Promise<AiCreditAccount> {
  const client = db();
  const { data: existing, error } = await (client.from("ai_credit_accounts") as any)
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing as AiCreditAccount;

  const { data: created, error: insErr } = await (client.from("ai_credit_accounts") as any)
    .insert({ company_id: companyId, plan: "free", balance_credits: 0 })
    .select("*")
    .single();
  if (insErr) {
    // Corrida: alguém criou entre o select e o insert — relê.
    const { data: retry } = await (client.from("ai_credit_accounts") as any)
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (retry) return retry as AiCreditAccount;
    throw insErr;
  }
  return created as AiCreditAccount;
}

interface ApplyEntryInput {
  companyId: string;
  entryType: AiCreditEntryType;
  /** Assinado: negativo debita, positivo credita. */
  credits: number;
  tokensUsed?: number | null;
  source?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown> | null;
  /**
   * Idempotência de pagamento (#27, Stripe, migration 032). Quando presente, a
   * função verifica se já existe uma linha no ledger com este stripe_session_id
   * e, se existir, NÃO credita de novo (retorna a linha existente). Evita
   * creditar 2× em retry de webhook. Grava o valor na coluna stripe_session_id.
   */
  stripeSessionId?: string | null;
}

/**
 * Núcleo transacional-ish: aplica uma linha no ledger e atualiza o saldo
 * materializado. Não é uma transação SQL única (o admin client não expõe TX),
 * mas grava balance_after coerente com o saldo lido; suficiente para o volume
 * atual. Um RPC/edge-function pode endurecer isso depois.
 *
 * Idempotente por stripe_session_id: se `stripeSessionId` já existir no ledger,
 * retorna a linha existente sem creditar de novo (webhook seguro contra retry).
 */
async function applyEntry(input: ApplyEntryInput): Promise<AiCreditLedgerEntry> {
  const client = db();

  // Idempotência: se já processamos esta Checkout Session, devolve a linha
  // existente e NÃO credita de novo. O índice único parcial (migration 032) é a
  // trava final; este SELECT evita o erro de índice no caminho feliz do retry.
  if (input.stripeSessionId) {
    const { data: existing } = await (client.from("ai_credit_ledger") as any)
      .select("*")
      .eq("stripe_session_id", input.stripeSessionId)
      .limit(1)
      .maybeSingle();
    if (existing) return existing as AiCreditLedgerEntry;
  }

  const account = await ensureCreditAccount(input.companyId);
  const newBalance = account.balance_credits + input.credits;

  const ledgerRow: Record<string, unknown> = {
    company_id: input.companyId,
    account_id: account.id,
    entry_type: input.entryType,
    credits: input.credits,
    tokens_used: input.tokensUsed ?? null,
    balance_after: newBalance,
    source: input.source ?? null,
    reference_type: input.referenceType ?? null,
    reference_id: input.referenceId ?? null,
    description: input.description ?? null,
    created_by: input.createdBy ?? null,
    metadata: input.metadata ?? null,
  };
  // Só inclui a coluna quando há valor: mantém o top-up manual/consumo
  // funcionando mesmo antes da migration 032 ser aplicada.
  if (input.stripeSessionId) {
    ledgerRow.stripe_session_id = input.stripeSessionId;
  }

  const { data: entry, error: ledgerErr } = await (client.from("ai_credit_ledger") as any)
    .insert(ledgerRow)
    .select("*")
    .single();
  if (ledgerErr) throw ledgerErr;

  const { error: balErr } = await (client.from("ai_credit_accounts") as any)
    .update({ balance_credits: newBalance })
    .eq("id", account.id);
  if (balErr) throw balErr;

  return entry as AiCreditLedgerEntry;
}

/**
 * Debita créditos por uma chamada de IA. Fire-and-forget: NUNCA lança — uma
 * falha de billing não pode derrubar a resposta da IA (mesma filosofia do
 * logActivity). Retorna os créditos debitados (0 se nada foi cobrado/erro).
 */
export async function debitAiCredits(input: {
  companyId: string;
  tokens: number;
  source: string;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<number> {
  const credits = tokensToCredits(input.tokens);
  if (credits <= 0) return 0;
  try {
    await applyEntry({
      companyId: input.companyId,
      entryType: "consumption",
      credits: -credits,
      tokensUsed: input.tokens,
      source: input.source,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      description: input.description ?? null,
      metadata: input.metadata ?? null,
    });
    return credits;
  } catch (err) {
    // Billing nunca quebra a request que observa.
    console.error("[ai-credits] debit failed:", err);
    return 0;
  }
}

/**
 * Recarrega créditos. Dois usos:
 *   - Manual interno (admin, source='manual_topup') — ação de suporte/teste.
 *   - Pagamento Stripe confirmado (#27): o webhook checkout.session.completed
 *     chama com source='gateway' + stripeSessionId (idempotente por sessão).
 *     Ver src/app/api/webhooks/stripe/route.ts.
 *
 * `createdBy` é opcional: o crédito por pagamento não tem usuário logado (vem do
 * webhook), então o ledger grava created_by = NULL nesse caso.
 */
export async function topUpAiCredits(input: {
  companyId: string;
  credits: number;
  createdBy?: string | null;
  description?: string | null;
  source?: string;
  referenceType?: string | null;
  referenceId?: string | null;
  /** Idempotência de pagamento Stripe (migration 032). */
  stripeSessionId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<AiCreditLedgerEntry> {
  if (!Number.isInteger(input.credits) || input.credits <= 0) {
    throw new Error("credits deve ser um inteiro positivo");
  }
  return applyEntry({
    companyId: input.companyId,
    entryType: "topup",
    credits: input.credits,
    source: input.source ?? "manual_topup",
    referenceType: input.referenceType ?? null,
    referenceId: input.referenceId ?? null,
    description: input.description ?? "Recarga manual (admin)",
    createdBy: input.createdBy ?? null,
    stripeSessionId: input.stripeSessionId ?? null,
    metadata: input.metadata ?? null,
  });
}

/** Ajuste manual (correção) — pode ser positivo ou negativo. Admin only na API. */
export async function adjustAiCredits(input: {
  companyId: string;
  credits: number;
  createdBy: string;
  description: string;
}): Promise<AiCreditLedgerEntry> {
  if (!Number.isInteger(input.credits) || input.credits === 0) {
    throw new Error("credits deve ser um inteiro diferente de zero");
  }
  return applyEntry({
    companyId: input.companyId,
    entryType: "adjustment",
    credits: input.credits,
    source: "manual_adjustment",
    description: input.description,
    createdBy: input.createdBy,
  });
}

function monthStartISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

/** Extrato recente + resumo do mês para a tela Ajustes → Créditos de IA. */
export async function getCreditOverview(
  companyId: string,
  ledgerLimit = 30
): Promise<AiCreditOverview> {
  const account = await ensureCreditAccount(companyId);
  const client = db();

  const [ledgerRes, monthRes] = await Promise.all([
    (client.from("ai_credit_ledger") as any)
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(ledgerLimit),
    (client.from("ai_credit_ledger") as any)
      .select("entry_type, credits, tokens_used")
      .eq("company_id", companyId)
      .gte("created_at", monthStartISO())
      .limit(10000),
  ]);
  if (ledgerRes.error) throw ledgerRes.error;
  if (monthRes.error) throw monthRes.error;

  const usage_month: AiCreditUsageSummary = {
    consumption_credits: 0,
    consumption_tokens: 0,
    topup_credits: 0,
    entries_count: (monthRes.data as any[])?.length ?? 0,
  };
  for (const e of (monthRes.data as any[]) || []) {
    if (e.entry_type === "consumption") {
      usage_month.consumption_credits += Math.abs(e.credits || 0);
      usage_month.consumption_tokens += e.tokens_used || 0;
    } else if (e.entry_type === "topup") {
      usage_month.topup_credits += e.credits || 0;
    }
  }

  return {
    account,
    usage_month,
    ledger: (ledgerRes.data as AiCreditLedgerEntry[]) || [],
    low_balance: account.balance_credits <= account.low_balance_threshold,
  };
}
