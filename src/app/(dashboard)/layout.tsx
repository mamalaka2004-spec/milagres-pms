"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, BottomNav } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/reservations": "Reservas",
  "/calendar": "Agenda",
  "/guests": "Hóspedes",
  "/conversations": "Chat Reservas",
  "/vendas": "Chat Vendas",
  "/properties": "Imóveis",
  "/owners": "Proprietários",
  "/finance": "Financeiro",
  "/operations": "Operações",
  "/ai-assistant": "Assistente IA",
  "/settings": "Ajustes",
};

function getTitle(pathname: string): string {
  // Exact match
  if (pageTitles[pathname]) return pageTitles[pathname];

  // Prefix match
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(path)) return title;
  }

  return "Milagres PMS";
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const title = getTitle(pathname);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
          userName="Reginaldo"
          userRole="admin"
        />

        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 xl:px-12 xl:py-9 pb-24 lg:pb-8">
          <div className="max-w-[1800px] mx-auto">{children}</div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
