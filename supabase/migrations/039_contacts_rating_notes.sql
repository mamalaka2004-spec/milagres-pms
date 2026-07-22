-- ===========================================================================
-- 039 — Fonebook: rating + notas (gestão de contatos / módulo Vendas)
-- Run AFTER 038_sarah_sales_agent.sql. Idempotent.
-- Project: Milagres / xmmuenaaodlqubfotwzr
-- ===========================================================================
-- Suporte à página Contatos: avaliação do contato (1–5 estrelas) e notas
-- livres. Tags e categoria já existem desde a 014; opt-out desde a 036.
-- ===========================================================================

ALTER TABLE public.whatsapp_contacts
  ADD COLUMN IF NOT EXISTS rating INT CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ===========================================================================
-- FIM 039.
-- ===========================================================================
