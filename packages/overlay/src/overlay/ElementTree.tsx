/**
 * ElementTree — DOM tree navigator panel.
 * Shows a collapsible tree starting from <body>, with React component
 * names when available. Click to select, hover to highlight.
 * Supports drag-to-reorder among siblings and drag-to-reparent (Phase 2).
 */

import { useState, useCallback, useRef, useEffect, memo } from "react";
import { getDirectReactComponent } from "../selector/identifier";

export interface ReparentEntry {
  element: Element;
  newParent: Element;
  insertIndex: number;
}

export interface ElementTreeProps {
  /** Currently selected DOM element (if any) */
  selectedElement: Element | null;
  /** Called when user clicks a node to select it */
  onSelect: (element: Element) => void;
  /** Called when user hovers a node (to highlight on page) */
  onHover: (element: Element | null) => void;
  /** Visual order overrides for reordered containers (parent → ordered children) */
  visualOrderMap?: Map<Element, Element[]>;
  /** Pending reparent operations for tree visual preview */
  reparentEntries?: ReparentEntry[];
  /** Called when user drag-reorders within siblings */
  onTreeReorder?: (element: Element, fromIndex: number, toIndex: number) => void;
  /** Called when user drags into a different parent (Phase 2) */
  onTreeReparent?: (element: Element, newParent: Element, insertIndex: number) => void;
}

