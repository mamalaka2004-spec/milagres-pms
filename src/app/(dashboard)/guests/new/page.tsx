import { GuestForm } from "@/components/guests/guest-form";

interface PageProps {
  searchParams: Promise<{ return?: string }>;
}

export default async function NewGuestPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <GuestForm redirectAfter={params.return || "/guests"} />;
}
