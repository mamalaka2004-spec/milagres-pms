"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

interface PaymentDeleteButtonProps {
  paymentId: string;
}

export function PaymentDeleteButton({ paymentId }: PaymentDeleteButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const onDelete = async () => {
    if (!window.confirm("Excluir este pagamento? Esta ação não pode ser desfeita.")) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/payments/${paymentId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao excluir");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
      setDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={deleting}
      aria-label="Excluir pagamento"
      title={error || "Excluir pagamento"}
      className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
    >
      {deleting ? (
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
      ) : (
        <Trash2 size={14} aria-hidden="true" />
      )}
    </button>
  );
}
