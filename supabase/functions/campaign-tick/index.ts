// ===========================================================================
// campaign-tick — worker de disparo de campanhas (pg_cron a cada 60s).
// Portado do Vita-system e adaptado ao schema do Milagres (migrations 024+036).
//
// Anti-ban: BATCH_SIZE=1 (o cron 1/min é o piso de espaçamento), janela
// comercial com timezone, limites diário/horário POR LINHA (agregando todas as
// campanhas), warmup de número novo, digitação simulada e claim atômico
// (RPC claim_campaign_recipients, FOR UPDATE SKIP LOCKED).
//
// Cadência: cada recipient carrega current_step; após enviar o passo N, se
// existir passo N+1 ele volta a 'pending' com scheduled_for = now + wait_hours
// (ajustado à janela). Resposta do contato interrompe (status 'replied',
// tratado no webhook inbound do app — Etapa 3).
//
// Auth: header x-cron-secret == CRON_SECRET (verify_jwt desligado no config).
// ===========================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  expandSpintax,
  substituteVars,
  randInt,
  sleep,
  isInsideWindow,
  nextSlot,
  windowIsValid,
  startOfDayUtc,
  type CampaignSchedule,
} from "./campaign-utils.ts";
import {
  sendText,
  sendMedia,
  sendPresence,
  getConnectionState,
  type EvoConfig,
} from "./evolution.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const BATCH_SIZE = 1; // 1 envio por campanha por tick — NUNCA aumentar sem revisar timeout
const STALE_SENDING_MIN = 10; // destrava recipients presos em 'sending'
const MAX_SEND_RETRIES = 2; // retries em 5xx/rede com backoff curto
const MAX_ATTEMPTS = 3; // após N claims sem sucesso → 'failed'

