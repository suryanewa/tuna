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
  let hoveredElement: Element | null = null;
  let selectedElement: Element | null = null;
  let selectionLabelHidden = false;
  let trackingRaf: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSelRect = { top: 0, left: 0, width: 0, height: 0 };

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

  function positionBox(box: HTMLElement, labelEl: HTMLElement, rect: DOMRect, borderStyle: string, bgAlpha: string) {
    box.style.top = `${rect.top}px`;
    box.style.left = `${rect.left}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.style.border = `2px ${borderStyle} #3b82f6`;
    box.style.background = `rgba(59, 130, 246, ${bgAlpha})`;
    box.style.display = "";

    const labelY = rect.top > 24 ? rect.top - 24 : rect.bottom + 4;
    labelEl.style.top = `${labelY}px`;
    labelEl.style.left = `${rect.left}px`;
    labelEl.style.background = "#3b82f6";
  }

  function updateHighlight(el: Element) {
    const rect = el.getBoundingClientRect();
    const dashed = selectedElement !== null && el !== selectedElement;
    positionBox(highlight, label, rect, dashed ? "dashed" : "solid", "0.08");
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
  }

  function hideSelection() {
    selection.style.display = "none";
    selectionLabel.style.display = "none";
  }

  // Debounce multiple events into a single rAF update
  function scheduleTrack() {
    if (trackingRaf !== null) return;
    trackingRaf = requestAnimationFrame(() => {
      trackingRaf = null;
      trackSelection();
    });
  }

  // Keep selection box in sync on scroll/resize
  function startTracking() {
    window.addEventListener("scroll", scheduleTrack, { capture: true, passive: true });
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
    window.removeEventListener("scroll", scheduleTrack, true);
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
      selectionLabelHidden = false;
      selectionLabel.style.display = "";
    } else {
      updateHighlight(el);
    }

    callbacks.onHover(el, el.getBoundingClientRect());
  }

  function handleMouseMove(e: MouseEvent) {
    if (!active) return;
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

  function handleClick(e: MouseEvent) {
    if (!active) return;

    // Ignore clicks that originate from inside the overlay (panel buttons, inputs, dropdowns)
    const path = e.composedPath();
    const host = shadowRoot.host;
    if (path.includes(host)) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const raw = document.elementFromPoint(e.clientX, e.clientY);
    if (!raw || isOverlayElement(raw)) return;
    const el = resolveElement(raw);
    if (!el || isOverlayElement(el)) return;

    selectedElement = el;
    selectionLabelHidden = false;
    // Update ResizeObserver to watch the newly selected element
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver.observe(el);
    }
    showSelection();
    hideHighlight();
    hoveredElement = null;
    callbacks.onSelect(el);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!active) return;
    if (e.key === "Escape") {
      // If a nested overlay (e.g. color picker) is open, let it handle Escape
      if (shadowRoot.querySelector(".retune-color-picker-panel")) return;
      e.preventDefault();
      callbacks.onCancel();
    }
  }

  function activate() {
    active = true;
    document.body.style.cursor = "crosshair";
    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    startTracking();
  }

  function deactivate() {
    active = false;
    document.body.style.cursor = "";
    hoveredElement = null;
    selectedElement = null;
    selectionLabelHidden = false;
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    hideHighlight();
    hideSelection();
    stopTracking();
    document.removeEventListener("mousemove", handleMouseMove, true);
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("keydown", handleKeyDown, true);
  }

  function clearSelection() {
    selectedElement = null;
    selectionLabelHidden = false;
    hideSelection();
  }

  function destroy() {
    deactivate();
    highlight.remove();
    label.remove();
    selection.remove();
    selectionLabel.remove();
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

  return { activate, deactivate, destroy, hideHighlight, clearSelection, selectElement, highlightElement, refreshSelection: scheduleTrack };
}
