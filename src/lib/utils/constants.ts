import type { ReservationStatus, PaymentStatus, Channel, TaskStatus, Priority } from "@/types/database";

// ─── Reservation Status ───
export const RESERVATION_STATUSES: Record<
  ReservationStatus,
  { label: string; color: string; bgColor: string }
> = {
  inquiry: { label: "Inquiry", color: "#6b21a8", bgColor: "#f3e8ff" },
  pending: { label: "Pending", color: "#92400e", bgColor: "#fef3c7" },
  confirmed: { label: "Confirmed", color: "#166534", bgColor: "#dcfce7" },
  checked_in: { label: "Checked In", color: "#1e40af", bgColor: "#dbeafe" },
  checked_out: { label: "Checked Out", color: "#374151", bgColor: "#f3f4f6" },
  canceled: { label: "Canceled", color: "#991b1b", bgColor: "#fee2e2" },
  no_show: { label: "No Show", color: "#991b1b", bgColor: "#fee2e2" },
};

// ─── Payment Status ───
export const PAYMENT_STATUSES: Record<
  PaymentStatus,
  { label: string; color: string; bgColor: string }
> = {
  unpaid: { label: "Unpaid", color: "#991b1b", bgColor: "#fee2e2" },
  partially_paid: { label: "Partial", color: "#92400e", bgColor: "#fef3c7" },
  paid: { label: "Paid", color: "#166534", bgColor: "#dcfce7" },
  refunded: { label: "Refunded", color: "#374151", bgColor: "#f3f4f6" },
};

// ─── Channels ───
export const CHANNELS: Record<
  Channel,
  { label: string; color: string }
> = {
  direct: { label: "Direct", color: "#6B7F5E" },
  airbnb: { label: "Airbnb", color: "#FF5A5F" },
  booking: { label: "Booking", color: "#003580" },
  expedia: { label: "Expedia", color: "#00355F" },
  vrbo: { label: "VRBO", color: "#0061E0" },
  manual: { label: "Manual", color: "#737373" },
  other: { label: "Other", color: "#94a3b8" },
};

// ─── Task Status ───
export const TASK_STATUSES: Record<
  TaskStatus,
  { label: string; color: string; bgColor: string }
> = {
  pending: { label: "Pending", color: "#92400e", bgColor: "#fef3c7" },
  in_progress: { label: "In Progress", color: "#1e40af", bgColor: "#dbeafe" },
  completed: { label: "Completed", color: "#166534", bgColor: "#dcfce7" },
  skipped: { label: "Skipped", color: "#374151", bgColor: "#f3f4f6" },
};

// ─── Priority ───
export const PRIORITIES: Record<
  Priority,
  { label: string; color: string; bgColor: string }
> = {
  low: { label: "Low", color: "#374151", bgColor: "#f3f4f6" },
  normal: { label: "Normal", color: "#374151", bgColor: "#f3f4f6" },
  high: { label: "High", color: "#92400e", bgColor: "#fef3c7" },
  urgent: { label: "Urgent", color: "#991b1b", bgColor: "#fee2e2" },
};

// ─── Valid Status Transitions ───
export const VALID_STATUS_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  inquiry: ["pending", "canceled"],
  pending: ["confirmed", "canceled"],
  confirmed: ["checked_in", "canceled", "no_show"],
  checked_in: ["checked_out"],
  checked_out: [],
  canceled: [],
  no_show: [],
};

// ─── Company Defaults ───
export const COMPANY_PREFIX = "MIL";
export const DEFAULT_CURRENCY = "BRL";
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";
export const DEFAULT_LANGUAGE = "pt-BR";
export const SUPPORTED_LANGUAGES = ["pt-BR", "en", "es"] as const;

// ─── Nav Items ───
export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { id: "reservations", label: "Reservations", href: "/reservations", icon: "CalendarDays" },
  { id: "calendar", label: "Calendar", href: "/calendar", icon: "Calendar" },
  { id: "guests", label: "Guests", href: "/guests", icon: "Users" },
  { id: "properties", label: "Properties", href: "/properties", icon: "Home" },
  { id: "finance", label: "Finance", href: "/finance", icon: "DollarSign" },
  { id: "operations", label: "Operations", href: "/operations", icon: "ClipboardList" },
] as const;

export const BOTTOM_NAV_ITEMS = [
  { id: "dashboard", label: "Home", href: "/dashboard", icon: "LayoutDashboard" },
  { id: "reservations", label: "Bookings", href: "/reservations", icon: "CalendarDays" },
  { id: "calendar", label: "Calendar", href: "/calendar", icon: "Calendar" },
  { id: "properties", label: "Properties", href: "/properties", icon: "Home" },
  { id: "ai", label: "AI", href: "/ai-assistant", icon: "Sparkles" },
] as const;
