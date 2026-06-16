// Instant navigation feedback for ALL PMS pages.
// The sidebar + topbar (client layout) persist across navigation; this skeleton
// fills only the <main> content area, so clicking a link shows feedback
// immediately instead of freezing on the current page until the server responds.
export default function DashboardLoading() {
  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Top progress bar (indeterminate) */}
      <div
        className="fixed top-0 left-0 right-0 h-0.5 z-50 overflow-hidden bg-brand-100"
        role="status"
        aria-label="Carregando"
      >
        <div className="h-full w-1/4 bg-brand-500 animate-progress-indeterminate" />
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5 animate-pulse"
          >
            <div className="flex justify-between items-center mb-3">
              <div className="h-3 w-16 bg-gray-200 rounded" />
              <div className="h-4 w-4 bg-gray-100 rounded" />
            </div>
            <div className="h-7 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-2.5 w-20 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Content block (list / table) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-6 animate-pulse">
        <div className="h-4 w-40 bg-gray-200 rounded mb-5" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 bg-gray-100 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 bg-gray-200 rounded" />
                <div className="h-2.5 w-1/4 bg-gray-100 rounded" />
              </div>
              <div className="h-6 w-16 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
