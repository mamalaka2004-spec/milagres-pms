-- ===========================================================================
-- 036 — Motor de Campanhas (antiban + cadências + listas + opt-out)
-- Run AFTER 035_site_settings.sql. Idempotent.
-- Project: Milagres / xmmuenaaodlqubfotwzr
-- ===========================================================================
-- Substitui o disparo via n8n (024) por um worker próprio: Edge Function
-- `campaign-tick` acionada por pg_cron a cada 60s, chamando a Evolution API
-- direto. Lógica antiban portada do Vita-system: intervalos randômicos,
-- janela comercial com timezone, limites diário/horário por linha, digitação
-- simulada, warmup de número e opt-out por palavra-chave.
--
-- Cadências: campanha vira sequência de passos (campaign_steps). O passo N+1
-- só sai para quem NÃO respondeu após `wait_hours`. Resposta interrompe a
-- cadência (recipient → 'replied') e a IA de Vendas assume a conversa.
-- ===========================================================================

-- ─── 1. CAMPAIGNS — antiban + analytics ────────────────────────────────────
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS min_interval_seconds INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS max_interval_seconds INT NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS daily_limit INT NOT NULL DEFAULT 200,     -- por linha/dia
  ADD COLUMN IF NOT EXISTS hourly_limit INT NOT NULL DEFAULT 60,     -- por linha/hora
  ADD COLUMN IF NOT EXISTS schedule JSONB NOT NULL DEFAULT
    '{"timezone":"America/Sao_Paulo","days":[1,2,3,4,5,6],"start_time":"09:00","end_time":"19:00"}'::jsonb,
  ADD COLUMN IF NOT EXISTS simulate_typing BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS typing_seconds_min INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS typing_seconds_max INT NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS opt_out_keywords TEXT[] NOT NULL DEFAULT
    ARRAY['sair','parar','pare','remover','descadastrar','nao quero','não quero','stop'],
  ADD COLUMN IF NOT EXISTS skip_active_conversations BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivered_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS read_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replied_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opted_out_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audience JSONB;                           -- {"list_ids":[...]}

-- throttle_seconds (024) fica deprecado — min/max_interval_seconds assume.

-- Status: acrescenta 'paused' ao CHECK.
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('draft', 'scheduled', 'sending', 'paused', 'sent', 'failed', 'cancelled'));

-- ─── 2. CAMPAIGN STEPS (cadência) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  order_index INT NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'template' CHECK (kind IN ('template', 'ai')),
  body TEXT,                          -- template: {{nome}}/{{primeiro_nome}}/{{telefone}} + spintax {a|b}
  ai_prompt TEXT,                     -- kind='ai': instrução do passo (contexto da conversa é anexado na rota)
  media_url TEXT,
  media_mime_type TEXT,
  wait_hours NUMERIC NOT NULL DEFAULT 0,  -- espera SEM resposta após o passo anterior (passo 0 = 0)
  variant TEXT NOT NULL DEFAULT 'A',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (campaign_id, order_index, variant),
  CHECK (
    (kind = 'template' AND (body IS NOT NULL OR media_url IS NOT NULL))
    OR (kind = 'ai' AND ai_prompt IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_campaign_steps_campaign
  ON public.campaign_steps(campaign_id, order_index);

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.campaign_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Backfill: campanhas antigas (024) ganham o passo 0 a partir de message_template.
INSERT INTO public.campaign_steps (campaign_id, order_index, kind, body, media_url, media_mime_type)
SELECT c.id, 0, 'template', c.message_template, c.media_url, c.media_mime_type
  FROM public.campaigns c
 WHERE NOT EXISTS (SELECT 1 FROM public.campaign_steps s WHERE s.campaign_id = c.id);

-- ─── 3. CAMPAIGN RECIPIENTS — estado de fila + cadência ────────────────────
ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_step INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS variant TEXT NOT NULL DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Status: 'pending' = na fila aguardando scheduled_for (inclusive entre passos);
-- 'sent' = todos os passos enviados sem resposta; 'replied'/'opted_out' = terminais.
-- 'delivered' mantido só por compat com dados antigos — entregue/lido agora são timestamps.
ALTER TABLE public.campaign_recipients DROP CONSTRAINT IF EXISTS campaign_recipients_status_check;
ALTER TABLE public.campaign_recipients ADD CONSTRAINT campaign_recipients_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'failed', 'skipped', 'replied', 'opted_out'));

