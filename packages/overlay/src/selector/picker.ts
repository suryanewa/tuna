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
      z-index: 2147483646;
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
      z-index:2147483646;cursor:${HANDLE_CURSORS[pos]};
    `;
    shadowRoot.appendChild(h);
    handleEls[pos] = h;
  }

  // Edge handles: invisible hit zones along sides
  for (const pos of EDGE_POSITIONS) {
    const h = document.createElement("div");
    h.style.cssText = `
      position:fixed;pointer-events:auto;display:none;
      z-index:2147483646;cursor:${HANDLE_CURSORS[pos]};
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

  // ── Resize drag state ──
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

    const { width, height } = computeResize(e);
    const el = selectedElement as HTMLElement;
    const axes = HANDLE_AXES[resizeDrag.handle];

    // Update LivePreviewEngine stylesheet for all matching instances
    if (axes.dx !== 0) callbacks.onResizePreview?.(selectedElement, "width", `${width}px`);
    if (axes.dy !== 0) callbacks.onResizePreview?.(selectedElement, "height", `${height}px`);
    // Also set inline !important on selected element to guarantee it wins
    if (axes.dx !== 0) el.style.setProperty("width", `${width}px`, "important");
    if (axes.dy !== 0) el.style.setProperty("height", `${height}px`, "important");

    // Update selection box and handles
    const newRect = selectedElement.getBoundingClientRect();
    positionBox(selection, selectionLabel, newRect, "solid", "0.04");
    positionHandles(newRect);
    selectionLabel.textContent = formatLabel(selectedElement);
  }

  function handleResizePointerUp(e: PointerEvent) {
    if (!resizeDrag || !selectedElement) {
      resizeDrag = null;
      return;
    }

    const { width, height } = computeResize(e);
    const axes = HANDLE_AXES[resizeDrag.handle];
    const el = selectedElement as HTMLElement;

    // Report final values through callback (keeps inline styles — LivePreviewEngine overrides)
    const widthChanged = axes.dx !== 0 && Math.abs(width - resizeDrag.startWidth) > 0.5;
    const heightChanged = axes.dy !== 0 && Math.abs(height - resizeDrag.startHeight) > 0.5;
    if (widthChanged) {
      el.style.removeProperty("width");
      callbacks.onResize?.(selectedElement, "width", `${width}px`);
    }
    if (heightChanged) {
      el.style.removeProperty("height");
      callbacks.onResize?.(selectedElement, "height", `${height}px`);
    }

    resizeDrag = null;
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

  function hideSpacing() {
    for (const m of [hMeasure, vMeasure]) {
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
    const dashed = selectedElement !== null && el !== selectedElement;
    positionBox(highlight, label, rect, dashed ? "dotted" : "solid", "0.08");
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
      // Show spacing between selected and hovered elements
      if (selectedElement) {
        showSpacing(selectedElement.getBoundingClientRect(), el.getBoundingClientRect());
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
