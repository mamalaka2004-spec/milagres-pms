-- ===========================================================================
-- 008 — Chat CRM enhancements (Chat Reservas & Chat Vendas)
-- Adds: quick replies (canned responses) + conversation triage flags.
-- Run in the Supabase SQL Editor (project Milagres / xmmuenaaodlqubfotwzr).
-- Idempotent.
-- ===========================================================================

-- 1) Quick replies (canned responses), scoped per company
CREATE TABLE IF NOT EXISTS public.whatsapp_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  shortcut TEXT,
  category TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_qr_company ON public.whatsapp_quick_replies(company_id);

ALTER TABLE public.whatsapp_quick_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage company quick replies" ON public.whatsapp_quick_replies;
CREATE POLICY "Users manage company quick replies" ON public.whatsapp_quick_replies
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

-- 2) Conversation triage flags
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS important BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marked_unread BOOLEAN NOT NULL DEFAULT false;

-- 3) Starter quick replies for the Milagres company (only if none exist yet)
INSERT INTO public.whatsapp_quick_replies (company_id, title, body, category)
SELECT c.id, v.title, v.body, v.category
FROM public.companies c
CROSS JOIN (VALUES
  ('Saudação', 'Olá! Aqui é da {{empresa}}. Como posso ajudar com sua estadia? 😊', 'Geral'),
  ('Disponibilidade', 'Deixa eu verificar a disponibilidade para essas datas e já te retorno, {{nome}}!', 'Reservas'),
  ('Enviar valores', 'Segue o valor da diária para o período. Posso reservar para você?', 'Reservas'),
  ('Agradecimento', 'Obrigado pelo contato, {{nome}}! Qualquer dúvida, é só chamar. 🌴', 'Geral')
) AS v(title, body, category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_quick_replies q WHERE q.company_id = c.id
);
