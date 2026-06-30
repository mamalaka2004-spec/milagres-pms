"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Settings, MessageSquare, Bot, Users, ScrollText, LogOut, ChevronDown, type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils/format";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  staff: "Equipe",
};

export interface UserMenuUser {
  name: string;
  role: string;
  email: string;
  avatarUrl: string | null;
}

interface ManageLink {
  href: string;
  label: string;
  icon: LucideIcon;
  managerOnly?: boolean;
}

const MANAGE_LINKS: ManageLink[] = [
  { href: "/settings", label: "Ajustes", icon: Settings },
  { href: "/settings/whatsapp", label: "Linhas WhatsApp", icon: MessageSquare },
  { href: "/settings/ai", label: "Inteligência Artificial", icon: Bot },
  { href: "/settings/users", label: "Usuários & permissões", icon: Users, managerOnly: true },
  { href: "/settings/logs", label: "Atividade", icon: ScrollText, managerOnly: true },
];

/** Avatar dropdown (#20): account header, management shortcuts, and logout. */
export function UserMenu({ user }: { user: UserMenuUser }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const canManage = user.role === "admin" || user.role === "manager";

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
    } catch {
      /* ignore — redirect regardless */
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors duration-200 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 md:pr-2"
          aria-label="Conta e gestão"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
            {getInitials(user.name)}
          </span>
          <span className="hidden text-left lg:block">
            <span className="block text-sm font-semibold leading-tight text-gray-900">{user.name}</span>
            <span className="block text-[10px] capitalize text-gray-400">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </span>
          <ChevronDown size={14} className="hidden text-gray-400 md:block" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2.5 py-2">
          <div className="truncate text-sm font-semibold text-gray-900">{user.name}</div>
          {user.email && <div className="truncate text-xs text-gray-400">{user.email}</div>}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Gestão</DropdownMenuLabel>
        {MANAGE_LINKS.filter((l) => !l.managerOnly || canManage).map((l) => (
          <DropdownMenuItem key={l.href} asChild>
            <Link href={l.href} className="cursor-pointer">
              <l.icon size={15} className="text-gray-400" aria-hidden="true" />
              <span>{l.label}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={(e) => { e.preventDefault(); handleLogout(); }}>
          <LogOut size={15} aria-hidden="true" />
          <span>{signingOut ? "Saindo…" : "Sair"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
