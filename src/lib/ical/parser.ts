/**
 * Minimal RFC5545 iCal parser tuned for Airbnb / Booking calendar feeds.
 * Both expose only DTSTART/DTEND/SUMMARY/UID — we don't need full RFC support.
 */

export interface ICalEvent {
  uid: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD (DTEND in iCal is exclusive — same as our blocked_dates.end_date convention)
  summary: string;
  description?: string;
  raw_dtstart: string;
  raw_dtend: string;
}

export class ICalParseError extends Error {}

/** Unfold lines per RFC5545 §3.1: lines starting with whitespace continue the previous logical line. */
function unfoldLines(text: string): string[] {
  const rawLines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out.filter((l) => l.length > 0);
}

/** Split "PROPERTY;PARAMS:VALUE" into name (incl. params) + value. */
function splitProperty(line: string): { name: string; value: string } {
  const colon = line.indexOf(":");
  if (colon === -1) return { name: line, value: "" };
  return {
    name: line.slice(0, colon),
    value: line.slice(colon + 1),
  };
}

/** Convert iCal DTSTART/DTEND value to YYYY-MM-DD. Supports DATE (YYYYMMDD) and DATE-TIME (YYYYMMDDTHHMMSSZ). */
function normalizeICalDate(raw: string): string {
  if (!raw) throw new ICalParseError("empty date");
  const datePart = raw.length >= 8 ? raw.slice(0, 8) : raw;
  const yyyy = datePart.slice(0, 4);
  const mm = datePart.slice(4, 6);
  const dd = datePart.slice(6, 8);
  if (!/^\d{4}$/.test(yyyy) || !/^\d{2}$/.test(mm) || !/^\d{2}$/.test(dd)) {
    throw new ICalParseError(`invalid iCal date: ${raw}`);
  }
  return `${yyyy}-${mm}-${dd}`;
}

/** Unescape iCal text per RFC5545 §3.3.11. */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

export function parseICal(text: string): ICalEvent[] {
  if (!text || !text.includes("BEGIN:VCALENDAR")) {
    throw new ICalParseError("not a valid iCalendar feed");
  }
  const lines = unfoldLines(text);
  const events: ICalEvent[] = [];
  let inEvent = false;
  let cur: Partial<ICalEvent> & { raw_dtstart?: string; raw_dtend?: string } = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (cur.uid && cur.raw_dtstart && cur.raw_dtend) {
        try {
          events.push({
            uid: cur.uid,
            start: normalizeICalDate(cur.raw_dtstart),
            end: normalizeICalDate(cur.raw_dtend),
            summary: cur.summary || "Reserved",
            description: cur.description,
            raw_dtstart: cur.raw_dtstart,
            raw_dtend: cur.raw_dtend,
          });
        } catch {
          // skip malformed event
        }
      }
      cur = {};
      continue;
    }
    if (!inEvent) continue;

    const { name, value } = splitProperty(line);
    const baseName = name.split(";")[0].toUpperCase();
    switch (baseName) {
      case "UID":
        cur.uid = value.trim();
        break;
      case "DTSTART":
        cur.raw_dtstart = value.trim();
        break;
      case "DTEND":
        cur.raw_dtend = value.trim();
        break;
      case "SUMMARY":
        cur.summary = unescapeText(value);
        break;
      case "DESCRIPTION":
        cur.description = unescapeText(value);
        break;
    }
  }

  return events;
}

/** Heuristic: treat events whose summary indicates the listing is unavailable as blocks. */
export function isBlockingEvent(ev: ICalEvent): boolean {
  const s = (ev.summary || "").toLowerCase();
  // Common Airbnb / Booking phrases that indicate the listing is closed
  if (s.includes("not available") || s.includes("unavailable")) return true;
  if (s.includes("closed") || s.includes("blocked")) return true;
  if (s.includes("reserved")) return true;
  if (s.startsWith("airbnb")) return true; // Airbnb default is "Airbnb (Not available)"
  if (s.startsWith("booking")) return true;
  // Fall back: any VEVENT in a busy calendar implies a block
  return true;
}
