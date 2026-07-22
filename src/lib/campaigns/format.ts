// Formatação de datas do painel de campanhas (pt-BR, fuso do navegador).

/** "hoje 14:32" · "amanhã 09:15" · "sex 25/07 09:15" */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay(d, now)) return `hoje ${hora}`;
  if (sameDay(d, tomorrow)) return `amanhã ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })} ${hora}`;
}

/** "em 3 min" · "em 2 h" · "em 2 dias" · "agora" (passado → "atrasado"). */
export function formatCountdown(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (isNaN(diff)) return null;
  if (diff <= 0) return "a qualquer momento";
  const min = Math.round(diff / 60_000);
  if (min < 1) return "em menos de 1 min";
  if (min < 60) return `em ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `em ${h} h`;
  return `em ${Math.round(h / 24)} dia(s)`;
}

/** Espera do passo em texto curto: 48 → "2 dias"; 3 → "3 h". */
export function formatWait(hours: number): string {
  if (!hours) return "imediato";
  if (hours < 24) return `${hours} h`;
  const d = hours / 24;
  return `${Number.isInteger(d) ? d : d.toFixed(1)} dia(s)`;
}
