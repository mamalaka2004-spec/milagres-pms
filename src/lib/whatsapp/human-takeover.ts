/* eslint-disable @typescript-eslint/no-explicit-any */
// ===========================================================================
// Takeover humano: quando ALGUÉM do time responde direto pelo WhatsApp (do
// celular da linha), pausamos a IA daquela conversa — assim o time assume sem
// a IA atropelar. O desafio é NÃO confundir com os próprios envios da IA, que
// também voltam pelo webhook como `from_me`.
//
// Guardas (qualquer um positivo = é eco da IA, não pausa):
//  1. a mensagem deduplicou numa mensagem 'ai' / de campanha (external_id);
//  2. houve envio 'ai' nesta conversa nos últimos 25s (eco chegando);
//  3. houve mensagem do lead nos últimos 30s e a IA está ativa (ela vai
//     responder — o from_me é o eco da resposta dela, não um humano).
// Só quando NENHUM guard bate tratamos como humano assumindo → pausa a IA.
// ===========================================================================
import { createAdminClient } from "@/lib/supabase/admin";

interface AppendedMessage {
  sender?: string | null;
  metadata?: unknown;
}

export async function maybePauseOnHumanReply(opts: {
  companyId: string;
  conversationId: string;
  contactPhone: string;
  aiActive: boolean;
  message: AppendedMessage;
}): Promise<boolean> {
  // Guard 1: eco de mensagem da própria IA / campanha (dedup por external_id).
  if (opts.message.sender === "ai") return false;
  if (opts.message.metadata && (opts.message.metadata as any).campaign_id) return false;

  // Se a IA já está pausada, não há o que fazer.
  if (!opts.aiActive) return false;

  const db = createAdminClient();
  const since25 = new Date(Date.now() - 25_000).toISOString();
  const since30 = new Date(Date.now() - 30_000).toISOString();

  // Guard 2: envio 'ai' recente nesta conversa (eco da IA ainda chegando).
  const { count: aiRecent } = await (db.from("whatsapp_messages") as any)
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", opts.conversationId)
    .eq("sender", "ai")
    .gte("created_at", since25);
  if ((aiRecent ?? 0) > 0) return false;

  // Guard 3: lead mandou algo há pouco → a IA está respondendo (este from_me
  // é o eco da resposta dela). Só vale porque a IA está ativa.
  const { count: guestRecent } = await (db.from("whatsapp_messages") as any)
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", opts.conversationId)
    .eq("direction", "inbound")
    .gte("created_at", since30);
  if ((guestRecent ?? 0) > 0) return false;

  // Chegou aqui = humano digitou pelo WhatsApp e assumiu → pausa a IA.
  await (db.from("whatsapp_conversations") as any)
    .update({ ai_active: false, updated_at: new Date().toISOString() })
    .eq("id", opts.conversationId);

  // Avisa o n8n (Redis) para a Sarah parar de verdade. Best-effort.
  const ctrlUrl = process.env.WHATSAPP_AI_CONTROL_WEBHOOK_URL;
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (ctrlUrl && secret) {
    try {
      await fetch(ctrlUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Webhook-Secret": secret },
        body: JSON.stringify({
          action: "pause",
          contact_phone: opts.contactPhone,
          conversation_id: opts.conversationId,
          reason: "human_takeover_whatsapp",
        }),
      });
    } catch (e) {
      console.warn("[human-takeover] pausa n8n falhou:", (e as Error).message);
    }
  }
  return true;
}
