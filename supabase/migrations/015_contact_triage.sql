-- ============================================================
-- MILAGRES PMS — Contact triage funnel + dedup links
-- Run AFTER 014_whatsapp_contacts.sql. Idempotent.
--
-- Makes whatsapp_contacts the single contact identity (1 row per phone):
--   * classification funnel: sem_classificacao → lead → cliente | hospede | fornecedor
--   * whatsapp_contacts.guest_id  → links a contact to its hospitality guest record
--   * whatsapp_conversations.contact_id → links a conversation to its contact (no name dup)
-- ============================================================

ALTER TABLE public.whatsapp_contacts
  ADD COLUMN IF NOT EXISTS classification TEXT NOT NULL DEFAULT 'sem_classificacao'
  CHECK (classification IN ('sem_classificacao', 'lead', 'cliente', 'hospede', 'fornecedor'));

ALTER TABLE public.whatsapp_contacts
  ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.whatsapp_contacts(id) ON DELETE SET NULL;

-- Seed the funnel from the existing auto-classification (category), once.
UPDATE public.whatsapp_contacts SET classification = CASE category
  WHEN 'guest' THEN 'hospede'
  WHEN 'guest_maybe' THEN 'lead'
  WHEN 'lead' THEN 'lead'
  WHEN 'provider' THEN 'fornecedor'
  ELSE 'sem_classificacao'
END
WHERE classification = 'sem_classificacao';

CREATE INDEX IF NOT EXISTS idx_wa_contacts_classification ON public.whatsapp_contacts(classification);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_guest ON public.whatsapp_contacts(guest_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_contact ON public.whatsapp_conversations(contact_id);
