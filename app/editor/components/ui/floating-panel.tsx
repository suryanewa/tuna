"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { SectionHeader, type SectionHeaderIconButton } from "./section-header";
import { TextInput } from "./text-input";
import { CloseSmall, SearchSmall } from "@/components/icons/editor";
import { useDraggable } from "./use-draggable";
import { PortalContainerProvider } from "@/lib/portal-container";

interface FloatingPanelBase {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Element that toggles the panel. Optional — when omitted, the panel is controlled entirely via open/onOpenChange. */
  trigger?: React.ReactElement;
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  };
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  align?: "start" | "center" | "end";
  className?: string;
  height?: number | "auto";
  /** Maximum height when height="auto" (default 400). */
  maxHeight?: number;
  draggable?: boolean;
  /** Refs to ignore for click-outside (e.g. nested picker portals) */
  ignoreRefs?: React.RefObject<HTMLElement | null>[];
  /** Expose the panel DOM ref for nested positioning */
  panelRef?: React.RefObject<HTMLDivElement | null>;
  /** Optional icon button rendered before the close button in the header (e.g. add effect [+]) */
  headerIconButton?: SectionHeaderIconButton;
  /** Anchor element for vertical positioning — dialog aligns near this element instead of viewport bottom */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** Custom element to position relative to (instead of the property panel). Panel appears to the left of this element. */
  positionRef?: React.RefObject<HTMLElement | null>;
}

interface FloatingPanelWithTitle extends FloatingPanelBase {
  title: string;
  tabs?: never;
  activeTab?: never;
  onTabChange?: never;
}

interface FloatingPanelWithTabs extends FloatingPanelBase {
  title?: never;
  tabs: { value: string; label: string }[];
  activeTab: string;
  onTabChange?: (value: string) => void;
}

export type FloatingPanelProps = FloatingPanelWithTitle | FloatingPanelWithTabs;

const PANEL_SHADOW =
  "0 0 0.5px rgba(0,0,0,0.08), 0 10px 24px rgba(0,0,0,0.18), 0 2px 5px rgba(0,0,0,0.15)";

// Monotonically increasing counter for panel open order
let panelSeqCounter = 0;

// Gap between the panel and the property panel edge
const PANEL_GAP = 8;
// Distance from viewport bottom
const BOTTOM_OFFSET = 16;

function usePanelPosition(
  open: boolean,
  anchorRef?: React.RefObject<HTMLElement | null>,
  positionRef?: React.RefObject<HTMLElement | null>,
) {
  const [right, setRight] = React.useState<number | null>(null);
  const [top, setTop] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!open) return;

    const compute = () => {
      // Position relative to positionRef (if provided) or the property panel
      const refEl = positionRef?.current;
      if (refEl) {
        const rect = refEl.getBoundingClientRect();
        setRight(window.innerWidth - rect.left + PANEL_GAP);
      } else {
        const panel = document.querySelector<HTMLElement>("[data-editor-panel].w-\\[259px\\]");
        if (panel) {
          const rect = panel.getBoundingClientRect();
          setRight(window.innerWidth - rect.left + PANEL_GAP);
        }
      }

      // Compute desired top (without collision — that's handled by useViewportClamp)
      if (anchorRef?.current) {
        const anchorRect = anchorRef.current.getBoundingClientRect();
        const desired = anchorRect.top + anchorRect.height / 2 - 20;
        setTop(desired);
      } else if (refEl) {
        setTop(refEl.getBoundingClientRect().top);
      } else {
        setTop(null);
      }
    };

    compute();

    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [open, anchorRef, positionRef]);

  return { right, top };
}

/**
 * Clamps a floating panel to stay within the viewport. Runs as a layout effect
 * (before paint) so there's no visible flash. Also observes panel size changes
 * for height="auto" panels that grow/shrink.
 */
function useViewportClamp(
  panelRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  top: number | null,
) {
  React.useLayoutEffect(() => {
    const el = panelRef.current;
    if (!open || !el) return;

    const clamp = () => {
      const panelHeight = el.offsetHeight;
      const viewportH = window.innerHeight;

      if (top !== null) {
        // Panel uses top positioning — clamp to viewport
        let clamped = top;
        if (clamped + panelHeight > viewportH - BOTTOM_OFFSET) {
          clamped = viewportH - BOTTOM_OFFSET - panelHeight;
        }
        clamped = Math.max(BOTTOM_OFFSET, clamped);
        el.style.top = `${clamped}px`;
        el.style.bottom = "";
      } else {
        // Panel uses bottom positioning — ensure it doesn't overflow top
        const bottomValue = BOTTOM_OFFSET;
        if (viewportH - bottomValue - panelHeight < BOTTOM_OFFSET) {
          el.style.top = `${BOTTOM_OFFSET}px`;
          el.style.bottom = "";
        }
      }
    };

    clamp();

    // Re-clamp on resize and when panel content changes size
    const ro = new ResizeObserver(clamp);
    ro.observe(el);
    window.addEventListener("resize", clamp);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", clamp);
    };
  }, [panelRef, open, top]);
}

