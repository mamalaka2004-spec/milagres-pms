import { Sparkles } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { ChatWindow } from "@/components/ai/chat-window";

export const dynamic = "force-dynamic";

export default async function AiAssistantPage() {
  await requireAuth();

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center">
          <Sparkles size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">AI Assistant</h1>
          <p className="text-xs text-gray-500">Powered by OpenAI · responde com dados reais via tools</p>
        </div>
      </div>
      <ChatWindow />
    </div>
  );
}
