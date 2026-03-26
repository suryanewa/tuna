/**
 * ElementTree — DOM tree navigator panel.
 * Shows a collapsible tree starting from <body>, with React component
 * names when available. Click to select, hover to highlight.
 * Supports drag-to-reorder among siblings and drag-to-reparent (Phase 2).
 */

import { useState, useCallback, useRef, useEffect, memo } from "react";
import { getDirectReactComponent } from "../selector/identifier";

export interface ElementTreeProps {
  /** Currently selected DOM element (if any) */
  selectedElement: Element | null;
  /** Called when user clicks a node to select it */
  onSelect: (element: Element) => void;
  /** Called when user hovers a node (to highlight on page) */
  onHover: (element: Element | null) => void;
  /** Visual order overrides for reordered containers (parent → ordered children) */
  visualOrderMap?: Map<Element, Element[]>;
  /** Called when user drag-reorders within siblings */
  onTreeReorder?: (element: Element, fromIndex: number, toIndex: number) => void;
  /** Called when user drags into a different parent (Phase 2) */
  onTreeReparent?: (element: Element, newParent: Element, insertIndex: number) => void;
}

/** Stable key generation for tree nodes — avoids index-based keys that break during reorder */
let _nextStableId = 0;
const _stableKeys = new WeakMap<Element, number>();
function getStableKey(el: Element): number {
  let id = _stableKeys.get(el);
  if (id === undefined) {
    id = _nextStableId++;
    _stableKeys.set(el, id);
  }
  return id;
}

/** Tags to skip in the tree (invisible/meta elements) */
const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "LINK", "META", "TITLE", "HEAD",
  "NOSCRIPT", "BR", "WBR", "COL",
]);

/** Check if element is part of Retune's own overlay */
function isRetuneElement(el: Element): boolean {
  if (el.hasAttribute("data-retune-host")) return true;
  if (el.hasAttribute("data-retune-highlight")) return true;
  if (el.hasAttribute("data-retune-selection")) return true;
  if (el.hasAttribute("data-retune-label")) return true;
  if (el.hasAttribute("data-retune-selection-label")) return true;
  return false;
}

/** Get visible children of an element, filtering out Retune overlay and skip tags.
 *  Uses visual order override if available (for reordered containers). */
export function getVisibleChildren(el: Element, visualOrderMap?: Map<Element, Element[]>): Element[] {
  const source = visualOrderMap?.get(el) ?? Array.from(el.children);
  const children: Element[] = [];
  for (const child of source) {
    if (SKIP_TAGS.has(child.tagName)) continue;
    if (isRetuneElement(child)) continue;
    children.push(child);
  }
  return children;
}

/** Format a short label for a tree node */
function formatNodeLabel(el: Element): { tag: string; qualifier: string; component: string | null } {
  const tag = el.tagName.toLowerCase();
  let qualifier = "";
  if (el.id) {
    qualifier = `#${el.id}`;
  } else if (el.className && typeof el.className === "string") {
    const first = el.className.trim().split(/\s+/)[0];
    if (first) qualifier = `.${first}`;
  }

  const component = getDirectReactComponent(el);

  return { tag, qualifier, component };
}

/** Check if an element is an ancestor of another */
function isAncestor(ancestor: Element, descendant: Element): boolean {
  let current: Element | null = descendant.parentElement;
  while (current) {
    if (current === ancestor) return true;
    current = current.parentElement;
  }
  return false;
}

/** Collect all ancestor elements from body to the target */
function getAncestorPath(target: Element): Set<Element> {
  const path = new Set<Element>();
  let current: Element | null = target.parentElement;
  while (current) {
    path.add(current);
    current = current.parentElement;
  }
  return path;
}

/** Compute drop index from cursor Y and cached sibling rects (midpoint comparison).
 *  Returns 0..length — length means "after all siblings". */
export function computeDropIndex(cursorY: number, siblingRects: DOMRect[]): number {
  for (let i = 0; i < siblingRects.length; i++) {
    const midY = siblingRects[i].top + siblingRects[i].height / 2;
    if (cursorY < midY) return i;
  }
  return siblingRects.length;
}

const DRAG_THRESHOLD = 5;
const AUTO_SCROLL_ZONE = 30;
const AUTO_SCROLL_SPEED = 8;

// ── Tree Node ──

