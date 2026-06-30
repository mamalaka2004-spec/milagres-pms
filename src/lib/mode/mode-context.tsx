"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { DEFAULT_MODE, MODE_STORAGE_KEY, isMode, type Mode } from "./types";

interface ModeContextValue {
  mode: Mode;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
  isLocacao: boolean;
  isVendas: boolean;
}

const ModeContext = createContext<ModeContextValue | null>(null);

interface ModeProviderProps {
  /** Mode resolved from the user's saved preferences (server). Null when unset. */
  serverMode: Mode | null;
  children: React.ReactNode;
}

/**
 * ModeProvider (#8). Source-of-truth precedence:
 *  1. The user's saved preference (serverMode) — canonical, cross-device, SSR-safe.
 *  2. localStorage — only adopted when the user has NO saved preference yet,
 *     so an early toggle isn't lost before it was persisted.
 *
 * Every change writes both localStorage (instant, cross-tab) and the user's
 * preferences via the API (durable). Initial render uses serverMode to avoid a
 * hydration mismatch / mode flicker.
 */
export function ModeProvider({ serverMode, children }: ModeProviderProps) {
  const [mode, setModeState] = useState<Mode>(serverMode ?? DEFAULT_MODE);
  const hasServerPref = serverMode !== null;
  // Avoid persisting back the value we just hydrated from.
  const lastPersisted = useRef<Mode>(serverMode ?? DEFAULT_MODE);

  // Reconcile with localStorage on mount (and react to other tabs).
  useEffect(() => {
    if (hasServerPref) {
      // Server preference wins — keep localStorage mirroring it.
      try {
        window.localStorage.setItem(MODE_STORAGE_KEY, serverMode as Mode);
      } catch {
        /* storage unavailable */
      }
      return;
    }
    try {
      const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (isMode(stored) && stored !== mode) {
        setModeState(stored);
        lastPersisted.current = stored;
      }
    } catch {
      /* storage unavailable */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cross-tab sync.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === MODE_STORAGE_KEY && isMode(e.newValue)) {
        lastPersisted.current = e.newValue;
        setModeState(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setMode = useCallback((next: Mode) => {
    setModeState((prev) => {
      if (prev === next) return prev;
      try {
        window.localStorage.setItem(MODE_STORAGE_KEY, next);
      } catch {
        /* storage unavailable */
      }
      if (lastPersisted.current !== next) {
        lastPersisted.current = next;
        // Durable, cross-device persistence. Fire-and-forget — UI already updated.
        fetch("/api/me/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: next }),
        }).catch(() => {
          /* offline / transient — localStorage still holds it */
        });
      }
      return next;
    });
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "locacao" ? "vendas" : "locacao");
  }, [mode, setMode]);

  return (
    <ModeContext.Provider
      value={{ mode, setMode, toggleMode, isLocacao: mode === "locacao", isVendas: mode === "vendas" }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within a <ModeProvider>");
  return ctx;
}
