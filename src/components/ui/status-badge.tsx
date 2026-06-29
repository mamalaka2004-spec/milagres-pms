import * as React from "react";
import { cn } from "@/lib/utils/cn";
import {
  RESERVATION_STATUSES,
  PAYMENT_STATUSES,
  TASK_STATUSES,
  PRIORITIES,
  CHANNELS,
} from "@/lib/utils/constants";
import type {
  ReservationStatus,
  PaymentStatus,
  TaskStatus,
  Priority,
  Channel,
} from "@/types/database";

/**
 * StatusBadge — single source of truth for every status pill in the app.
 * Unifies the five near-duplicate badges (reservation / payment / task /
 * priority / channel) behind one `type + value` API, reading labels and tones
 * from `constants.ts`. Channels render as bold colored text (no pill), matching
 * the long-standing ChannelBadge style; everything else is a tinted pill.
 */
const PILL =
  "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide whitespace-nowrap";

type StatusBadgeProps = { className?: string } & (
  | { type: "reservation"; value: ReservationStatus }
  | { type: "payment"; value: PaymentStatus }
  | { type: "task"; value: TaskStatus }
  | { type: "priority"; value: Priority }
  | { type: "channel"; value: Channel }
);

export function StatusBadge(props: StatusBadgeProps) {
  const { className } = props;

  if (props.type === "channel") {
    const cfg = CHANNELS[props.value];
    return (
      <span
        className={cn("text-[10px] font-bold uppercase tracking-wider", className)}
        style={{ color: cfg.color }}
      >
        {cfg.label}
      </span>
    );
  }

  const cfg =
    props.type === "reservation"
      ? RESERVATION_STATUSES[props.value]
      : props.type === "payment"
      ? PAYMENT_STATUSES[props.value]
      : props.type === "task"
      ? TASK_STATUSES[props.value]
      : PRIORITIES[props.value];

  return (
    <span
      className={cn(PILL, className)}
      style={{ backgroundColor: cfg.bgColor, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}
