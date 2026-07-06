"use client";

import { useEffect, useState } from "react";
import {
  Plus, Loader2, AlertCircle, X, Shield, UserCog, User as UserIcon,
  Check, Pencil, KeyRound, RefreshCw, Mail, Brush,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Role = "admin" | "manager" | "staff" | "camareira";

interface UserItem {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface ApiResp<T> { success: boolean; data?: T; error?: string }
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = (await res.json()) as ApiResp<T>;
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data as T;
}

const ROLE_META: Record<Role, { label: string; desc: string; icon: typeof Shield; cls: string }> = {
  admin: { label: "Administrador", desc: "Acesso total + gerencia usuários e ajustes.", icon: Shield, cls: "bg-rose-50 text-rose-700 border-rose-200" },
  manager: { label: "Gerente", desc: "Reservas, imóveis, hóspedes, financeiro e WhatsApp.", icon: UserCog, cls: "bg-brand-500/10 text-brand-700 border-brand-200" },
  staff: { label: "Equipe", desc: "Operação (tarefas) + linhas de WhatsApp atribuídas.", icon: UserIcon, cls: "bg-gray-100 text-gray-600 border-gray-200" },
  camareira: { label: "Camareira", desc: "Só Agenda e Operações, sem valores. Vê tarefas dela ou sem responsável.", icon: Brush, cls: "bg-sky-50 text-sky-700 border-sky-200" },
};

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%";
  let s = "";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i++) s += chars[arr[i] % chars.length];
  return s;
}

