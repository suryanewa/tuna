/**
 * ConstraintsInput — visual pin box with T/R/B/L number inputs.
 * Ported from the portfolio editor's ConstraintsInput for Shadow DOM (plain CSS).
 *
 * Pin/centered state is owned by the parent so alignment buttons
 * and the constraints visual stay in sync.
 */

import { NumberInput } from "./number-input";

type Side = "top" | "right" | "bottom" | "left";

export interface PinState {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

function PinLine({ side, pinned, onClick }: { side: Side; pinned: boolean; onClick: () => void }) {
  const isVertical = side === "top" || side === "bottom";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tuna-pin-line ${side}`}
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
  pins: PinState;
  centered: boolean;
  onChange: (prop: string, value: string) => void;
  onPinChange: (side: Side, pinned: boolean) => void;
  onCenterChange: (centered: boolean) => void;
}

export function ConstraintsInput({
  top, right, bottom, left,
  pins, centered,
  onChange, onPinChange, onCenterChange,
}: ConstraintsInputProps) {
  const allPinned = pins.top && pins.right && pins.bottom && pins.left;

  const togglePin = (side: Side) => {
    const wasPinned = pins[side];
    onPinChange(side, !wasPinned);

    if (centered) {
      onCenterChange(false);
      onChange("transform", "none");
    }

    if (wasPinned) {
      onChange(side, "auto");
    } else {
      const values: Record<Side, string | undefined> = { top, right, bottom, left };
      const current = values[side];
      if (!current || current === "auto") {
        onChange(side, "0px");
      }
    }
  };

  const handleCenterClick = () => {
    if (centered) {
      onCenterChange(false);
      onPinChange("top", false);
      onPinChange("right", false);
      onPinChange("bottom", false);
      onPinChange("left", false);
      onChange("top", "auto");
      onChange("right", "auto");
      onChange("bottom", "auto");
      onChange("left", "auto");
      onChange("transform", "none");
    } else if (allPinned) {
      onCenterChange(true);
      onChange("top", "50%");
      onChange("right", "auto");
      onChange("bottom", "auto");
      onChange("left", "50%");
      onChange("transform", "translate(-50%, -50%)");
    } else {
      (["top", "right", "bottom", "left"] as Side[]).forEach((s) => {
        if (!pins[s]) {
          onPinChange(s, true);
          const values: Record<Side, string | undefined> = { top, right, bottom, left };
          if (!values[s] || values[s] === "auto") {
            onChange(s, "0px");
          }
        }
      });
    }
  };

  return (
    <div className="tuna-constraints">
      {/* Left column */}
      <div className="tuna-constraints-side">
        <NumberInput label="L" prop="left" value={left} onChange={onChange} />
      </div>

      {/* Center column */}
      <div className="tuna-constraints-center">
        <NumberInput label="T" prop="top" value={top} onChange={onChange} />

        {/* Pin box */}
        <div className="tuna-pin-box">
          <PinLine side="top" pinned={!centered && pins.top} onClick={() => togglePin("top")} />
          <PinLine side="right" pinned={!centered && pins.right} onClick={() => togglePin("right")} />
          <PinLine side="bottom" pinned={!centered && pins.bottom} onClick={() => togglePin("bottom")} />
          <PinLine side="left" pinned={!centered && pins.left} onClick={() => togglePin("left")} />

          {/* Center toggle box */}
          <button
            type="button"
            onClick={handleCenterClick}
            className="tuna-pin-center-btn"
            aria-label={
              centered
                ? "Clear center alignment"
                : allPinned
                  ? "Align to center"
                  : "Pin all sides"
            }
          >
            {centered && <span className="tuna-pin-center-dot" />}
          </button>
        </div>

        <NumberInput label="B" prop="bottom" value={bottom} onChange={onChange} />
      </div>

      {/* Right column */}
      <div className="tuna-constraints-side">
        <NumberInput label="R" prop="right" value={right} onChange={onChange} />
      </div>
    </div>
  );
}
