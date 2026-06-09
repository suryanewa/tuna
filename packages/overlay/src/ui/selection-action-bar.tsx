import { useEffect, useRef, useState } from "react";
import { IconSquareBehindSquare6 } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconSquareBehindSquare6";
import { IconCheckCircle2 } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconCheckCircle2";
import { IconBroom } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconBroom";
import { IconCrossMedium } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconCrossMedium";
import { Tooltip } from "./tooltip";
import { computeSelectionChromeLayout, type SelectionChromeLayout } from "../selector/selection-chrome-layout";

function IconComment({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10C17 13.866 13.866 17 10 17H4C3.44772 17 3 16.5523 3 16V10Z"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}

export interface SelectionActionBarProps {
  anchorElements: Element[];
  /** Measured width of the dimension badge — keeps row layout in sync with the picker. */
  dimensionLabelWidth?: number;
  editMode: boolean;
  copied: boolean;
  onComment: () => void;
  onCopy: () => void;
  onToggleEdit: () => void;
  onDeselect: () => void;
  onChromeLayout?: (layout: SelectionChromeLayout) => void;
}

function getAnchorRect(elements: Element[]) {
  const rects = elements.map((el) => el.getBoundingClientRect());
  const top = Math.min(...rects.map((r) => r.top));
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { top, left, right, bottom, centerX: (left + right) / 2 };
}

export function SelectionActionBar({
  anchorElements,
  dimensionLabelWidth,
  editMode,
  copied,
  onComment,
  onCopy,
  onToggleEdit,
  onDeselect,
  onChromeLayout,
}: SelectionActionBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (anchorElements.length === 0) {
      setPos(null);
      return;
    }

    const gap = 8;
    const multiSelect = anchorElements.length > 1;

    function update() {
      const anchor = getAnchorRect(anchorElements);

      if (multiSelect) {
        setPos({ top: anchor.bottom + gap, left: anchor.centerX });
        return;
      }

      const el = anchorElements[0];
      const rect = el.getBoundingClientRect();
      const barWidth = barRef.current?.offsetWidth;
      const layout = computeSelectionChromeLayout(
        rect,
        { width: window.innerWidth, height: window.innerHeight },
        dimensionLabelWidth,
        barWidth,
      );
      setPos(layout.actionBar);
      onChromeLayout?.(layout);
    }

    update();
    document.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    for (const el of anchorElements) observer.observe(el);
    if (barRef.current) observer.observe(barRef.current);
    return () => {
      document.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [anchorElements, dimensionLabelWidth, onChromeLayout]);

  if (anchorElements.length === 0 || !pos) return null;

  return (
    <div
      ref={barRef}
      className="retune-selection-action-bar"
      style={{ top: pos.top, left: pos.left }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Tooltip content="Comment" side="top">
        <button type="button" className="retune-selection-action-btn" onClick={onComment}>
          <IconComment />
        </button>
      </Tooltip>
      <Tooltip content="Copy element info" side="top">
        <button
          type="button"
          className="retune-selection-action-btn"
          onClick={onCopy}
        >
          <span className="retune-icon-swap">
            <span className={`retune-icon-swap-icon ${copied ? "out" : "in"}`}>
              <IconSquareBehindSquare6 size={18} />
            </span>
            <span className={`retune-icon-swap-icon ${copied ? "in" : "out"}`}>
              <IconCheckCircle2 size={18} />
            </span>
          </span>
        </button>
      </Tooltip>
      <Tooltip content={editMode ? "Exit edit mode" : "Edit"} side="top">
        <button
          type="button"
          className={`retune-selection-action-btn${editMode ? " active" : ""}`}
          onClick={onToggleEdit}
        >
          <IconBroom size={18} />
        </button>
      </Tooltip>
      <div className="retune-selection-action-divider" aria-hidden />
      <Tooltip content="Deselect all" shortcut="Shift+Esc" side="top">
        <button type="button" className="retune-selection-action-btn" onClick={onDeselect}>
          <IconCrossMedium size={18} />
        </button>
      </Tooltip>
    </div>
  );
}
