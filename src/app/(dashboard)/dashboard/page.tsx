import { requireAuth } from "@/lib/auth";
import { getDashboardData } from "@/lib/db/queries/dashboard";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAuth();
  const data = await getDashboardData(user.company_id);

  return <DashboardView data={data} />;
}
