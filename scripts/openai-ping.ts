import { resolve } from "path";
import { config } from "dotenv";
config({ path: resolve(process.cwd(), ".env.local") });
import OpenAI from "openai";

async function main() {
  const c = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const r = await c.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "responda apenas: ok" }],
  });
  console.log("✅ OpenAI reply:", r.choices[0].message.content);
  console.log("Tokens:", r.usage?.total_tokens);
}
main().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
