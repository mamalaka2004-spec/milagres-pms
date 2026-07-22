"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Megaphone, Target, Plus, Send, Trash2, Loader2, Clock, CheckCircle2, XCircle, ListChecks, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/ui";
import { ContactPicker } from "./contact-picker";
import { ContactListsTab } from "./contact-lists-tab";
import { FunnelTargetSelect } from "./funnel-target-select";
import { CadenceBuilder, EMPTY_STEP, type CadenceStepDraft } from "./cadence-builder";
import { AntibanSettings, ANTIBAN_DEFAULTS, type AntibanConfig } from "./antiban-settings";
import {
  CAMPAIGN_STATUS_META,
  type Campaign,
  type ContactLite,
  type ContactList,
} from "@/types/campaign";

interface LineLite {
  id: string;
  label: string;
  phone: string;
  purpose: string;
  warmup_enabled?: boolean;
  warmup_start_date?: string | null;
}

export function CampaignsShell() {
  const [tab, setTab] = useState<"campanhas" | "listas" | "prospeccao">("campanhas");
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        {([
          { id: "campanhas", label: "Campanhas", icon: Megaphone },
          { id: "listas", label: "Listas", icon: ListChecks },
          { id: "prospeccao", label: "Prospecção", icon: Target },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>
      {tab === "campanhas" && <CampaignsTab />}
      {tab === "listas" && <ContactListsTab />}
      {tab === "prospeccao" && <ProspectTab />}
    </div>
  );
}

// ─── Campanhas ───
function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      setCampaigns(await api<Campaign[]>(`/api/campaigns`));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh enquanto houver campanha em envio.
  useEffect(() => {
    const anySending = campaigns.some((c) => c.status === "sending");
    if (anySending && !timer.current) {
      timer.current = setInterval(load, 4000);
    } else if (!anySending && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [campaigns, load]);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!composing && (
        <button
          onClick={() => setComposing(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          <Plus size={16} /> Nova campanha
        </button>
      )}
      {composing && (
        <ComposeCampaign
          onClose={() => setComposing(false)}
          onSaved={() => {
            setComposing(false);
            load();
          }}
        />
      )}
      {campaigns.length === 0 && !composing ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          Nenhuma campanha ainda.
        </div>
      ) : (
        <ul className="space-y-2">
          {campaigns.map((c) => (
            <CampaignRow key={c.id} campaign={c} onChanged={load} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ComposeCampaign({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [lines, setLines] = useState<LineLite[]>([]);
  const [lineId, setLineId] = useState<string>("");
  const [steps, setSteps] = useState<CadenceStepDraft[]>([{ ...EMPTY_STEP, wait_hours: 0 }]);
  const [antiban, setAntiban] = useState<AntibanConfig>(ANTIBAN_DEFAULTS);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [listIds, setListIds] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<ContactLite[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<LineLite[]>(`/api/whatsapp/lines`)
      .then((ls) => {
        setLines(ls);
        // Campanhas são de Vendas por padrão — pré-seleciona a linha sales.
        setLineId(ls.find((l) => l.purpose === "sales")?.id ?? ls[0]?.id ?? "");
      })
      .catch(() => setLines([]));
    api<ContactList[]>(`/api/contact-lists`).then(setLists).catch(() => setLists([]));
  }, []);

  const line = lines.find((l) => l.id === lineId) ?? null;
  const firstStep = steps[0];
  const stepsValid = steps.every(
    (s) => (s.kind === "template" ? s.body.trim().length > 0 : s.ai_prompt.trim().length > 0)
  );

  async function toggleWarmup(enabled: boolean) {
    if (!line) return;
    try {
      const res = await api<{ warmup_enabled: boolean; warmup_start_date: string | null }>(
        `/api/whatsapp/lines/${line.id}/warmup`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ warmup_enabled: enabled }) }
      );
      setLines((ls) => ls.map((l) => (l.id === line.id ? { ...l, ...res } : l)));
      toast({ title: enabled ? "Warmup ativado" : "Warmup desligado", variant: "success" });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    }
  }

  async function save() {
    if (!name.trim() || !stepsValid || saving) return;
    setSaving(true);
    try {
      const campaign = await api<Campaign>(`/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          line_id: lineId || null,
          message_template:
            firstStep.kind === "template" ? firstStep.body.trim() : "(mensagem gerada por IA)",
          ...antiban,
          audience: listIds.length ? { list_ids: listIds } : null,
        }),
      });
      await api(`/api/campaigns/${campaign.id}/steps`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: steps.map((s, i) => ({
            kind: s.kind,
            body: s.kind === "template" ? s.body.trim() : null,
            ai_prompt: s.kind === "ai" ? s.ai_prompt.trim() : null,
            wait_hours: i === 0 ? 0 : s.wait_hours,
          })),
        }),
      });
      if (recipients.length > 0) {
        await api(`/api/campaigns/${campaign.id}/recipients`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contact_ids: recipients.map((r) => r.id) }),
        });
      }
      toast({
        title: "Campanha criada",
        description: `${steps.length} passo(s) · ${listIds.length} lista(s) · ${recipients.length} contato(s) avulso(s)`,
        variant: "success",
      });
      onSaved();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Nome da campanha</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Prospecção investidores — julho"
            className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Número de disparo</label>
          <select
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            {lines.length === 0 && <option value="">Nenhuma linha</option>}
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label} · {l.phone}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600">
          Mensagens da cadência{" "}
          <span className="text-gray-400">— follow-ups só saem para quem não respondeu</span>
        </label>
        <CadenceBuilder steps={steps} onChange={setSteps} />
      </div>

      <AntibanSettings
        value={antiban}
        onChange={setAntiban}
        warmup={
          line
            ? {
                enabled: !!line.warmup_enabled,
                startDate: line.warmup_start_date ?? null,
                onToggle: toggleWarmup,
              }
            : null
        }
      />

      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600">Audiência — listas salvas</label>
        {lists.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhuma lista ainda — crie na aba Listas.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {lists.map((l) => {
              const sel = listIds.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setListIds(sel ? listIds.filter((x) => x !== l.id) : [...listIds, l.id])}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    sel ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {l.name} · {l.member_count ?? 0}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600">Contatos avulsos (opcional)</label>
        <ContactPicker value={recipients} onChange={setRecipients} />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
        <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={saving || !name.trim() || !stepsValid}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving && <Loader2 size={15} className="animate-spin" />} Salvar rascunho
        </button>
      </div>
    </div>
  );
}

function CampaignRow({ campaign, onChanged }: { campaign: Campaign; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const meta = CAMPAIGN_STATUS_META[campaign.status];
  const done = campaign.sent_count + campaign.failed_count;
  const pct = campaign.total_count > 0 ? Math.round((done / campaign.total_count) * 100) : 0;
  const canSend = campaign.status === "draft";
  const canPause = campaign.status === "sending" || campaign.status === "scheduled";
  const canResume = campaign.status === "paused";

  async function control(action: "pause" | "resume") {
    setBusy(true);
    try {
      await api(`/api/campaigns/${campaign.id}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      toast({ title: action === "pause" ? "Campanha pausada" : "Campanha retomada", variant: "success" });
      onChanged();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    try {
      const body = scheduledAt ? { scheduled_at: new Date(scheduledAt).toISOString() } : {};
      const res = await api<{ queued: number; skipped: number; scheduled_at: string | null }>(
        `/api/campaigns/${campaign.id}/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      toast({
        title: res.scheduled_at ? "Campanha agendada" : "Disparo iniciado",
        description: `${res.queued} na fila${res.skipped ? ` · ${res.skipped} pulados (opt-out/conversa ativa)` : ""}`,
        variant: "success",
      });
      onChanged();
    } catch (e) {
      toast({ title: "Não foi possível disparar", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setBusy(false);
      setConfirmSend(false);
    }
  }

  async function remove() {
    try {
      await api(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      toast({ title: "Erro ao remover", description: e instanceof Error ? e.message : "", variant: "error" });
    }
  }

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <a href={`/campaigns/${campaign.id}`} className="truncate font-semibold text-gray-900 hover:text-brand-600 hover:underline">
              {campaign.name}
            </a>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ color: meta.color, background: `${meta.color}18` }}
            >
              {campaign.status === "sending" && <Loader2 size={10} className="animate-spin" />}
              {campaign.status === "sent" && <CheckCircle2 size={10} />}
              {campaign.status === "failed" && <XCircle size={10} />}
              {campaign.status === "scheduled" && <Clock size={10} />}
              {meta.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-gray-400">
            {campaign.total_count} destinatário(s)
            {campaign.status !== "draft" && ` · ${campaign.sent_count} enviados · ${campaign.failed_count} falhas`}
          </p>
          {(campaign.status === "sending" || campaign.status === "sent" || campaign.status === "failed") &&
            campaign.total_count > 0 && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canSend && (
            <button
              onClick={() => setConfirmSend(true)}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              <Send size={13} /> Disparar
            </button>
          )}
          {canPause && (
            <button
              onClick={() => control("pause")}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <Pause size={13} /> Pausar
            </button>
          )}
          {canResume && (
            <button
              onClick={() => control("resume")}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              <Play size={13} /> Retomar
            </button>
          )}
          {campaign.status !== "sending" && (
            <button onClick={() => setConfirmDelete(true)} className="rounded-lg p-1.5 text-gray-300 hover:text-red-500">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmSend}
        onOpenChange={(o) => !o && setConfirmSend(false)}
        title="Disparar campanha?"
        description={`${campaign.total_count} mensagem(ns) serão enviadas via WhatsApp. Deixe a data em branco para disparar agora.`}
        confirmLabel={scheduledAt ? "Agendar" : "Disparar agora"}
        variant="primary"
        onConfirm={send}
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Agendar para (opcional)</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(false)}
        title="Remover campanha?"
        description={`"${campaign.name}" e seus destinatários serão removidos.`}
        confirmLabel="Remover"
        variant="danger"
        onConfirm={() => {
          remove();
          setConfirmDelete(false);
        }}
      />
    </li>
  );
}

// ─── Prospecção ───
function ProspectTab() {
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [target, setTarget] = useState<{ pipelineId: string | null; stageId: string | null }>({
    pipelineId: null,
    stageId: null,
  });
  const [busy, setBusy] = useState(false);

  const onTarget = useCallback((v: { pipelineId: string | null; stageId: string | null }) => setTarget(v), []);

  async function assign() {
    if (!target.pipelineId || !target.stageId || contacts.length === 0 || busy) return;
    setBusy(true);
    try {
      const res = await api<{ created: number }>(`/api/funnel/prospect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline_id: target.pipelineId,
          stage_id: target.stageId,
          contact_ids: contacts.map((c) => c.id),
        }),
      });
      toast({ title: "Contatos atribuídos", description: `${res.created} negócio(s) criado(s) no funil`, variant: "success" });
      setContacts([]);
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Selecionar contatos</h3>
        <ContactPicker value={contacts} onChange={setContacts} listHeight="h-80" />
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-1 text-sm font-semibold text-gray-900">Atribuir ao funil</h3>
          <p className="mb-3 text-xs text-gray-500">
            Cria um negócio por contato na etapa escolhida — inclusive cruzando bases (Locação ↔ Vendas).
          </p>
          <FunnelTargetSelect onChange={(v) => onTarget({ pipelineId: v.pipelineId, stageId: v.stageId })} />
          <button
            onClick={assign}
            disabled={busy || contacts.length === 0 || !target.stageId}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            Atribuir {contacts.length > 0 ? `${contacts.length} contato(s)` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
