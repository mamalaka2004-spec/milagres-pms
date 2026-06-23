import { NextRequest } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendText } from "@/lib/whatsapp/evolution";
import { findOrCreateConversation, appendMessage } from "@/lib/db/queries/whatsapp";
import { resolveGuideForReservation, signGuidePdf } from "@/lib/db/queries/guides";
import { buildWelcomeMessage } from "@/lib/whatsapp/welcome";
import { apiSuccess, apiError, apiServerError } from "@/lib/api/response";
import type { Database } from "@/types/database";

type LineRow = Database["public"]["Tables"]["whatsapp_lines"]["Row"];

/**
 * Auto-dispatch of the welcome/onboarding message to CONFIRMED guests.
 *
 * Called on a schedule (n8n). For each booking line, it finds reservations whose
 * check-in is within `days_before` days, that are confirmed/checked-in, and that
 * have not yet been welcomed — and sends a templated welcome (with Wi-Fi/access +
 * guide PDF link, gated to the matched unit). It SKIPS conversations where a human
 * has already replied ("quando humano ainda não enviou").
 *
 * Sending happens directly via Evolution (EVOLUTION_API_URL/KEY on the server),
 * so no outbound webhook is required.
 */

const bodySchema = z
  .object({
    days_before: z.number().int().min(0).max(30).default(1),
    limit: z.number().int().min(1).max(200).default(50),
    dry_run: z.boolean().default(false),
  })
  .default({ days_before: 1, limit: 50, dry_run: false });

export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

interface ReservationRow {
  id: string;
  booking_code: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  property_id: string;
  guest: { full_name: string | null; phone: string | null } | null;
  property: { name: string | null } | null;
}

