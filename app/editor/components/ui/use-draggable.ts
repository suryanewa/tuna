"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export function useDraggable(open: boolean) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) setOffset({ x: 0, y: 0 });
  }, [open]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("button, input, [role='button']")) return;

      e.preventDefault();
      startRef.current = {
        x: e.clientX,
        y: e.clientY,
        ox: offset.x,
        oy: offset.y,
      };

      const ac = new AbortController();

      const onMove = (ev: PointerEvent) => {
        if (!startRef.current) return;
        setIsDragging(true);
        setOffset({
          x: startRef.current.ox + ev.clientX - startRef.current.x,
          y: startRef.current.oy + ev.clientY - startRef.current.y,
        });
      };

      const onUp = () => {
        startRef.current = null;
        setIsDragging(false);
        ac.abort();
      };

      document.addEventListener("pointermove", onMove, { signal: ac.signal });
      document.addEventListener("pointerup", onUp, { signal: ac.signal });
      document.addEventListener("pointercancel", onUp, { signal: ac.signal });
    },
    [offset]
  );

  const transform =
    offset.x || offset.y
      ? `translate(${offset.x}px, ${offset.y}px)`
      : undefined;

  return { onPointerDown, transform, isDragging };
}
