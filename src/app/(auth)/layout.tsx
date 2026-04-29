export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left — Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-600 flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 opacity-90" />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 rounded-full bg-brand-100/15 flex items-center justify-center mx-auto mb-8 backdrop-blur-sm border border-brand-100/20">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F0EBE0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.1 17 3.1s.4 2 .4 4.9A12 12 0 0 1 11 20z" />
            </svg>
          </div>
          <h1 className="font-heading text-4xl text-brand-100 tracking-wider mb-2">
            MILAGRES
          </h1>
          <p className="font-body text-xs text-brand-100/60 tracking-[0.3em] uppercase">
            Hospedagens
          </p>
          <p className="font-body text-sm text-brand-100/50 mt-8 max-w-xs mx-auto leading-relaxed">
            Property Management System
          </p>
        </div>
      </div>

      {/* Right — Form Area */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
