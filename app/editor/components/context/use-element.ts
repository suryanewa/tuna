import { useStorage } from "@liveblocks/react";
import type { CanvasElement } from "@/lib/playground/store";

/**
 * Granular per-element subscription. Only re-renders when THIS specific
 * element's data changes in Liveblocks storage, not when any element changes.
 */
export function useElement(id: string): CanvasElement | undefined {
  return useStorage((root) => root.elements?.get(id)) as
    | CanvasElement
    | undefined;
}
