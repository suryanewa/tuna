import { useEffect, useState } from "react";
import { IconSquareBehindSquare6 } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconSquareBehindSquare6";
import { IconCheckCircle2 } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconCheckCircle2";
import { IconPencil } from "@central-icons-react/round-outlined-radius-2-stroke-1.5/IconPencil";
import { Tooltip } from "./tooltip";

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
  anchorElement: Element | null;
  editMode: boolean;
  copied: boolean;
  onComment: () => void;
  onCopy: () => void;
  onToggleEdit: () => void;
}

export function SelectionActionBar({
  anchorElement,
  editMode,
  copied,
  onComment,
  onCopy,
  onToggleEdit,
}: SelectionActionBarProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!anchorElement) {
      setPos(null);
      return;
    }

    const barHeight = 36;
    const gap = 8;

    function update() {
      const rect = anchorElement!.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const below = rect.bottom + gap + barHeight < viewportH;
      const top = below ? rect.bottom + gap : rect.top - gap - barHeight;
      setPos({ top, left: rect.left + rect.width / 2 });
    }

    update();
    document.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(anchorElement);
    return () => {
      document.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [anchorElement]);

  if (!anchorElement || !pos) return null;

  return (
    <div
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
          <IconPencil size={18} />
        </button>
      </Tooltip>
    </div>
  );
}
