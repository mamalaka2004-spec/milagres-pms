// Agenda-specific skeleton. Mirrors the real page (title → 4 stats → month nav →
// gantt grid) so navigating to /calendar shows matching placeholders instead of a
// generic cards+list skeleton that snaps into a different shape.
export default function CalendarLoading() {
  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Top indeterminate progress bar */}
      <div
        className="fixed top-0 left-0 right-0 h-0.5 z-50 overflow-hidden bg-brand-100"
        role="status"
        aria-label="Carregando"
      >
        <div className="h-full w-1/4 bg-brand-500 animate-progress-indeterminate" />
      </div>

      {/* Title */}
      <div className="space-y-2">
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-3.5 w-72 max-w-full bg-gray-100 rounded animate-pulse" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 lg:p-5 flex items-center gap-4 animate-pulse">
            <div className="w-11 h-11 rounded-xl bg-gray-100 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-12 bg-gray-200 rounded" />
              <div className="h-2.5 w-20 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-9 w-44 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-9 w-9 bg-gray-100 rounded-lg animate-pulse" />
      </div>

      {/* Gantt grid */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* header strip */}
        <div className="h-11 border-b border-gray-200 flex items-center">
          <div className="w-[240px] px-4 border-r border-gray-200">
            <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex-1 flex gap-px px-1">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="flex-1 h-5 bg-gray-100 rounded-sm animate-pulse" />
            ))}
          </div>
        </div>
        {/* rows */}
        {Array.from({ length: 6 }).map((_, row) => (
          <div key={row} className="h-[72px] border-b border-gray-100 flex items-center">
            <div className="w-[240px] px-3 flex items-center gap-3 border-r border-gray-200">
              <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 bg-gray-200 rounded animate-pulse" />
                <div className="h-2 w-1/3 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
            <div className="flex-1 relative px-2">
              <div
                className="absolute top-1/2 -translate-y-1/2 h-7 bg-gray-100 rounded-lg animate-pulse"
                style={{ left: `${(row * 13) % 40}%`, width: `${25 + (row % 3) * 12}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
