/**
 * ChangeIndicator — blue dot at the top-left corner of an input.
 * Indicates the user has changed this property from its original value.
 * Click resets the property; works with global undo/redo.
 *
 * Uses native pointerdown listener for Shadow DOM compatibility.
 */

import { useCallback, useRef } from "react";
import { Tooltip } from "./tooltip";

export interface ChangeIndicatorProps {
  isChanged: boolean;
  onReset: () => void;
}

export function ChangeIndicator({ isChanged, onReset }: ChangeIndicatorProps) {
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;

  // Ref callback: attach native pointerdown for Shadow DOM compatibility
  const dotRef = useCallback((el: HTMLSpanElement | null) => {
    if (!el) return;
    const handler = (e: PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onResetRef.current();
    };
    el.addEventListener("pointerdown", handler);
    return () => el.removeEventListener("pointerdown", handler);
  }, []);

  if (!isChanged) return null;

  return (
    <Tooltip content="Reset property" side="top" delay={200}>
      <span ref={dotRef} className="tuna-change-dot">
        <span className="tuna-change-dot-inner" />
      </span>
    </Tooltip>
  );
}
