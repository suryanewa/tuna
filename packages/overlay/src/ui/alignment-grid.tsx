/**
 * AlignmentGrid — 3x3 grid for setting justifyContent + alignItems visually.
 * Ported from the portfolio editor's AlignmentGridNew component.
 *
 * - Click a cell to set alignment
 * - Double-click to toggle space-between mode
 * - Arrow keys for keyboard navigation
 * - Flow-aware icons (vertical vs horizontal)
 */

import { useState, useCallback } from "react";
import { Tooltip } from "./tooltip";

export type FlowDirection = "vertical" | "horizontal";

export interface AlignmentGridProps {
  justifyContent: string;
  alignItems: string;
  flexDirection: string;
  onChange: (prop: string, value: string) => void;
}

// ── Position types ──────────────────────────────────────────────────────

type AlignmentPosition =
  | "top-left" | "top-center" | "top-right"
  | "center-left" | "center-center" | "center-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

const COORDS_TO_POSITION: AlignmentPosition[][] = [
  ["top-left", "top-center", "top-right"],
  ["center-left", "center-center", "center-right"],
  ["bottom-left", "bottom-center", "bottom-right"],
];

const POSITION_TO_COORDS: Record<AlignmentPosition, { row: number; col: number }> = {
  "top-left": { row: 0, col: 0 }, "top-center": { row: 0, col: 1 }, "top-right": { row: 0, col: 2 },
  "center-left": { row: 1, col: 0 }, "center-center": { row: 1, col: 1 }, "center-right": { row: 1, col: 2 },
  "bottom-left": { row: 2, col: 0 }, "bottom-center": { row: 2, col: 1 }, "bottom-right": { row: 2, col: 2 },
};

// Space-between canonical positions (only cross-axis matters)
const SB_VERTICAL_CANONICAL: AlignmentPosition[] = ["center-left", "center-center", "center-right"];
const SB_HORIZONTAL_CANONICAL: AlignmentPosition[] = ["top-center", "center-center", "bottom-center"];

// ── CSS value mapping ───────────────────────────────────────────────────

const JUSTIFY_VALUES = ["flex-start", "center", "flex-end"] as const;
const ALIGN_VALUES = ["flex-start", "center", "flex-end"] as const;

function cssToPosition(justifyContent: string, alignItems: string, flow: FlowDirection): AlignmentPosition {
  const jIdx = justifyContent === "center" ? 1 : justifyContent === "flex-end" ? 2 : 0;
  const aIdx = alignItems === "center" ? 1 : alignItems === "flex-end" ? 2 : 0;
  // For vertical: row=justify (main), col=align (cross)
  // For horizontal: row=align (cross), col=justify (main)
  if (flow === "vertical") return COORDS_TO_POSITION[jIdx][aIdx];
  return COORDS_TO_POSITION[aIdx][jIdx];
}

function positionToCss(row: number, col: number, flow: FlowDirection): { justifyContent: string; alignItems: string } {
  if (flow === "vertical") {
    return { justifyContent: JUSTIFY_VALUES[row], alignItems: ALIGN_VALUES[col] };
  }
  return { justifyContent: JUSTIFY_VALUES[col], alignItems: ALIGN_VALUES[row] };
}

function getFlow(flexDirection: string): FlowDirection {
  return flexDirection.startsWith("column") ? "vertical" : "horizontal";
}

// ── Inline SVG icons (from portfolio editor) ────────────────────────────

function IconDot({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 7C8.55228 7 9 7.44772 9 8C9 8.55228 8.55228 9 8 9C7.44772 9 7 8.55228 7 8C7 7.44772 7.44772 7 8 7Z" fill={color} fillOpacity={0.3} />
    </svg>
  );
}

// Vertical flow icons (cross-axis = horizontal alignment)
function IconPositionLeft({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path fillRule="evenodd" clipRule="evenodd" d="M4 3C3.44772 3 3 3.44772 3 4C3 4.55228 3.44772 5 4 5L9 5C9.55228 5 10 4.55229 10 4C10 3.44772 9.55228 3 9 3L4 3ZM4 7C3.44772 7 3 7.44772 3 8C3 8.55228 3.44772 9 4 9L12 9C12.5523 9 13 8.55229 13 8C13 7.44772 12.5523 7 12 7L4 7ZM3 12C3 11.4477 3.44771 11 4 11L7 11C7.55228 11 8 11.4477 8 12C8 12.5523 7.55228 13 7 13L4 13C3.44771 13 3 12.5523 3 12Z" fill={color} />
    </svg>
  );
}

