import { createAdminClient } from "@/lib/supabase/admin";
import { parseICal, isBlockingEvent, ICalParseError } from "./parser";

export type ICalSource = "airbnb" | "booking";

export interface SyncResult {
  source: ICalSource;
  url: string;
  fetched: number; // total VEVENTs in feed
  blocking: number; // events flagged as blocks
  inserted: number;
  updated: number;
  removed: number; // stale rows from previous syncs that no longer match
  synced_at: string;
  error?: string;
}

/**
 * Sync a single iCal feed for one property.
 * Strategy: full re-sync (delete prior rows from this source, insert fresh) — robust against feed re-keying.
 */
export async function syncPropertyICal(
  propertyId: string,
  source: ICalSource,
  url: string
): Promise<SyncResult> {
  const synced_at = new Date().toISOString();
  const result: SyncResult = {
    source,
    url,
    fetched: 0,
    blocking: 0,
    inserted: 0,
    updated: 0,
    removed: 0,
    synced_at,
  };

  // 1. Fetch the feed
  let text: string;
  try {
    const res = await fetch(url, {
      headers: {
        // Some hosts require a real User-Agent
        "User-Agent": "MilagresPMS/1.0 (+https://milagreshospedagens.com)",
        Accept: "text/calendar, text/plain, */*",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      result.error = `HTTP ${res.status} fetching iCal`;
      return result;
    }
    text = await res.text();
  } catch (err) {
    result.error = err instanceof Error ? err.message : "fetch failed";
    return result;
  }

  // 2. Parse
  let events;
  try {
    events = parseICal(text);
  } catch (err) {
    if (err instanceof ICalParseError) {
      result.error = err.message;
    } else {
      result.error = "parse failed";
    }
    return result;
  }
  result.fetched = events.length;
  const blocks = events.filter(isBlockingEvent);
  result.blocking = blocks.length;

  // 3. Replace prior rows from this source for this property
  const supabase = createAdminClient();

  // count existing
  const { count: priorCount } = await supabase
    .from("blocked_dates")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .eq("external_source", source);

  // delete prior
  const { error: delErr } = await supabase
    .from("blocked_dates")
    .delete()
    .eq("property_id", propertyId)
    .eq("external_source", source);
  if (delErr) {
    result.error = `delete prior: ${delErr.message}`;
    return result;
  }
  result.removed = priorCount || 0;

  // insert fresh
  if (blocks.length > 0) {
    const rows = blocks.map((ev) => ({
      property_id: propertyId,
      start_date: ev.start,
      end_date: ev.end,
      reason: "other",
      notes: ev.description || null,
      external_source: source,
      external_uid: ev.uid,
      external_summary: ev.summary || null,
      synced_at,
    }));
    const { error: insErr, data: inserted } = await (supabase.from("blocked_dates") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert(rows)
      .select("id");
    if (insErr) {
      result.error = `insert: ${insErr.message}`;
      return result;
    }
    result.inserted = inserted?.length || 0;
  }

  // 4. Stamp last sync on property
  const stampField = source === "airbnb" ? "airbnb_last_synced_at" : "booking_last_synced_at";
  await (supabase.from("properties") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update({ [stampField]: synced_at })
    .eq("id", propertyId);

  return result;
}

/** Whitelist of allowed iCal hosts — defends against SSRF on user-controlled URLs. */
const ALLOWED_ICAL_HOSTS: Record<ICalSource, RegExp[]> = {
  airbnb: [/^([a-z0-9-]+\.)*airbnb\.(com|com\.br)$/i],
  booking: [/^([a-z0-9-]+\.)*booking\.com$/i, /^admin\.booking\.com$/i],
};

function isAllowedICalUrl(url: string, source: ICalSource): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return ALLOWED_ICAL_HOSTS[source].some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

export async function syncAllForProperty(propertyId: string): Promise<SyncResult[]> {
  const supabase = createAdminClient();
  const { data: prop, error } = await supabase
    .from("properties")
    .select("id, airbnb_ical_url, booking_ical_url, deleted_at")
    .eq("id", propertyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!prop) throw new Error("Property not found");

  const p = prop as { id: string; airbnb_ical_url: string | null; booking_ical_url: string | null };
  const tasks: Array<Promise<SyncResult>> = [];
  if (p.airbnb_ical_url) {
    if (!isAllowedICalUrl(p.airbnb_ical_url, "airbnb")) {
      tasks.push(
        Promise.resolve({
          source: "airbnb" as const,
          url: p.airbnb_ical_url,
          fetched: 0,
          blocking: 0,
          inserted: 0,
          updated: 0,
          removed: 0,
          synced_at: new Date().toISOString(),
          error: "Airbnb iCal URL must point to a valid airbnb.com / airbnb.com.br host over HTTPS",
        })
      );
    } else {
      tasks.push(syncPropertyICal(p.id, "airbnb", p.airbnb_ical_url));
    }
  }
  if (p.booking_ical_url) {
    if (!isAllowedICalUrl(p.booking_ical_url, "booking")) {
      tasks.push(
        Promise.resolve({
          source: "booking" as const,
          url: p.booking_ical_url,
          fetched: 0,
          blocking: 0,
          inserted: 0,
          updated: 0,
          removed: 0,
          synced_at: new Date().toISOString(),
          error: "Booking iCal URL must point to a valid booking.com host over HTTPS",
        })
      );
    } else {
      tasks.push(syncPropertyICal(p.id, "booking", p.booking_ical_url));
    }
  }
  if (tasks.length === 0) return [];
  return Promise.all(tasks);
}
