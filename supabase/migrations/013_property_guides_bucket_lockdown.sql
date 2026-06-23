-- ============================================================
-- MILAGRES PMS — Lock down the private property-guides bucket
-- Run AFTER 011_property_guides_kb.sql. Idempotent.
--
-- Fix (review #3): the original "Staff manage property guides" policy granted
-- ALL operations on the bucket to ANY authenticated user, which in a multi-company
-- setup would let a user read guide PDFs (Wi-Fi/lock codes) of OTHER companies.
--
-- All legitimate access already goes through the server with the service_role key
-- (signed URLs for reads, the upload script for writes) — and service_role BYPASSES
-- RLS. So we simply remove the broad authenticated policy: no authenticated user can
-- touch the bucket directly anymore, while signed-URL reads and server uploads keep
-- working. A future authenticated-client UI must add a company-scoped policy
-- (e.g. path prefix '<company_id>/...').
-- ============================================================

DROP POLICY IF EXISTS "Staff manage property guides" ON storage.objects;

-- Keep the bucket private (defensive; 011 already created it non-public).
UPDATE storage.buckets SET public = false WHERE id = 'property-guides';

-- Document the real domain of welcome_sent_by (review #14): includes the guard value.
COMMENT ON COLUMN public.reservations.welcome_sent_by IS 'auto | human | skipped_human';
