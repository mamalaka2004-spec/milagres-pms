import { createAdminClient } from "@/lib/supabase/admin";
import {
  NOTIFICATION_TYPES,
  type NotificationType,
} from "@/lib/notifications/types";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ListNotificationsResult {
  items: NotificationItem[];
  unread: number;
}

/** Lista as notificações do usuário (mais recentes primeiro) + contador de não-lidas. */
export async function listNotifications(
  userId: string,
  opts: { limit?: number; before?: string } = {}
): Promise<ListNotificationsResult> {
  const supabase = createAdminClient();
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);

  let query = supabase
    .from("notifications")
    .select("id, type, title, body, entity_type, entity_id, link, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.before) query = query.lt("created_at", opts.before);

  const [{ data, error }, unread] = await Promise.all([
    query,
    countUnreadNotifications(userId),
  ]);
  if (error) throw error;

  return { items: (data as NotificationItem[]) ?? [], unread };
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

/** Marca uma (id) ou todas as notificações do usuário como lidas. Retorna o novo total não-lido. */
export async function markNotificationsRead(
  userId: string,
  opts: { id?: string; all?: boolean }
): Promise<number> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  let query = (supabase.from("notifications") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update({ read_at: now })
    .eq("user_id", userId)
    .is("read_at", null);
  if (!opts.all && opts.id) query = query.eq("id", opts.id);
  const { error } = await query;
  if (error) throw error;
  return countUnreadNotifications(userId);
}

// ─── Preferências ───────────────────────────────────────────────────────────

/** Retorna, por tipo, se as notificações in-app estão ligadas (default = ligado). */
export async function getNotificationPreferences(
  userId: string
): Promise<Record<NotificationType, boolean>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("type, in_app")
    .eq("user_id", userId);
  if (error) throw error;

  const prefs = Object.fromEntries(
    NOTIFICATION_TYPES.map((t) => [t, true])
  ) as Record<NotificationType, boolean>;
  for (const row of (data as { type: NotificationType; in_app: boolean }[]) ?? []) {
    if (row.type in prefs) prefs[row.type] = row.in_app;
  }
  return prefs;
}

/** Upsert de uma preferência (usuário, tipo). */
export async function setNotificationPreference(
  companyId: string,
  userId: string,
  type: NotificationType,
  inApp: boolean
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await (supabase.from("notification_preferences") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .upsert(
      { company_id: companyId, user_id: userId, type, in_app: inApp },
      { onConflict: "user_id,type" }
    );
  if (error) throw error;
}
