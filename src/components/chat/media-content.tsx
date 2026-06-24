import { FileText, Download } from "lucide-react";

type MediaType = "text" | "image" | "audio" | "video" | "document" | "note" | "status";

/**
 * Renders the media part of a chat message (image / video / audio / document).
 * Used by both the Reservas and Vendas message bubbles. Text/caption is rendered
 * by the bubble itself, alongside this.
 */
export function MediaContent({
  type,
  url,
  mime,
  fileName,
  tone = "neutral",
}: {
  type: MediaType;
  url: string | null;
  mime?: string | null;
  fileName?: string | null;
  tone?: "neutral" | "sent"; // "sent" = on a colored outgoing bubble
}) {
  if (!url) return null;

  if (type === "image") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mb-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={fileName || "imagem"} loading="lazy" className="rounded-lg max-h-64 w-auto object-cover" />
      </a>
    );
  }

  if (type === "video") {
    return (
      <video src={url} controls preload="metadata" className="rounded-lg mb-1 max-h-64 w-full bg-black/5" />
    );
  }

  if (type === "audio") {
    return <audio src={url} controls preload="metadata" className="mb-1 w-56 max-w-full" />;
  }

  // document (or any other) → download chip
  const chipBg = tone === "sent" ? "bg-white/15 hover:bg-white/25" : "bg-gray-100 hover:bg-gray-200";
  const iconWrap = tone === "sent" ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600";
  const nameColor = tone === "sent" ? "text-white" : "text-gray-800";
  const subColor = tone === "sent" ? "text-white/70" : "text-gray-400";
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2.5 mb-1 px-3 py-2 rounded-lg min-w-[200px] transition-colors duration-150 ${chipBg}`}
    >
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconWrap}`}>
        <FileText size={16} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-xs font-medium truncate ${nameColor}`}>{fileName || "Documento"}</span>
        <span className={`block text-[10px] ${subColor}`}>{(mime || "arquivo").split("/")[1] || "arquivo"}</span>
      </span>
      <Download size={14} className={`shrink-0 ${subColor}`} aria-hidden="true" />
    </a>
  );
}
