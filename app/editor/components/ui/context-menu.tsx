"use client";

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { usePortalContainer } from "@/lib/portal-container";
import { Check16 } from "@/components/icons/editor-16";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ContextMenuItemDef =
  | {
      type?: "item";
      label: string;
      shortcut?: string;
      disabled?: boolean;
      onClick: () => void;
    }
  | { type: "separator" }
  | { type: "heading"; label: string }
  | {
      type: "check";
      label: string;
      checked: boolean;
      onClick: () => void;
    };

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface ContextMenuState<T> {
  isOpen: boolean;
  position: { x: number; y: number };
  meta: T | null;
}

export function useContextMenu<T = unknown>() {
  const [state, setState] = useState<ContextMenuState<T>>({
    isOpen: false,
    position: { x: 0, y: 0 },
    meta: null,
  });
  const menuRef = useRef<HTMLDivElement>(null);

  const open = useCallback((x: number, y: number, meta: T) => {
    setState({ isOpen: true, position: { x, y }, meta });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const onContextMenu = useCallback(
    (e: React.MouseEvent, meta: T) => {
      e.preventDefault();
      e.stopPropagation();
      open(e.clientX, e.clientY, meta);
    },
    [open]
  );

  // Dismiss: mousedown outside, Escape, wheel (outside menu only)
  useEffect(() => {
    if (!state.isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        e.stopImmediatePropagation();
      }
    };
    const handleWheel = (e: WheelEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("wheel", handleWheel);
    };
  }, [state.isOpen, close]);

  return { state, menuRef, open, close, onContextMenu };
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface ContextMenuProps {
  items: ContextMenuItemDef[];
  position: { x: number; y: number };
  width?: number;
  onClose: () => void;
  className?: string;
}

export const ContextMenu = React.forwardRef<HTMLDivElement, ContextMenuProps>(
  function ContextMenu({ items, position, width = 160, onClose, className }, ref) {
    const portalContainer = usePortalContainer();
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    // Viewport bounds clamping
    const x = Math.min(position.x, window.innerWidth - width - 8);
    const estimatedH = Math.min(
      400,
      items.reduce((h, item) => {
        if (item.type === "separator") return h + 16;
        if (item.type === "heading") return h + 24;
        return h + 24;
      }, 16) // 16 = py-2 top+bottom
    );
    const y = Math.max(8, Math.min(position.y, window.innerHeight - estimatedH - 8));

    let buttonIndex = 0;

    const menu = (
      <div
        ref={ref}
        className={cn("fixed z-[9999] rounded-[12px] overflow-clip", className)}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e) => e.stopPropagation()}
        style={{
          left: x,
          top: y,
          width,
          boxShadow:
            "0px 0px 0.5px 0px rgba(0,0,0,0.12), 0px 10px 16px 0px rgba(0,0,0,0.12), 0px 2px 5px 0px rgba(0,0,0,0.15)",
        }}
      >
        <div className="max-h-[400px] overflow-y-auto py-2 bg-stone-900">
          {items.map((item, i) => {
            if (item.type === "separator") {
              return (
                <div key={`sep-${i}`} className="h-4 flex items-center">
                  <div className="w-full h-px bg-stone-800" />
                </div>
              );
            }

            if (item.type === "heading") {
              return (
                <div
                  key={`heading-${i}`}
                  className="px-4 py-1 text-[11px] font-[450] tracking-[0.055px] leading-[16px] text-white/40"
                >
                  {item.label}
                </div>
              );
            }

            if (item.type === "check") {
              const idx = buttonIndex++;
              const isHighlighted = highlightedIndex === idx;
              return (
                <div key={`check-${i}`} className="px-2">
                  <button
                    type="button"
                    className={cn(
                      "relative flex items-center w-full min-h-[24px] pl-6 pr-2 rounded-[5px]",
                      "text-[11px] font-[450] tracking-[0.055px] leading-[16px] text-white",
                      isHighlighted && "bg-white/10"
                    )}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onMouseLeave={() => setHighlightedIndex(-1)}
                    onClick={() => {
                      item.onClick();
                      onClose();
                    }}
                  >
                    {item.checked && (
                      <Check16 className="absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 text-white" />
                    )}
                    <span className="leading-[16px] whitespace-nowrap">{item.label}</span>
                  </button>
                </div>
              );
            }

            // Default: "item" type
            const idx = buttonIndex++;
            const isHighlighted = highlightedIndex === idx;
            return (
              <div key={`item-${i}`} className="px-2">
                <button
                  type="button"
                  className={cn(
                    "flex items-center w-full min-h-[24px] px-2 gap-1 rounded-[5px]",
                    "text-[11px] font-[450] tracking-[0.055px] leading-[16px] text-left",
                    item.disabled
                      ? "text-white/40 cursor-not-allowed"
                      : "text-white cursor-default",
                    isHighlighted && !item.disabled && "bg-white/10"
                  )}
                  disabled={item.disabled}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onMouseLeave={() => setHighlightedIndex(-1)}
                  onClick={item.disabled ? undefined : () => {
                    item.onClick();
                    onClose();
                  }}
                >
                  <span className="flex-1 whitespace-nowrap truncate">{item.label}</span>
                  {item.shortcut && (
                    <span className="ml-auto pl-4 text-white/70 whitespace-nowrap">
                      {item.shortcut}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );

    return createPortal(menu, portalContainer ?? document.body);
  }
);
