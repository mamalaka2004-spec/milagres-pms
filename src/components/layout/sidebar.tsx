"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Users, Home, DollarSign,
  ClipboardList, Sparkles, Settings, ChevronLeft, ChevronRight,
  X, Leaf, Menu, UserCheck, MessageSquare, Target, TrendingUp, Megaphone,
  BadgeDollarSign,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useMode } from "@/lib/mode";
import type { Mode } from "@/lib/mode/types";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  // Modes this item shows in. Omit = visible in every mode.
  modes?: Mode[];
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "reservations", label: "Reservas", href: "/reservations", icon: CalendarDays, modes: ["locacao"] },
  { id: "calendar", label: "Agenda", href: "/calendar", icon: CalendarDays, modes: ["locacao"] },
  { id: "guests", label: "Hóspedes", href: "/guests", icon: Users, modes: ["locacao"] },
  { id: "conversations", label: "Chat Reservas", href: "/conversations", icon: MessageSquare, modes: ["locacao"] },
  { id: "vendas", label: "Chat Vendas", href: "/vendas", icon: Target, modes: ["vendas"] },
  { id: "campaigns", label: "Campanhas", href: "/campaigns", icon: Megaphone },
  { id: "properties", label: "Imóveis", href: "/properties", icon: Home },
  { id: "market", label: "Análise de Mercado", href: "/market", icon: TrendingUp, modes: ["locacao"] },
  { id: "pricing", label: "Precificação", href: "/pricing", icon: BadgeDollarSign, modes: ["locacao"] },
  { id: "owners", label: "Proprietários", href: "/owners", icon: UserCheck },
  { id: "finance", label: "Financeiro", href: "/finance", icon: DollarSign },
  { id: "operations", label: "Operações", href: "/operations", icon: ClipboardList, modes: ["locacao"] },
];

function visibleInMode(item: NavItem, mode: Mode): boolean {
  return !item.modes || item.modes.includes(mode);
}

const bottomItems = [
  { id: "ai", label: "Assistente IA", href: "/ai-assistant", icon: Sparkles, highlight: true },
  { id: "settings", label: "Ajustes", href: "/settings", icon: Settings },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { mode } = useMode();
  const [collapsed, setCollapsed] = useState(false);

  const visibleNav = navItems.filter((item) => visibleInMode(item, mode));

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div
        className={cn(
          "border-b border-gray-100 flex items-center gap-3 min-h-[64px] shrink-0",
          collapsed ? "px-3 justify-center" : "px-6"
        )}
      >
        <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
          <Leaf size={18} className="text-brand-100" strokeWidth={2.5} aria-hidden="true" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-bold text-sm tracking-wide text-gray-900">MILAGRES</div>
            <div className="text-[9px] text-gray-400 tracking-[0.2em] uppercase">
              Hospedagens
            </div>
          </div>
        )}
        {/* Mobile close */}
        <button
          onClick={onMobileClose}
          aria-label="Close menu"
          className="ml-auto lg:hidden p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        {visibleNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 rounded-lg text-sm font-body transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40",
                collapsed ? "px-3 py-2.5 justify-center" : "px-4 py-2.5",
                active
                  ? "bg-brand-500/10 text-brand-600 font-semibold border-l-[3px] border-brand-500"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 border-l-[3px] border-transparent"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} className="shrink-0" aria-hidden="true" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-100 py-2 px-2 space-y-0.5 shrink-0">
        {bottomItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 rounded-lg text-sm font-body transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40",
                collapsed ? "px-3 py-2.5 justify-center" : "px-4 py-2.5",
                item.highlight && !active
                  ? "bg-brand-500/5 text-brand-600 font-semibold"
                  : active
                  ? "bg-brand-500/10 text-brand-600 font-semibold"
                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} className="shrink-0" aria-hidden="true" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden lg:flex items-center justify-center py-3 border-t border-gray-100 text-gray-400 hover:text-gray-600 transition-colors duration-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
      >
        {collapsed ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronLeft size={16} aria-hidden="true" />}
      </button>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "bg-white border-r border-gray-200 flex flex-col h-full z-50 transition-all duration-200",
          // Mobile: fixed overlay
          "fixed inset-y-0 left-0 lg:relative",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          // Width
          collapsed ? "w-[68px]" : "w-60",
          // Shadow on mobile
          mobileOpen && "shadow-xl"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

// ─── Mobile Bottom Navigation ───
export function BottomNav() {
  const pathname = usePathname();
  const { mode } = useMode();

  // Middle items flip with the mode; Início / Imóveis / IA stay constant.
  const items =
    mode === "vendas"
      ? [
          { href: "/dashboard", icon: LayoutDashboard, label: "Início" },
          { href: "/vendas", icon: Target, label: "Vendas" },
          { href: "/owners", icon: UserCheck, label: "Donos" },
          { href: "/properties", icon: Home, label: "Imóveis" },
          { href: "/ai-assistant", icon: Sparkles, label: "IA" },
        ]
      : [
          { href: "/dashboard", icon: LayoutDashboard, label: "Início" },
          { href: "/reservations", icon: CalendarDays, label: "Reservas" },
          { href: "/calendar", icon: CalendarDays, label: "Agenda" },
          { href: "/properties", icon: Home, label: "Imóveis" },
          { href: "/ai-assistant", icon: Sparkles, label: "IA" },
        ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 flex items-center justify-around z-30 lg:hidden pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => {
        const active = item.href === "/dashboard"
          ? pathname === "/dashboard"
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40",
              active ? "text-brand-600" : "text-gray-400",
              item.href === "/ai-assistant" && !active && "text-brand-500"
            )}
          >
            <item.icon size={20} strokeWidth={active ? 2.5 : 1.5} aria-hidden="true" />
            <span className={cn("text-[10px]", active ? "font-bold" : "font-normal")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
