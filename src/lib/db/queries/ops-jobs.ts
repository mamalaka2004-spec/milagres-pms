import { createAdminClient } from "@/lib/supabase/admin";
import { getAutomationSettings, getRetentionSettings } from "@/lib/db/queries/settings";
import { ensureReservationTask, type AutomationReservation } from "@/lib/db/queries/tasks";

// ─── Retenção de storage (#14): apaga mídia de tarefas concluídas há mais de N dias ───

export interface RetentionResult {
  company_id: string;
  enabled: boolean;
  days: number;
  scanned: number;
  removed: number;
  storage_errors: number;
}

/** Extrai bucket+path de uma URL pública do Supabase Storage (linhas legadas sem storage_path). */
export function parseStoragePublicUrl(url: string): { bucket: string; path: string } | null {
  const marker = "/storage/v1/object/public/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rest = url.slice(idx + marker.length);
  const slash = rest.indexOf("/");
  if (slash === -1) return null;
  return { bucket: rest.slice(0, slash), path: decodeURIComponent(rest.slice(slash + 1)) };
}

interface RetentionPhotoRow {
  id: string;
  url: string;
  storage_bucket: string | null;
  storage_path: string | null;
}

/** Roda a retenção para UMA empresa. Batch de até 500 mídias por execução. */
export async function runRetentionForCompany(companyId: string): Promise<RetentionResult> {
  const cfg = await getRetentionSettings(companyId);
  const result: RetentionResult = {
    company_id: companyId,
    enabled: cfg.enabled,
    days: cfg.days,
    scanned: 0,
    removed: 0,
    storage_errors: 0,
  };
  if (!cfg.enabled) return result;

  const cutoff = new Date(Date.now() - cfg.days * 86400000).toISOString();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("task_photos")
    .select("id, url, storage_bucket, storage_path, task:housekeeping_tasks!inner(id, status, completed_at)")
    .eq("company_id", companyId)
    .eq("task.status", "completed")
    .lt("task.completed_at", cutoff)
    .limit(500);
  if (error) throw error;

  const photos = (data as unknown as RetentionPhotoRow[]) || [];
  result.scanned = photos.length;
  if (photos.length === 0) return result;

  // Agrupa objetos por bucket para remover em lote.
  const byBucket = new Map<string, string[]>();
  for (const p of photos) {
    const loc =
      p.storage_bucket && p.storage_path
        ? { bucket: p.storage_bucket, path: p.storage_path }
        : parseStoragePublicUrl(p.url);
    if (!loc) continue;
    const list = byBucket.get(loc.bucket) ?? [];
    list.push(loc.path);
    byBucket.set(loc.bucket, list);
  }
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += 100) {
      const { error: rmErr } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (rmErr) result.storage_errors += 1;
    }
  }

  const ids = photos.map((p) => p.id);
  const { error: delErr } = await supabase.from("task_photos").delete().in("id", ids);
  if (delErr) throw delErr;
  result.removed = ids.length;
  return result;
}

// ─── Varredura de automação: garante tarefas p/ reservas dos próximos dias ───
// Rede de segurança do cron (n8n): cobre reservas criadas antes da Fase 6,
// datas alteradas fora do fluxo e casos em que o hook falhou.

export interface AutomationSweepResult {
  companies: number;
  checkin_prep_created: number;
  checkout_clean_created: number;
}

interface SweepReservationRow extends AutomationReservation {
  status: string;
}

export async function runAutomationSweep(daysAhead = 7): Promise<AutomationSweepResult> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, company_id, property_id, status, check_in_date, check_out_date, property:properties (check_in_time, check_out_time)"
    )
    .in("status", ["confirmed", "checked_in"])
    .is("deleted_at", null)
    .or(
      `and(check_in_date.gte.${today},check_in_date.lte.${horizon}),and(check_out_date.gte.${today},check_out_date.lte.${horizon})`
    )
    .limit(2000);
  if (error) throw error;

  const reservations = (data as unknown as SweepReservationRow[]) || [];
  const settingsCache = new Map<string, Awaited<ReturnType<typeof getAutomationSettings>>>();
  const result: AutomationSweepResult = {
    companies: 0,
    checkin_prep_created: 0,
    checkout_clean_created: 0,
  };

  for (const r of reservations) {
    let settings = settingsCache.get(r.company_id);
    if (!settings) {
      settings = await getAutomationSettings(r.company_id);
      settingsCache.set(r.company_id, settings);
    }
    // Preparo pré-check-in: só faz sentido antes do hóspede entrar.
    if (r.status === "confirmed" && r.check_in_date >= today && r.check_in_date <= horizon) {
      const res = await ensureReservationTask(r, "checkin_prep", settings).catch(() => null);
      if (res && !("skipped" in res)) result.checkin_prep_created += 1;
    }
    // Limpeza pós-checkout: agendada com antecedência para planejamento.
    if (r.check_out_date >= today && r.check_out_date <= horizon) {
      const res = await ensureReservationTask(r, "checkout_clean", settings).catch(() => null);
      if (res && !("skipped" in res)) result.checkout_clean_created += 1;
    }
  }
  result.companies = settingsCache.size;
  return result;
}

/** Lista os IDs de todas as empresas (para o job global de retenção). */
export async function listCompanyIds(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("companies").select("id");
  if (error) throw error;
  return ((data as { id: string }[]) || []).map((c) => c.id);
}
