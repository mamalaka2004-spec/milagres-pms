import { MessageSquare } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { WhatsappShell } from "@/components/whatsapp/whatsapp-shell";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  await requireAuth();

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center">
          <MessageSquare size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Conversations</h1>
          <p className="text-xs text-gray-500">WhatsApp · multi-linha · realtime</p>
        </div>
      </div>
      <WhatsappShell />
    </div>
  );
}
