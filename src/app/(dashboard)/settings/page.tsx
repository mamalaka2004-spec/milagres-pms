import Link from "next/link";
import {
  MessageSquare, ChevronRight, Settings as SettingsIcon, Users, Bot, ScrollText,
  KanbanSquare, Sparkles, BookOpen, Coins, CalendarClock, ClipboardList, Bell,
  type LucideIcon,
} from "lucide-react";
import { requirePageAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface SettingCardDef {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  /** true = só admin/gerente veem. */
  manageOnly?: boolean;
}

interface SettingGroup {
  title: string;
  items: SettingCardDef[];
}

// Ajustes agrupados por área (#17). Todos os links antigos permanecem —
// só reorganizados. `manageOnly` esconde o card de quem não gere a equipe.
const GROUPS: SettingGroup[] = [
  {
    title: "Comunicação",
    items: [
      { href: "/settings/whatsapp", icon: MessageSquare, title: "Linhas WhatsApp", description: "Conectar números, configurar horário comercial e atribuir usuários por linha." },
      { href: "/settings/notifications", icon: Bell, title: "Notificações", description: "Escolha quais alertas (reservas, mensagens, cancelamentos) receber no app." },
    ],
  },
  {
    title: "Inteligência Artificial",
    items: [
      { href: "/settings/ai", icon: Bot, title: "Inteligência Artificial", description: "Chave-mestra da IA do sistema e hierarquia de ativação (sistema → linha → conversa)." },
      { href: "/settings/ai-credits", icon: Coins, title: "Créditos de IA", description: "Saldo e consumo de créditos/tokens da IA, com histórico e recarga manual." },
      { href: "/settings/ai-agents", icon: Sparkles, title: "Agentes de IA", description: "Prompt, modelo, ferramentas e conhecimento de cada agente — e qual atende cada canal.", manageOnly: true },
      { href: "/settings/knowledge-base", icon: BookOpen, title: "Base de Conhecimento", description: "Guias dos imóveis (com mídia e PDF) e artigos/FAQ que a IA usa para responder.", manageOnly: true },
    ],
  },
  {
    title: "Comercial",
    items: [
      { href: "/settings/funnel", icon: KanbanSquare, title: "Funil & Tags", description: "Etapas do funil e tags de Locação e Vendas — configuráveis por tipo.", manageOnly: true },
      { href: "/settings/google-calendar", icon: CalendarClock, title: "Google Calendar", description: "Sincronização bidirecional por anúncio (requer credenciais Google OAuth).", manageOnly: true },
    ],
  },
  {
    title: "Operações",
    items: [
      { href: "/settings/operations", icon: ClipboardList, title: "Operações & Camareira", description: "Auto-agendamento de limpeza, templates de checklist e retenção de fotos/vídeos.", manageOnly: true },
    ],
  },
  {
    title: "Conta & Equipe",
    items: [
      { href: "/settings/users", icon: Users, title: "Usuários & permissões", description: "Criar e editar membros da equipe, definir papéis (admin / gerente / equipe) e acessos.", manageOnly: true },
      { href: "/settings/logs", icon: ScrollText, title: "Atividade", description: "Histórico de ações da equipe — criação, edição e remoção de registros do sistema.", manageOnly: true },
    ],
  },
];

export default async function SettingsPage() {
  const user = await requirePageAuth();
  const canManageTeam = user.role === "admin" || user.role === "manager";

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center">
          <SettingsIcon size={16} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Ajustes</h1>
          <p className="text-xs text-gray-500">Configurações do sistema</p>
        </div>
      </div>

      {GROUPS.map((group) => {
        const items = group.items.filter((i) => !i.manageOnly || canManageTeam);
        if (items.length === 0) return null;
        return (
          <section key={group.title} className="space-y-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{group.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
              {items.map((item) => (
                <SettingCard key={item.href} {...item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SettingCard({ href, icon: Icon, title, description }: SettingCardDef) {
  return (
    <Link
      href={href}
      className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 group flex items-start gap-3"
    >
      <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
        <Icon className="text-brand-600" size={18} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-gray-900 flex items-center gap-1">
          {title}
          <ChevronRight size={14} className="text-gray-300 group-hover:text-brand-500 transition-colors duration-200" aria-hidden="true" />
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </Link>
  );
}
