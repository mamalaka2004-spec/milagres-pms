/**
 * Builds the automatic "welcome / guest onboarding" WhatsApp message that the
 * auto-dispatch job sends to a CONFIRMED guest ~1 day before check-in.
 *
 * This is a deterministic template (no AI) so the content is predictable and safe
 * to send proactively even while the reactive AI auto-reply is still off.
 */

export function firstName(full?: string | null): string {
  if (!full) return "";
  return full.trim().split(/\s+/)[0] || "";
}

function fmtDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [, m, d] = parts;
  return `${d}/${m}`;
}

export interface WelcomeParts {
  guestName?: string | null;
  companyName: string;
  unitName?: string | null;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  checkInTime?: string | null;
  checkOutTime?: string | null;
  /** Private fields — only included when `includeAccess` is true (guide matched). */
  wifiSsid?: string | null;
  wifiPassword?: string | null;
  accessInstructions?: string | null;
  exactAddress?: string | null;
  mapsUrl?: string | null;
  guidePdfUrl?: string | null;
  includeAccess: boolean;
}

export function buildWelcomeMessage(p: WelcomeParts): string {
  const hi = p.guestName ? `Olá, ${firstName(p.guestName)}! ` : "Olá! ";
  const lines: string[] = [];
  lines.push(`${hi}👋 Aqui é a *${p.companyName}*.`);
  lines.push("");
  lines.push("Sua reserva está *confirmada*! 🎉");
  if (p.unitName) lines.push(`🏠 ${p.unitName}`);
  const ci = `${fmtDate(p.checkIn)}${p.checkInTime ? " a partir das " + p.checkInTime : ""}`;
  const co = `${fmtDate(p.checkOut)}${p.checkOutTime ? " às " + p.checkOutTime : ""}`;
  lines.push(`📅 Check-in ${ci} • Check-out ${co}`);

  if (p.includeAccess) {
    lines.push("");
    if (p.wifiSsid) {
      lines.push(`📶 Wi-Fi: *${p.wifiSsid}*${p.wifiPassword ? ` — senha: *${p.wifiPassword}*` : ""}`);
    }
    if (p.accessInstructions) lines.push(`🔑 ${p.accessInstructions}`);
    if (p.exactAddress) lines.push(`📍 ${p.exactAddress}`);
    if (p.mapsUrl) lines.push(`🗺️ ${p.mapsUrl}`);
  } else {
    lines.push("");
    lines.push(
      "📍 A localização exata, o Wi-Fi e as instruções de acesso serão enviados por aqui pela nossa equipe antes do seu check-in."
    );
  }

  if (p.guidePdfUrl) {
    lines.push("");
    lines.push(
      `📖 Guia completo da casa e da região (o que fazer, restaurantes, praias): ${p.guidePdfUrl}`
    );
  }

  lines.push("");
  lines.push("Qualquer dúvida, é só chamar por aqui. Tenha uma ótima estadia! 🌅");
  return lines.join("\n");
}
