-- ===========================================================================
-- 023 — CRM Funil (deals) + Tags  ·  Fase 2
-- Run AFTER 022_user_preferences.sql. Idempotent: safe to run multiple times.
-- Project: Milagres / xmmuenaaodlqubfotwzr
-- ===========================================================================
-- Migra o funil hardcoded (whatsapp_lead_data.lead_stage, enum de 6 valores)
-- para tabelas configuráveis, no modelo "deals" (padrão Vita-system):
--
--   funnel_pipelines  — 1+ funis por empresa, separados por TIPO (locacao|vendas)
--   funnel_stages     — etapas de um funil (ordenáveis, cor, won/lost, slug p/ IA)
--   funnel_deals      — o CARD do kanban: um negócio (valor, imóvel, contato, conversa)
--   funnel_deal_tags  — M2M negócio ↔ tag
--   tags              — catálogo de tags, separado por TIPO (locacao|vendas)
--   conversation_tags — M2M conversa ↔ tag (usado no inbox do chat)
--
-- whatsapp_lead_data CONTINUA existindo (campos de IA: confidence/reasoning/
-- objetivo/orçamento/handoff). O `slug` das etapas de Vendas espelha o enum
-- antigo, então o webhook do n8n (sales-mirror) segue mapeando por slug.
-- ===========================================================================

-- ─── 1. PIPELINES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.funnel_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('locacao', 'vendas')),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#c9a84c',
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_funnel_pipelines_company_type
  ON public.funnel_pipelines(company_id, type, sort_order);
-- Só um default por (empresa, tipo)
CREATE UNIQUE INDEX IF NOT EXISTS uq_funnel_pipelines_one_default
  ON public.funnel_pipelines(company_id, type) WHERE is_default;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.funnel_pipelines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 2. STAGES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.funnel_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES public.funnel_pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#94a3b8',
  slug TEXT,                                  -- estável p/ mapeamento da IA (n8n)
  sort_order INT NOT NULL DEFAULT 0,
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_funnel_stages_pipeline
  ON public.funnel_stages(pipeline_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS uq_funnel_stages_slug
  ON public.funnel_stages(pipeline_id, slug) WHERE slug IS NOT NULL;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.funnel_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 3. TAGS (catálogo, separado por tipo) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('locacao', 'vendas')),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#94a3b8',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, type, name)
);
CREATE INDEX IF NOT EXISTS idx_tags_company_type ON public.tags(company_id, type);

