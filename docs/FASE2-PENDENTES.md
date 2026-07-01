# Fase 2 (Chat + Funil + Tags) — Pendências

A Fase 2 está **completa em código** (migrations 023 e 024 aplicadas + verificadas no
Supabase, `tsc` + `build` limpos). Faltam só passos operacionais e 2 ajustes de transição
— tudo dá pra fazer com calma, sem pressa.

## 🔌 Ligar o disparo de campanhas (n8n)

Sem isso, tudo funciona menos o **botão Disparar** (ele avisa "disparo não configurado").
Rascunho de campanha, destinatários e Prospecção já funcionam.

- [ ] Definir envs (Vercel + `.env.local`):
  - [ ] `CAMPAIGN_DISPATCH_WEBHOOK_URL` = URL do webhook do n8n
  - [ ] `NEXT_PUBLIC_APP_URL` = URL pública do app (ex.: `https://milagres...vercel.app`)
  - [x] `WHATSAPP_WEBHOOK_SECRET` — já existe
- [ ] Montar o workflow n8n seguindo [docs/campaign-broadcast-n8n.md](./campaign-broadcast-n8n.md)
  (trigger → loop/throttle → Evolution → callback de status; + cron `/api/campaigns/due` p/ agendadas).
- [ ] Smoke-test: criar campanha de teste com 1–2 números seus → Disparar → conferir status.

## ✅ Validar na UI + deploy

- [ ] Smoke-test do funil: Ajustes → Funil & Tags (CRUD etapas/tags), arrastar card no Chat
  Vendas/Reservas e confirmar persistência, aplicar/remover tag.
- [ ] Prospecção: selecionar contatos → atribuir a um funil (cria negócios).
- [ ] `deploy` (Vercel) da Fase 2.

## 🔧 Ajustes de transição (não quebram nada)

- [ ] **LeadPanel de Vendas** ainda edita `whatsapp_lead_data.lead_stage` (campos de IA), que
  **não dirige mais** o kanban (agora é `funnel_deals`). Decidir: (a) sincronizar `lead_stage`
  ↔ etapa do deal, ou (b) trocar o seletor do painel para mexer na etapa do deal.
- [ ] O funil é **por tipo/empresa** (todas as linhas `booking`/`sales`); o inbox é **por linha**.
  Irrelevante hoje (1 número por tipo); rever se surgir mais de um número por tipo.

## 🧹 Cosmético (opcional)

- [ ] Silenciar o warning de lockfile do `next dev` definindo `outputFileTracingRoot`
  em `next.config.ts` (há um `package-lock.json` também em `/Users/MarceloCarvalho/`).