// Rampa de warmup (dias desde warmup_start_date → teto diário). 22+ dias: sem cap extra.
function warmupCap(startDate: string | null): number | null {
  if (!startDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  if (isNaN(start)) return null;
  const days = Math.floor((Date.now() - start) / 86_400_000) + 1;
  if (days <= 3) return 20;
  if (days <= 7) return 40;
  if (days <= 14) return 70;
  if (days <= 21) return 120;
  return null;
}

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Config: tabela privada campaign_engine_config (037); env vars têm precedência.
  const { data: cfgRow } = await admin
    .from("campaign_engine_config")
    .select("*")
    .limit(1)
    .maybeSingle();
  const secret = Deno.env.get("CRON_SECRET") || cfgRow?.cron_secret;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return json({ error: "unauthorized" }, 401);
  }
  const evoBase = Deno.env.get("EVOLUTION_API_URL") || cfgRow?.evolution_api_url || "";
  const evoFallbackKey = Deno.env.get("EVOLUTION_API_KEY") || cfgRow?.evolution_api_key || "";
  const appUrl = Deno.env.get("APP_URL") || cfgRow?.app_url || "";
  const workerSecret = Deno.env.get("CAMPAIGN_WORKER_SECRET") || cfgRow?.worker_secret || "";

  try {
    // ── Watchdog: recipients presos em 'sending' (função expirou no meio) ──
    const staleIso = new Date(Date.now() - STALE_SENDING_MIN * 60_000).toISOString();
    await admin
      .from("campaign_recipients")
      .update({ status: "failed", error: "timeout em 'sending'" })
      .eq("status", "sending")
      .lt("updated_at", staleIso)
      .gte("attempts", MAX_ATTEMPTS);
    await admin
      .from("campaign_recipients")
      .update({ status: "pending" })
      .eq("status", "sending")
      .lt("updated_at", staleIso)
      .lt("attempts", MAX_ATTEMPTS);

    const { data: campaigns } = await admin
      .from("campaigns")
      .select("*")
      .in("status", ["scheduled", "sending"]);
    if (!campaigns || campaigns.length === 0) return json({ ok: true, processed: 0 });

    let processed = 0;

    for (const camp of campaigns) {
      const schedule = (camp.schedule ?? {}) as CampaignSchedule;
      if (!windowIsValid(schedule)) {
        console.warn(
          "[campaign-tick] janela de envio inválida — campanha ignorada",
          camp.id,
          JSON.stringify(schedule)
        );
        continue;
      }
      if (!isInsideWindow(new Date(), schedule)) continue;
      if (!camp.line_id) continue;

      // nextSlot pode não achar horário em 14 dias; nesse caso usamos a data
      // crua — o próprio tick só processa dentro da janela, então é seguro.
      const slotOr = (d: Date): Date => nextSlot(d, schedule) ?? d;

      // ── Linha de disparo (instância + token próprios) ──
      const { data: line } = await admin
        .from("whatsapp_lines")
        .select(
          "id, company_id, phone, provider_instance, provider_token, is_active, warmup_enabled, warmup_start_date"
        )
        .eq("id", camp.line_id)
        .maybeSingle();
      if (!line || !line.is_active || !line.provider_instance) {
        await admin
          .from("campaigns")
          .update({ status: "paused" })
          .eq("id", camp.id);
        console.warn("[campaign-tick] linha inválida/inativa — campanha pausada", camp.id);
        continue;
      }
      const evo: EvoConfig = {
        baseUrl: evoBase,
        apiKey: line.provider_token || evoFallbackKey,
        instance: line.provider_instance,
      };

      // Número caído/desconectado → pausa a campanha (proteção anti-ban).
      // Se o PRÓPRIO check falhar (rede), apenas pula o tick — não pausa.
      try {
        const state = await getConnectionState(evo);
        if (state !== "open") {
          await admin.from("campaigns").update({ status: "paused" }).eq("id", camp.id);
          console.warn("[campaign-tick] linha desconectada — campanha pausada", camp.id, state);
          continue;
        }
      } catch (e) {
        console.warn("[campaign-tick] connectionState falhou — pulando tick", (e as Error).message);
        continue;
      }

      const tz = schedule.timezone || "America/Sao_Paulo";

      // ── Limites POR LINHA (agregando todas as campanhas da mesma linha) ──
      const lineCampaignIds = (
        await admin.from("campaigns").select("id").eq("line_id", camp.line_id)
      ).data?.map((c: { id: string }) => c.id) ?? [camp.id];
      const countSentSince = async (sinceIso: string) => {
        const { count } = await admin
          .from("campaign_messages")
          .select("id", { count: "exact", head: true })
          .in("campaign_id", lineCampaignIds)
          .gte("sent_at", sinceIso);
        return count ?? 0;
      };

      const ramp = line.warmup_enabled ? warmupCap(line.warmup_start_date) : null;
      const dailyCap =
        ramp != null ? Math.min(camp.daily_limit || Infinity, ramp) : camp.daily_limit || 0;
      const hourlyCap = camp.hourly_limit || 60;

      // ── Claim atômico ──
      const { data: ready, error: claimErr } = await admin.rpc("claim_campaign_recipients", {
        _campaign_id: camp.id,
        _batch: BATCH_SIZE,
      });
      if (claimErr) {
        console.error("[campaign-tick] claim falhou", camp.id, claimErr);
        continue;
      }

      if (!ready || ready.length === 0) {
        // Sem prontos: campanha termina quando não resta nenhum pending/sending.
        const { count } = await admin
          .from("campaign_recipients")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", camp.id)
          .in("status", ["pending", "sending"]);
        if ((count ?? 0) === 0 && camp.status === "sending") {
          await refreshProgress(admin, camp.id, true);
        }
        continue;
      }

      // un-claim por limite: devolve à fila com novo horário e DESFAZ o attempt
      // (bater no limite não é tentativa real de envio).
      // deno-lint-ignore no-explicit-any
      const requeue = (rec: any, when: Date) =>
        admin
          .from("campaign_recipients")
          .update({
            status: "pending",
            scheduled_for: when.toISOString(),
            attempts: Math.max(0, (rec.attempts ?? 1) - 1),
          })
          .eq("id", rec.id);

      // Passos da campanha (uma vez por campanha).
      const { data: steps } = await admin
        .from("campaign_steps")
        .select("*")
        .eq("campaign_id", camp.id)
        .order("order_index");
      if (!steps || steps.length === 0) {
        await admin.from("campaigns").update({ status: "failed" }).eq("id", camp.id);
        continue;
      }

      if (camp.status !== "sending") {
        await admin
          .from("campaigns")
          .update({ status: "sending", started_at: camp.started_at ?? new Date().toISOString() })
          .eq("id", camp.id);
      }

      for (const rec of ready) {
        // Limites (contados no fuso da campanha).
        if (dailyCap > 0) {
          const sentToday = await countSentSince(startOfDayUtc(new Date(), tz).toISOString());
          if (sentToday >= dailyCap) {
            await requeue(rec, slotOr(new Date(Date.now() + 24 * 60 * 60_000)));
            continue;
          }
        }
        const sentLastHour = await countSentSince(new Date(Date.now() - 60 * 60_000).toISOString());
        if (sentLastHour >= hourlyCap) {
          await requeue(rec, slotOr(new Date(Date.now() + 10 * 60_000)));
          continue;
        }

        try {
          // Passo atual (filtrado pela variante do recipient; fallback: todas).
          const variant = rec.variant ?? "A";
          // deno-lint-ignore no-explicit-any
          const forVariant = steps.filter((s: any) => (s.variant ?? "A") === variant);
          const effective = forVariant.length > 0 ? forVariant : steps;
          const step = effective[rec.current_step ?? 0];
          if (!step) {
            // Cadência já concluída para este recipient.
            await admin
              .from("campaign_recipients")
              .update({ status: "sent", sent_at: rec.sent_at ?? new Date().toISOString() })
              .eq("id", rec.id);
            continue;
          }

          // Texto do passo: template (spintax + vars) ou gerado por IA.
          let text: string | null = null;
          if (step.kind === "ai") {
            if (!appUrl || !workerSecret) throw new Error("app_url/worker_secret ausentes p/ passo IA");
            const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/campaigns/ai-step`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-worker-secret": workerSecret },
              body: JSON.stringify({ campaign_id: camp.id, recipient_id: rec.id, step_id: step.id }),
            });
            if (!res.ok) throw new Error(`ai-step HTTP ${res.status}`);
            text = ((await res.json())?.data?.text ?? null) as string | null;
            if (!text) throw new Error("ai-step devolveu texto vazio");
          } else if (step.body) {
            text = substituteVars(expandSpintax(step.body), rec.variables ?? {});
          }
          const hasText = !!text && text.trim().length > 0;
          const hasMedia = !!step.media_url;
          if (!hasText && !hasMedia) throw new Error("passo sem conteúdo");

          // Conversa do inbox (chave: line_id + contact_phone E.164).
          let conversationId: string | null = rec.conversation_id;
          if (!conversationId) {
            const contactPhone = rec.phone_e164.startsWith("+")
              ? rec.phone_e164
              : `+${rec.phone_e164}`;
            const { data: existing } = await admin
              .from("whatsapp_conversations")
              .select("id")
              .eq("line_id", camp.line_id)
              .eq("contact_phone", contactPhone)
              .maybeSingle();
            if (existing) {
              conversationId = existing.id;
            } else {
              const { data: created, error: convErr } = await admin
                .from("whatsapp_conversations")
                .insert({
                  company_id: camp.company_id,
                  line_id: camp.line_id,
                  contact_phone: contactPhone,
                  contact_name: rec.name ?? null,
                  status: "open",
                  ai_active: true,
                  unread_count: 0,
                  pinned: false,
                })
                .select("id")
                .single();
              if (convErr) throw convErr;
              conversationId = created.id;
            }
          }

          // Mensagem no inbox ANTES do envio (status pending → sent).
          const mime = step.media_mime_type ?? "";
          const messageType = !hasMedia
            ? "text"
            : mime.startsWith("image/")
            ? "image"
            : mime.startsWith("audio/")
            ? "audio"
            : mime.startsWith("video/")
            ? "video"
            : "document";
          const { data: msg, error: msgErr } = await admin
            .from("whatsapp_messages")
            .insert({
              conversation_id: conversationId,
              direction: "outbound",
              sender: "agent",
              text: hasText ? text : null,
              message_type: messageType,
              media_url: step.media_url ?? null,
              media_mime_type: step.media_mime_type ?? null,
              status: "pending",
              metadata: { campaign_id: camp.id, recipient_id: rec.id, step_id: step.id },
            })
            .select("id")
            .single();
          if (msgErr) throw msgErr;

          // Digitação simulada.
          if (camp.simulate_typing) {
            const tSec = randInt(camp.typing_seconds_min ?? 2, camp.typing_seconds_max ?? 6);
            try {
              await sendPresence(evo, rec.phone_e164, tSec);
            } catch (_) {
              /* presença é best-effort */
            }
            await sleep(tSec * 1000);
          }

          // Envio com retry (5xx/rede); 4xx falha direto.
          let externalId: string | null = null;
          let lastErr: string | null = null;
          let sent = false;
          for (let attempt = 0; attempt <= MAX_SEND_RETRIES; attempt++) {
            try {
              const result = hasMedia
                ? await sendMedia(
                    evo,
                    rec.phone_e164,
                    step.media_url!,
                    step.media_mime_type ?? "application/octet-stream",
                    hasText ? text! : undefined
                  )
                : await sendText(evo, rec.phone_e164, text!);
              externalId = result.external_id;
              sent = true;
              break;
            } catch (e) {
              const status = (e as Error & { status?: number }).status;
              lastErr = (e as Error).message;
              if (status && status >= 400 && status < 500) break; // 4xx: não adianta repetir
            }
            if (attempt < MAX_SEND_RETRIES) await sleep(800 * Math.pow(2, attempt) + randInt(0, 400));
          }
          if (!sent) {
            await admin.from("whatsapp_messages").update({ status: "failed" }).eq("id", msg.id);
            throw new Error(lastErr ?? "envio falhou");
          }

          // external_id imediatamente (dedup do eco fromMe no webhook inbound).
          await admin
            .from("whatsapp_messages")
            .update({ status: "sent", external_id: externalId })
            .eq("id", msg.id);
          await admin.from("campaign_messages").insert({
            campaign_id: camp.id,
            recipient_id: rec.id,
            step_id: step.id,
            whatsapp_message_id: msg.id,
            external_id: externalId,
            sent_at: new Date().toISOString(),
          });

          // Preview da conversa no inbox.
          const preview = hasText
            ? text!
            : messageType === "image"
            ? "📷 Imagem"
            : messageType === "video"
            ? "🎬 Vídeo"
            : messageType === "audio"
            ? "🎤 Áudio"
            : "📎 Anexo";
          await admin
            .from("whatsapp_conversations")
            .update({
              last_message_text: preview.slice(0, 500),
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", conversationId);

          // Avança a cadência ou conclui o recipient.
          const nextIndex = (rec.current_step ?? 0) + 1;
          const nextStep = effective[nextIndex];
          if (nextStep) {
            const waitMs = Math.max(0, Number(nextStep.wait_hours ?? 0)) * 3_600_000;
            const when = slotOr(new Date(Date.now() + waitMs));
            await admin
              .from("campaign_recipients")
              .update({
                status: "pending",
                current_step: nextIndex,
                scheduled_for: when.toISOString(),
                sent_at: rec.sent_at ?? new Date().toISOString(),
                conversation_id: conversationId,
                attempts: 0,
                error: null,
              })
              .eq("id", rec.id);
          } else {
            await admin
              .from("campaign_recipients")
              .update({
                status: "sent",
                sent_at: rec.sent_at ?? new Date().toISOString(),
                conversation_id: conversationId,
                error: null,
              })
              .eq("id", rec.id);
          }

          processed++;
        } catch (err) {
          console.error("[campaign-tick] envio falhou", rec.id, err);
          await admin
            .from("campaign_recipients")
            .update({ status: "failed", error: String((err as Error).message).slice(0, 500) })
            .eq("id", rec.id);
        }
        await refreshProgress(admin, camp.id, false);
      }
    }

    return json({ ok: true, processed });
  } catch (e) {
    console.error("[campaign-tick]", e);
    return json({ error: (e as Error).message }, 500);
  }
});

/** Recalcula contadores; se finalize=true e nada pendente, conclui a campanha. */
// deno-lint-ignore no-explicit-any
async function refreshProgress(admin: any, campaignId: string, finalize: boolean) {
  const countBy = async (statuses: string[]) => {
    const { count } = await admin
      .from("campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", statuses);
    return count ?? 0;
  };
  const [sent, failed, active] = await Promise.all([
    countBy(["sent", "delivered", "replied"]),
    countBy(["failed"]),
    countBy(["pending", "sending"]),
  ]);
  const patch: Record<string, unknown> = { sent_count: sent, failed_count: failed };
  if (active === 0) {
    const total = sent + failed;
    if (finalize || total > 0) {
      patch.status = total > 0 && failed === total ? "failed" : "sent";
      patch.finished_at = new Date().toISOString();
    }
  }
  await admin.from("campaigns").update(patch).eq("id", campaignId);
}