interface TreeNodeProps {
  element: Element;
  depth: number;
  selectedElement: Element | null;
  expandedSet: Set<Element>;
  visualOrderMap?: Map<Element, Element[]>;
  onToggle: (el: Element) => void;
  onSelect: (el: Element) => void;
  onHover: (el: Element | null) => void;
  onDragStart: (e: PointerEvent, element: Element) => void;
  isDragging: boolean;
  treeNodeRefs: WeakMap<Element, HTMLDivElement>;
}

const TreeNode = memo(function TreeNode({
  element,
  depth,
  selectedElement,
  expandedSet,
  visualOrderMap,
  onToggle,
  onSelect,
  onHover,
  onDragStart,
  isDragging,
  treeNodeRefs,
}: TreeNodeProps) {
  const children = getVisibleChildren(element, visualOrderMap);
  const hasChildren = children.length > 0;
  const isExpanded = expandedSet.has(element);
  const isSelected = element === selectedElement;
  const { tag, qualifier, component } = formatNodeLabel(element);

  return (
    <>
      <div
        ref={(node) => { if (node) treeNodeRefs.set(element, node); }}
        data-retune-tree-key={getStableKey(element)}
        className={`retune-tree-node${isSelected ? " selected" : ""}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onPointerDown={(e) => {
          // Let arrow clicks pass through
          if ((e.target as HTMLElement).closest(".retune-tree-arrow")) return;
          onDragStart(e.nativeEvent, element);
        }}
        onPointerEnter={() => { if (!isDragging) onHover(element); }}
        onPointerLeave={() => { if (!isDragging) onHover(null); }}
      >
        <span
          className={`retune-tree-arrow${hasChildren ? "" : " empty"}${isExpanded ? " expanded" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(element);
          }}
        >
          {hasChildren && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M9.76754 6.76778C9.9628 6.57252 10.2803 6.57252 10.4755 6.76778C10.6705 6.96298 10.6705 7.27962 10.4755 7.47482L7.99996 9.94942L5.52535 7.47482C5.33009 7.27955 5.33009 6.96305 5.52535 6.76778C5.72061 6.57252 6.03712 6.57252 6.23238 6.76778L7.99996 8.53536L9.76754 6.76778Z" fill="currentColor" fillOpacity="0.9" />
            </svg>
          )}
        </span>
        <span className="retune-tree-tag">{tag}</span>
        {qualifier && <span className="retune-tree-qualifier">{qualifier}</span>}
        {component && <span className="retune-tree-component">&lt;{component}&gt;</span>}
      </div>
      {isExpanded && children.map((child) => (
        <TreeNode
          key={getStableKey(child)}
          element={child}
          depth={depth + 1}
          selectedElement={selectedElement}
          expandedSet={expandedSet}
          visualOrderMap={visualOrderMap}
          onToggle={onToggle}
          onSelect={onSelect}
          onHover={onHover}
          onDragStart={onDragStart}
          isDragging={isDragging}
          treeNodeRefs={treeNodeRefs}
        />
      ))}
    </>
  );
});

// ── Element Tree ──

