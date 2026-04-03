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

/** Text-like tags that get the T icon and text preview */
const TEXT_TAGS = new Set([
  "P", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "LABEL", "A",
  "LI", "TD", "TH", "BLOCKQUOTE", "FIGCAPTION", "CAPTION", "LEGEND",
  "DT", "DD", "EM", "STRONG", "B", "I", "SMALL", "MARK", "DEL", "INS", "SUB", "SUP",
  "ABBR", "CITE", "CODE", "PRE", "TIME",
]);

/** Image-like tags */
const IMAGE_TAGS = new Set(["IMG", "PICTURE", "VIDEO", "CANVAS"]);

/** Determine the layer icon type based on element and computed layout */
type LayerIconType = "frame-h" | "frame-v" | "grid" | "block" | "text" | "image" | "component" | "svg" | "input";

function getLayerIcon(el: Element, component: string | null): LayerIconType {
  if (component) return "component";
  if (TEXT_TAGS.has(el.tagName)) return "text";
  if (IMAGE_TAGS.has(el.tagName)) return "image";
  if (el.tagName === "SVG" || el.tagName === "svg") return "svg";
  if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.tagName === "BUTTON") return "input";

  // Layout-based icon for container elements
  try {
    const style = getComputedStyle(el as HTMLElement);
    const display = style.display;
    if (display === "grid" || display === "inline-grid") return "grid";
    if (display === "flex" || display === "inline-flex") {
      const dir = style.flexDirection;
      return (dir === "row" || dir === "row-reverse") ? "frame-h" : "frame-v";
    }
  } catch {}

  return "block";
}

/** Get the direct text content of an element (not from children) */
function getDirectText(el: Element): string | null {
  let text = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || "";
    }
  }
  text = text.trim();
  return text.length > 0 ? text : null;
}

/** Format label for a tree node — Figma-style: icon type + display name */
function formatNodeLabel(el: Element): {
  iconType: LayerIconType;
  name: string;
  component: string | null;
} {
  const component = getDirectReactComponent(el);
  const iconType = getLayerIcon(el, component);
  const tag = el.tagName.toLowerCase();

  // Component root — use component name
  if (component) {
    return { iconType, name: component, component };
  }

  // Text elements — show text preview
  if (iconType === "text") {
    const text = getDirectText(el) || el.textContent?.trim() || "";
    if (text.length > 0) {
      const preview = text.length > 24 ? text.slice(0, 22) + "..." : text;
      return { iconType, name: preview, component: null };
    }
  }

  // Class name as layer name
  if (el.className && typeof el.className === "string") {
    const first = el.className.trim().split(/\s+/)[0];
    if (first) return { iconType, name: first, component: null };
  }

  // ID as layer name
  if (el.id) {
    return { iconType, name: `#${el.id}`, component: null };
  }

  // Fallback to tag name
  return { iconType, name: tag, component: null };
}