export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  triggerRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  ignoreRefs?: React.RefObject<HTMLElement | null>[],
) {
  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // Check if click is inside a floating panel opened after this one (nested/child)
      const mySeq = ref.current?.getAttribute("data-floating-panel") ?? "0";
      const targetPanel = target instanceof Element ? target.closest("[data-floating-panel]") : null;
      const targetSeq = targetPanel?.getAttribute("data-floating-panel") ?? "0";
      const isInsideNewerPanel = targetPanel && !ref.current?.contains(targetPanel) && Number(targetSeq) > Number(mySeq);

      if (
        ref.current && !ref.current.contains(target) &&
        (!triggerRef.current || !triggerRef.current.contains(target)) &&
        !ignoreRefs?.some(r => r.current?.contains(target)) &&
        !isInsideNewerPanel
      ) {
        onClose();
      }
    };

    // Delay to avoid closing on the same click that opened
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [ref, triggerRef, open, onClose, ignoreRefs]);
}

export function FloatingPanel({
  open,
  onOpenChange,
  trigger,
  title,
  tabs,
  activeTab,
  onTabChange,
  search,
  children,
  className,
  height = 400,
  maxHeight: maxHeightProp,
  draggable = false,
  ignoreRefs,
  panelRef: externalPanelRef,
  headerIconButton,
  anchorRef,
  positionRef,
}: FloatingPanelProps) {
  const drag = useDraggable(open);
  const internalPanelRef = React.useRef<HTMLDivElement>(null);
  const panelRef = externalPanelRef ?? internalPanelRef;
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const seqRef = React.useRef(0);
  const { right, top } = usePanelPosition(open, anchorRef, positionRef);
  useViewportClamp(panelRef, open, top);

  // Assign a sequence number each time the panel opens (for nested panel ordering)
  if (open && seqRef.current === 0) {
    seqRef.current = ++panelSeqCounter;
  } else if (!open) {
    seqRef.current = 0;
  }

  // Auto-focus search input when panel opens
  React.useEffect(() => {
    if (open && search) {
      // Delay to let the panel render first
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [open, !!search]);

  const onClose = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  useClickOutside(panelRef, triggerRef, open, onClose, ignoreRefs);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const headerProps = tabs
    ? { tabs, activeTab: activeTab!, onTabChange }
    : { title: title! };

  const handleTriggerClick = () => onOpenChange(!open);

  const panelContent = open && right !== null ? (
    <div
      ref={panelRef as React.Ref<HTMLDivElement>}
      data-floating-panel={String(seqRef.current)}
      style={{
        position: "fixed",
        right,
        ...(top !== null ? { top } : { bottom: BOTTOM_OFFSET }),
        zIndex: 50,
        fontFamily: "'Inter', system-ui, sans-serif",
        ...(draggable && drag.transform ? { transform: drag.transform } : {}),
      }}
    >
      <PortalContainerProvider>
        <div
          className="flex flex-col overflow-clip rounded-[13px] bg-white dark:bg-[#2c2c2c] w-[240px] select-none"
          style={{ height: height === "auto" ? "auto" : (height ?? "auto"), maxHeight: height === "auto" ? (maxHeightProp ?? 400) : undefined, boxShadow: PANEL_SHADOW }}
        >
          {/* Drag handle / Title bar */}
          <div
            onPointerDown={draggable ? drag.onPointerDown : undefined}
            className={draggable ? "[&_button]:cursor-pointer" : undefined}
            style={
              draggable
                ? { cursor: drag.isDragging ? "grabbing" : "grab" }
                : undefined
            }
          >
            <SectionHeader
              {...headerProps}
              secondaryIconButton={headerIconButton}
              iconButton={{
                icon: CloseSmall,
                onClick: () => onOpenChange(false),
                "aria-label": "Close",
              }}
            />
          </div>

          {/* Search bar */}
          {search && (
            <div className="px-2 pb-2">
              <TextInput
                ref={searchInputRef}
                value={search.value}
                onChange={(v) => search.onChange(v ?? "")}
                placeholder={search.placeholder}
                leadIcon={SearchSmall}
              />
            </div>
          )}

          {/* Divider */}
          <div className="border-b border-stone-200 dark:border-stone-700" />

          {/* Body */}
          <div className={cn(
            "flex-1 flex flex-col min-h-0",
            height === "auto" ? "overflow-y-auto" : "overflow-hidden",
            className,
          )}>
            {children}
          </div>
        </div>
      </PortalContainerProvider>
    </div>
  ) : null;

  return (
    <>
      {trigger && (
        <div ref={triggerRef} onClick={handleTriggerClick} className="contents">
          {trigger}
        </div>
      )}
      {panelContent && createPortal(panelContent, document.body)}
    </>
  );
}

FloatingPanel.displayName = "FloatingPanel";
