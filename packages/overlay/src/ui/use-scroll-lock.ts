/**
 * useScrollLock — locks page scroll when a floating UI (dropdown, picker, dialog) is open.
 * Uses a module-level ref counter so nested opens (e.g. color picker inside a dropdown)
 * don't prematurely unlock.
 */

import { useEffect } from "react";

let lockCount = 0;
let savedOverflow = "";

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    if (lockCount === 0) {
      savedOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
    }
    lockCount++;

    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.documentElement.style.overflow = savedOverflow;
      }
    };
  }, [active]);
}
