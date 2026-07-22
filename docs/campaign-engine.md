# Motor de Campanhas — campaign-tick (Edge Function + pg_cron)

Substitui o fluxo n8n descrito no antigo `campaign-broadcast-n8n.md` (removido).
O disparo agora é 100% nosso: um worker Deno no Supabase processa a fila e fala
direto com a Evolution API. Lógica antiban portada do Vita-system.

## Arquitetura

```
UI /campaigns ──POST /api/campaigns/[id]/send──► ENQUEUE (Next.js)
  · valida linha + passos (campaign_steps)
  · audiência: destinatários já adicionados + listas salvas (list_ids)
  · filtra do_not_contact (LGPD) e conversas ativas (últimos 7 dias)
  · variables {{nome}} {{primeiro_nome}} {{telefone}}
  · distribui scheduled_for: gap randômico min/max_interval dentro da janela
  · campanha → status 'scheduled'

pg_cron (1/min) ──x-cron-secret──► EDGE FUNCTION campaign-tick
  · watchdog: destrava 'sending' preso (>10 min)
  · pula campanha fora da janela (schedule jsonb, timezone)
  · linha: provider_instance + provider_token; connectionState != open → PAUSA
  · limites POR LINHA (todas as campanhas): diário (daily_limit ∧ rampa de
    warmup) e horário (hourly_limit) — estourou → reagenda p/ próximo slot
  · claim atômico (RPC claim_campaign_recipients, FOR UPDATE SKIP LOCKED), 1/tick
  · passo atual: template (spintax {a|b} + vars) ou IA (/api/campaigns/ai-step)
  · conversa+mensagem no inbox (whatsapp_conversations/messages, dedup external_id)
  · digitação simulada (sendPresence 2–6s) → sendText/sendMedia (retry 2x em 5xx)
  · registra em campaign_messages · avança cadência (wait_hours) ou conclui
```

Estados: campanha `draft → scheduled → sending → sent|failed|cancelled` (+
`paused` via `/api/campaigns/[id]/control`). Recipient `pending → sending →
sent | failed | skipped | replied | opted_out` (delivered/read são timestamps).

## Rampa de warmup (número novo)

`whatsapp_lines.warmup_enabled` + `warmup_start_date`. Teto diário efetivo =
`min(daily_limit, rampa)`: dias 1–3 → 20 · 4–7 → 40 · 8–14 → 70 · 15–21 → 120 ·
22+ → sem cap extra.

## Configuração — tabela `campaign_engine_config` (migration 037)

Os segredos do worker NÃO usam `supabase secrets set`: vivem num singleton
privado (`campaign_engine_config`, RLS sem policies = só service_role), com
`cron_secret` e `worker_secret` **gerados no próprio banco** (`gen_random_bytes`)
— nada sensível no repo. Env vars da edge function, se setadas, têm precedência.

Campos: `cron_secret` (pg_cron → tick) · `worker_secret` (tick →
`/api/campaigns/ai-step`) · `evolution_api_url` · `evolution_api_key`
(fallback; cada linha usa seu `provider_token`) · `app_url`.

## Deploy (uma vez)

```bash
# 1. Migrations 036 + 037 no SQL Editor (idempotentes)
# 2. Deploy do worker (CLI ou MCP)
supabase functions deploy campaign-tick --project-ref xmmuenaaodlqubfotwzr --no-verify-jwt
# 3. Agendar o cron: rodar supabase/campaign_cron.sql no SQL Editor
#    (o job lê cron_secret da campaign_engine_config — sem placeholders)
```

As envs antigas `CAMPAIGN_DISPATCH_WEBHOOK_URL` (n8n) não são mais usadas.
Rotas aposentadas (respondem 410): `/api/campaigns/due` e
`/api/webhooks/campaigns/status`.

## Teste manual do tick

```bash
curl -s -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  https://xmmuenaaodlqubfotwzr.supabase.co/functions/v1/campaign-tick
# → {"ok":true,"processed":N}
```

## Inbound — resposta, opt-out e Sarah (Etapa 3)

Fluxo real dos webhooks (verificado nas instâncias Evolution):
- **Vendas** (instância `milagres`): eventos → n8n `/webhook/whatsapp-chat`
  (workflow **Milagres Completo** / Sarah). O node "PMS Mirror - Inbound" desse
  workflow reposta cada mensagem do lead em `/api/webhooks/whatsapp/inbound` —
  é aí que `handleCampaignInbound` roda.
- **Reservas** (instância `milagres_hosp_res`): eventos → n8n
  `/webhook/milagres-wa-inbound` (workflow **MILAGRES - WhatsApp Reservas -
  Inbound**) → mesma rota inbound.

O que acontece na resposta de um destinatário de campanha
(`src/lib/campaigns/inbound.ts`):
- Mensagem normal → recipients viram `replied` (cadência PARA), `replied_count`
  incrementa, `whatsapp_lead_data` ganha `origem='prospeccao_fria'` e a IA
  responde mesmo em horário comercial (override do gate só p/ campanha).
- Keyword de opt-out (mensagem curta ≤4 palavras: "sair", "parar"…) → contato
  `do_not_contact` (LGPD), recipients `opted_out`, confirmação curta enviada,
  `ai_active=false` e pausa da Sarah via `WHATSAPP_AI_CONTROL_WEBHOOK_URL`
  (best-effort).

Delivered/read: evento `MESSAGES_UPDATE` habilitado na instância de Vendas;
ambos os workflows n8n ganharam o branch "Status Update → PMS shape" →
`POST /api/webhooks/whatsapp/status` (mapeia `DELIVERY_ACK→delivered`,
`READ/PLAYED→read`; mesma credencial de secret do inbound).

## Pontos de atenção

- **BATCH_SIZE=1** no worker: nunca aumentar sem revisar o timeout da função
  (typing sleep + retries) — o cron 1/min é o piso do espaçamento anti-ban.
- Limites são **por linha** somando todas as campanhas (via `campaign_messages`)
  — duas campanhas na mesma linha dividem o mesmo teto.
- O envio aparece no inbox `/conversations`; o eco `fromMe` do webhook inbound
  é deduplicado por `external_id` (gravado logo após o send).
- Respostas/opt-out do contato: tratados no webhook inbound (Etapa 3).
