# Auditoria Final — Milagres PMS (07/jul/2026)

Revisão completa de frontend, backend e banco de dados. Build de produção validado na data.

## 🔴 Críticos (agir primeiro)

| # | Área | Problema | Onde | Correção |
|---|------|----------|------|----------|
| 1 | DB/Seg | **Senhas de Wi-Fi reais e código de fechadura eletrônica commitados no git** | `supabase/migrations/012_seed_milagres_kb.sql:15-45` | Remover da migração, popular via canal seguro e **rotacionar** senhas/códigos expostos |
| 2 | Backend | **Webhook Asaas falha-aberto**: sem `ASAAS_WEBHOOK_TOKEN` setado, aceita qualquer request (permite forjar pagamento) | `src/app/api/webhooks/asaas/route.ts:17-21` | Falhar fechado (503) quando token ausente, como Stripe/WhatsApp já fazem |
| 3 | DB | **Race de double-booking**: prevenção de overlap é trigger `BEFORE INSERT` com `EXISTS` (TOCTOU); duas transações concorrentes commitam reserva dupla | `001_full_schema.sql:427-448` | `EXCLUDE USING gist (property_id WITH =, daterange(check_in_date, check_out_date, '[)') WITH &&) WHERE (status NOT IN ('canceled','no_show') AND deleted_at IS NULL)` — requer `btree_gist` |

## 🟠 Alta prioridade

- **Sem `error.tsx`/`not-found.tsx` em toda a app** — erro de server component cai na tela padrão do Next. Adicionar `(dashboard)/error.tsx`, `(public)/error.tsx`, `app/not-found.tsx`.
- **IA sem checagem de saldo antes da chamada** — `debitAiCredits` roda depois da OpenAI, fire-and-forget, aceita saldo negativo (`src/app/api/ai/chat/route.ts:170` + `src/lib/ai/credits.ts:161-190`). Verificar `balance_credits > 0` antes e retornar 402.
- **Sem rate limiting** em `/api/ai/chat`, `/api/booking/request` (público) e checkout de créditos. Adicionar `@upstash/ratelimit` por IP/empresa.
- **Race no `booking_code`** — `COUNT(*)+1` colide sob concorrência (`src/lib/db/queries/reservations.ts:235-252`). Usar SEQUENCE ou retry em conflito.
- **Ledger de créditos não-atômico** (lost update) — `src/lib/ai/credits.ts:120-151`. Usar `UPDATE ... SET balance = balance + $x` ou RPC transacional.
- **Trigger de overlap ignora soft-delete** — reserva soft-deletada segue bloqueando disponibilidade (`001:430-437` vs `010_reservations_soft_delete.sql`). Adicionar `AND deleted_at IS NULL`.

## 🟡 Média prioridade

**Frontend**
- `dashboard-view.tsx` (523 linhas) marcado `"use client"` sem interatividade — remover diretiva, vira server component.
- recharts importado estático em `revenue-chart.tsx` e `cashflow-tab.tsx` — usar `next/dynamic({ssr:false})` como no mapa.
- `calendar-grid.tsx:93-118` — `days`/`reservationsByProperty`/`blocksByProperty` recomputados a cada render (inclusive em ResizeObserver). Envolver em `useMemo`.
- ~20 `<img>` cruas em páginas públicas (LCP): `property-gallery.tsx`, `booking-form.tsx:218`, `(public)/page.tsx:86` etc. Migrar para `next/image`.
- `amenity-selector.tsx:37-39` e `guest-search-select.tsx:41-47` — fetch sem `.catch()` (unhandled rejection).

**Backend**
- `getReservations` e transações financeiras sem paginação (`reservations.ts:94-124`, `fin.ts:255`). Adicionar `.range()` + count.
- Transição de status de reserva com TOCTOU — incluir status esperado no `WHERE` do update (`reservations.ts:307-343`).

**DB**
- Policies `USING (true)` em `amenities`, `property_amenities`, `property_images` (`001:607-613`) — expõem dados de todas as empresas ao `anon`. Restringir por `company_id`/status.
- Colunas monetárias do schema base sem `CHECK >= 0` (properties, reservations, payments) — migrações 026/027 já fazem certo.

## 🟢 Baixa prioridade

- Open-redirect: validar `next` no callback OAuth (`auth/callback/route.ts:7,13`) como o middleware valida `redirectTo`.
- Sanitização `.or()` inconsistente em `contacts.ts:21` — aplicar `replace(/[%,()*_:]/g, "")`.
- `charge/route.ts:117` vaza `insErr.message` em 500 — usar `apiServerError`.
- Índices ausentes em `company_id` (payments, financial_entries, housekeeping_tasks, maintenance_tickets, ai_conversations) — usados nas RLS.
- `ON DELETE` ausente nos FKs do schema base (reservations, payments, created_by) — definir RESTRICT/SET NULL.
- Funções SQL sem `SET search_path` (5 funções em `001`).
- Timezone: destaque de "hoje" na agenda mistura local/UTC (`calendar-grid.tsx:67-102`); padronizar helper `nightsBetween` + fuso `America/Maceio`.
- ~58 cores hex hardcoded (canais Airbnb/Booking etc.) — centralizar em constants/tokens.
- Migração `029` ausente na numeração (confirmar que nada se perdeu); `001` não é idempotente.

## ✅ Pontos positivos confirmados

- Middleware default-deny; auth coberta em todas as rotas não-públicas.
- Webhooks Stripe e WhatsApp: assinatura verificada, comparação timing-safe, fail-closed, idempotência.
- Nenhum secret sob `NEXT_PUBLIC_`; service-role só em server-side.
- Constraints de datas corretas no schema; migrações 023-035 com boa higiene.
- Layout responsivo sólido (safe-area, bottom nav, overlay mobile).

## 📱 PWA (implementado em 07/jul/2026)

- `src/app/manifest.ts` — manifest com atalhos (Reservas, Agenda, IA), standalone, tema `#6B7F5E`.
- `public/icons/` — icon-192, icon-512, apple-touch-icon (folha da marca).
- `public/sw.js` — service worker conservador (cache só de estáticos; páginas/API/auth sempre rede).
- `src/components/pwa/sw-register.tsx` — registro só em produção, incluído no root layout.
- `vercel.json` — `no-cache` no sw.js, cache 24h nos ícones.
