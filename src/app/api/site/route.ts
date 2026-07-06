import { requireRole } from "@/lib/auth";
import { getSiteSettings, upsertSiteSettings, type SiteSettingsInput } from "@/lib/db/queries/site";
import { SITE_TEMPLATES } from "@/lib/site/templates";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";

/** Site → configuração da landing pública (#28 / #29). Somente admin/gerente. */
export async function GET() {
  try {
    const user = await requireRole(["admin", "manager"]);
    const settings = await getSiteSettings(user.company_id);
    return apiSuccess(settings);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

function str(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

export async function PUT(request: Request) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const body = await request.json().catch(() => ({}));

    const templateId = str(body.template);
    const template =
      templateId && SITE_TEMPLATES.some((t) => t.id === templateId && t.available)
        ? templateId
        : "sage";

    const input: SiteSettingsInput = {
      site_title: str(body.site_title, 120),
      hero_title: str(body.hero_title, 160),
      hero_subtitle: str(body.hero_subtitle, 300),
      whatsapp_number: str(body.whatsapp_number, 30),
      contact_email: str(body.contact_email, 160),
      template,
      published: Boolean(body.published),
    };

    let settings;
    try {
      settings = await upsertSiteSettings(user.company_id, input);
    } catch (err) {
      // Tabela ausente (migration 035 pendente) → 400 com mensagem clara.
      if (err instanceof Error && err.message.includes("site_settings")) {
        return apiError(err.message, 400);
      }
      throw err;
    }

    await logActivity({
      user,
      action: "site.settings.update",
      entityType: "site",
      details: { template: settings.template, published: settings.published },
    });

    return apiSuccess(settings);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
