import { NextRequest } from "next/server";
import { requireFullAccess } from "@/lib/auth";
import { requireLineAccess } from "@/lib/whatsapp/auth";
import { getConversationById, listMessages } from "@/lib/db/queries/whatsapp";
import { summarizeConversation } from "@/lib/ai/chat-assist";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireFullAccess();
    const { id } = await params;
    const conv = await getConversationById(id);
    if (!conv) return apiNotFound("Conversation");
    if (conv.company_id !== user.company_id) return apiForbidden();
    await requireLineAccess(user, conv.line_id);

    let purpose: string | undefined;
    try {
      purpose = (await req.json())?.purpose;
    } catch {
      // no body — fine
    }

    const messages = await listMessages(id, 60);
    const summary = await summarizeConversation(messages, {
      contactName: conv.contact_name,
      purpose,
    });
    return apiSuccess({ summary });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
