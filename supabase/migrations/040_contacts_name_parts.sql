-- ===========================================================================
-- 040 — Fonebook: nome estruturado (primeiro/sobrenome/social)
-- Run AFTER 039_contacts_rating_notes.sql. Idempotent.
-- Project: Milagres / xmmuenaaodlqubfotwzr
-- ===========================================================================
-- Muitos contatos vieram de exportações (Instagram, agenda do celular) com
-- nomes inutilizáveis para personalização: "@joao.silva", "Maria IG", tudo em
-- minúsculas, emojis, "Cliente 3". Isso vazava direto para o {{primeiro_nome}}
-- das campanhas.
--
-- Aqui separamos o nome em partes tratadas. `first_name` é a fonte preferida
-- de {{primeiro_nome}}; `display_name` continua sendo o rótulo mostrado na UI.
-- A limpeza é sugerida por IA (/api/contacts/ai-normalize) e SEMPRE revisada
-- por uma pessoa antes de aplicar — `name_reviewed_at` marca o que já passou.
-- ===========================================================================

ALTER TABLE public.whatsapp_contacts
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS social_name TEXT,          -- como a pessoa prefere ser chamada
  ADD COLUMN IF NOT EXISTS name_reviewed_at TIMESTAMPTZ;

-- Fila de revisão: contatos ainda não tratados aparecem primeiro.
CREATE INDEX IF NOT EXISTS idx_wa_contacts_name_review
  ON public.whatsapp_contacts(company_id)
  WHERE name_reviewed_at IS NULL;

-- ===========================================================================
-- FIM 040.
-- ===========================================================================
