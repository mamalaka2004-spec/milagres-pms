import { NextRequest } from "next/server";
import { z } from "zod";
import { getOpenAI, DEFAULT_MODEL } from "@/lib/ai/client";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { getToolsForMode, dispatchTool } from "@/lib/ai/tools";
import {
  appendMessage,
  getOrCreateConversation,
  listMessages,
  updateConversationTitle,
} from "@/lib/ai/conversations";
import { requireAuth } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiServerError,
} from "@/lib/api/response";
import type { AiMode } from "@/types/database";
import type {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionAssistantMessageParam,
} from "openai/resources/chat/completions";

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  mode: z.enum(["guest", "operations", "management"]).default("operations"),
  conversation_id: z.string().uuid().optional(),
});

const MAX_TOOL_LOOPS = 4;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const { message, mode, conversation_id } = validation.data;

    const conversation = await getOrCreateConversation({
      conversationId: conversation_id || null,
      companyId: user.company_id,
      userId: user.id,
      mode: mode as AiMode,
      language: user.language || "pt-BR",
    });

    // Persist the user message FIRST so it shows up in history regardless of model failures
    await appendMessage(conversation.id, "user", message);

    // Load message history (chronological)
    const history = await listMessages(conversation.id, 40);

    const systemPrompt = buildSystemPrompt(conversation.mode as AiMode, {
      companyName: "Milagres Hospedagens",
      todayISO: new Date().toISOString().slice(0, 10),
      userRole: user.role,
      language: conversation.language,
    });

    // Build OpenAI messages: system + persisted history (which includes the just-added user msg)
    const openaiMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m): ChatCompletionMessageParam => {
        if (m.role === "tool") {
          // Tool result rows from prior turns — re-attach to satisfy OpenAI ordering
          const meta = (m.metadata || {}) as { tool_call_id?: string };
          return {
            role: "tool",
            tool_call_id: meta.tool_call_id || "unknown",
            content: m.content,
          } as ChatCompletionToolMessageParam;
        }
        if (m.role === "assistant") {
          const meta = (m.metadata || {}) as { tool_calls?: ChatCompletionAssistantMessageParam["tool_calls"] };
          return {
            role: "assistant",
            content: m.content,
            tool_calls: meta.tool_calls,
          } as ChatCompletionAssistantMessageParam;
        }
        return { role: m.role as "user" | "system", content: m.content };
      }),
    ];

    const tools = getToolsForMode(conversation.mode as AiMode);
    const openai = getOpenAI();

    let totalTokens = 0;
    let assistantContent = "";

    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: openaiMessages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined,
        temperature: 0.4,
      });

      totalTokens += completion.usage?.total_tokens || 0;
      const choice = completion.choices[0];
      const msg = choice.message;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Persist + push the assistant tool-call message
        await appendMessage(conversation.id, "assistant", msg.content || "", {
          metadata: { tool_calls: msg.tool_calls } as never,
        });
        openaiMessages.push({
          role: "assistant",
          content: msg.content || "",
          tool_calls: msg.tool_calls,
        } as ChatCompletionAssistantMessageParam);

        // Run tools sequentially (could be parallel; keeping simple)
        for (const tc of msg.tool_calls) {
          if (tc.type !== "function") continue;
          const result = await dispatchTool(tc.function.name, tc.function.arguments, {
            companyId: user.company_id,
            mode: conversation.mode as AiMode,
          });
          // Cap tool result size — keeps token cost bounded if a tool returns
          // an unexpectedly large payload (e.g. a wide search returning 100KB).
          let resultStr = JSON.stringify(result);
          const MAX_TOOL_RESULT = 12000;
          if (resultStr.length > MAX_TOOL_RESULT) {
            console.warn(
              `[ai] tool ${tc.function.name} returned ${resultStr.length} bytes, truncating`
            );
            resultStr =
              resultStr.slice(0, MAX_TOOL_RESULT) +
              `…[truncated, original ${resultStr.length} bytes]`;
          }
          await appendMessage(conversation.id, "tool", resultStr, {
            metadata: { tool_call_id: tc.id, tool_name: tc.function.name } as never,
          });
          openaiMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: resultStr,
          } as ChatCompletionToolMessageParam);
        }
        // continue loop — let model see tool results
        continue;
      }

      // Plain assistant response — done
      assistantContent = msg.content || "";
      await appendMessage(conversation.id, "assistant", assistantContent, {
        tokens_used: completion.usage?.total_tokens,
      });
      break;
    }

    // Auto-title conversation from the first user prompt
    if (!conversation.title) {
      const title = message.slice(0, 60).trim() + (message.length > 60 ? "…" : "");
      await updateConversationTitle(conversation.id, title);
    }

    return apiSuccess({
      conversation_id: conversation.id,
      mode: conversation.mode,
      message: assistantContent,
      tokens_used: totalTokens,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}
