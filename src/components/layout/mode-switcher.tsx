"use client";

import { KeyRound, Building2, ChevronDown, Check, type LucideIcon } from "lucide-react";
import { useMode } from "@/lib/mode";
import { MODE_META, MODES, type Mode } from "@/lib/mode/types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";

const MODE_ICONS: Record<Mode, LucideIcon> = {
  locacao: KeyRound,
  vendas: Building2,
};

/**
 * Mode switcher (#8). Flips the whole shell between Locação and Vendas. Kept
 * prominent in the topbar; persists via the ModeProvider (localStorage + user
 * preferences).
 */
export function ModeSwitcher() {
  const { mode, setMode } = useMode();
  const ActiveIcon = MODE_ICONS[mode];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 rounded-lg border border-brand-500/20 bg-brand-500/10 px-2.5 py-1.5 text-sm font-semibold text-brand-700 transition-colors duration-200 hover:bg-brand-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          aria-label={`Modo: ${MODE_META[mode].label}. Trocar modo`}
        >
          <ActiveIcon size={15} aria-hidden="true" />
          <span className="hidden sm:inline">{MODE_META[mode].label}</span>
          <ChevronDown size={14} className="text-brand-500" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Modo de operação</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MODES.map((m) => {
          const Icon = MODE_ICONS[m];
          const active = m === mode;
          return (
            <DropdownMenuItem
              key={m}
              onSelect={() => setMode(m)}
              className="items-start gap-2.5 py-2"
            >
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                  active ? "bg-brand-500/15 text-brand-600" : "bg-gray-100 text-gray-500"
                )}
              >
                <Icon size={15} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn("font-semibold", active ? "text-brand-700" : "text-gray-800")}>
                    {MODE_META[m].label}
                  </span>
                  {active && <Check size={14} className="text-brand-500" aria-hidden="true" />}
                </div>
                <p className="text-xs leading-snug text-gray-500">{MODE_META[m].description}</p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
