import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export interface ActivityLogItem {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Json | null;
  ip_address: string | null;
  created_at: string;
  user: { full_name: string; email: string | null } | null;
}

export interface ActivityLogFilters {
  /** Filter by entity family (e.g. "reservation"). */
  entityType?: string;
  /** Filter by the acting user. */
  userId?: string;
  /** Page size (default 40). */
  limit?: number;
  /** Cursor: only rows strictly older than this ISO timestamp. */
  before?: string;
}

export async function getActivityLogs(
  companyId: string,
  filters: ActivityLogFilters = {}
): Promise<ActivityLogItem[]> {
  const supabase = createAdminClient();
  const limit = Math.min(Math.max(filters.limit ?? 40, 1), 100);

  let query = supabase
    .from("activity_logs")
    .select("id, action, entity_type, entity_id, details, ip_address, created_at, user:users(full_name, email)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.before) query = query.lt("created_at", filters.before);

  const { data, error } = await query;
  if (error) throw error;

  type Row = Omit<ActivityLogItem, "user"> & {
    user: { full_name: string; email: string | null } | { full_name: string; email: string | null }[] | null;
  };
  return ((data as unknown as Row[]) ?? []).map((r) => ({
    ...r,
    user: Array.isArray(r.user) ? r.user[0] ?? null : r.user,
  }));
}

/** Distinct entity types present in the log (for the filter dropdown). */
export async function getActivityEntityTypes(companyId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("activity_logs")
    .select("entity_type")
    .eq("company_id", companyId)
    .not("entity_type", "is", null)
    .limit(1000);
  if (error) throw error;
  const set = new Set<string>();
  for (const row of (data as { entity_type: string | null }[]) ?? []) {
    if (row.entity_type) set.add(row.entity_type);
  }
  return Array.from(set).sort();
}
