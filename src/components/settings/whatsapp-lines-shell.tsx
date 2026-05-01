"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  Users,
  Loader2,
  AlertCircle,
  Check,
  X,
  Bot,
  BotOff,
  Phone,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Database, WaLinePurpose, WaBusinessHours } from "@/types/database";

type LineRow = Database["public"]["Tables"]["whatsapp_lines"]["Row"];

interface ApiResp<T> { success: boolean; data?: T; error?: string; details?: unknown }
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = (await res.json()) as ApiResp<T>;
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data as T;
}

const PURPOSE_LABEL: Record<WaLinePurpose, string> = {
  booking: "Reservas",
  sales: "Vendas",
  other: "Outro",
};

export function WhatsappLinesShell() {
  const [lines, setLines] = useState<LineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [grantsFor, setGrantsFor] = useState<LineRow | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<LineRow[]>("/api/whatsapp/lines");
      setLines(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const remove = async (line: LineRow) => {
    if (!confirm(`Excluir a linha "${line.label}" (${line.phone})? Apaga conversas e mensagens.`)) return;
    try {
      await api(`/api/whatsapp/lines/${line.id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {lines.length === 0 ? "Nenhuma linha conectada" : `${lines.length} linha(s)`}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition"
        >
          <Plus size={14} /> Nova linha
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center text-gray-400">
            <Loader2 className="animate-spin" size={18} />
          </div>
        ) : error ? (
          <div className="p-4 text-red-500 text-sm flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        ) : lines.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            <MessageSquare size={28} className="mx-auto mb-2 text-gray-300" />
            Conecte seu primeiro número WhatsApp para começar.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-[11px] text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Linha</th>
                <th className="text-left px-3 py-2 font-semibold">Tipo</th>
                <th className="text-left px-3 py-2 font-semibold">Provider</th>
                <th className="text-left px-3 py-2 font-semibold">IA</th>
                <th className="text-left px-3 py-2 font-semibold">Horário</th>
                <th className="text-right px-3 py-2 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <div className="font-semibold text-gray-900">{l.label}</div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Phone size={10} /> {l.phone}
                      {!l.is_active && <span className="ml-1 text-rose-600">(inativa)</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn(
                      "text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border",
                      l.purpose === "sales" ? "bg-amber-50 text-amber-700 border-amber-200"
                        : l.purpose === "booking" ? "bg-brand-500/10 text-brand-700 border-brand-200"
                        : "bg-gray-50 text-gray-600 border-gray-200"
                    )}>
                      {PURPOSE_LABEL[l.purpose]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-600">
                    {l.provider}
                    {l.provider_instance && (
                      <div className="text-[10px] text-gray-400">{l.provider_instance}</div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {l.ai_enabled ? (
                      <span className="text-emerald-600 inline-flex items-center gap-1 text-xs"><Bot size={12} /> Ativa</span>
                    ) : (
                      <span className="text-gray-400 inline-flex items-center gap-1 text-xs"><BotOff size={12} /> Desativa</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">
                    {l.business_hours ? (
                      <span className="inline-flex items-center gap-1"><Clock size={11} /> definido</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right space-x-1">
                    <button
                      onClick={() => setGrantsFor(l)}
                      title="Gerenciar usuários"
                      className="text-gray-500 hover:text-brand-600 p-1.5 rounded hover:bg-gray-100"
                    >
                      <Users size={14} />
                    </button>
                    <button
                      onClick={() => remove(l)}
                      title="Excluir"
                      className="text-gray-500 hover:text-rose-600 p-1.5 rounded hover:bg-gray-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateLineModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); reload(); }} />
      )}
      {grantsFor && (
        <GrantsModal line={grantsFor} onClose={() => setGrantsFor(null)} />
      )}
    </div>
  );
}

function CreateLineModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [phone, setPhone] = useState("+55");
  const [label, setLabel] = useState("");
  const [purpose, setPurpose] = useState<WaLinePurpose>("booking");
  const [providerInstance, setProviderInstance] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api("/api/whatsapp/lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          label,
          purpose,
          provider: "evolution",
          provider_instance: providerInstance || undefined,
          ai_enabled: aiEnabled,
        }),
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao criar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Nova linha WhatsApp">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Telefone (E.164)" hint="Inclua o + e o código do país">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            pattern="\+?[0-9]{8,15}"
            className="input"
            placeholder="+5582999999999"
          />
        </Field>
        <Field label="Nome / rótulo">
          <input value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={40} className="input" placeholder="Ex: Reservas" />
        </Field>
        <Field label="Tipo">
          <select value={purpose} onChange={(e) => setPurpose(e.target.value as WaLinePurpose)} className="input">
            <option value="booking">Reservas (booking)</option>
            <option value="sales">Vendas (sales)</option>
            <option value="other">Outro</option>
          </select>
        </Field>
        <Field label="Instância Evolution (opcional)" hint="Nome da instance no Evolution API">
          <input value={providerInstance} onChange={(e) => setProviderInstance(e.target.value)} className="input" placeholder="ex: milagres-reservas" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
          <span>Habilitar resposta automática da IA fora do horário</span>
        </label>
        {err && <div className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button type="submit" disabled={busy} className="bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5">
            {busy && <Loader2 className="animate-spin" size={14} />} Criar
          </button>
        </div>
      </form>
      <style jsx>{`.input { width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; border-radius: 0.5rem; border: 1px solid rgb(229,231,235); }
       .input:focus { outline: none; border-color: rgb(107,127,94); }`}</style>
    </Modal>
  );
}

interface GrantUser { id: string; full_name: string; email: string; role: string; is_active: boolean; has_access: boolean; implicit: boolean }

function GrantsModal({ line, onClose }: { line: LineRow; onClose: () => void }) {
  const [users, setUsers] = useState<GrantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ line: LineRow; users: GrantUser[] }>(`/api/whatsapp/lines/${line.id}/grants`);
        if (cancelled) return;
        setUsers(data.users);
        // Pre-select non-implicit (i.e. staff) users that already have explicit access.
        const sel = new Set<string>();
        for (const u of data.users) {
          if (u.has_access && !u.implicit) sel.add(u.id);
        }
        setSelected(sel);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Falha ao carregar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [line.id]);

  const toggle = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    setHint(null);
    try {
      await api(`/api/whatsapp/lines/${line.id}/grants`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: [...selected] }),
      });
      setHint("Acesso atualizado");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  };

  const staff = useMemo(() => users.filter((u) => !u.implicit), [users]);
  const admins = useMemo(() => users.filter((u) => u.implicit), [users]);

  return (
    <Modal onClose={onClose} title={`Acesso · ${line.label}`}>
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Selecione quais usuários do tipo <strong>staff</strong> podem ver e responder mensagens nesta linha. Admins e managers sempre têm acesso (não aparecem na seleção).
        </p>

        {loading ? (
          <div className="py-6 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={16} /></div>
        ) : (
          <>
            {staff.length === 0 ? (
              <div className="text-sm text-gray-400 py-4">Nenhum usuário staff cadastrado nesta empresa.</div>
            ) : (
              <ul className="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {staff.map((u) => (
                  <li key={u.id}>
                    <label className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => toggle(u.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{u.full_name}</div>
                        <div className="text-[11px] text-gray-500 truncate">{u.email}</div>
                      </div>
                      {!u.is_active && (
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">inativo</span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {admins.length > 0 && (
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer">Admins/managers com acesso implícito ({admins.length})</summary>
                <ul className="mt-1 space-y-0.5">
                  {admins.map((u) => (
                    <li key={u.id} className="flex items-center gap-2 py-0.5">
                      <Check size={10} className="text-emerald-600" />
                      <span>{u.full_name}</span>
                      <span className="text-gray-400">({u.role})</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        {err && <div className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {err}</div>}
        {hint && <div className="text-xs text-emerald-600">{hint}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-50">Fechar</button>
          <button
            onClick={save}
            disabled={busy || loading}
            className="bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5"
          >
            {busy && <Loader2 className="animate-spin" size={14} />} Salvar acesso
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">{label}</label>
      {children}
      {hint && <div className="text-[10px] text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}
