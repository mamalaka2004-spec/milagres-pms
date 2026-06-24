import { MessageSquare } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { WhatsappShell } from "@/components/whatsapp/whatsapp-shell";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  await requireAuth();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center shrink-0">
          <MessageSquare size={16} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg lg:text-xl font-bold text-gray-900 leading-tight">Chat Reservas</h1>
          <p className="text-xs text-gray-500">Atendimento WhatsApp · tempo real</p>
        </div>
      </div>
      <WhatsappShell />
    </div>
  );
}
