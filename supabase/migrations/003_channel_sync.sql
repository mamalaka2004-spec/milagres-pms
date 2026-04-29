-- ============================================================
-- MILAGRES PMS — Channel Sync (Airbnb / Booking iCal)
-- Run AFTER 002_storage_buckets.sql
-- Idempotent: safe to run multiple times.
-- ============================================================

-- ─── 1. Properties: per-listing iCal URLs + last sync timestamps ───
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS airbnb_ical_url TEXT,
  ADD COLUMN IF NOT EXISTS booking_ical_url TEXT,
  ADD COLUMN IF NOT EXISTS airbnb_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booking_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS airbnb_listing_url TEXT,
  ADD COLUMN IF NOT EXISTS booking_listing_url TEXT;

-- ─── 2. blocked_dates: source tracking so we can re-sync without dupes ───
ALTER TABLE public.blocked_dates
  ADD COLUMN IF NOT EXISTS external_source TEXT
    CHECK (external_source IN ('airbnb', 'booking', 'manual'))
    DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_uid TEXT,
  ADD COLUMN IF NOT EXISTS external_summary TEXT,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_external_uid
  ON public.blocked_dates(property_id, external_source, external_uid)
  WHERE external_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_blocked_dates_property_range
  ON public.blocked_dates(property_id, start_date, end_date);

-- ─── 3. RLS policies for blocked_dates ───
-- (table has RLS enabled but no policies before; admin can manage, users can read)
DROP POLICY IF EXISTS "Users can view company blocked dates" ON public.blocked_dates;
CREATE POLICY "Users can view company blocked dates" ON public.blocked_dates
  FOR SELECT USING (
    property_id IN (
      SELECT id FROM public.properties
      WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admin can manage blocked dates" ON public.blocked_dates;
CREATE POLICY "Admin can manage blocked dates" ON public.blocked_dates
  FOR ALL USING (
    property_id IN (
      SELECT id FROM public.properties
      WHERE company_id IN (
        SELECT company_id FROM public.users
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  );
