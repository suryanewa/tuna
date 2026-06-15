/**
 * Drag-to-reorder interaction for elements within flex/grid containers.
 *
 * Handles pointer events, visual feedback (transforms), drop indicators,
 * and DOM reordering on drop.
 */

import type { ReorderableContainer, ReorderChild, StructuralChange } from "../types";
import { getSelector, getReactComponentHierarchy } from "../selector/identifier";

export interface ReorderCallbacks {
  /** Called when a drag starts (to suppress picker interactions) */
  onDragStart: () => void;
  /** Called when drag ends without reorder */
  onDragCancel: () => void;
  /** Called when a successful reorder happens */
  onReorder: (change: StructuralChange) => void;
}

interface DragState {
  /** The child being dragged */
  draggedChild: ReorderChild;
  /** The container info */
  container: ReorderableContainer;
  /** Starting pointer position */
  startX: number;
  startY: number;
  /** The ghost element (visual clone following pointer) */
  ghost: HTMLElement;
  /** Drop indicator line */
  indicator: HTMLElement;
  /** Overlay elements for each sibling (for dimming/animation) */
  siblingOverlays: HTMLElement[];
  /** Current drop index */
  dropIndex: number;
  /** Is the drag axis horizontal? */
  horizontal: boolean;
  /** Has the drag threshold been met? */
  active: boolean;
}

const DRAG_THRESHOLD = 5; // pixels before drag starts

/**
 * Creates a reorder controller for a specific container.
 * Call `startDrag()` on pointerdown to begin a drag operation.
 */
