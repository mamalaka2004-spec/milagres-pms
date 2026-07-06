import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TEMPLATE_ID } from "@/lib/site/templates";

/**
 * Configuração do site/landing (#28). Persistida em `site_settings` (migration
 * 035). Enquanto a migration não for aplicada, tudo degrada de forma graciosa:
 * a leitura devolve defaults e a gravação sinaliza que a migration é necessária.
 */
export interface SiteSettings {
  company_id: string;
  site_title: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  whatsapp_number: string | null;
  contact_email: string | null;
  template: string;
  primary_color: string | null;
  published: boolean;
  meta: Record<string, unknown>;
}

export type SiteSettingsInput = Partial<Omit<SiteSettings, "company_id">>;

function defaults(companyId: string): SiteSettings {
  return {
    company_id: companyId,
    site_title: null,
    hero_title: null,
    hero_subtitle: null,
    whatsapp_number: null,
    contact_email: null,
    template: DEFAULT_TEMPLATE_ID,
    primary_color: null,
    published: false,
    meta: {},
  };
}

/** Erro de tabela inexistente do Postgres — a migration 035 ainda não rodou. */
function isMissingTable(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "42P01";
}

/**
 * Lê a config do site da empresa. NUNCA lança: se a tabela não existe (migration
 * 035 pendente) ou não há linha, devolve os defaults. Assim a aba Site funciona
 * como shell mesmo antes de aplicar a migration.
 */
export async function getSiteSettings(companyId: string): Promise<SiteSettings> {
  try {
    // Cast: `site_settings` ainda não está nos tipos gerados do Supabase.
    const supabase = createAdminClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (error) {
      if (isMissingTable(error)) return defaults(companyId);
      throw error;
    }
    if (!data) return defaults(companyId);
    return { ...defaults(companyId), ...data } as SiteSettings;
  } catch (err) {
    if (isMissingTable(err)) return defaults(companyId);
    console.error("[site] getSiteSettings failed:", err);
    return defaults(companyId);
  }
}

/**
 * Cria/atualiza (upsert) a config do site. Lança um erro CLARO quando a tabela
 * não existe, para a API responder "aplique a migration 035".
 */
export async function upsertSiteSettings(
  companyId: string,
  input: SiteSettingsInput
): Promise<SiteSettings> {
  const supabase = createAdminClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const payload = { company_id: companyId, ...input, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from("site_settings")
    .upsert(payload, { onConflict: "company_id" })
    .select()
    .single();

  if (error) {
    if (isMissingTable(error)) {
      throw new Error(
        "A tabela site_settings ainda não existe. Aplique a migration 035_site_settings.sql para salvar as configurações do site."
      );
    }
    throw error;
  }
  return { ...defaults(companyId), ...data } as SiteSettings;
}
