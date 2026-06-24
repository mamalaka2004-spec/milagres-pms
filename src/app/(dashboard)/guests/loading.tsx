// Tailored skeleton for the Hóspedes list (search + table — no stat cards).
export default function GuestsLoading() {
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="fixed top-0 left-0 right-0 h-0.5 z-50 overflow-hidden bg-brand-100" role="status" aria-label="Carregando">
        <div className="h-full w-1/4 bg-brand-500 animate-progress-indeterminate" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="h-7 w-36 bg-gray-200 rounded animate-pulse" />
        <div className="h-9 w-40 bg-gray-200 rounded-lg animate-pulse" />
      </div>

      <div className="flex items-center gap-2">
        <div className="h-9 flex-1 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-9 w-20 bg-gray-200 rounded-lg animate-pulse" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
        <div className="divide-y divide-gray-50">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-1/3 bg-gray-200 rounded" />
                <div className="h-2.5 w-1/4 bg-gray-100 rounded" />
              </div>
              <div className="hidden md:block h-4 w-12 bg-gray-100 rounded" />
              <div className="hidden md:block h-4 w-16 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
