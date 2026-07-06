-- ===========================================================================
-- 032 — Stripe para compra de créditos de IA  ·  (#27)
-- Run AFTER 030_ai_credits.sql. Idempotente: seguro rodar várias vezes.
-- Project: Milagres / xmmuenaaodlqubfotwzr
-- ===========================================================================
-- Stripe é usado SOMENTE para recarga de créditos de IA. As cobranças de
-- RESERVAS de hóspedes continuam no Asaas (migration 017) — nada aqui as toca.
--
-- Esta migration só ADICIONA colunas para amarrar o pagamento Stripe ao ledger
-- de créditos (migration 030), sem alterar o modelo existente:
--
--   ai_credit_accounts.stripe_customer_id — Customer da Stripe da empresa (opcional).
--   ai_credit_ledger.stripe_session_id    — Checkout Session que gerou o top-up.
--
-- A idempotência do crédito (evitar creditar 2× em retry de webhook) é garantida
-- pelo índice único parcial sobre stripe_session_id: a app checa/insere por esse
-- valor em src/lib/ai/credits.ts (applyEntry/topUpAiCredits).
-- ===========================================================================

-- ─── 1. Customer da Stripe por conta de crédito (opcional) ──────────────────
ALTER TABLE public.ai_credit_accounts
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

COMMENT ON COLUMN public.ai_credit_accounts.stripe_customer_id IS
  'Customer da Stripe da empresa para compra de créditos de IA (#27). NULL até a 1ª compra.';

-- ─── 2. Checkout Session no ledger (idempotência) ───────────────────────────
ALTER TABLE public.ai_credit_ledger
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

COMMENT ON COLUMN public.ai_credit_ledger.stripe_session_id IS
  'ID da Stripe Checkout Session que originou este top-up (source=gateway). '
  'Índice único parcial garante que o webhook nunca credite 2× a mesma sessão.';

-- Índice único PARCIAL: só linhas com stripe_session_id não-nulo entram no índice,
-- então consumo/topup manual/grant (que não têm session) não colidem entre si.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_credit_ledger_stripe_session
  ON public.ai_credit_ledger (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- ===========================================================================
-- FIM 032.
-- ===========================================================================
