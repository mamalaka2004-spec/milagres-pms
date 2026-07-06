import Link from "next/link";
import { MessageSquare, ChevronRight, Settings as SettingsIcon, Users, Bot, ScrollText, KanbanSquare, Sparkles, BookOpen, Coins, CalendarClock } from "lucide-react";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireAuth();
  const canManageTeam = user.role === "admin" || user.role === "manager";
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center">
          <SettingsIcon size={16} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Ajustes</h1>
          <p className="text-xs text-gray-500">Configurações do sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
        <Link
          href="/settings/whatsapp"
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 group flex items-start gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
            <MessageSquare className="text-brand-600" size={18} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900 flex items-center gap-1">
              Linhas WhatsApp
              <ChevronRight size={14} className="text-gray-300 group-hover:text-brand-500 transition-colors duration-200" aria-hidden="true" />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Conectar números, configurar horário comercial e atribuir usuários por linha.
            </p>
          </div>
        </Link>

        <Link
          href="/settings/ai"
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 group flex items-start gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
            <Bot className="text-brand-600" size={18} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900 flex items-center gap-1">
              Inteligência Artificial
              <ChevronRight size={14} className="text-gray-300 group-hover:text-brand-500 transition-colors duration-200" aria-hidden="true" />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Chave-mestra da IA do sistema e hierarquia de ativação (sistema → linha → conversa).
            </p>
          </div>
        </Link>

        <Link
          href="/settings/ai-credits"
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 group flex items-start gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
            <Coins className="text-brand-600" size={18} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900 flex items-center gap-1">
              Créditos de IA
              <ChevronRight size={14} className="text-gray-300 group-hover:text-brand-500 transition-colors duration-200" aria-hidden="true" />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Saldo e consumo de créditos/tokens da IA, com histórico e recarga manual.
            </p>
          </div>
        </Link>

        {canManageTeam && (
          <Link
            href="/settings/google-calendar"
            className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 group flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
              <CalendarClock className="text-brand-600" size={18} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-900 flex items-center gap-1">
                Google Calendar
                <ChevronRight size={14} className="text-gray-300 group-hover:text-brand-500 transition-colors duration-200" aria-hidden="true" />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Sincronização bidirecional por anúncio (requer credenciais Google OAuth).
              </p>
            </div>
          </Link>
        )}

        {canManageTeam && (
          <Link
            href="/settings/ai-agents"
            className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 group flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="text-brand-600" size={18} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-900 flex items-center gap-1">
                Agentes de IA
                <ChevronRight size={14} className="text-gray-300 group-hover:text-brand-500 transition-colors duration-200" aria-hidden="true" />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Prompt, modelo, ferramentas e conhecimento de cada agente — e qual atende cada canal.
              </p>
            </div>
          </Link>
        )}

        {canManageTeam && (
          <Link
            href="/settings/knowledge-base"
            className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 group flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
              <BookOpen className="text-brand-600" size={18} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-900 flex items-center gap-1">
                Base de Conhecimento
                <ChevronRight size={14} className="text-gray-300 group-hover:text-brand-500 transition-colors duration-200" aria-hidden="true" />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Guias dos imóveis (com mídia e PDF) e artigos/FAQ que a IA usa para responder.
              </p>
            </div>
          </Link>
        )}

        {canManageTeam && (
          <Link
            href="/settings/funnel"
            className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 group flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
              <KanbanSquare className="text-brand-600" size={18} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-900 flex items-center gap-1">
                Funil &amp; Tags
                <ChevronRight size={14} className="text-gray-300 group-hover:text-brand-500 transition-colors duration-200" aria-hidden="true" />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Etapas do funil e tags de Locação e Vendas — configuráveis por tipo.
              </p>
            </div>
          </Link>
        )}

        {canManageTeam && (
          <Link
            href="/settings/users"
            className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 group flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
              <Users className="text-brand-600" size={18} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-900 flex items-center gap-1">
                Usuários & permissões
                <ChevronRight size={14} className="text-gray-300 group-hover:text-brand-500 transition-colors duration-200" aria-hidden="true" />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Criar e editar membros da equipe, definir papéis (admin / gerente / equipe) e acessos.
              </p>
            </div>
          </Link>
        )}

        {canManageTeam && (
          <Link
            href="/settings/logs"
            className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 group flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
              <ScrollText className="text-brand-600" size={18} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-900 flex items-center gap-1">
                Atividade
                <ChevronRight size={14} className="text-gray-300 group-hover:text-brand-500 transition-colors duration-200" aria-hidden="true" />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Histórico de ações da equipe — criação, edição e remoção de registros do sistema.
              </p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
