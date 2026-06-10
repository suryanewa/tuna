/**
 * Element picker: hover to highlight, click to select.
 *
 * A full-viewport capture layer in the shadow root receives pointer events
 * so page elements never get mousedown (:active, focus). Hover/selection use
 * document.elementsFromPoint() at the cursor. Retune UI stays clickable above
 * the capture layer via pointer-events:auto.
 *
 * Selection persists until a new element is selected or picker is deactivated.
 * Hover box becomes solid. Parent indicator uses dotted.
 */

import { canFill, type SizingContext } from "../ui/sizing-utils";
import { getElementTitle } from "./identifier";
import {
  computeSelectionChromeLayout,
  measureDimensionLabelWidth,
  type SelectionChromeLayout,
} from "./selection-chrome-layout";
import {
  buildClosedPath,
  buildOpenPath,
  finalizeDrawPoints,
  type DrawPoint,
} from "./path-utils";
import { SELECTION_COLORS } from "../ui/selection-colors";
import { resolveSelectionClick, type SelectionClickResult } from "./selection-click";

const PICKER_OUTLINE_COLOR = "#0D99FF";
/** Light fill on the selected element — same hue as the outline, much lower opacity. */
const SELECTION_FILL_ALPHA = "0.08";

export { SELECTION_COLORS };

const MULTI_SELECT_POOL_SIZE = 20;

/** Padding around selected element bounds for click-outside deselect. */
export const SELECTION_CLICK_PAD = 8;

const MARQUEE_DRAG_THRESHOLD = 5;
const MARQUEE_MIN_SIZE = 10;
const MARQUEE_SAMPLE_STEP = 16;
const DRAW_DRAG_THRESHOLD = 3;
const DRAW_MIN_POINTS = 3;
const DRAW_FILL_ALPHA = "0.08";
const DRAW_COLOR_ATTR = "data-retune-draw-color";
const HOVER_TITLE_OFFSET_X = 12;
const HOVER_TITLE_OFFSET_Y = 16;

/** True when (x, y) lies inside any selected element's bounds (plus pad). */
export function isPointInsideSelectionBounds(
  x: number,
  y: number,
  elements: Element[],
  pad = SELECTION_CLICK_PAD,
): boolean {
  for (const el of elements) {
    const r = el.getBoundingClientRect();
    if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) {
      return true;
    }
  }
  return false;
}

export interface SelectEventMeta {
  shiftKey: boolean;
  altKey?: boolean;
  selectedElements: Element[];
}

export interface PickerCallbacks {
  onHover: (element: Element, rect: DOMRect) => void;
  onSelect: (element: Element, meta?: SelectEventMeta) => void;
  /** Called when selection is cleared without deactivating the overlay. */
  onDeselect?: () => void;
  onCancel: () => void;
  /** If provided, called before processing a click. Return true to block the click entirely. */
  shouldBlockClick?: () => boolean;
  onDoubleClick?: (element: Element) => void;
  onResize?: (element: Element, property: "width" | "height", value: string) => void;
  /** Called during resize drag for live preview (updates stylesheet without recording changes) */
  onResizePreview?: (element: Element, property: "width" | "height", value: string) => void;
  /** Called when an absolute/fixed element is repositioned via drag */
  onReposition?: (element: Element, property: "top" | "left" | "right" | "bottom", value: string) => void;
  /** Called during reposition drag for live preview */
  onRepositionPreview?: (element: Element, property: "top" | "left" | "right" | "bottom", value: string) => void;
  /** Called when a flow element is reordered by drag among its siblings */
  onCanvasReorder?: (element: Element, fromIndex: number, toIndex: number) => void;
  /** Called when a flow element is reparented by dragging to a different container */
  onCanvasReparent?: (element: Element, newParent: Element, insertIndex: number) => void;
  /** Called when draw-mode paths are created, cleared, or replaced. */
  onDrawPathsChange?: (paths: SVGPathElement[]) => void;
  /** Called when select-mode drawing selection changes. */
  onDrawSelectionChange?: (paths: SVGPathElement[]) => void;
}

/** Compute drop index using filtered rects (dragged element excluded).
 *  Returns index in the FULL siblings array. */
export function computeCanvasDropIndex(
  cursorX: number, cursorY: number,
  otherRects: DOMRect[], otherIndices: number[],
  horizontal: boolean, dragIndex: number
): number {
  const cursor = horizontal ? cursorX : cursorY;
  let insertBefore = otherRects.length;

  for (let i = 0; i < otherRects.length; i++) {
    const mid = horizontal
      ? otherRects[i].left + otherRects[i].width / 2
      : otherRects[i].top + otherRects[i].height / 2;
    if (cursor < mid) { insertBefore = i; break; }
  }

  if (insertBefore >= otherIndices.length) {
    return otherIndices.length > 0 ? otherIndices[otherIndices.length - 1] + 1 : dragIndex;
  }
  return otherIndices[insertBefore];
}

/** Check if drop index is effectively the same position. */
export function isEffectiveNoOp(dragIndex: number, dropIndex: number): boolean {
  return dragIndex === dropIndex;
}

/** Format selection label as dimensions only. */
export function formatSelectionLabel(width: number, height: number): string {
  return `${Math.round(width)} × ${Math.round(height)}`;
}

