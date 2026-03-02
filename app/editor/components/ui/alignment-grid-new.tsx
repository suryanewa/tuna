"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  AutolayoutgridDot,
  Positiontop,
  Positionbottom,
  Positionleft1,
  Positionright1,
  Positioncenter1,
  Positioncenter2,
  Positioncenter3,
  Positioncenter4,
  Positioncenter5,
  Positioncenter6,
  Positionleft2,
  Positionright2,
  Positiontop2,
  Positionbottom2,
} from "@/components/icons/editor";

export type AlignmentPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center-center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type FlowDirection = "vertical" | "horizontal";

export interface AlignmentGridNewProps {
  value: AlignmentPosition;
  onChange: (value: AlignmentPosition) => void;
  flow?: FlowDirection;
  spaceBetween?: boolean;
  onSpaceBetweenChange?: (spaceBetween: boolean) => void;
  disabled?: boolean;
  className?: string;
}

// Map position to grid coordinates
const POSITION_TO_COORDS: Record<AlignmentPosition, { row: number; col: number }> = {
  "top-left": { row: 0, col: 0 },
  "top-center": { row: 0, col: 1 },
  "top-right": { row: 0, col: 2 },
  "center-left": { row: 1, col: 0 },
  "center-center": { row: 1, col: 1 },
  "center-right": { row: 1, col: 2 },
  "bottom-left": { row: 2, col: 0 },
  "bottom-center": { row: 2, col: 1 },
  "bottom-right": { row: 2, col: 2 },
};

// Map coordinates to position
const COORDS_TO_POSITION: AlignmentPosition[][] = [
  ["top-left", "top-center", "top-right"],
  ["center-left", "center-center", "center-right"],
  ["bottom-left", "bottom-center", "bottom-right"],
];

// Canonical positions for space-between mode
const SB_VERTICAL_CANONICAL: AlignmentPosition[] = ["center-left", "center-center", "center-right"];
const SB_HORIZONTAL_CANONICAL: AlignmentPosition[] = ["top-center", "center-center", "bottom-center"];

// Get the appropriate icon for a position based on flow direction
// Vertical flow: icon determined by column (cross-axis = horizontal alignment)
// Horizontal flow: icon determined by row (cross-axis = vertical alignment)
function getSelectedIcon(position: AlignmentPosition, flow: FlowDirection) {
  const { row, col } = POSITION_TO_COORDS[position];
  if (flow === "vertical") {
    return col === 0 ? Positionleft1 : col === 1 ? Positioncenter1 : Positionright1;
  } else {
    return row === 0 ? Positiontop : row === 1 ? Positioncenter2 : Positionbottom;
  }
}

// Get the space-between bar icon for a specific cell
// Vertical SB: bars in a column — large at edges (rows 0,2), small at center (row 1)
// Horizontal SB: bars in a row — large at edges (cols 0,2), small at center (col 1)
function getSpaceBetweenIcon(row: number, col: number, activeGroup: number, flow: FlowDirection) {
  if (flow === "vertical") {
    // Vertical: activeGroup is the column index
    if (col !== activeGroup) return null;
    const isEdge = row === 0 || row === 2;
    if (isEdge) return Positioncenter3; // large horizontal bar
    // Small bar aligned per column
    return activeGroup === 0 ? Positionleft2 : activeGroup === 1 ? Positioncenter4 : Positionright2;
  } else {
    // Horizontal: activeGroup is the row index
    if (row !== activeGroup) return null;
    const isEdge = col === 0 || col === 2;
    if (isEdge) return Positioncenter5; // large vertical bar
    // Small bar aligned per row
    return activeGroup === 0 ? Positiontop2 : activeGroup === 1 ? Positioncenter6 : Positionbottom2;
  }
}

// Get active group (column for vertical, row for horizontal) from a position
function getActiveGroup(value: AlignmentPosition, flow: FlowDirection): number {
  const { row, col } = POSITION_TO_COORDS[value];
  return flow === "vertical" ? col : row;
}

// Normalize position when entering space-between mode
function normalizeForSpaceBetween(value: AlignmentPosition, flow: FlowDirection): AlignmentPosition {
  const group = getActiveGroup(value, flow);
  if (flow === "vertical") {
    return SB_VERTICAL_CANONICAL[group];
  } else {
    return SB_HORIZONTAL_CANONICAL[group];
  }
}

