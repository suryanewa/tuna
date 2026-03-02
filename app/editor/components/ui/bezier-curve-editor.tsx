"use client";

import * as React from "react";

interface BezierCurveEditorProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  onChange: (x1: number, y1: number, x2: number, y2: number) => void;
  disabled?: boolean;
}

const PAD = 0.08; // padding inside SVG as fraction of viewBox
const VB = 1 + PAD * 2; // total viewBox size

/** Convert bezier coords (0-1, y-up) to SVG coords (y-down, with padding) */
function toSvg(bx: number, by: number): [number, number] {
  return [PAD + bx, PAD + (1 - by)];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function BezierCurveEditor({
  x1,
  y1,
  x2,
  y2,
  onChange,
  disabled = false,
}: BezierCurveEditorProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);

  // Local drag state — only this component re-renders during drag
  const [drag, setDrag] = React.useState<{
    which: "cp1" | "cp2";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  // Use dragged values while dragging, props otherwise
  const cx1 = drag ? drag.x1 : x1;
  const cy1 = drag ? drag.y1 : y1;
  const cx2 = drag ? drag.x2 : x2;
  const cy2 = drag ? drag.y2 : y2;

  const [p0x, p0y] = toSvg(0, 0);
  const [p3x, p3y] = toSvg(1, 1);
  const [cp1x, cp1y] = toSvg(cx1, cy1);
  const [cp2x, cp2y] = toSvg(cx2, cy2);

  const handlePointerDown = (
    e: React.PointerEvent<SVGElement>,
    which: "cp1" | "cp2"
  ) => {
    if (e.button !== 0 || disabled) return;
    e.preventDefault();
    e.stopPropagation();

    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();

    const cursorStyle = document.createElement("style");
    cursorStyle.textContent =
      "* { cursor: grabbing !important; user-select: none !important; }";
    document.head.appendChild(cursorStyle);

    const ac = new AbortController();
    let rafId = 0;
    // Snapshot current values at drag start
    let lx1 = x1, ly1 = y1, lx2 = x2, ly2 = y2;

    const onMove = (ev: PointerEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const bx = ((ev.clientX - rect.left) / rect.width) * VB - PAD;
        const by = 1 - (((ev.clientY - rect.top) / rect.height) * VB - PAD);
        const cx = round2(Math.max(0, Math.min(1, bx)));
        const cy = round2(by);

        if (which === "cp1") {
          lx1 = cx;
          ly1 = cy;
        } else {
          lx2 = cx;
          ly2 = cy;
        }
        // Local state keeps SVG smooth regardless of parent re-render speed
        setDrag({ which, x1: lx1, y1: ly1, x2: lx2, y2: ly2 });
        // Also update parent (text input) — parent re-render won't affect SVG
        onChange(lx1, ly1, lx2, ly2);
      });
    };

    const onUp = () => {
      cancelAnimationFrame(rafId);
      cursorStyle.remove();
      ac.abort();
      // Final commit + clear local drag state
      onChange(lx1, ly1, lx2, ly2);
      setDrag(null);
    };

    // Initialize drag state immediately
    setDrag({ which, x1, y1, x2, y2 });

    document.addEventListener("pointermove", onMove, { signal: ac.signal });
    document.addEventListener("pointerup", onUp, { signal: ac.signal });
    document.addEventListener("pointercancel", onUp, { signal: ac.signal });
  };

  const handleR = 0.035;
  const strokeW = 0.012;

  // Handle is at reset position when it's exactly at its anchor
  const cp1AtReset = cx1 === 0 && cy1 === 0;
  const cp2AtReset = cx2 === 1 && cy2 === 1;

  const resetHandle = (which: "cp1" | "cp2") => {
    if (disabled) return;
    if (which === "cp1") {
      onChange(0, 0, cx2, cy2);
    } else {
      onChange(cx1, cy1, 1, 1);
    }
  };

  return (
    <div className="flex justify-center py-10 border border-stone-200 dark:border-stone-700 overflow-hidden" style={{ borderRadius: 6 }}>
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VB} ${VB}`}
      overflow="visible"
      className="block"
      width={100}
      height={100}
      style={{ touchAction: "none" }}
    >
      {/* Dashed bounding box */}
      <rect
        x={PAD}
        y={PAD}
        width={1}
        height={1}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeW * 0.6}
        strokeDasharray={`${0.03} ${0.03}`}
        className="text-stone-300 dark:text-stone-600"
      />

      {/* Diagonal baseline (linear reference) */}
      <line
        x1={p0x}
        y1={p0y}
        x2={p3x}
        y2={p3y}
        stroke="currentColor"
        strokeWidth={strokeW * 0.6}
        className="text-stone-300 dark:text-stone-600"
      />

      {/* Hit area: P0 → CP1 (invisible wide target) */}
      <line
        x1={p0x}
        y1={p0y}
        x2={cp1x}
        y2={cp1y}
        stroke="transparent"
        strokeWidth={0.06}
        style={{ cursor: disabled ? "default" : "grab" }}
        onPointerDown={(e) => handlePointerDown(e, "cp1")}
      />

      {/* Handle arm: P0 → CP1 */}
      <line
        x1={p0x}
        y1={p0y}
        x2={cp1x}
        y2={cp1y}
        stroke="currentColor"
        strokeWidth={strokeW * 0.8}
        className="text-stone-400 dark:text-stone-500"
        style={{ pointerEvents: "none" }}
      />

      {/* Hit area: P3 → CP2 (invisible wide target) */}
      <line
        x1={p3x}
        y1={p3y}
        x2={cp2x}
        y2={cp2y}
        stroke="transparent"
        strokeWidth={0.06}
        style={{ cursor: disabled ? "default" : "grab" }}
        onPointerDown={(e) => handlePointerDown(e, "cp2")}
      />

      {/* Handle arm: P3 → CP2 */}
      <line
        x1={p3x}
        y1={p3y}
        x2={cp2x}
        y2={cp2y}
        stroke="currentColor"
        strokeWidth={strokeW * 0.8}
        className="text-stone-400 dark:text-stone-500"
        style={{ pointerEvents: "none" }}
      />

      {/* Bezier curve */}
      <path
        d={`M ${p0x},${p0y} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p3x},${p3y}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeW}
        strokeLinecap="round"
        className="text-stone-900 dark:text-stone-100"
      />

      {/* P0 anchor (bottom-left) — click to reset CP1 */}
      <circle
        cx={p0x}
        cy={p0y}
        r={handleR * 0.8}
        fill="currentColor"
        className="text-stone-900 dark:text-stone-100"
        style={{ cursor: disabled ? "default" : "pointer" }}
        onClick={() => resetHandle("cp1")}
      />

      {/* P3 anchor (top-right) — click to reset CP2 */}
      <circle
        cx={p3x}
        cy={p3y}
        r={handleR * 0.8}
        fill="currentColor"
        className="text-stone-900 dark:text-stone-100"
        style={{ cursor: disabled ? "default" : "pointer" }}
        onClick={() => resetHandle("cp2")}
      />

      {/* CP1 handle — draggable, white+stroke when at reset position */}
      <circle
        cx={cp1x}
        cy={cp1y}
        r={handleR}
        fill={cp1AtReset ? "white" : "currentColor"}
        stroke={cp1AtReset ? "currentColor" : "none"}
        strokeWidth={cp1AtReset ? strokeW : 0}
        className="text-stone-900 dark:text-stone-100"
        style={{ cursor: disabled ? "default" : "grab" }}
        onPointerDown={(e) => handlePointerDown(e, "cp1")}
      />

      {/* CP2 handle — draggable, white+stroke when at reset position */}
      <circle
        cx={cp2x}
        cy={cp2y}
        r={handleR}
        fill={cp2AtReset ? "white" : "currentColor"}
        stroke={cp2AtReset ? "currentColor" : "none"}
        strokeWidth={cp2AtReset ? strokeW : 0}
        className="text-stone-900 dark:text-stone-100"
        style={{ cursor: disabled ? "default" : "grab" }}
        onPointerDown={(e) => handlePointerDown(e, "cp2")}
      />
    </svg>
    </div>
  );
}

BezierCurveEditor.displayName = "BezierCurveEditor";
