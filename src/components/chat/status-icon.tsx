import { Clock, AlertCircle, Check, CheckCheck } from "lucide-react";
import type { WaMessageStatus } from "@/types/database";

/** Outbound message delivery status icon (shared by both chat surfaces). */
export function StatusIcon({ status }: { status: WaMessageStatus }) {
  // Static clock (not a spinner) — a message that never confirms shouldn't spin forever.
  if (status === "pending") return <Clock size={11} className="opacity-50" />;
  if (status === "failed") return <AlertCircle size={11} className="text-red-400" />;
  if (status === "read") return <CheckCheck size={11} className="text-blue-300" />;
  if (status === "delivered") return <CheckCheck size={11} />;
  if (status === "sent") return <Check size={11} />;
  return null;
}
