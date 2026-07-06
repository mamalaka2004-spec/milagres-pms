"use client";

import { Menu } from "lucide-react";
import { ModeSwitcher } from "@/components/layout/mode-switcher";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu, type UserMenuUser } from "@/components/layout/user-menu";

export type TopbarUser = UserMenuUser;

interface TopbarProps {
  title: string;
  onMenuClick: () => void;
  user: TopbarUser;
}

export function Topbar({ title, onMenuClick, user }: TopbarProps) {
  const todayLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  // Camareira não alterna modo nem busca dados globais (reservas/hóspedes/valores).
  const isCamareira = user.role === "camareira";

  return (
    <header className="h-16 lg:h-[76px] bg-white border-b border-gray-200 flex items-center px-4 lg:px-8 gap-2 lg:gap-3 shrink-0">
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        aria-label="Abrir menu"
        className="lg:hidden p-1.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
      >
        <Menu size={22} aria-hidden="true" />
      </button>

      {/* Title + contextual date */}
      <div className="min-w-0">
        <h1 className="text-lg lg:text-xl font-bold text-gray-900 tracking-tight leading-tight truncate">
          {title}
        </h1>
        <p className="hidden lg:block text-xs text-gray-400 capitalize leading-tight">{todayLabel}</p>
      </div>

      {/* Mode selector (#8) */}
      {!isCamareira && (
        <div className="ml-1 lg:ml-3">
          <ModeSwitcher />
        </div>
      )}

      <div className="flex-1" />

      {/* Global search (#21) */}
      {!isCamareira && <GlobalSearch />}

      {/* Notifications (#18) — camareira tem UI enxuta e não recebe alertas comerciais */}
      {!isCamareira && <NotificationBell />}

      {/* User + management menu (#20) */}
      <UserMenu user={user} />
    </header>
  );
}
