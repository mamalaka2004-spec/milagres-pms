import { getOpenAI, DEFAULT_MODEL } from "@/lib/ai/client";
import type { Database } from "@/types/database";

type MsgRow = Database["public"]["Tables"]["whatsapp_messages"]["Row"];

export interface AssistContext {
  companyName?: string;
  contactName?: string | null;
  purpose?: "booking" | "sales" | string | null;
}

/** Build a compact, role-tagged transcript (oldest → newest) for the model. */
function buildTranscript(messages: MsgRow[]): string {
  return messages
    .filter((m) => m.text && m.text.trim())
    .map((m) => {
      const who =
        m.direction === "inbound"
          ? "Cliente"
          : m.sender === "ai"
          ? "Atendente (IA)"
          : m.sender === "agent"
          ? "Atendente"
          : "Sistema";
      return `${who}: ${m.text}`;
    })
    .join("\n");
}

/** Generate 3 short reply suggestions the agent can pick from. */
export async function suggestReplies(
  messages: MsgRow[],
  ctx: AssistContext
): Promise<string[]> {
  const transcript = buildTranscript(messages.slice(-20));
  if (!transcript) return [];

  const role =
    ctx.purpose === "sales"
      ? "consultor de vendas de imóveis/hospedagens"
      : "atendente de reservas de uma hospedagem";

  const client = getOpenAI();
  const completion = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          `Você é um ${role} de "${ctx.companyName || "Milagres Hospedagens"}". ` +
          `Sugira respostas curtas, calorosas e profissionais em português (pt-BR) que o atendente pode enviar AGORA ao cliente${
            ctx.contactName ? ` (${ctx.contactName})` : ""
          }. ` +
          `Cada sugestão deve ser uma mensagem completa e direta (1–3 frases), sem placeholders. ` +
          `Responda APENAS em JSON no formato {"suggestions": ["...", "...", "..."]} com exatamente 3 opções distintas.`,
      },
      {
        role: "user",
        content: `Conversa até aqui:\n\n${transcript}\n\nGere 3 sugestões de resposta.`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(raw) as { suggestions?: unknown };
    if (Array.isArray(parsed.suggestions)) {
      return parsed.suggestions
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .slice(0, 3);
    }
  } catch {
    // fall through
  }
  return [];
}

/** Produce a concise summary of the conversation for quick context. */
export async function summarizeConversation(
  messages: MsgRow[],
  ctx: AssistContext
): Promise<string> {
  const transcript = buildTranscript(messages.slice(-60));
  if (!transcript) return "Sem mensagens suficientes para resumir.";

  const client = getOpenAI();
  const completion = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content:
          `Resuma a conversa abaixo em português (pt-BR), de forma objetiva, para um atendente que vai assumir o contato. ` +
          `Use no máximo 5 bullets curtos cobrindo: quem é o cliente / intenção, pontos-chave já discutidos, ` +
          `${ctx.purpose === "sales" ? "estágio/objeção da venda" : "datas e necessidades da reserva"}, e o próximo passo recomendado. ` +
          `Seja breve. Não invente informações que não estão na conversa.`,
      },
      { role: "user", content: transcript },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || "Não foi possível resumir.";
}
