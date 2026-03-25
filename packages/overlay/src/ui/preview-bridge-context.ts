import { createContext, useContext } from "react";
import type { PreviewBridge } from "./preview-bridge";

export const PreviewBridgeContext = createContext<PreviewBridge | null>(null);

export function usePreviewBridge() {
  return useContext(PreviewBridgeContext);
}