/** Stable key generation for tree nodes — avoids index-based keys that break during reorder */
let _nextStableId = 0;
const _stableKeys = new WeakMap<Element, number>();
const _stableKeyReverse = new Map<number, Element>();
function getStableKey(el: Element): number {
  let id = _stableKeys.get(el);
  if (id === undefined) {
    id = _nextStableId++;
    _stableKeys.set(el, id);
    _stableKeyReverse.set(id, el);
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
 *  Uses visual order override if available (for reordered containers).
 *  Applies reparent entries: removes reparented-away children, inserts reparented-in children. */
export function getVisibleChildren(el: Element, visualOrderMap?: Map<Element, Element[]>, reparentEntries?: ReparentEntry[]): Element[] {
  const source = visualOrderMap?.get(el) ?? Array.from(el.children);
  const children: Element[] = [];
  // Set of elements reparented away from this parent
  const reparentedAway = reparentEntries
    ? new Set(reparentEntries.filter(r => r.element.parentElement === el && r.newParent !== el).map(r => r.element))
    : null;

  for (const child of source) {
    if (SKIP_TAGS.has(child.tagName)) continue;
    if (isRetuneElement(child)) continue;
    if (reparentedAway?.has(child)) continue;
    children.push(child);
  }

  // Insert elements reparented INTO this element
  if (reparentEntries) {
    for (const entry of reparentEntries) {
      if (entry.newParent === el && entry.element.parentElement !== el) {
        const idx = Math.min(entry.insertIndex, children.length);
        children.splice(idx, 0, entry.element);
      }
    }
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
  reparentEntries?: ReparentEntry[];
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
  reparentEntries,
  onToggle,
  onSelect,
  onHover,
  onDragStart,
  isDragging,
  treeNodeRefs,
}: TreeNodeProps) {
  const children = getVisibleChildren(element, visualOrderMap, reparentEntries);
  const isReparented = reparentEntries?.some(r => r.element === element && r.newParent !== element.parentElement);
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
        {isReparented && <span className="retune-tree-moved">moved</span>}
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
          reparentEntries={reparentEntries}
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

export function ElementTree({ selectedElement, onSelect, onHover, visualOrderMap, reparentEntries, onTreeReorder, onTreeReparent }: ElementTreeProps) {
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
    // Reparent state
    mode: "reorder" | "reparent" | null;
    reparentTarget: Element | null;
    reparentIndex: number;
    expandTimer: ReturnType<typeof setTimeout> | null;
    lastHoverKey: number | null;
    highlightedNode: HTMLDivElement | null;
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

    if (drag.ghost) drag.ghost.remove();
    if (drag.indicator) { drag.indicator.style.display = "none"; drag.indicator.remove(); }
    if (drag.highlightedNode) drag.highlightedNode.classList.remove("reparent-target");
    if (drag.expandTimer) clearTimeout(drag.expandTimer);

    const sourceNode = treeNodeRefs.get(drag.element);
    if (sourceNode) sourceNode.classList.remove("dragging");

    if (drag.scrollRaf) cancelAnimationFrame(drag.scrollRaf);

    dragRef.current = null;
    setIsDragging(false);
  }, [treeNodeRefs]);

  /** Find the DOM element corresponding to a tree node div under the cursor */
  const findTargetElement = useCallback((e: PointerEvent): { element: Element; treeNode: HTMLDivElement } | null => {
    const root = scrollRef.current?.getRootNode();
    if (!(root instanceof ShadowRoot)) return null;
    const hit = root.elementFromPoint(e.clientX, e.clientY);
    const treeNode = hit?.closest?.("[data-retune-tree-key]") as HTMLDivElement | null;
    if (!treeNode) return null;
    const key = parseInt(treeNode.getAttribute("data-retune-tree-key") || "", 10);
    if (isNaN(key)) return null;
    const element = _stableKeyReverse.get(key);
    if (!element) return null;
    return { element, treeNode };
  }, []);

  /** Compute depth of an element in the DOM tree (body = 0) */
  const getElementDepth = useCallback((el: Element): number => {
    let depth = 0;
    let current: Element | null = el.parentElement;
    while (current && current !== document.body) {
      depth++;
      current = current.parentElement;
    }
    return depth;
  }, []);

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
        requestAnimationFrame(() => { snapshotSiblingRects(); });
      } else {
        snapshotSiblingRects();
      }

      const sourceNode = treeNodeRefs.get(drag.element);
      if (sourceNode) sourceNode.classList.add("dragging");

      drag.ghost = createGhost(drag.element, e.clientX, e.clientY);
      drag.indicator = createIndicator();
      return;
    }

    // React reconciliation safety
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

    // Clear previous reparent highlight
    if (drag.highlightedNode) {
      drag.highlightedNode.classList.remove("reparent-target");
      drag.highlightedNode = null;
    }

    // Find which tree node the cursor is over
    const target = findTargetElement(e);

    if (!target || target.element === drag.element || isAncestor(drag.element, target.element)) {
      // Over self, descendant, or nothing — hide indicators
      if (drag.indicator) drag.indicator.style.display = "none";
      drag.mode = null;
      drag.reparentTarget = null;
      // Clear expand timer
      if (drag.expandTimer) { clearTimeout(drag.expandTimer); drag.expandTimer = null; }
      drag.lastHoverKey = null;
    } else {
      const targetParent = target.element.parentElement;
      const isSibling = targetParent === drag.parentElement;

      if (isSibling) {
        // ── REORDER among siblings ──
        drag.mode = "reorder";
        drag.reparentTarget = null;
        if (drag.expandTimer) { clearTimeout(drag.expandTimer); drag.expandTimer = null; }
        drag.lastHoverKey = null;

        const newDropIndex = computeDropIndex(e.clientY, drag.siblingRects);
        drag.dropIndex = newDropIndex;

        if (drag.indicator) {
          const visualDrop = newDropIndex > drag.dragIndex ? newDropIndex + 1 : newDropIndex;
          positionIndicator(drag.indicator, visualDrop, drag.siblingDepth);
        }
      } else {
        // ── REPARENT into different parent ──
        const rect = target.treeNode.getBoundingClientRect();
        const relY = (e.clientY - rect.top) / rect.height;
        const targetDepth = getElementDepth(target.element);

        if (relY < 0.25 && targetParent) {
          // Before target — insert in target's parent before target
          drag.mode = "reparent";
          drag.reparentTarget = targetParent;
          const targetSiblings = getVisibleChildren(targetParent, visualOrderMap);
          drag.reparentIndex = targetSiblings.indexOf(target.element);
          if (drag.reparentIndex === -1) drag.reparentIndex = 0;

          if (drag.indicator) {
            const innerRect = innerRef.current?.getBoundingClientRect();
            if (innerRect) {
              const indent = 12 + targetDepth * 16;
              drag.indicator.style.display = "block";
              drag.indicator.style.top = `${rect.top - innerRect.top - 1}px`;
              drag.indicator.style.left = `${indent}px`;
            }
          }
        } else if (relY > 0.75 && targetParent) {
          // After target — insert in target's parent after target
          drag.mode = "reparent";
          drag.reparentTarget = targetParent;
          const targetSiblings = getVisibleChildren(targetParent, visualOrderMap);
          drag.reparentIndex = targetSiblings.indexOf(target.element) + 1;

          if (drag.indicator) {
            const innerRect = innerRef.current?.getBoundingClientRect();
            if (innerRect) {
              const indent = 12 + targetDepth * 16;
              drag.indicator.style.display = "block";
              drag.indicator.style.top = `${rect.bottom - innerRect.top - 1}px`;
              drag.indicator.style.left = `${indent}px`;
            }
          }
        } else {
          // Middle — reparent INTO target as last child
          drag.mode = "reparent";
          drag.reparentTarget = target.element;
          drag.reparentIndex = getVisibleChildren(target.element, visualOrderMap).length;

          // Hide indicator line, show highlight on target node
          if (drag.indicator) drag.indicator.style.display = "none";
          target.treeNode.classList.add("reparent-target");
          drag.highlightedNode = target.treeNode;
        }

        // Expand-on-hover: auto-expand collapsed nodes after 500ms
        const targetKey = getStableKey(target.element);
        if (targetKey !== drag.lastHoverKey) {
          if (drag.expandTimer) clearTimeout(drag.expandTimer);
          drag.lastHoverKey = targetKey;
          const hasChildren = getVisibleChildren(target.element, visualOrderMap).length > 0;
          if (hasChildren && !expandedSet.has(target.element)) {
            drag.expandTimer = setTimeout(() => {
              setExpandedSet(prev => {
                const next = new Set(prev);
                next.add(target.element);
                return next;
              });
            }, 500);
          }
        }
      }
    }

    // Auto-scroll
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      const scrollRect = scrollEl.getBoundingClientRect();
      const distFromTop = e.clientY - scrollRect.top;
      const distFromBottom = scrollRect.bottom - e.clientY;

      if (distFromTop < AUTO_SCROLL_ZONE && scrollEl.scrollTop > 0) {
        scrollEl.scrollTop -= AUTO_SCROLL_SPEED * (1 - distFromTop / AUTO_SCROLL_ZONE);
        snapshotSiblingRects();
      } else if (distFromBottom < AUTO_SCROLL_ZONE) {
        scrollEl.scrollTop += AUTO_SCROLL_SPEED * (1 - distFromBottom / AUTO_SCROLL_ZONE);
        snapshotSiblingRects();
      }
    }
  }, [expandedSet, treeNodeRefs, snapshotSiblingRects, createGhost, createIndicator, positionIndicator, cleanupDrag, findTargetElement, getElementDepth, visualOrderMap]);

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

    const { element, dragIndex, dropIndex, mode, reparentTarget, reparentIndex, wasExpanded } = drag;
    cleanupDrag();

    if (mode === "reparent" && reparentTarget && onTreeReparent) {
      // Reparent: move element to a different parent
      onTreeReparent(element, reparentTarget, reparentIndex);
    } else if (mode === "reorder" && dropIndex !== dragIndex && onTreeReorder) {
      // Reorder within siblings
      onTreeReorder(element, dragIndex, dropIndex);
    } else if (wasExpanded) {
      // No-op / cancel — restore expand state
      setExpandedSet(prev => {
        const next = new Set(prev);
        next.add(element);
        return next;
      });
    }
  }, [onSelect, onTreeReorder, onTreeReparent, cleanupDrag, handlePointerMove]);

  const handleDragStart = useCallback((e: PointerEvent, element: Element) => {
    // Don't drag if no handlers at all
    if (!onTreeReorder && !onTreeReparent) return;

    const parent = element.parentElement;
    if (!parent) return;

    const siblings = getVisibleChildren(parent, visualOrderMap);
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
      mode: null,
      reparentTarget: null,
      reparentIndex: 0,
      expandTimer: null,
      lastHoverKey: null,
      highlightedNode: null,
    };

    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("pointerup", handlePointerUp, true);
  }, [onTreeReorder, onTreeReparent, visualOrderMap, handlePointerMove, handlePointerUp]);

  const bodyChildren = typeof document !== "undefined"
    ? getVisibleChildren(document.body, undefined, reparentEntries)
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
            reparentEntries={reparentEntries}
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
