"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface AlignmentGridProps {
  justifyContent: string | undefined;
  alignItems: string | undefined;
  onJustifyChange: (value: string) => void;
  onAlignChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

// Map grid positions to Tailwind classes
const JUSTIFY_MAP: Record<number, string> = {
  0: "justify-start",
  1: "justify-center",
  2: "justify-end",
};

const ALIGN_MAP: Record<number, string> = {
  0: "items-start",
  1: "items-center",
  2: "items-end",
};

// Reverse maps for determining selected cell
const JUSTIFY_REVERSE: Record<string, number> = {
  "justify-start": 0,
  "justify-center": 1,
  "justify-end": 2,
  "justify-between": 1, // Treat as center for grid display
  "justify-around": 1,
  "justify-evenly": 1,
};

const ALIGN_REVERSE: Record<string, number> = {
  "items-start": 0,
  "items-center": 1,
  "items-end": 2,
  "items-stretch": 1,
  "items-baseline": 0,
};

export function AlignmentGrid({
  justifyContent,
  alignItems,
  onJustifyChange,
  onAlignChange,
  disabled = false,
  className,
}: AlignmentGridProps) {
  const selectedCol = justifyContent ? JUSTIFY_REVERSE[justifyContent] ?? 0 : 0;
  const selectedRow = alignItems ? ALIGN_REVERSE[alignItems] ?? 0 : 0;

  const handleClick = (row: number, col: number) => {
    if (disabled) return;
    onJustifyChange(JUSTIFY_MAP[col]);
    onAlignChange(ALIGN_MAP[row]);
  };

  return (
    <div className={cn("flex items-center gap-[8px]", className)}>
      {/* 3x3 Grid */}
      <div className="grid grid-cols-3 gap-[2px] p-[4px] bg-muted/30 rounded-input">
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => {
            const isSelected = row === selectedRow && col === selectedCol;
            return (
              <button
                key={`${row}-${col}`}
                onClick={() => handleClick(row, col)}
                disabled={disabled}
                className={cn(
                  "w-[24px] h-[24px] flex items-center justify-center rounded-input transition-all",
                  "hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed",
                  isSelected && "bg-background border border-border shadow-sm"
                )}
              >
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-colors",
                    isSelected ? "bg-foreground" : "bg-muted-foreground/40"
                  )}
                />
              </button>
            );
          })
        )}
      </div>

      {/* Visual preview */}
      <div className="w-[40px] h-[40px] border border-border rounded-input bg-muted/10 relative">
        <div
          className={cn(
            "absolute w-1.5 h-1.5 bg-foreground/60 rounded-sm transition-all",
            // Position based on alignment
            selectedCol === 0 && "left-1",
            selectedCol === 1 && "left-1/2 -translate-x-1/2",
            selectedCol === 2 && "right-1",
            selectedRow === 0 && "top-1",
            selectedRow === 1 && "top-1/2 -translate-y-1/2",
            selectedRow === 2 && "bottom-1"
          )}
        />
        <div
          className={cn(
            "absolute w-1.5 h-1.5 bg-foreground/40 rounded-sm transition-all",
            selectedCol === 0 && "left-1",
            selectedCol === 1 && "left-1/2 -translate-x-1/2",
            selectedCol === 2 && "right-1",
            selectedRow === 0 && "top-3",
            selectedRow === 1 && "top-1/2 translate-y-1",
            selectedRow === 2 && "bottom-3"
          )}
        />
      </div>
    </div>
  );
}
