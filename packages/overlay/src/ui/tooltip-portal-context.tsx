import { createContext, useContext } from "react";

/**
 * Provides a DOM element for tooltips to portal into,
 * so they escape overflow:hidden on scrollable panels.
 */
export const TooltipPortalContext = createContext<HTMLElement | null>(null);

export function useTooltipPortal(): HTMLElement | null {
  return useContext(TooltipPortalContext);
}
