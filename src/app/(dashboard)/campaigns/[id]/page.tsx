import { requirePageAuth } from "@/lib/auth";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAuth();
  const { id } = await params;
  return <CampaignDetail campaignId={id} />;
}
