import { type LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface StatsCardProps {
  label: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
}

export function StatsCard({ label, value, subtitle, icon: Icon, trend, trendUp }: StatsCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 lg:p-5">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs lg:text-[13px] text-gray-500 font-medium">{label}</span>
        <Icon size={16} className="text-brand-400 shrink-0" />
      </div>
      <div className="text-xl lg:text-[28px] font-bold text-gray-900 tracking-tight leading-tight">
        {value}
      </div>
      <div className="flex justify-between items-center mt-1">
        <span className="text-[10px] lg:text-xs text-gray-400">{subtitle}</span>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-[11px] font-semibold",
              trendUp ? "text-green-600" : "text-red-500"
            )}
          >
            {trendUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
