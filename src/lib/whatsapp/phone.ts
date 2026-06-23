/**
 * Phone normalization + matching for identity gating.
 *
 * WhatsApp/Evolution and our DB store phones in inconsistent formats (with/without
 * the "+", with/without the 55 country code, with/without the Brazilian mobile "9th
 * digit"). Matching on a loose "last 8 digits" substring is dangerous: it drops the
 * area code (DDD) and collides across different people, which would leak Wi-Fi/lock
 * codes to the wrong guest.
 *
 * `canonicalBR` produces a strict comparison key = DDD + last 8 digits (10 chars),
 * collapsing the 9th-digit and country-code variants while KEEPING the area code.
 * Two numbers match only if their canonical keys are equal.
 */

export function digitsOnly(input: string | null | undefined): string {
  return (input || "").replace(/\D/g, "");
}

/**
 * Canonical key for a Brazilian-style number: <DDD(2)><last 8 digits>.
 * Returns null when the number is too short to safely identify (we then fail closed).
 */
export function canonicalBR(input: string | null | undefined): string | null {
  let d = digitsOnly(input);
  // Strip country code 55 when present (handles +55 / 55 prefixes on 12-13 digit numbers).
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  // Expect 10 (DDD + 8) or 11 (DDD + 9 + 8). Anything shorter is ambiguous.
  if (d.length < 10) return null;
  const ddd = d.slice(0, 2);
  const last8 = d.slice(-8);
  return ddd + last8;
}

/** True only when both numbers resolve to the same canonical key. */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = canonicalBR(a);
  const kb = canonicalBR(b);
  return ka !== null && ka === kb;
}

/** Last-8 digits — used ONLY as a broad SQL candidate net, never as the final match. */
export function last8(input: string | null | undefined): string {
  return digitsOnly(input).slice(-8);
}
