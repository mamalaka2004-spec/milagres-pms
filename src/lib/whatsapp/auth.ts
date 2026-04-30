import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, WaBusinessHours } from "@/types/database";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type LineRow = Database["public"]["Tables"]["whatsapp_lines"]["Row"];

/** True if the user has explicit access (or is admin/manager of the line's company). */
export async function userCanAccessLine(user: UserRow, lineId: string): Promise<boolean> {
  if (user.role === "admin" || user.role === "manager") {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("whatsapp_lines")
      .select("company_id")
      .eq("id", lineId)
      .maybeSingle();
    const line = data as { company_id: string } | null;
    return !!line && line.company_id === user.company_id;
  }
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("whatsapp_line_users")
    .select("user_id")
    .eq("line_id", lineId)
    .eq("user_id", user.id)
    .maybeSingle();
  return !!data;
}

export async function requireLineAccess(user: UserRow, lineId: string): Promise<LineRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_lines")
    .select("*")
    .eq("id", lineId)
    .maybeSingle();
  if (error) throw error;
  const line = data as LineRow | null;
  if (!line) throw new Error("LineNotFound");
  if (line.company_id !== user.company_id) throw new Error("Forbidden");

  if (user.role !== "admin" && user.role !== "manager") {
    const { data: grant } = await supabase
      .from("whatsapp_line_users")
      .select("user_id")
      .eq("line_id", lineId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!grant) throw new Error("Forbidden");
  }
  return line;
}

/**
 * Returns true when `now` falls outside the configured business hours, in the
 * given IANA timezone. If `hours` is null we treat the schedule as undefined →
 * return false (the caller should not auto-reply when no schedule is set).
 */
export function isOutsideBusinessHours(
  hours: WaBusinessHours | null | undefined,
  now: Date = new Date(),
  timezone: string = "America/Maceio"
): boolean {
  if (!hours) return false;
  // Render local day-of-week + HH:mm in the company timezone.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value.toLowerCase() ?? "mon";
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  const dayKey = wd.slice(0, 3) as keyof WaBusinessHours;
  const slot = hours[dayKey];
  if (!slot) return true; // closed all day
  const nowHM = `${hh}:${mm}`;
  return nowHM < slot.open || nowHM >= slot.close;
}
