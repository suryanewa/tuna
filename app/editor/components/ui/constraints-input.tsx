"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { NumberInput } from "./number-input";

export interface ConstraintsInputProps {
  top: number | undefined;
  right: number | undefined;
  bottom: number | undefined;
  left: number | undefined;
  pinned: { top: boolean; right: boolean; bottom: boolean; left: boolean };
  centered?: boolean;
  onChange: (
    side: "top" | "right" | "bottom" | "left",
    value: number | undefined
  ) => void;
  onPinChange: (
    side: "top" | "right" | "bottom" | "left",
    pinned: boolean
  ) => void;
  onCenterChange?: (centered: boolean) => void;
  disabled?: boolean;
  className?: string;
}

type Side = "top" | "right" | "bottom" | "left";

function PinLine({
  side,
  pinned,
  onClick,
  disabled,
}: {
  side: Side;
  pinned: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const isVertical = side === "top" || side === "bottom";

  // Position each handle centered between the pin box edge and the center box (24x24 at 50%/50%).
  // Height is fixed 64px; width is fluid. Use calc() for left/right to scale with width.
  const positionInlineStyles: Record<Side, React.CSSProperties> = {
    top: { left: "50%", transform: "translateX(-50%)", top: 2, width: 16, height: 16 },
    right: { left: "calc(75% - 2px)", top: 24, width: 16, height: 16 },
    bottom: { left: "50%", transform: "translateX(-50%)", bottom: 2, width: 16, height: 16 },
    left: { left: "calc(25% - 14px)", top: 24, width: 16, height: 16 },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="absolute flex items-center justify-center cursor-pointer p-0 border-0 bg-transparent disabled:cursor-not-allowed"
      style={positionInlineStyles[side]}
      aria-label={`${pinned ? "Unpin" : "Pin"} ${side}`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {isVertical ? (
          <line
            x1="8"
            y1="3"
            x2="8"
            y2="13"
            stroke={pinned ? "#3b82f6" : "#d1d5db"}
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : (
          <line
            x1="3"
            y1="8"
            x2="13"
            y2="8"
            stroke={pinned ? "#3b82f6" : "#d1d5db"}
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
}

export function ConstraintsInput({
  top,
  right,
  bottom,
  left,
  pinned,
  centered = false,
  onChange,
  onPinChange,
  onCenterChange,
  disabled = false,
  className,
}: ConstraintsInputProps) {
  const allPinned =
    pinned.top && pinned.right && pinned.bottom && pinned.left;

  const handleCenterClick = () => {
    if (disabled) return;
    if (centered) {
      // Centered → clear everything
      onCenterChange?.(false);
    } else if (allPinned) {
      // All pinned → center aligned
      onCenterChange?.(true);
    } else {
      // Partial or unpinned → pin all
      (["top", "right", "bottom", "left"] as Side[]).forEach((side) => {
        onPinChange(side, true);
      });
      onCenterChange?.(false);
    }
  };

  const handleChange = (side: Side, value: string | undefined) => {
    onChange(side, value === undefined ? undefined : Number(value));
  };

  return (
    <div
      className={cn(
        "flex gap-[4px] items-center",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      {/* Left column — Left input, vertically centered */}
      <div className="flex flex-1 items-center self-stretch min-w-0">
        <NumberInput
          value={left}
          onChange={(v) => handleChange("left", v)}
          property="L"
          disabled={disabled}
          className="min-w-0"
        />
      </div>

      {/* Center column — Top input, Pin box, Bottom input */}
      <div className="flex flex-1 flex-col gap-[4px] items-stretch min-w-0">
        <NumberInput
          value={top}
          onChange={(v) => handleChange("top", v)}
          property="T"
          disabled={disabled}
          className="w-full min-w-0"
        />

        {/* Pin box — full width of center column, fixed 64px height */}
        <div
          className="relative bg-stone-100 dark:bg-stone-800 rounded-input w-full"
          style={{ height: 64 }}
        >
          <PinLine
            side="top"
            pinned={!centered && pinned.top}
            onClick={() => onPinChange("top", !pinned.top)}
            disabled={disabled}
          />
          <PinLine
            side="right"
            pinned={!centered && pinned.right}
            onClick={() => onPinChange("right", !pinned.right)}
            disabled={disabled}
          />
          <PinLine
            side="bottom"
            pinned={!centered && pinned.bottom}
            onClick={() => onPinChange("bottom", !pinned.bottom)}
            disabled={disabled}
          />
          <PinLine
            side="left"
            pinned={!centered && pinned.left}
            onClick={() => onPinChange("left", !pinned.left)}
            disabled={disabled}
          />

          {/* Center toggle box */}
          <button
            type="button"
            onClick={handleCenterClick}
            disabled={disabled}
            className={cn(
              "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
              "w-[24px] h-[24px] bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-600 rounded-input cursor-pointer",
              "flex items-center justify-center",
              "disabled:cursor-not-allowed"
            )}
            aria-label={
              centered
                ? "Clear center alignment"
                : allPinned
                  ? "Align to center"
                  : "Pin all sides"
            }
          >
            {centered && (
              <span
                className="rounded-full bg-blue-500"
                style={{ width: 4, height: 4 }}
              />
            )}
          </button>
        </div>

        <NumberInput
          value={bottom}
          onChange={(v) => handleChange("bottom", v)}
          property="B"
          disabled={disabled}
          className="w-full min-w-0"
        />
      </div>

      {/* Right column — Right input, vertically centered */}
      <div className="flex flex-1 items-center self-stretch min-w-0">
        <NumberInput
          value={right}
          onChange={(v) => handleChange("right", v)}
          property="R"
          disabled={disabled}
          className="min-w-0"
        />
      </div>
    </div>
  );
}

ConstraintsInput.displayName = "ConstraintsInput";
