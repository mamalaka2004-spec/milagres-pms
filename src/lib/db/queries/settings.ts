import { createAdminClient } from "@/lib/supabase/admin";
import {
  AUTOMATION_SETTING_KEY,
  RETENTION_SETTING_KEY,
  DEFAULT_AUTOMATION,
  DEFAULT_RETENTION,
  automationSettingsSchema,
  retentionSettingsSchema,
  type AutomationSettings,
  type RetentionSettings,
} from "@/lib/validations/operations";

/** Lê um valor da tabela settings (key/value JSONB por empresa). null = nunca configurado. */
export async function getSetting<T>(companyId: string, key: string): Promise<T | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("company_id", companyId)
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data ? ((data as { value: T }).value ?? null) : null;
}

export async function upsertSetting(
  companyId: string,
  key: string,
  value: unknown,
  category?: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await (supabase.from("settings") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .upsert(
      { company_id: companyId, key, value, category: category ?? null },
      { onConflict: "company_id,key" }
    );
  if (error) throw error;
}

/** Config de auto-agendamento com defaults (empresa sem registro usa o padrão). */
export async function getAutomationSettings(companyId: string): Promise<AutomationSettings> {
  const raw = await getSetting<AutomationSettings>(companyId, AUTOMATION_SETTING_KEY);
  const parsed = automationSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_AUTOMATION;
}

/** Config de retenção de storage com defaults. */
export async function getRetentionSettings(companyId: string): Promise<RetentionSettings> {
  const raw = await getSetting<RetentionSettings>(companyId, RETENTION_SETTING_KEY);
  const parsed = retentionSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_RETENTION;
}
