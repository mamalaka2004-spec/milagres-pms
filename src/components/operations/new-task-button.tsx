"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";
import { TASK_TYPE_LABELS, TASK_TYPES } from "@/lib/validations/task";

interface AssignableUser { id: string; full_name: string; role: string; is_active: boolean }

interface PropertyOption {
  id: string;
  name: string;
  code: string;
}

interface NewTaskButtonProps {
  properties: PropertyOption[];
  defaultPropertyId?: string;
  defaultReservationId?: string;
}

export function NewTaskButton({
  properties,
  defaultPropertyId,
  defaultReservationId,
}: NewTaskButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [propertyId, setPropertyId] = useState(defaultPropertyId || properties[0]?.id || "");
  const [type, setType] = useState<(typeof TASK_TYPES)[number]>("checkout_clean");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [dueDate, setDueDate] = useState<string>("");
  const [dueTime, setDueTime] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load assignable team members when the dialog opens (silently no-ops for staff
  // who can't list users).
  useEffect(() => {
    if (!open || users.length > 0) return;
    (async () => {
      try {
        const res = await fetch("/api/users");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setUsers((json.data as AssignableUser[]).filter((u) => u.is_active));
        }
      } catch { /* ignore */ }
    })();
  }, [open, users.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          reservation_id: defaultReservationId || undefined,
          type,
          priority,
          status: "pending",
          due_date: dueDate || undefined,
          due_time: dueTime || undefined,
          notes: notes || undefined,
          assigned_to: assignedTo || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao criar tarefa");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
      >
        <Plus size={15} aria-hidden="true" /> Nova tarefa
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-base text-gray-900">Nova tarefa</h2>
              <button
                type="button"
                aria-label="Fechar diálogo"
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={submit} className="p-5 space-y-3">
              <Field label="Imóvel *">
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="form-input bg-white"
                  required
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo">
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as (typeof TASK_TYPES)[number])}
                    className="form-input bg-white"
                  >
                    {TASK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TASK_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Prioridade">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as typeof priority)}
                    className="form-input bg-white"
                  >
                    <option value="low">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Data de vencimento">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="form-input"
                  />
                </Field>
                <Field label="Horário de vencimento">
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="form-input"
                  />
                </Field>
              </div>

              {users.length > 0 && (
                <Field label="Atribuir a">
                  <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="form-input bg-white">
                    <option value="">Sem responsável</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="Observações">
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="form-input"
                />
              </Field>

              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !propertyId}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm disabled:opacity-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Salvando...
                    </>
                  ) : (
                    "Criar"
                  )}
                </button>
              </div>
            </form>

            <style jsx>{`
              :global(.form-input) {
                width: 100%;
                padding: 9px 12px;
                border-radius: 8px;
                border: 1px solid #e5e5e5;
                font-size: 14px;
                color: #1a1a1a;
                background: #fff;
                transition: all 0.15s;
                font-family: inherit;
              }
              :global(.form-input:focus) {
                outline: none;
                border-color: #8a9b7e;
                box-shadow: 0 0 0 3px rgba(138, 155, 126, 0.15);
              }
            `}</style>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
