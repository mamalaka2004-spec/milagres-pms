"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

// O TS não tipa beforeinstallprompt (evento não-padrão do Chromium).
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "milagres-pwa-install-dismissed";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ se identifica como Mac, mas tem touch.
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || iPadOs;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Já instalado (rodando standalone) ou dispensado antes → não incomoda.
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    // iOS/iPadOS (qualquer navegador, todos são WebKit) não dispara
    // beforeinstallprompt — só resta instruir a instalação manual.
    if (isIos()) {
      setShowIosHelp(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!installEvent && !showIosHelp) return null;

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setInstallEvent(null);
    setShowIosHelp(false);
  };

  return (
    <div className="fixed left-4 right-4 bottom-20 lg:bottom-6 lg:left-auto lg:right-6 lg:w-80 z-[60] bg-brand-600 text-white rounded-xl shadow-xl p-4 flex items-center gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:pb-4">
      <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
        <Download size={20} aria-hidden="true" />
      </div>

      {showIosHelp ? (
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Instalar o app Milagres</div>
          <div className="text-xs text-white/80 mt-0.5 flex items-center gap-1 flex-wrap">
            Toque em
            <Share size={13} className="inline shrink-0" aria-label="Compartilhar" />
            <span className="font-medium">Compartilhar</span>
            e depois em
            <SquarePlus size={13} className="inline shrink-0" aria-hidden="true" />
            <span className="font-medium">&ldquo;Adicionar à Tela de Início&rdquo;</span>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Instalar o app Milagres</div>
            <div className="text-xs text-white/75">Acesso rápido direto da tela inicial</div>
          </div>
          <button
            onClick={install}
            className="shrink-0 bg-white text-brand-700 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            Instalar
          </button>
        </>
      )}

      <button
        onClick={dismiss}
        aria-label="Dispensar"
        className="shrink-0 p-1 text-white/60 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
