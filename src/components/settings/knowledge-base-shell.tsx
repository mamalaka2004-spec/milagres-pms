"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, Loader2, Save, X, Upload, FileText, Home, BookOpen, Lock } from "lucide-react";
import { Button, Input, Textarea, Select, ConfirmDialog } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import type { Database } from "@/types/database";
import type { UploadKind } from "@/lib/validations/knowledge";

type GuideRow = Database["public"]["Tables"]["property_guides"]["Row"] & { pdf_url?: string | null };
type KbRow = Database["public"]["Tables"]["kb_articles"]["Row"];

type Tab = "guides" | "articles";

export function KnowledgeBaseShell({ canEdit }: { canEdit: boolean }) {
  const [tab, setTab] = useState<Tab>("guides");
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        <TabBtn active={tab === "guides"} onClick={() => setTab("guides")} icon={<Home size={14} />}>Guias de imóveis</TabBtn>
        <TabBtn active={tab === "articles"} onClick={() => setTab("articles")} icon={<BookOpen size={14} />}>Artigos / FAQ</TabBtn>
      </div>
      {tab === "guides" ? <GuidesTab canEdit={canEdit} /> : <ArticlesTab canEdit={canEdit} />}
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors", active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
      {icon} {children}
    </button>
  );
}

// ═══════════════════════════ GUIAS ═══════════════════════════
type GuideDraft = Partial<GuideRow>;
const NEW_GUIDE: GuideDraft = {
  unit_code: "", name: "", property_type: "", condo: "", region: "",
  max_guests: null, suites: null, beds: "", bathrooms: "",
  short_description: "", description: "", amenities: [], house_rules: [],
  check_in_time: "15:00", check_out_time: "11:00", cancellation_policy: "",
  wifi_ssid: "", wifi_password: "", access_method: "", door_code: "",
  access_instructions: "", exact_address: "", maps_url: "",
  image_urls: [], video_urls: [], pdf_path: null, active: true,
};

function GuidesTab({ canEdit }: { canEdit: boolean }) {
  const [guides, setGuides] = useState<GuideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<GuideDraft | null>(null);

  const load = useCallback(async () => {
    const rows = await api<GuideRow[]>("/api/kb/guides");
    setGuides(rows);
    return rows;
  }, []);

  useEffect(() => {
    setLoading(true);
    load().catch((e) => toast({ title: "Erro ao carregar", description: e instanceof Error ? e.message : "", variant: "error" })).finally(() => setLoading(false));
  }, [load]);

  async function selectGuide(id: string) {
    setSelectedId(id);
    // Busca única traz a URL assinada do PDF (privado).
    const full = await api<GuideRow>(`/api/kb/guides/${id}`);
    setDraft(full);
  }

  if (loading) return <Centered><Loader2 className="animate-spin" size={20} /></Centered>;

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <ListCard
        title="Guias"
        canEdit={canEdit}
        onNew={() => { setSelectedId(null); setDraft({ ...NEW_GUIDE }); }}
        items={guides.map((g) => ({ id: g.id, active: g.active !== false, primary: g.name, secondary: g.unit_code }))}
        selectedId={selectedId}
        onSelect={selectGuide}
        emptyLabel="Nenhum guia ainda."
      />
      <div>
        {draft ? (
          <GuideEditor
            key={selectedId ?? "new"}
            draft={draft}
            setDraft={setDraft}
            isNew={!selectedId}
            canEdit={canEdit}
            onSaved={async (saved) => { await load(); setSelectedId(saved.id); await selectGuide(saved.id); }}
            onDeleted={async () => { await load(); setSelectedId(null); setDraft(null); }}
          />
        ) : (
          <EmptyEditor>Selecione um guia ou crie um novo.</EmptyEditor>
        )}
      </div>
    </div>
  );
}