-- ─── 4. DEALS (o card do kanban) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.funnel_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES public.funnel_pipelines(id) ON DELETE RESTRICT,
  stage_id UUID NOT NULL REFERENCES public.funnel_stages(id) ON DELETE RESTRICT,
  conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.whatsapp_contacts(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,  -- corretagem: imóvel do negócio
  title TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  expected_close_date DATE,
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  lost_reason TEXT,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_funnel_deals_pipeline_stage
  ON public.funnel_deals(pipeline_id, stage_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_funnel_deals_company ON public.funnel_deals(company_id);
CREATE INDEX IF NOT EXISTS idx_funnel_deals_conversation
  ON public.funnel_deals(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_funnel_deals_contact
  ON public.funnel_deals(contact_id) WHERE contact_id IS NOT NULL;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.funnel_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 5. M2M: deal ↔ tag ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.funnel_deal_tags (
  deal_id UUID NOT NULL REFERENCES public.funnel_deals(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (deal_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_funnel_deal_tags_tag ON public.funnel_deal_tags(tag_id);

-- ─── 6. M2M: conversa ↔ tag (inbox do chat) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversation_tags (
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (conversation_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_conversation_tags_tag ON public.conversation_tags(tag_id);

-- ─── 7. RLS (mesmo gate de company das demais tabelas) ─────────────────────
ALTER TABLE public.funnel_pipelines  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_stages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_deals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_deal_tags  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipelines same company" ON public.funnel_pipelines;
CREATE POLICY "pipelines same company" ON public.funnel_pipelines FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "stages via pipeline company" ON public.funnel_stages;
CREATE POLICY "stages via pipeline company" ON public.funnel_stages FOR ALL TO authenticated
  USING (pipeline_id IN (
    SELECT id FROM public.funnel_pipelines
    WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())))
  WITH CHECK (pipeline_id IN (
    SELECT id FROM public.funnel_pipelines
    WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())));

DROP POLICY IF EXISTS "tags same company" ON public.tags;
CREATE POLICY "tags same company" ON public.tags FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "deals same company" ON public.funnel_deals;
CREATE POLICY "deals same company" ON public.funnel_deals FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "deal tags via deal company" ON public.funnel_deal_tags;
CREATE POLICY "deal tags via deal company" ON public.funnel_deal_tags FOR ALL TO authenticated
  USING (deal_id IN (
    SELECT id FROM public.funnel_deals
    WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())))
  WITH CHECK (deal_id IN (
    SELECT id FROM public.funnel_deals
    WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())));

DROP POLICY IF EXISTS "conversation tags via conversation company" ON public.conversation_tags;
CREATE POLICY "conversation tags via conversation company" ON public.conversation_tags FOR ALL TO authenticated
  USING (conversation_id IN (
    SELECT id FROM public.whatsapp_conversations
    WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())))
  WITH CHECK (conversation_id IN (
    SELECT id FROM public.whatsapp_conversations
    WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())));

-- ─── 8. SEED: funis default por empresa (idempotente) ──────────────────────
DO $$
DECLARE
  c RECORD;
  loc_pipeline UUID;
  ven_pipeline UUID;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    -- Funil de Reservas (Locação)
    SELECT id INTO loc_pipeline FROM public.funnel_pipelines
      WHERE company_id = c.id AND type = 'locacao' AND is_default LIMIT 1;
    IF loc_pipeline IS NULL THEN
      INSERT INTO public.funnel_pipelines (company_id, type, name, color, is_default, sort_order)
        VALUES (c.id, 'locacao', 'Funil de Reservas', '#3b82f6', true, 0)
        RETURNING id INTO loc_pipeline;
      INSERT INTO public.funnel_stages (pipeline_id, name, color, slug, sort_order, is_won, is_lost) VALUES
        (loc_pipeline, 'Novo contato',              '#94a3b8', 'novo_contato',     0, false, false),
        (loc_pipeline, 'Cotação · Disponibilidade', '#60a5fa', 'cotacao',          1, false, false),
        (loc_pipeline, 'Reserva pendente',          '#f59e0b', 'reserva_pendente', 2, false, false),
        (loc_pipeline, 'Confirmado',                '#10b981', 'confirmado',       3, true,  false),
        (loc_pipeline, 'Perdido',                   '#ef4444', 'perdido',          4, false, true);
    END IF;

    -- Funil de Corretagem (Vendas) — slugs espelham o enum antigo (compat IA)
    SELECT id INTO ven_pipeline FROM public.funnel_pipelines
      WHERE company_id = c.id AND type = 'vendas' AND is_default LIMIT 1;
    IF ven_pipeline IS NULL THEN
      INSERT INTO public.funnel_pipelines (company_id, type, name, color, is_default, sort_order)
        VALUES (c.id, 'vendas', 'Funil de Corretagem', '#c9a84c', true, 0)
        RETURNING id INTO ven_pipeline;
      INSERT INTO public.funnel_stages (pipeline_id, name, color, slug, sort_order, is_won, is_lost) VALUES
        (ven_pipeline, 'Apresentação',            '#94a3b8', 'apresentacao',            0, false, false),
        (ven_pipeline, 'Qualificação · Objetivo', '#60a5fa', 'qualificacao_objetivo',   1, false, false),
        (ven_pipeline, 'Qualificação · Orçamento','#818cf8', 'qualificacao_orcamento',  2, false, false),
        (ven_pipeline, 'Apresentação de Imóveis', '#8b5cf6', 'apresentacao_imoveis',    3, false, false),
        (ven_pipeline, 'Handoff',                 '#f59e0b', 'handoff',                 4, false, false),
        (ven_pipeline, 'Encerramento',            '#6b7280', 'encerramento',            5, false, false);
    END IF;
  END LOOP;
END $$;

-- ─── 9. MIGRAÇÃO DE DADOS: lead_stage → funnel_deals (Vendas) ───────────────
-- Cria um negócio para cada conversa de Vendas que já tinha um lead_stage,
-- na etapa correspondente (por slug). Conversas sem stage viram "deals virtuais"
-- em runtime (não gravadas aqui). Só roda uma vez (guard por NOT EXISTS).
INSERT INTO public.funnel_deals
  (company_id, pipeline_id, stage_id, conversation_id, title, value, status, sort_order, created_at)
SELECT
  conv.company_id,
  ven.pipeline_id,
  st.id,
  conv.id,
  COALESCE(NULLIF(conv.contact_name, ''), conv.contact_phone),
  0,
  'open',
  (row_number() OVER (PARTITION BY st.id ORDER BY conv.last_message_at DESC NULLS LAST)) * 1000,
  now()
FROM public.whatsapp_conversations conv
JOIN public.whatsapp_lead_data ld ON ld.conversation_id = conv.id AND ld.lead_stage IS NOT NULL
JOIN public.whatsapp_lines line   ON line.id = conv.line_id AND line.purpose = 'sales'
JOIN LATERAL (
  SELECT p.id AS pipeline_id
  FROM public.funnel_pipelines p
  WHERE p.company_id = conv.company_id AND p.type = 'vendas' AND p.is_default
  LIMIT 1
) ven ON true
JOIN public.funnel_stages st ON st.pipeline_id = ven.pipeline_id AND st.slug = ld.lead_stage
WHERE NOT EXISTS (
  SELECT 1 FROM public.funnel_deals d WHERE d.conversation_id = conv.id
);

-- ===========================================================================
-- FIM 023. Próxima (Etapa B): 024_campaigns.sql (campanhas + disparo em massa).
-- ===========================================================================
