# Job diário de Operações (n8n)

A Fase 6 (Operações/Camareira) adicionou um job diário que o **n8n** dispara por cron —
mesmo padrão do polling de campanhas (`/api/campaigns/due`).

## O que o job faz

`GET /api/operations/jobs/run`

1. **Varredura de automação** — garante as tarefas auto-agendadas para reservas dos
   **próximos 7 dias** (preparo pré-check-in para reservas `confirmed`; limpeza
   pós-checkout com antecedência para planejamento). É a rede de segurança dos hooks:
   reservas criadas antes da Fase 6, datas alteradas fora do fluxo etc. Idempotente —
   nunca duplica tarefa (1 por reserva+tipo).
2. **Retenção de storage (#14)** — para cada empresa, remove fotos/vídeos de tarefas
   **concluídas** há mais de N dias (config em *Ajustes → Operações & Camareira*;
   default 90 dias, ativada). Remove o objeto no bucket **e** a linha em `task_photos`.
   Lote de até 500 mídias por execução por empresa.

Os horários das tarefas vêm da config da empresa (offsets sobre check-in/checkout do
imóvel) em *Ajustes → Operações & Camareira*.

## Workflow n8n

- **Schedule Trigger**: 1×/dia (ex.: 03:30 America/Maceio).
- **HTTP Request**:
  - Método: `GET`
  - URL: `https://milagres-pms.vercel.app/api/operations/jobs/run`
  - Header: `x-webhook-secret: {{WHATSAPP_WEBHOOK_SECRET}}` (o mesmo secret já usado
    nos webhooks de WhatsApp/campanhas)
  - Timeout: 60s
- (Opcional) **IF/Slack**: alertar se `success !== true`.

## Resposta

```json
{
  "success": true,
  "data": {
    "automation": { "companies": 1, "checkin_prep_created": 2, "checkout_clean_created": 1 },
    "retention": [
      { "company_id": "…", "enabled": true, "days": 90, "scanned": 12, "removed": 12, "storage_errors": 0 }
    ]
  }
}
```

## Observações

- Sem o cron, o essencial continua funcionando: os hooks de reserva (criar/confirmar/
  checkout/cancelar/editar datas) criam e reagendam as tarefas em tempo real. O cron
  só cobre atrasados + retenção.
- A retenção também pode ser executada manualmente pelo admin no botão **Executar
  agora** em *Ajustes → Operações & Camareira* (`POST /api/operations/retention/run`,
  autenticado por sessão, só a própria empresa).
