"use client";

import { createContext, useContext } from "react";

/**
 * Context that overrides viewport-based width detection for editor mode.
 * When a value is provided, JS hooks use this width instead of window.innerWidth.
 * When null (standalone page, preview mode), hooks fall back to window.innerWidth.
 */
const ArtboardWidthContext = createContext<number | null>(null);

export const ArtboardWidthProvider = ArtboardWidthContext.Provider;

export function useArtboardWidth(): number | null {
  return useContext(ArtboardWidthContext);
}
