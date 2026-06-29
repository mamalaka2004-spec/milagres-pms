import { StatusBadge } from "@/components/ui/status-badge";
import type {
  ReservationStatus,
  PaymentStatus,
  TaskStatus,
  Priority,
  Channel,
} from "@/types/database";

/**
 * Back-compat shims — the five status badges now delegate to the unified
 * `<StatusBadge type value />` in `components/ui`. Existing screens keep their
 * named imports; new screens should prefer `<StatusBadge>` directly.
 */
interface BadgeProps {
  className?: string;
}

export function ReservationStatusBadge({ status, className }: { status: ReservationStatus } & BadgeProps) {
  return <StatusBadge type="reservation" value={status} className={className} />;
}

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus } & BadgeProps) {
  return <StatusBadge type="payment" value={status} className={className} />;
}

export function TaskStatusBadge({ status, className }: { status: TaskStatus } & BadgeProps) {
  return <StatusBadge type="task" value={status} className={className} />;
}

export function PriorityBadge({ priority, className }: { priority: Priority } & BadgeProps) {
  return <StatusBadge type="priority" value={priority} className={className} />;
}

export function ChannelBadge({ channel, className }: { channel: Channel } & BadgeProps) {
  return <StatusBadge type="channel" value={channel} className={className} />;
}
