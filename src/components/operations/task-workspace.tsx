"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Play, Check, Loader2, AlertCircle, Plus, X, Camera,
  Home, CalendarClock, ClipboardList, ImageIcon, RotateCcw, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TASK_TYPE_LABELS, DEFAULT_CHECKLISTS } from "@/lib/validations/task";
import type { TaskDetail, TaskPhoto } from "@/lib/db/queries/tasks";
import type { ChecklistItem, TaskPhotoKind, TaskType } from "@/types/database";

interface ApiResp<T> { success: boolean; data?: T; error?: string }
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = (await res.json()) as ApiResp<T>;
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data as T;
}

function uid(): string {
  try { return crypto.randomUUID().slice(0, 8); } catch { return Math.random().toString(36).slice(2, 10); }
}
function fmt(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const PHOTO_SECTIONS: {
  kind: TaskPhotoKind;
  label: string;
  capture: "environment" | "user";
  accept: string;
}[] = [
  { kind: "before", label: "Antes", capture: "environment", accept: "image/*,video/*" },
  { kind: "after", label: "Depois", capture: "environment", accept: "image/*,video/*" },
  { kind: "worker", label: "Profissional", capture: "user", accept: "image/*" },
];

/** Upload direto ao storage via signed URL (vídeos passam do limite de body da Vercel). */
async function uploadTaskMedia(taskId: string, kind: TaskPhotoKind, file: File): Promise<TaskPhoto> {
  const sign = await api<{ upload_url: string; path: string; media_type: string }>(
    `/api/tasks/${taskId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, content_type: file.type, size: file.size }),
    }
  );
  const put = await fetch(sign.upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) throw new Error("Falha ao enviar o arquivo ao storage");
  return api<TaskPhoto>(`/api/tasks/${taskId}/media`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, path: sign.path }),
  });
}

export function TaskWorkspace({ task }: { task: TaskDetail }) {
  const [status, setStatus] = useState(task.status);
  const [startedAt, setStartedAt] = useState(task.started_at);
  const [completedAt, setCompletedAt] = useState(task.completed_at);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist || []);
  const [photos, setPhotos] = useState<TaskPhoto[]>(task.photos || []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");
  // Reagendamento (a camareira pode alterar data/hora da tarefa auto-agendada).
  const [dueDate, setDueDate] = useState(task.due_date || "");
  const [dueTime, setDueTime] = useState(task.due_time ? task.due_time.slice(0, 5) : "");
  const [rescheduling, setRescheduling] = useState(false);

  const propName = task.property?.name || "Imóvel";
  const doneCount = checklist.filter((c) => c.done).length;

  async function patch(body: Record<string, unknown>) {
    return api<TaskDetail>(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const start = async () => {
    setBusy(true); setErr(null);
    try {
      // Seed a default checklist for this task type if empty.
      const seed: ChecklistItem[] =
        checklist.length > 0
          ? checklist
          : (DEFAULT_CHECKLISTS[task.type as TaskType] || []).map((label) => ({ id: uid(), label, done: false }));
      const updated = await patch({ status: "in_progress", checklist: seed });
      setStatus("in_progress"); setStartedAt(updated.started_at); setChecklist(seed);
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha"); }
    finally { setBusy(false); }
  };

  const finish = async () => {
    setBusy(true); setErr(null);
    try {
      const updated = await patch({ status: "completed", checklist });
      setStatus("completed"); setCompletedAt(updated.completed_at);
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha"); }
    finally { setBusy(false); }
  };

  const reopen = async () => {
    setBusy(true); setErr(null);
    try {
      await patch({ status: "in_progress" });
      setStatus("in_progress"); setCompletedAt(null);
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha"); }
    finally { setBusy(false); }
  };

  // Toggle a checklist item (optimistic + persist).
  const toggle = async (itemId: string) => {
    const next = checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c));
    setChecklist(next);
    try { await patch({ checklist: next }); } catch { /* keep optimistic */ }
  };

  const addItem = async () => {
    const label = newItem.trim();
    if (!label) return;
    const next = [...checklist, { id: uid(), label, done: false }];
    setNewItem("");
    setChecklist(next);
    try { await patch({ checklist: next }); } catch { /* ignore */ }
  };

  const removeItem = async (itemId: string) => {
    const next = checklist.filter((c) => c.id !== itemId);
    setChecklist(next);
    try { await patch({ checklist: next }); } catch { /* ignore */ }
  };

  const saveSchedule = async () => {
    setBusy(true); setErr(null);
    try {
      await patch({ due_date: dueDate || "", due_time: dueTime || "" });
      setRescheduling(false);
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha"); }
    finally { setBusy(false); }
  };

  const editing = status === "in_progress";

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/operations" aria-label="Voltar" className="p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors duration-200">
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">{TASK_TYPE_LABELS[task.type as TaskType] || task.type}</div>
          <h1 className="text-lg font-bold text-gray-900 truncate">{propName}</h1>
        </div>
        <StatusPill status={status} />
      </div>

      {/* Context */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 space-y-2 text-sm">
        <Row icon={Home} label="Imóvel" value={`${propName}${task.property?.code ? ` · ${task.property.code}` : ""}`} />
        {task.reservation && <Row icon={ClipboardList} label="Reserva" value={`${task.reservation.booking_code}${task.reservation.guest?.full_name ? ` · ${task.reservation.guest.full_name}` : ""}`} />}
        <div className="flex items-center gap-2.5">
          <CalendarClock size={15} className="text-gray-400 shrink-0" aria-hidden="true" />
          <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold w-16 shrink-0">Prazo</span>
          {rescheduling ? (
            <span className="flex items-center gap-1.5 flex-wrap">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40" />
              <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40" />
              <button onClick={saveSchedule} disabled={busy} className="text-xs font-semibold text-brand-600 hover:text-brand-700 px-1">Salvar</button>
              <button onClick={() => { setRescheduling(false); setDueDate(task.due_date || ""); setDueTime(task.due_time ? task.due_time.slice(0, 5) : ""); }} className="text-xs text-gray-400 hover:text-gray-600 px-1">Cancelar</button>
            </span>
          ) : (
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-gray-800 truncate">
                {dueDate ? new Date(dueDate + "T00:00:00").toLocaleDateString("pt-BR") : "Sem prazo"}
                {dueTime ? ` ${dueTime}` : ""}
              </span>
              {status !== "completed" && (
                <button onClick={() => setRescheduling(true)} className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 shrink-0">
                  Reagendar
                </button>
              )}
            </span>
          )}
        </div>
        {task.notes && <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5 whitespace-pre-wrap">{task.notes}</div>}
        {(startedAt || completedAt) && (
          <div className="flex items-center gap-4 pt-1 text-[11px] text-gray-400">
            <span className="inline-flex items-center gap-1"><Clock size={11} aria-hidden="true" /> início {fmt(startedAt)}</span>
            {completedAt && <span className="inline-flex items-center gap-1"><Check size={11} aria-hidden="true" /> fim {fmt(completedAt)}</span>}
          </div>
        )}
      </div>

      {err && <div className="text-sm text-red-500 flex items-center gap-1.5"><AlertCircle size={14} aria-hidden="true" /> {err}</div>}

      {/* Not started yet */}
      {status === "pending" && (
        <button onClick={start} disabled={busy} className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 text-white rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 transition-colors duration-200 shadow-sm">
          {busy ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />} Iniciar serviço (check-in)
        </button>
      )}

      {/* Checklist (when started or completed) */}
      {(editing || status === "completed") && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-sm text-gray-800 flex items-center gap-1.5"><ClipboardList size={15} aria-hidden="true" /> Checklist</span>
            <span className="text-xs text-gray-400 tabular-nums">{doneCount}/{checklist.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {checklist.length === 0 && <div className="px-4 py-6 text-center text-xs text-gray-400">Sem itens. Adicione abaixo.</div>}
            {checklist.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <button onClick={() => editing && toggle(c.id)} disabled={!editing} aria-label={c.done ? "Desmarcar" : "Marcar"} className={cn("w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors duration-150", c.done ? "bg-brand-500 border-brand-500 text-white" : "border-gray-300 text-transparent", editing ? "cursor-pointer" : "opacity-70")}>
                  <Check size={14} aria-hidden="true" />
                </button>
                <span className={cn("flex-1 text-sm", c.done ? "text-gray-400 line-through" : "text-gray-800")}>{c.label}</span>
                {editing && (
                  <button onClick={() => removeItem(c.id)} aria-label="Remover item" className="text-gray-300 hover:text-rose-500 p-1 transition-colors duration-150"><X size={15} aria-hidden="true" /></button>
                )}
              </div>
            ))}
          </div>
          {editing && (
            <div className="p-3 border-t border-gray-100 flex gap-2">
              <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }} placeholder="Adicionar item…" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40" />
              <button onClick={addItem} aria-label="Adicionar" className="px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors duration-150"><Plus size={16} aria-hidden="true" /></button>
            </div>
          )}
        </div>
      )}

      {/* Photos */}
      {(editing || status === "completed") && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PHOTO_SECTIONS.map((sec) => (
            <PhotoSection
              key={sec.kind}
              taskId={task.id}
              kind={sec.kind}
              label={sec.label}
              capture={sec.capture}
              accept={sec.accept}
              editable={editing}
              photos={photos.filter((p) => p.kind === sec.kind)}
              onAdded={(p) => setPhotos((prev) => [p, ...prev])}
              onRemoved={(pid) => setPhotos((prev) => prev.filter((x) => x.id !== pid))}
            />
          ))}
        </div>
      )}

      {/* Finish / reopen */}
      {editing && (
        <button onClick={finish} disabled={busy} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 transition-colors duration-200 shadow-sm">
          {busy ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />} Concluir serviço (check-out)
        </button>
      )}
      {status === "completed" && (
        <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
          <span className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5"><Check size={16} aria-hidden="true" /> Serviço concluído</span>
          <button onClick={reopen} disabled={busy} className="text-xs font-semibold text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"><RotateCcw size={13} aria-hidden="true" /> Reabrir</button>
        </div>
      )}
    </div>
  );
}

function PhotoSection({
  taskId, kind, label, capture, accept, editable, photos, onAdded, onRemoved,
}: {
  taskId: string; kind: TaskPhotoKind; label: string; capture: "environment" | "user";
  accept: string; editable: boolean; photos: TaskPhoto[];
  onAdded: (p: TaskPhoto) => void; onRemoved: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true); setErr(null);
    try {
      const p = await uploadTaskMedia(taskId, kind, file);
      onAdded(p);
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha"); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    onRemoved(id);
    try { await api(`/api/tasks/${taskId}/photos`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photo_id: id }) }); } catch { /* ignore */ }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-700 flex items-center gap-1"><ImageIcon size={13} aria-hidden="true" /> {label}</span>
        <span className="text-[10px] text-gray-400">{photos.length}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {photos.map((p) => (
          <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden group">
            <a href={p.url} target="_blank" rel="noopener noreferrer">
              {p.media_type === "video" ? (
                <video src={p.url} preload="metadata" muted playsInline className="w-full h-full object-cover bg-black" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt={label} loading="lazy" className="w-full h-full object-cover" />
              )}
            </a>
            {p.media_type === "video" && (
              <span className="absolute bottom-0.5 left-0.5 bg-black/60 text-white rounded px-1 text-[9px] font-bold uppercase pointer-events-none">vídeo</span>
            )}
            {editable && (
              <button onClick={() => remove(p.id)} aria-label="Remover foto" className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} aria-hidden="true" /></button>
            )}
          </div>
        ))}
        {editable && (
          <button onClick={() => inputRef.current?.click()} disabled={busy} aria-label={`Adicionar foto (${label})`} className="aspect-square rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-brand-300 hover:text-brand-500 flex items-center justify-center transition-colors duration-150 disabled:opacity-50">
            {busy ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Camera size={18} aria-hidden="true" />}
          </button>
        )}
      </div>
      {err && <div className="text-[10px] text-red-500 mt-1">{err}</div>}
      <input ref={inputRef} type="file" accept={accept} capture={capture} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); if (inputRef.current) inputRef.current.value = ""; }} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pendente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    in_progress: { label: "Em andamento", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    completed: { label: "Concluída", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    skipped: { label: "Ignorada", cls: "bg-gray-100 text-gray-500 border-gray-200" },
  };
  const m = map[status] || map.pending;
  return <span className={cn("text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border shrink-0", m.cls)}>{m.label}</span>;
}

function Row({ icon: Icon, label, value }: { icon: typeof Home; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={15} className="text-gray-400 shrink-0" aria-hidden="true" />
      <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold w-16 shrink-0">{label}</span>
      <span className="text-gray-800 truncate">{value}</span>
    </div>
  );
}
