/**
 * Element picker: hover to highlight, click to select.
 *
 * Uses a fixed-position overlay with pointer-events:none so
 * elementFromPoint() returns the real element underneath.
 * All event listeners use capture phase to intercept before page handlers.
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
  const highlight = document.createElement("div");
  highlight.setAttribute("data-composer-highlight", "");
  shadowRoot.appendChild(highlight);

  const label = document.createElement("div");
  label.setAttribute("data-composer-label", "");
  shadowRoot.appendChild(label);

  let active = false;
  let hoveredElement: Element | null = null;

  function updateHighlight(el: Element) {
    const rect = el.getBoundingClientRect();
    highlight.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.08);
      pointer-events: none;
      z-index: 2147483646;
      transition: all 0.05s ease;
      box-sizing: border-box;
    `;

    // Position label above the element, or below if near viewport top
    const labelY = rect.top > 24 ? rect.top - 24 : rect.bottom + 4;
    label.style.cssText = `
      position: fixed;
      top: ${labelY}px;
      left: ${rect.left}px;
      background: #3b82f6;
      color: white;
      font-size: 11px;
      font-family: ui-monospace, monospace;
      padding: 2px 6px;
      border-radius: 3px;
      pointer-events: none;
      z-index: 2147483646;
      white-space: nowrap;
    `;
    label.textContent = formatLabel(el);
  }

  function formatLabel(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
    const dims = `${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`;
    return `${tag}${id}${cls} ${dims}`;
  }

  function hideHighlight() {
    highlight.style.display = "none";
    label.style.display = "none";
  }

  // Filter out our own overlay elements
  function isOverlayElement(el: Element): boolean {
    return !!el.closest("[data-composer-host]");
  }

  function handleMouseMove(e: MouseEvent) {
    if (!active) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOverlayElement(el)) return;
    if (el === hoveredElement) return;

    hoveredElement = el;
    const rect = el.getBoundingClientRect();
    updateHighlight(el);
    callbacks.onHover(el, rect);
  }

  function handleClick(e: MouseEvent) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOverlayElement(el)) return;

    callbacks.onSelect(el);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!active) return;
    if (e.key === "Escape") {
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
  }

  function deactivate() {
    active = false;
    document.body.style.cursor = "";
    hoveredElement = null;
    hideHighlight();
    document.removeEventListener("mousemove", handleMouseMove, true);
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("keydown", handleKeyDown, true);
  }

  function destroy() {
    deactivate();
    highlight.remove();
    label.remove();
  }

  return { activate, deactivate, destroy, hideHighlight };
}
