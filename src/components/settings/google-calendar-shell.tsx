"use client";

import { useState } from "react";
import {
  CalendarClock,
  Lock,
  ArrowLeftRight,
  Home,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { GoogleCalendarConnection } from "@/lib/calendar/google";

interface PropertyLite {
  id: string;
  name: string;
  code: string | null;
}

interface Props {
  configured: boolean;
  properties: PropertyLite[];
  connections: GoogleCalendarConnection[];
}

const STATUS_META: Record<
  GoogleCalendarConnection["status"],
  { label: string; tone: string }
> = {
  disconnected: { label: "Desconectado", tone: "bg-gray-100 text-gray-500" },
  pending_auth: { label: "Aguardando login", tone: "bg-amber-50 text-amber-700" },
  connected: { label: "Conectado", tone: "bg-emerald-50 text-emerald-700" },
  error: { label: "Erro", tone: "bg-rose-50 text-rose-700" },
};

const DIRECTION_LABEL: Record<GoogleCalendarConnection["direction"], string> = {
  import: "Google → Milagres",
  export: "Milagres → Google",
  both: "Bidirecional",
};

export default function GoogleCalendarShell({ configured, properties, connections }: Props) {
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const connByProperty = new Map<string, GoogleCalendarConnection>();
  for (const c of connections) {
    if (c.property_id) connByProperty.set(c.property_id, c);
  }

  async function testConnect() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/settings/google-calendar/connect", { method: "POST" });
      const json = (await res.json()) as { success: boolean; error?: string };
      setTestMsg(json.error || (json.success ? "OK" : `HTTP ${res.status}`));
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Blocked banner */}
      {!configured && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
            <Lock size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-gray-900">Requer credenciais Google OAuth</h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                Indisponível
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              A sincronização bidirecional com o Google Calendar depende de um app OAuth do Google
              (client ID, client secret e redirect URI verificado) que ainda <strong>não está
              configurado</strong>. Assim que as credenciais forem provisionadas no ambiente
              (<code className="text-xs bg-white/60 px-1 rounded">GOOGLE_OAUTH_CLIENT_ID</code>,{" "}
              <code className="text-xs bg-white/60 px-1 rounded">GOOGLE_OAUTH_CLIENT_SECRET</code>,{" "}
              <code className="text-xs bg-white/60 px-1 rounded">GOOGLE_OAUTH_REDIRECT_URI</code>),
              a conexão por anúncio fica disponível aqui.
            </p>
            <button
              onClick={testConnect}
              disabled={testing}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-800 font-medium text-xs hover:bg-amber-50 transition-colors duration-200 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
            >
              <AlertCircle size={13} /> Testar disponibilidade
            </button>
            {testMsg && <p className="text-xs text-amber-800 mt-2">{testMsg}</p>}
          </div>
        </div>
      )}

      {configured && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/60 p-4 flex items-start gap-3">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-900">
            Credenciais OAuth detectadas. O fluxo de conexão/sync ainda é um scaffold —{" "}
            <strong>o wiring real (getAuthUrl → callback → sync) é o próximo passo</strong>.
          </p>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <ArrowLeftRight size={16} className="text-gray-400" />
          <h3 className="font-semibold text-sm text-gray-900">Como vai funcionar</h3>
        </div>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-700 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
            Cada <strong>anúncio</strong> (imóvel) conecta a um calendário do Google.
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-700 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
            <span>
              <strong>Import</strong>: eventos/bloqueios do Google viram indisponibilidade no
              Milagres. <strong>Export</strong>: reservas do Milagres viram eventos no Google.
              O sentido é configurável por conexão (import, export ou ambos).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-700 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
            A sincronização incremental usa o <code className="text-xs bg-gray-100 px-1 rounded">syncToken</code> do
            Google e registra cada execução para auditoria.
          </li>
        </ul>
      </div>

      {/* Per-listing connection list */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Home size={15} className="text-gray-400" />
          <span className="font-semibold text-sm text-gray-900">Anúncios</span>
          <span className="ml-auto text-[11px] text-gray-400">{properties.length}</span>
        </div>

        {properties.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
            <Info size={18} className="text-gray-300" />
            Nenhum anúncio cadastrado.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {properties.map((p) => {
              const conn = connByProperty.get(p.id);
              const status = conn?.status ?? "disconnected";
              const meta = STATUS_META[status];
              return (
                <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                    <CalendarClock size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-gray-900 truncate">{p.name}</div>
                    <div className="text-[11px] text-gray-400">
                      {p.code || "—"}
                      {conn ? ` · ${DIRECTION_LABEL[conn.direction]}` : ""}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                      meta.tone
                    )}
                  >
                    {meta.label}
                  </span>
                  <button
                    disabled={!configured}
                    title={
                      configured
                        ? "Conectar ao Google Calendar"
                        : "Indisponível — requer credenciais Google OAuth"
                    }
                    className={cn(
                      "text-xs font-semibold px-3 py-1.5 rounded-lg border shrink-0 transition-colors duration-200",
                      configured
                        ? "border-brand-400 text-brand-600 hover:bg-brand-50"
                        : "border-gray-200 text-gray-300 cursor-not-allowed"
                    )}
                  >
                    Conectar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400">
        Modelo de dados pronto (migration 031). Fluxo OAuth e sincronização: TODO — ver{" "}
        <code className="bg-gray-100 px-1 rounded">src/lib/calendar/google.ts</code>.
      </p>
    </div>
  );
}
