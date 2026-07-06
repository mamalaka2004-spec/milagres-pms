-- ===========================================================================
-- 031 — Google Calendar bidirecional por anúncio  ·  Fase 9 (#25) — SCAFFOLD
-- Run AFTER 030_ai_credits.sql. Idempotente.
-- Project: Milagres / xmmuenaaodlqubfotwzr
-- ===========================================================================
-- APENAS O MODELO DE DADOS. O fluxo OAuth real está BLOQUEADO: requer
-- client_id / client_secret + redirect URI verificado do Google Cloud, que NÃO
-- temos nesta fase. Nenhum segredo é gravado aqui. Os campos de token existem
-- para o wiring futuro, mas ficam NULL até a integração OAuth ser configurada.
--
--   google_calendar_connections — 1 conexão por (empresa, anúncio/imóvel,
--       calendário Google). Guarda direção do sync (import/export/ambos),
--       estado e (futuramente) os tokens OAuth.
--   google_calendar_sync_log    — histórico de execuções de sincronização.
--
-- "Anúncio/listing" no Milagres = properties. A conexão é por property_id
-- (NULL = conexão a nível de empresa, calendário-mãe opcional).
-- ===========================================================================

-- ─── 1. CONEXÕES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- O anúncio/listing. NULL = conexão a nível de empresa.
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,

  -- Identificação do calendário Google (preenchido após o OAuth).
  google_calendar_id TEXT,
  google_account_email TEXT,

  -- Direção do sync bidirecional.
  direction TEXT NOT NULL DEFAULT 'both'
    CHECK (direction IN ('import', 'export', 'both')),

  -- Ciclo de vida da conexão.
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'pending_auth', 'connected', 'error')),

  -- === Tokens OAuth (BLOQUEADO nesta fase) =================================
  -- Ficam NULL até a integração real. TODO: mover para Vault/segredo cifrado
  -- e nunca versionar. Ver src/lib/calendar/google.ts.
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  oauth_scope TEXT,

  -- Estado de sincronização incremental do Google (syncToken).
  sync_token TEXT,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,

  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Uma conexão por calendário dentro do mesmo anúncio.
  UNIQUE (company_id, property_id, google_calendar_id)
);

CREATE INDEX IF NOT EXISTS idx_gcal_conn_company
  ON public.google_calendar_connections(company_id);
CREATE INDEX IF NOT EXISTS idx_gcal_conn_property
  ON public.google_calendar_connections(property_id);

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE public.google_calendar_connections IS
  'Scaffold (#25): conexão de Google Calendar por anúncio. OAuth real bloqueado por credenciais.';
COMMENT ON COLUMN public.google_calendar_connections.refresh_token IS
  'BLOQUEADO nesta fase — NUNCA gravar segredo real sem cifra/Vault. Ver lib/calendar/google.ts.';

-- ─── 2. LOG DE SYNC ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_calendar_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.google_calendar_connections(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('import', 'export')),
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'error')),
  events_imported INT NOT NULL DEFAULT 0,
  events_exported INT NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gcal_synclog_conn
  ON public.google_calendar_sync_log(connection_id, created_at DESC);

COMMENT ON TABLE public.google_calendar_sync_log IS
  'Scaffold (#25): histórico de sincronizações Google Calendar (import/export).';

-- ─── 3. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_sync_log     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gcal connections same company" ON public.google_calendar_connections;
CREATE POLICY "gcal connections same company" ON public.google_calendar_connections FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "gcal sync log same company" ON public.google_calendar_sync_log;
CREATE POLICY "gcal sync log same company" ON public.google_calendar_sync_log FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- ===========================================================================
-- FIM 031. Sem seed: nenhuma conexão até o OAuth ser configurado.
-- ===========================================================================
