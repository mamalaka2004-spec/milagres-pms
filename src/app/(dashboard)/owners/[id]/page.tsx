import { notFound } from "next/navigation";
import { getOwnerById } from "@/lib/db/queries/owners";
import { requireAuth } from "@/lib/auth";
import { OwnerDetail } from "./owner-detail";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OwnerDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;

  let owner;
  try {
    owner = await getOwnerById(id);
  } catch {
    notFound();
  }

  if (!owner || owner.company_id !== user.company_id) {
    notFound();
  }

  const canManage = user.role === "admin" || user.role === "manager";

  return <OwnerDetail owner={owner} canManage={canManage} />;
}
