// Shared chat helpers — used by both Chat Reservas (whatsapp-shell) and
// Chat Vendas (sales-shell). Extracted to remove duplication.

export interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = (await res.json()) as ApiResp<T>;
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data as T;
}

/** Relative time for conversation lists (today → HH:mm, Ontem, weekday, date). */
export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  if (today.getTime() - d.getTime() < 7 * 86_400_000) {
    return d.toLocaleDateString("pt-BR", { weekday: "short" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Absolute HH:mm for message timestamps. */
export function formatTimeFull(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