/** Inline SVG icons for the layer tree (16x16, currentColor) */
function LayerIcon({ type }: { type: LayerIconType }) {
  switch (type) {
    case "frame-v":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M3.00488 6.10254C3.05621 6.60667 3.48232 7 4 7L12 7L12.1025 6.99512C12.6067 6.94379 13 6.51768 13 6L13 4C13 3.48232 12.6067 3.05621 12.1025 3.00488L12 3L4 3C3.44772 3 3 3.44772 3 4L3 6L3.00488 6.10254ZM3.00488 12.1025C3.05621 12.6067 3.48232 13 4 13L12 13L12.1025 12.9951C12.573 12.9472 12.9472 12.573 12.9951 12.1025L13 12L13 10L12.9951 9.89746C12.9472 9.42703 12.573 9.05278 12.1025 9.00488L12 9L4 9C3.48232 9 3.05621 9.39333 3.00488 9.89746L3 10L3 12L3.00488 12.1025ZM12 4L12 6L4 6L4 4L12 4ZM12 10L12 12L4 12L4 10L12 10Z" fill="currentColor" fillOpacity={0.9} />
        </svg>
      );
    case "frame-h":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M6.10254 12.9951C6.60667 12.9438 7 12.5177 7 12L7 4L6.99512 3.89746C6.94379 3.39333 6.51768 3 6 3L4 3C3.48232 3 3.05621 3.39333 3.00488 3.89746L3 4L3 12C3 12.5523 3.44772 13 4 13L6 13L6.10254 12.9951ZM12.1025 12.9951C12.6067 12.9438 13 12.5177 13 12L13 4L12.9951 3.89746C12.9472 3.42703 12.573 3.05278 12.1025 3.00488L12 3L10 3L9.89746 3.00488C9.42703 3.05278 9.05278 3.42703 9.00488 3.89746L9 4L9 12C9 12.5177 9.39333 12.9438 9.89746 12.9951L10 13L12 13L12.1025 12.9951ZM4 4L6 4L6 12L4 12L4 4ZM10 4L12 4L12 12L10 12L10 4Z" fill="currentColor" fillOpacity={0.9} />
        </svg>
      );
    case "grid":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="3.5" y="3.5" width="3.5" height="3.5" rx="0.75" stroke="currentColor" />
          <rect x="9" y="3.5" width="3.5" height="3.5" rx="0.75" stroke="currentColor" />
          <rect x="3.5" y="9" width="3.5" height="3.5" rx="0.75" stroke="currentColor" />
          <rect x="9" y="9" width="3.5" height="3.5" rx="0.75" stroke="currentColor" />
        </svg>
      );
    case "block":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M11.5 4H4.5C4.22386 4 4 4.22386 4 4.5V11.5C4 11.7761 4.22386 12 4.5 12H11.5C11.7761 12 12 11.7761 12 11.5V4.5C12 4.22386 11.7761 4 11.5 4ZM4.5 3C3.67157 3 3 3.67157 3 4.5V11.5C3 12.3284 3.67157 13 4.5 13H11.5C12.3284 13 13 12.3284 13 11.5V4.5C13 3.67157 12.3284 3 11.5 3H4.5Z" fill="currentColor" fillOpacity={0.9} />
        </svg>
      );
    case "text":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M3 3.5C3 3.22386 3.22386 3 3.5 3H8H12.5C12.7761 3 13 3.22386 13 3.5V5C13 5.27614 12.7761 5.5 12.5 5.5C12.2239 5.5 12 5.27614 12 5V4H8.5V12H9.5C9.77614 12 10 12.2239 10 12.5C10 12.7761 9.77614 13 9.5 13H8H6.5C6.22386 13 6 12.7761 6 12.5C6 12.2239 6.22386 12 6.5 12H7.5V4H4V5C4 5.27614 3.77614 5.5 3.5 5.5C3.22386 5.5 3 5.27614 3 5V3.5Z" fill="currentColor" fillOpacity={0.9} />
        </svg>
      );
    case "image":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M11.5 4H4.5C4.22386 4 4 4.22386 4 4.5V9.79289L6.14645 7.64645C6.34171 7.45118 6.65829 7.45118 6.85355 7.64645L11.2071 12H11.5C11.7761 12 12 11.7761 12 11.5V4.5C12 4.22386 11.7761 4 11.5 4ZM3 10.9999V11.0001V11.5C3 12.3284 3.67157 13 4.5 13H10.9995H11.0005H11.5C12.3284 13 13 12.3284 13 11.5V4.5C13 3.67157 12.3284 3 11.5 3H4.5C3.67157 3 3 3.67157 3 4.5V10.9999ZM4.5 12H9.79289L6.5 8.70711L4 11.2071V11.5C4 11.7761 4.22386 12 4.5 12ZM9.5 7.5C10.0523 7.5 10.5 7.05228 10.5 6.5C10.5 5.94772 10.0523 5.5 9.5 5.5C8.94772 5.5 8.5 5.94772 8.5 6.5C8.5 7.05228 8.94772 7.5 9.5 7.5Z" fill="currentColor" fillOpacity={0.9} />
        </svg>
      );
    case "component":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M8 5.83824L6.66041 4.5L8 3.16176L9.33959 4.5L8 5.83824ZM7.56946 2.17837L5.6796 4.06632C5.44013 4.30554 5.44013 4.69446 5.6796 4.93368L7.56946 6.82163C7.80753 7.05946 8.19247 7.05946 8.43054 6.82163L10.3204 4.93368C10.5599 4.69446 10.5599 4.30554 10.3204 4.06632L8.43054 2.17837C8.19247 1.94054 7.80753 1.94054 7.56946 2.17837ZM10.1618 8L11.5 6.66041L12.8382 8L11.5 9.33959L10.1618 8ZM9.17837 8.43054L11.0663 10.3204C11.3055 10.5599 11.6945 10.5599 11.9337 10.3204L13.8216 8.43054C14.0595 8.19247 14.0595 7.80753 13.8216 7.56946L11.9337 5.6796C11.6945 5.44013 11.3055 5.44013 11.0663 5.6796L9.17837 7.56946C8.94054 7.80753 8.94054 8.19247 9.17837 8.43054ZM6.66041 11.5L8 12.8382L9.33959 11.5L8 10.1618L6.66041 11.5ZM5.6796 11.0663L7.56946 9.17837C7.80753 8.94054 8.19247 8.94054 8.43054 9.17837L10.3204 11.0663C10.5599 11.3055 10.5599 11.6945 10.3204 11.9337L8.43054 13.8216C8.19247 14.0595 7.80753 14.0595 7.56946 13.8216L5.6796 11.9337C5.44013 11.6945 5.44013 11.3055 5.6796 11.0663ZM3.16176 8L4.5 6.66041L5.83824 8L4.5 9.33959L3.16176 8ZM2.17837 8.43054L4.06632 10.3204C4.30554 10.5599 4.69446 10.5599 4.93368 10.3204L6.82163 8.43054C7.05946 8.19247 7.05946 7.80753 6.82163 7.56946L4.93368 5.6796C4.69446 5.44013 4.30554 5.44013 4.06632 5.6796L2.17837 7.56946C1.94054 7.80753 1.94054 8.19247 2.17837 8.43054Z" fill="currentColor" fillOpacity={0.9} />
        </svg>
      );
    case "svg":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M11.5 4H4.5C4.22386 4 4 4.22386 4 4.5V11.5C4 11.7761 4.22386 12 4.5 12H11.5C11.7761 12 12 11.7761 12 11.5V4.5C12 4.22386 11.7761 4 11.5 4ZM4.5 3C3.67157 3 3 3.67157 3 4.5V11.5C3 12.3284 3.67157 13 4.5 13H11.5C12.3284 13 13 12.3284 13 11.5V4.5C13 3.67157 12.3284 3 11.5 3H4.5Z" fill="currentColor" fillOpacity={0.9} />
        </svg>
      );
    case "input":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M11.5 4H4.5C4.22386 4 4 4.22386 4 4.5V11.5C4 11.7761 4.22386 12 4.5 12H11.5C11.7761 12 12 11.7761 12 11.5V4.5C12 4.22386 11.7761 4 11.5 4ZM4.5 3C3.67157 3 3 3.67157 3 4.5V11.5C3 12.3284 3.67157 13 4.5 13H11.5C12.3284 13 13 12.3284 13 11.5V4.5C13 3.67157 12.3284 3 11.5 3H4.5Z" fill="currentColor" fillOpacity={0.9} />
        </svg>
      );
  }
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
  const isDescendantOfSelected = !isSelected && selectedElement ? selectedElement.contains(element) : false;
  const { iconType, name, component } = formatNodeLabel(element);
  const isComponent = iconType === "component";

  return (
    <>
      <div
        ref={(node) => { if (node) treeNodeRefs.set(element, node); }}
        data-retune-tree-key={getStableKey(element)}
        className={`retune-tree-node${isSelected ? " selected" : ""}${isDescendantOfSelected ? " descendant-selected" : ""}`}
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
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M9.76754 6.76778C9.9628 6.57252 10.2803 6.57252 10.4755 6.76778C10.6705 6.96298 10.6705 7.27962 10.4755 7.47482L7.99996 9.94942L5.52535 7.47482C5.33009 7.27955 5.33009 6.96305 5.52535 6.76778C5.72061 6.57252 6.03712 6.57252 6.23238 6.76778L7.99996 8.53536L9.76754 6.76778Z" fill="currentColor" fillOpacity="0.9" />
            </svg>
          )}
        </span>
        <span className={`retune-tree-icon${isComponent ? " retune-tree-icon--component" : ""}`}>
          <LayerIcon type={iconType} />
        </span>
        <span className={`retune-tree-name${isComponent ? " retune-tree-name--component" : ""}`}>{name}</span>
        {isReparented && <span className="retune-tree-moved">moved</span>}
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
    const { name } = formatNodeLabel(element);
    const ghost = document.createElement("div");
    ghost.className = "retune-tree-ghost";
    ghost.textContent = name;
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
