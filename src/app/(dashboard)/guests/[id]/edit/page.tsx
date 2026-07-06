import { notFound } from "next/navigation";
import { GuestForm } from "@/components/guests/guest-form";
import { getGuestById } from "@/lib/db/queries/guests";
import { requirePageAuth } from "@/lib/auth";
import type { GuestInput } from "@/lib/validations/guest";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditGuestPage({ params }: PageProps) {
  const user = await requirePageAuth();
  const { id } = await params;

  let guest;
  try {
    guest = await getGuestById(id);
  } catch {
    notFound();
  }
  if (!guest || guest.company_id !== user.company_id) notFound();

  const initialData: Partial<GuestInput> & { id: string } = {
    id: guest.id,
    full_name: guest.full_name,
    email: guest.email || "",
    phone: guest.phone || "",
    document_number: guest.document_number || "",
    document_type: (guest.document_type as GuestInput["document_type"]) || undefined,
    date_of_birth: guest.date_of_birth || "",
    nationality: guest.nationality || "",
    city: guest.city || "",
    state: guest.state || "",
    country: guest.country || "BR",
    language: guest.language || "pt-BR",
    notes: guest.notes || "",
    tags: guest.tags || undefined,
    is_vip: guest.is_vip ?? false,
  };

  return <GuestForm initialData={initialData} redirectAfter={`/guests/${guest.id}`} />;
}
