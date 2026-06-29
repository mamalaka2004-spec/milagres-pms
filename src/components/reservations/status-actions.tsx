"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, LogIn, LogOut, XCircle, AlertOctagon, Loader2 } from "lucide-react";
import { VALID_STATUS_TRANSITIONS, RESERVATION_STATUSES } from "@/lib/utils/constants";
import { ConfirmDialog, FormField, Input, toast } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import type { ReservationStatus } from "@/types/database";

interface StatusActionsProps {
  reservationId: string;
  currentStatus: ReservationStatus;
}

const STATUS_LABEL_ACTION: Record<ReservationStatus, { label: string; icon: React.ElementType; tone: string }> = {
  inquiry: { label: "Mover para Consulta", icon: AlertOctagon, tone: "purple" },
  pending: { label: "Marcar como Pendente", icon: AlertOctagon, tone: "amber" },
  confirmed: { label: "Confirmar", icon: CheckCircle2, tone: "green" },
  checked_in: { label: "Fazer check-in", icon: LogIn, tone: "blue" },
  checked_out: { label: "Fazer check-out", icon: LogOut, tone: "gray" },
  canceled: { label: "Cancelar", icon: XCircle, tone: "red" },
  no_show: { label: "Marcar não comparecimento", icon: XCircle, tone: "red" },
};

const TONE_CLASS: Record<string, string> = {
  green: "bg-green-500 hover:bg-green-600 text-white",
  blue: "bg-blue-500 hover:bg-blue-600 text-white",
  gray: "bg-gray-500 hover:bg-gray-600 text-white",
  red: "bg-white border border-rose-200 text-rose-600 hover:bg-rose-50",
  amber: "bg-amber-500 hover:bg-amber-600 text-white",
  purple: "bg-purple-500 hover:bg-purple-600 text-white",
};

export function StatusActions({ reservationId, currentStatus }: StatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<ReservationStatus | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reason, setReason] = useState("");

  const next = VALID_STATUS_TRANSITIONS[currentStatus] ?? [];

  const transition = async (status: ReservationStatus, cancelReason?: string) => {
    setPending(status);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, cancellation_reason: cancelReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha na transição");
      toast({
        variant: "success",
        title: `Reserva agora: ${RESERVATION_STATUSES[status].label}`,
      });
      router.refresh();
      setConfirmCancel(false);
      setReason("");
    } catch (err) {
      toast({
        variant: "error",
        title: "Não foi possível atualizar",
        description: err instanceof Error ? err.message : undefined,
      });
      throw err;
    } finally {
      setPending(null);
    }
  };

  if (next.length === 0) {
    return (
      <div className="text-xs text-gray-400">
        Nenhuma transição possível a partir de{" "}
        <span className="font-semibold">{RESERVATION_STATUSES[currentStatus].label}</span>.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {next.map((s) => {
          const cfg = STATUS_LABEL_ACTION[s];
          const Icon = cfg.icon;
          const isCancel = s === "canceled";
          return (
            <button
              key={s}
              type="button"
              onClick={() => (isCancel ? setConfirmCancel(true) : transition(s))}
              disabled={pending !== null}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 disabled:opacity-50",
                TONE_CLASS[cfg.tone]
              )}
            >
              {pending === s ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Icon size={14} aria-hidden="true" />
              )}
              {cfg.label}
            </button>
          );
        })}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={(o) => {
          setConfirmCancel(o);
          if (!o) setReason("");
        }}
        title="Cancelar esta reserva?"
        description="A reserva ficará marcada como cancelada e liberará as datas na agenda."
        confirmLabel="Sim, cancelar"
        cancelLabel="Manter reserva"
        variant="danger"
        loading={pending === "canceled"}
        onConfirm={() => transition("canceled", reason || undefined)}
      >
        <FormField label="Motivo" hint="Opcional — registrado na reserva.">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: hóspede desistiu"
            aria-label="Motivo do cancelamento"
          />
        </FormField>
      </ConfirmDialog>
    </div>
  );
}