function IconPositionCenterH({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path fillRule="evenodd" clipRule="evenodd" d="M10 3C10.5523 3 11 3.44772 11 4C11 4.55228 10.5523 5 10 5L6 5C5.44772 5 5 4.55228 5 4C5 3.44772 5.44772 3 6 3H10ZM12 7C12.5523 7 13 7.44772 13 8C13 8.55228 12.5523 9 12 9L4 9C3.44772 9 3 8.55228 3 8C3 7.44771 3.44772 7 4 7L12 7ZM10 12C10 11.4477 9.55228 11 9 11H7C6.44772 11 6 11.4477 6 12C6 12.5523 6.44772 13 7 13H9C9.55228 13 10 12.5523 10 12Z" fill={color} />
    </svg>
  );
}

function IconPositionRight({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path fillRule="evenodd" clipRule="evenodd" d="M4 7C3.44772 7 3 7.44772 3 8C3 8.55228 3.44772 9 4 9L12 9C12.5523 9 13 8.55229 13 8C13 7.44772 12.5523 7 12 7L4 7ZM7 3C6.44772 3 6 3.44772 6 4C6 4.55228 6.44772 5 7 5L12 5C12.5523 5 13 4.55229 13 4C13 3.44772 12.5523 3 12 3L7 3ZM8 12C8 11.4477 8.44771 11 9 11L12 11C12.5523 11 13 11.4477 13 12C13 12.5523 12.5523 13 12 13L9 13C8.44771 13 8 12.5523 8 12Z" fill={color} />
    </svg>
  );
}

// Horizontal flow icons (cross-axis = vertical alignment)
function IconPositionTop({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path fillRule="evenodd" clipRule="evenodd" d="M3 4C3 3.44772 3.44772 3 4 3C4.55228 3 5 3.44772 5 4V9C5 9.55228 4.55228 10 4 10C3.44772 10 3 9.55228 3 9V4ZM7 4C7 3.44772 7.44772 3 8 3C8.55228 3 9 3.44772 9 4V12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12V4ZM12 3C11.4477 3 11 3.44772 11 4V7C11 7.55228 11.4477 8 12 8C12.5523 8 13 7.55228 13 7V4C13 3.44772 12.5523 3 12 3Z" fill={color} />
    </svg>
  );
}

function IconPositionCenterV({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path fillRule="evenodd" clipRule="evenodd" d="M7 4C7 3.44772 7.44772 3 8 3C8.55228 3 9 3.44772 9 4V12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12V4ZM3 6C3 5.44772 3.44772 5 4 5C4.55228 5 5 5.44772 5 6V10C5 10.5523 4.55228 11 4 11C3.44772 11 3 10.5523 3 10V6ZM12 6C11.4477 6 11 6.44772 11 7V9C11 9.55228 11.4477 10 12 10C12.5523 10 13 9.55228 13 9V7C13 6.44772 12.5523 6 12 6Z" fill={color} />
    </svg>
  );
}

function IconPositionBottom({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path fillRule="evenodd" clipRule="evenodd" d="M7 4C7 3.44772 7.44772 3 8 3C8.55228 3 9 3.44772 9 4V12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12V4ZM3 7C3 6.44772 3.44772 6 4 6C4.55228 6 5 6.44772 5 7V12C5 12.5523 4.55228 13 4 13C3.44772 13 3 12.5523 3 12V7ZM12 8C11.4477 8 11 8.44772 11 9V12C11 12.5523 11.4477 13 12 13C12.5523 13 13 12.5523 13 12V9C13 8.44772 12.5523 8 12 8Z" fill={color} />
    </svg>
  );
}

// Space-between icons
function IconSBBarH({ color }: { color: string }) {
  // Full-width horizontal bar (edges in vertical SB)
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M12 7C12.5523 7 13 7.44772 13 8C13 8.55229 12.5523 9 12 9L4 9C3.44772 9 3 8.55228 3 8C3 7.44772 3.44771 7 4 7L12 7Z" fill={color} />
    </svg>
  );
}

function IconSBBarHLeft({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 7C3.44772 7 3 7.44772 3 8C3 8.55228 3.44772 9 4 9L8 9C8.55228 9 9 8.55229 9 8C9 7.44772 8.55228 7 8 7L4 7Z" fill={color} />
    </svg>
  );
}