export function UsersShell({ canManage, currentUserId }: { canManage: boolean; currentUserId: string }) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);

  const reload = async () => {
    setLoading(true); setError(null);
    try { setUsers(await api<UserItem[]>("/api/users")); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar"); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  return (
    <div className="space-y-4">
      {/* Roles legend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {(Object.keys(ROLE_META) as Role[]).map((r) => {
          const m = ROLE_META[r];
          return (
            <div key={r} className="bg-white border border-gray-200 rounded-xl p-3 flex items-start gap-2.5">
              <span className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", m.cls)}>
                <m.icon size={15} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">{m.label}</div>
                <div className="text-[11px] text-gray-500 leading-snug">{m.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {users.length === 0 ? "Nenhum usuário" : `${users.length} usuário(s)`}
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            <Plus size={14} aria-hidden="true" /> Novo usuário
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={18} aria-hidden="true" /></div>
        ) : error ? (
          <div className="p-4 text-red-500 text-sm flex items-center gap-2"><AlertCircle size={14} aria-hidden="true" /> {error}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-[11px] text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Usuário</th>
                <th className="text-left px-3 py-2 font-semibold">Papel</th>
                <th className="text-left px-3 py-2 font-semibold">Status</th>
                <th className="text-right px-3 py-2 font-semibold">{canManage ? "Ações" : ""}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => {
                const m = ROLE_META[u.role];
                return (
                  <tr key={u.id} className={cn("hover:bg-gray-50 transition-colors duration-200", !u.is_active && "opacity-60")}>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                        {u.full_name}
                        {u.id === currentUserId && <span className="text-[10px] font-medium text-gray-400">(você)</span>}
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1"><Mail size={10} aria-hidden="true" /> {u.email}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border", m.cls)}>
                        <m.icon size={11} aria-hidden="true" /> {m.label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {u.is_active ? (
                        <span className="text-emerald-600 inline-flex items-center gap-1 text-xs"><Check size={12} aria-hidden="true" /> Ativo</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Inativo</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {canManage && (
                        <button
                          onClick={() => setEditing(u)}
                          title="Editar usuário"
                          aria-label={`Editar ${u.full_name}`}
                          className="text-gray-500 hover:text-brand-600 p-1.5 rounded hover:bg-gray-100 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!canManage && (
        <p className="text-xs text-gray-400">Apenas administradores podem criar ou editar usuários. Acesso por linha de WhatsApp é gerenciado em <span className="font-medium">Ajustes → WhatsApp</span>.</p>
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); reload(); }} />}
      {editing && <EditUserModal user={editing} isSelf={editing.id === currentUserId} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [password, setPassword] = useState(genPassword());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), full_name: fullName.trim(), role, phone: phone.trim() || undefined, password }),
      });
      setCreated({ email: email.trim(), password });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao criar");
    } finally { setBusy(false); }
  };

  if (created) {
    return (
      <Modal onClose={onCreated} title="Usuário criado">
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-sm">
            <div className="font-semibold text-emerald-800 flex items-center gap-1 mb-2"><Check size={14} aria-hidden="true" /> Acesso criado</div>
            <p className="text-xs text-gray-600 mb-2">Compartilhe estas credenciais com a pessoa. A senha não será exibida novamente.</p>
            <div className="font-mono text-xs bg-white border border-gray-200 rounded p-2 space-y-1">
              <div><span className="text-gray-400">e-mail:</span> {created.email}</div>
              <div><span className="text-gray-400">senha:</span> {created.password}</div>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={onCreated} className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-200">Concluir</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Novo usuário">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome completo *"><input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={80} className="input" placeholder="Maria Silva" /></Field>
        <Field label="E-mail *"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" placeholder="maria@empresa.com" autoComplete="off" /></Field>
        <Field label="Telefone (opcional)"><input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+5582..." /></Field>
        <Field label="Papel">
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
            <option value="staff">Equipe (operação)</option>
            <option value="camareira">Camareira (sem valores)</option>
            <option value="manager">Gerente</option>
            <option value="admin">Administrador</option>
          </select>
        </Field>
        <Field label="Senha inicial *" hint="A pessoa pode trocar depois. Mínimo 8 caracteres.">
          <div className="flex gap-2">
            <input value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="input font-mono" />
            <button type="button" onClick={() => setPassword(genPassword())} title="Gerar nova senha" aria-label="Gerar nova senha" className="px-2.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors duration-200">
              <RefreshCw size={14} aria-hidden="true" />
            </button>
          </div>
        </Field>
        {err && <div className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} aria-hidden="true" /> {err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-50 transition-colors duration-200">Cancelar</button>
          <button type="submit" disabled={busy} className="bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200">
            {busy && <Loader2 className="animate-spin" size={14} aria-hidden="true" />} Criar usuário
          </button>
        </div>
      </form>
      <ModalStyles />
    </Modal>
  );
}

function EditUserModal({ user, isSelf, onClose, onSaved }: { user: UserItem; isSelf: boolean; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone || "");
  const [role, setRole] = useState<Role>(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [newPassword, setNewPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setErr(null); setHint(null);
    try {
      const payload: Record<string, unknown> = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        role,
        is_active: isActive,
      };
      if (showPwd && newPassword) payload.password = newPassword;
      await api(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setHint("Salvo");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar");
    } finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} title={`Editar · ${user.full_name}`}>
      <div className="space-y-4">
        <div className="text-xs text-gray-500 flex items-center gap-1.5"><Mail size={11} aria-hidden="true" /> {user.email}</div>
        <Field label="Nome completo"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" /></Field>
        <Field label="Telefone"><input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+5582..." /></Field>
        <Field label="Papel" hint={isSelf ? "Você não pode rebaixar a própria conta." : undefined}>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isSelf} className="input disabled:bg-gray-50 disabled:text-gray-400">
            <option value="staff">Equipe (operação)</option>
            <option value="camareira">Camareira (sem valores)</option>
            <option value="manager">Gerente</option>
            <option value="admin">Administrador</option>
          </select>
        </Field>

        <label className={cn("flex items-center gap-2 text-sm", isSelf && "opacity-50")}>
          <input type="checkbox" checked={isActive} disabled={isSelf} onChange={(e) => setIsActive(e.target.checked)} />
          <span>Conta ativa {isSelf && <span className="text-[11px] text-gray-400">(não dá pra desativar a si)</span>}</span>
        </label>

        {!showPwd ? (
          <button type="button" onClick={() => { setShowPwd(true); setNewPassword(genPassword()); }} className="text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 font-semibold">
            <KeyRound size={13} aria-hidden="true" /> Redefinir senha
          </button>
        ) : (
          <Field label="Nova senha" hint="Mínimo 8 caracteres. Compartilhe com a pessoa.">
            <div className="flex gap-2">
              <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} className="input font-mono" />
              <button type="button" onClick={() => setNewPassword(genPassword())} title="Gerar" aria-label="Gerar senha" className="px-2.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><RefreshCw size={14} aria-hidden="true" /></button>
            </div>
          </Field>
        )}

        {err && <div className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} aria-hidden="true" /> {err}</div>}
        {hint && <div className="text-xs text-emerald-600 flex items-center gap-1"><Check size={12} aria-hidden="true" /> {hint}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-50 transition-colors duration-200">Cancelar</button>
          <button onClick={save} disabled={busy} className="bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200">
            {busy && <Loader2 className="animate-spin" size={14} aria-hidden="true" />} Salvar
          </button>
        </div>
      </div>
      <ModalStyles />
    </Modal>
  );
}

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-900">{title}</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors duration-200"><X size={16} aria-hidden="true" /></button>
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

function ModalStyles() {
  return (
    <style jsx>{`.input { width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; border-radius: 0.5rem; border: 1px solid rgb(229,231,235); transition: border-color 0.2s, box-shadow 0.2s; }
     .input:focus { outline: none; border-color: rgb(107,127,94); box-shadow: 0 0 0 3px rgba(107,127,94,0.15); }`}</style>
  );
}
