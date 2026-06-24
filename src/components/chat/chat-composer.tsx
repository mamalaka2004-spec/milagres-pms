"use client";

import { useRef, useState } from "react";
import { Send, Loader2, AlertCircle, Paperclip, Mic, Trash2, X, Sparkles, FileText } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { AiAssistBar } from "@/components/chat/ai-assist-bar";
import { ComposerTools } from "@/components/chat/composer-tools";

interface ApiResp<T> { success: boolean; data?: T; error?: string }
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = (await res.json()) as ApiResp<T>;
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data as T;
}

const ATTACH_ACCEPT =
  "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";

interface PendingMedia {
  file: File;
  previewUrl: string;
  kind: "image" | "video" | "audio" | "document";
}

function kindOf(file: File): PendingMedia["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}

function fmtSecs(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Shared chat composer (Reservas + Vendas): text, quick-replies/variables/emoji,
 * file/media attachment, and native audio recording. Uploads media to
 * /api/whatsapp/media then posts the message (Evolution fetches the public URL).
 */
export function ChatComposer({
  conversationId,
  purpose,
  accent,
  contactName,
  contactPhone,
  aiActive = false,
  onSent,
}: {
  conversationId: string;
  purpose: "booking" | "sales";
  accent: "brand" | "amber";
  contactName: string | null;
  contactPhone: string;
  aiActive?: boolean;
  onSent: () => void;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<PendingMedia | null>(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRef = useRef(false);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sendBtn = accent === "amber"
    ? "bg-amber-600 hover:bg-amber-700"
    : "bg-brand-500 hover:bg-brand-600";
  const focusRing = accent === "amber" ? "focus:border-amber-500 focus-visible:ring-amber-400/40" : "focus:border-brand-500 focus-visible:ring-brand-400/40";

  function pickFile(f: File | null) {
    if (!f) return;
    if (f.size > 16 * 1024 * 1024) { setErr("Arquivo muito grande (máx. 16MB)."); return; }
    setErr(null);
    setPending({ file: f, previewUrl: URL.createObjectURL(f), kind: kindOf(f) });
  }

  function clearPending() {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
  }

  async function uploadAndPost(file: File, caption?: string) {
    const fd = new FormData();
    fd.append("file", file);
    const up = await api<{ url: string; mime: string; name: string }>("/api/whatsapp/media", { method: "POST", body: fd });
    await api(`/api/whatsapp/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_url: up.url, media_mime_type: up.mime, file_name: up.name, text: caption?.trim() || undefined }),
    });
  }

  const send = async () => {
    if (sending || recording) return;
    if (!text.trim() && !pending) return;
    setSending(true); setErr(null);
    try {
      if (pending) {
        await uploadAndPost(pending.file, text);
        clearPending();
      } else {
        await api(`/api/whatsapp/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        });
      }
      setText("");
      onSent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  // ── Audio recording ──
  const startRecording = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      cancelRef.current = false;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        const secs = recSecs;
        setRecording(false);
        setRecSecs(0);
        if (cancelRef.current || chunksRef.current.length === 0) return;
        const mime = rec.mimeType || "audio/webm";
        const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: mime });
        setSending(true);
        try {
          await uploadAndPost(file);
          onSent();
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Falha ao enviar áudio");
        } finally {
          setSending(false);
        }
        void secs;
      };
      rec.start();
      setRecording(true);
      setRecSecs(0);
      timerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
    } catch {
      setErr("Não foi possível acessar o microfone.");
    }
  };

  const stopRecording = (cancel: boolean) => {
    cancelRef.current = cancel;
    recorderRef.current?.stop();
  };

  const canSend = (!!text.trim() || !!pending) && !sending;

  return (
    <div className="p-3 border-t border-gray-100 bg-white shrink-0">
      {err && <div className="text-xs text-red-500 mb-2 flex items-center gap-1"><AlertCircle size={12} aria-hidden="true" /> {err}</div>}

      {aiActive && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mb-2 flex items-center gap-2">
          <Sparkles size={12} aria-hidden="true" /> IA ativa nesta conversa. Pause (no painel) antes de responder manualmente, pra não enviar duas respostas.
        </div>
      )}

      <AiAssistBar conversationId={conversationId} purpose={purpose} accent={accent} onInsert={(t) => setText((prev) => (prev.trim() ? prev + "\n" + t : t))} />

      {/* Pending media preview */}
      {pending && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-2">
          {pending.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pending.previewUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
          ) : pending.kind === "video" ? (
            <video src={pending.previewUrl} className="w-12 h-12 rounded-lg object-cover bg-black/10" />
          ) : (
            <span className="w-12 h-12 rounded-lg bg-gray-200 text-gray-500 flex items-center justify-center"><FileText size={18} aria-hidden="true" /></span>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-gray-800 truncate">{pending.file.name}</div>
            <div className="text-[10px] text-gray-400">{(pending.file.size / 1024).toFixed(0)} KB · adicione uma legenda abaixo</div>
          </div>
          <button onClick={clearPending} aria-label="Remover anexo" className="text-gray-400 hover:text-rose-600 p-1 rounded hover:bg-gray-100 transition-colors duration-150">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {recording ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-sm font-medium text-rose-700 tabular-nums">{fmtSecs(recSecs)}</span>
          <span className="text-xs text-rose-600/70 flex-1">Gravando áudio…</span>
          <button onClick={() => stopRecording(true)} aria-label="Cancelar gravação" className="text-rose-500 hover:text-rose-700 p-1.5 rounded-full hover:bg-rose-100 transition-colors duration-150">
            <Trash2 size={16} aria-hidden="true" />
          </button>
          <button onClick={() => stopRecording(false)} aria-label="Enviar áudio" className={cn("text-white h-9 w-9 flex items-center justify-center rounded-full transition-colors duration-150", sendBtn)}>
            <Send size={15} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2 items-end">
          <ComposerTools accent={accent} onInsert={(t) => setText((prev) => prev + t)} variables={{ nome: contactName, empresa: "Milagres Hospedagens", telefone: contactPhone }} />

          <input ref={fileRef} type="file" accept={ATTACH_ACCEPT} className="hidden" onChange={(e) => { pickFile(e.target.files?.[0] || null); if (fileRef.current) fileRef.current.value = ""; }} />
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Anexar arquivo" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 shrink-0">
            <Paperclip size={18} aria-hidden="true" />
          </button>

          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            aria-label="Digite uma mensagem"
            placeholder={pending ? "Legenda (opcional)…" : "Mensagem… (Enter envia · Shift+Enter quebra linha)"}
            rows={1}
            className={cn("flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm transition-colors duration-200 focus:outline-none focus:bg-white focus-visible:ring-2 max-h-36 overflow-y-auto", focusRing)}
          />

          {canSend ? (
            <button onClick={send} aria-label="Enviar" disabled={sending} className={cn("text-white h-10 w-10 flex items-center justify-center rounded-full transition-colors duration-200 shrink-0 disabled:bg-gray-200 disabled:text-gray-400", sendBtn)}>
              {sending ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
            </button>
          ) : (
            <button onClick={startRecording} aria-label="Gravar áudio" disabled={sending} className="bg-gray-100 hover:bg-gray-200 text-gray-600 h-10 w-10 flex items-center justify-center rounded-full transition-colors duration-200 shrink-0 disabled:opacity-50">
              <Mic size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