function IconSBBarHCenter({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 7C5.44772 7 5 7.44772 5 8C5 8.55228 5.44772 9 6 9L10 9C10.5523 9 11 8.55228 11 8C11 7.44772 10.5523 7 10 7L6 7Z" fill={color} />
    </svg>
  );
}

function IconSBBarHRight({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9L12 9C12.5523 9 13 8.55229 13 8C13 7.44772 12.5523 7 12 7L8 7Z" fill={color} />
    </svg>
  );
}

function IconSBBarV({ color }: { color: string }) {
  // Full-height vertical bar (edges in horizontal SB)
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M7 4C7 3.44772 7.44772 3 8 3C8.55228 3 9 3.44772 9 4V12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12V4Z" fill={color} />
    </svg>
  );
}

function IconSBBarVTop({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path fillRule="evenodd" clipRule="evenodd" d="M8 3C7.44772 3 7 3.44772 7 4V8C7 8.55228 7.44772 9 8 9C8.55228 9 9 8.55228 9 8V4C9 3.44772 8.55228 3 8 3Z" fill={color} />
    </svg>
  );
}

function IconSBBarVCenter({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path fillRule="evenodd" clipRule="evenodd" d="M8 5C7.44772 5 7 5.44772 7 6V10C7 10.5523 7.44772 11 8 11C8.55228 11 9 10.5523 9 10V6C9 5.44772 8.55228 5 8 5Z" fill={color} />
    </svg>
  );
}

function IconSBBarVBottom({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path fillRule="evenodd" clipRule="evenodd" d="M8 7C7.44772 7 7 7.44772 7 8V12C7 12.5523 7.44772 13 8 13C8.55228 13 9 12.5523 9 12V8C9 7.44772 8.55228 7 8 7Z" fill={color} />
    </svg>
  );
}

// ── Icon selection helpers ───────────────────────────────────────────────

const BLUE = "#2563eb";
const GRAY = "#a8a29e";

const CELL_TOOLTIPS: Record<string, string> = {
  "0-0": "Align top left",
  "0-1": "Align top center",
  "0-2": "Align top right",
  "1-0": "Align center left",
  "1-1": "Align center",
  "1-2": "Align center right",
  "2-0": "Align bottom left",
  "2-1": "Align bottom center",
  "2-2": "Align bottom right",
};

function getSelectedIcon(position: AlignmentPosition, flow: FlowDirection) {
  const { row, col } = POSITION_TO_COORDS[position];
  if (flow === "vertical") {
    return col === 0 ? IconPositionLeft : col === 1 ? IconPositionCenterH : IconPositionRight;
  }
  return row === 0 ? IconPositionTop : row === 1 ? IconPositionCenterV : IconPositionBottom;
}

function getSpaceBetweenIcon(row: number, col: number, activeGroup: number, flow: FlowDirection) {
  if (flow === "vertical") {
    if (col !== activeGroup) return null;
    const isEdge = row === 0 || row === 2;
    if (isEdge) return IconSBBarH;
    return activeGroup === 0 ? IconSBBarHLeft : activeGroup === 1 ? IconSBBarHCenter : IconSBBarHRight;
  } else {
    if (row !== activeGroup) return null;
    const isEdge = col === 0 || col === 2;
    if (isEdge) return IconSBBarV;
    return activeGroup === 0 ? IconSBBarVTop : activeGroup === 1 ? IconSBBarVCenter : IconSBBarVBottom;
  }
}

// ── Component ───────────────────────────────────────────────────────────