export function AlignmentGridNew({
  value,
  onChange,
  flow = "vertical",
  spaceBetween = false,
  onSpaceBetweenChange,
  disabled = false,
  className,
}: AlignmentGridNewProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const [hoveredGroup, setHoveredGroup] = React.useState<number | null>(null);
  const [hoveredPosition, setHoveredPosition] = React.useState<AlignmentPosition | null>(null);
  const selectedCoords = POSITION_TO_COORDS[value];
  const activeGroup = spaceBetween ? getActiveGroup(value, flow) : -1;

  const handleClick = (row: number, col: number) => {
    if (disabled) return;
    if (spaceBetween) {
      // In space-between mode, normalize to canonical position
      const group = flow === "vertical" ? col : row;
      const canonical = flow === "vertical" ? SB_VERTICAL_CANONICAL[group] : SB_HORIZONTAL_CANONICAL[group];
      onChange(canonical);
    } else {
      onChange(COORDS_TO_POSITION[row][col]);
    }
  };

  const handleDoubleClick = () => {
    if (disabled || !onSpaceBetweenChange) return;
    const newSpaceBetween = !spaceBetween;
    onSpaceBetweenChange(newSpaceBetween);
    if (!newSpaceBetween) {
      // When leaving space-between, restore alignment-based justifyContent
      onChange(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    const { row, col } = selectedCoords;
    let newRow = row;
    let newCol = col;

    if (spaceBetween) {
      // In space-between mode, restrict to relevant axis
      if (flow === "vertical") {
        if (e.key === "ArrowLeft") {
          newCol = Math.max(0, col - 1);
          e.preventDefault();
        } else if (e.key === "ArrowRight") {
          newCol = Math.min(2, col + 1);
          e.preventDefault();
        } else {
          return;
        }
      } else {
        if (e.key === "ArrowUp") {
          newRow = Math.max(0, row - 1);
          e.preventDefault();
        } else if (e.key === "ArrowDown") {
          newRow = Math.min(2, row + 1);
          e.preventDefault();
        } else {
          return;
        }
      }
    } else {
      switch (e.key) {
        case "ArrowUp":
          newRow = Math.max(0, row - 1);
          e.preventDefault();
          break;
        case "ArrowDown":
          newRow = Math.min(2, row + 1);
          e.preventDefault();
          break;
        case "ArrowLeft":
          newCol = Math.max(0, col - 1);
          e.preventDefault();
          break;
        case "ArrowRight":
          newCol = Math.min(2, col + 1);
          e.preventDefault();
          break;
        default:
          return;
      }
    }

    if (newRow !== row || newCol !== col) {
      if (spaceBetween) {
        const group = flow === "vertical" ? newCol : newRow;
        const canonical = flow === "vertical" ? SB_VERTICAL_CANONICAL[group] : SB_HORIZONTAL_CANONICAL[group];
        onChange(canonical);
      } else {
        onChange(COORDS_TO_POSITION[newRow][newCol]);
      }
    }
  };

  const handleMouseEnter = (row: number, col: number) => {
    if (disabled) return;
    if (spaceBetween) {
      const group = flow === "vertical" ? col : row;
      setHoveredGroup(group);
    } else {
      setHoveredPosition(COORDS_TO_POSITION[row][col]);
    }
  };

  const handleMouseLeave = () => {
    setHoveredGroup(null);
    setHoveredPosition(null);
  };

  return (
    <div
      role="grid"
      aria-label="Alignment grid"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "grid grid-cols-3 grid-rows-3 rounded-input bg-stone-100 dark:bg-stone-800",
        "focus-visible:outline-none",
        "w-full h-16",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      style={isFocused ? { outline: "1px solid black", outlineOffset: "-1px" } : undefined}
    >
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => {
          const position = COORDS_TO_POSITION[row][col];

          return (
            <button
              key={`${row}-${col}`}
              type="button"
              role="gridcell"
              aria-label={position.replace("-", " ")}
              onClick={() => handleClick(row, col)}
              onMouseEnter={() => handleMouseEnter(row, col)}
              onMouseLeave={handleMouseLeave}
              disabled={disabled}
              tabIndex={-1}
              className={cn(
                "flex items-center justify-center",
                "overflow-hidden",
                "transition-colors duration-150",
                "focus:outline-none"
              )}
            >
              {(() => {
                if (spaceBetween) {
                  return renderSpaceBetweenCell(row, col, activeGroup, hoveredGroup, flow);
                }
                return renderNormalCell(row, col, selectedCoords, hoveredPosition, position, flow);
              })()}
            </button>
          );
        })
      )}
    </div>
  );
}

function renderNormalCell(
  row: number,
  col: number,
  selectedCoords: { row: number; col: number },
  hoveredPosition: AlignmentPosition | null,
  position: AlignmentPosition,
  flow: FlowDirection,
) {
  const isSelected = row === selectedCoords.row && col === selectedCoords.col;

  if (isSelected) {
    const SelectedIcon = getSelectedIcon(position, flow);
    return <SelectedIcon size={16} className="text-blue-600 dark:text-blue-400" />;
  }
  if (hoveredPosition === position) {
    const HoverIcon = getSelectedIcon(position, flow);
    return <HoverIcon size={16} className="text-stone-400 dark:text-stone-400" />;
  }
  return <AutolayoutgridDot size={16} className="text-stone-400 dark:text-stone-400" />;
}

function renderSpaceBetweenCell(
  row: number,
  col: number,
  activeGroup: number,
  hoveredGroup: number | null,
  flow: FlowDirection,
) {
  const cellGroup = flow === "vertical" ? col : row;
  const isActive = cellGroup === activeGroup;
  const isHovered = hoveredGroup !== null && cellGroup === hoveredGroup && !isActive;

  if (isActive) {
    const Icon = getSpaceBetweenIcon(row, col, activeGroup, flow);
    if (Icon) {
      return <Icon size={16} className="text-blue-600 dark:text-blue-400" />;
    }
  }

  if (isHovered) {
    const Icon = getSpaceBetweenIcon(row, col, cellGroup, flow);
    if (Icon) {
      return <Icon size={16} className="text-stone-400 dark:text-stone-400" />;
    }
  }

  return <AutolayoutgridDot size={16} className="text-stone-400 dark:text-stone-400" />;
}

AlignmentGridNew.displayName = "AlignmentGridNew";
