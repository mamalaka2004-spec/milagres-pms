"use client";

import { Printer } from "lucide-react";

/**
 * Botão dependency-free que dispara o diálogo de impressão do navegador
 * (Imprimir → "Salvar como PDF"). O CSS `@media print` da apresentação cuida
 * do layout do PDF. Marcado com `no-print` para sumir na versão impressa.
 */
export function PrintButton({ label = "Imprimir / Salvar em PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
    >
      <Printer size={15} aria-hidden="true" /> {label}
    </button>
  );
}
