"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, LogIn, LogOut, XCircle, AlertOctagon, Loader2 } from "lucide-react";
import { VALID_STATUS_TRANSITIONS, RESERVATION_STATUSES } from "@/lib/utils/constants";
import type { ReservationStatus } from "@/types/database";

interface StatusActionsProps {
  reservationId: string;
  currentStatus: ReservationStatus;
}

const STATUS_LABEL_ACTION: Record<ReservationStatus, { label: string; icon: React.ElementType; tone: string }> = {
  inquiry: { label: "Move to Inquiry", icon: AlertOctagon, tone: "purple" },
  pending: { label: "Mark Pending", icon: AlertOctagon, tone: "amber" },
  confirmed: { label: "Confirm", icon: CheckCircle2, tone: "green" },
  checked_in: { label: "Check In", icon: LogIn, tone: "blue" },
  checked_out: { label: "Check Out", icon: LogOut, tone: "gray" },
  canceled: { label: "Cancel", icon: XCircle, tone: "red" },
  no_show: { label: "Mark No-Show", icon: XCircle, tone: "red" },
};

const TONE_CLASS: Record<string, string> = {
  green: "bg-green-500 hover:bg-green-600 text-white",
  blue: "bg-blue-500 hover:bg-blue-600 text-white",
  gray: "bg-gray-500 hover:bg-gray-600 text-white",
  red: "bg-white border border-red-200 text-red-600 hover:bg-red-50",
  amber: "bg-amber-500 hover:bg-amber-600 text-white",
  purple: "bg-purple-500 hover:bg-purple-600 text-white",
};

export function StatusActions({ reservationId, currentStatus }: StatusActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<ReservationStatus | null>(null);
  const [error, setError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reason, setReason] = useState("");

  const next = VALID_STATUS_TRANSITIONS[currentStatus] ?? [];

  const transition = async (status: ReservationStatus, cancelReason?: string) => {
    setPending(status);
    setError("");
    try {
      const res = await fetch(`/api/reservations/${reservationId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          cancellation_reason: cancelReason,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Transition failed");
      router.refresh();
      setConfirmCancel(false);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(null);
    }
  };

  if (next.length === 0) {
    return (
      <div className="text-xs text-gray-400">
        No further transitions from <span className="font-semibold">{RESERVATION_STATUSES[currentStatus].label}</span>.
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
              onClick={() => {
                if (isCancel) {
                  setConfirmCancel(true);
                } else {
                  transition(s);
                }
              }}
              disabled={pending !== null}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 ${TONE_CLASS[cfg.tone]}`}
            >
              {pending === s ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Icon size={14} />
              )}
              {cfg.label}
            </button>
          );
        })}
      </div>

      {confirmCancel && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
          <div className="text-sm font-semibold text-red-700">
            Are you sure you want to cancel this reservation?
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full px-3 py-2 rounded border border-red-200 text-sm bg-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => transition("canceled", reason || undefined)}
              disabled={pending !== null}
              className="px-4 py-1.5 rounded bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {pending === "canceled" ? "Cancelling..." : "Yes, cancel"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmCancel(false);
                setReason("");
              }}
              className="px-4 py-1.5 rounded border border-gray-200 text-sm font-semibold hover:bg-gray-50"
            >
              Keep reservation
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
