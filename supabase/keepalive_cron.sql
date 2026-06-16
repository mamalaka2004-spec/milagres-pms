-- ===========================================================================
-- KEEP-ALIVE — impede o projeto Supabase (free tier) de pausar por inatividade.
--
-- Roda a cada ~6 dias e dispara uma REQUISIÇÃO HTTP REAL à própria API REST.
-- Isso é o que conta como atividade de API. Um SELECT interno sozinho NÃO conta.
--
-- Como usar: Supabase Dashboard (projeto Milagres / xmmuenaaodlqubfotwzr)
--            -> SQL Editor -> cole tudo -> Run.
-- Idempotente: pode rodar de novo sem duplicar o job.
-- ===========================================================================

-- 1) Extensões necessárias
--    Se 'create extension' der erro de permissão, habilite em
--    Dashboard -> Database -> Extensions (pg_cron e pg_net) e rode só os passos 2-4.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) Remove versão anterior do job (idempotência)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'milagres-keepalive') then
    perform cron.unschedule('milagres-keepalive');
  end if;
end $$;

-- 3) Agenda: 03:30 UTC nos dias 1, 7, 13, 19, 25, 31 (intervalo máximo ~6 dias)
select cron.schedule(
  'milagres-keepalive',
  '30 3 */6 * *',
  $job$
    select net.http_get(
      url     := 'https://xmmuenaaodlqubfotwzr.supabase.co/rest/v1/',
      headers := jsonb_build_object(
        'apikey',        'sb_publishable_7kIsYY6cTfH7f-6M_WPQ7A_vzy8TfQf',
        'Authorization', 'Bearer sb_publishable_7kIsYY6cTfH7f-6M_WPQ7A_vzy8TfQf'
      )
    );
  $job$
);

-- 4) Conferir que ficou agendado (deve retornar 1 linha, active = true)
select jobid, jobname, schedule, active
from cron.job
where jobname = 'milagres-keepalive';

-- ---------------------------------------------------------------------------
-- Útil depois:
--   Ver execuções:   select * from cron.job_run_details
--                     where jobid = (select jobid from cron.job
--                                    where jobname='milagres-keepalive')
--                     order by start_time desc limit 10;
--   Remover o job:    select cron.unschedule('milagres-keepalive');
-- ---------------------------------------------------------------------------
