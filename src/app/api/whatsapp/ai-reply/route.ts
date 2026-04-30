import { NextRequest } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenAI, DEFAULT_MODEL } from "@/lib/ai/client";
import { getToolsForMode, dispatchTool } from "@/lib/ai/tools";
import { appendMessage, getConversationById } from "@/lib/db/queries/whatsapp";
import { buildWhatsappAutoReplyPrompt, describeBusinessHours } from "@/lib/whatsapp/ai-prompt";
import { apiSuccess, apiError, apiServerError } from "@/lib/api/response";
import type {
  Database,
  WaBusinessHours,
} from "@/types/database";
import type {
  ChatCompletionMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";

type LineRow = Database["public"]["Tables"]["whatsapp_lines"]["Row"];
type MsgRow = Database["public"]["Tables"]["whatsapp_messages"]["Row"];

const bodySchema = z.object({
  conversation_id: z.string().uuid(),
});

const MAX_TOOL_LOOPS = 3;
const HISTORY_LIMIT = 20;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(request: NextRequest) {
  try {
    const expected = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!expected) return apiError("Webhook not configured", 503);
    const provided = request.headers.get("x-webhook-secret") || "";
    if (!safeEqual(provided, expected)) return apiError("Forbidden", 403);

    const body = await request.json();
    const validation = bodySchema.safeParse(body);
    if (!validation.success) return apiError("Validation failed", 400, validation.error.flatten());
    const { conversation_id: conversationId } = validation.data;

    const conv = await getConversationById(conversationId);
    if (!conv) return apiError("Conversation not found", 404);

    // Load the line + company so we can frame the response
    const supabase = createAdminClient();
    const { data: lineData } = await supabase
      .from("whatsapp_lines")
      .select("*")
      .eq("id", conv.line_id)
      .maybeSingle();
    const line = lineData as LineRow | null;
    if (!line) return apiError("Line not found", 404);
    if (!line.ai_enabled) return apiError("AI disabled on this line", 409);
    if (!conv.ai_active) return apiError("AI paused on this conversation", 409);

    const { data: companyData } = await supabase
      .from("companies")
      .select("name")
      .eq("id", line.company_id)
      .maybeSingle();
    const companyName = (companyData as { name?: string } | null)?.name || "Milagres Hospedagens";

    // Build chat history (oldest first); keep small for token budget
    const { data: histRows } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    const history = ((histRows as MsgRow[]) || []).reverse();

    const systemPrompt = buildWhatsappAutoReplyPrompt({
      companyName,
      todayISO: new Date().toISOString().slice(0, 10),
      language: "pt-BR",
      businessHoursLine: describeBusinessHours(line.business_hours as WaBusinessHours | null),
      contactName: conv.contact_name,
    });

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m): ChatCompletionMessageParam => {
        // Inbound (guest) → user; outbound agent/ai → assistant; system → system
        if (m.direction === "inbound") {
          return { role: "user", content: m.text || `[${m.message_type}]` };
        }
        if (m.sender === "system") {
          return { role: "system", content: m.text || "" };
        }
        return { role: "assistant", content: m.text || "" };
      }),
    ];

    // Use the same `guest` mode tools (list_properties + check_availability) so the model
    // has data without exposing operational/management tools.
    const tools = getToolsForMode("guest");
    const openai = getOpenAI();

    let assistantText = "";
    let totalTokens = 0;

    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined,
        temperature: 0.4,
      });
      totalTokens += completion.usage?.total_tokens || 0;
      const choice = completion.choices[0];
      const msg = choice.message;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push({
          role: "assistant",
          content: msg.content || "",
          tool_calls: msg.tool_calls,
        } as ChatCompletionAssistantMessageParam);

        for (const tc of msg.tool_calls) {
          if (tc.type !== "function") continue;
          const result = await dispatchTool(tc.function.name, tc.function.arguments, {
            companyId: line.company_id,
            mode: "guest",
          });
          let resultStr = JSON.stringify(result);
          if (resultStr.length > 8000) resultStr = resultStr.slice(0, 8000) + "…[truncated]";
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: resultStr,
          } as ChatCompletionToolMessageParam);
        }
        continue;
      }

      assistantText = msg.content || "Desculpe, não consegui formular uma resposta agora.";
      break;
    }

    if (!assistantText) assistantText = "Desculpe, não consegui formular uma resposta agora.";

    // Persist as outbound AI message — sets `last_message_at` on the conversation too
    const persisted = await appendMessage({
      conversationId,
      direction: "outbound",
      sender: "ai",
      text: assistantText,
      messageType: "text",
      status: "pending", // will become 'sent' once n8n confirms Evolution accepted
      metadata: { auto_reply: true, tokens_used: totalTokens } as never,
    });

    return apiSuccess({
      conversation_id: conversationId,
      message_id: persisted.id,
      text: assistantText,
      tokens_used: totalTokens,
    });
  } catch (error) {
    return apiServerError(error);
  }
}
