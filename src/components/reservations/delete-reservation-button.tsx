"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

interface DeleteReservationButtonProps {
  reservationId: string;
}

export function DeleteReservationButton({ reservationId }: DeleteReservationButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const onDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/reservations/${reservationId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      router.push("/reservations");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setDeleting(false);
    }
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
      >
        <Trash2 size={14} aria-hidden="true" />
        Excluir reserva
      </button>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
      <div className="text-sm font-semibold text-red-700">
        Excluir esta reserva? Ela será removida das listas e da agenda.
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 disabled:opacity-50"
        >
          {deleting ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 size={14} aria-hidden="true" />
          )}
          {deleting ? "Excluindo..." : "Sim, excluir"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="px-4 py-1.5 rounded border border-gray-200 text-sm font-semibold hover:bg-gray-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 disabled:opacity-50"
        >
          Manter reserva
        </button>
      </div>
      {error && (
        <div className="text-xs text-red-600 bg-white border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
