// Tailored skeleton for the Imóveis grid (filter + card grid — no stat cards).
export default function PropertiesLoading() {
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="fixed top-0 left-0 right-0 h-0.5 z-50 overflow-hidden bg-brand-100" role="status" aria-label="Carregando">
        <div className="h-full w-1/4 bg-brand-500 animate-progress-indeterminate" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-36 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-9 w-36 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-pulse">
            <div className="aspect-[4/3] bg-gray-200" />
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-2/3 bg-gray-200 rounded" />
                <div className="h-5 w-16 bg-gray-100 rounded-full" />
              </div>
              <div className="h-2.5 w-20 bg-gray-100 rounded" />
              <div className="flex items-center gap-3 pt-1">
                <div className="h-3 w-12 bg-gray-100 rounded" />
                <div className="h-3 w-12 bg-gray-100 rounded" />
                <div className="h-3 w-12 bg-gray-100 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
