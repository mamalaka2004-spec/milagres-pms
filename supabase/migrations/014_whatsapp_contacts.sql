-- ============================================================
-- MILAGRES PMS — WhatsApp contacts (phonebook) for the Reservas number
-- Run AFTER 011_property_guides_kb.sql. Idempotent.
--
-- A directory of WhatsApp contacts imported from the phone export. Kept SEPARATE
-- from public.guests so it doesn't pollute the guest base / privacy gate.
-- Rows are classified (guest / lead / provider / spam / personal) and matched to
-- conversations by `phone_canonical` (DDD + last 8 digits, country-code/9th-digit
-- agnostic — same key the AI identity gate uses).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  line_id UUID REFERENCES public.whatsapp_lines(id) ON DELETE SET NULL,
  phone_e164 TEXT,
  phone_canonical TEXT NOT NULL,         -- DDD + last 8 digits (matching key)
  display_name TEXT,
  raw_label TEXT,                        -- original label from the export
  category TEXT,                         -- 'guest' | 'guest_maybe' | 'lead' | 'provider' | 'spam' | 'personal'
  unit_hint TEXT,                        -- parsed unit_code when present (cotinguiba-08, ...)
  tags TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'google_contacts',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, phone_canonical)
);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_company ON public.whatsapp_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_category ON public.whatsapp_contacts(category);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_canonical ON public.whatsapp_contacts(phone_canonical);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_unit ON public.whatsapp_contacts(unit_hint);

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wa contacts same company" ON public.whatsapp_contacts;
CREATE POLICY "wa contacts same company" ON public.whatsapp_contacts FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