export function AlignmentGrid({ justifyContent, alignItems, flexDirection, onChange }: AlignmentGridProps) {
  const flow = getFlow(flexDirection);
  const isSpaceBetween = justifyContent === "space-between";
  const position = isSpaceBetween
    ? (flow === "vertical"
        ? SB_VERTICAL_CANONICAL[alignItems === "center" ? 1 : alignItems === "flex-end" ? 2 : 0]
        : SB_HORIZONTAL_CANONICAL[alignItems === "center" ? 1 : alignItems === "flex-end" ? 2 : 0])
    : cssToPosition(justifyContent, alignItems, flow);
  const selectedCoords = POSITION_TO_COORDS[position];
  const activeGroup = isSpaceBetween
    ? (flow === "vertical" ? selectedCoords.col : selectedCoords.row)
    : -1;

  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<AlignmentPosition | null>(null);

  const handleClick = useCallback((row: number, col: number) => {
    if (isSpaceBetween) {
      const crossIdx = flow === "vertical" ? col : row;
      onChange("alignItems", ALIGN_VALUES[crossIdx]);
    } else {
      const css = positionToCss(row, col, flow);
      onChange("justifyContent", css.justifyContent);
      onChange("alignItems", css.alignItems);
    }
  }, [flow, isSpaceBetween, onChange]);

  const handleDoubleClick = useCallback(() => {
    if (isSpaceBetween) {
      const css = positionToCss(selectedCoords.row, selectedCoords.col, flow);
      onChange("justifyContent", css.justifyContent);
    } else {
      onChange("justifyContent", "space-between");
    }
  }, [isSpaceBetween, selectedCoords, flow, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const { row, col } = selectedCoords;
    let newRow = row;
    let newCol = col;

    if (isSpaceBetween) {
      if (flow === "vertical") {
        if (e.key === "ArrowLeft") { newCol = Math.max(0, col - 1); e.preventDefault(); }
        else if (e.key === "ArrowRight") { newCol = Math.min(2, col + 1); e.preventDefault(); }
        else return;
      } else {
        if (e.key === "ArrowUp") { newRow = Math.max(0, row - 1); e.preventDefault(); }
        else if (e.key === "ArrowDown") { newRow = Math.min(2, row + 1); e.preventDefault(); }
        else return;
      }
    } else {
      switch (e.key) {
        case "ArrowUp": newRow = Math.max(0, row - 1); e.preventDefault(); break;
        case "ArrowDown": newRow = Math.min(2, row + 1); e.preventDefault(); break;
        case "ArrowLeft": newCol = Math.max(0, col - 1); e.preventDefault(); break;
        case "ArrowRight": newCol = Math.min(2, col + 1); e.preventDefault(); break;
        default: return;
      }
    }

    if (newRow !== row || newCol !== col) {
      if (isSpaceBetween) {
        const crossIdx = flow === "vertical" ? newCol : newRow;
        onChange("alignItems", ALIGN_VALUES[crossIdx]);
      } else {
        const css = positionToCss(newRow, newCol, flow);
        onChange("justifyContent", css.justifyContent);
        onChange("alignItems", css.alignItems);
      }
    }
  }, [selectedCoords, isSpaceBetween, flow, onChange]);

  const handleMouseEnter = useCallback((row: number, col: number) => {
    if (isSpaceBetween) {
      setHoveredGroup(flow === "vertical" ? col : row);
    } else {
      setHoveredPosition(COORDS_TO_POSITION[row][col]);
    }
  }, [isSpaceBetween, flow]);

  const handleMouseLeave = useCallback(() => {
    setHoveredGroup(null);
    setHoveredPosition(null);
  }, []);

  return (
    <div
      className="composer-alignment-grid"
      tabIndex={0}
      role="grid"
      aria-label="Alignment grid"
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
    >
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => {
          const pos = COORDS_TO_POSITION[row][col];
          return (
            <Tooltip key={`${row}-${col}`} content={CELL_TOOLTIPS[`${row}-${col}`]} side="bottom" delay={600}>
              <button
                type="button"
                className="composer-alignment-cell"
                onClick={() => handleClick(row, col)}
                onMouseEnter={() => handleMouseEnter(row, col)}
                onMouseLeave={handleMouseLeave}
                tabIndex={-1}
                aria-label={pos.replace("-", " ")}
              >
                {isSpaceBetween
                  ? renderSpaceBetweenCell(row, col, activeGroup, hoveredGroup, flow)
                  : renderNormalCell(row, col, selectedCoords, hoveredPosition, pos, flow)}
              </button>
            </Tooltip>
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
    const Icon = getSelectedIcon(position, flow);
    return <Icon color={BLUE} />;
  }
  if (hoveredPosition === position) {
    const Icon = getSelectedIcon(position, flow);
    return <Icon color={GRAY} />;
  }
  return <IconDot color={GRAY} />;
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
    if (Icon) return <Icon color={BLUE} />;
  }
  if (isHovered) {
    const Icon = getSpaceBetweenIcon(row, col, cellGroup, flow);
    if (Icon) return <Icon color={GRAY} />;
  }
  return <IconDot color={GRAY} />;
}
