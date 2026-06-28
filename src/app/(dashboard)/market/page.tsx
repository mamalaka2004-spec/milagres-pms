import { TrendingUp } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import MarketOverview, { type MarketProperty } from "@/components/market/market-overview";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const user = await requireAuth();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("properties")
    .select("id, name, city, state, latitude, longitude, bedrooms, base_price_cents, status")
    .eq("company_id", user.company_id)
    .order("name");

  const properties = (data as MarketProperty[]) || [];
  const canRun = user.role === "admin" || user.role === "manager";

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center">
          <TrendingUp size={16} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Análise de Mercado</h1>
          <p className="text-xs text-gray-500">Tarifa sugerida e comparáveis por imóvel · Airbnb &amp; Booking via GeckoAPI</p>
        </div>
      </div>

      <MarketOverview properties={properties} canRun={canRun} />
    </div>
  );
}
