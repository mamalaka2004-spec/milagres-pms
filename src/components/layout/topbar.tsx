"use client";

import { Bell, Search, Menu } from "lucide-react";
import { getInitials } from "@/lib/utils/format";

interface TopbarProps {
  title: string;
  onMenuClick: () => void;
  userName?: string;
  userRole?: string;
}

export function Topbar({ title, onMenuClick, userName = "Admin", userRole = "admin" }: TopbarProps) {
  const todayLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <header className="h-16 lg:h-[76px] bg-white border-b border-gray-200 flex items-center px-4 lg:px-8 gap-3 shrink-0">
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        aria-label="Abrir menu"
        className="lg:hidden p-1.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
      >
        <Menu size={22} aria-hidden="true" />
      </button>

      {/* Title + contextual date */}
      <div className="flex-1 lg:flex-none min-w-0">
        <h1 className="text-lg lg:text-xl font-bold text-gray-900 tracking-tight leading-tight truncate">
          {title}
        </h1>
        <p className="hidden lg:block text-xs text-gray-400 capitalize leading-tight">
          {todayLabel}
        </p>
      </div>

      <div className="hidden lg:block flex-1" />

      {/* Search — desktop */}
      <div className="hidden md:block relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" aria-hidden="true" />
        <input
          placeholder="Buscar..."
          aria-label="Buscar"
          className="pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm font-body w-48 lg:w-56 focus:outline-none focus:ring-2 focus:ring-brand-400/20 focus:border-brand-400 transition-colors duration-200"
        />
      </div>

      {/* Notifications */}
      <button
        aria-label="Notificações"
        className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
      >
        <Bell size={18} aria-hidden="true" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
      </button>

      {/* User */}
      <div className="hidden md:flex items-center gap-2.5 ml-1">
        <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold">
          {getInitials(userName)}
        </div>
        <div className="hidden lg:block">
          <div className="text-sm font-semibold text-gray-900 leading-tight">{userName}</div>
          <div className="text-[10px] text-gray-400 capitalize">{userRole}</div>
        </div>
      </div>
    </header>
  );
}
