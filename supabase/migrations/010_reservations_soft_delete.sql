-- ===========================================================================
-- 010 — Reservations soft delete
-- Adds a deleted_at column so reservations can be soft-deleted. Reservations
-- affect availability/calendar, so they must never be physically removed.
-- Run in the Supabase SQL Editor. Idempotent.
-- ===========================================================================

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Speeds up the "not deleted" filter used by every list/availability query.
CREATE INDEX IF NOT EXISTS idx_reservations_deleted_at
  ON public.reservations(deleted_at)
  WHERE deleted_at IS NULL;
