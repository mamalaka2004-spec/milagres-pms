-- ─── 022. USER PREFERENCES + ACTIVITY LOG INDEX ───
-- Fase 1B: per-user UI preferences (mode selector Locação×Vendas, etc.) and a
-- composite index to keep the activity-log timeline fast per company.

-- Per-user preferences blob. Currently holds the active mode ("locacao" | "vendas"),
-- but kept generic (JSONB) so future UI prefs can land here without a migration.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

-- The activity-log screen lists "latest first, scoped to my company". The existing
-- idx_activity_logs_created is global; this composite serves the company timeline.
CREATE INDEX IF NOT EXISTS idx_activity_logs_company_created
  ON public.activity_logs (company_id, created_at DESC);
