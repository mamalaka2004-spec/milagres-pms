import { Loader2, AlertCircle, CheckCheck } from "lucide-react";
import type { WaMessageStatus } from "@/types/database";

/** Outbound message delivery status icon (shared by both chat surfaces). */
export function StatusIcon({ status }: { status: WaMessageStatus }) {
  if (status === "pending") return <Loader2 size={11} className="animate-spin" />;
  if (status === "failed") return <AlertCircle size={11} />;
  if (status === "read") return <CheckCheck size={11} className="text-blue-300" />;
  if (status === "sent" || status === "delivered") return <CheckCheck size={11} />;
  return null;
}
