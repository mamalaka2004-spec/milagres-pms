-- ===========================================================================
-- 027 — Financeiro (entrada/saída/fluxo de caixa)  ·  Fase 5
-- Run AFTER 026_pricing.sql. Idempotent: safe to run multiple times.
-- Project: Milagres / xmmuenaaodlqubfotwzr
-- ===========================================================================
-- Modelo simplificado portado do MF OS, adaptado às convenções do Milagres
-- (UUID, company_id, valores em centavos, RLS por empresa):
--
--   bank_accounts     — contas bancárias/caixa com saldo inicial protegido
--   cost_centers      — centros de custo
--   fin_categories    — categorias de receita/despesa (hierarquia pai/filho)
--   fin_transactions  — lançamentos de entrada/saída (competência, vencimento,
--                       pagamento, categoria, centro de custo, conta, método,
--                       recorrência, vínculo opcional a imóvel/reserva)
--   fin_transfers     — transferências entre contas
--
-- O saldo atual de cada conta é COMPUTADO (saldo inicial + transações pagas
-- + transferências) — nunca armazenado. payments/financial_entries continuam
-- existindo; os lançamentos manuais de financial_entries são copiados para
-- fin_transactions (idempotente via legacy_entry_id).
-- ===========================================================================

-- ─── 1. CONTAS BANCÁRIAS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'corrente'
    CHECK (type IN ('corrente', 'poupanca', 'investimento', 'caixa')),
  -- Saldo de partida no dia opening_balance_date; o saldo atual é computado.
  opening_balance_cents BIGINT NOT NULL DEFAULT 0,
  opening_balance_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_company
  ON public.bank_accounts(company_id, is_active);

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 2. CENTROS DE CUSTO ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE INDEX IF NOT EXISTS idx_cost_centers_company
  ON public.cost_centers(company_id, is_active);

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 3. CATEGORIAS (hierarquia pai/filho) ───────────────────────────────────
-- parent_id NULL = categoria-pai; preenchido = subcategoria (mesmo type).
CREATE TABLE IF NOT EXISTS public.fin_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense')),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.fin_categories(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_categories_uniq
  ON public.fin_categories(company_id, type, name,
    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_fin_categories_company
  ON public.fin_categories(company_id, type, sort_order);
CREATE INDEX IF NOT EXISTS idx_fin_categories_parent
  ON public.fin_categories(parent_id) WHERE parent_id IS NOT NULL;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.fin_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 4. TRANSAÇÕES (entrada/saída) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'canceled')),
  date_ref DATE NOT NULL,              -- competência
  date_due DATE,                       -- vencimento ("vencido" é derivado na UI)
  date_paid DATE,                      -- pagamento efetivo
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  description TEXT NOT NULL DEFAULT '',
  counterparty TEXT,                   -- cliente (entrada) / fornecedor (saída)
  category_id UUID REFERENCES public.fin_categories(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN
      ('pix', 'credit_card', 'debit_card', 'bank_transfer', 'boleto', 'cash', 'other')),
  recurrence TEXT NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'yearly')),
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  notes TEXT,
  legacy_entry_id UUID UNIQUE,         -- id em financial_entries (migração idempotente)
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fin_transactions_paid_chk CHECK (status <> 'paid' OR date_paid IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_fin_transactions_company_date
  ON public.fin_transactions(company_id, date_ref DESC);
CREATE INDEX IF NOT EXISTS idx_fin_transactions_status
  ON public.fin_transactions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_fin_transactions_account
  ON public.fin_transactions(bank_account_id) WHERE bank_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fin_transactions_category
  ON public.fin_transactions(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fin_transactions_cost_center
  ON public.fin_transactions(cost_center_id) WHERE cost_center_id IS NOT NULL;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.fin_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 5. TRANSFERÊNCIAS ENTRE CONTAS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  date DATE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fin_transfers_accounts_chk CHECK (from_account_id <> to_account_id)
);
CREATE INDEX IF NOT EXISTS idx_fin_transfers_company
  ON public.fin_transfers(company_id, date DESC);

-- ─── 6. RLS (mesmo gate de company das demais tabelas) ──────────────────────
ALTER TABLE public.bank_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_transfers    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank accounts same company" ON public.bank_accounts;
CREATE POLICY "bank accounts same company" ON public.bank_accounts FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "cost centers same company" ON public.cost_centers;
CREATE POLICY "cost centers same company" ON public.cost_centers FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "fin categories same company" ON public.fin_categories;
CREATE POLICY "fin categories same company" ON public.fin_categories FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "fin transactions same company" ON public.fin_transactions;
CREATE POLICY "fin transactions same company" ON public.fin_transactions FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "fin transfers same company" ON public.fin_transfers;
CREATE POLICY "fin transfers same company" ON public.fin_transfers FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- ─── 7. SEED: árvore de categorias padrão de PMS por empresa (idempotente) ──
-- Contas bancárias e centros de custo NÃO são semeados — cadastro via UI.
DO $$
DECLARE
  c RECORD;
  parent_uuid UUID;
  parents TEXT[][] := ARRAY[
    -- [type, nome-pai, filhos separados por '|' ('' = sem filhos)]
    ARRAY['revenue', 'Hospedagem',        'Diárias|Taxa de limpeza|Taxas extras'],
    ARRAY['revenue', 'Vendas',            'Comissão de venda'],
    ARRAY['revenue', 'Outras receitas',   ''],
    ARRAY['expense', 'Operação',          'Limpeza e lavanderia|Manutenção|Suprimentos|Água, luz e internet'],
    ARRAY['expense', 'Administrativo',    'Salários e prestadores|Contabilidade|Software e assinaturas'],
    ARRAY['expense', 'Marketing',         'Anúncios|Comissões de canais (OTA)'],
    ARRAY['expense', 'Proprietários',     'Repasse a proprietários'],
    ARRAY['expense', 'Impostos e taxas',  ''],
    ARRAY['expense', 'Outras despesas',   '']
  ];
  p TEXT[];
  child TEXT;
  i INT := 0;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    i := 0;
    FOREACH p SLICE 1 IN ARRAY parents LOOP
      i := i + 1;
      INSERT INTO public.fin_categories (company_id, type, name, parent_id, sort_order)
      SELECT c.id, p[1], p[2], NULL, i * 10
      WHERE NOT EXISTS (
        SELECT 1 FROM public.fin_categories f
        WHERE f.company_id = c.id AND f.type = p[1] AND f.name = p[2] AND f.parent_id IS NULL
      );
      SELECT id INTO parent_uuid FROM public.fin_categories f
        WHERE f.company_id = c.id AND f.type = p[1] AND f.name = p[2] AND f.parent_id IS NULL;
      IF p[3] <> '' THEN
        FOREACH child IN ARRAY string_to_array(p[3], '|') LOOP
          INSERT INTO public.fin_categories (company_id, type, name, parent_id)
          SELECT c.id, p[1], child, parent_uuid
          WHERE NOT EXISTS (
            SELECT 1 FROM public.fin_categories f
            WHERE f.company_id = c.id AND f.type = p[1] AND f.name = child AND f.parent_id = parent_uuid
          );
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ─── 8. MIGRAÇÃO: financial_entries → fin_transactions (idempotente) ────────
-- Copia (não move) os lançamentos manuais antigos como transações pagas.
-- Sinal negativo inverte o lado: revenue/commission positivos viram entrada;
-- expense/payout/tax/refund (e valores negativos de receita) viram saída.
INSERT INTO public.fin_transactions
  (company_id, type, status, date_ref, date_paid, amount_cents, description,
   property_id, reservation_id, notes, legacy_entry_id, created_by, created_at)
SELECT
  fe.company_id,
  CASE WHEN (fe.type IN ('revenue', 'commission')) = (fe.amount_cents >= 0)
       THEN 'revenue' ELSE 'expense' END,
  'paid',
  fe.date,
  fe.date,
  ABS(fe.amount_cents),
  COALESCE(NULLIF(fe.description, ''), COALESCE(fe.category, fe.type)),
  fe.property_id,
  fe.reservation_id,
  'Migrado de financial_entries (tipo: ' || fe.type ||
    COALESCE(' · categoria: ' || NULLIF(fe.category, ''), '') || ')',
  fe.id,
  fe.created_by,
  fe.created_at
FROM public.financial_entries fe
WHERE ABS(fe.amount_cents) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.fin_transactions t WHERE t.legacy_entry_id = fe.id
  );

-- ===========================================================================
-- FIM 027. Fase 5: financeiro — contas, centros de custo, categorias,
-- transações de entrada/saída, transferências e fluxo de caixa.
-- ===========================================================================