-- Fila do worker (claim) e lookup do webhook inbound por telefone.
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_queue
  ON public.campaign_recipients(campaign_id, status, scheduled_for)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_phone_active
  ON public.campaign_recipients(phone_canonical)
  WHERE status IN ('pending', 'sending', 'sent', 'delivered');

-- ─── 4. CAMPAIGN MESSAGES — 1 linha por passo enviado (analytics/limites) ──
CREATE TABLE IF NOT EXISTS public.campaign_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.campaign_steps(id) ON DELETE SET NULL,
  whatsapp_message_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  external_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign
  ON public.campaign_messages(campaign_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_external
  ON public.campaign_messages(external_id);

-- ─── 5. CONTACT LISTS (listas salvas do fonebook) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contact_lists_company ON public.contact_lists(company_id);

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.contact_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS public.contact_list_members (
  list_id UUID NOT NULL REFERENCES public.contact_lists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (list_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_contact_list_members_contact
  ON public.contact_list_members(contact_id);

-- ─── 6. OPT-OUT (LGPD) + WARMUP de número ──────────────────────────────────
ALTER TABLE public.whatsapp_contacts
  ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opt_out_source TEXT;   -- 'keyword' | 'manual'

-- Warmup: rampa diária fica em código no campaign-tick (dias desde warmup_start_date:
-- 1–3→20/dia, 4–7→40, 8–14→70, 15–21→120, 22+→sem cap extra). Cap efetivo =
-- LEAST(campaigns.daily_limit, rampa).
ALTER TABLE public.whatsapp_lines
  ADD COLUMN IF NOT EXISTS warmup_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warmup_start_date DATE;

-- ─── 7. RPC — claim atômico de destinatários (worker campaign-tick) ────────
-- FOR UPDATE SKIP LOCKED: ticks concorrentes (pg_cron 60s + sleeps de digitação
-- podendo passar de 60s) nunca pegam o mesmo destinatário — sem envio duplicado.
CREATE OR REPLACE FUNCTION public.claim_campaign_recipients(_campaign_id uuid, _batch int)
RETURNS SETOF public.campaign_recipients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.campaign_recipients r
     SET status = 'sending', attempts = r.attempts + 1, updated_at = now()
   WHERE r.id IN (
     SELECT cr.id
       FROM public.campaign_recipients cr
      WHERE cr.campaign_id = _campaign_id
        AND cr.status = 'pending'
        AND cr.scheduled_for IS NOT NULL
        AND cr.scheduled_for <= now()
        AND cr.replied_at IS NULL
        AND cr.opted_out_at IS NULL
      ORDER BY cr.scheduled_for
      LIMIT GREATEST(_batch, 1)
      FOR UPDATE SKIP LOCKED
   )
  RETURNING r.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_campaign_recipients(uuid, int) FROM anon, authenticated;

-- ─── 8. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_list_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "steps via campaign company" ON public.campaign_steps;
CREATE POLICY "steps via campaign company" ON public.campaign_steps FOR ALL TO authenticated
  USING (campaign_id IN (
    SELECT id FROM public.campaigns
    WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())))
  WITH CHECK (campaign_id IN (
    SELECT id FROM public.campaigns
    WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())));

DROP POLICY IF EXISTS "messages via campaign company" ON public.campaign_messages;
CREATE POLICY "messages via campaign company" ON public.campaign_messages FOR ALL TO authenticated
  USING (campaign_id IN (
    SELECT id FROM public.campaigns
    WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())))
  WITH CHECK (campaign_id IN (
    SELECT id FROM public.campaigns
    WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())));

DROP POLICY IF EXISTS "contact lists same company" ON public.contact_lists;
CREATE POLICY "contact lists same company" ON public.contact_lists FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "list members via list company" ON public.contact_list_members;
CREATE POLICY "list members via list company" ON public.contact_list_members FOR ALL TO authenticated
  USING (list_id IN (
    SELECT id FROM public.contact_lists
    WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())))
  WITH CHECK (list_id IN (
    SELECT id FROM public.contact_lists
    WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())));

-- ===========================================================================
-- FIM 036.
-- ===========================================================================