export async function POST(req: NextRequest) {
  try {
    const expected = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!expected) return apiError("Webhook not configured", 503);
    const provided = req.headers.get("x-webhook-secret") || "";
    if (!safeEqual(provided, expected)) return apiError("Forbidden", 403);

    const raw = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());
    const opts = parsed.data;

    const supabase = createAdminClient();

    // Booking lines (Reservas). Usually one.
    const { data: lineData } = await supabase
      .from("whatsapp_lines")
      .select("*")
      .eq("purpose", "booking")
      .eq("is_active", true);
    const lines = (lineData as LineRow[]) || [];
    if (lines.length === 0) return apiSuccess({ message: "No active booking line", sent: 0 });

    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const windowEnd = new Date(today.getTime() + opts.days_before * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const nowISO = new Date().toISOString();

    const summary = {
      window: { from: todayISO, to: windowEnd, days_before: opts.days_before },
      dry_run: opts.dry_run,
      candidates: 0,
      sent: 0,
      skipped_human: 0,
      skipped_no_phone: 0,
      access_included: 0,
      errors: [] as Array<{ booking_code: string; error: string }>,
      details: [] as Array<Record<string, unknown>>,
    };

    for (const line of lines) {
      // Company name for the greeting.
      const { data: companyData } = await supabase
        .from("companies")
        .select("name")
        .eq("id", line.company_id)
        .maybeSingle();
      const companyName =
        (companyData as { name?: string } | null)?.name || "Milagres Hospedagens";

      const { data: resvData } = await supabase
        .from("reservations")
        .select(
          "id, booking_code, check_in_date, check_out_date, status, property_id, guest:guests(full_name, phone), property:properties(name)"
        )
        .eq("company_id", line.company_id)
        .in("status", ["confirmed", "checked_in"])
        .is("deleted_at", null)
        .is("welcome_sent_at", null)
        .gte("check_in_date", todayISO)
        .lte("check_in_date", windowEnd)
        .order("check_in_date", { ascending: true })
        .limit(opts.limit);

      const reservations = (resvData as unknown as ReservationRow[]) || [];
      summary.candidates += reservations.length;

      for (const r of reservations) {
        const phone = (r.guest?.phone || "").replace(/\D/g, "");
        if (phone.length < 8) {
          summary.skipped_no_phone++;
          summary.details.push({ booking_code: r.booking_code, action: "skip_no_phone" });
          continue;
        }

        try {
          const conv = await findOrCreateConversation({
            companyId: line.company_id,
            lineId: line.id,
            contactPhone: phone.startsWith("+") ? phone : `+${phone}`,
            contactName: r.guest?.full_name ?? null,
          });

          // Guard: skip if a HUMAN agent has already messaged this conversation.
          const { data: humanMsg } = await supabase
            .from("whatsapp_messages")
            .select("id")
            .eq("conversation_id", conv.id)
            .eq("sender", "agent")
            .limit(1);
          if (((humanMsg as { id: string }[]) || []).length > 0) {
            summary.skipped_human++;
            summary.details.push({ booking_code: r.booking_code, action: "skip_human_handled" });
            if (!opts.dry_run) {
              await (supabase.from("reservations") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                .update({ welcome_sent_at: nowISO, welcome_sent_by: "skipped_human" })
                .eq("id", r.id);
            }
            continue;
          }

          // Resolve the unit guide to release Wi-Fi/access safely.
          const { guide, matched } = await resolveGuideForReservation(line.company_id, {
            property_id: r.property_id,
            property_name: r.property?.name ?? null,
          });
          const includeAccess = matched && !!guide;
          const pdfUrl = includeAccess
            ? await signGuidePdf(guide!.pdf_path, 60 * 60 * 24 * 7)
            : null;

          const text = buildWelcomeMessage({
            guestName: r.guest?.full_name,
            companyName,
            unitName: guide?.name ?? r.property?.name ?? null,
            checkIn: r.check_in_date,
            checkOut: r.check_out_date,
            checkInTime: guide?.check_in_time ?? "15:00",
            checkOutTime: guide?.check_out_time ?? "11:00",
            wifiSsid: guide?.wifi_ssid,
            wifiPassword: guide?.wifi_password,
            accessInstructions: guide?.access_instructions,
            exactAddress: guide?.exact_address,
            mapsUrl: guide?.maps_url,
            guidePdfUrl: pdfUrl,
            includeAccess,
          });

          if (opts.dry_run) {
            summary.details.push({
              booking_code: r.booking_code,
              action: "would_send",
              unit: guide?.name ?? null,
              access_included: includeAccess,
              preview: text.slice(0, 180),
            });
            summary.sent++;
            if (includeAccess) summary.access_included++;
            continue;
          }

          // Send via Evolution (instance of the Reservas line).
          let externalId: string | undefined;
          let status: "sent" | "failed" = "sent";
          try {
            const res = await sendText(phone, text, line.provider_instance || undefined);
            externalId = res.external_id;
          } catch (e) {
            status = "failed";
            summary.errors.push({
              booking_code: r.booking_code,
              error: e instanceof Error ? e.message : String(e),
            });
          }

          await appendMessage({
            conversationId: conv.id,
            direction: "outbound",
            sender: "ai",
            text,
            messageType: "text",
            externalId: externalId ?? null,
            status,
            metadata: {
              auto_welcome: true,
              reservation_id: r.id,
              booking_code: r.booking_code,
              access_included: includeAccess,
            } as never,
          });

          // Mark reservation so it isn't welcomed again (even if the send failed,
          // to avoid spamming on retries — a failed row is visible in the PMS chat).
          await (supabase.from("reservations") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
            .update({
              welcome_sent_at: nowISO,
              welcome_sent_by: "auto",
              access_info_sent_at: includeAccess ? nowISO : null,
            })
            .eq("id", r.id);

          if (status === "sent") {
            summary.sent++;
            if (includeAccess) summary.access_included++;
          }
          summary.details.push({
            booking_code: r.booking_code,
            action: status === "sent" ? "sent" : "send_failed",
            unit: guide?.name ?? null,
            access_included: includeAccess,
          });
        } catch (e) {
          summary.errors.push({
            booking_code: r.booking_code,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    return apiSuccess(summary);
  } catch (error) {
    return apiServerError(error);
  }
}
