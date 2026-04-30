"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Users, Home, DollarSign,
  ClipboardList, Sparkles, Settings, ChevronLeft, ChevronRight,
  X, Leaf, Menu, UserCheck, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "reservations", label: "Reservations", href: "/reservations", icon: CalendarDays },
  { id: "calendar", label: "Calendar", href: "/calendar", icon: CalendarDays },
  { id: "guests", label: "Guests", href: "/guests", icon: Users },
  { id: "conversations", label: "Conversations", href: "/conversations", icon: MessageSquare },
  { id: "properties", label: "Properties", href: "/properties", icon: Home },
  { id: "owners", label: "Owners", href: "/owners", icon: UserCheck },
  { id: "finance", label: "Finance", href: "/finance", icon: DollarSign },
  { id: "operations", label: "Operations", href: "/operations", icon: ClipboardList },
];

const bottomItems = [
  { id: "ai", label: "AI Assistant", href: "/ai-assistant", icon: Sparkles, highlight: true },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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
          <Leaf size={18} className="text-brand-100" strokeWidth={2.5} />
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
          className="ml-auto lg:hidden p-1 text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 rounded-lg text-sm font-body transition-colors",
                collapsed ? "px-3 py-2.5 justify-center" : "px-4 py-2.5",
                active
                  ? "bg-brand-500/10 text-brand-600 font-semibold border-l-[3px] border-brand-500"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 border-l-[3px] border-transparent"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} className="shrink-0" />
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
                "flex items-center gap-3 rounded-lg text-sm font-body transition-colors",
                collapsed ? "px-3 py-2.5 justify-center" : "px-4 py-2.5",
                item.highlight && !active
                  ? "bg-brand-500/5 text-brand-600 font-semibold"
                  : active
                  ? "bg-brand-500/10 text-brand-600 font-semibold"
                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex items-center justify-center py-3 border-t border-gray-100 text-gray-400 hover:text-gray-600 transition shrink-0"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
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

  const items = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
    { href: "/reservations", icon: CalendarDays, label: "Bookings" },
    { href: "/calendar", icon: CalendarDays, label: "Calendar" },
    { href: "/properties", icon: Home, label: "Properties" },
    { href: "/ai-assistant", icon: Sparkles, label: "AI" },
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
              "flex flex-col items-center gap-0.5 px-3 py-1.5",
              active ? "text-brand-600" : "text-gray-400",
              item.href === "/ai-assistant" && !active && "text-brand-500"
            )}
          >
            <item.icon size={20} strokeWidth={active ? 2.5 : 1.5} />
            <span className={cn("text-[10px]", active ? "font-bold" : "font-normal")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