function GuideEditor({ draft, setDraft, isNew, canEdit, onSaved, onDeleted }: {
  draft: GuideDraft; setDraft: (d: GuideDraft) => void; isNew: boolean; canEdit: boolean;
  onSaved: (s: GuideRow) => Promise<void>; onDeleted: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof GuideRow>(k: K, v: GuideRow[K]) => setDraft({ ...draft, [k]: v });
  const disabled = !canEdit;

  async function save() {
    if (!canEdit || busy) return;
    if (!draft.unit_code?.trim() || !draft.name?.trim()) { toast({ title: "Código e nome são obrigatórios", variant: "error" }); return; }
    setBusy(true);
    try {
      const payload = { ...draft };
      ["id", "company_id", "created_at", "updated_at", "pdf_url"].forEach((k) => delete (payload as Record<string, unknown>)[k]);
      const saved = isNew
        ? await api<GuideRow>("/api/kb/guides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await api<GuideRow>(`/api/kb/guides/${draft.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      toast({ title: "Guia salvo", variant: "success" });
      await onSaved(saved);
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!draft.id) return;
    try { await api(`/api/kb/guides/${draft.id}`, { method: "DELETE" }); toast({ title: "Guia removido", variant: "success" }); await onDeleted(); }
    catch (e) { toast({ title: "Não foi possível remover", description: e instanceof Error ? e.message : "", variant: "error" }); }
  }

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">{isNew ? "Novo guia" : draft.name}</h3>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" disabled={disabled} checked={draft.active !== false} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4 accent-brand-500" /> Ativo
        </label>
      </div>

      <Group title="Básico">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Código da unidade *"><Input value={draft.unit_code || ""} disabled={disabled} onChange={(e) => set("unit_code", e.target.value)} placeholder="ex.: cotinguiba-08" /></Field>
          <Field label="Nome *"><Input value={draft.name || ""} disabled={disabled} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Tipo"><Input value={draft.property_type || ""} disabled={disabled} onChange={(e) => set("property_type", e.target.value)} placeholder="apartamento, casa…" /></Field>
          <Field label="Condomínio"><Input value={draft.condo || ""} disabled={disabled} onChange={(e) => set("condo", e.target.value)} /></Field>
          <Field label="Região"><Input value={draft.region || ""} disabled={disabled} onChange={(e) => set("region", e.target.value)} /></Field>
        </div>
      </Group>

      <Group title="Capacidade">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Hóspedes"><Input type="number" min={0} disabled={disabled} value={draft.max_guests ?? ""} onChange={(e) => set("max_guests", e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="Suítes"><Input type="number" min={0} disabled={disabled} value={draft.suites ?? ""} onChange={(e) => set("suites", e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="Camas"><Input value={draft.beds || ""} disabled={disabled} onChange={(e) => set("beds", e.target.value)} /></Field>
          <Field label="Banheiros"><Input value={draft.bathrooms || ""} disabled={disabled} onChange={(e) => set("bathrooms", e.target.value)} /></Field>
        </div>
      </Group>

      <Group title="Descrição">
        <Field label="Resumo (curto)"><Input value={draft.short_description || ""} disabled={disabled} onChange={(e) => set("short_description", e.target.value)} /></Field>
        <Field label="Descrição completa"><Textarea rows={4} value={draft.description || ""} disabled={disabled} onChange={(e) => set("description", e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChipsField label="Comodidades" value={draft.amenities || []} disabled={disabled} onChange={(v) => set("amenities", v)} />
          <ChipsField label="Regras da casa" value={draft.house_rules || []} disabled={disabled} onChange={(v) => set("house_rules", v)} />
        </div>
      </Group>

      <Group title="Horários e política">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Check-in"><Input value={draft.check_in_time || ""} disabled={disabled} onChange={(e) => set("check_in_time", e.target.value)} placeholder="15:00" /></Field>
          <Field label="Check-out"><Input value={draft.check_out_time || ""} disabled={disabled} onChange={(e) => set("check_out_time", e.target.value)} placeholder="11:00" /></Field>
        </div>
        <Field label="Política de cancelamento"><Textarea rows={2} value={draft.cancellation_policy || ""} disabled={disabled} onChange={(e) => set("cancellation_policy", e.target.value)} /></Field>
      </Group>

      <Group title="Dados privados" hint="Liberados só a hóspede com reserva confirmada (nunca a leads).">
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-700"><Lock size={12} /> Sensível</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Wi-Fi (rede)"><Input value={draft.wifi_ssid || ""} disabled={disabled} onChange={(e) => set("wifi_ssid", e.target.value)} /></Field>
            <Field label="Wi-Fi (senha)"><Input value={draft.wifi_password || ""} disabled={disabled} onChange={(e) => set("wifi_password", e.target.value)} /></Field>
            <Field label="Método de acesso"><Input value={draft.access_method || ""} disabled={disabled} onChange={(e) => set("access_method", e.target.value)} placeholder="fechadura_facial, chaves_portaria…" /></Field>
            <Field label="Código da fechadura"><Input value={draft.door_code || ""} disabled={disabled} onChange={(e) => set("door_code", e.target.value)} /></Field>
            <Field label="Endereço exato"><Input value={draft.exact_address || ""} disabled={disabled} onChange={(e) => set("exact_address", e.target.value)} /></Field>
            <Field label="URL do mapa"><Input value={draft.maps_url || ""} disabled={disabled} onChange={(e) => set("maps_url", e.target.value)} /></Field>
          </div>
          <Field label="Instruções de acesso"><Textarea rows={2} value={draft.access_instructions || ""} disabled={disabled} onChange={(e) => set("access_instructions", e.target.value)} /></Field>
        </div>
      </Group>

      <Group title="Mídia">
        {/* Imagens */}
        <Field label="Imagens">
          <div className="flex flex-wrap gap-2">
            {(draft.image_urls || []).map((url, i) => (
              <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                {!disabled && <button type="button" onClick={() => set("image_urls", (draft.image_urls || []).filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100"><X size={11} /></button>}
              </div>
            ))}
            {!disabled && <UploadButton kind="image" onUploaded={(r) => set("image_urls", [...(draft.image_urls || []), r.url])} />}
          </div>
        </Field>
        {/* Vídeos */}
        <Field label="Vídeos">
          <div className="space-y-1.5">
            {(draft.video_urls || []).map((url, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <a href={url} target="_blank" rel="noreferrer" className="truncate text-brand-600 hover:underline">{url}</a>
                {!disabled && <button type="button" onClick={() => set("video_urls", (draft.video_urls || []).filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500"><X size={13} /></button>}
              </div>
            ))}
            {!disabled && <UploadButton kind="video" onUploaded={(r) => set("video_urls", [...(draft.video_urls || []), r.url])} />}
          </div>
        </Field>
        {/* PDF */}
        <Field label="PDF do guia (privado)">
          <div className="flex items-center gap-3">
            {draft.pdf_path ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-700">
                <FileText size={14} className="text-brand-600" />
                {draft.pdf_url ? <a href={draft.pdf_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Ver PDF atual</a> : "PDF enviado"}
                {!disabled && <button type="button" onClick={() => setDraft({ ...draft, pdf_path: null, pdf_url: null })} className="text-gray-300 hover:text-red-500"><X size={12} /></button>}
              </span>
            ) : <span className="text-xs text-gray-400">Nenhum PDF.</span>}
            {!disabled && <UploadButton kind="pdf" label="Enviar PDF" onUploaded={(r) => setDraft({ ...draft, pdf_path: r.path, pdf_url: r.url })} />}
          </div>
        </Field>
      </Group>

      {canEdit && (
        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          {!isNew ? <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Remover</Button> : <span />}
          <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Salvar</Button>
        </div>
      )}
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Remover guia?" description={`"${draft.name}" será removido permanentemente.`} confirmLabel="Remover" variant="danger" onConfirm={() => { setConfirmDelete(false); remove(); }} />
    </div>
  );
}

// ═══════════════════════════ ARTIGOS ═══════════════════════════
type KbDraft = Partial<KbRow>;
const NEW_ARTICLE: KbDraft = { scope: "region", category: "", title: "", content: "", visibility: "public", tags: [], sort_order: 0, active: true };
const CATEGORIES = ["como_chegar", "checkin", "enxoval", "locomocao", "mercados", "acougues", "restaurantes", "cafe_da_manha", "vida_noturna", "praias", "passeios", "beleza_spa", "imperdiveis", "emergencia", "faq"];

function ArticlesTab({ canEdit }: { canEdit: boolean }) {
  const [articles, setArticles] = useState<KbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<KbDraft | null>(null);

  const load = useCallback(async () => {
    const rows = await api<KbRow[]>("/api/kb/articles");
    setArticles(rows);
    return rows;
  }, []);

  useEffect(() => {
    setLoading(true);
    load().catch((e) => toast({ title: "Erro ao carregar", description: e instanceof Error ? e.message : "", variant: "error" })).finally(() => setLoading(false));
  }, [load]);

  if (loading) return <Centered><Loader2 className="animate-spin" size={20} /></Centered>;

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <ListCard
        title="Artigos"
        canEdit={canEdit}
        onNew={() => { setSelectedId(null); setDraft({ ...NEW_ARTICLE }); }}
        items={articles.map((a) => ({ id: a.id, active: a.active !== false, primary: a.title, secondary: a.category }))}
        selectedId={selectedId}
        onSelect={(id) => { const a = articles.find((x) => x.id === id); if (a) { setSelectedId(id); setDraft({ ...a }); } }}
        emptyLabel="Nenhum artigo ainda."
      />
      <div>
        {draft ? (
          <ArticleEditor
            key={selectedId ?? "new"}
            draft={draft}
            setDraft={setDraft}
            isNew={!selectedId}
            canEdit={canEdit}
            onSaved={async (saved) => { const rows = await load(); setSelectedId(saved.id); setDraft(rows.find((x) => x.id === saved.id) ?? null); }}
            onDeleted={async () => { await load(); setSelectedId(null); setDraft(null); }}
          />
        ) : <EmptyEditor>Selecione um artigo ou crie um novo.</EmptyEditor>}
      </div>
    </div>
  );
}

function ArticleEditor({ draft, setDraft, isNew, canEdit, onSaved, onDeleted }: {
  draft: KbDraft; setDraft: (d: KbDraft) => void; isNew: boolean; canEdit: boolean;
  onSaved: (s: KbRow) => Promise<void>; onDeleted: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof KbRow>(k: K, v: KbRow[K]) => setDraft({ ...draft, [k]: v });
  const disabled = !canEdit;

  async function save() {
    if (!canEdit || busy) return;
    if (!draft.title?.trim() || !draft.category?.trim()) { toast({ title: "Título e categoria são obrigatórios", variant: "error" }); return; }
    setBusy(true);
    try {
      const payload = { ...draft };
      ["id", "company_id", "created_at", "updated_at"].forEach((k) => delete (payload as Record<string, unknown>)[k]);
      const saved = isNew
        ? await api<KbRow>("/api/kb/articles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await api<KbRow>(`/api/kb/articles/${draft.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      toast({ title: "Artigo salvo", variant: "success" });
      await onSaved(saved);
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!draft.id) return;
    try { await api(`/api/kb/articles/${draft.id}`, { method: "DELETE" }); toast({ title: "Artigo removido", variant: "success" }); await onDeleted(); }
    catch (e) { toast({ title: "Não foi possível remover", description: e instanceof Error ? e.message : "", variant: "error" }); }
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">{isNew ? "Novo artigo" : draft.title}</h3>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" disabled={disabled} checked={draft.active !== false} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4 accent-brand-500" /> Ativo
        </label>
      </div>
      <Field label="Título *"><Input value={draft.title || ""} disabled={disabled} onChange={(e) => set("title", e.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Categoria *">
          <Input list="kb-cats" value={draft.category || ""} disabled={disabled} onChange={(e) => set("category", e.target.value)} placeholder="faq, restaurantes…" />
          <datalist id="kb-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Escopo">
          <Select value={draft.scope || "region"} disabled={disabled} onChange={(e) => set("scope", e.target.value as KbRow["scope"])}>
            <option value="region">Região</option>
            <option value="unit">Unidade</option>
            <option value="company">Empresa</option>
          </Select>
        </Field>
        <Field label="Visibilidade">
          <Select value={draft.visibility || "public"} disabled={disabled} onChange={(e) => set("visibility", e.target.value as KbRow["visibility"])}>
            <option value="public">Pública (leads)</option>
            <option value="confirmed_guest">Só hóspede confirmado</option>
          </Select>
        </Field>
      </div>
      <Field label="Conteúdo"><Textarea rows={8} value={draft.content || ""} disabled={disabled} onChange={(e) => set("content", e.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <ChipsField label="Tags" value={draft.tags || []} disabled={disabled} onChange={(v) => set("tags", v)} />
        <Field label="Ordem"><Input type="number" disabled={disabled} value={draft.sort_order ?? 0} onChange={(e) => set("sort_order", Number(e.target.value))} /></Field>
      </div>

      {canEdit && (
        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          {!isNew ? <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Remover</Button> : <span />}
          <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Salvar</Button>
        </div>
      )}
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Remover artigo?" description={`"${draft.title}" será removido permanentemente.`} confirmLabel="Remover" variant="danger" onConfirm={() => { setConfirmDelete(false); remove(); }} />
    </div>
  );
}

// ═══════════════════════════ COMPARTILHADOS ═══════════════════════════
function ListCard({ title, canEdit, onNew, items, selectedId, onSelect, emptyLabel }: {
  title: string; canEdit: boolean; onNew: () => void;
  items: { id: string; active: boolean; primary: string; secondary?: string | null }[];
  selectedId: string | null; onSelect: (id: string) => void; emptyLabel: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {canEdit && <button type="button" onClick={onNew} className="rounded-lg bg-brand-500 p-1.5 text-white hover:bg-brand-600"><Plus size={15} /></button>}
      </div>
      <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
        {items.map((it) => (
          <li key={it.id}>
            <button type="button" onClick={() => onSelect(it.id)} className={cn("flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left", selectedId === it.id ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-gray-50")}>
              <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", it.active ? "bg-emerald-500" : "bg-gray-300")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-800">{it.primary || "—"}</span>
                {it.secondary && <span className="block truncate text-[11px] text-gray-400">{it.secondary}</span>}
              </span>
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="px-2 py-6 text-center text-xs text-gray-400">{emptyLabel}</li>}
      </ul>
    </div>
  );
}

function UploadButton({ kind, label, onUploaded }: { kind: UploadKind; label?: string; onUploaded: (r: { url: string; path: string }) => void }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const accept = kind === "image" ? "image/*" : kind === "video" ? "video/*" : "application/pdf";

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const res = await api<{ url: string; path: string }>("/api/kb/upload", { method: "POST", body: fd });
      onUploaded(res);
      toast({ title: "Arquivo enviado", variant: "success" });
    } catch (err) {
      toast({ title: "Falha no upload", description: err instanceof Error ? err.message : "", variant: "error" });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-600 hover:border-brand-300 hover:bg-brand-50/40", kind === "image" && "h-20 w-20 justify-center border-solid")}>
      {busy ? <Loader2 className="animate-spin" size={kind === "image" ? 18 : 14} /> : <Upload size={kind === "image" ? 18 : 14} />}
      {kind !== "image" && <span>{label || "Enviar"}</span>}
      <input ref={inputRef} type="file" accept={accept} hidden onChange={handle} />
    </label>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center py-16 text-gray-400">{children}</div>;
}
function EmptyEditor({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">{children}</div>;
}
function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h4>
        {hint && <span className="text-[11px] text-gray-400">· {hint}</span>}
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}
function ChipsField({ label, value, disabled, onChange }: { label: string; value: string[]; disabled: boolean; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  function add() { const v = text.trim(); if (!v) return; if (!value.includes(v)) onChange([...value, v]); setText(""); }
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5">
        {value.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
            {v}
            {!disabled && <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="opacity-50 hover:opacity-100"><X size={11} /></button>}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="mt-1.5 flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="adicionar e Enter" />
          <Button variant="secondary" size="sm" onClick={add}><Plus size={14} /></Button>
        </div>
      )}
    </Field>
  );
}
