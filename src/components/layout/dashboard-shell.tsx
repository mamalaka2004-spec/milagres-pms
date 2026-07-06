"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, BottomNav } from "@/components/layout/sidebar";
import { Topbar, type TopbarUser } from "@/components/layout/topbar";
import { Toaster } from "@/components/ui/toaster";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/reservations": "Reservas",
  "/calendar": "Agenda",
  "/guests": "Hóspedes",
  "/conversations": "Chat Reservas",
  "/vendas": "Chat Vendas",
  "/properties": "Imóveis",
  "/market": "Análise de Mercado",
  "/owners": "Proprietários",
  "/finance": "Financeiro",
  "/operations": "Operações",
  "/ai-assistant": "Assistente IA",
  "/notifications": "Notificações",
  "/settings/notifications": "Notificações",
  "/site": "Site",
  "/docs": "Documentação",
  "/settings/logs": "Atividade",
  "/settings/operations": "Operações & Camareira",
  "/settings": "Ajustes",
};

function getTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(path)) return title;
  }
  return "Milagres PMS";
}

export function DashboardShell({
  user,
  children,
}: {
  user: TopbarUser;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const title = getTitle(pathname);

  return (
    <div className="flex h-screen bg-cream overflow-hidden">
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} role={user.role} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar title={title} onMenuClick={() => setSidebarOpen(true)} user={user} />

        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 xl:px-12 xl:py-9 pb-24 lg:pb-8">
          <div className="max-w-[1800px] mx-auto">{children}</div>
        </main>
      </div>

      <BottomNav role={user.role} />
      <Toaster />
    </div>
  );
}
