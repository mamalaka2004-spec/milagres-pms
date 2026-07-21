-- ===========================================================================
-- CAMPAIGN TICK — agenda o worker de campanhas (pg_cron, a cada 60s).
--
-- O job chama a Edge Function `campaign-tick` via pg_net, lendo o header
-- x-cron-secret da tabela privada campaign_engine_config (migration 037) a
-- cada execução — nenhum segredo hardcoded aqui.
--
-- Como usar: Supabase Dashboard (projeto Milagres / xmmuenaaodlqubfotwzr)
--            -> SQL Editor -> cole tudo -> Run. (Requer 037 já aplicada.)
-- Idempotente: pode rodar de novo sem duplicar o job.
-- ===========================================================================

-- 1) Extensões (já habilitadas pelo keepalive; inofensivo repetir)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) Remove versão anterior do job (idempotência)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'campaign-tick-minutely') then
    perform cron.unschedule('campaign-tick-minutely');
  end if;
end $$;

-- 3) Agenda: a cada minuto. BATCH_SIZE=1 no worker → o cron é o piso de
--    espaçamento anti-ban (~60 envios/hora máx por campanha).
select cron.schedule(
  'campaign-tick-minutely',
  '* * * * *',
  $job$
    select net.http_post(
      url     := 'https://xmmuenaaodlqubfotwzr.supabase.co/functions/v1/campaign-tick',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-cron-secret', (select cron_secret from public.campaign_engine_config limit 1)
      ),
      body    := '{}'::jsonb
    );
  $job$
);

-- 4) Conferir: select jobname, schedule, active from cron.job;