export function createPicker(
  shadowRoot: ShadowRoot,
  callbacks: PickerCallbacks
) {
  // Full-viewport layer — intercepts pointer events before they reach the page.
  const captureLayer = document.createElement("div");
  captureLayer.setAttribute("data-retune-capture", "");
  captureLayer.style.cssText = `
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 2147483638;
    background: transparent;
    display: none;
  `;
  shadowRoot.appendChild(captureLayer);

  // Marquee selection box (drag replace, shift+drag add, alt+drag remove)
  const marqueeBox = document.createElement("div");
  marqueeBox.setAttribute("data-retune-marquee", "");
  marqueeBox.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483645;
    border: 1px dashed ${PICKER_OUTLINE_COLOR};
    background: rgba(13, 153, 255, 0.06);
    display: none;
  `;
  shadowRoot.appendChild(marqueeBox);

  const drawingSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  drawingSvg.setAttribute("data-retune-drawing-layer", "");
  drawingSvg.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 2147483643;
    overflow: visible;
    display: none;
  `;
  shadowRoot.appendChild(drawingSvg);

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

  // Additional selection boxes for shift multi-select
  const multiSelectPool: HTMLDivElement[] = [];
  for (let i = 0; i < MULTI_SELECT_POOL_SIZE; i++) {
    const box = document.createElement("div");
    box.setAttribute("data-retune-multi-selection", "");
    box.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483644;
      box-sizing: border-box;
      display: none;
      outline: none;
      transition: background 0.25s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.25s cubic-bezier(0.23, 1, 0.32, 1);
    `;
    shadowRoot.appendChild(box);
    multiSelectPool.push(box);
  }

  // Aspect ratio lock indicator (diagonal dashed line inside selection box)
  const aspectLine = document.createElement("div");
  aspectLine.style.cssText = `
    position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;display:none;overflow:hidden;
  `;
  aspectLine.innerHTML = `<svg width="100%" height="100%" style="position:absolute;top:0;left:0"><line x1="0" y1="0" x2="100%" y2="100%" stroke="#0D99FF" stroke-width="1" stroke-dasharray="1 3" stroke-linecap="round" opacity="0.6"/></svg>`;
  selection.appendChild(aspectLine);

  // Parent indicator (dotted outline, no fill — shown during fill snap)
  const parentIndicator = document.createElement("div");
  parentIndicator.setAttribute("data-retune-parent-indicator", "");
  parentIndicator.style.cssText = `
    position:fixed;display:none;pointer-events:none;z-index:2147483644;
    border:1px dotted #0D99FF;background:none;border-radius:0;
  `;
  shadowRoot.appendChild(parentIndicator);

  // Sibling outlines — dotted outlines on non-selected siblings when hovering their parent
  const siblingOutlinePool: HTMLDivElement[] = [];
  for (let i = 0; i < 20; i++) {
    const outline = document.createElement("div");
    outline.style.cssText = `
      position:fixed;display:none;pointer-events:none;z-index:2147483644;
      border:1px dotted #0D99FF;background:none;
    `;
    shadowRoot.appendChild(outline);
    siblingOutlinePool.push(outline);
  }

  function showSiblingOutlines(parent: Element, selected: Element) {
    const children = Array.from(parent.children).filter(c => {
      if (c === selected) return false;
      if (c.hasAttribute("data-retune-host")) return false;
      const cs = getComputedStyle(c);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      return true;
    });

    let poolIdx = 0;
    for (const child of children) {
      if (poolIdx >= siblingOutlinePool.length) break;
      const r = child.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const outline = siblingOutlinePool[poolIdx++];
      outline.style.top = `${r.top}px`;
      outline.style.left = `${r.left}px`;
      outline.style.width = `${r.width}px`;
      outline.style.height = `${r.height}px`;
      outline.style.display = "block";
    }
    // Hide unused
    for (let i = poolIdx; i < siblingOutlinePool.length; i++) {
      siblingOutlinePool[i].style.display = "none";
    }
  }

  function showChildOutlines(parent: Element) {
    const children = Array.from(parent.children).filter(c => {
      if (c.hasAttribute("data-retune-host")) return false;
      const cs = getComputedStyle(c);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      return true;
    });

    let poolIdx = 0;
    for (const child of children) {
      if (poolIdx >= siblingOutlinePool.length) break;
      const r = child.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const outline = siblingOutlinePool[poolIdx++];
      outline.style.top = `${r.top}px`;
      outline.style.left = `${r.left}px`;
      outline.style.width = `${r.width}px`;
      outline.style.height = `${r.height}px`;
      outline.style.display = "block";
    }
    for (let i = poolIdx; i < siblingOutlinePool.length; i++) {
      siblingOutlinePool[i].style.display = "none";
    }
  }

  function hideSiblingOutlines() {
    for (const outline of siblingOutlinePool) {
      outline.style.display = "none";
    }
  }

  // Scope highlight outlines — solid outlines on all elements matching the active/hovered scope
  const scopeHighlightPool: HTMLDivElement[] = [];
  for (let i = 0; i < 50; i++) {
    const outline = document.createElement("div");
    outline.style.cssText = `
      position:fixed;display:none;pointer-events:none;z-index:2147483643;
      border:1px solid #0D99FF;background:none;
      transition: background 0.25s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.25s cubic-bezier(0.23, 1, 0.32, 1);
    `;
    shadowRoot.appendChild(outline);
    scopeHighlightPool.push(outline);
  }

  // Track active scope for repositioning on scroll
  let activeScopeElements: Element[] = [];

  function showScopeHighlights(selector: string, excludeElement: Element | null) {
    let elements: Element[];
    try {
      elements = Array.from(document.querySelectorAll(selector));
    } catch {
      hideScopeHighlights();
      return;
    }

    const excluded = new Set(selectedElements);
    if (excludeElement) excluded.add(excludeElement);

    activeScopeElements = elements.filter(el => {
      if (excluded.has(el)) return false;
      if (el.closest("[data-retune-host]")) return false;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      return true;
    });

    refreshScopeHighlights();
    if (propertyEditMode) updateAllSelectionBoxes();
  }

  function refreshScopeHighlights() {
    let poolIdx = 0;
    for (const el of activeScopeElements) {
      if (poolIdx >= scopeHighlightPool.length) break;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const outline = scopeHighlightPool[poolIdx++];
      if (propertyEditMode) {
        positionColoredBox(outline, r, "solid", SELECTION_FILL_ALPHA, PICKER_OUTLINE_COLOR);
      } else {
        outline.style.top = `${r.top}px`;
        outline.style.left = `${r.left}px`;
        outline.style.width = `${r.width}px`;
        outline.style.height = `${r.height}px`;
        outline.style.border = `1px solid ${PICKER_OUTLINE_COLOR}`;
        outline.style.background = "none";
        outline.style.display = "block";
      }
    }
    for (let i = poolIdx; i < scopeHighlightPool.length; i++) {
      scopeHighlightPool[i].style.display = "none";
    }
  }

  function hideScopeHighlights() {
    activeScopeElements = [];
    for (const outline of scopeHighlightPool) {
      outline.style.display = "none";
    }
  }

  // Pin lines — dashed lines from element to parent edges for pinned sides
  const pinLines: Record<string, HTMLDivElement> = {};
  for (const side of ["top", "right", "bottom", "left"] as const) {
    const line = document.createElement("div");
    line.style.cssText = "position:fixed;display:none;pointer-events:none;z-index:2147483644;";
    shadowRoot.appendChild(line);
    pinLines[side] = line;
  }

  /** Detect which position properties are authored (inline style or CSS rules) */
  function detectAuthoredPositionProps(el: Element): { top: boolean; right: boolean; bottom: boolean; left: boolean } {
    const htmlEl = el as HTMLElement;
    const result = { top: false, right: false, bottom: false, left: false };
    const pos = getComputedStyle(el).position;
    if (pos !== "absolute" && pos !== "fixed") return result;

    for (const prop of ["top", "right", "bottom", "left"] as const) {
      if (htmlEl.style[prop] !== "") { result[prop] = true; continue; }
      try {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule instanceof CSSStyleRule && el.matches(rule.selectorText)) {
                const val = rule.style.getPropertyValue(prop);
                if (val && val !== "auto") { result[prop] = true; break; }
              }
            }
          } catch {}
          if (result[prop]) break;
        }
      } catch {}
    }
    return result;
  }

  function showPinLines(elRect: DOMRect, parentRect: DOMRect, authored: { top: boolean; right: boolean; bottom: boolean; left: boolean }) {
    const elCenterX = elRect.left + elRect.width / 2;
    const elCenterY = elRect.top + elRect.height / 2;

    // Top pin line: from element top edge to parent top edge
    if (authored.top && elRect.top > parentRect.top) {
      pinLines.top.style.cssText = `
        position:fixed;display:block;pointer-events:none;z-index:2147483644;
        top:${parentRect.top}px;left:${elCenterX}px;
        width:0;height:${elRect.top - parentRect.top}px;
        border-left:1px dashed #0D99FF;
      `;
    } else {
      pinLines.top.style.display = "none";
    }

    // Bottom pin line: from element bottom edge to parent bottom edge
    if (authored.bottom && parentRect.bottom > elRect.bottom) {
      pinLines.bottom.style.cssText = `
        position:fixed;display:block;pointer-events:none;z-index:2147483644;
        top:${elRect.bottom}px;left:${elCenterX}px;
        width:0;height:${parentRect.bottom - elRect.bottom}px;
        border-left:1px dashed #0D99FF;
      `;
    } else {
      pinLines.bottom.style.display = "none";
    }

    // Left pin line: from element left edge to parent left edge
    if (authored.left && elRect.left > parentRect.left) {
      pinLines.left.style.cssText = `
        position:fixed;display:block;pointer-events:none;z-index:2147483644;
        top:${elCenterY}px;left:${parentRect.left}px;
        width:${elRect.left - parentRect.left}px;height:0;
        border-top:1px dashed #0D99FF;
      `;
    } else {
      pinLines.left.style.display = "none";
    }

    // Right pin line: from element right edge to parent right edge
    if (authored.right && parentRect.right > elRect.right) {
      pinLines.right.style.cssText = `
        position:fixed;display:block;pointer-events:none;z-index:2147483644;
        top:${elCenterY}px;left:${elRect.right}px;
        width:${parentRect.right - elRect.right}px;height:0;
        border-top:1px dashed #0D99FF;
      `;
    } else {
      pinLines.right.style.display = "none";
    }
  }

  function hidePinLines() {
    for (const line of Object.values(pinLines)) line.style.display = "none";
  }

  // Cache the latest pin state (from panel or initial detection)
  let cachedPinState: { top: boolean; right: boolean; bottom: boolean; left: boolean } | null = null;

  /** Refresh pin lines using current element + parent rects */
  function refreshPinLines() {
    if (!selectedElement) return;
    const parent = selectedElement.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) return;
    const rect = selectedElement.getBoundingClientRect();
    const pr = parent.getBoundingClientRect();
    const authored = cachedPinState || detectAuthoredPositionProps(selectedElement);
    if (authored.top || authored.right || authored.bottom || authored.left) {
      showPinLines(rect, pr, authored);
    } else {
      hidePinLines();
    }
  }

  let active = false;
  let suspended = false; // temporarily suppress hover (e.g. during text editing)
  let hoveredElement: Element | null = null;
  let selectedElement: Element | null = null;
  let selectedElements: Element[] = [];
  let drawMode = false;
  const elementSelectionColors = new WeakMap<Element, string>();
  const drawingSelectionColors = new WeakMap<SVGPathElement, string>();
  let selectionLabelHidden = false;
  let syncedChromeLayout: SelectionChromeLayout | null = null;
  /** Shift was held for a shift-click selection and should not turn the next Escape into Shift+Escape. */
  let shiftHeldForSelection = false;
  let trackingRaf: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSelRect = { top: 0, left: 0, width: 0, height: 0 };
  let lastSelectedElement: Element | null = null;

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
      outline: none;
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
  highlight.style.transition = "top 0.15s cubic-bezier(0.23, 1, 0.32, 1), left 0.15s cubic-bezier(0.23, 1, 0.32, 1), width 0.15s cubic-bezier(0.23, 1, 0.32, 1), height 0.15s cubic-bezier(0.23, 1, 0.32, 1)";
  initBoxStyles(selection, selectionLabel);
  selection.style.transition = "background 0.25s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.25s cubic-bezier(0.23, 1, 0.32, 1)";

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
  for (let i = 0; i < 16; i++) {
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
    canFillWidth: boolean;
    canFillHeight: boolean;
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

    // Detect fill context
    const parentDisplay = parentCs?.display || "";
    const isFlexChild = parentDisplay.includes("flex");
    const isGridChild = parentDisplay.includes("grid");
    const parentFlexDir = parentCs?.flexDirection || "row";
    const sizingCtx: SizingContext = { isFlexChild, isGridChild, parentFlexDir, currentStyles: {} };
    const canFillWidth = canFill("width", sizingCtx);
    const canFillHeight = canFill("height", sizingCtx);

    snapCache = { siblingWidths, siblingHeights, siblingRects, parentRect, parentWidth: Math.round(parentWidth), parentHeight: Math.round(parentHeight), parentPadding, canFillWidth, canFillHeight };
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
      // Check parent content width first (fill takes priority, only if context supports it)
      const parentSnapW = snapCache.canFillWidth && Math.abs(w - snapCache.parentWidth) <= SNAP_THRESHOLD ? snapCache.parentWidth : null;
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
      const parentSnapH = snapCache.canFillHeight && Math.abs(h - snapCache.parentHeight) <= SNAP_THRESHOLD ? snapCache.parentHeight : null;
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
    el.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${XMARK_SIZE * 2}' height='${XMARK_SIZE * 2}'%3E%3Cline x1='2' y1='2' x2='${XMARK_SIZE * 2 - 2}' y2='${XMARK_SIZE * 2 - 2}' stroke='%23F24822' stroke-width='1'/%3E%3Cline x1='${XMARK_SIZE * 2 - 2}' y1='2' x2='2' y2='${XMARK_SIZE * 2 - 2}' stroke='%23F24822' stroke-width='1'/%3E%3C/svg%3E")`;
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

  // ── Position snap (for reposition drag) ──

  let posSnapCache: {
    parentEdges: { top: number; right: number; bottom: number; left: number; centerX: number; centerY: number };
    siblingEdges: Array<{ top: number; right: number; bottom: number; left: number; centerX: number; centerY: number }>;
  } | null = null;

  function buildPosSnapCache(el: Element) {
    const parent = el.parentElement;
    if (!parent) { posSnapCache = null; return; }

    const pr = parent.getBoundingClientRect();
    const pcs = getComputedStyle(parent);
    const bt = parseFloat(pcs.borderTopWidth) || 0;
    const br = parseFloat(pcs.borderRightWidth) || 0;
    const bb = parseFloat(pcs.borderBottomWidth) || 0;
    const bl = parseFloat(pcs.borderLeftWidth) || 0;
    const pt = parseFloat(pcs.paddingTop) || 0;
    const pRight = parseFloat(pcs.paddingRight) || 0;
    const pb = parseFloat(pcs.paddingBottom) || 0;
    const pl = parseFloat(pcs.paddingLeft) || 0;

    // Parent content box edges
    const contentTop = pr.top + bt + pt;
    const contentRight = pr.right - br - pRight;
    const contentBottom = pr.bottom - bb - pb;
    const contentLeft = pr.left + bl + pl;

    const parentEdges = {
      top: contentTop,
      right: contentRight,
      bottom: contentBottom,
      left: contentLeft,
      centerX: (contentLeft + contentRight) / 2,
      centerY: (contentTop + contentBottom) / 2,
    };

    // Sibling edges
    const siblings = Array.from(parent.children).filter(c =>
      c !== el && c.tagName !== "SCRIPT" && c.tagName !== "STYLE"
    );
    const siblingEdges = siblings.map(s => {
      const r = s.getBoundingClientRect();
      return {
        top: r.top, right: r.right, bottom: r.bottom, left: r.left,
        centerX: r.left + r.width / 2, centerY: r.top + r.height / 2,
      };
    });

    posSnapCache = { parentEdges, siblingEdges };
  }

  type PosSnapGuide = {
    axis: "x" | "y";
    pos: number;
    elIsCenter: boolean;   // true if the element's center edge matched
    refIsCenter: boolean;  // true if the reference's center edge matched
    refTop: number; refRight: number; refBottom: number; refLeft: number;
  };

  type PosSnapResult = {
    dx: number;
    dy: number;
    guides: PosSnapGuide[];
  };

  function checkPosSnap(elRect: DOMRect): PosSnapResult {
    if (!posSnapCache) return { dx: 0, dy: 0, guides: [] };

    const elEdges = {
      top: elRect.top, right: elRect.right, bottom: elRect.bottom, left: elRect.left,
      centerX: elRect.left + elRect.width / 2, centerY: elRect.top + elRect.height / 2,
    };

    type SnapTarget = { val: number; isCenter: boolean; top: number; right: number; bottom: number; left: number };
    const xTargets: SnapTarget[] = [];
    const yTargets: SnapTarget[] = [];

    const pe = posSnapCache.parentEdges;
    const pRef = { top: pe.top, right: pe.right, bottom: pe.bottom, left: pe.left };
    xTargets.push(
      { val: pe.left, isCenter: false, ...pRef },
      { val: pe.right, isCenter: false, ...pRef },
      { val: pe.centerX, isCenter: true, ...pRef },
    );
    yTargets.push(
      { val: pe.top, isCenter: false, ...pRef },
      { val: pe.bottom, isCenter: false, ...pRef },
      { val: pe.centerY, isCenter: true, ...pRef },
    );

    for (const s of posSnapCache.siblingEdges) {
      const sRef = { top: s.top, right: s.right, bottom: s.bottom, left: s.left };
      xTargets.push(
        { val: s.left, isCenter: false, ...sRef },
        { val: s.right, isCenter: false, ...sRef },
        { val: s.centerX, isCenter: true, ...sRef },
      );
      yTargets.push(
        { val: s.top, isCenter: false, ...sRef },
        { val: s.bottom, isCenter: false, ...sRef },
        { val: s.centerY, isCenter: true, ...sRef },
      );
    }

    // Element edges for x: [left, right, centerX] — track which matched
    const xEdges: Array<{ val: number; isCenter: boolean }> = [
      { val: elEdges.left, isCenter: false },
      { val: elEdges.right, isCenter: false },
      { val: elEdges.centerX, isCenter: true },
    ];

    let bestDx = 0;
    let bestXDist = SNAP_THRESHOLD + 1;
    let snapXPos = 0;
    let snapXRef: SnapTarget | null = null;
    let snapXElIsCenter = false;

    for (const target of xTargets) {
      for (const edge of xEdges) {
        const dist = Math.abs(edge.val - target.val);
        if (dist < bestXDist) {
          bestXDist = dist;
          bestDx = target.val - edge.val;
          snapXPos = target.val;
          snapXRef = target;
          snapXElIsCenter = edge.isCenter;
        }
      }
    }

    const yEdges: Array<{ val: number; isCenter: boolean }> = [
      { val: elEdges.top, isCenter: false },
      { val: elEdges.bottom, isCenter: false },
      { val: elEdges.centerY, isCenter: true },
    ];

    let bestDy = 0;
    let bestYDist = SNAP_THRESHOLD + 1;
    let snapYPos = 0;
    let snapYRef: SnapTarget | null = null;
    let snapYElIsCenter = false;

    for (const target of yTargets) {
      for (const edge of yEdges) {
        const dist = Math.abs(edge.val - target.val);
        if (dist < bestYDist) {
          bestYDist = dist;
          bestDy = target.val - edge.val;
          snapYPos = target.val;
          snapYRef = target;
          snapYElIsCenter = edge.isCenter;
        }
      }
    }

    const guides: PosSnapGuide[] = [];
    const snapDx = bestXDist <= SNAP_THRESHOLD ? bestDx : 0;
    const snapDy = bestYDist <= SNAP_THRESHOLD ? bestDy : 0;

    if ((snapDx !== 0 || bestXDist <= SNAP_THRESHOLD) && snapXRef) {
      guides.push({ axis: "x", pos: snapXPos, elIsCenter: snapXElIsCenter, refIsCenter: snapXRef.isCenter, refTop: snapXRef.top, refRight: snapXRef.right, refBottom: snapXRef.bottom, refLeft: snapXRef.left });
    }
    if ((snapDy !== 0 || bestYDist <= SNAP_THRESHOLD) && snapYRef) {
      guides.push({ axis: "y", pos: snapYPos, elIsCenter: snapYElIsCenter, refIsCenter: snapYRef.isCenter, refTop: snapYRef.top, refRight: snapYRef.right, refBottom: snapYRef.bottom, refLeft: snapYRef.left });
    }

    return { dx: snapDx, dy: snapDy, guides };
  }

  function showPosSnapGuides(guides: PosSnapGuide[], elRect: DOMRect) {
    hideSnapGuides();
    let poolIdx = 0;

    function addXMark(x: number, y: number) {
      if (poolIdx >= snapGuidePool.length) return;
      const g = snapGuidePool[poolIdx++];
      drawXMark(g.line, x, y);
      g.line.classList.add("visible");
    }

    for (const guide of guides) {
      if (poolIdx >= snapGuidePool.length) break;

      const { line } = snapGuidePool[poolIdx++];
      // border-left/border-top visual center is at pos + 0.5
      if (guide.axis === "x") {
        line.style.cssText = `
          position:fixed;pointer-events:none;z-index:2147483645;background:none;
          top:0;left:${guide.pos}px;width:0;height:100vh;
          border-left:1px solid var(--retune-red);
        `;
        line.classList.add("visible");
        const cx = guide.pos + 0.5;

        // Reference element X marks: center if center matched, else corners
        if (guide.refIsCenter) {
          addXMark(cx, (guide.refTop + guide.refBottom) / 2);
        } else {
          addXMark(cx, guide.refTop);
          addXMark(cx, guide.refBottom);
        }
        // Dragged element X marks: center if center matched, else corners
        if (guide.elIsCenter) {
          addXMark(cx, elRect.top + elRect.height / 2);
        } else {
          addXMark(cx, elRect.top);
          addXMark(cx, elRect.bottom);
        }
      } else {
        line.style.cssText = `
          position:fixed;pointer-events:none;z-index:2147483645;background:none;
          top:${guide.pos}px;left:0;width:100vw;height:0;
          border-top:1px solid var(--retune-red);
        `;
        line.classList.add("visible");
        const cy = guide.pos + 0.5;

        // Reference element X marks: center if center matched, else corners
        if (guide.refIsCenter) {
          addXMark((guide.refLeft + guide.refRight) / 2, cy);
        } else {
          addXMark(guide.refLeft, cy);
          addXMark(guide.refRight, cy);
        }
        // Dragged element X marks: center if center matched, else corners
        if (guide.elIsCenter) {
          addXMark(elRect.left + elRect.width / 2, cy);
        } else {
          addXMark(elRect.left, cy);
          addXMark(elRect.right, cy);
        }
      }
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

    // Clear any existing hover/spacing visuals
    hideHighlight();

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

    // Aspect ratio lock (only for corners)
    // Panel lock active: always locked (Shift to unlock)
    // Images/video: locked by default, Shift to unlock
    // Other elements: unlocked by default, Shift to lock
    const isCorner = axes.dx !== 0 && axes.dy !== 0;
    const isMediaElement = selectedElement && /^(IMG|VIDEO|PICTURE|CANVAS)$/i.test(selectedElement.tagName);
    const panelLocked = selectedElement?.hasAttribute("data-retune-aspect-locked");
    const defaultLocked = isMediaElement || panelLocked;
    const shouldLock = resizeDrag.startWidth > 0 && resizeDrag.startHeight > 0
      && (defaultLocked ? !e.shiftKey : (isCorner && e.shiftKey));
    if (shouldLock) {
      const ratio = resizeDrag.startWidth / resizeDrag.startHeight;
      if (axes.dx !== 0 && axes.dy !== 0) {
        // Corner: constrain to ratio
        if (w / ratio < h) h = w / ratio;
        else w = h * ratio;
      } else if (axes.dx !== 0) {
        // Horizontal edge: width changed, adjust height
        h = w / ratio;
      } else {
        // Vertical edge: height changed, adjust width
        w = h * ratio;
      }
    }
    return { width: Math.round(w), height: Math.round(h), locked: shouldLock };
  }

  function handleResizePointerMove(e: PointerEvent) {
    if (!resizeDrag || !selectedElement) return;
    e.preventDefault();

    const raw = computeResize(e);
    const axes = HANDLE_AXES[resizeDrag.handle];

    // Show/hide aspect ratio lock indicator
    aspectLine.style.display = raw.locked ? "block" : "none";
    const { width, height, guides, fillWidth, fillHeight } = snapResize(raw.width, raw.height, axes);
    resizeFillWidth = fillWidth;
    resizeFillHeight = fillHeight;
    const el = selectedElement as HTMLElement;

    // Update LivePreviewEngine stylesheet for all matching instances
    // When aspect locked, both dimensions change even on edge drag
    const updateWidth = axes.dx !== 0 || raw.locked;
    const updateHeight = axes.dy !== 0 || raw.locked;
    if (updateWidth) callbacks.onResizePreview?.(selectedElement, "width", fillWidth ? "100%" : `${width}px`);
    if (updateHeight) callbacks.onResizePreview?.(selectedElement, "height", fillHeight ? "100%" : `${height}px`);
    // Also set inline !important on selected element to guarantee it wins
    if (updateWidth) el.style.setProperty("width", fillWidth ? "100%" : `${width}px`, "important");
    if (updateHeight) el.style.setProperty("height", fillHeight ? "100%" : `${height}px`, "important");

    // Update selection box and handles
    const newRect = selectedElement.getBoundingClientRect();
    const color = selectionColorForElement(selectedElement);
    positionColoredBox(selection, newRect, "solid", SELECTION_FILL_ALPHA, color);
    if (shouldShowDimensionLabel()) {
      positionSelectionLabel(selectionLabel, newRect, formatLabel(selectedElement), color);
    } else {
      selectionLabel.style.display = "none";
    }
    positionHandles(newRect);

    // Show/hide snap guides
    if (guides.length > 0) {
      showSnapGuides(guides, newRect, resizeDrag!.handle);
    } else {
      hideSnapGuides();
    }
    refreshPinLines();
    refreshScopeHighlights();
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
    aspectLine.style.display = "none";

    // Report final values through callback (keeps inline styles — LivePreviewEngine overrides)
    // When aspect locked, both dimensions may change even on edge drag
    const widthChanged = (axes.dx !== 0 || raw.locked) && (fillWidth || Math.abs(width - resizeDrag.startWidth) > 0.5);
    const heightChanged = (axes.dy !== 0 || raw.locked) && (fillHeight || Math.abs(height - resizeDrag.startHeight) > 0.5);
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
    const color = selectionColorForElement(selectedElement);
    positionColoredBox(selection, newRect, "solid", SELECTION_FILL_ALPHA, color);
    if (shouldShowDimensionLabel()) {
      positionSelectionLabel(selectionLabel, newRect, formatLabel(selectedElement), color);
    } else {
      selectionLabel.style.display = "none";
    }
    positionHandles(newRect);
    refreshPinLines();
  }

  // Attach resize handlers to all handles
  for (const pos of ALL_POSITIONS) {
    handleEls[pos].addEventListener("pointerdown", (e) => handleResizePointerDown(e, pos));
  }

  // ── Drag-to-reposition (absolute/fixed elements) ──

  // Cached positioning axes for the selected element (persists across drags)
  let repositionAxes: { useRight: boolean; useBottom: boolean } | null = null;

  let repositionDrag: {
    startX: number;
    startY: number;
    startTop: number;
    startLeft: number;
    startRight: number;
    startBottom: number;
    startRect: DOMRect;
  } | null = null;

  function isRepositionable(el: Element): boolean {
    const pos = getComputedStyle(el).position;
    return pos === "absolute" || pos === "fixed";
  }

  function updateSelectionCursor() {
    if (selectedElement && isRepositionable(selectedElement)) {
      selection.style.pointerEvents = "auto";
      selection.style.cursor = "move";
    } else if (selectedElement && detectReorderContext(selectedElement)) {
      selection.style.pointerEvents = "auto";
      selection.style.cursor = "grab";
    } else {
      selection.style.pointerEvents = "none";
      selection.style.cursor = "";
    }
  }

  function handleRepositionPointerDown(e: PointerEvent) {
    if (!selectedElement || !isRepositionable(selectedElement)) return;
    e.stopPropagation();
    e.preventDefault();
    selection.setPointerCapture(e.pointerId);

    // Clear visuals and hide selection chrome during drag
    hideHighlight();
    selection.style.display = "none";
    selectionLabel.style.display = "none";
    hideHandles();

    const el = selectedElement as HTMLElement;
    const cs = getComputedStyle(el);

    // Detect positioning axes on first drag, cache for subsequent drags.
    // Strategy: check inline style first, then check matched CSS rules,
    // then fall back to comparing computed values (closer to edge = that axis).
    if (!repositionAxes) {
      const inlineTop = el.style.top;
      const inlineBottom = el.style.bottom;
      const inlineLeft = el.style.left;
      const inlineRight = el.style.right;

      let useBottom = false;
      let useRight = false;

      if (inlineBottom !== "" || inlineTop !== "") {
        // Inline styles present — use them
        useBottom = inlineBottom !== "" && inlineTop === "";
      } else {
        // Check matched CSS rules for authored properties
        try {
          const rules = [...document.styleSheets].flatMap(s => {
            try { return [...s.cssRules]; } catch { return []; }
          }).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
          const hasRuleBottom = rules.some(r => el.matches(r.selectorText) && r.style.bottom && r.style.bottom !== "auto");
          const hasRuleTop = rules.some(r => el.matches(r.selectorText) && r.style.top && r.style.top !== "auto");
          if (hasRuleBottom && !hasRuleTop) useBottom = true;
          else if (!hasRuleBottom && hasRuleTop) useBottom = false;
          else useBottom = parseFloat(cs.bottom) < parseFloat(cs.top);
        } catch {
          useBottom = parseFloat(cs.bottom) < parseFloat(cs.top);
        }
      }

      if (inlineRight !== "" || inlineLeft !== "") {
        useRight = inlineRight !== "" && inlineLeft === "";
      } else {
        try {
          const rules = [...document.styleSheets].flatMap(s => {
            try { return [...s.cssRules]; } catch { return []; }
          }).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
          const hasRuleRight = rules.some(r => el.matches(r.selectorText) && r.style.right && r.style.right !== "auto");
          const hasRuleLeft = rules.some(r => el.matches(r.selectorText) && r.style.left && r.style.left !== "auto");
          if (hasRuleRight && !hasRuleLeft) useRight = true;
          else if (!hasRuleRight && hasRuleLeft) useRight = false;
          else useRight = parseFloat(cs.right) < parseFloat(cs.left);
        } catch {
          useRight = parseFloat(cs.right) < parseFloat(cs.left);
        }
      }

      repositionAxes = { useBottom, useRight };
    }

    repositionDrag = {
      startX: e.clientX,
      startY: e.clientY,
      startTop: parseFloat(cs.top) || 0,
      startLeft: parseFloat(cs.left) || 0,
      startRight: parseFloat(cs.right) || 0,
      startBottom: parseFloat(cs.bottom) || 0,
      startRect: selectedElement.getBoundingClientRect(),
    };

    // Cache snap targets for position snapping
    buildPosSnapCache(selectedElement);

    document.addEventListener("pointermove", handleRepositionPointerMove, true);
    document.addEventListener("pointerup", handleRepositionPointerUp, true);
  }

  function handleRepositionPointerMove(e: PointerEvent) {
    if (!repositionDrag || !selectedElement) return;
    e.preventDefault();

    const rawDx = e.clientX - repositionDrag.startX;
    const rawDy = e.clientY - repositionDrag.startY;
    const el = selectedElement as HTMLElement;

    // Compute proposed rect from start position + raw delta (no previous snap)
    const startRect = repositionDrag.startRect;
    const proposedRect = new DOMRect(
      startRect.left + rawDx, startRect.top + rawDy, startRect.width, startRect.height
    );

    // Check alignment snap
    const snap = checkPosSnap(proposedRect);
    const snapDx = snap.dx;
    const snapDy = snap.dy;

    // Show/hide position snap guides
    if (snap.guides.length > 0) {
      const snappedRect = new DOMRect(
        proposedRect.left + snap.dx, proposedRect.top + snap.dy, proposedRect.width, proposedRect.height
      );
      showPosSnapGuides(snap.guides, snappedRect);
    } else {
      hideSnapGuides();
    }

    // Compute final position values with snap correction applied
    if (repositionAxes?.useBottom) {
      const newBottom = Math.round(repositionDrag.startBottom - rawDy - snapDy);
      el.style.setProperty("bottom", `${newBottom}px`, "important");
      callbacks.onRepositionPreview?.(selectedElement, "bottom", `${newBottom}px`);
    } else {
      const newTop = Math.round(repositionDrag.startTop + rawDy + snapDy);
      el.style.setProperty("top", `${newTop}px`, "important");
      callbacks.onRepositionPreview?.(selectedElement, "top", `${newTop}px`);
    }

    if (repositionAxes?.useRight) {
      const newRight = Math.round(repositionDrag.startRight - rawDx - snapDx);
      el.style.setProperty("right", `${newRight}px`, "important");
      callbacks.onRepositionPreview?.(selectedElement, "right", `${newRight}px`);
    } else {
      const newLeft = Math.round(repositionDrag.startLeft + rawDx + snapDx);
      el.style.setProperty("left", `${newLeft}px`, "important");
      callbacks.onRepositionPreview?.(selectedElement, "left", `${newLeft}px`);
    }

    // Update parent indicator + pin lines
    const parent = selectedElement.parentElement;
    if (parent && parent !== document.body && parent !== document.documentElement) {
      const pr = parent.getBoundingClientRect();
      parentIndicator.style.top = `${pr.top}px`;
      parentIndicator.style.left = `${pr.left}px`;
      parentIndicator.style.width = `${pr.width}px`;
      parentIndicator.style.height = `${pr.height}px`;
    }
    refreshPinLines();
  }

  function handleRepositionPointerUp(e: PointerEvent) {
    if (!repositionDrag || !selectedElement) {
      repositionDrag = null;
      return;
    }

    const rawDx = e.clientX - repositionDrag.startX;
    const rawDy = e.clientY - repositionDrag.startY;
    const el = selectedElement as HTMLElement;

    // Compute final snap correction
    const startRect = repositionDrag.startRect;
    const finalProposed = new DOMRect(startRect.left + rawDx, startRect.top + rawDy, startRect.width, startRect.height);
    const finalSnap = checkPosSnap(finalProposed);

    // Remove inline overrides
    if (repositionAxes?.useBottom) el.style.removeProperty("bottom");
    else el.style.removeProperty("top");
    if (repositionAxes?.useRight) el.style.removeProperty("right");
    else el.style.removeProperty("left");

    // Report final values with snap correction
    const totalDy = rawDy + finalSnap.dy;
    const totalDx = rawDx + finalSnap.dx;
    if (Math.abs(totalDy) > 0.5) {
      if (repositionAxes?.useBottom) {
        callbacks.onReposition?.(selectedElement, "bottom", `${Math.round(repositionDrag.startBottom - totalDy)}px`);
      } else {
        callbacks.onReposition?.(selectedElement, "top", `${Math.round(repositionDrag.startTop + totalDy)}px`);
      }
    }
    if (Math.abs(totalDx) > 0.5) {
      if (repositionAxes?.useRight) {
        callbacks.onReposition?.(selectedElement, "right", `${Math.round(repositionDrag.startRight - totalDx)}px`);
      } else {
        callbacks.onReposition?.(selectedElement, "left", `${Math.round(repositionDrag.startLeft + totalDx)}px`);
      }
    }

    repositionDrag = null;
    posSnapCache = null;
    hideSnapGuides();
    document.removeEventListener("pointermove", handleRepositionPointerMove, true);
    document.removeEventListener("pointerup", handleRepositionPointerUp, true);

    showSelection();
  }

  // ── Canvas drag-to-reorder (flow elements in flex/grid/block containers) ──

  const REORDER_THRESHOLD = 5;
  let reorderClickTimer: ReturnType<typeof setTimeout> | null = null;
  let reorderDragActive = false; // persists through cleanup for showSelection/trackSelection

  let reorderDrag: {
    element: Element;
    parent: Element;
    siblings: Element[];
    allRects: DOMRect[];
    otherRects: DOMRect[];
    otherIndices: number[];
    dragIndex: number;
    dropIndex: number;
    horizontal: boolean;
    startX: number;
    startY: number;
    startRect: DOMRect;
    active: boolean;
    ghost: HTMLDivElement | null;
    // Reparent state (when cursor exits parent bounds)
    mode: "reorder" | "reparent";
    reparentTarget: Element | null;
    reparentIndex: number;
    reparentHighlight: HTMLDivElement | null;
  } | null = null;

  /** Detect if element is in a reorderable container (flex, grid, or block with 2+ children).
   *  Returns siblings sorted by VISUAL position and the element's VISUAL index. */
  function detectReorderContext(el: Element): {
    parent: Element; siblings: Element[]; horizontal: boolean; index: number;
  } | null {
    const parent = el.parentElement;
    if (!parent) return null;

    const pos = getComputedStyle(el).position;
    if (pos === "absolute" || pos === "fixed") return null;

    const display = getComputedStyle(parent).display;
    const isFlex = display === "flex" || display === "inline-flex";
    const isGrid = display === "grid" || display === "inline-grid";
    const isBlock = display === "block" || display === "inline-block" || display === "flow-root";

    if (!isFlex && !isGrid && !isBlock) return null;

    const domSiblings = Array.from(parent.children).filter(c => {
      const cs = getComputedStyle(c);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      if (cs.position === "absolute" || cs.position === "fixed") return false;
      return true;
    });
    if (domSiblings.length < 2) return null;
    if (!domSiblings.includes(el)) return null;

    // Detect direction
    let horizontal: boolean;
    if (isFlex) {
      const dir = getComputedStyle(parent).flexDirection;
      horizontal = dir === "row" || dir === "row-reverse";
    } else if (isGrid) {
      const autoFlow = getComputedStyle(parent).gridAutoFlow;
      if (autoFlow.startsWith("column")) {
        horizontal = false;
      } else if (domSiblings.length >= 2) {
        const r0 = domSiblings[0].getBoundingClientRect();
        const r1 = domSiblings[1].getBoundingClientRect();
        horizontal = Math.abs(r1.left - r0.left) > Math.abs(r1.top - r0.top);
      } else {
        horizontal = true;
      }
    } else {
      horizontal = false;
    }

    // Sort siblings by visual position (respects CSS order, translate, etc.)
    const siblings = [...domSiblings].sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return horizontal ? ra.left - rb.left : ra.top - rb.top;
    });

    const index = siblings.indexOf(el);
    if (index === -1) return null;

    return { parent, siblings, horizontal, index };
  }



  /** Check if cursor is inside the parent's bounding rect (with buffer to prevent flickering at edges) */
  function isCursorInParent(x: number, y: number, parent: Element): boolean {
    const r = parent.getBoundingClientRect();
    const BUFFER = 10; // px outside parent before switching to reparent mode
    return x >= r.left - BUFFER && x <= r.right + BUFFER && y >= r.top - BUFFER && y <= r.bottom + BUFFER;
  }

  /** Find a valid reparent container at cursor position (walks up from elementFromPoint) */
  function findReparentTarget(x: number, y: number, draggedEl: Element, originalParent: Element): {
    target: Element; insertIndex: number; horizontal: boolean;
  } | null {
    // Temporarily show the hidden element so elementFromPoint skips it
    const ghost = reorderDrag?.ghost;
    if (ghost) ghost.style.display = "none";
    (draggedEl as HTMLElement).style.visibility = "";
    const hit = pageElementAtPoint(x, y);
    (draggedEl as HTMLElement).style.visibility = "hidden";
    if (ghost) ghost.style.display = "";

    if (!hit) return null;

    // Walk up from the hit element to find a valid container
    let current: Element | null = hit;
    while (current) {
      if (current === draggedEl) { current = current.parentElement; continue; }
      if (current === originalParent) return null; // back in original parent — stay in reorder mode
      if (current === document.body || current === document.documentElement) break;

      // Check if this element is a valid container that can hold children
      const display = getComputedStyle(current).display;
      const isContainer = display === "flex" || display === "inline-flex"
        || display === "grid" || display === "inline-grid"
        || display === "block" || display === "inline-block" || display === "flow-root";

      // Reject void/self-closing elements
      const tag = current.tagName;
      const voidElements = new Set([
        "INPUT", "IMG", "BR", "HR", "AREA", "BASE", "COL", "EMBED",
        "LINK", "META", "PARAM", "SOURCE", "TRACK", "WBR",
        "TEXTAREA", "SELECT",
      ]);
      if (voidElements.has(tag)) { current = current.parentElement; continue; }

      // Reject text layers: elements with only text content and no child elements
      // (unless they're flex/grid — those are explicitly layout containers even if empty)
      const isFlexOrGrid = display === "flex" || display === "inline-flex"
        || display === "grid" || display === "inline-grid";
      const isTextLayer = current.childElementCount === 0
        && (current.textContent?.trim().length ?? 0) > 0
        && !isFlexOrGrid;
      if (isTextLayer) { current = current.parentElement; continue; }

      if (isContainer && !isAncestor(draggedEl, current)) {
        // Compute insert index from cursor position relative to children
        const children = Array.from(current.children).filter(c => {
          const cs = getComputedStyle(c);
          return cs.display !== "none" && cs.visibility !== "hidden";
        });

        const dir = getComputedStyle(current).flexDirection;
        const horizontal = (display === "flex" || display === "inline-flex")
          ? (dir === "row" || dir === "row-reverse")
          : false;

        let insertIndex = children.length; // default: after all children
        for (let i = 0; i < children.length; i++) {
          const r = children[i].getBoundingClientRect();
          const mid = horizontal ? r.left + r.width / 2 : r.top + r.height / 2;
          const cursor = horizontal ? x : y;
          if (cursor < mid) { insertIndex = i; break; }
        }

        return { target: current, insertIndex, horizontal };
      }

      current = current.parentElement;
    }
    return null;
  }

  /** Check if ancestor is an ancestor of descendant */
  function isAncestor(ancestor: Element, descendant: Element): boolean {
    let current: Element | null = descendant.parentElement;
    while (current) {
      if (current === ancestor) return true;
      current = current.parentElement;
    }
    return false;
  }

  /** Create/update reparent highlight overlay (parent outline + drop indicator line) */
  function showReparentHighlight(
    target: Element, insertIndex: number, horizontal: boolean,
    dragState: NonNullable<typeof reorderDrag>
  ) {
    // Parent outline
    let hl = dragState.reparentHighlight;
    if (!hl) {
      hl = document.createElement("div");
      hl.setAttribute("data-retune-drag-ghost", "");
      hl.style.cssText = `
        position:fixed;pointer-events:none;z-index:2147483646;
        border:1px solid #0D99FF;
        background:rgba(13,153,255,0.04);
      `;
      document.body.appendChild(hl);
      dragState.reparentHighlight = hl;
    }
    const r = target.getBoundingClientRect();
    hl.style.left = `${r.left}px`;
    hl.style.top = `${r.top}px`;
    hl.style.width = `${r.width}px`;
    hl.style.height = `${r.height}px`;
    hl.style.display = "block";

    // Drop indicator line inside the container
    let line = hl.querySelector("[data-retune-reparent-line]") as HTMLDivElement | null;
    if (!line) {
      line = document.createElement("div");
      line.setAttribute("data-retune-reparent-line", "");
      line.style.cssText = `position:absolute;background:#0D99FF;pointer-events:none;border-radius:1px;`;
      hl.appendChild(line);
    }
    // Inset relative to container size (3%), clamped between 3-12px
    const INSET = Math.max(3, Math.min(12, Math.round((horizontal ? r.height : r.width) * 0.03)));

    // Get visible children of the target container for positioning the line
    const children = Array.from(target.children).filter(c => {
      const cs = getComputedStyle(c);
      return cs.display !== "none" && cs.visibility !== "hidden";
    });

    if (horizontal) {
      // Vertical drop line for horizontal layout
      let x: number;
      if (children.length === 0) {
        x = r.left + 4;
      } else if (insertIndex <= 0) {
        x = children[0].getBoundingClientRect().left;
      } else if (insertIndex >= children.length) {
        x = children[children.length - 1].getBoundingClientRect().right;
      } else {
        const prev = children[insertIndex - 1].getBoundingClientRect();
        const curr = children[insertIndex].getBoundingClientRect();
        x = (prev.right + curr.left) / 2;
      }
      line.style.left = `${x - r.left - 1}px`;
      line.style.top = `${INSET}px`;
      line.style.width = "2px";
      line.style.height = `${r.height - INSET * 2}px`;
    } else {
      // Horizontal drop line for vertical layout
      let y: number;
      if (children.length === 0) {
        y = r.top + 4;
      } else if (insertIndex <= 0) {
        y = children[0].getBoundingClientRect().top;
      } else if (insertIndex >= children.length) {
        y = children[children.length - 1].getBoundingClientRect().bottom;
      } else {
        const prev = children[insertIndex - 1].getBoundingClientRect();
        const curr = children[insertIndex].getBoundingClientRect();
        y = (prev.bottom + curr.top) / 2;
      }
      line.style.left = `${INSET}px`;
      line.style.top = `${y - r.top - 1}px`;
      line.style.width = `${r.width - INSET * 2}px`;
      line.style.height = "2px";
    }
  }

  function hideReparentHighlight(dragState: NonNullable<typeof reorderDrag>) {
    if (dragState.reparentHighlight) {
      dragState.reparentHighlight.style.display = "none";
    }
  }

  function createReorderGhost(el: Element): HTMLDivElement {
    const rect = el.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.style.cssText = `
      position:fixed;pointer-events:none;z-index:2147483647;
      width:${rect.width}px;height:${rect.height}px;
      left:${rect.left}px;top:${rect.top}px;
      opacity:0.7;border:2px solid #0D99FF;border-radius:4px;
      background:rgba(13,153,255,0.06);transition:none;
    `;
    shadowRoot.appendChild(ghost);
    return ghost;
  }

  // positionReorderIndicator removed — sibling shifting provides visual feedback
  function _unused_positionReorderIndicator(
    indicator: HTMLDivElement, dropIndex: number,
    siblingRects: DOMRect[], horizontal: boolean, dragIndex: number
  ) {
    if (siblingRects.length === 0) return;

    // Adjust for the visual position (dragged element still takes space)
    const visualDrop = dropIndex > dragIndex ? dropIndex + 1 : dropIndex;

    if (horizontal) {
      // Vertical line between horizontal siblings
      let x: number;
      if (visualDrop <= 0) {
        x = siblingRects[0].left - 1;
      } else if (visualDrop >= siblingRects.length) {
        x = siblingRects[siblingRects.length - 1].right;
      } else {
        x = (siblingRects[visualDrop - 1].right + siblingRects[visualDrop].left) / 2;
      }
      // Height spans the tallest sibling
      const top = Math.min(...siblingRects.map(r => r.top));
      const bottom = Math.max(...siblingRects.map(r => r.bottom));
      indicator.style.left = `${x - 1}px`;
      indicator.style.top = `${top}px`;
      indicator.style.width = "2px";
      indicator.style.height = `${bottom - top}px`;
    } else {
      // Horizontal line between vertical siblings
      let y: number;
      if (visualDrop <= 0) {
        y = siblingRects[0].top - 1;
      } else if (visualDrop >= siblingRects.length) {
        y = siblingRects[siblingRects.length - 1].bottom;
      } else {
        y = (siblingRects[visualDrop - 1].bottom + siblingRects[visualDrop].top) / 2;
      }
      // Width spans the widest sibling
      const left = Math.min(...siblingRects.map(r => r.left));
      const right = Math.max(...siblingRects.map(r => r.right));
      indicator.style.left = `${left}px`;
      indicator.style.top = `${y - 1}px`;
      indicator.style.width = `${right - left}px`;
      indicator.style.height = "2px";
    }
    indicator.style.display = "block";
  }

  function handleReorderPointerMove(e: PointerEvent) {
    if (!reorderDrag || !selectedElement) return;
    e.preventDefault();

    const dx = e.clientX - reorderDrag.startX;
    const dy = e.clientY - reorderDrag.startY;

    if (!reorderDrag.active) {
      if (Math.abs(dx) + Math.abs(dy) < REORDER_THRESHOLD) return;

      // Activate — select the element if not already selected
      reorderDrag.active = true;
      reorderDragActive = true;

      if (selectedElement !== reorderDrag.element) {
        selectedElement = reorderDrag.element;
        selectedElements = [reorderDrag.element];
        notifySelect(reorderDrag.element, false);
      }

      // Hide selection chrome
      selection.style.display = "none";
      selectionLabel.style.display = "none";
      hideHandles();

      // Hide the element in place (preserves ALL CSS — translate, order, flex, margin)
      const dragEl = reorderDrag.element as HTMLElement;
      const origRect = reorderDrag.startRect;
      dragEl.style.visibility = "hidden";

      // Suppress text selection during drag
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";

      // Create ghost in the DOCUMENT (not shadow DOM) so page CSS applies to the clone
      const ghost = document.createElement("div");
      ghost.setAttribute("data-retune-drag-ghost", "");
      ghost.style.cssText = `
        position:fixed;pointer-events:none;z-index:2147483647;
        width:${origRect.width}px;height:${origRect.height}px;
        left:${origRect.left}px;top:${origRect.top}px;
        transition:none;overflow:hidden;opacity:0.85;
      `;
      // Clone content with computed styles baked in (so it doesn't depend on parent CSS context)
      const clone = dragEl.cloneNode(true) as HTMLElement;
      const origStyles = getComputedStyle(dragEl);
      const stylesToCopy = [
        "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing",
        "color", "background-color", "background-image", "background",
        "padding", "border", "border-radius",
        "text-align", "text-decoration", "text-transform",
        "white-space", "word-break", "overflow-wrap",
        "display", "flex-direction", "align-items", "justify-content", "gap",
        "box-shadow", "opacity",
      ];
      for (const prop of stylesToCopy) {
        clone.style.setProperty(prop, origStyles.getPropertyValue(prop));
      }
      clone.style.visibility = "visible";
      clone.style.position = "static";
      clone.style.translate = "none";
      clone.style.transform = "none";
      clone.style.margin = "0";
      clone.style.width = "100%";
      clone.style.height = "100%";
      clone.style.boxSizing = "border-box";
      ghost.appendChild(clone);
      document.body.appendChild(ghost);
      reorderDrag.ghost = ghost;

      // Cache sibling rects (element still in flow with visibility:hidden — rects are accurate
      // and include margin collapse effects since layout hasn't changed)
      const allRects = reorderDrag.siblings.map(s => s.getBoundingClientRect());
      reorderDrag.allRects = allRects;

      const otherR: DOMRect[] = [];
      const otherI: number[] = [];
      for (let i = 0; i < allRects.length; i++) {
        if (i === reorderDrag.dragIndex) continue;
        otherR.push(allRects[i]);
        otherI.push(i);
      }
      reorderDrag.otherRects = otherR;
      reorderDrag.otherIndices = otherI;

      // Add transition to siblings for smooth shifting
      for (const idx of otherI) {
        (reorderDrag.siblings[idx] as HTMLElement).style.transition = "transform 150ms ease-out";
      }
      return;
    }

    // React safety
    if (!reorderDrag.element.isConnected) {
      cleanupReorderDrag();
      return;
    }

    // Move the ghost
    if (reorderDrag.ghost) {
      reorderDrag.ghost.style.left = `${reorderDrag.startRect.left + dx}px`;
      reorderDrag.ghost.style.top = `${reorderDrag.startRect.top + dy}px`;
    }

    // Check if cursor is inside the parent.
    // Use buffer when leaving (prevents flickering at edges).
    // Use exact bounds when returning from reparent (require clear re-entry).
    const parentRect = reorderDrag.parent.getBoundingClientRect();
    const LEAVE_BUFFER = 10;
    const insideParent = reorderDrag.mode === "reparent"
      ? (e.clientX >= parentRect.left && e.clientX <= parentRect.right &&
         e.clientY >= parentRect.top && e.clientY <= parentRect.bottom)
      : (e.clientX >= parentRect.left - LEAVE_BUFFER && e.clientX <= parentRect.right + LEAVE_BUFFER &&
         e.clientY >= parentRect.top - LEAVE_BUFFER && e.clientY <= parentRect.bottom + LEAVE_BUFFER);

    if (insideParent) {
      // ── REORDER MODE: cursor inside parent ──
      if (reorderDrag.mode === "reparent") {
        reorderDrag.mode = "reorder";
        reorderDrag.reparentTarget = null;
        hideReparentHighlight(reorderDrag);
      }

      const newIndex = computeCanvasDropIndex(
        e.clientX, e.clientY,
        reorderDrag.otherRects, reorderDrag.otherIndices,
        reorderDrag.horizontal, reorderDrag.dragIndex
      );

      if (newIndex !== reorderDrag.dropIndex) {
        reorderDrag.dropIndex = newIndex;
        const { siblings, dragIndex, allRects, horizontal } = reorderDrag;

        // Compute the dragged element's occupied space
        let dragOccupied: number;
        if (horizontal) {
          if (dragIndex < allRects.length - 1) {
            dragOccupied = allRects[dragIndex + 1].left - allRects[dragIndex].left;
          } else {
            const gap = dragIndex > 0 ? allRects[dragIndex].left - allRects[dragIndex - 1].right : 0;
            dragOccupied = allRects[dragIndex].width + gap;
          }
        } else {
          if (dragIndex < allRects.length - 1) {
            dragOccupied = allRects[dragIndex + 1].top - allRects[dragIndex].top;
          } else {
            const gap = dragIndex > 0 ? allRects[dragIndex].top - allRects[dragIndex - 1].bottom : 0;
            dragOccupied = allRects[dragIndex].height + gap;
          }
        }

        // Shift siblings by dragged element's occupied space
        for (let i = 0; i < siblings.length; i++) {
          if (i === dragIndex) continue;
          const el = siblings[i] as HTMLElement;

          let shift = 0;
          if (dragIndex < newIndex) {
            if (i > dragIndex && i < newIndex) shift = -dragOccupied;
          } else if (dragIndex > newIndex) {
            if (i >= newIndex && i < dragIndex) shift = dragOccupied;
          }

          el.style.transform = shift !== 0
            ? (horizontal ? `translateX(${shift}px)` : `translateY(${shift}px)`)
            : "";
        }
      }
    } else {
      // ── REPARENT MODE: cursor outside parent ──
      reorderDrag.mode = "reparent";

      // Clear sibling shifts (return them to original positions)
      for (let i = 0; i < reorderDrag.siblings.length; i++) {
        if (i === reorderDrag.dragIndex) continue;
        (reorderDrag.siblings[i] as HTMLElement).style.transform = "";
      }

      // Find a valid container under cursor
      const reparentResult = findReparentTarget(e.clientX, e.clientY, reorderDrag.element, reorderDrag.parent);

      if (reparentResult) {
        reorderDrag.reparentTarget = reparentResult.target;
        reorderDrag.reparentIndex = reparentResult.insertIndex;
        showReparentHighlight(reparentResult.target, reparentResult.insertIndex, reparentResult.horizontal, reorderDrag);
      } else {
        reorderDrag.reparentTarget = null;
        hideReparentHighlight(reorderDrag);
      }
    }
  }

  function handleReorderPointerUp(e: PointerEvent) {
    document.removeEventListener("pointermove", handleReorderPointerMove, true);
    document.removeEventListener("pointerup", handleReorderPointerUp, true);

    if (!reorderDrag) return;

    const { element, dragIndex, dropIndex, active, mode, reparentTarget, reparentIndex } = reorderDrag;

    if (active && mode === "reparent" && reparentTarget) {
      // REPARENT: move element to a different container
      cleanupReorderDrag();
      callbacks.onCanvasReparent?.(element, reparentTarget, reparentIndex);
      reorderDragActive = false;
      if (selectedElement) showSelection();
    } else if (active && mode === "reorder" && !isEffectiveNoOp(dragIndex, dropIndex)) {
      // REORDER: within same parent
      cleanupReorderDrag();
      callbacks.onCanvasReorder?.(element, dragIndex, dropIndex);
      reorderDragActive = false;
      if (selectedElement) showSelection();
    } else if (active) {
      // No meaningful change — just cleanup
      cleanupReorderDrag();
      reorderDragActive = false;
      if (selectedElement) showSelection();
    } else {
      // Threshold not met — click-through to select child under cursor
      cleanupReorderDrag();
      reorderDragActive = false;

      const clickX = e.clientX;
      const clickY = e.clientY;
      const clickElement = element;
      if (reorderClickTimer) clearTimeout(reorderClickTimer);
      reorderClickTimer = setTimeout(() => {
        reorderClickTimer = null;
        selection.style.display = "none";
        selectionLabel.style.display = "none";
        hideHandles();
        const hit = pageElementAtPoint(clickX, clickY);
        if (hit && hit !== clickElement) {
          selectedElement = hit;
          selectedElements = [hit];
          selectionLabelHidden = false;
          observeSelectedElements();
          showSelection();
          hideHighlight();
          hoveredElement = null;
          notifySelect(hit, false);
        } else {
          selection.style.display = "";
          showSelection();
        }
      }, 200);
    }
  }

  function cleanupReorderDrag() {
    if (!reorderDrag) return;

    // Remove ghost and reparent highlight from document body
    if (reorderDrag.ghost) reorderDrag.ghost.remove();
    if (reorderDrag.reparentHighlight) reorderDrag.reparentHighlight.remove();

    // Restore user-select
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("-webkit-user-select");

    // Restore dragged element visibility
    const dragEl = reorderDrag.element as HTMLElement;
    dragEl.style.removeProperty("visibility");
    if (dragEl.getAttribute("style")?.trim() === "") dragEl.removeAttribute("style");

    // Remove sibling transforms: kill transition FIRST (prevents animation-back), then remove transform
    for (let i = 0; i < reorderDrag.siblings.length; i++) {
      if (i === reorderDrag.dragIndex) continue;
      const el = reorderDrag.siblings[i] as HTMLElement;
      el.style.transition = "none"; // kill transition immediately so transform removal is instant
      el.style.removeProperty("transform");
      el.style.removeProperty("transition");
      if (el.getAttribute("style")?.trim() === "") el.removeAttribute("style");
    }

    reorderDrag = null;
  }

  function performSelectionClickAtPoint(
    x: number,
    y: number,
    modifiers: { shiftKey: boolean; altKey: boolean },
    fallbackElement?: Element,
  ) {
    if (!active || commentMode || drawMode || suspended || commentDraftActive) return;

    const { shiftKey, altKey } = modifiers;

    if (!commentMode) {
      const drawHit = hitTestDrawPath(x, y);
      if (drawHit) {
        handleDrawPathClick(drawHit, { clientX: x, clientY: y, shiftKey, altKey } as MouseEvent);
        return;
      }

      if (!commentDraftActive && selectedDrawPaths.length > 0 && !shiftKey && !isPointInsideDrawSelectionBounds(x, y)) {
        clearDrawSelection();
      }
    }

    const sameSpot =
      Math.abs(x - lastClickPos.x) <= CLICK_RADIUS &&
      Math.abs(y - lastClickPos.y) <= CLICK_RADIUS &&
      elementStack.length > 1;

    let el: Element | undefined;
    if (sameSpot) {
      elementStack = buildElementStack(x, y);
      if (elementStack.length <= 1) {
        stackIndex = 0;
        el = elementStack[0] ?? fallbackElement;
      } else {
        stackIndex = (stackIndex + 1) % elementStack.length;
        el = elementStack[stackIndex];
      }
    } else {
      elementStack = buildElementStack(x, y);
      stackIndex = 0;
      lastClickPos = { x, y };
      el = elementStack[0] ?? fallbackElement;
    }

    if (!el) {
      if (!commentMode && !commentDraftActive && selectedElements.length > 0 && !shiftKey) {
        deselect();
      }
      return;
    }

    if (commentDraftActive) {
      if (!shiftKey && !altKey && !commentMode) {
        showSelection();
        return;
      }
      hideHighlight();
      hoveredElement = null;
      blurPageFocus();
      callbacks.onSelect(el, { shiftKey, altKey, selectedElements: [el] });
      return;
    }

    if (commentMode) {
      hideHighlight();
      hoveredElement = null;
      blurPageFocus();
      callbacks.onSelect(el, { shiftKey, altKey, selectedElements: [el] });
      return;
    }

    applySelectionClickResult(
      resolveSelectionClick(
        el,
        selectedElements,
        selectedElement,
        { shiftKey, altKey },
        MULTI_SELECT_POOL_SIZE + 1,
      ),
      el,
    );
  }

  // Fork: reposition for absolute/fixed, reorder for flow elements in flex/grid.
  // Shift/alt always select or deselect; grab/reorder only when already selected without modifiers.
  selection.addEventListener("pointerdown", (e: PointerEvent) => {
    if (!selectedElement) return;

    if (e.shiftKey || e.altKey) {
      e.preventDefault();
      e.stopPropagation();

      const prevSelectionDisplay = selection.style.display;
      const prevLabelDisplay = selectionLabel.style.display;
      selection.style.display = "none";
      selectionLabel.style.display = "none";
      performSelectionClickAtPoint(e.clientX, e.clientY, {
        shiftKey: e.shiftKey,
        altKey: e.altKey,
      }, selectedElement);
      selection.style.display = prevSelectionDisplay;
      selectionLabel.style.display = prevLabelDisplay;
      if (selectedElement) showSelection();
      return;
    }

    // Absolute/fixed → reposition (existing behavior)
    if (isRepositionable(selectedElement)) {
      handleRepositionPointerDown(e);
      return;
    }

    // Flow element → reorder
    const context = detectReorderContext(selectedElement);
    if (!context) return;

    e.preventDefault(); // Prevent text selection during drag

    const elRect = selectedElement.getBoundingClientRect();
    reorderDrag = {
      element: selectedElement,
      parent: context.parent,
      siblings: context.siblings,
      otherRects: [],
      otherIndices: [],
      dragIndex: context.index,
      dropIndex: context.index,
      horizontal: context.horizontal,
      startX: e.clientX,
      startY: e.clientY,
      startRect: elRect,
      active: false,
      ghost: null,
      mode: "reorder",
      reparentTarget: null,
      reparentIndex: 0,
      reparentHighlight: null,
    };

    document.addEventListener("pointermove", handleReorderPointerMove, true);
    document.addEventListener("pointerup", handleReorderPointerUp, true);
  });

  // Double-click on selection box: cancel pending click-through, trigger inline text editing
  selection.addEventListener("dblclick", (e: MouseEvent) => {
    if (!active || !selectedElement) return;
    e.preventDefault();
    e.stopPropagation();

    // Cancel pending click-through from first click
    if (reorderClickTimer) {
      clearTimeout(reorderClickTimer);
      reorderClickTimer = null;
    }

    // Hide overlay elements to find the real page element
    selection.style.display = "none";
    selectionLabel.style.display = "none";
    hideHandles();
    const hit = pageElementAtPoint(e.clientX, e.clientY);
    selection.style.display = "";
    const target = hit || selectedElement;
    if (target !== selectedElement) {
      selectElement(target);
    } else {
      showSelection();
    }

    callbacks.onDoubleClick?.(target);
  });

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
    background:var(--retune-red);padding:1px 4px;border-radius:2px;
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
      border-${horizontal ? "top" : "left"}:1px ${dashed ? "dashed" : "solid"} var(--retune-red);
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

  function selectionColorForIndex(index: number): string {
    if (index < SELECTION_COLORS.length) return SELECTION_COLORS[index];
    const hue = (index * 137.508) % 360;
    return `hsl(${hue.toFixed(1)} 78% 52%)`;
  }

  function getUsedSelectionColors(): Set<string> {
    const used = new Set<string>();
    for (const path of drawingSvg.querySelectorAll("path")) {
      used.add(getDrawingBaseColor(path));
    }
    for (const path of selectedDrawPaths) {
      const color = drawingSelectionColors.get(path);
      if (color) used.add(color);
    }
    for (const el of selectedElements) {
      const color = elementSelectionColors.get(el);
      if (color) used.add(color);
    }
    return used;
  }

  function nextSelectionColor(): string {
    return nextAvailableSelectionColor(getUsedSelectionColors());
  }

  function nextAvailableSelectionColor(used: Set<string>): string {
    for (let i = 0; i < used.size + SELECTION_COLORS.length + 1; i++) {
      const color = selectionColorForIndex(i);
      if (!used.has(color)) return color;
    }
    return selectionColorForIndex(used.size);
  }

  function selectionColorForElement(el: Element): string {
    let color = elementSelectionColors.get(el);
    if (!color) {
      color = nextSelectionColor();
      elementSelectionColors.set(el, color);
    }
    return color;
  }

  function nextDrawingColor(): string {
    return nextSelectionColor();
  }

  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const normalized = hex.replace("#", "");
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
  }

  function positionColoredBox(
    box: HTMLElement,
    rect: DOMRect,
    borderStyle: string,
    bgAlpha: string,
    color: string,
    forceNewTransition = false,
  ) {
    const { r, g, b } = hexToRgb(color);
    const wasHidden = box.style.display === "none" || forceNewTransition;

    if (wasHidden) {
      box.style.top = `${rect.top}px`;
      box.style.left = `${rect.left}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      box.style.border = `1px ${borderStyle} transparent`;
      box.style.background = `rgba(${r}, ${g}, ${b}, 0)`;
      box.style.display = "";
      box.offsetHeight; // force reflow
    }

    box.style.top = `${rect.top}px`;
    box.style.left = `${rect.left}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.style.border = `1px ${borderStyle} ${color}`;
    box.style.background = `rgba(${r}, ${g}, ${b}, ${bgAlpha})`;
    box.style.display = "";
  }

  function hideMultiSelectBoxes() {
    for (const box of multiSelectPool) {
      box.style.display = "none";
    }
  }

  let commentDraftActive = false;

  /** Dedicated overflow boxes for comment-draft multi-element fills. */
  const commentDraftPool: HTMLDivElement[] = [];

  function createCommentDraftBox(): HTMLDivElement {
    const box = document.createElement("div");
    box.setAttribute("data-retune-comment-selection", "");
    box.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483644;
      box-sizing: border-box;
      display: none;
      outline: none;
      transition: background 0.25s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.25s cubic-bezier(0.23, 1, 0.32, 1);
    `;
    shadowRoot.appendChild(box);
    return box;
  }

  function getCommentDraftBox(index: number): HTMLElement {
    if (index === 0) return selection;
    const multiIndex = index - 1;
    if (multiIndex < multiSelectPool.length) return multiSelectPool[multiIndex];
    const scopeIndex = multiIndex - multiSelectPool.length;
    if (scopeIndex < scopeHighlightPool.length) return scopeHighlightPool[scopeIndex];

    const overflowIndex = scopeIndex - scopeHighlightPool.length;
    while (commentDraftPool.length <= overflowIndex) {
      commentDraftPool.push(createCommentDraftBox());
    }
    return commentDraftPool[overflowIndex];
  }

  function hideCommentDraftOutlines() {
    for (const box of [selection, ...multiSelectPool, ...scopeHighlightPool, ...commentDraftPool]) {
      box.style.display = "none";
    }
  }

  function updateCommentDraftOutlines() {
    if (selectedElements.length === 0 && selectedDrawPaths.length === 0) return;

    syncDrawingPathAppearance();

    let poolIndex = 0;
    for (let i = 0; i < selectedElements.length; i++) {
      const el = selectedElements[i];
      const rect = el.getBoundingClientRect();
      const box = getCommentDraftBox(poolIndex++);
      positionColoredBox(box, rect, "solid", SELECTION_FILL_ALPHA, selectionColorForElement(el));
    }
    for (; poolIndex < 1 + multiSelectPool.length + scopeHighlightPool.length + commentDraftPool.length; poolIndex++) {
      getCommentDraftBox(poolIndex).style.display = "none";
    }
    lastSelectedElement = selectedElement;
  }

  function observeSelectedElements() {
    resizeObserver?.disconnect();
    for (const el of selectedElements) {
      resizeObserver?.observe(el);
    }
  }

  function notifySelect(element: Element, shiftKey: boolean) {
    callbacks.onSelect(element, {
      shiftKey,
      selectedElements: [...selectedElements],
    });
  }

  function shouldShowDimensionLabel(): boolean {
    return !selectionLabelHidden && selectedElements.length <= 1;
  }

  function updateAllSelectionBoxes() {
    const hasElements = selectedElements.length > 0 && selectedElement;
    const hasDraws = selectedDrawPaths.length > 0;
    if (drawingSvg.childElementCount > 0) {
      syncDrawingPathAppearance();
    }
    if (!hasElements && !hasDraws) return;

    let poolIndex = 0;

    if (hasElements) {
      for (let i = 0; i < selectedElements.length; i++) {
        const el = selectedElements[i];
        const rect = el.getBoundingClientRect();
        const color = selectionColorForElement(el);
        if (el === selectedElement) {
          const isNewElement = el !== lastSelectedElement;
          positionColoredBox(selection, rect, "solid", SELECTION_FILL_ALPHA, color, isNewElement);
        } else if (poolIndex < multiSelectPool.length) {
          positionColoredBox(multiSelectPool[poolIndex++], rect, "solid", SELECTION_FILL_ALPHA, color);
        }
      }
      lastSelectedElement = selectedElement;
    } else {
      selection.style.display = "none";
      hideMultiSelectBoxes();
    }

    for (; poolIndex < multiSelectPool.length; poolIndex++) {
      multiSelectPool[poolIndex].style.display = "none";
    }

    if (!hasElements && hasDraws) {
      selectionLabel.style.display = "none";
      selection.style.pointerEvents = "none";
      selection.style.cursor = "";
      parentIndicator.style.display = "none";
      hidePinLines();
      hideHandles();
    }
  }

  function refreshSelectionVisuals() {
    if (commentDraftActive && (selectedElements.length > 0 || selectedDrawPaths.length > 0)) {
      updateCommentDraftOutlines();
      return;
    }
    if (selectedElements.length > 0 && selectedElement) {
      showSelection();
      return;
    }
    if (selectedDrawPaths.length > 0) {
      updateAllSelectionBoxes();
      return;
    }
    if (drawingSvg.childElementCount > 0) {
      syncDrawingPathAppearance();
    }
    hideSelection();
  }

  function applyDimensionChromeLayout(
    labelEl: HTMLElement,
    rect: DOMRect,
    text: string,
    color: string,
    layout?: SelectionChromeLayout | null,
  ) {
    if (!text) {
      labelEl.style.display = "none";
      return;
    }

    labelEl.textContent = text;
    labelEl.style.background = color;

    const chrome = layout ?? computeSelectionChromeLayout(
      rect,
      { width: window.innerWidth, height: window.innerHeight },
      measureDimensionLabelWidth(text),
    );
    labelEl.style.top = `${chrome.dimension.top}px`;
    labelEl.style.left = `${chrome.dimension.left}px`;
    labelEl.style.transform = chrome.dimension.transform;
    labelEl.style.display = "";
  }

  function positionSelectionLabel(labelEl: HTMLElement, rect: DOMRect, text: string, color: string) {
    applyDimensionChromeLayout(labelEl, rect, text, color, syncedChromeLayout);
  }

  function setChromeLayout(layout: SelectionChromeLayout | null) {
    syncedChromeLayout = layout;
    if (!selectedElement || !shouldShowDimensionLabel()) return;
    const rect = selectedElement.getBoundingClientRect();
    applyDimensionChromeLayout(
      selectionLabel,
      rect,
      formatLabel(selectedElement),
      selectionColorForElement(selectedElement),
      layout,
    );
  }

  function positionBox(box: HTMLElement, rect: DOMRect, borderStyle: string, bgAlpha: string) {
    box.style.top = `${rect.top}px`;
    box.style.left = `${rect.left}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.style.border = `1px ${borderStyle} ${PICKER_OUTLINE_COLOR}`;
    box.style.background = `rgba(13, 153, 255, ${bgAlpha})`;
    box.style.display = "";
  }

  let lastPointer = { x: 0, y: 0 };

  function hideHoverTitle() {
    label.style.display = "none";
  }

  function updateHoverTitle(el: Element) {
    if (commentMode || drawMode || suspended || marqueeDrag?.dragging || drawDrag?.dragging) {
      hideHoverTitle();
      return;
    }
    if (selectedElements.includes(el)) {
      hideHoverTitle();
      return;
    }

    const title = getElementTitle(el);
    if (!title) {
      hideHoverTitle();
      return;
    }

    label.textContent = title;
    label.style.background = PICKER_OUTLINE_COLOR;
    label.style.top = `${lastPointer.y + HOVER_TITLE_OFFSET_Y}px`;
    label.style.left = `${lastPointer.x + HOVER_TITLE_OFFSET_X}px`;
    label.style.transform = "none";
    label.style.display = "";
  }

  function updateHighlight(el: Element) {
    const rect = el.getBoundingClientRect();
    if (highlight.style.display === "none" && selectedElement) {
      const fromRect = selectedElement.getBoundingClientRect();
      positionBox(highlight, fromRect, "solid", "0");
      highlight.offsetHeight; // force reflow to ensure CSS transition runs
    }
    positionBox(highlight, rect, "solid", "0");
    updateHoverTitle(el);
  }

  function showSelection() {
    if (!active || !selectedElement || selectedElements.length === 0) return;
    // Don't show selection during canvas reorder drag
    if (reorderDragActive) return;

    if (commentDraftActive) {
      updateCommentDraftOutlines();
      selectionLabel.style.display = "none";
      selection.style.pointerEvents = "none";
      hideHandles();
      parentIndicator.style.display = "none";
      hidePinLines();
      return;
    }

    updateAllSelectionBoxes();
    const rect = selectedElement.getBoundingClientRect();
    lastSelRect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };

    // When suspended (e.g. text editing), only update the border position — no handles, badge, or indicators
    if (suspended) {
      selectionLabel.style.display = "none";
      selection.style.pointerEvents = "none";
      return;
    }

    if (shouldShowDimensionLabel()) {
      positionSelectionLabel(
        selectionLabel,
        rect,
        formatLabel(selectedElement),
        selectionColorForElement(selectedElement),
      );
    } else {
      selectionLabel.style.display = "none";
    }

    if (!propertyEditMode) {
      selection.style.pointerEvents = "none";
      selection.style.cursor = "";
      hideHandles();
      parentIndicator.style.display = "none";
      hidePinLines();
      return;
    }

    positionHandles(rect);
    updateSelectionCursor();

    // Show dotted parent indicator
    const parent = selectedElement.parentElement;
    if (parent && parent !== document.body && parent !== document.documentElement) {
      const pr = parent.getBoundingClientRect();
      parentIndicator.style.cssText = `
        position:fixed;display:block;pointer-events:none;z-index:2147483644;
        border:1px dotted #0D99FF;background:none;
        top:${pr.top}px;left:${pr.left}px;width:${pr.width}px;height:${pr.height}px;
      `;

      // Show dashed pin lines for absolute/fixed elements
      const authored = detectAuthoredPositionProps(selectedElement);
      cachedPinState = authored;
      if (authored.top || authored.right || authored.bottom || authored.left) {
        showPinLines(rect, pr, authored);
      } else {
        hidePinLines();
      }
    } else {
      parentIndicator.style.display = "none";
      cachedPinState = null;
      hidePinLines();
    }

    // Keep scope highlights in sync with layout changes (resize, property edits)
    refreshScopeHighlights();
  }

  // Lightweight position-only update for scroll/resize tracking
  function trackSelection() {
    if (reorderDrag?.active) return;
    if ((!selectedElement || selectedElements.length === 0) && selectedDrawPaths.length === 0) return;
    if (selectedDrawPaths.length > 0 && (!selectedElement || selectedElements.length === 0)) {
      if (commentDraftActive) {
        updateCommentDraftOutlines();
      } else {
        updateAllSelectionBoxes();
      }
      return;
    }
    if (!selectedElement || selectedElements.length === 0) return;
    const rect = selectedElement.getBoundingClientRect();
    const primaryMoved = !(
      rect.top === lastSelRect.top &&
      rect.left === lastSelRect.left &&
      rect.width === lastSelRect.width &&
      rect.height === lastSelRect.height
    );

    if (commentDraftActive) {
      updateCommentDraftOutlines();
      lastSelRect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
      return;
    }

    updateAllSelectionBoxes();
    lastSelRect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };

    if (suspended) return;

    if (shouldShowDimensionLabel()) {
      positionSelectionLabel(
        selectionLabel,
        rect,
        formatLabel(selectedElement),
        selectionColorForElement(selectedElement),
      );
    } else {
      selectionLabel.style.display = "none";
    }

    if (!primaryMoved && selectedElements.length === 1 && selectedDrawPaths.length === 0) return;

    if (!propertyEditMode) return;

    positionHandles(rect);

    // Update parent indicator + pin lines
    const parent = selectedElement.parentElement;
    if (parent && parent !== document.body && parent !== document.documentElement && parentIndicator.style.display !== "none") {
      const pr = parent.getBoundingClientRect();
      parentIndicator.style.top = `${pr.top}px`;
      parentIndicator.style.left = `${pr.left}px`;
      parentIndicator.style.width = `${pr.width}px`;
      parentIndicator.style.height = `${pr.height}px`;

      const authored = detectAuthoredPositionProps(selectedElement);
      if (authored.top || authored.right || authored.bottom || authored.left) {
        showPinLines(rect, pr, authored);
      }
    }
  }

  function formatLabel(el: Element): string {
    const rect = el.getBoundingClientRect();
    return formatSelectionLabel(rect.width, rect.height);
  }

  function hideHighlight() {
    highlight.style.display = "none";
    hideHoverTitle();
    hideSpacing();
    hideSiblingOutlines();
  }

  function hideSelection() {
    selection.style.display = "none";
    selectionLabel.style.display = "none";
    selection.style.pointerEvents = "none";
    selection.style.cursor = "";
    hideMultiSelectBoxes();
    parentIndicator.style.display = "none";
    hidePinLines();
    cachedPinState = null;
    repositionAxes = null;
    hideHandles();
    lastSelectedElement = null;
    if (drawingSvg.childElementCount > 0) {
      syncDrawingPathAppearance();
    }
  }

  function clearDrawSelection() {
    if (selectedDrawPaths.length === 0) return;
    selectedDrawPaths = [];
    notifyDrawSelectionChange();
    refreshSelectionVisuals();
  }

  function clearElementSelection() {
    if (commentDraftActive) hideCommentDraftOutlines();
    commentDraftActive = false;
    selectedElement = null;
    selectedElements = [];
    syncedChromeLayout = null;
    propertyEditMode = false;
    selectionLabelHidden = false;
    elementStack = [];
    stackIndex = -1;
    hideSelection(); // also hides handles
    hideScopeHighlights();
  }

  // Debounce multiple events into a single rAF update
  function scheduleTrack() {
    if (trackingRaf !== null) return;
    trackingRaf = requestAnimationFrame(() => {
      trackingRaf = null;
      syncDrawingLayerTransform();
      trackSelection();
    });
  }

  function handleScroll() {
    syncDrawingLayerTransform();
    scheduleTrack();
    refreshScopeHighlights();
    if (hoveredElement) {
      hoveredElement = null;
      hideHighlight();
    }
  }

  // Keep selection box in sync on scroll/resize
  function startTracking() {
    document.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    window.addEventListener("resize", scheduleTrack, { passive: true });
    resizeObserver = new ResizeObserver(scheduleTrack);
    observeSelectedElements();
    // Initial position update
    syncDrawingLayerTransform();
    trackSelection();
  }

  function stopTracking() {
    if (trackingRaf !== null) {
      cancelAnimationFrame(trackingRaf);
      trackingRaf = null;
    }
    document.removeEventListener("scroll", handleScroll, true);
    window.removeEventListener("resize", scheduleTrack);
    resizeObserver?.disconnect();
    resizeObserver = null;
  }

  // Filter out our own overlay elements
  function isOverlayElement(el: Element): boolean {
    return !!el.closest("[data-retune-host]") || !!el.closest("[data-retune-drag-ghost]");
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

  let lastAltState = false; // track Alt key to show/hide spacing on key change

  function applyHover(el: Element, altKey = false) {
    hoveredElement = el;
    lastAltState = altKey;

    if (selectedElements.includes(el)) {
      hideHighlight();
      hideSpacing();
      hideSiblingOutlines();
      selectionLabelHidden = false;
      showSelection();
    } else {
      updateHighlight(el);
      if (selectedElement) {
        if (el.contains(selectedElement)) {
          // Hovered element is a parent/ancestor
          if (altKey) showParentSpacing(selectedElement.getBoundingClientRect(), el);
          else hideSpacing();
          showSiblingOutlines(el, selectedElement);
        } else {
          // Sibling or unrelated — show children outlines for the hovered element
          if (altKey) showSpacing(selectedElement.getBoundingClientRect(), el.getBoundingClientRect());
          else hideSpacing();
          showChildOutlines(el);
        }
      } else {
        // No selection — show children outlines for the hovered element
        showChildOutlines(el);
      }
    }

    callbacks.onHover(el, el.getBoundingClientRect());
  }

  function handleMouseMove(e: MouseEvent) {
    lastPointer = { x: e.clientX, y: e.clientY };
    if (!active || suspended || commentMode || drawMode || repositionDrag || resizeDrag || reorderDrag) return;
    // Skip if cursor is over overlay UI (toolbar, panel) inside the shadow root.
    // elementFromPoint on a ShadowRoot falls through to page elements when no
    // shadow element is at the point, so we verify the hit actually belongs to
    // our shadow tree via getRootNode().
    const hoverShadowHit = shadowRoot.elementFromPoint(e.clientX, e.clientY);
    if (hoverShadowHit && hoverShadowHit.getRootNode() === shadowRoot) {
      if (!isPickerChromeElement(hoverShadowHit)) {
        // Cursor is over Retune UI (toolbar, panel) — clear hover highlight
        if (hoveredElement) {
          hoveredElement = null;
          hideHighlight();
        }
        return;
      }
    }
    const el = pageElementAtPoint(e.clientX, e.clientY);
    if (!el) {
      if (hoveredElement) {
        hoveredElement = null;
        hideHighlight();
      }
      return;
    }
    if (el === hoveredElement) {
      if (!selectedElements.includes(el)) {
        updateHoverTitle(el);
      }
      return;
    }

    // If moving to an ancestor of the current hover target, debounce
    // to avoid flashing parents when crossing gaps between siblings
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }

    if (hoveredElement && el.contains(hoveredElement)) {
      hoverTimer = setTimeout(() => {
        hoverTimer = null;
        // Re-check — cursor may have moved to a sibling by now
        const current = pageElementAtPoint(e.clientX, e.clientY);
        if (current === el) applyHover(el, e.altKey);
      }, 50);
    } else {
      applyHover(el, e.altKey);
    }
  }

  /** Topmost page element at a point, excluding Retune overlay nodes. */
  function pageElementAtPoint(x: number, y: number): Element | null {
    return buildElementStack(x, y)[0] ?? null;
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

  function isPickerChromeElement(el: Element): boolean {
    if (el === captureLayer) return true;
    if (el === highlight || el === label || el === parentIndicator) return true;
    if (el === selection || el === selectionLabel) {
      return getComputedStyle(el).pointerEvents === "none";
    }
    return multiSelectPool.includes(el as HTMLDivElement)
      || siblingOutlinePool.includes(el as HTMLDivElement);
  }

  function isRetuneOverlayEvent(e: Event): boolean {
    const { clientX, clientY } = e as MouseEvent;
    const shadowHit = shadowRoot.elementFromPoint(clientX, clientY);
    if (!shadowHit || shadowHit.getRootNode() !== shadowRoot) return false;
    if (isPickerChromeElement(shadowHit)) return false;
    return getComputedStyle(shadowHit).pointerEvents !== "none";
  }

  function isNativeInteractive(el: Element | null): boolean {
    return !!el?.closest("button,a,input,select,textarea,label,summary,[role='button'],[role='link']");
  }

  /** Block pointer/mouse down from reaching page elements (prevents :active and focus). */
  function blockPagePointerDown(e: Event) {
    if (!active) return;
    if (isRetuneOverlayEvent(e)) return;
    if (suspended) {
      // Keep native pointer defaults so contenteditable can place the caret,
      // but stop app-level press handlers from firing while text edit owns input.
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function blurPageFocus() {
    const focused = document.activeElement;
    if (
      focused instanceof HTMLElement
      && focused !== document.body
      && focused !== document.documentElement
      && !focused.closest("[data-retune-host]")
      && !focused.hasAttribute("data-retune-host")
    ) {
      focused.blur();
    }
  }

  let marqueeDrag: {
    startX: number;
    startY: number;
    dragging: boolean;
    mode: "add" | "remove" | "replace";
    pointerId: number;
    startElement: Element | null;
  } | null = null;
  let marqueeDragJustEnded = false;
  let drawDrag: {
    pointerId: number;
    points: DrawPoint[];
    path: SVGPathElement;
    color: string;
    appendToSelection: boolean;
    dragging: boolean;
  } | null = null;
  let selectedDrawPaths: SVGPathElement[] = [];

  function fillForColor(color: string, alpha = DRAW_FILL_ALPHA): string {
    const { r, g, b } = hexToRgb(color);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function getDrawingBaseColor(path: SVGPathElement): string {
    return path.getAttribute(DRAW_COLOR_ATTR) ?? path.getAttribute("stroke") ?? SELECTION_COLORS[0];
  }

  /** Selected drawings get a palette fill; unselected drawings stay stroke-only. */
  function syncDrawingPathAppearance() {
    const selectedSet = new Set(selectedDrawPaths);
    const paths = Array.from(drawingSvg.querySelectorAll("path"));
    if (paths.length === 0) return;
    const activeColors = new Set<string>();

    for (const el of selectedElements) {
      activeColors.add(selectionColorForElement(el));
    }

    for (const path of paths) {
      const baseColor = getDrawingBaseColor(path);
      if (!path.hasAttribute(DRAW_COLOR_ATTR)) {
        path.setAttribute(DRAW_COLOR_ATTR, baseColor);
      }

      if (selectedSet.has(path)) {
        let selectedColor = drawingSelectionColors.get(path) ?? baseColor;
        if (activeColors.has(selectedColor)) {
          selectedColor = nextAvailableSelectionColor(activeColors);
          drawingSelectionColors.set(path, selectedColor);
        }
        activeColors.add(selectedColor);
        path.setAttribute("stroke", selectedColor);
        path.setAttribute("fill", fillForColor(selectedColor));
      } else {
        path.setAttribute("stroke", baseColor);
        path.setAttribute("fill", "none");
      }
    }
  }

  function toPagePoint(clientX: number, clientY: number): DrawPoint {
    return { x: clientX + window.scrollX, y: clientY + window.scrollY };
  }

  function syncDrawingLayerTransform() {
    drawingSvg.style.transform = `translate(${-window.scrollX}px, ${-window.scrollY}px)`;
    if (selectedDrawPaths.length > 0 || selectedElements.length > 0) updateAllSelectionBoxes();
  }

  function syncDrawingLayerVisibility() {
    drawingSvg.style.display = drawMode || drawingSvg.childElementCount > 0 ? "block" : "none";
  }

  function removeDrawnPaths() {
    drawingSvg.replaceChildren();
    clearDrawSelection();
    syncDrawingLayerVisibility();
    callbacks.onDrawPathsChange?.([]);
  }

  function notifyDrawPathsChange() {
    callbacks.onDrawPathsChange?.(Array.from(drawingSvg.querySelectorAll("path")));
  }

  function notifyDrawSelectionChange() {
    callbacks.onDrawSelectionChange?.([...selectedDrawPaths]);
  }

  interface PathState {
    d: string;
    stroke: string;
    drawColor: string;
    strokeWidth: string;
    strokeLinecap: string;
    strokeLinejoin: string;
    vectorEffect: string;
    fill: string;
  }
  let undoStack: PathState[][] = [[]];
  let redoStack: PathState[][] = [];

  function getDrawingState(): PathState[] {
    return Array.from(drawingSvg.querySelectorAll("path")).map((path) => ({
      d: path.getAttribute("d") ?? "",
      stroke: path.getAttribute("stroke") ?? "",
      drawColor: getDrawingBaseColor(path),
      strokeWidth: path.getAttribute("stroke-width") ?? "2",
      strokeLinecap: path.getAttribute("stroke-linecap") ?? "round",
      strokeLinejoin: path.getAttribute("stroke-linejoin") ?? "round",
      vectorEffect: path.getAttribute("vector-effect") ?? "non-scaling-stroke",
      fill: path.getAttribute("fill") ?? "none",
    }));
  }

  function restoreDrawingState(state: PathState[]) {
    drawingSvg.replaceChildren();
    for (const p of state) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", p.d);
      path.setAttribute("stroke", p.stroke);
      path.setAttribute("stroke-width", p.strokeWidth);
      path.setAttribute("stroke-linecap", p.strokeLinecap);
      path.setAttribute("stroke-linejoin", p.strokeLinejoin);
      path.setAttribute("vector-effect", p.vectorEffect);
      path.setAttribute("fill", p.fill);
      path.setAttribute(DRAW_COLOR_ATTR, p.drawColor ?? p.stroke);
      drawingSvg.appendChild(path);
    }
    const currentPaths = Array.from(drawingSvg.querySelectorAll("path"));
    selectedDrawPaths = selectedDrawPaths.filter((path) => currentPaths.includes(path));
    syncDrawingLayerVisibility();
    notifyDrawPathsChange();
    notifyDrawSelectionChange();
    refreshSelectionVisuals();
  }

  function pushState() {
    const currentState = getDrawingState();
    const top = undoStack[undoStack.length - 1];
    if (top && JSON.stringify(top) === JSON.stringify(currentState)) {
      return;
    }
    undoStack.push(currentState);
    redoStack = [];
  }

  function undo() {
    if (undoStack.length <= 1) return;
    const current = undoStack.pop()!;
    redoStack.push(current);
    const previous = undoStack[undoStack.length - 1];
    restoreDrawingState(previous);
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack.pop()!;
    undoStack.push(next);
    restoreDrawingState(next);
  }

  function deleteSelectedDrawings() {
    if (selectedDrawPaths.length === 0) return;
    pushState();
    for (const path of selectedDrawPaths) {
      path.remove();
    }
    clearDrawSelection();
    syncDrawingLayerVisibility();
    notifyDrawPathsChange();
  }

  function hitTestDrawPath(clientX: number, clientY: number): SVGPathElement | null {
    const paths = Array.from(drawingSvg.querySelectorAll("path")).reverse();
    if (paths.length === 0) return null;

    for (const path of paths) {
      const rect = path.getBoundingClientRect();
      const pad = SELECTION_CLICK_PAD;
      if (
        clientX < rect.left - pad ||
        clientX > rect.right + pad ||
        clientY < rect.top - pad ||
        clientY > rect.bottom + pad
      ) {
        continue;
      }

      try {
        const matrix = path.getScreenCTM()?.inverse();
        if (!matrix) continue;
        const point = drawingSvg.createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        const localPoint = point.matrixTransform(matrix);
        if (path.isPointInFill(localPoint) || path.isPointInStroke(localPoint)) {
          return path;
        }
      } catch {
        return path;
      }
    }

    return null;
  }

  function isPointInsideDrawSelectionBounds(x: number, y: number, pad = SELECTION_CLICK_PAD): boolean {
    for (const path of selectedDrawPaths) {
      const rect = path.getBoundingClientRect();
      if (x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad) {
        return true;
      }
    }
    return false;
  }

  function selectDrawPaths(paths: SVGPathElement[]) {
    selectedDrawPaths = paths.slice(0, MULTI_SELECT_POOL_SIZE + 1);
    hideHighlight();
    hoveredElement = null;
    blurPageFocus();
    notifyDrawSelectionChange();
    refreshSelectionVisuals();
  }

  function handleDrawPathClick(path: SVGPathElement, e: MouseEvent) {
    if (e.altKey) {
      const existingIndex = selectedDrawPaths.indexOf(path);
      if (existingIndex < 0) return;
      selectedDrawPaths = selectedDrawPaths.filter((_, i) => i !== existingIndex);
      notifyDrawSelectionChange();
      refreshSelectionVisuals();
      return;
    }

    if (e.shiftKey) {
      const existingIndex = selectedDrawPaths.indexOf(path);
      if (existingIndex >= 0) {
        selectedDrawPaths = selectedDrawPaths.filter((_, i) => i !== existingIndex);
      } else if (selectedDrawPaths.length < MULTI_SELECT_POOL_SIZE + 1) {
        selectedDrawPaths = [...selectedDrawPaths, path];
      }

      hideHighlight();
      hoveredElement = null;
      blurPageFocus();
      notifyDrawSelectionChange();
      refreshSelectionVisuals();
      return;
    }

    selectDrawPaths([path]);
  }

  function startDrawPath(e: PointerEvent) {
    if (!active || !drawMode || suspended || commentDraftActive) return;
    if (isRetuneOverlayEvent(e)) return;
    if (callbacks.shouldBlockClick?.()) return;
    if (!e.composedPath().includes(captureLayer)) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (!e.shiftKey) {
      clearDrawSelection();
      syncDrawingPathAppearance();
    }

    hideHighlight();
    hideHoverTitle();
    blurPageFocus();

    const color = nextDrawingColor();
    const point = toPagePoint(e.clientX, e.clientY);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", buildOpenPath([point]));
    path.setAttribute("fill", "none");
    path.setAttribute(DRAW_COLOR_ATTR, color);
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    syncDrawingLayerTransform();
    drawingSvg.style.display = "block";
    drawingSvg.appendChild(path);
    drawDrag = {
      pointerId: e.pointerId,
      points: [point],
      path,
      color,
      appendToSelection: e.shiftKey,
      dragging: false,
    };
  }

  function updateDrawPath(e: PointerEvent) {
    const drag = drawDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const point = toPagePoint(e.clientX, e.clientY);
    const last = drag.points[drag.points.length - 1];
    const dx = point.x - last.x;
    const dy = point.y - last.y;
    if (Math.hypot(dx, dy) < DRAW_DRAG_THRESHOLD) return;

    drag.dragging = true;
    drag.points.push(point);
    drag.path.setAttribute("d", buildOpenPath(drag.points));
  }

  function endDrawPath(e: PointerEvent) {
    const drag = drawDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    drawDrag = null;

    if (!drag.dragging || drag.points.length < DRAW_MIN_POINTS) {
      drag.path.remove();
      if (drawingSvg.childElementCount === 0) drawingSvg.style.display = "none";
      notifyDrawPathsChange();
      return;
    }

    const finalPoints = finalizeDrawPoints(drag.points);
    drag.path.setAttribute("d", buildClosedPath(finalPoints));
    drag.path.setAttribute("fill", "none");
    if (drag.appendToSelection && selectedDrawPaths.length < MULTI_SELECT_POOL_SIZE + 1) {
      selectedDrawPaths = [...selectedDrawPaths, drag.path];
      notifyDrawSelectionChange();
    } else if (!drag.appendToSelection) {
      selectedDrawPaths = [drag.path];
      notifyDrawSelectionChange();
    }
    syncDrawingPathAppearance();
    syncDrawingLayerVisibility();
    notifyDrawPathsChange();
    pushState();
  }

  function hideMarqueeBox() {
    marqueeBox.style.display = "none";
  }

  function updateMarqueeBox(x1: number, y1: number, x2: number, y2: number) {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    marqueeBox.style.display = "block";
    marqueeBox.style.left = `${left}px`;
    marqueeBox.style.top = `${top}px`;
    marqueeBox.style.width = `${Math.abs(x2 - x1)}px`;
    marqueeBox.style.height = `${Math.abs(y2 - y1)}px`;
  }

  function getElementsInMarquee(
    left: number,
    top: number,
    width: number,
    height: number,
    excludedElement: Element | null,
  ): Element[] {
    if (width < 1 || height < 1) return [];

    const seen = new Set<Element>();
    const result: Element[] = [];
    const right = left + width;
    const bottom = top + height;

    for (let x = left + MARQUEE_SAMPLE_STEP / 2; x < right; x += MARQUEE_SAMPLE_STEP) {
      for (let y = top + MARQUEE_SAMPLE_STEP / 2; y < bottom; y += MARQUEE_SAMPLE_STEP) {
        const el = pageElementAtPoint(x, y);
        if (!el || el === excludedElement || seen.has(el)) continue;
        seen.add(el);
        result.push(el);
      }
    }

    return result;
  }

  function applyMarqueeSelection(hits: Element[], mode: "add" | "remove" | "replace") {
    if (mode === "replace") {
      if (hits.length === 0) {
        if (selectedElements.length > 0) {
          deselect();
        }
        return;
      }

      const limited = hits.slice(0, MULTI_SELECT_POOL_SIZE + 1);
      selectedElements = limited;
      selectedElement = limited[limited.length - 1];
      shiftHeldForSelection = false;
      selectionLabelHidden = false;
      observeSelectedElements();
      showSelection();
      hideHighlight();
      hoveredElement = null;
      blurPageFocus();
      notifySelect(selectedElement!, false);
      return;
    }

    if (hits.length === 0) return;

    if (mode === "add") {
      const previousPrimary = selectedElement;
      const merged = selectedElements.length > 0 ? [...selectedElements] : [];
      for (const el of hits) {
        if (!merged.includes(el) && merged.length < MULTI_SELECT_POOL_SIZE + 1) {
          merged.push(el);
        }
      }
      if (merged.length === 0) return;

      selectedElements = merged;
      selectedElement = previousPrimary && merged.includes(previousPrimary)
        ? previousPrimary
        : merged[merged.length - 1];
      shiftHeldForSelection = true;
    } else {
      if (selectedElements.length === 0) return;
      const toRemove = new Set(hits);
      const next = selectedElements.filter((el) => !toRemove.has(el));
      if (next.length === selectedElements.length) return;
      if (next.length === 0) {
        const fallback = selectedElement ?? selectedElements[0];
        clearElementSelection();
        hideHighlight();
        hoveredElement = null;
        blurPageFocus();
        if (fallback) {
          callbacks.onSelect(fallback, { shiftKey: false, selectedElements: [] });
        }
        refreshSelectionVisuals();
        return;
      }
      selectedElements = next;
      if (!selectedElement || !next.includes(selectedElement)) {
        selectedElement = next[next.length - 1];
      }
    }

    selectionLabelHidden = false;
    observeSelectedElements();
    showSelection();
    hideHighlight();
    hoveredElement = null;
    blurPageFocus();
    notifySelect(selectedElement!, mode === "add");
  }

  function endMarqueeDrag(e: PointerEvent) {
    const drag = marqueeDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;

    marqueeDrag = null;
    hideMarqueeBox();

    if (!drag.dragging) return;

    const left = Math.min(e.clientX, drag.startX);
    const top = Math.min(e.clientY, drag.startY);
    const width = Math.abs(e.clientX - drag.startX);
    const height = Math.abs(e.clientY - drag.startY);
    if (width <= MARQUEE_MIN_SIZE || height <= MARQUEE_MIN_SIZE) return;

    const hits = getElementsInMarquee(left, top, width, height, drag.startElement);
    applyMarqueeSelection(hits, drag.mode);
    marqueeDragJustEnded = true;
    setTimeout(() => { marqueeDragJustEnded = false; }, 50);
  }

  function handleMarqueePointerMove(e: PointerEvent) {
    if (!marqueeDrag || e.pointerId !== marqueeDrag.pointerId) return;

    const dx = Math.abs(e.clientX - marqueeDrag.startX);
    const dy = Math.abs(e.clientY - marqueeDrag.startY);
    if (!marqueeDrag.dragging && (dx > MARQUEE_DRAG_THRESHOLD || dy > MARQUEE_DRAG_THRESHOLD)) {
      marqueeDrag.dragging = true;
    }
    if (marqueeDrag.dragging) {
      updateMarqueeBox(marqueeDrag.startX, marqueeDrag.startY, e.clientX, e.clientY);
    }
  }

  function handleMarqueePointerDown(e: PointerEvent) {
    if (!active || commentMode || drawMode || suspended) return;
    if (commentDraftActive) return;
    if (propertyEditMode) return;
    if (e.shiftKey || e.altKey) return;
    if (isRetuneOverlayEvent(e)) return;
    if (callbacks.shouldBlockClick?.()) return;
    // Document listeners see a Shadow DOM-retargeted host as e.target, so use
    // the composed path to distinguish the page capture layer from Retune UI.
    if (!e.composedPath().includes(captureLayer)) return;

    marqueeDrag = {
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
      mode: e.altKey ? "remove" : e.shiftKey ? "add" : "replace",
      pointerId: e.pointerId,
      startElement: pageElementAtPoint(e.clientX, e.clientY),
    };
  }

  function handleClick(e: MouseEvent) {
    if (!active) return;

    if (drawMode && !commentDraftActive) {
      if (isRetuneOverlayEvent(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }

    if (marqueeDragJustEnded) {
      marqueeDragJustEnded = false;
      return;
    }

    if (isRetuneOverlayEvent(e)) return;

    if (suspended) {
      const target = e.target instanceof Element ? e.target : null;
      const insideEditedElement = !!(selectedElement && target && selectedElement.contains(target));
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (!insideEditedElement || isNativeInteractive(target)) {
        e.preventDefault();
      }
      return;
    }

    // Block page element clicks if popover has unsaved changes (after overlay checks)
    if (callbacks.shouldBlockClick?.()) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const { clientX: x, clientY: y } = e;

    // Second click of a double-click must not cycle the stack — dblclick will sync selection
    const sameSpot =
      Math.abs(x - lastClickPos.x) <= CLICK_RADIUS &&
      Math.abs(y - lastClickPos.y) <= CLICK_RADIUS &&
      elementStack.length > 1;
    if (sameSpot && e.detail >= 2) return;

    performSelectionClickAtPoint(x, y, { shiftKey: e.shiftKey, altKey: e.altKey });
  }

  function applySelectionClickResult(result: SelectionClickResult | null, clicked: Element) {
    if (!result) return;

    if (result.kind === "noop") {
      showSelection();
      hideHighlight();
      hoveredElement = null;
      blurPageFocus();
      return;
    }

    if (result.kind === "toggle-off" && result.selected.length === 0) {
      clearElementSelection();
      hideHighlight();
      hoveredElement = null;
      blurPageFocus();
      callbacks.onSelect(clicked, {
        shiftKey: result.shiftKey,
        altKey: result.altKey,
        selectedElements: [],
      });
      refreshSelectionVisuals();
      return;
    }

    selectedElements = result.selected;
    selectedElement = result.primary;
    shiftHeldForSelection = result.kind === "add"
      || (result.kind === "toggle-off" && result.shiftKey);

    selectionLabelHidden = false;
    observeSelectedElements();
    showSelection();
    hideHighlight();
    hoveredElement = null;
    blurPageFocus();

    const notifyShiftKey = result.kind === "add"
      || (result.kind === "toggle-off" && result.shiftKey);

    if (selectedElement) {
      notifySelect(selectedElement, notifyShiftKey);
    }
  }

  function handleDblClick(e: MouseEvent) {
    if (!active || !selectedElement) return;
    if (isRetuneOverlayEvent(e)) return;
    if (suspended) return;
    e.preventDefault();
    e.stopPropagation();

    // Cancel any pending click-through from reorder single-click
    if (reorderClickTimer) {
      clearTimeout(reorderClickTimer);
      reorderClickTimer = null;
    }

    const deepest = pageElementAtPoint(e.clientX, e.clientY);
    const target = deepest || selectedElement;
    if (target !== selectedElement) {
      selectElement(target);
    }
    callbacks.onDoubleClick?.(target);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!active) return;

    const target = e.target as HTMLElement;
    const isInput =
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable);

    if (!isInput) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedDrawPaths.length > 0) {
        const path = e.composedPath();
        const target = path[0] as HTMLElement | undefined;
        if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        deleteSelectedDrawings();
        return;
      }
    }

    if (e.key === "Escape") {
      if (shadowRoot.querySelector(".retune-floating-dialog")) return;
      if (shadowRoot.querySelector(".retune-comment-popover")) return;
      if (commentMode) return; // In comment mode, Escape exits comment mode (handled by Retune.tsx)
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (selectedDrawPaths.length > 0) {
        if (e.shiftKey && !shiftHeldForSelection) {
          clearDrawSelection();
        } else {
          deselectMostRecent();
        }
      } else if (selectedElements.length > 0 || selectedElement) {
        if (e.shiftKey && !shiftHeldForSelection) {
          deselect();
        } else {
          deselectMostRecent();
        }
      }
      return;
    }
    // Alt/Option pressed — show spacing if hovering
    if (e.key === "Alt" && hoveredElement && selectedElement) {
      applyHover(hoveredElement, true);
    }
    // Shift surfaces focus rings on the last focused page element — clear it
    if (e.key === "Shift") {
      blurPageFocus();
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (!active) return;
    if (e.key === "Shift") {
      shiftHeldForSelection = false;
    }
    // Alt/Option released — hide spacing
    if (e.key === "Alt" && hoveredElement && selectedElement) {
      applyHover(hoveredElement, false);
    }
  }

  // Global cursor + selection overrides when Retune is active
  const cursorStyle = document.createElement("style");
  cursorStyle.setAttribute("data-retune-cursor", "");

  // Select-mode cursor — matches toolbar IconCursor1, sized to the comment cursor footprint (~17px in 32px canvas)
  const SELECT_CURSOR_SCALE = 17 / 24;
  const selectCursorHotspotX = Math.round(5 + 3.45 * SELECT_CURSOR_SCALE);
  const selectCursorHotspotY = Math.round(5 + 3.93 * SELECT_CURSOR_SCALE);
  const selectCursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none"><defs><filter id="s" x="2" y="2" width="23" height="23" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="a"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="b"/><feOffset dy="1"/><feGaussianBlur stdDeviation="1.5"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.35 0"/><feBlend in2="a" result="c"/><feBlend in="SourceGraphic" in2="c" result="d"/></filter></defs><g filter="url(#s)" transform="translate(5 5) scale(${SELECT_CURSOR_SCALE})"><path d="M3.45158 4.72779L9.06387 20.5551C9.36964 21.4174 10.577 21.4503 10.9293 20.6059L13.6196 14.157C13.721 13.9138 13.9143 13.7205 14.1575 13.6191L20.6064 10.9288C21.4508 10.5765 21.4179 9.36915 20.5556 9.06338L4.72828 3.45109C3.93501 3.1698 3.17029 3.93452 3.45158 4.72779Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/></g></svg>`;
  const selectCursorB64 = typeof btoa === "function" ? btoa(selectCursorSvg) : "";
  const selectCursorUrl = `url("data:image/svg+xml;base64,${selectCursorB64}") ${selectCursorHotspotX} ${selectCursorHotspotY}, default`;

  const ACTIVE_PAGE_STYLES = `
    * { cursor: ${selectCursorUrl} !important; user-select: none !important; -webkit-user-select: none !important; }
    *:focus, *:focus-visible { outline: none !important; }
    html[data-retune-active] *:active {
      transform: none !important;
    }
  `;
  const DRAW_PAGE_STYLES = `
    * { cursor: crosshair !important; user-select: none !important; -webkit-user-select: none !important; }
    *:focus, *:focus-visible { outline: none !important; }
    html[data-retune-active] *:active {
      transform: none !important;
    }
  `;
  const SUSPENDED_PAGE_STYLES = `
    * { user-select: none !important; -webkit-user-select: none !important; }
    html[data-retune-suspended] *:active {
      transform: none !important;
    }
    [contenteditable="true"] {
      user-select: text !important;
      -webkit-user-select: text !important;
      cursor: text !important;
    }
  `;

  function activate() {
    if (active) return;
    active = true;
    document.documentElement.setAttribute("data-retune-active", "");
    cursorStyle.textContent = ACTIVE_PAGE_STYLES;
    document.head.appendChild(cursorStyle);
    captureLayer.style.display = "block";
    document.addEventListener("pointerdown", startDrawPath, true);
    document.addEventListener("pointermove", updateDrawPath, true);
    document.addEventListener("pointerup", endDrawPath, true);
    document.addEventListener("pointercancel", endDrawPath, true);
    // Marquee must register before blockPagePointerDown — block stops propagation
    // in the document capture phase, so capture-layer-only listeners never run.
    document.addEventListener("pointerdown", handleMarqueePointerDown, true);
    document.addEventListener("pointermove", handleMarqueePointerMove, true);
    document.addEventListener("pointerup", endMarqueeDrag, true);
    document.addEventListener("pointercancel", endMarqueeDrag, true);
    captureLayer.addEventListener("pointerdown", blockPagePointerDown, true);
    captureLayer.addEventListener("mousedown", blockPagePointerDown, true);
    document.addEventListener("pointerdown", blockPagePointerDown, true);
    document.addEventListener("mousedown", blockPagePointerDown, true);
    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("dblclick", handleDblClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keyup", handleKeyUp, true);
    startTracking();
  }

  function deactivate() {
    if (!active) return;
    active = false;
    suspended = false;
    propertyEditMode = false;
    shiftHeldForSelection = false;
    marqueeDrag = null;
    marqueeDragJustEnded = false;
    drawMode = false;
    drawDrag = null;
    hideMarqueeBox();
    removeDrawnPaths();
    document.documentElement.removeAttribute("data-retune-active");
    document.documentElement.removeAttribute("data-retune-suspended");
    cursorStyle.textContent = "";
    cursorStyle.remove();
    captureLayer.style.display = "none";
    document.removeEventListener("pointerdown", startDrawPath, true);
    document.removeEventListener("pointermove", updateDrawPath, true);
    document.removeEventListener("pointerup", endDrawPath, true);
    document.removeEventListener("pointercancel", endDrawPath, true);
    document.removeEventListener("pointerdown", handleMarqueePointerDown, true);
    document.removeEventListener("pointermove", handleMarqueePointerMove, true);
    document.removeEventListener("pointerup", endMarqueeDrag, true);
    document.removeEventListener("pointercancel", endMarqueeDrag, true);
    captureLayer.removeEventListener("pointerdown", blockPagePointerDown, true);
    captureLayer.removeEventListener("mousedown", blockPagePointerDown, true);
    document.removeEventListener("pointerdown", blockPagePointerDown, true);
    document.removeEventListener("mousedown", blockPagePointerDown, true);
    hoveredElement = null;
    selectedElement = null;
    lastSelectedElement = null;
    selectedElements = [];
    syncedChromeLayout = null;
    selectionLabelHidden = false;
    elementStack = [];
    stackIndex = -1;
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    hideHighlight();
    hideSelection();
    hideScopeHighlights();
    stopTracking();
    document.removeEventListener("mousemove", handleMouseMove, true);
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("dblclick", handleDblClick, true);
    document.removeEventListener("keydown", handleKeyDown, true);
    document.removeEventListener("keyup", handleKeyUp, true);
  }

  function clearSelection() {
    clearElementSelection();
    clearDrawSelection();
  }

  function deselect() {
    clearSelection();
    hideHighlight();
    hoveredElement = null;
    callbacks.onDeselect?.();
  }

  /** Remove the most recently shift-selected element; clear all when only one remains. */
  function deselectMostRecent() {
    if (selectedDrawPaths.length > 0) {
      if (selectedDrawPaths.length <= 1) {
        clearDrawSelection();
        return;
      }
      selectedDrawPaths = selectedDrawPaths.slice(0, -1);
      notifyDrawSelectionChange();
      refreshSelectionVisuals();
      return;
    }

    if (selectedElements.length === 0 && !selectedElement) return;
    if (selectedElements.length <= 1) {
      deselect();
      return;
    }
    selectedElements = selectedElements.slice(0, -1);
    selectedElement = selectedElements[selectedElements.length - 1];
    selectionLabelHidden = false;
    observeSelectedElements();
    showSelection();
    blurPageFocus();
    notifySelect(selectedElement!, false);
  }

  function destroy() {
    deactivate();
    marqueeBox.remove();
    drawingSvg.remove();
    captureLayer.remove();
    highlight.remove();
    label.remove();
    selection.remove();
    selectionLabel.remove();
    for (const box of multiSelectPool) box.remove();
    for (const box of commentDraftPool) box.remove();
    spacingContainer.remove();
    parentIndicator.remove();
    for (const line of Object.values(pinLines)) line.remove();
    for (const g of snapGuidePool) { g.line.remove(); g.label.remove(); }
    for (const pos of ALL_POSITIONS) handleEls[pos].remove();
  }

  /** Programmatically select an element (e.g. from the element tree) */
  function selectElement(el: Element) {
    commentDraftActive = false;
    selectedElement = el;
    selectedElements = [el];
    selectionLabelHidden = false;
    observeSelectedElements();
    showSelection();
    hideHighlight();
    hoveredElement = null;
    notifySelect(el, false);
  }

  /** Programmatically show hover highlight on an element */
  function highlightElement(el: Element | null) {
    if (el) {
      updateHighlight(el);
    } else {
      hideHighlight();
    }
  }

  function suspend() {
    suspended = true;
    document.documentElement.setAttribute("data-retune-suspended", "");
    captureLayer.style.display = "none";
    hideHighlight();
    // Keep selection border visible but hide handles, badge, parent indicator
    selectionLabel.style.display = "none";
    selection.style.pointerEvents = "none";
    selection.style.cursor = "";
    parentIndicator.style.display = "none";
    hidePinLines();
    hideHandles();
    // Allow text selection only on the inline-edited element
    cursorStyle.textContent = SUSPENDED_PAGE_STYLES;
    if (selectedElement) showSelection();
  }
  function resume() {
    suspended = false;
    document.documentElement.removeAttribute("data-retune-suspended");
    cursorStyle.textContent = ACTIVE_PAGE_STYLES;
    captureLayer.style.display = "block";
    if (selectedElement) showSelection();
  }

  /** Update pin lines externally (called by PropertyPanel when pins change) */
  function updatePinLines(authored: { top: boolean; right: boolean; bottom: boolean; left: boolean }) {
    cachedPinState = authored;
    if (!selectedElement) return;
    const rect = selectedElement.getBoundingClientRect();
    const parent = selectedElement.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) return;
    const pr = parent.getBoundingClientRect();
    if (authored.top || authored.right || authored.bottom || authored.left) {
      showPinLines(rect, pr, authored);
    } else {
      hidePinLines();
    }
  }

  // SVG cursor with drop shadow — use base64 to avoid # encoding issues in data URIs
  const commentCursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none"><defs><filter id="s" x="2" y="8" width="23" height="23" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="a"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="b"/><feOffset dy="1"/><feGaussianBlur stdDeviation="1.5"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.35 0"/><feBlend in2="a" result="c"/><feBlend in="SourceGraphic" in2="c" result="d"/></filter></defs><g filter="url(#s)"><path fill-rule="evenodd" clip-rule="evenodd" d="M5 18.5C5 13.8056 8.80558 10 13.5 10C18.1944 10 22 13.8056 22 18.5C22 23.1944 18.1944 27 13.5 27H7.5C6.11929 27 5 25.8807 5 24.5V18.5Z" fill="white"/></g><path fill-rule="evenodd" clip-rule="evenodd" d="M6 18.5C6 14.3579 9.35786 11 13.5 11C17.6421 11 21 14.3579 21 18.5C21 22.6421 17.6421 26 13.5 26H7.5C6.67157 26 6 25.3284 6 24.5V18.5ZM13.5 25H7.5C7.22386 25 7 24.7761 7 24.5V18.5C7 14.9101 9.91015 12 13.5 12C17.0899 12 20 14.9101 20 18.5C20 22.0899 17.0899 25 13.5 25Z" fill="black"/></svg>`;
  const commentCursorB64 = typeof btoa === "function" ? btoa(commentCursorSvg) : "";
  const commentCursorUrl = `url("data:image/svg+xml;base64,${commentCursorB64}") 5 27, pointer`;

  let propertyEditMode = false;
  function setPropertyEditMode(enabled: boolean) {
    propertyEditMode = enabled;
    if (selectedElement) showSelection();
  }

  function setDrawMode(enabled: boolean) {
    drawMode = enabled;
    drawDrag = null;
    if (enabled) {
      hideMarqueeBox();
      hideHighlight();
      hideHoverTitle();
      cursorStyle.textContent = DRAW_PAGE_STYLES;
      syncDrawingLayerTransform();
      syncDrawingPathAppearance();
      syncDrawingLayerVisibility();
    } else {
      if (selectedDrawPaths.length > 0 && selectedElements.length === 0) {
        clearDrawSelection();
      }
      syncDrawingPathAppearance();
      syncDrawingLayerVisibility();
      if (active && !commentMode && !suspended) {
        cursorStyle.textContent = ACTIVE_PAGE_STYLES;
      }
    }
  }

  function clearDrawings() {
    pushState();
    removeDrawnPaths();
  }

  function getSelectedDrawPaths() {
    return [...selectedDrawPaths];
  }

  function setSelectionLabelHidden(hidden: boolean) {
    selectionLabelHidden = hidden;
    if (selectedElement) showSelection();
  }

  /** Show selection fills/outlines without handles, badges, or edit chrome. */
  function showSelectionOutline(elements: Element[], primary?: Element) {
    commentDraftActive = true;
    hideScopeHighlights();
    if (elements.length === 0) {
      selectedElements = [];
      selectedElement = null;
      selectionLabelHidden = true;
      hideCommentDraftOutlines();
      return;
    }
    const seen = new Set<Element>();
    selectedElements = elements.filter((el) => {
      if (seen.has(el)) return false;
      seen.add(el);
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const cs = getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden";
    });
    if (selectedElements.length === 0) return;
    selectedElement = primary && selectedElements.includes(primary)
      ? primary
      : selectedElements[selectedElements.length - 1];
    selectionLabelHidden = true;
    observeSelectedElements();
    showSelection();
  }

  function setCommentDraftActive(active: boolean) {
    commentDraftActive = active;
    if (!active) {
      hideCommentDraftOutlines();
      selectionLabelHidden = false;
    } else if (selectedElements.length > 0 || selectedDrawPaths.length > 0) {
      updateCommentDraftOutlines();
    }
  }

  /** Exit comment-draft outlines and restore normal selection chrome. */
  function restoreSelection(elements: Element[], primary?: Element) {
    commentDraftActive = false;
    hideCommentDraftOutlines();
    selectionLabelHidden = false;
    if (elements.length === 0) {
      clearSelection();
      return;
    }
    const seen = new Set<Element>();
    selectedElements = elements.filter((el) => {
      if (seen.has(el)) return false;
      seen.add(el);
      return true;
    });
    selectedElement = primary && selectedElements.includes(primary)
      ? primary
      : selectedElements[selectedElements.length - 1];
    observeSelectedElements();
    showSelection();
  }

  let commentMode = false;
  function setCommentMode(enabled: boolean) {
    commentMode = enabled;
    if (enabled) {
      drawMode = false;
      drawDrag = null;
      clearSelection();
      cursorStyle.textContent = `* { cursor: ${commentCursorUrl} !important; user-select: none !important; -webkit-user-select: none !important; }`;
    } else if (active) {
      cursorStyle.textContent = drawMode ? DRAW_PAGE_STYLES : ACTIVE_PAGE_STYLES;
    }
  }

  function canUndoDraw(): boolean {
    return undoStack.length > 1;
  }

  function canRedoDraw(): boolean {
    return redoStack.length > 0;
  }

  return {
    activate,
    deactivate,
    destroy,
    hideHighlight,
    clearSelection,
    deselect,
    selectElement,
    selectDrawPaths,
    highlightElement,
    refreshSelection: showSelection,
    updatePinLines,
    suspend,
    resume,
    showScopeHighlights,
    hideScopeHighlights,
    setCommentMode,
    setPropertyEditMode,
    setDrawMode,
    clearDrawings,
    clearDrawSelection,
    getSelectedDrawPaths,
    deleteSelectedDrawings,
    setSelectionLabelHidden,
    showSelectionOutline,
    setCommentDraftActive,
    restoreSelection,
    setChromeLayout,
    canUndoDraw,
    canRedoDraw,
    undoDraw: undo,
    redoDraw: redo,
  };
}
