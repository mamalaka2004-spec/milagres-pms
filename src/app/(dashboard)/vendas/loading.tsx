// Chat Vendas skeleton — mirrors the toggle row + 3-pane workspace.
export default function VendasLoading() {
  return (
    <div className="space-y-3">
      <div className="fixed top-0 left-0 right-0 h-0.5 z-50 overflow-hidden bg-brand-100" role="status" aria-label="Carregando">
        <div className="h-full w-1/4 bg-brand-500 animate-progress-indeterminate" />
      </div>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-200 animate-pulse" />
        <div className="space-y-1.5"><div className="h-4 w-28 bg-gray-200 rounded animate-pulse" /><div className="h-2.5 w-44 bg-gray-100 rounded animate-pulse" /></div>
      </div>
      <div className="h-8 w-48 bg-gray-100 rounded-xl animate-pulse" />
      <div className="h-[calc(100dvh-13rem)] min-h-[560px] flex border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="w-full lg:w-[330px] xl:w-[370px] shrink-0 border-r border-gray-200 bg-gray-50/40 flex flex-col">
          <div className="p-3 border-b border-gray-100 bg-white space-y-2.5">
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-9 w-full bg-gray-100 rounded-lg animate-pulse" />
          </div>
          <div className="flex-1 p-2 space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2.5 px-2 py-2.5 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-2"><div className="h-3 w-2/3 bg-gray-200 rounded" /><div className="h-2.5 w-1/2 bg-gray-100 rounded" /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 hidden lg:flex flex-col">
          <div className="h-16 border-b border-gray-100 bg-white flex items-center gap-3 px-5 animate-pulse"><div className="w-9 h-9 rounded-full bg-gray-200" /><div className="space-y-2"><div className="h-3 w-40 bg-gray-200 rounded" /><div className="h-2.5 w-28 bg-gray-100 rounded" /></div></div>
          <div className="flex-1 p-6 space-y-3 bg-gradient-to-b from-amber-50/40 to-white">
            {[{ me: false, w: "55%" }, { me: true, w: "45%" }, { me: false, w: "60%" }, { me: true, w: "40%" }, { me: false, w: "50%" }].map((b, i) => (
              <div key={i} className={`flex ${b.me ? "justify-end" : "justify-start"}`}><div className={`h-10 rounded-2xl animate-pulse ${b.me ? "bg-amber-200/60" : "bg-gray-200"}`} style={{ width: b.w }} /></div>
            ))}
          </div>
          <div className="p-3 border-t border-gray-100 bg-white flex gap-2 items-center"><div className="flex-1 h-10 bg-gray-100 rounded-2xl animate-pulse" /><div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" /></div>
        </div>
        <div className="hidden xl:flex w-[330px] shrink-0 border-l border-gray-200 bg-gray-50/40 flex-col p-5 gap-4">
          <div className="h-10 w-full bg-gray-100 rounded-lg animate-pulse" />
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 w-full bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      </div>
    </div>
  );
}
