import { cn } from "@/lib/utils/cn";
import { RESERVATION_STATUSES, PAYMENT_STATUSES, TASK_STATUSES, PRIORITIES, CHANNELS } from "@/lib/utils/constants";
import type { ReservationStatus, PaymentStatus, TaskStatus, Priority, Channel } from "@/types/database";

interface BadgeProps {
  className?: string;
}

export function ReservationStatusBadge({ status, className }: { status: ReservationStatus } & BadgeProps) {
  const config = RESERVATION_STATUSES[status];
  return (
    <span
      className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide whitespace-nowrap", className)}
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      {config.label}
    </span>
  );
}

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus } & BadgeProps) {
  const config = PAYMENT_STATUSES[status];
  return (
    <span
      className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide whitespace-nowrap", className)}
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      {config.label}
    </span>
  );
}

export function TaskStatusBadge({ status, className }: { status: TaskStatus } & BadgeProps) {
  const config = TASK_STATUSES[status];
  return (
    <span
      className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide whitespace-nowrap", className)}
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      {config.label}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority } & BadgeProps) {
  const config = PRIORITIES[priority];
  return (
    <span
      className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide whitespace-nowrap", className)}
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      {config.label}
    </span>
  );
}

export function ChannelBadge({ channel, className }: { channel: Channel } & BadgeProps) {
  const config = CHANNELS[channel];
  return (
    <span
      className={cn("text-[10px] font-bold uppercase tracking-wider", className)}
      style={{ color: config.color }}
    >
      {config.label}
    </span>
  );
}
