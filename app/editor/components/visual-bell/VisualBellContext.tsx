"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { VisualBellPortal } from "./VisualBellPortal";

// ─── Types ──────────────────────────────────────────────────────────────────

export type VisualBellVariant = "default" | "error";

export interface VisualBellAction {
  label: string;
  onClick: () => void;
}

export interface VisualBellOptions {
  message: string;
  variant?: VisualBellVariant;
  action?: VisualBellAction;
  /** Auto-dismiss in ms. Default 5000. Set 0 to require manual dismiss. */
  duration?: number;
}

export interface VisualBellEntry extends VisualBellOptions {
  id: string;
  variant: VisualBellVariant;
  duration: number;
}

interface VisualBellContextValue {
  bells: VisualBellEntry[];
  showBell: (options: VisualBellOptions) => string;
  dismissBell: (id: string) => void;
  dismissAll: () => void;
}

// ─── Context ────────────────────────────────────────────────────────────────

const VisualBellContext = createContext<VisualBellContextValue | null>(null);

export function useVisualBell(): VisualBellContextValue {
  const ctx = useContext(VisualBellContext);
  if (!ctx) throw new Error("useVisualBell must be used within VisualBellProvider");
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────────────

let bellCounter = 0;

export function VisualBellProvider({ children }: { children: ReactNode }) {
  const [bells, setBells] = useState<VisualBellEntry[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissBell = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setBells((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setBells([]);
  }, []);

  const showBell = useCallback(
    (options: VisualBellOptions): string => {
      const id = `bell-${++bellCounter}`;
      const entry: VisualBellEntry = {
        ...options,
        id,
        variant: options.variant ?? "default",
        duration: options.duration ?? 5000,
      };

      // Single-bell policy: replace any existing
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
      setBells([entry]);

      if (entry.duration > 0) {
        const timer = setTimeout(() => dismissBell(id), entry.duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismissBell]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const value = useMemo(
    () => ({ bells, showBell, dismissBell, dismissAll }),
    [bells, showBell, dismissBell, dismissAll]
  );

  return (
    <VisualBellContext.Provider value={value}>
      {children}
      <VisualBellPortal />
    </VisualBellContext.Provider>
  );
}
