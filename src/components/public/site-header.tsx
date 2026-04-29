"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Leaf, MessageCircle, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SiteHeaderProps {
  /** Whether the page below is a hero with a colored background — header becomes transparent until scroll. */
  transparent?: boolean;
  whatsappUrl?: string;
}

export function SiteHeader({ transparent = false, whatsappUrl = "https://wa.me/5582999999999" }: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const overlay = transparent && !scrolled;

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        overlay
          ? "bg-transparent border-b border-transparent"
          : "bg-white/95 backdrop-blur border-b border-gray-100"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 md:h-[72px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
            <Leaf size={16} className="text-brand-100" strokeWidth={2.5} />
          </div>
          <div className="hidden md:block">
            <div
              className={cn(
                "font-heading text-base font-semibold tracking-[0.15em]",
                overlay ? "text-brand-100" : "text-brand-700"
              )}
            >
              MILAGRES
            </div>
            <div
              className={cn(
                "text-[8px] font-light tracking-[0.4em] uppercase",
                overlay ? "text-brand-100/80" : "text-gray-500"
              )}
            >
              Hospedagens
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          <Link
            href="/"
            className={cn(
              "text-sm font-light tracking-wide transition",
              overlay ? "text-brand-100/90 hover:text-brand-100" : "text-gray-600 hover:text-gray-900"
            )}
          >
            Início
          </Link>
          <a
            href="/#properties"
            className={cn(
              "text-sm font-light tracking-wide transition",
              overlay ? "text-brand-100/90 hover:text-brand-100" : "text-gray-600 hover:text-gray-900"
            )}
          >
            Propriedades
          </a>
          <Link
            href="/contact"
            className={cn(
              "text-sm font-light tracking-wide transition",
              overlay ? "text-brand-100/90 hover:text-brand-100" : "text-gray-600 hover:text-gray-900"
            )}
          >
            Contato
          </Link>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition",
              overlay
                ? "bg-white/15 hover:bg-white/25 text-brand-100 border border-white/20 backdrop-blur-sm"
                : "bg-brand-500 hover:bg-brand-600 text-brand-100"
            )}
          >
            <MessageCircle size={14} /> WhatsApp
          </a>
        </nav>

        <div className="md:hidden flex items-center gap-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition",
              overlay ? "bg-white/15 text-brand-100 border border-white/20" : "bg-brand-500 text-brand-100"
            )}
          >
            <MessageCircle size={16} />
          </a>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className={cn("p-2", overlay ? "text-brand-100" : "text-gray-700")}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white shadow-lg">
          <div className="flex flex-col px-6 py-4 gap-3">
            <Link href="/" onClick={() => setMenuOpen(false)} className="py-2 text-gray-700">
              Início
            </Link>
            <a
              href="/#properties"
              onClick={() => setMenuOpen(false)}
              className="py-2 text-gray-700"
            >
              Propriedades
            </a>
            <Link href="/contact" onClick={() => setMenuOpen(false)} className="py-2 text-gray-700">
              Contato
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter({ whatsappUrl = "https://wa.me/5582999999999" }: { whatsappUrl?: string }) {
  return (
    <footer className="bg-brand-700 text-brand-100 py-12 px-4 md:px-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
              <Leaf size={14} className="text-brand-100" />
            </div>
            <span className="font-heading text-base tracking-[0.15em]">MILAGRES</span>
          </div>
          <p className="text-sm text-brand-100/70 leading-relaxed max-w-xs">
            Propriedades exclusivas em São Miguel dos Milagres, Alagoas.
          </p>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-400 mb-3">
            Contato
          </div>
          <div className="space-y-2 text-sm text-brand-100/85">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-brand-100">
              <MessageCircle size={13} className="text-brand-400" /> WhatsApp
            </a>
            <a href="mailto:contato@milagreshospedagens.com" className="block hover:text-brand-100">
              contato@milagreshospedagens.com
            </a>
            <span className="block text-brand-100/60">São Miguel dos Milagres, AL</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-400 mb-3">
            Links
          </div>
          <div className="space-y-2 text-sm text-brand-100/85">
            <Link href="/" className="block hover:text-brand-100">Início</Link>
            <Link href="/#properties" className="block hover:text-brand-100">Propriedades</Link>
            <Link href="/contact" className="block hover:text-brand-100">Contato</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-brand-600 mt-10 pt-6 text-center text-[11px] text-brand-100/50">
        © 2026 Milagres Hospedagens
      </div>
    </footer>
  );
}
