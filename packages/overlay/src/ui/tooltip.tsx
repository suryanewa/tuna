/**
 * Tooltip — dark tooltip with optional keyboard shortcut badge.
 * Matches the portfolio editor's tooltip design. Plain CSS, no Radix.
 */

import { useState, useRef, useCallback, useLayoutEffect, type ReactNode } from "react";

export interface TooltipProps {
  content: ReactNode;
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  delay?: number;
  children: ReactNode;
}

export function Tooltip({
  content,
  shortcut,
  side = "bottom",
  sideOffset = 6,
  delay = 400,
  children,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  // Position after becoming visible
  useLayoutEffect(() => {
    if (!visible) {
      setCoords(null);
      return;
    }
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    // display:contents means the wrapper has no box — measure the first child instead
    const triggerEl = trigger.children[0] as HTMLElement | null;
    if (!triggerEl) return;

    const tr = triggerEl.getBoundingClientRect();
    const tt = tooltip.getBoundingClientRect();

    let top = 0;
    let left = 0;

    if (side === "bottom") {
      top = tr.bottom + sideOffset;
      left = tr.left + (tr.width - tt.width) / 2;
    } else if (side === "top") {
      top = tr.top - tt.height - sideOffset;
      left = tr.left + (tr.width - tt.width) / 2;
    } else if (side === "right") {
      top = tr.top + (tr.height - tt.height) / 2;
      left = tr.right + sideOffset;
    } else {
      top = tr.top + (tr.height - tt.height) / 2;
      left = tr.left - tt.width - sideOffset;
    }

    // Clamp to viewport
    left = Math.max(4, Math.min(left, window.innerWidth - tt.width - 4));
    top = Math.max(4, Math.min(top, window.innerHeight - tt.height - 4));

    setCoords({ top, left });
  }, [visible, side, sideOffset]);

  return (
    <div
      ref={triggerRef}
      className="composer-tooltip-trigger"
      onPointerEnter={show}
      onPointerLeave={hide}
      onPointerDown={hide}
    >
      {children}
      {visible && (
        <div
          ref={tooltipRef}
          className={`composer-tooltip composer-tooltip-${side}`}
          style={coords ? { top: coords.top, left: coords.left, opacity: 1 } : { opacity: 0 }}
        >
          <span className="composer-tooltip-text">{content}</span>
          {shortcut && (
            <span className="composer-tooltip-shortcut">{shortcut}</span>
          )}
        </div>
      )}
    </div>
  );
}
