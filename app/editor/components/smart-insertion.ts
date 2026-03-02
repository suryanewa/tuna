import type { CanvasElement } from "@/lib/playground/store";

/**
 * Determines the parent container and insertion index for a creation point.
 *
 * Algorithm:
 * 1. Hit-test from the click point to find the deepest container element
 * 2. Find the insertion index by comparing the click position against
 *    existing children positions along the parent's flex axis
 * 3. If no container is hit, use root and compute index among root elements
 */
export function computeSmartInsertion(
  clientX: number,
  clientY: number,
  canvasEl: HTMLDivElement,
  elements: Record<string, CanvasElement>,
): { parentId: string | null; insertIndex: number } {

  // Hit-test: find deepest container under click point
  // Filter to only elements with data-element-id (excludes overlay divs)
  const hitElements = document.elementsFromPoint(clientX, clientY);
  let parentId: string | null = null;
  let parentDepth = -1;

  for (const hitEl of hitElements) {
    const elWithId = (hitEl as HTMLElement).closest?.("[data-element-id]");
    if (!elWithId) continue;
    const elementId = elWithId.getAttribute("data-element-id");
    if (!elementId) continue;
    const element = elements[elementId];
    if (element?.type !== "container") continue;

    // Calculate depth to find the deepest container
    let depth = 0;
    let current = element;
    while (current?.parentId) {
      depth++;
      current = elements[current.parentId];
    }

    if (depth > parentDepth) {
      parentDepth = depth;
      parentId = elementId;
    }
  }

  // Get children list
  const children = parentId
    ? elements[parentId]?.children || []
    : getRootElementIds(elements);

  // Determine flex direction of parent
  const isVertical = parentId
    ? elements[parentId]?.tailwindStyles?.flexDirection !== "flex-row"
    : true; // Root layout is vertical by default

  // Find insertion index by comparing click position to children centers
  let insertIndex = children.length; // default: append at end

  for (let i = 0; i < children.length; i++) {
    const childEl = canvasEl.querySelector(
      `[data-element-id="${children[i]}"]`
    );
    if (!childEl) continue;
    const childRect = childEl.getBoundingClientRect();
    const childCenter = isVertical
      ? childRect.top + childRect.height / 2
      : childRect.left + childRect.width / 2;
    const clickPos = isVertical ? clientY : clientX;

    if (clickPos < childCenter) {
      insertIndex = i;
      break;
    }
  }

  return { parentId, insertIndex };
}

export function getRootElementIds(elements: Record<string, CanvasElement>, activePageId?: string): string[] {
  return Object.values(elements)
    .filter((el): el is CanvasElement =>
      el !== undefined &&
      !el.parentId &&
      el.placement !== "canvas" &&
      (!activePageId || el.pageId === activePageId)
    )
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    .map((el) => el.id);
}

/**
 * Build set of element + all its descendants (to prevent dropping into self).
 */
function collectDescendants(
  elementId: string,
  elements: Record<string, CanvasElement>,
  result: Set<string>
): void {
  result.add(elementId);
  const el = elements[elementId];
  if (el?.children) {
    for (let i = 0; i < el.children.length; i++) {
      collectDescendants(el.children[i], elements, result);
    }
  }
}

export interface DropTarget {
  parentId: string | null;
  siblingId: string | null;
  position: "before" | "after";
  insertIndex: number;
}

/**
 * Determines the drop target for a reparent drag.
 *
 * 1. Hit-test from cursor to find deepest container (excluding dragged element and descendants)
 * 2. Get container's children (excluding dragged element)
 * 3. Compare cursor vs children center points along flex axis
 * 4. Return nearest sibling + before/after position for dropElementMutation
 */
export function computeDropTarget(
  clientX: number,
  clientY: number,
  canvasEl: HTMLElement,
  elements: Record<string, CanvasElement>,
  draggedId: string,
  activePageId?: string
): DropTarget | null {
  // Build excluded set: dragged element + all descendants
  const excluded = new Set<string>();
  collectDescendants(draggedId, elements, excluded);

  // Hit-test: find deepest non-excluded container under cursor
  const hitElements = document.elementsFromPoint(clientX, clientY);
  let parentId: string | null = null;
  let parentDepth = -1;

  for (let i = 0; i < hitElements.length; i++) {
    const hitEl = hitElements[i] as HTMLElement;
    const elWithId = hitEl.closest?.("[data-element-id]");
    if (!elWithId) continue;
    const elementId = elWithId.getAttribute("data-element-id");
    if (!elementId) continue;
    if (excluded.has(elementId)) continue;
    const element = elements[elementId];
    if (element?.type !== "container") continue;

    // Verify cursor is within the container's visual bounding box.
    // Without this, children extending beyond the container (e.g. overflow visible)
    // cause the container to be found via closest(), trapping elements inside.
    const containerRect = (elWithId as HTMLElement).getBoundingClientRect();
    if (clientX < containerRect.left || clientX > containerRect.right ||
        clientY < containerRect.top || clientY > containerRect.bottom) {
      continue;
    }

    // Calculate depth
    let depth = 0;
    let current = element;
    while (current?.parentId) {
      depth++;
      current = elements[current.parentId];
    }

    if (depth > parentDepth) {
      parentDepth = depth;
      parentId = elementId;
    }
  }

  // Get children list, excluding the dragged element
  const allChildren = parentId
    ? (elements[parentId]?.children || [])
    : getRootElementIds(elements, activePageId);
  const children = allChildren.filter(id => !excluded.has(id));

  // Empty container or root with no other elements
  if (children.length === 0) {
    return { parentId, siblingId: null, position: "after", insertIndex: 0 };
  }

  // Determine flex direction
  const isVertical = parentId
    ? elements[parentId]?.tailwindStyles?.flexDirection !== "flex-row"
    : true;

  // Find insertion index by comparing cursor to children centers
  let insertIndex = children.length; // default: append at end

  for (let i = 0; i < children.length; i++) {
    const childEl = canvasEl.querySelector(
      `[data-element-id="${children[i]}"]`
    );
    if (!childEl) continue;
    const childRect = childEl.getBoundingClientRect();
    const childCenter = isVertical
      ? childRect.top + childRect.height / 2
      : childRect.left + childRect.width / 2;
    const cursorPos = isVertical ? clientY : clientX;

    if (cursorPos < childCenter) {
      insertIndex = i;
      break;
    }
  }

  // Determine sibling + position for dropElementMutation
  let siblingId: string;
  let position: "before" | "after";

  if (insertIndex < children.length) {
    siblingId = children[insertIndex];
    position = "before";
  } else {
    siblingId = children[children.length - 1];
    position = "after";
  }

  return { parentId, siblingId, position, insertIndex };
}
