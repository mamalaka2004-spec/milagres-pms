-- ===========================================================================
-- 024 — Campanhas + Disparo em massa (broadcast)  ·  Fase 2 / Etapa B
-- Run AFTER 023_funnel_tags.sql. Idempotent.
-- Project: Milagres / xmmuenaaodlqubfotwzr
-- ===========================================================================
-- Disparo orquestrado pelo n8n: o Milagres cria a campanha + destinatários e
-- dispara um webhook; o n8n faz o loop com throttle, chama a Evolution e devolve
-- o status por destinatário num webhook de callback (autenticado por segredo).
--
-- Cross-base: destinatários vêm de whatsapp_contacts (fonebook único, cruza
-- Locação e Vendas por phone_canonical). Opcionalmente a campanha joga cada
-- destinatário numa etapa de funil (target_pipeline/target_stage) → cria deals.
-- ===========================================================================

-- ─── 1. CAMPAIGNS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  line_id UUID REFERENCES public.whatsapp_lines(id) ON DELETE SET NULL,   -- número que dispara
  message_template TEXT NOT NULL,                                         -- suporta {{nome}}
  media_url TEXT,
  media_mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  throttle_seconds INT NOT NULL DEFAULT 30,                               -- intervalo entre envios
  target_pipeline_id UUID REFERENCES public.funnel_pipelines(id) ON DELETE SET NULL,
  target_stage_id UUID REFERENCES public.funnel_stages(id) ON DELETE SET NULL,
  total_count INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_company ON public.campaigns(company_id, status);

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 2. CAMPAIGN RECIPIENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.whatsapp_contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.funnel_deals(id) ON DELETE SET NULL,
  phone_e164 TEXT NOT NULL,
  phone_canonical TEXT,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'failed', 'skipped')),
  error TEXT,
  external_id TEXT,                                   -- id da mensagem no provedor
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (campaign_id, phone_canonical)               -- dedup por telefone na campanha
);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign
  ON public.campaign_recipients(campaign_id, status);

-- ─── 3. RLS (company scope) ────────────────────────────────────────────────
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns same company" ON public.campaigns;
CREATE POLICY "campaigns same company" ON public.campaigns FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "recipients via campaign company" ON public.campaign_recipients;
CREATE POLICY "recipients via campaign company" ON public.campaign_recipients FOR ALL TO authenticated
  USING (campaign_id IN (
    SELECT id FROM public.campaigns
    WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())))
  WITH CHECK (campaign_id IN (
    SELECT id FROM public.campaigns
    WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())));

-- ===========================================================================
-- FIM 024.
-- ===========================================================================
