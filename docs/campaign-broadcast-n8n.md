# Disparo de Campanhas (Broadcast) via n8n

O Milagres cria a campanha + destinatários e **delega o envio ao n8n** (throttle,
loop, chamada à Evolution, callback de status). O app nunca faz o loop de envio —
evita timeout de serverless e concentra o anti-ban no n8n.

## Variáveis de ambiente (Milagres)

| Env | Descrição |
|-----|-----------|
| `CAMPAIGN_DISPATCH_WEBHOOK_URL` | URL do **Webhook** do n8n que dispara a campanha. |
| `WHATSAPP_WEBHOOK_SECRET` | Segredo partilhado (já existe). Enviado no header `X-Webhook-Secret` e exigido no callback. |
| `NEXT_PUBLIC_APP_URL` | URL pública do app (ex.: `https://milagres.vercel.app`) — usado para montar o `callback_url`. |

## 1) Milagres → n8n (trigger)

Ao clicar **Disparar** (`POST /api/campaigns/:id/send`), o Milagres faz:

```
POST  {CAMPAIGN_DISPATCH_WEBHOOK_URL}
Header: X-Webhook-Secret: {WHATSAPP_WEBHOOK_SECRET}
Body:
{
  "campaign_id": "uuid",
  "callback_url": "https://SEU_APP/api/webhooks/campaigns/status",
  "message_template": "Olá {{nome}}! ...",
  "media_url": null,
  "media_mime_type": null,
  "throttle_seconds": 30,
  "line": { "phone": "+5582...", "provider": "evolution", "provider_instance": "...", "provider_token": "..." },
  "recipients": [ { "id": "uuid", "phone_e164": "+5582...", "phone_canonical": "82XXXXXXXX", "name": "Fulano" } ]
}
```

## 2) Workflow n8n (envio)

1. **Webhook** (POST) → valida `X-Webhook-Secret`.
2. **Split Out** em `recipients`.
3. **Loop Over Items** (batch 1):
   - **Wait** `throttle_seconds` (entre envios — evita bloqueio).
   - **Set/Function**: personaliza a mensagem — substitui `{{nome}}` por `recipient.name` (fallback: primeiro nome ou "").
   - **HTTP Request → Evolution**: `sendText` (ou `sendMedia` se `media_url`), usando `line.provider_instance` + `line.provider_token`, para `recipient.phone_e164`.
   - **HTTP Request → callback** (ver §3): status `sent` (com `external_id` da Evolution) ou `failed` (com `error`).

> Dica: se a Evolution retornar erro, envie o callback com `status: "failed"` e o `error` — a campanha não trava por causa de um número inválido.

## 3) n8n → Milagres (callback de status)

Uma chamada **por destinatário**, conforme o envio resolve:

```
POST  {callback_url}   (= https://SEU_APP/api/webhooks/campaigns/status)
Header: X-Webhook-Secret: {WHATSAPP_WEBHOOK_SECRET}
Body:
{
  "campaign_id": "uuid",
  "recipient_id": "uuid",
  "status": "sent",            // sending | sent | delivered | failed | skipped
  "external_id": "id-da-msg",  // opcional
  "error": null                // opcional
}
```

O Milagres atualiza o destinatário, recalcula `sent_count`/`failed_count` e, quando
não há mais pendentes, marca a campanha como `sent` (ou `failed` se todos falharam).

## 4) Campanhas agendadas (opcional)

Para respeitar `scheduled_at`, crie um **Cron** no n8n (ex.: a cada 1 min):

1. **HTTP Request** `GET {NEXT_PUBLIC_APP_URL}/api/campaigns/due` com header `X-Webhook-Secret`.
   - Retorna `{ "campaigns": [ <mesmo payload do §1>, ... ] }` já marcadas como `sending`.
2. Para cada item, rode o **mesmo loop de envio** do §2.

## Status possíveis

- **Campanha**: `draft` → `scheduled` → `sending` → `sent` | `failed` | `cancelled`.
- **Destinatário**: `pending` → `sending` → `sent` | `delivered` | `failed` | `skipped`.
