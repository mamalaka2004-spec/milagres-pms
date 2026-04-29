"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { PAYMENT_METHODS } from "@/lib/validations/payment";

interface PaymentFormProps {
  reservationId: string;
  /** Suggested amount when opening form (e.g. remaining balance). */
  suggestedAmount?: number;
}

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15";
const labelClass =
  "block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1";

const METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  pix: "Pix",
  credit_card: "Credit card",
  debit_card: "Debit card",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  platform: "Channel platform",
  other: "Other",
};

export function PaymentForm({ reservationId, suggestedAmount }: PaymentFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>(
    suggestedAmount && suggestedAmount > 0 ? suggestedAmount.toFixed(2) : ""
  );
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>("pix");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setAmount(suggestedAmount && suggestedAmount > 0 ? suggestedAmount.toFixed(2) : "");
    setMethod("pix");
    setReference("");
    setNotes("");
    setError("");
    setSubmitting(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: reservationId,
          amount: parseFloat(amount),
          method,
          status: "completed",
          reference: reference || undefined,
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record payment");
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold text-sm transition"
      >
        <Plus size={14} /> Record payment
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3"
    >
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm text-gray-900">New payment</h3>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="p-1 hover:bg-gray-100 rounded text-gray-400"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Amount (R$) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className={`${inputClass} font-mono`}
          />
        </div>
        <div>
          <label className={labelClass}>Method *</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as (typeof PAYMENT_METHODS)[number])}
            className={`${inputClass} bg-white`}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Reference (optional)</label>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Transaction ID, NSU, etc."
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Notes (optional)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="px-3 py-1.5 rounded border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !amount}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Saving...
            </>
          ) : (
            "Record"
          )}
        </button>
      </div>
    </form>
  );
}
