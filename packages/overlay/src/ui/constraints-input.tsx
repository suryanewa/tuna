/**
 * ConstraintsInput — visual pin box with T/R/B/L number inputs.
 * Adapted from the portfolio editor for Shadow DOM (plain CSS).
 */

import { NumberInput } from "./number-input";

type Side = "top" | "right" | "bottom" | "left";

function PinLine({ side, pinned, onClick }: { side: Side; pinned: boolean; onClick: () => void }) {
  const isVertical = side === "top" || side === "bottom";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`composer-pin-line ${side}`}
      aria-label={`${pinned ? "Unpin" : "Pin"} ${side}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        {isVertical ? (
          <line x1="8" y1="3" x2="8" y2="13" stroke={pinned ? "#3b82f6" : "#d6d3d1"} strokeWidth="2" strokeLinecap="round" />
        ) : (
          <line x1="3" y1="8" x2="13" y2="8" stroke={pinned ? "#3b82f6" : "#d6d3d1"} strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}

export interface ConstraintsInputProps {
  top: string | undefined;
  right: string | undefined;
  bottom: string | undefined;
  left: string | undefined;
  onChange: (prop: string, value: string) => void;
}

export function ConstraintsInput({ top, right, bottom, left, onChange }: ConstraintsInputProps) {
  // Derive pin state from whether the value is "auto" or not
  const isPinned = (value: string | undefined) => value !== undefined && value !== "auto";

  const togglePin = (side: Side) => {
    const values: Record<Side, string | undefined> = { top, right, bottom, left };
    const current = values[side];
    if (isPinned(current)) {
      onChange(side, "auto");
    } else {
      onChange(side, "0px");
    }
  };

  return (
    <div className="composer-constraints">
      {/* Left column */}
      <div className="composer-constraints-side">
        <NumberInput label="L" prop="left" value={left} onChange={onChange} />
      </div>

      {/* Center column */}
      <div className="composer-constraints-center">
        <NumberInput label="T" prop="top" value={top} onChange={onChange} />

        {/* Pin box */}
        <div className="composer-pin-box">
          <PinLine side="top" pinned={isPinned(top)} onClick={() => togglePin("top")} />
          <PinLine side="right" pinned={isPinned(right)} onClick={() => togglePin("right")} />
          <PinLine side="bottom" pinned={isPinned(bottom)} onClick={() => togglePin("bottom")} />
          <PinLine side="left" pinned={isPinned(left)} onClick={() => togglePin("left")} />
          <div className="composer-pin-center" />
        </div>

        <NumberInput label="B" prop="bottom" value={bottom} onChange={onChange} />
      </div>

      {/* Right column */}
      <div className="composer-constraints-side">
        <NumberInput label="R" prop="right" value={right} onChange={onChange} />
      </div>
    </div>
  );
}
