-- ============================================================
-- MILAGRES PMS — Property Guides + Knowledge Base
-- Run AFTER 010_reservations_soft_delete.sql
-- Idempotent: safe to run multiple times.
--
-- Adds:
--   * private storage bucket `property-guides` (PDFs contain wifi/lock codes)
--   * public.property_guides  — 1 row per rental unit (public + private fields)
--   * public.kb_articles      — shared regional guide + FAQ, with visibility gate
--   * reservations.welcome_sent_at / welcome_sent_by / access_info_sent_at
-- ============================================================

-- ─── 1. PRIVATE BUCKET FOR GUIDE PDFs ───
-- NOT public: the guides include wifi password + electronic lock codes.
-- Served to confirmed guests/staff only via signed URLs (service_role).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-guides',
  'property-guides',
  false,
  78643200, -- 75MB (guide PDFs are ~50-60MB)
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff manage property guides" ON storage.objects;
CREATE POLICY "Staff manage property guides"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'property-guides')
WITH CHECK (bucket_id = 'property-guides');
-- No public SELECT policy on purpose. Reads happen via signed URLs from the server.

-- ─── 2. PROPERTY GUIDES (one per rental unit) ───
CREATE TABLE IF NOT EXISTS public.property_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Optional link to a PMS listing (the 7 guides don't map 1:1 to the 4 current listings;
  -- link each guide to its listing later in the PMS).
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_code TEXT NOT NULL,                 -- e.g. 'cotinguiba-08'
  name TEXT NOT NULL,                      -- e.g. 'Cotinguiba 08'
  property_type TEXT,                      -- 'duplex' | 'cobertura' | 'casa_terrea' | 'casa_rooftop'
  condo TEXT,                              -- 'Cotinguiba' | 'Kanui' | 'Tamoná' | 'Essence'
  region TEXT,                             -- 'São Miguel dos Milagres'

  -- public capacity / description
  max_guests INT,
  suites INT,
  beds TEXT,
  bathrooms TEXT,
  short_description TEXT,
  description TEXT,
  amenities TEXT[] DEFAULT '{}',
  house_rules TEXT[] DEFAULT '{}',
  check_in_time TEXT DEFAULT '15:00',
  check_out_time TEXT DEFAULT '11:00',
  cancellation_policy TEXT,

  -- PRIVATE — only released to a confirmed reservation for this unit
  wifi_ssid TEXT,
  wifi_password TEXT,
  access_method TEXT,                      -- 'fechadura_facial' | 'chaves_portaria' | 'chaves_cofre'
  door_code TEXT,
  access_instructions TEXT,
  exact_address TEXT,
  maps_url TEXT,

  -- media
  pdf_path TEXT,                           -- object path inside 'property-guides' bucket
  image_urls TEXT[] DEFAULT '{}',          -- marketing images (public)
  video_urls TEXT[] DEFAULT '{}',

  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, unit_code)
);
CREATE INDEX IF NOT EXISTS idx_property_guides_company ON public.property_guides(company_id);
CREATE INDEX IF NOT EXISTS idx_property_guides_property ON public.property_guides(property_id);

-- ─── 3. KNOWLEDGE BASE / FAQ (regional shared + per-unit) ───
CREATE TABLE IF NOT EXISTS public.kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- null = applies to every unit (regional / company-wide)
  property_guide_id UUID REFERENCES public.property_guides(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'region' CHECK (scope IN ('region', 'unit', 'company')),
  category TEXT NOT NULL,                  -- 'como_chegar','mercados','acougues','restaurantes',
                                           -- 'praias','passeios','vida_noturna','cafe_da_manha',
                                           -- 'beach_clubs','imperdiveis','beleza_spa','emergencia',
                                           -- 'enxoval','checkin','faq'
  title TEXT NOT NULL,
  content TEXT,
  data JSONB,                              -- structured lists (e.g. restaurants w/ instagram/address/contact)
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'confirmed_guest')),
  tags TEXT[] DEFAULT '{}',
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kb_articles_company ON public.kb_articles(company_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON public.kb_articles(category);
CREATE INDEX IF NOT EXISTS idx_kb_articles_visibility ON public.kb_articles(visibility);
CREATE INDEX IF NOT EXISTS idx_kb_articles_guide ON public.kb_articles(property_guide_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_fts ON public.kb_articles
  USING gin (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(content, '')));

-- ─── 4. RESERVATIONS: auto-welcome tracking ───
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS welcome_sent_by TEXT;       -- 'auto' | 'human'
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS access_info_sent_at TIMESTAMPTZ;

-- ─── 5. updated_at triggers (reuse 001's update_updated_at()) ───
CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.property_guides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 6. RLS (app uses service_role and bypasses; these are defensive) ───
ALTER TABLE public.property_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guides same company" ON public.property_guides;
CREATE POLICY "guides same company" ON public.property_guides FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "kb same company" ON public.kb_articles;
CREATE POLICY "kb same company" ON public.kb_articles FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