export function createReorderController(
  shadowRoot: ShadowRoot,
  callbacks: ReorderCallbacks,
) {
  let state: DragState | null = null;

  /** Start a drag from a specific child element */
  function startDrag(
    child: ReorderChild,
    container: ReorderableContainer,
    startX: number,
    startY: number,
  ) {
    // Determine drag axis from flex direction
    const computed = getComputedStyle(container.container);
    const direction = computed.flexDirection;
    const horizontal = direction === "row" || direction === "row-reverse"
      || container.layout === "grid"; // grid: treat as horizontal for simplicity

    // Create ghost element
    const ghost = document.createElement("div");
    ghost.setAttribute("data-tuna-drag-ghost", "");
    ghost.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      opacity: 0.85;
      border-radius: 8px;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.08);
      transition: none;
      display: none;
    `;
    const rect = child.element.getBoundingClientRect();
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    shadowRoot.appendChild(ghost);

    // Create drop indicator
    const indicator = document.createElement("div");
    indicator.setAttribute("data-tuna-drop-indicator", "");
    indicator.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      background: #3b82f6;
      border-radius: 2px;
      display: none;
    `;
    if (horizontal) {
      indicator.style.width = "3px";
      indicator.style.height = `${rect.height}px`;
    } else {
      indicator.style.height = "3px";
      indicator.style.width = `${rect.width}px`;
    }
    shadowRoot.appendChild(indicator);

    state = {
      draggedChild: child,
      container,
      startX,
      startY,
      ghost,
      indicator,
      siblingOverlays: [],
      dropIndex: child.index,
      horizontal,
      active: false,
    };

    // Listen for pointer move and up on the document
    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("pointerup", handlePointerUp, true);
    document.addEventListener("pointercancel", handlePointerUp, true);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!state) return;
    e.preventDefault();
    e.stopPropagation();

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    // Check threshold
    if (!state.active) {
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      state.active = true;
      state.ghost.style.display = "";
      callbacks.onDragStart();

      // Dim the dragged element
      (state.draggedChild.element as HTMLElement).style.opacity = "0.3";
    }

    // Move ghost
    const rect = state.draggedChild.element.getBoundingClientRect();
    state.ghost.style.left = `${rect.left + dx}px`;
    state.ghost.style.top = `${rect.top + dy}px`;

    // Calculate drop position
    const children = state.container.children;
    let newDropIndex = state.draggedChild.index;

    for (let i = 0; i < children.length; i++) {
      if (i === state.draggedChild.index) continue;
      const childRect = children[i].element.getBoundingClientRect();
      const midX = childRect.left + childRect.width / 2;
      const midY = childRect.top + childRect.height / 2;

      if (state.horizontal) {
        if (e.clientX < midX && i < state.draggedChild.index) {
          newDropIndex = i;
          break;
        }
        if (e.clientX > midX && i > state.draggedChild.index) {
          newDropIndex = i;
        }
      } else {
        if (e.clientY < midY && i < state.draggedChild.index) {
          newDropIndex = i;
          break;
        }
        if (e.clientY > midY && i > state.draggedChild.index) {
          newDropIndex = i;
        }
      }
    }

    state.dropIndex = newDropIndex;

    // Update drop indicator position
    if (newDropIndex !== state.draggedChild.index) {
      state.indicator.style.display = "";
      const targetChild = children[newDropIndex];
      const targetRect = targetChild.element.getBoundingClientRect();

      if (state.horizontal) {
        const x = newDropIndex < state.draggedChild.index
          ? targetRect.left - 3
          : targetRect.right;
        state.indicator.style.left = `${x}px`;
        state.indicator.style.top = `${targetRect.top}px`;
        state.indicator.style.height = `${targetRect.height}px`;
      } else {
        const y = newDropIndex < state.draggedChild.index
          ? targetRect.top - 3
          : targetRect.bottom;
        state.indicator.style.left = `${targetRect.left}px`;
        state.indicator.style.top = `${y}px`;
        state.indicator.style.width = `${targetRect.width}px`;
      }
    } else {
      state.indicator.style.display = "none";
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (!state) return;
    e.preventDefault();
    e.stopPropagation();

    document.removeEventListener("pointermove", handlePointerMove, true);
    document.removeEventListener("pointerup", handlePointerUp, true);
    document.removeEventListener("pointercancel", handlePointerUp, true);

    // Restore dragged element opacity
    (state.draggedChild.element as HTMLElement).style.opacity = "";

    // Clean up ghost and indicator
    state.ghost.remove();
    state.indicator.remove();

    if (!state.active || state.dropIndex === state.draggedChild.index) {
      // No reorder happened
      state = null;
      callbacks.onDragCancel();
      return;
    }

    // Build the structural change before DOM manipulation
    const container = state.container;
    const originalOrder = container.children.map((c) => c.label);

    // Calculate new order
    const newChildren = [...container.children];
    const [moved] = newChildren.splice(state.draggedChild.index, 1);
    newChildren.splice(state.dropIndex, 0, moved);
    const newOrder = newChildren.map((c) => c.label);

    // Perform DOM reorder
    const draggedEl = state.draggedChild.element;
    const targetEl = container.children[state.dropIndex].element;
    if (state.dropIndex < state.draggedChild.index) {
      container.container.insertBefore(draggedEl, targetEl);
    } else {
      // Insert after target
      const nextSibling = targetEl.nextElementSibling;
      if (nextSibling) {
        container.container.insertBefore(draggedEl, nextSibling);
      } else {
        container.container.appendChild(draggedEl);
      }
    }

    // Build child sources for static JSX reordering
    const childSources = container.childrenType === "static"
      ? container.children
          .filter((c) => c.sourceFile)
          .map((c) => ({
            label: c.label,
            sourceFile: c.sourceFile!,
          }))
      : undefined;

    const change: StructuralChange = {
      type: "reorder",
      containerSelector: getSelector(container.container),
      containerComponents: getReactComponentHierarchy(container.container),
      containerSourceFile: container.sourceFile,
      childrenType: container.childrenType,
      originalOrder,
      newOrder,
      childSources,
      timestamp: Date.now(),
    };

    state = null;
    callbacks.onReorder(change);
  }

  function destroy() {
    if (state) {
      (state.draggedChild.element as HTMLElement).style.opacity = "";
      state.ghost.remove();
      state.indicator.remove();
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("pointercancel", handlePointerUp, true);
      state = null;
    }
  }

  return { startDrag, destroy };
}
