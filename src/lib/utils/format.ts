import { format, parseISO, differenceInDays, type Locale } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";

// ─── Currency ───
export function formatCurrency(
  cents: number,
  currency: string = "BRL"
): string {
  const value = cents / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatCurrencyShort(cents: number): string {
  const value = cents / 100;
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return `R$ ${value.toFixed(0)}`;
}

// ─── Dates ───
const localeMap: Record<string, Locale> = {
  "pt-BR": ptBR,
  en: enUS,
  es: es,
};

export function formatDate(
  date: string | Date,
  pattern: string = "dd/MM/yyyy",
  locale: string = "pt-BR"
): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern, { locale: localeMap[locale] || ptBR });
}

export function formatDateShort(date: string | Date): string {
  return formatDate(date, "dd/MM");
}

export function formatDateLong(
  date: string | Date,
  locale: string = "pt-BR"
): string {
  return formatDate(date, "dd 'de' MMMM 'de' yyyy", locale);
}

export function formatTime(time: string): string {
  return time.substring(0, 5); // "15:00:00" → "15:00"
}

export function calculateNights(checkIn: string, checkOut: string): number {
  return differenceInDays(parseISO(checkOut), parseISO(checkIn));
}

// ─── Phone ───
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

// ─── Booking Code ───
export function generateBookingCode(
  prefix: string,
  year: number,
  sequence: number
): string {
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
}

// ─── Percentage ───
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

// ─── Initials ───
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}
