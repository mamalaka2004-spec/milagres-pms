// Tailored skeleton for the Reservas list (filters + table — no stat cards).
export default function ReservationsLoading() {
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="fixed top-0 left-0 right-0 h-0.5 z-50 overflow-hidden bg-brand-100" role="status" aria-label="Carregando">
        <div className="h-full w-1/4 bg-brand-500 animate-progress-indeterminate" />
      </div>

      {/* Header: title + action */}
      <div className="flex items-center justify-between gap-3">
        <div className="h-7 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-9 w-36 bg-gray-200 rounded-lg animate-pulse" />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-9 flex-1 min-w-[180px] bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-9 w-36 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-9 w-36 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-9 w-20 bg-gray-200 rounded-lg animate-pulse" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_1.5fr_1.5fr_1.3fr_0.8fr_0.8fr] gap-4 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
        <div className="divide-y divide-gray-50">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="grid grid-cols-2 md:grid-cols-[1fr_1.5fr_1.5fr_1.3fr_0.8fr_0.8fr] gap-4 px-4 py-3.5 animate-pulse">
              <div className="h-4 w-20 bg-gray-200 rounded" />
              <div className="h-4 w-28 bg-gray-100 rounded" />
              <div className="hidden md:block h-4 w-24 bg-gray-100 rounded" />
              <div className="hidden md:block h-4 w-28 bg-gray-100 rounded" />
              <div className="hidden md:block h-4 w-14 bg-gray-100 rounded" />
              <div className="h-6 w-20 bg-gray-100 rounded-full justify-self-end md:justify-self-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
