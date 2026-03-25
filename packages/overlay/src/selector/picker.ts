/**
 * Element picker: hover to highlight, click to select.
 *
 * Uses a fixed-position overlay with pointer-events:none so
 * elementFromPoint() returns the real element underneath.
 * All event listeners use capture phase to intercept before page handlers.
 *
 * Selection persists until a new element is selected or picker is deactivated.
 * Hover box becomes dashed when a selection exists.
 */

export interface PickerCallbacks {
  onHover: (element: Element, rect: DOMRect) => void;
  onSelect: (element: Element) => void;
  onCancel: () => void;
  onDoubleClick?: (element: Element) => void;
  onResize?: (element: Element, property: "width" | "height", value: string) => void;
  /** Called during resize drag for live preview (updates stylesheet without recording changes) */
  onResizePreview?: (element: Element, property: "width" | "height", value: string) => void;
}

export function createPicker(
  shadowRoot: ShadowRoot,
  callbacks: PickerCallbacks
) {
  // Hover highlight
  const highlight = document.createElement("div");
  highlight.setAttribute("data-retune-highlight", "");
  shadowRoot.appendChild(highlight);

  const label = document.createElement("div");
  label.setAttribute("data-retune-label", "");
  shadowRoot.appendChild(label);

  // Selection highlight (persistent)
  const selection = document.createElement("div");
  selection.setAttribute("data-retune-selection", "");
  shadowRoot.appendChild(selection);

  const selectionLabel = document.createElement("div");
  selectionLabel.setAttribute("data-retune-selection-label", "");
  shadowRoot.appendChild(selectionLabel);

  // Parent indicator (dotted outline, no fill — shown during fill snap)
  const parentIndicator = document.createElement("div");
  parentIndicator.setAttribute("data-retune-parent-indicator", "");
  parentIndicator.style.cssText = `
    position:fixed;display:none;pointer-events:none;z-index:2147483644;
    border:1px dotted #0D99FF;background:none;border-radius:0;
  `;
  shadowRoot.appendChild(parentIndicator);

  let active = false;
  let suspended = false; // temporarily suppress hover (e.g. during text editing)
  let hoveredElement: Element | null = null;
  let selectedElement: Element | null = null;
  let selectionLabelHidden = false;
  let trackingRaf: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSelRect = { top: 0, left: 0, width: 0, height: 0 };

  // Click-to-cycle: repeated clicks at the same spot cycle through the element stack
  let lastClickPos = { x: 0, y: 0 };
  let elementStack: Element[] = [];
  let stackIndex = -1;
  const CLICK_RADIUS = 5; // px tolerance for "same spot"

  // Apply base styles once, then only update position
  function initBoxStyles(box: HTMLElement, labelEl: HTMLElement) {
    box.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483644;
      box-sizing: border-box;
      display: none;
    `;
    labelEl.style.cssText = `
      position: fixed;
      color: white;
      font-size: 11px;
      font-family: InterVariable, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-feature-settings: 'liga' 1, 'calt' 1, 'zero' 0, 'tnum' 0;
      padding: 2px 6px;
      border-radius: 3px;
      pointer-events: none;
      z-index: 2147483646;
      white-space: nowrap;
      display: none;
    `;
  }

  initBoxStyles(highlight, label);
  initBoxStyles(selection, selectionLabel);

  // ── Resize handles (corners + edges) ──
  const HANDLE_SIZE = 8;
  const HALF_HANDLE = HANDLE_SIZE / 2;
  const EDGE_HIT_SIZE = 6; // invisible grab zone width for edges

  type HandlePos = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
  const CORNER_POSITIONS: HandlePos[] = ["nw", "ne", "se", "sw"];
  const EDGE_POSITIONS: HandlePos[] = ["n", "e", "s", "w"];
  const ALL_POSITIONS: HandlePos[] = [...CORNER_POSITIONS, ...EDGE_POSITIONS];

  const HANDLE_CURSORS: Record<HandlePos, string> = {
    nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize", e: "ew-resize",
    se: "nwse-resize", s: "ns-resize", sw: "nesw-resize", w: "ew-resize",
  };
  const HANDLE_AXES: Record<HandlePos, { dx: -1 | 0 | 1; dy: -1 | 0 | 1 }> = {
    nw: { dx: -1, dy: -1 }, n: { dx: 0, dy: -1 }, ne: { dx: 1, dy: -1 }, e: { dx: 1, dy: 0 },
    se: { dx: 1, dy: 1 }, s: { dx: 0, dy: 1 }, sw: { dx: -1, dy: 1 }, w: { dx: -1, dy: 0 },
  };

  const handleEls: Record<string, HTMLElement> = {};

  // Corner handles: visible white squares
  for (const pos of CORNER_POSITIONS) {
    const h = document.createElement("div");
    h.style.cssText = `
      position:fixed;pointer-events:auto;display:none;box-sizing:border-box;
      width:${HANDLE_SIZE}px;height:${HANDLE_SIZE}px;
      background:#fff;border:1px solid #0D99FF;border-radius:1px;
      z-index:2147483645;cursor:${HANDLE_CURSORS[pos]};
    `;
    shadowRoot.appendChild(h);
    handleEls[pos] = h;
  }

  // Edge handles: invisible hit zones along sides
  for (const pos of EDGE_POSITIONS) {
    const h = document.createElement("div");
    h.style.cssText = `
      position:fixed;pointer-events:auto;display:none;
      z-index:2147483645;cursor:${HANDLE_CURSORS[pos]};
    `;
    shadowRoot.appendChild(h);
    handleEls[pos] = h;
  }

  function positionHandles(rect: DOMRect) {
    // Corners
    const corners: Record<string, { x: number; y: number }> = {
      nw: { x: rect.left, y: rect.top }, ne: { x: rect.right, y: rect.top },
      se: { x: rect.right, y: rect.bottom }, sw: { x: rect.left, y: rect.bottom },
    };
    for (const pos of CORNER_POSITIONS) {
      const h = handleEls[pos];
      const p = corners[pos];
      h.style.left = `${p.x - HALF_HANDLE}px`;
      h.style.top = `${p.y - HALF_HANDLE}px`;
      h.style.display = "block";
    }
    // Edges: invisible hit zones between corners
    const inset = HALF_HANDLE;
    handleEls.n.style.cssText += `display:block;left:${rect.left + inset}px;top:${rect.top - EDGE_HIT_SIZE / 2}px;width:${rect.width - inset * 2}px;height:${EDGE_HIT_SIZE}px;cursor:${HANDLE_CURSORS.n};`;
    handleEls.s.style.cssText += `display:block;left:${rect.left + inset}px;top:${rect.bottom - EDGE_HIT_SIZE / 2}px;width:${rect.width - inset * 2}px;height:${EDGE_HIT_SIZE}px;cursor:${HANDLE_CURSORS.s};`;
    handleEls.e.style.cssText += `display:block;left:${rect.right - EDGE_HIT_SIZE / 2}px;top:${rect.top + inset}px;width:${EDGE_HIT_SIZE}px;height:${rect.height - inset * 2}px;cursor:${HANDLE_CURSORS.e};`;
    handleEls.w.style.cssText += `display:block;left:${rect.left - EDGE_HIT_SIZE / 2}px;top:${rect.top + inset}px;width:${EDGE_HIT_SIZE}px;height:${rect.height - inset * 2}px;cursor:${HANDLE_CURSORS.w};`;
  }

  function hideHandles() {
    for (const pos of ALL_POSITIONS) handleEls[pos].style.display = "none";
  }

  // ── Snap guides ──
  const SNAP_THRESHOLD = 5;
  const snapGuidePool: Array<{ line: HTMLDivElement; label: HTMLDivElement }> = [];
  for (let i = 0; i < 8; i++) {
    const line = document.createElement("div");
    line.className = "retune-snap-guide";
    shadowRoot.appendChild(line);
    const label = document.createElement("div");
    label.className = "retune-snap-label";
    shadowRoot.appendChild(label);
    snapGuidePool.push({ line, label });
  }

  let snapCache: {
    siblingWidths: number[];
    siblingHeights: number[];
    siblingRects: DOMRect[];
    parentRect: DOMRect | null;
    parentWidth: number;
    parentHeight: number;
    parentPadding: { top: number; right: number; bottom: number; left: number };
  } | null = null;

  function buildSnapCache(el: Element) {
    const parent = el.parentElement;
    const siblings = parent
      ? Array.from(parent.children).filter(c => c !== el && c.tagName !== "SCRIPT" && c.tagName !== "STYLE")
      : [];
    const siblingRects = siblings.map(s => s.getBoundingClientRect());
    const siblingWidths = [...new Set(siblingRects.map(r => Math.round(r.width)))].sort((a, b) => a - b);
    const siblingHeights = [...new Set(siblingRects.map(r => Math.round(r.height)))].sort((a, b) => a - b);
    const parentRect = parent ? parent.getBoundingClientRect() : null;
    const parentCs = parent ? getComputedStyle(parent) : null;
    const parentWidth = parentRect && parentCs
      ? parentRect.width - parseFloat(parentCs.paddingLeft) - parseFloat(parentCs.paddingRight) - parseFloat(parentCs.borderLeftWidth) - parseFloat(parentCs.borderRightWidth)
      : 0;
    const parentHeight = parentRect && parentCs
      ? parentRect.height - parseFloat(parentCs.paddingTop) - parseFloat(parentCs.paddingBottom) - parseFloat(parentCs.borderTopWidth) - parseFloat(parentCs.borderBottomWidth)
      : 0;
    const parentPadding = parentCs ? {
      top: parseFloat(parentCs.paddingTop) || 0,
      right: parseFloat(parentCs.paddingRight) || 0,
      bottom: parseFloat(parentCs.paddingBottom) || 0,
      left: parseFloat(parentCs.paddingLeft) || 0,
    } : { top: 0, right: 0, bottom: 0, left: 0 };
    snapCache = { siblingWidths, siblingHeights, siblingRects, parentRect, parentWidth: Math.round(parentWidth), parentHeight: Math.round(parentHeight), parentPadding };
  }

  function findSnap(value: number, candidates: number[]): number | null {
    // Binary search for nearest candidate within threshold
    let lo = 0, hi = candidates.length - 1;
    let best: number | null = null;
    let bestDist = SNAP_THRESHOLD + 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const dist = Math.abs(candidates[mid] - value);
      if (dist < bestDist) { bestDist = dist; best = candidates[mid]; }
      if (candidates[mid] < value) lo = mid + 1;
      else hi = mid - 1;
    }
    return bestDist <= SNAP_THRESHOLD ? best : null;
  }

  type SnapGuide = { axis: "x" | "y"; value: number; ref: number; refRect?: DOMRect; fill?: boolean };

  function snapResize(w: number, h: number, axes: { dx: number; dy: number }): { width: number; height: number; guides: SnapGuide[]; fillWidth: boolean; fillHeight: boolean } {
    if (!snapCache) return { width: w, height: h, guides: [], fillWidth: false, fillHeight: false };
    const guides: SnapGuide[] = [];
    let fillWidth = false;
    let fillHeight = false;

    if (axes.dx !== 0) {
      // Check parent content width first (fill takes priority)
      const parentSnapW = Math.abs(w - snapCache.parentWidth) <= SNAP_THRESHOLD ? snapCache.parentWidth : null;
      if (parentSnapW !== null) {
        w = parentSnapW;
        fillWidth = true;
        guides.push({ axis: "x", value: parentSnapW, ref: parentSnapW, fill: true });
      } else {
        // Check sibling widths
        const snapW = findSnap(w, snapCache.siblingWidths);
        if (snapW !== null) {
          w = snapW;
          const matchRect = snapCache.siblingRects.find(r => Math.round(r.width) === snapW);
          guides.push({ axis: "x", value: snapW, ref: snapW, refRect: matchRect });
        }
      }
    }

    if (axes.dy !== 0) {
      const parentSnapH = Math.abs(h - snapCache.parentHeight) <= SNAP_THRESHOLD ? snapCache.parentHeight : null;
      if (parentSnapH !== null) {
        h = parentSnapH;
        fillHeight = true;
        guides.push({ axis: "y", value: parentSnapH, ref: parentSnapH, fill: true });
      } else {
        const snapH = findSnap(h, snapCache.siblingHeights);
        if (snapH !== null) {
          h = snapH;
          const matchRect = snapCache.siblingRects.find(r => Math.round(r.height) === snapH);
          guides.push({ axis: "y", value: snapH, ref: snapH, refRect: matchRect });
        }
      }
    }

    return { width: w, height: h, guides, fillWidth, fillHeight };
  }

  const XMARK_SIZE = 4; // half-size of the X mark (8px total)

  function drawXMark(el: HTMLDivElement, x: number, y: number) {
    el.style.cssText = `
      position:fixed;pointer-events:none;z-index:2147483645;
      top:${y - XMARK_SIZE}px;left:${x - XMARK_SIZE}px;
      width:${XMARK_SIZE * 2}px;height:${XMARK_SIZE * 2}px;
      background:none;
    `;
    // Draw X using two rotated lines via pseudo-element alternative: use border trick
    // Simpler: use an inline SVG background
    el.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${XMARK_SIZE * 2}' height='${XMARK_SIZE * 2}'%3E%3Cline x1='2' y1='2' x2='${XMARK_SIZE * 2 - 2}' y2='${XMARK_SIZE * 2 - 2}' stroke='%23e5484d' stroke-width='1'/%3E%3Cline x1='${XMARK_SIZE * 2 - 2}' y1='2' x2='2' y2='${XMARK_SIZE * 2 - 2}' stroke='%23e5484d' stroke-width='1'/%3E%3C/svg%3E")`;
    el.style.backgroundSize = "contain";
  }

  function showSnapGuides(guides: SnapGuide[], elRect: DOMRect, handle: HandlePos) {
    // Hide snap visuals (not parent indicator — that's managed by showSelection)
    for (const g of snapGuidePool) {
      g.line.classList.remove("visible");
      g.label.classList.remove("visible");
      g.label.style.display = "";
    }

    const axes = HANDLE_AXES[handle];
    let poolIdx = 0;

    for (const guide of guides) {
      if (guide.fill && snapCache?.parentRect) {
        const pr = snapCache.parentRect;
        const pad = snapCache.parentPadding;
        const hasPadding = guide.axis === "x" ? (pad.left > 0 || pad.right > 0) : (pad.top > 0 || pad.bottom > 0);

        // Always show dotted parent indicator
        parentIndicator.style.cssText = `
          position:fixed;display:block;pointer-events:none;z-index:2147483644;
          border:1px dotted #0D99FF;background:none;
          top:${pr.top}px;left:${pr.left}px;width:${pr.width}px;height:${pr.height}px;
        `;

        if (hasPadding) {
          // Show padding stripe rects
          const PADDING_BG = "repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(13, 153, 255, 0.5) 3px, rgba(13, 153, 255, 0.5) 4px)";

          if (guide.axis === "x") {
            if (pad.left > 0 && poolIdx < snapGuidePool.length) {
              const g1 = snapGuidePool[poolIdx++];
              g1.line.style.cssText = `position:fixed;pointer-events:none;z-index:2147483645;top:${pr.top}px;left:${pr.left}px;width:${pad.left}px;height:${pr.height}px;background:${PADDING_BG};`;
              g1.line.classList.add("visible");
            }
            if (pad.right > 0 && poolIdx < snapGuidePool.length) {
              const g2 = snapGuidePool[poolIdx++];
              g2.line.style.cssText = `position:fixed;pointer-events:none;z-index:2147483645;top:${pr.top}px;left:${pr.right - pad.right}px;width:${pad.right}px;height:${pr.height}px;background:${PADDING_BG};`;
              g2.line.classList.add("visible");
            }
          } else {
            if (pad.top > 0 && poolIdx < snapGuidePool.length) {
              const g1 = snapGuidePool[poolIdx++];
              g1.line.style.cssText = `position:fixed;pointer-events:none;z-index:2147483645;top:${pr.top}px;left:${pr.left}px;width:${pr.width}px;height:${pad.top}px;background:${PADDING_BG};`;
              g1.line.classList.add("visible");
            }
            if (pad.bottom > 0 && poolIdx < snapGuidePool.length) {
              const g2 = snapGuidePool[poolIdx++];
              g2.line.style.cssText = `position:fixed;pointer-events:none;z-index:2147483645;top:${pr.bottom - pad.bottom}px;left:${pr.left}px;width:${pr.width}px;height:${pad.bottom}px;background:${PADDING_BG};`;
              g2.line.classList.add("visible");
            }
          }
        } else {
          // No padding — show X marks on parent corners on the drag side
          if (guide.axis === "x") {
            const side = axes.dx > 0 ? "right" : "left";
            const x = side === "right" ? pr.right : pr.left;
            if (poolIdx < snapGuidePool.length) {
              const g1 = snapGuidePool[poolIdx++];
              drawXMark(g1.line, x, pr.top);
              g1.line.classList.add("visible");
            }
            if (poolIdx < snapGuidePool.length) {
              const g2 = snapGuidePool[poolIdx++];
              drawXMark(g2.line, x, pr.bottom);
              g2.line.classList.add("visible");
            }
          } else {
            const side = axes.dy > 0 ? "bottom" : "top";
            const y = side === "bottom" ? pr.bottom : pr.top;
            if (poolIdx < snapGuidePool.length) {
              const g1 = snapGuidePool[poolIdx++];
              drawXMark(g1.line, pr.left, y);
              g1.line.classList.add("visible");
            }
            if (poolIdx < snapGuidePool.length) {
              const g2 = snapGuidePool[poolIdx++];
              drawXMark(g2.line, pr.right, y);
              g2.line.classList.add("visible");
            }
          }
        }
      } else {
        // Sibling snap — X marks on corners
        const refRect = guide.refRect;
        if (!refRect || poolIdx + 1 >= snapGuidePool.length) continue;

        if (guide.axis === "x") {
          const side = axes.dx > 0 ? "right" : "left";
          const x = side === "right" ? refRect.right : refRect.left;
          const g1 = snapGuidePool[poolIdx++];
          drawXMark(g1.line, x, refRect.top);
          g1.line.classList.add("visible");
          const g2 = snapGuidePool[poolIdx++];
          drawXMark(g2.line, x, refRect.bottom);
          g2.line.classList.add("visible");
        } else {
          const side = axes.dy > 0 ? "bottom" : "top";
          const y = side === "bottom" ? refRect.bottom : refRect.top;
          const g1 = snapGuidePool[poolIdx++];
          drawXMark(g1.line, refRect.left, y);
          g1.line.classList.add("visible");
          const g2 = snapGuidePool[poolIdx++];
          drawXMark(g2.line, refRect.right, y);
          g2.line.classList.add("visible");
        }
      }
    }
  }

  function hideSnapGuides() {
    for (const g of snapGuidePool) {
      g.line.classList.remove("visible");
      g.label.classList.remove("visible");
    }
  }

  // ── Resize drag state ──
  let resizeFillWidth = false;
  let resizeFillHeight = false;
  let resizeDrag: {
    handle: HandlePos;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null = null;

  function handleResizePointerDown(e: PointerEvent, handle: HandlePos) {
    if (!selectedElement) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const rect = selectedElement.getBoundingClientRect();
    resizeDrag = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
    };

    // Cache snap targets
    buildSnapCache(selectedElement);

    document.addEventListener("pointermove", handleResizePointerMove, true);
    document.addEventListener("pointerup", handleResizePointerUp, true);
  }

  function computeResize(e: PointerEvent): { width: number; height: number } {
    if (!resizeDrag) return { width: 0, height: 0 };
    const axes = HANDLE_AXES[resizeDrag.handle];
    const dx = e.clientX - resizeDrag.startX;
    const dy = e.clientY - resizeDrag.startY;
    const MIN_SIZE = 10;

    let w = axes.dx !== 0 ? Math.max(MIN_SIZE, resizeDrag.startWidth + dx * axes.dx) : resizeDrag.startWidth;
    let h = axes.dy !== 0 ? Math.max(MIN_SIZE, resizeDrag.startHeight + dy * axes.dy) : resizeDrag.startHeight;

    // Shift = aspect ratio lock (only for corners)
    if (e.shiftKey && axes.dx !== 0 && axes.dy !== 0 && resizeDrag.startWidth > 0 && resizeDrag.startHeight > 0) {
      const ratio = resizeDrag.startWidth / resizeDrag.startHeight;
      if (w / ratio < h) h = w / ratio;
      else w = h * ratio;
    }
    return { width: Math.round(w), height: Math.round(h) };
  }

  function handleResizePointerMove(e: PointerEvent) {
    if (!resizeDrag || !selectedElement) return;
    e.preventDefault();

    const raw = computeResize(e);
    const axes = HANDLE_AXES[resizeDrag.handle];
    const { width, height, guides, fillWidth, fillHeight } = snapResize(raw.width, raw.height, axes);
    resizeFillWidth = fillWidth;
    resizeFillHeight = fillHeight;
    const el = selectedElement as HTMLElement;

    // Update LivePreviewEngine stylesheet for all matching instances
    if (axes.dx !== 0) callbacks.onResizePreview?.(selectedElement, "width", fillWidth ? "100%" : `${width}px`);
    if (axes.dy !== 0) callbacks.onResizePreview?.(selectedElement, "height", fillHeight ? "100%" : `${height}px`);
    // Also set inline !important on selected element to guarantee it wins
    if (axes.dx !== 0) el.style.setProperty("width", fillWidth ? "100%" : `${width}px`, "important");
    if (axes.dy !== 0) el.style.setProperty("height", fillHeight ? "100%" : `${height}px`, "important");

    // Update selection box and handles
    const newRect = selectedElement.getBoundingClientRect();
    positionBox(selection, selectionLabel, newRect, "solid", "0.04");
    positionHandles(newRect);
    selectionLabel.textContent = formatLabel(selectedElement);

    // Show/hide snap guides
    if (guides.length > 0) {
      showSnapGuides(guides, newRect, resizeDrag!.handle);
    } else {
      hideSnapGuides();
    }
  }

  function handleResizePointerUp(e: PointerEvent) {
    if (!resizeDrag || !selectedElement) {
      resizeDrag = null;
      return;
    }

    const raw = computeResize(e);
    const axes = HANDLE_AXES[resizeDrag.handle];
    const { width, height, fillWidth, fillHeight } = snapResize(raw.width, raw.height, axes);
    const el = selectedElement as HTMLElement;

    hideSnapGuides();
    snapCache = null;

    // Report final values through callback (keeps inline styles — LivePreviewEngine overrides)
    const widthChanged = axes.dx !== 0 && (fillWidth || Math.abs(width - resizeDrag.startWidth) > 0.5);
    const heightChanged = axes.dy !== 0 && (fillHeight || Math.abs(height - resizeDrag.startHeight) > 0.5);
    if (widthChanged) {
      el.style.removeProperty("width");
      callbacks.onResize?.(selectedElement, "width", fillWidth ? "100%" : `${width}px`);
    }
    if (heightChanged) {
      el.style.removeProperty("height");
      callbacks.onResize?.(selectedElement, "height", fillHeight ? "100%" : `${height}px`);
    }

    resizeDrag = null;
    resizeFillWidth = false;
    resizeFillHeight = false;
    document.removeEventListener("pointermove", handleResizePointerMove, true);
    document.removeEventListener("pointerup", handleResizePointerUp, true);

    // Refresh selection box
    const newRect = selectedElement.getBoundingClientRect();
    positionBox(selection, selectionLabel, newRect, "solid", "0.04");
    positionHandles(newRect);
    selectionLabel.textContent = formatLabel(selectedElement);
  }

  // Attach resize handlers to all handles
  for (const pos of ALL_POSITIONS) {
    handleEls[pos].addEventListener("pointerdown", (e) => handleResizePointerDown(e, pos));
  }

  // ── Spacing measurement lines ──
  // Shows distance between selected and hovered elements
  const spacingContainer = document.createElement("div");
  spacingContainer.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483646;";
  shadowRoot.appendChild(spacingContainer);

  const SPACING_LINE = "position:fixed;pointer-events:none;display:none;";
  const SPACING_LABEL = `
    position:fixed;pointer-events:none;display:none;
    font-size:10px;font-weight:500;
    font-family:InterVariable,Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
    color:#fff;white-space:nowrap;
    background:#e5484d;padding:1px 4px;border-radius:2px;
  `;

  function createMeasure() {
    const line = document.createElement("div");
    line.style.cssText = SPACING_LINE;
    const connector = document.createElement("div");
    connector.style.cssText = SPACING_LINE;
    const lbl = document.createElement("div");
    lbl.style.cssText = SPACING_LABEL;
    spacingContainer.appendChild(line);
    spacingContainer.appendChild(connector);
    spacingContainer.appendChild(lbl);
    return { line, connector, label: lbl };
  }

  const hMeasure = createMeasure(); // horizontal distance
  const vMeasure = createMeasure(); // vertical distance

  // Parent-child spacing: 4 lines (top, right, bottom, left)
  const parentMeasures = {
    top: createMeasure(),
    right: createMeasure(),
    bottom: createMeasure(),
    left: createMeasure(),
  };

  function hideSpacing() {
    for (const m of [hMeasure, vMeasure]) {
      m.line.style.display = "none";
      m.connector.style.display = "none";
      m.label.style.display = "none";
    }
    for (const m of Object.values(parentMeasures)) {
      m.line.style.display = "none";
      m.connector.style.display = "none";
      m.label.style.display = "none";
    }
  }

  function drawSegment(el: HTMLElement, x: number, y: number, size: number, horizontal: boolean, dashed = true) {
    el.style.cssText = `
      position:fixed;pointer-events:none;display:block;
      top:${y}px;left:${x}px;
      width:${horizontal ? size : 0}px;height:${horizontal ? 0 : size}px;
      border-${horizontal ? "top" : "left"}:1px ${dashed ? "dashed" : "solid"} #e5484d;
    `;
  }

  function positionLabel(el: HTMLElement, value: number, x: number, y: number, size: number, horizontal: boolean) {
    el.style.cssText = SPACING_LABEL;
    el.style.display = "block";
    el.textContent = `${value}`;
    if (horizontal) {
      el.style.top = `${y - 4}px`;
      el.style.left = `${x + size / 2}px`;
      el.style.transform = "translate(-50%, -100%)";
    } else {
      el.style.top = `${y + size / 2}px`;
      el.style.left = `${x + 4}px`;
      el.style.transform = "translateY(-50%)";
    }
  }

  function showSpacing(selRect: DOMRect, hoverRect: DOMRect) {
    hideSpacing();

    const hoverIsRight = hoverRect.left + hoverRect.width / 2 > selRect.left + selRect.width / 2;
    const hoverIsBelow = hoverRect.top + hoverRect.height / 2 > selRect.top + selRect.height / 2;

    // Nearest edges and gaps (negative gap = overlap, no line)
    const selEdgeX = hoverIsRight ? selRect.right : selRect.left;
    const selEdgeY = hoverIsBelow ? selRect.bottom : selRect.top;
    const hoverEdgeX = hoverIsRight ? hoverRect.left : hoverRect.right;
    const hoverEdgeY = hoverIsBelow ? hoverRect.top : hoverRect.bottom;

    const hGap = hoverIsRight ? (hoverRect.left - selRect.right) : (selRect.left - hoverRect.right);
    const vGap = hoverIsBelow ? (hoverRect.top - selRect.bottom) : (selRect.top - hoverRect.bottom);
    const hDist = hGap > 0 ? Math.round(hGap) : 0;
    const vDist = vGap > 0 ? Math.round(vGap) : 0;

    if (hDist <= 0 && vDist <= 0) return;

    // ── Horizontal line: from center of selected's left/right edge, going outward ──
    if (hDist > 0) {
      const hOriginX = selEdgeX;
      const hOriginY = selRect.top + selRect.height / 2;
      const hx1 = Math.min(hOriginX, hoverEdgeX);

      // Straight segment going outward
      drawSegment(hMeasure.line, hx1, hOriginY, hDist, true, false);
      positionLabel(hMeasure.label, hDist, hx1, hOriginY, hDist, true);

      // Can the straight line reach the hovered element?
      if (hOriginY >= hoverRect.top && hOriginY <= hoverRect.bottom) {
        // Yes — straight line connects directly
        hMeasure.connector.style.display = "none";
      } else {
        // No — bend 90° toward hovered's closest edge
        const bendTargetY = hoverIsBelow ? hoverRect.top : hoverRect.bottom;
        const cy1 = Math.min(hOriginY, bendTargetY);
        drawSegment(hMeasure.connector, hoverEdgeX, cy1, Math.abs(bendTargetY - hOriginY), false);
      }
    }

    // ── Vertical line: from center of selected's top/bottom edge, going outward ──
    if (vDist > 0) {
      const vOriginX = selRect.left + selRect.width / 2;
      const vOriginY = selEdgeY;
      const vy1 = Math.min(vOriginY, hoverEdgeY);

      // Straight segment going outward
      drawSegment(vMeasure.line, vOriginX, vy1, vDist, false, false);
      positionLabel(vMeasure.label, vDist, vOriginX, vy1, vDist, false);

      // Can the straight line reach the hovered element?
      if (vOriginX >= hoverRect.left && vOriginX <= hoverRect.right) {
        // Yes — straight line connects directly
        vMeasure.connector.style.display = "none";
      } else {
        // No — bend 90° toward hovered's closest edge
        const bendTargetX = hoverIsRight ? hoverRect.left : hoverRect.right;
        const cx1 = Math.min(vOriginX, bendTargetX);
        drawSegment(vMeasure.connector, cx1, hoverEdgeY, Math.abs(bendTargetX - vOriginX), true);
      }
    }
  }

  /** Show distances from selected child to all four inner edges of a parent container. */
  function showParentSpacing(childRect: DOMRect, parentEl: Element) {
    hideSpacing();

    const computed = getComputedStyle(parentEl);
    const parentRect = parentEl.getBoundingClientRect();

    // Measure to padding box (inside border, outside padding)
    // This shows the visual distance from the parent's inner edge to the child,
    // which includes any padding — matching what users see as "the gap"
    const bt = parseFloat(computed.borderTopWidth) || 0;
    const br = parseFloat(computed.borderRightWidth) || 0;
    const bb = parseFloat(computed.borderBottomWidth) || 0;
    const bl = parseFloat(computed.borderLeftWidth) || 0;

    const innerTop = parentRect.top + bt;
    const innerRight = parentRect.right - br;
    const innerBottom = parentRect.bottom - bb;
    const innerLeft = parentRect.left + bl;

    const topDist = Math.round(childRect.top - innerTop);
    const rightDist = Math.round(innerRight - childRect.right);
    const bottomDist = Math.round(innerBottom - childRect.bottom);
    const leftDist = Math.round(childRect.left - innerLeft);

    const childCenterX = childRect.left + childRect.width / 2;
    const childCenterY = childRect.top + childRect.height / 2;

    // Top
    if (topDist > 0) {
      drawSegment(parentMeasures.top.line, childCenterX, innerTop, topDist, false, false);
      positionLabel(parentMeasures.top.label, topDist, childCenterX, innerTop, topDist, false);
      parentMeasures.top.connector.style.display = "none";
    }

    // Bottom
    if (bottomDist > 0) {
      drawSegment(parentMeasures.bottom.line, childCenterX, childRect.bottom, bottomDist, false, false);
      positionLabel(parentMeasures.bottom.label, bottomDist, childCenterX, childRect.bottom, bottomDist, false);
      parentMeasures.bottom.connector.style.display = "none";
    }

    // Left
    if (leftDist > 0) {
      drawSegment(parentMeasures.left.line, innerLeft, childCenterY, leftDist, true, false);
      positionLabel(parentMeasures.left.label, leftDist, innerLeft, childCenterY, leftDist, true);
      parentMeasures.left.connector.style.display = "none";
    }

    // Right
    if (rightDist > 0) {
      drawSegment(parentMeasures.right.line, childRect.right, childCenterY, rightDist, true, false);
      positionLabel(parentMeasures.right.label, rightDist, childRect.right, childCenterY, rightDist, true);
      parentMeasures.right.connector.style.display = "none";
    }
  }

  function positionBox(box: HTMLElement, labelEl: HTMLElement, rect: DOMRect, borderStyle: string, bgAlpha: string) {
    box.style.top = `${rect.top}px`;
    box.style.left = `${rect.left}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.style.border = `1px ${borderStyle} #0D99FF`;
    box.style.background = `rgba(13, 153, 255, ${bgAlpha})`;
    box.style.display = "";

    const labelY = rect.top > 24 ? rect.top - 24 : rect.bottom + 4;
    labelEl.style.top = `${labelY}px`;
    labelEl.style.left = `${rect.left}px`;
    labelEl.style.background = "#0D99FF";
  }

  function updateHighlight(el: Element) {
    const rect = el.getBoundingClientRect();
    positionBox(highlight, label, rect, "solid", "0.08");
    label.style.display = "";
    label.textContent = formatLabel(el);
  }

  function showSelection() {
    if (!selectedElement) return;
    const rect = selectedElement.getBoundingClientRect();
    positionBox(selection, selectionLabel, rect, "solid", "0.04");
    if (!selectionLabelHidden) {
      selectionLabel.style.display = "";
    }
    selectionLabel.textContent = formatLabel(selectedElement);
    lastSelRect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    positionHandles(rect);

    // Show dotted parent indicator
    const parent = selectedElement.parentElement;
    if (parent && parent !== document.body && parent !== document.documentElement) {
      const pr = parent.getBoundingClientRect();
      parentIndicator.style.cssText = `
        position:fixed;display:block;pointer-events:none;z-index:2147483644;
        border:1px dotted #0D99FF;background:none;
        top:${pr.top}px;left:${pr.left}px;width:${pr.width}px;height:${pr.height}px;
      `;
    } else {
      parentIndicator.style.display = "none";
    }
  }

  // Lightweight position-only update for scroll/resize tracking
  function trackSelection() {
    if (!selectedElement) return;
    const rect = selectedElement.getBoundingClientRect();
    // Skip if nothing moved
    if (
      rect.top === lastSelRect.top &&
      rect.left === lastSelRect.left &&
      rect.width === lastSelRect.width &&
      rect.height === lastSelRect.height
    ) return;

    selection.style.top = `${rect.top}px`;
    selection.style.left = `${rect.left}px`;
    selection.style.width = `${rect.width}px`;
    selection.style.height = `${rect.height}px`;

    const labelY = rect.top > 24 ? rect.top - 24 : rect.bottom + 4;
    selectionLabel.style.top = `${labelY}px`;
    selectionLabel.style.left = `${rect.left}px`;
    selectionLabel.textContent = formatLabel(selectedElement);
    lastSelRect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    positionHandles(rect);

    // Update parent indicator position
    const parent = selectedElement.parentElement;
    if (parent && parent !== document.body && parent !== document.documentElement && parentIndicator.style.display !== "none") {
      const pr = parent.getBoundingClientRect();
      parentIndicator.style.top = `${pr.top}px`;
      parentIndicator.style.left = `${pr.left}px`;
      parentIndicator.style.width = `${pr.width}px`;
      parentIndicator.style.height = `${pr.height}px`;
    }
  }

  function formatLabel(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
    const rect = el.getBoundingClientRect();
    const dims = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
    return `${tag}${id}${cls} ${dims}`;
  }

  function hideHighlight() {
    highlight.style.display = "none";
    label.style.display = "none";
    hideSpacing();
  }

  function hideSelection() {
    selection.style.display = "none";
    selectionLabel.style.display = "none";
    parentIndicator.style.display = "none";
    hideHandles();
  }

  // Debounce multiple events into a single rAF update
  function scheduleTrack() {
    if (trackingRaf !== null) return;
    trackingRaf = requestAnimationFrame(() => {
      trackingRaf = null;
      trackSelection();
    });
  }

  function handleScroll() {
    scheduleTrack();
    if (hoveredElement) {
      hoveredElement = null;
      hideHighlight();
    }
  }

  // Keep selection box in sync on scroll/resize
  function startTracking() {
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    window.addEventListener("resize", scheduleTrack, { passive: true });
    resizeObserver = new ResizeObserver(scheduleTrack);
    if (selectedElement) resizeObserver.observe(selectedElement);
    // Initial position update
    trackSelection();
  }

  function stopTracking() {
    if (trackingRaf !== null) {
      cancelAnimationFrame(trackingRaf);
      trackingRaf = null;
    }
    window.removeEventListener("scroll", handleScroll, true);
    window.removeEventListener("resize", scheduleTrack);
    resizeObserver?.disconnect();
    resizeObserver = null;
  }

  // Filter out our own overlay elements
  function isOverlayElement(el: Element): boolean {
    return !!el.closest("[data-retune-host]");
  }

  // Void/empty elements that aren't useful to select — bubble to parent
  const SKIP_TAGS = new Set(["BR", "WBR", "COL", "COLGROUP", "SOURCE", "TRACK", "AREA", "PARAM"]);

  function resolveElement(el: Element): Element | null {
    let current: Element | null = el;
    while (current && SKIP_TAGS.has(current.tagName)) {
      current = current.parentElement;
    }
    return current;
  }

  function applyHover(el: Element) {
    hoveredElement = el;

    if (el === selectedElement) {
      hideHighlight();
      hideSpacing();
      selectionLabelHidden = false;
      selectionLabel.style.display = "";
    } else {
      updateHighlight(el);
      if (selectedElement) {
        if (el.contains(selectedElement)) {
          // Hovered element is a parent/ancestor — show four-edge distances
          showParentSpacing(selectedElement.getBoundingClientRect(), el);
        } else {
          // Sibling or unrelated — show nearest-edge spacing
          showSpacing(selectedElement.getBoundingClientRect(), el.getBoundingClientRect());
        }
      }
    }

    callbacks.onHover(el, el.getBoundingClientRect());
  }

  function handleMouseMove(e: MouseEvent) {
    if (!active || suspended) return;
    // Skip if cursor is over overlay UI (toolbar, panel) inside the shadow root.
    // elementFromPoint on a ShadowRoot falls through to page elements when no
    // shadow element is at the point, so we verify the hit actually belongs to
    // our shadow tree via getRootNode().
    const hoverShadowHit = shadowRoot.elementFromPoint(e.clientX, e.clientY);
    if (hoverShadowHit && hoverShadowHit.getRootNode() === shadowRoot) {
      // Cursor is over Retune UI — clear hover highlight
      if (hoveredElement) {
        hoveredElement = null;
        hideHighlight();
      }
      return;
    }
    const raw = document.elementFromPoint(e.clientX, e.clientY);
    if (!raw || isOverlayElement(raw)) return;
    const el = resolveElement(raw);
    if (!el || isOverlayElement(el)) return;
    if (el === hoveredElement) return;

    // If moving to an ancestor of the current hover target, debounce
    // to avoid flashing parents when crossing gaps between siblings
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }

    if (hoveredElement && el.contains(hoveredElement)) {
      hoverTimer = setTimeout(() => {
        hoverTimer = null;
        // Re-check — cursor may have moved to a sibling by now
        const current = document.elementFromPoint(e.clientX, e.clientY);
        if (current === el) applyHover(el);
      }, 50);
    } else {
      applyHover(el);
    }
  }

  /** Build the element stack at a point, from deepest child to document body */
  function buildElementStack(x: number, y: number): Element[] {
    const all = document.elementsFromPoint(x, y);
    const stack: Element[] = [];
    for (const raw of all) {
      if (isOverlayElement(raw)) continue;
      const el = resolveElement(raw);
      if (!el || isOverlayElement(el)) continue;
      // Deduplicate (resolveElement may map multiple raw elements to the same parent)
      if (stack.length > 0 && stack[stack.length - 1] === el) continue;
      // Stop at document body — selecting <html> or <body> isn't useful
      if (el === document.documentElement) break;
      stack.push(el);
    }
    return stack;
  }

  function handleClick(e: MouseEvent) {
    if (!active) return;

    // Ignore clicks that originate from inside the overlay (panel buttons, inputs, dropdowns).
    // Check 1: composedPath includes the shadow host (standard shadow DOM retargeting)
    const path = e.composedPath();
    const host = shadowRoot.host;
    if (path.includes(host)) return;
    // Check 2: the click point lands on an overlay UI element inside the shadow root.
    // This catches edge cases where composedPath may not include the host (e.g. the
    // clicked element was re-rendered between pointerdown and click due to React state
    // updates, causing the original target to detach from the DOM).  Elements owned by
    // the picker (highlight / selection boxes) have pointer-events:none so they won't
    // be returned here — only interactive UI (toolbar, panel) will match.
    // Note: elementFromPoint on a ShadowRoot falls through to page elements when no
    // shadow element is at the point, so we must verify via getRootNode().
    const shadowHit = shadowRoot.elementFromPoint(e.clientX, e.clientY);
    if (shadowHit && shadowHit.getRootNode() === shadowRoot) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const { clientX: x, clientY: y } = e;

    // Check if clicking the same spot — cycle through element stack
    const sameSpot =
      Math.abs(x - lastClickPos.x) <= CLICK_RADIUS &&
      Math.abs(y - lastClickPos.y) <= CLICK_RADIUS &&
      elementStack.length > 1;

    if (sameSpot) {
      // Rebuild stack in case DOM changed (HMR, navigation)
      elementStack = buildElementStack(x, y);
      if (elementStack.length <= 1) {
        stackIndex = 0;
      } else {
        // Advance to the next element in the stack (deeper → shallower → wrap)
        stackIndex = (stackIndex + 1) % elementStack.length;
      }
    } else {
      // New click position — rebuild the stack
      elementStack = buildElementStack(x, y);
      stackIndex = 0;
      lastClickPos = { x, y };
    }

    if (elementStack.length === 0) return;
    const el = elementStack[stackIndex];

    selectedElement = el;
    selectionLabelHidden = false;
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver.observe(el);
    }
    showSelection();
    hideHighlight();
    hoveredElement = null;
    callbacks.onSelect(el);
  }

  function handleDblClick(e: MouseEvent) {
    if (!active || !selectedElement) return;
    e.preventDefault();
    e.stopPropagation();
    // Find the deepest element at the click point for text editing
    // (the selected element might be a container)
    const deepest = document.elementFromPoint(e.clientX, e.clientY);
    callbacks.onDoubleClick?.(deepest || selectedElement);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!active) return;
    if (e.key === "Escape") {
      // If a nested overlay (e.g. color picker) is open, let it handle Escape
      if (shadowRoot.querySelector(".retune-floating-dialog")) return;
      e.preventDefault();
      e.stopPropagation();
      callbacks.onCancel();
    }
  }

  function activate() {
    active = true;
    document.body.style.cursor = "crosshair";
    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("dblclick", handleDblClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    startTracking();
  }

  function deactivate() {
    active = false;
    document.body.style.cursor = "";
    hoveredElement = null;
    selectedElement = null;
    selectionLabelHidden = false;
    elementStack = [];
    stackIndex = -1;
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    hideHighlight();
    hideSelection();
    stopTracking();
    document.removeEventListener("mousemove", handleMouseMove, true);
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("dblclick", handleDblClick, true);
    document.removeEventListener("keydown", handleKeyDown, true);
  }

  function clearSelection() {
    selectedElement = null;
    selectionLabelHidden = false;
    elementStack = [];
    stackIndex = -1;
    hideSelection(); // also hides handles
  }

  function destroy() {
    deactivate();
    highlight.remove();
    label.remove();
    selection.remove();
    selectionLabel.remove();
    spacingContainer.remove();
    parentIndicator.remove();
    for (const g of snapGuidePool) { g.line.remove(); g.label.remove(); }
    for (const pos of ALL_POSITIONS) handleEls[pos].remove();
  }

  /** Programmatically select an element (e.g. from the element tree) */
  function selectElement(el: Element) {
    selectedElement = el;
    selectionLabelHidden = false;
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver.observe(el);
    }
    showSelection();
    hideHighlight();
    hoveredElement = null;
    callbacks.onSelect(el);
  }

  /** Programmatically show hover highlight on an element */
  function highlightElement(el: Element | null) {
    if (el) {
      updateHighlight(el);
    } else {
      hideHighlight();
    }
  }

  function suspend() { suspended = true; hideHighlight(); hideSelection(); }
  function resume() { suspended = false; if (selectedElement) showSelection(); }

  return { activate, deactivate, destroy, hideHighlight, clearSelection, selectElement, highlightElement, refreshSelection: scheduleTrack, suspend, resume };
}
