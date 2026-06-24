# Integração de pagamentos — Asaas (pronto para conectar)

O schema e os pontos de integração já existem. Para **ativar**, basta configurar as
variáveis de ambiente e o webhook no painel do Asaas. Sem elas, o app segue 100%
funcional com pagamentos manuais (o botão "Gerar cobrança" avisa que o Asaas não está
configurado).

## Variáveis de ambiente

```
ASAAS_API_KEY        = <access token do Asaas>
ASAAS_BASE_URL       = https://api.asaas.com/v3        # produção
#                      https://sandbox.asaas.com/api/v3 # sandbox (padrão se vazio)
ASAAS_WEBHOOK_TOKEN  = <token que você define p/ validar o webhook>
```

## Modelo de dados

Uma **cobrança** é uma linha em `payments` com `status='pending'` + campos de gateway
(migration `017_asaas_gateway.sql`):

| coluna | uso |
|---|---|
| `gateway` | `asaas` (NULL = pagamento manual) |
| `external_id` | id da cobrança no Asaas |
| `billing_type` | `PIX` / `BOLETO` / `CREDIT_CARD` / `UNDEFINED` |
| `invoice_url` | link da fatura para o cliente |
| `pix_payload` | PIX copia-e-cola |
| `due_date` | vencimento |
| `external_status` | status cru do Asaas |
| `synced_at` | última sincronização (via webhook) |

`guests.asaas_customer_id` guarda o id do cliente no Asaas (criado sob demanda).

## Fluxo

1. **Gerar cobrança** — `POST /api/reservations/[id]/charge` `{ billing_type, amount?, due_date? }`
   (admin/manager). Cria/reusa o customer no Asaas, cria a cobrança, e grava um
   `payments` pendente. Botão no detalhe da reserva → seção Pagamentos.
2. **Cliente paga** pela `invoice_url` (ou PIX).
3. **Webhook** — `POST /api/webhooks/asaas` recebe os eventos (`PAYMENT_CONFIRMED`,
   `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, …), acha o `payments` pelo
   `external_id`, atualiza `status`/`external_status` e re-sincroniza
   `reservations.payment_status`. Configure a URL no painel Asaas + o header
   `asaas-access-token` = `ASAAS_WEBHOOK_TOKEN`.

## Arquivos

- `src/lib/asaas/client.ts` — client REST tipado (`isConfigured`, `createCustomer`, `createPayment`, `getPixQrCode`, `mapStatus`).
- `src/app/api/reservations/[id]/charge/route.ts` — gera a cobrança.
- `src/app/api/webhooks/asaas/route.ts` — recebe os eventos.
- `src/components/finance/charge-button.tsx` — botão "Gerar cobrança".
- Financeiro: KPI **"A receber"** (soma das cobranças `pending`).
