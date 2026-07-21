-- ===========================================================================
-- 037 — Config do motor de campanhas (worker campaign-tick)
-- Run AFTER 036_campaign_engine.sql. Idempotent.
-- Project: Milagres / xmmuenaaodlqubfotwzr
-- ===========================================================================
-- Singleton privado (service_role only) com os segredos do worker — evita
-- depender de `supabase secrets set` (CLI). Os secrets são GERADOS NO BANCO
-- (gen_random_bytes) e nunca ficam no repo. Env vars, se setadas na edge
-- function, têm precedência sobre esta tabela.
--
-- O job pg_cron (campaign_cron.sql) lê cron_secret daqui a cada execução.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.campaign_engine_config (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),   -- singleton (1 linha)
  cron_secret TEXT NOT NULL,        -- auth do pg_cron → campaign-tick
  worker_secret TEXT NOT NULL,      -- auth do campaign-tick → /api/campaigns/ai-step
  evolution_api_url TEXT NOT NULL,
  evolution_api_key TEXT,           -- fallback global (linhas usam provider_token)
  app_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.campaign_engine_config ENABLE ROW LEVEL SECURITY;
-- Sem policies: só service_role acessa.
REVOKE ALL ON public.campaign_engine_config FROM anon, authenticated;

INSERT INTO public.campaign_engine_config (id, cron_secret, worker_secret, evolution_api_url, app_url)
SELECT true,
       encode(gen_random_bytes(24), 'hex'),
       encode(gen_random_bytes(24), 'hex'),
       'https://evo.mfmanagerfashion.net',
       'https://milagres-pms.vercel.app'
WHERE NOT EXISTS (SELECT 1 FROM public.campaign_engine_config);

-- ===========================================================================
-- FIM 037.
-- ===========================================================================
