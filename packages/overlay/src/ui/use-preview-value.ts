/**
 * usePreviewValue — subscribes an input DOM element to live drag preview values.
 * During drag: writes directly to the DOM input, bypassing React.
 * When not dragging: does nothing, React controls the input normally.
 */

import { useEffect, useRef } from "react";
import { usePreviewBridge } from "./preview-bridge-context";

/**
 * @param prop The CSS property name this input displays (e.g. "width", "top")
 * @param inputRef A ref to the input DOM element
 */
export function usePreviewValue(prop: string, inputRef: React.RefObject<HTMLInputElement | null>) {
  const bridge = usePreviewBridge();
  // Track whether we're currently showing a preview value
  const previewActiveRef = useRef(false);

  useEffect(() => {
    if (!bridge) return;

    const unsubscribe = bridge.subscribe(prop, (value) => {
      const el = inputRef.current;
      if (!el) return;

      if (value && bridge.active) {
        // Write directly to DOM — bypass React
        el.value = value;
        previewActiveRef.current = true;
      } else {
        // Preview ended — let React take over on next render
        previewActiveRef.current = false;
      }
    });

    return unsubscribe;
  }, [bridge, prop, inputRef]);

  return previewActiveRef;
}
