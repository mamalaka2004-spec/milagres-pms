-- ===========================================================================
-- 030 — Créditos / tokens de IA  ·  Fase 9 (#27)
-- Run AFTER 027_finance.sql. Idempotente: seguro rodar várias vezes.
-- Project: Milagres / xmmuenaaodlqubfotwzr
-- ===========================================================================
-- Ledger de créditos de IA, PROVIDER-AGNOSTIC. Não há integração com gateway
-- de pagamento aqui (Stripe / Asaas / interno — DECISÃO PENDENTE do usuário).
-- O top-up automático pós-pagamento entra depois: um webhook do gateway
-- confirmado chama a MESMA função de crédito (entry_type='topup') usada hoje
-- pela ação administrativa manual. Ver TODO em src/lib/ai/credits.ts.
--
--   ai_credit_accounts — 1 conta por empresa: plano + saldo materializado
--   ai_credit_ledger   — todo movimento: consumo (débito), top-up, grant, ajuste
--
-- Modelo de unidade: "crédito". A conversão tokens→créditos é feita na app
-- (TOKENS_PER_CREDIT em src/lib/ai/credits.ts). O saldo é materializado em
-- ai_credit_accounts.balance_credits e cada linha do ledger grava balance_after,
-- de modo que o extrato é auditável e o saldo é lido em O(1).
-- ===========================================================================

-- ─── 1. CONTAS DE CRÉDITO (1 por empresa) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_credit_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Rótulo de plano livre / provider-agnostic (free, starter, pro, enterprise…).
  -- Quem define preço/limites é a camada de billing (a definir).
  plan TEXT NOT NULL DEFAULT 'free',
  -- Saldo materializado. Pode ficar negativo se houver overspend antes do bloqueio.
  balance_credits BIGINT NOT NULL DEFAULT 0,
  -- Franquia mensal do plano (informativo até haver ciclo de cobrança real).
  monthly_included_credits BIGINT NOT NULL DEFAULT 0,
  -- Aviso de saldo baixo (UI). Cobrança/estorno automático fica para o gateway.
  low_balance_threshold BIGINT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_accounts_company
  ON public.ai_credit_accounts(company_id);

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_credit_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.ai_credit_accounts IS
  'Saldo de créditos de IA por empresa (#27). Provider-agnostic: sem gateway de pagamento.';
COMMENT ON COLUMN public.ai_credit_accounts.balance_credits IS
  'Saldo materializado (mantido em sincronia pelo ledger via app).';

-- ─── 2. LEDGER (movimentações) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.ai_credit_accounts(id) ON DELETE CASCADE,
  -- consumption = débito (negativo); topup/grant/refund = crédito (positivo);
  -- adjustment = correção manual (pode ser + ou -).
  entry_type TEXT NOT NULL
    CHECK (entry_type IN ('consumption', 'topup', 'grant', 'refund', 'adjustment')),
  -- Assinado: negativo debita, positivo credita.
  credits BIGINT NOT NULL,
  -- Tokens do provedor de LLM que geraram o consumo (nulo p/ topup/grant).
  tokens_used BIGINT,
  -- Saldo resultante logo após aplicar esta linha (para extrato auditável).
  balance_after BIGINT NOT NULL,
  -- De onde veio: 'ai_chat', 'whatsapp_ai', 'manual_topup', 'monthly_grant', 'gateway'…
  source TEXT,
  -- Vínculo opcional à entidade que originou o movimento (ex.: conversa de IA).
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  -- Quem lançou (nulo p/ consumo automático do sistema).
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_ledger_company_created
  ON public.ai_credit_ledger(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_credit_ledger_account
  ON public.ai_credit_ledger(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_credit_ledger_type
  ON public.ai_credit_ledger(company_id, entry_type);

COMMENT ON TABLE public.ai_credit_ledger IS
  'Extrato de créditos de IA (#27): consumo por chamada, top-ups e ajustes.';

-- ─── 3. RLS ─────────────────────────────────────────────────────────────────
-- Leitura pela empresa; as escritas passam pelo service-role (admin client),
-- que ignora RLS. Mesmo padrão das tabelas financeiras (migration 027).
ALTER TABLE public.ai_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_ledger   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai credit accounts same company" ON public.ai_credit_accounts;
CREATE POLICY "ai credit accounts same company" ON public.ai_credit_accounts FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "ai credit ledger same company" ON public.ai_credit_ledger;
CREATE POLICY "ai credit ledger same company" ON public.ai_credit_ledger FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- ─── 4. SEED (torna testável já) ────────────────────────────────────────────
-- Cria uma conta 'free' com franquia inicial para cada empresa existente e
-- registra o grant no ledger. Idempotente: só age em empresas sem conta.
DO $seed$
DECLARE
  c RECORD;
  v_account_id UUID;
  v_initial BIGINT := 1000;  -- franquia de teste
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    IF NOT EXISTS (SELECT 1 FROM public.ai_credit_accounts a WHERE a.company_id = c.id) THEN
      INSERT INTO public.ai_credit_accounts (company_id, plan, balance_credits, monthly_included_credits)
        VALUES (c.id, 'free', v_initial, v_initial)
        RETURNING id INTO v_account_id;

      INSERT INTO public.ai_credit_ledger
        (company_id, account_id, entry_type, credits, balance_after, source, description)
        VALUES (c.id, v_account_id, 'grant', v_initial, v_initial, 'monthly_grant',
                'Franquia inicial do plano (seed Fase 9)');
    END IF;
  END LOOP;
END
$seed$;

-- ===========================================================================
-- FIM 030. Próximo: 031 (Google Calendar scaffold).
-- ===========================================================================
