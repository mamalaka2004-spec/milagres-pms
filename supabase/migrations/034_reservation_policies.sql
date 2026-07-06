-- ─── 034. POLÍTICAS DE RESERVA (#19) ───
-- Fase 8: estende `properties` com política de cancelamento estruturada.
-- min_nights / max_nights JÁ existem (001) — aqui só acrescentamos o tipo de
-- política de cancelamento e a antecedência para cancelamento gratuito. O texto
-- livre `cancellation_policy` continua servindo como descrição/termos custom.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS cancellation_policy_type TEXT NOT NULL DEFAULT 'flexible'
    CHECK (cancellation_policy_type IN ('flexible', 'moderate', 'strict', 'non_refundable', 'custom')),
  -- Dias antes do check-in em que o cancelamento ainda é gratuito.
  ADD COLUMN IF NOT EXISTS cancellation_cutoff_days INTEGER NOT NULL DEFAULT 0
    CHECK (cancellation_cutoff_days >= 0 AND cancellation_cutoff_days <= 365);

COMMENT ON COLUMN public.properties.cancellation_policy_type IS
  'Tipo de política de cancelamento (flexible/moderate/strict/non_refundable/custom). Aplicada na criação de reserva e exibida ao hóspede.';
COMMENT ON COLUMN public.properties.cancellation_cutoff_days IS
  'Antecedência (dias antes do check-in) para cancelamento gratuito.';
