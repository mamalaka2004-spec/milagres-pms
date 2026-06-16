// Instant feedback for the public site (home, property pages, booking flow),
// which are also force-dynamic and hit the DB on each visit.
export default function PublicLoading() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div
        className="fixed top-0 left-0 right-0 h-0.5 z-50 overflow-hidden bg-brand-100"
        role="status"
        aria-label="Carregando"
      >
        <div className="h-full w-1/4 bg-brand-500 animate-progress-indeterminate" />
      </div>
      <div
        className="w-8 h-8 rounded-full border-2 border-brand-200 border-t-brand-500 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
    </div>
  );
}
