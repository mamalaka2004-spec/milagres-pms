import Link from "next/link";
import { List, CalendarClock, CalendarDays, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { CALENDAR_VIEWS, calendarHref, type CalendarParams, type CalendarView } from "@/lib/calendar/view";

const ICONS: Record<CalendarView, typeof List> = {
  lista: List,
  dia: CalendarClock,
  mes: CalendarDays,
  ano: CalendarRange,
};

export function ViewSwitcher({ params }: { params: CalendarParams }) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-gray-100 border border-gray-200">
      {CALENDAR_VIEWS.map((v) => {
        const Icon = ICONS[v.value];
        const active = params.view === v.value;
        return (
          <Link
            key={v.value}
            href={calendarHref({ ...params, view: v.value })}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40",
              active
                ? "bg-white text-brand-700 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            )}
          >
            <Icon size={15} aria-hidden="true" />
            <span className="hidden sm:inline">{v.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
