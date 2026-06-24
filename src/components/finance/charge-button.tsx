"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Loader2, AlertCircle, ExternalLink, Check } from "lucide-react";

interface ApiResp<T> { success: boolean; data?: T; error?: string }

type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD";

const LABELS: Record<BillingType, string> = { PIX: "PIX", BOLETO: "Boleto", CREDIT_CARD: "Cartão" };

/** Generate an Asaas charge for the reservation's outstanding balance. */
export function ChargeButton({ reservationId, balanceCents }: { reservationId: string; balanceCents: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ invoice_url: string | null } | null>(null);

  const create = async (billing_type: BillingType) => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billing_type }),
      });
      const json = (await res.json()) as ApiResp<{ invoice_url: string | null }>;
      if (!json.success) throw new Error(json.error || "Falha");
      setDone({ invoice_url: json.data?.invoice_url ?? null });
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao gerar cobrança");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mt-2 text-xs bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 space-y-1.5">
        <div className="font-semibold text-emerald-800 flex items-center gap-1"><Check size={12} aria-hidden="true" /> Cobrança gerada</div>
        {done.invoice_url && (
          <a href={done.invoice_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-800 font-semibold">
            <ExternalLink size={12} aria-hidden="true" /> Abrir fatura
          </a>
        )}
      </div>
    );
  }

  if (balanceCents <= 0) return null;

  return (
    <div className="mt-2">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 border border-brand-200 hover:bg-brand-50 px-2.5 py-1.5 rounded-lg transition-colors duration-150"
        >
          <Zap size={13} aria-hidden="true" /> Gerar cobrança (Asaas)
        </button>
      ) : (
        <div className="text-xs space-y-2">
          <div className="text-gray-500">Forma de cobrança:</div>
          <div className="flex gap-1.5">
            {(Object.keys(LABELS) as BillingType[]).map((bt) => (
              <button
                key={bt}
                onClick={() => create(bt)}
                disabled={busy}
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50 font-semibold text-gray-700 disabled:opacity-50 transition-colors duration-150"
              >
                {LABELS[bt]}
              </button>
            ))}
            <button onClick={() => setOpen(false)} disabled={busy} className="px-2 py-1.5 text-gray-400 hover:text-gray-600">cancelar</button>
          </div>
          {busy && <div className="text-gray-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" aria-hidden="true" /> gerando…</div>}
          {err && <div className="text-red-500 flex items-center gap-1"><AlertCircle size={12} aria-hidden="true" /> {err}</div>}
        </div>
      )}
    </div>
  );
}
