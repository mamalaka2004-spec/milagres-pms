-- ===========================================================================
-- 035 — Configuração do Site/Landing público  ·  Fase 10 (#28 / #29)
-- Run AFTER 031_google_calendar.sql. Idempotente.
-- Project: Milagres / xmmuenaaodlqubfotwzr
-- ===========================================================================
-- Base para a landing pública configurável. 1 linha por empresa. A página
-- pública (src/app/(public)/page.tsx) pode, no futuro, ler estes campos para
-- customizar hero/contato/tema sem redeploy. `template` prepara os templates
-- de site (#29) — hoje só "sage", mas o campo já existe para evoluir.
--
-- IMPORTANTE: os fluxos de leitura/gravação degradam de forma graciosa quando
-- esta tabela ainda não existe (getSiteSettings retorna defaults). Aplicar esta
-- migration habilita a persistência das configurações.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Identidade / hero da landing
  site_title TEXT,
  hero_title TEXT,
  hero_subtitle TEXT,

  -- Contato
  whatsapp_number TEXT,
  contact_email TEXT,

  -- Aparência (#29 — templates de site). "sage" = tema atual (padrão).
  template TEXT NOT NULL DEFAULT 'sage',
  primary_color TEXT,

  -- Publicação do site
  published BOOLEAN NOT NULL DEFAULT false,

  -- Extensível sem nova migration (SEO, blocos, redes sociais, etc.)
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_settings_company ON public.site_settings(company_id);

-- ─── RLS — escopo por empresa (o app usa service-role, mas mantemos a política) ─
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_settings same company" ON public.site_settings;
CREATE POLICY "site_settings same company" ON public.site_settings FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
