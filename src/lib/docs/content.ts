/**
 * Documentação interna do app (#24 — Fase 10). Base para um futuro Admin Panel:
 * conteúdo estruturado em Markdown, renderizado sem lib externa
 * (ver src/components/docs/markdown.tsx). Para adicionar/editar uma página da
 * documentação, basta acrescentar/alterar um item aqui.
 */
export interface DocPage {
  slug: string;
  title: string;
  description: string;
  /** Nome do ícone lucide (mapeado no hub). */
  icon: string;
  category: string;
  body: string;
}

export const DOC_PAGES: DocPage[] = [
  {
    slug: "visao-geral",
    title: "Visão geral & arquitetura",
    description: "Como o sistema está organizado: route groups, camadas e padrões.",
    icon: "LayoutDashboard",
    category: "Fundamentos",
    body: `# Visão geral

O **Milagres PMS** é um Property Management System para as hospedagens da Milagres em São Miguel dos Milagres (AL). Ele cobre reservas, hóspedes, imóveis, precificação, financeiro, operação (limpeza/camareira), CRM/atendimento por IA e o site público.

## Arquitetura

O app é um **Next.js 15 (App Router)** com **React 19** e **TypeScript**. As rotas são organizadas em *route groups*:

- **(dashboard)** — o painel interno (sidebar + topbar). Todas as telas de gestão.
- **(auth)** — login e recuperação de senha.
- **(public)** — o que é exposto ao público: a landing (\`/\`), as páginas de imóvel (\`/p/[slug]\`) e a **apresentação de imóvel** (\`/apresentacao/[id]\`).
- **api** — route handlers (REST) usados pelos componentes cliente e por automações.

## Camadas

- **Server Components** buscam dados direto no banco via *queries* em \`src/lib/db/queries/*\`.
- O acesso ao banco usa o **admin client** (service-role) em \`src/lib/supabase/admin.ts\`, que ignora RLS — por isso o escopo por empresa é aplicado **no código** (sempre filtrando por \`company_id\`).
- **Auth** fica em \`src/lib/auth.ts\`: \`requireAuth\`, \`requireRole\`, \`requireFullAccess\` e \`requirePageAuth\` (este redireciona a camareira para telas sem valores).
- **Modo** (Locação × Vendas) vem do \`ModeProvider\` em \`src/lib/mode\` — alterna navegação e escopo de dados.
- **Auditoria**: \`logActivity\` em \`src/lib/audit/log.ts\` grava ações de gestão em \`activity_logs\` (fire-and-forget, nunca quebra a requisição).
- **Design system** em \`src/components/ui/*\` — paleta *sage-green* (\`brand-*\`), cards \`rounded-xl\`, foco com anel \`brand\`.`,
  },
  {
    slug: "stack",
    title: "Stack técnica",
    description: "Frameworks, bibliotecas e serviços usados no projeto.",
    icon: "Layers",
    category: "Fundamentos",
    body: `# Stack técnica

## Frontend
- **Next.js 15** (App Router) + **React 19**
- **TypeScript**
- **Tailwind CSS** com tema *sage-green* (\`brand-50…900\`, \`cream\`) e fontes Cormorant Garamond (heading), DM Sans (body) e JetBrains Mono (mono)
- **lucide-react** para ícones
- **Recharts** para gráficos
- **React Hook Form + Zod** para formulários e validação

## Backend & dados
- **Supabase** — PostgreSQL, Auth e Storage (projeto \`xmmuenaaodlqubfotwzr\`)
- Acesso via \`@supabase/supabase-js\` (client de browser, server e admin/service-role)
- Migrations SQL versionadas em \`supabase/migrations\`

## IA & automação
- **Anthropic Claude** para o atendimento/CRM e o assistente do painel
- **n8n** para automações externas (disparo de campanhas, jobs de operação)
- Integração **WhatsApp** para o chat de reservas e vendas

## Infra
- Deploy na **Vercel**
- Variáveis de ambiente em \`.env.local\` (ver a página de Infraestrutura)`,
  },
  {
    slug: "modulos",
    title: "Módulos & fases",
    description: "As áreas funcionais do sistema e como evoluíram por fase.",
    icon: "Boxes",
    category: "Produto",
    body: `# Módulos & fases

O produto foi construído por fases incrementais. Principais módulos:

- **Imóveis** — cadastro, fotos, comodidades, proprietários (participação/comissão), sincronização de canais (Airbnb/Booking iCal), análise de mercado e **apresentação** (PDF).
- **Reservas & Agenda** — reservas, calendário e hóspedes.
- **Atendimento (Chat)** — Chat Reservas e Chat Vendas, com IA (agentes configuráveis) e CRM/funil.
- **Campanhas** — disparos segmentados (via n8n).
- **Precificação** — regras de preço por imóvel/grupo/temporada.
- **Financeiro** — lançamentos, repasses a proprietários, gateway Asaas.
- **Operações** — auto-agendamento de limpeza, checklists e camareira.
- **Mercado** — tarifa sugerida via GeckoAPI.
- **Site** — landing pública, páginas de imóvel e apresentações.

## Modos: Locação × Vendas

O mesmo login alterna entre dois modos (\`src/lib/mode\`):
- **Locação** — reservas, hóspedes e operação das hospedagens.
- **Vendas** — corretagem imobiliária (venda de imóveis).

A navegação e o escopo de dados mudam conforme o modo ativo.`,
  },
  {
    slug: "dados",
    title: "Modelo de dados & migrations",
    description: "Principais tabelas e como as migrations são aplicadas.",
    icon: "Database",
    category: "Engenharia",
    body: `# Modelo de dados

Multi-empresa: quase tudo é escopado por \`company_id\`. Tabelas centrais:

- **companies**, **users** (papéis + \`preferences\` com o modo ativo)
- **properties**, **property_images**, **amenities**, **property_amenities**, **property_ownership**, **owners**
- **reservations**, **guests**, **contacts**
- **campaigns**, **campaign_recipients**
- **pricing** (regras/grupos), **finance** (lançamentos/repasses), **operations** (jobs/checklists)
- **ai_agents**, créditos de IA, **whatsapp** (linhas/mensagens/contatos)
- **google_calendar_connections** (scaffold), **site_settings** (config do site)
- **activity_logs** (auditoria)

## Migrations

As migrations ficam em \`supabase/migrations\` numeradas sequencialmente (\`001\` … \`035\`). São **idempotentes** (\`CREATE TABLE IF NOT EXISTS\`, \`DROP POLICY IF EXISTS\`).

Para aplicar: Supabase → **SQL Editor** → cole o conteúdo do arquivo → *Run*. Sempre aplique na ordem numérica.

> RLS existe nas tabelas, mas o app usa o service-role e aplica o escopo por empresa no código.`,
  },
  {
    slug: "papeis",
    title: "Papéis & permissões",
    description: "Os quatro papéis e o que cada um enxerga.",
    icon: "ShieldCheck",
    category: "Produto",
    body: `# Papéis & permissões

Definidos em \`src/lib/auth.ts\` e refletidos na navegação.

- **admin** — acesso total, incluindo gestão de usuários e configurações.
- **manager (gerente)** — gestão operacional e a maioria das configurações.
- **staff (equipe)** — operação do dia a dia, sem as telas de gestão sensível.
- **camareira** — enxerga **apenas Agenda + Operações**, sem valores/financeiro. \`requirePageAuth\` a redireciona para \`/operations\` em telas com valores.

## Guards de auth

- \`requireAuth()\` — exige sessão válida.
- \`requireRole([...])\` — exige um papel específico.
- \`requireFullAccess()\` — qualquer papel **exceto** camareira (dados sensíveis).
- \`requirePageAuth()\` — guard de página que redireciona a camareira.`,
  },
  {
    slug: "infra",
    title: "Infraestrutura & deploy",
    description: "Ambiente, variáveis e serviços externos.",
    icon: "Server",
    category: "Engenharia",
    body: `# Infraestrutura & deploy

## Deploy
Hospedado na **Vercel** (Next.js). Cada push na branch de produção gera um deploy.

## Variáveis de ambiente
Configuradas em \`.env.local\` (dev) e no painel da Vercel (produção):

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
NEXT_PUBLIC_APP_URL=...
NEXT_PUBLIC_WHATSAPP_NUMBER=5582999999999
\`\`\`

## Serviços externos
- **Supabase** — banco, auth e storage (buckets de fotos/mídia dos imóveis).
- **Anthropic** — modelos de IA do atendimento e do assistente.
- **n8n** — automações (campanhas, jobs de operação); ver \`docs/*.md\` no repositório.
- **Asaas** — gateway de pagamento do financeiro.
- **GeckoAPI** — dados de mercado para a tarifa sugerida.

## Storage
Fotos e mídia dos imóveis ficam em buckets do Supabase Storage; uploads passam por \`/api/upload\`.`,
  },
];

export function getDocPage(slug: string): DocPage | undefined {
  return DOC_PAGES.find((d) => d.slug === slug);
}
