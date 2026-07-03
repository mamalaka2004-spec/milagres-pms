"use client";

// Calendário de feriados — lista + CRUD simples (Fase 4)

import { useState } from "react";
import { Plus, Trash2, Repeat } from "lucide-react";
import { Button, Badge, ConfirmDialog } from "@/components/ui";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import type { Holiday } from "@/types/pricing";

const inputClass =
  "px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15";

function formatHolidayDate(holiday: Holiday): string {
  const [, month, day] = holiday.date.split("-");
  if (holiday.recurring) return `${day}/${month} (todo ano)`;
  return holiday.date.split("-").reverse().join("/");
}

interface HolidaysTabProps {
  holidays: Holiday[];
  onChanged: () => Promise<void> | void;
}

export function HolidaysTab({ holidays, onChanged }: HolidaysTabProps) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Holiday | null>(null);

  const sorted = [...holidays].sort((a, b) => a.date.slice(5).localeCompare(b.date.slice(5)));

  const add = async () => {
    setAdding(true);
    try {
      await api("/api/pricing/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), date, recurring }),
      });
      toast({ title: "Feriado adicionado" });
      setName("");
      setDate("");
      setRecurring(false);
      await onChanged();
    } catch (e) {
      toast({ title: "Erro ao adicionar", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setAdding(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/api/pricing/holidays/${deleting.id}`, { method: "DELETE" });
      toast({ title: "Feriado removido" });
      await onChanged();
    } catch (e) {
      toast({ title: "Erro ao remover", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 max-w-xl">
        As regras do tipo <strong>Feriado</strong> usam este calendário. Feriados nacionais já vêm
        cadastrados — adicione os municipais/estaduais e datas especiais da sua região.
      </p>

      {/* Adicionar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-card">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do feriado"
          className={`${inputClass} min-w-[180px] flex-1`}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
        />
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
          />
          Repete todo ano
        </label>
        <Button size="sm" onClick={add} loading={adding} disabled={adding || !name.trim() || !date}>
          <Plus size={14} aria-hidden="true" /> Adicionar
        </Button>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
        {sorted.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Nenhum feriado — rode a migration 026 para o seed dos nacionais.
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {sorted.map((holiday) => (
              <li key={holiday.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60">
                <span className="w-28 shrink-0 font-mono text-xs text-gray-500">
                  {formatHolidayDate(holiday)}
                </span>
                <span className="flex-1 truncate text-sm font-medium text-gray-800">{holiday.name}</span>
                {holiday.recurring && (
                  <Badge tone="brand" className="text-[10px]">
                    <Repeat size={10} aria-hidden="true" className="mr-1" /> Anual
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={() => setDeleting(holiday)}
                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remover ${holiday.name}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Remover feriado?"
        description={`“${deleting?.name}” deixará de valer para as regras de feriado.`}
        confirmLabel="Remover"
        variant="danger"
        onConfirm={remove}
      />
    </div>
  );
}
