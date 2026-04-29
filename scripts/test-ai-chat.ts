/**
 * One-shot smoke test for the AI Assistant pipeline.
 * Bypasses HTTP auth: fakes a user, calls OpenAI + tools directly via the admin client.
 *
 * Run: npx tsx scripts/test-ai-chat.ts "<prompt>" [mode]
 */
import { resolve } from "path";
import { config } from "dotenv";
config({ path: resolve(process.cwd(), ".env.local") });

import OpenAI from "openai";
import { dispatchTool, getToolsForMode } from "../src/lib/ai/tools";
import { buildSystemPrompt } from "../src/lib/ai/prompts";
import type { AiMode } from "../src/types/database";
import type {
  ChatCompletionMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";

const COMPANY_ID = "a0000000-0000-0000-0000-000000000001";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

async function main() {
  const prompt = process.argv[2] || "O que tem hoje na operação?";
  const mode = (process.argv[3] || "operations") as AiMode;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const tools = getToolsForMode(mode);

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: buildSystemPrompt(mode, {
        companyName: "Milagres Hospedagens",
        todayISO: new Date().toISOString().slice(0, 10),
        userRole: "admin",
        language: "pt-BR",
      }),
    },
    { role: "user", content: prompt },
  ];

  console.log(`\n🟢 Mode: ${mode}`);
  console.log(`💬 User: ${prompt}\n`);

  for (let loop = 0; loop < 4; loop++) {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.4,
    });
    const msg = completion.choices[0].message;

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push({
        role: "assistant",
        content: msg.content || "",
        tool_calls: msg.tool_calls,
      } as ChatCompletionAssistantMessageParam);

      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        console.log(`🔧 tool_call: ${tc.function.name}(${tc.function.arguments})`);
        const result = await dispatchTool(tc.function.name, tc.function.arguments, {
          companyId: COMPANY_ID,
          mode,
        });
        const resultStr = JSON.stringify(result);
        console.log(`   → ${resultStr.slice(0, 200)}${resultStr.length > 200 ? "..." : ""}`);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: resultStr,
        } as ChatCompletionToolMessageParam);
      }
      continue;
    }

    console.log(`\n🤖 Assistant:\n${msg.content || "(empty)"}\n`);
    console.log(`📊 Tokens: ${completion.usage?.total_tokens || "?"}`);
    return;
  }
  console.log("⚠️ Hit tool-loop limit");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
