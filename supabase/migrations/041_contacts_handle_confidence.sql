-- ===========================================================================
-- 041 — Fonebook: handle de rede social + confiança da sugestão de nome
-- Run AFTER 040_contacts_name_parts.sql. Idempotent.
-- Project: Milagres / xmmuenaaodlqubfotwzr
-- ===========================================================================
-- A base real revelou padrões que a 040 não cobria:
--   "@amamaedavalen_ Renata"  → handle + nome real depois
--   "@albertocardosofisio"    → só handle (nome precisa ser deduzido)
--   "Beth Campos Cliente"     → nome + MARCADOR de relacionamento
--   "Booking 01" / "Airbnb"   → não é pessoa, é portal/empresa
--
-- Em vez de jogar fora o que não é nome, preservamos:
--   instagram_handle — o @ vira dado (útil p/ prospecção), sai do nome
--   name_confidence  — 'alta' (extração segura) | 'media' | 'baixa' (deduzido
--                      do handle, precisa de olho humano)
--   name_source      — quem sugeriu: 'manual' | 'heuristic' | 'ai' | 'import'
-- ===========================================================================

ALTER TABLE public.whatsapp_contacts
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS name_confidence TEXT
    CHECK (name_confidence IS NULL OR name_confidence IN ('alta', 'media', 'baixa')),
  ADD COLUMN IF NOT EXISTS name_source TEXT
    CHECK (name_source IS NULL OR name_source IN ('manual', 'heuristic', 'ai', 'import'));

CREATE INDEX IF NOT EXISTS idx_wa_contacts_handle
  ON public.whatsapp_contacts(company_id, instagram_handle)
  WHERE instagram_handle IS NOT NULL;

-- Fila de revisão prioriza o que tem baixa confiança.
CREATE INDEX IF NOT EXISTS idx_wa_contacts_confidence
  ON public.whatsapp_contacts(company_id, name_confidence)
  WHERE name_reviewed_at IS NULL;

-- ===========================================================================
-- FIM 041.
-- ===========================================================================
