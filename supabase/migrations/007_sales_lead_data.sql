-- ============================================================
-- MILAGRES PMS — Sales (Vendas) module — lead data sidecar table
-- Run AFTER 006_whatsapp_storage.sql
-- Idempotent: safe to run multiple times.
-- ============================================================
-- Adds a 1:1 sidecar to `whatsapp_conversations` for sales-specific data.
-- Conversations on lines with purpose='sales' get a row here; other purposes
-- never touch this table.
--
-- Stage values mirror the agent prompt in workflow `Milagres Completo`
-- (apresentacao → qualificacao_objetivo → qualificacao_orcamento →
--  apresentacao_imoveis → handoff → encerramento).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_lead_data (
  conversation_id UUID PRIMARY KEY REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  origem TEXT CHECK (origem IN ('inbound', 'prospeccao_fria')),
  lead_stage TEXT CHECK (lead_stage IN (
    'apresentacao',
    'qualificacao_objetivo',
    'qualificacao_orcamento',
    'apresentacao_imoveis',
    'handoff',
    'encerramento'
  )),
  objetivo TEXT,
  orcamento TEXT,
  confidence_score INT CHECK (confidence_score >= 0 AND confidence_score <= 10),
  reasoning TEXT,
  property_of_interest TEXT,        -- nome / código do imóvel pretendido (opcional)
  marcelo_handoff_at TIMESTAMPTZ,   -- quando o handoff foi acionado
  closed_reason TEXT,               -- ao chegar em encerramento, por quê
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_data_stage ON public.whatsapp_lead_data(lead_stage);

-- RLS — same gate as the parent conversation
ALTER TABLE public.whatsapp_lead_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see lead data for accessible sales conversations" ON public.whatsapp_lead_data;
CREATE POLICY "Users see lead data for accessible sales conversations" ON public.whatsapp_lead_data
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM public.whatsapp_conversations
      WHERE line_id IN (SELECT line_id FROM public.whatsapp_line_users WHERE user_id = auth.uid())
        OR company_id IN (
          SELECT company_id FROM public.users
          WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    )
  );