export function ElementTree({ selectedElement, onSelect, onHover, visualOrderMap, onTreeReorder, onTreeReparent }: ElementTreeProps) {
  const [expandedSet, setExpandedSet] = useState<Set<Element>>(() => new Set());
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const prevSelectedRef = useRef<Element | null>(null);
  const treeNodeRefs = useRef(new WeakMap<Element, HTMLDivElement>()).current;

  // Drag state — all in refs to avoid re-renders during drag
  const dragRef = useRef<{
    element: Element;
    parentElement: Element;
    siblings: Element[];
    siblingRects: DOMRect[];
    siblingDepth: number;
    dragIndex: number;
    dropIndex: number;
    startX: number;
    startY: number;
    active: boolean;
    wasExpanded: boolean;
    ghost: HTMLDivElement | null;
    indicator: HTMLDivElement | null;
    scrollRaf: number | null;
  } | null>(null);

  // Auto-expand ancestors when selection changes
  useEffect(() => {
    if (!selectedElement || selectedElement === prevSelectedRef.current) return;
    prevSelectedRef.current = selectedElement;

    const ancestors = getAncestorPath(selectedElement);
    setExpandedSet((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const a of ancestors) {
        if (!next.has(a)) {
          next.add(a);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    // Scroll selected node into view after render
    requestAnimationFrame(() => {
      const node = scrollRef.current?.querySelector(".retune-tree-node.selected");
      node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [selectedElement]);

  const handleToggle = useCallback((el: Element) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(el)) {
        next.delete(el);
      } else {
        next.add(el);
      }
      return next;
    });
  }, []);

  // ── Drag handlers ──

  const snapshotSiblingRects = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.siblingRects = drag.siblings.map(s => {
      const node = treeNodeRefs.get(s);
      return node ? node.getBoundingClientRect() : new DOMRect();
    });
  }, [treeNodeRefs]);

  const createGhost = useCallback((element: Element, x: number, y: number) => {
    const { tag, qualifier, component } = formatNodeLabel(element);
    const ghost = document.createElement("div");
    ghost.className = "retune-tree-ghost";
    let label = tag;
    if (qualifier) label += qualifier;
    if (component) label += ` <${component}>`;
    ghost.textContent = label;
    ghost.style.left = `${x + 12}px`;
    ghost.style.top = `${y - 12}px`;
    // Append to shadow root for CSS variable access
    const root = scrollRef.current?.getRootNode();
    if (root instanceof ShadowRoot) {
      root.appendChild(ghost);
    } else {
      scrollRef.current?.appendChild(ghost);
    }
    return ghost;
  }, []);

  const createIndicator = useCallback(() => {
    const indicator = document.createElement("div");
    indicator.className = "retune-tree-drop-indicator";
    innerRef.current?.appendChild(indicator);
    return indicator;
  }, []);

  const positionIndicator = useCallback((indicator: HTMLDivElement, dropIndex: number, depth: number) => {
    const drag = dragRef.current;
    if (!drag || !innerRef.current) return;

    const innerRect = innerRef.current.getBoundingClientRect();
    let y: number;

    if (drag.siblingRects.length === 0) return;

    if (dropIndex <= 0) {
      y = drag.siblingRects[0].top - innerRect.top - 1;
    } else if (dropIndex >= drag.siblings.length) {
      const last = drag.siblingRects[drag.siblingRects.length - 1];
      y = last.bottom - innerRect.top - 1;
    } else {
      const prev = drag.siblingRects[dropIndex - 1];
      const curr = drag.siblingRects[dropIndex];
      y = (prev.bottom + curr.top) / 2 - innerRect.top - 1;
    }

    // Indent to match the depth level of the siblings (same as tree node paddingLeft)
    const indent = 12 + depth * 16;

    indicator.style.display = "block";
    indicator.style.top = `${y}px`;
    indicator.style.left = `${indent}px`;
  }, []);

  const cleanupDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;

    // Remove ghost
    if (drag.ghost) drag.ghost.remove();

    // Hide indicator
    if (drag.indicator) {
      drag.indicator.style.display = "none";
      drag.indicator.remove();
    }

    // Remove dragging class from source node
    const sourceNode = treeNodeRefs.get(drag.element);
    if (sourceNode) sourceNode.classList.remove("dragging");

    // Cancel auto-scroll
    if (drag.scrollRaf) cancelAnimationFrame(drag.scrollRaf);

    // Restore expand state if drag was cancelled
    if (drag.wasExpanded && drag.active) {
      // Only restore if the drop didn't happen (dropIndex === dragIndex means no-op/cancel)
    }

    dragRef.current = null;
    setIsDragging(false);
  }, [treeNodeRefs]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    // Check threshold
    if (!drag.active) {
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;

      // Activate drag — select the dragged element
      drag.active = true;
      setIsDragging(true);
      onSelect(drag.element);

      // Auto-collapse if expanded
      const wasExpanded = expandedSet.has(drag.element);
      drag.wasExpanded = wasExpanded;
      if (wasExpanded) {
        setExpandedSet(prev => {
          const next = new Set(prev);
          next.delete(drag.element);
          return next;
        });
        // Need to wait for React to re-render before snapshotting rects
        requestAnimationFrame(() => {
          snapshotSiblingRects();
        });
      } else {
        snapshotSiblingRects();
      }

      // Dim the source node
      const sourceNode = treeNodeRefs.get(drag.element);
      if (sourceNode) sourceNode.classList.add("dragging");

      // Create ghost + indicator
      drag.ghost = createGhost(drag.element, e.clientX, e.clientY);
      drag.indicator = createIndicator();
      return;
    }

    // Verify element still connected (React reconciliation safety)
    if (!drag.element.isConnected) {
      cleanupDrag();
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      return;
    }

    // Update ghost position
    if (drag.ghost) {
      drag.ghost.style.left = `${e.clientX + 12}px`;
      drag.ghost.style.top = `${e.clientY - 12}px`;
    }

    // Compute drop index
    const newDropIndex = computeDropIndex(e.clientY, drag.siblingRects);
    drag.dropIndex = newDropIndex;

    // Position indicator
    if (drag.indicator) {
      const visualDrop = newDropIndex > drag.dragIndex ? newDropIndex + 1 : newDropIndex;
      positionIndicator(drag.indicator, visualDrop, drag.siblingDepth);
    }

    // Auto-scroll
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      const scrollRect = scrollEl.getBoundingClientRect();
      const distFromTop = e.clientY - scrollRect.top;
      const distFromBottom = scrollRect.bottom - e.clientY;

      if (distFromTop < AUTO_SCROLL_ZONE && scrollEl.scrollTop > 0) {
        const speed = AUTO_SCROLL_SPEED * (1 - distFromTop / AUTO_SCROLL_ZONE);
        scrollEl.scrollTop -= speed;
        snapshotSiblingRects();
      } else if (distFromBottom < AUTO_SCROLL_ZONE) {
        const speed = AUTO_SCROLL_SPEED * (1 - distFromBottom / AUTO_SCROLL_ZONE);
        scrollEl.scrollTop += speed;
        snapshotSiblingRects();
      }
    }
  }, [expandedSet, treeNodeRefs, snapshotSiblingRects, createGhost, createIndicator, positionIndicator, cleanupDrag]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    document.removeEventListener("pointermove", handlePointerMove, true);
    document.removeEventListener("pointerup", handlePointerUp, true);

    const drag = dragRef.current;
    if (!drag) return;

    if (!drag.active) {
      // Threshold not met — treat as click-to-select
      onSelect(drag.element);
      dragRef.current = null;
      return;
    }

    const { element, dragIndex, dropIndex } = drag;
    cleanupDrag();

    // Execute reorder if position changed
    if (dropIndex !== dragIndex && onTreeReorder) {
      onTreeReorder(element, dragIndex, dropIndex);
    } else if (drag.wasExpanded) {
      // Restore expand state on no-op / cancel
      setExpandedSet(prev => {
        const next = new Set(prev);
        next.add(element);
        return next;
      });
    }
  }, [onSelect, onTreeReorder, cleanupDrag, handlePointerMove]);

  const handleDragStart = useCallback((e: PointerEvent, element: Element) => {
    // Don't drag if no reorder handler
    if (!onTreeReorder) return;

    // Don't drag absolute/fixed elements — CSS order won't visually move them
    const pos = getComputedStyle(element).position;
    if (pos === "absolute" || pos === "fixed") return;

    const parent = element.parentElement;
    if (!parent) return;

    const siblings = getVisibleChildren(parent, visualOrderMap);
    if (siblings.length < 2) return;

    const dragIndex = siblings.indexOf(element);
    if (dragIndex === -1) return;

    e.preventDefault();
    e.stopPropagation();

    // Compute depth by walking ancestors from parent to body
    let depth = 0;
    let ancestor: Element | null = parent;
    while (ancestor && ancestor !== document.body) {
      depth++;
      ancestor = ancestor.parentElement;
    }

    dragRef.current = {
      element,
      parentElement: parent,
      siblings,
      siblingRects: [],
      siblingDepth: depth,
      dragIndex,
      dropIndex: dragIndex,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      wasExpanded: false,
      ghost: null,
      indicator: null,
      scrollRaf: null,
    };

    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("pointerup", handlePointerUp, true);
  }, [onTreeReorder, visualOrderMap, handlePointerMove, handlePointerUp]);

  const bodyChildren = typeof document !== "undefined"
    ? getVisibleChildren(document.body)
    : [];

  return (
    <div className="retune-tree" ref={scrollRef}>
      <div className="retune-tree-inner" ref={innerRef}>
        {bodyChildren.map((child) => (
          <TreeNode
            key={getStableKey(child)}
            element={child}
            depth={0}
            selectedElement={selectedElement}
            expandedSet={expandedSet}
            visualOrderMap={visualOrderMap}
            onToggle={handleToggle}
            onSelect={onSelect}
            onHover={onHover}
            onDragStart={handleDragStart}
            isDragging={isDragging}
            treeNodeRefs={treeNodeRefs}
          />
        ))}
      </div>
    </div>
  );
}
