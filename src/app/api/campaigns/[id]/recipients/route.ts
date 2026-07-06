import { NextRequest } from "next/server";
import { requireFullAccess, requireRole } from "@/lib/auth";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import {
  getCampaign,
  listRecipients,
  addRecipientsFromContacts,
  addRecipientsFromPhones,
  removeRecipient,
  clearRecipients,
} from "@/lib/db/queries/campaign";
import { getContactsByIds } from "@/lib/db/queries/contacts";
import { addRecipientsSchema } from "@/lib/validations/campaign";

type Params = { params: Promise<{ id: string }> };

async function ownCampaign(id: string, companyId: string) {
  const campaign = await getCampaign(id);
  if (!campaign) return { error: "notfound" as const };
  if (campaign.company_id !== companyId) return { error: "forbidden" as const };
  return { campaign };
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireFullAccess();
    const { id } = await params;
    const owned = await ownCampaign(id, user.company_id);
    if (owned.error === "notfound") return apiNotFound("Campanha");
    if (owned.error === "forbidden") return apiForbidden();
    return apiSuccess(await listRecipients(id));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiSuccess([]);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const owned = await ownCampaign(id, user.company_id);
    if (owned.error === "notfound") return apiNotFound("Campanha");
    if (owned.error === "forbidden") return apiForbidden();
    if (owned.campaign.status === "sending" || owned.campaign.status === "sent") {
      return apiError("Campanha já disparada — não é possível alterar a lista", 409);
    }
    const parsed = addRecipientsSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());

    let total = owned.campaign.total_count;
    if (parsed.data.contact_ids?.length) {
      const contacts = await getContactsByIds(user.company_id, parsed.data.contact_ids);
      total = await addRecipientsFromContacts(id, contacts);
    }
    if (parsed.data.phones?.length) {
      total = await addRecipientsFromPhones(id, parsed.data.phones);
    }
    return apiSuccess({ total });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const owned = await ownCampaign(id, user.company_id);
    if (owned.error === "notfound") return apiNotFound("Campanha");
    if (owned.error === "forbidden") return apiForbidden();
    const recipientId = req.nextUrl.searchParams.get("recipient_id");
    if (recipientId) await removeRecipient(id, recipientId);
    else await clearRecipients(id);
    return apiSuccess({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
