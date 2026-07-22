import { BookUser } from "lucide-react";
import { requirePageAuth } from "@/lib/auth";
import { ContactsShell } from "@/components/contacts/contacts-shell";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  await requirePageAuth();
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500">
          <BookUser size={16} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">Contatos</h1>
          <p className="text-xs text-gray-500">
            Fonebook único (Locação + Vendas): categorias, tags, avaliação e opt-out
          </p>
        </div>
      </div>
      <ContactsShell />
    </div>
  );
}
