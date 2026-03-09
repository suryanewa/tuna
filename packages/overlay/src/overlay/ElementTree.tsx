/**
 * ElementTree — DOM tree navigator panel.
 * Shows a collapsible tree starting from <body>, with React component
 * names when available. Click to select, hover to highlight.
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

/** Get visible children of an element, filtering out Retune overlay and skip tags */
function getVisibleChildren(el: Element): Element[] {
  const children: Element[] = [];
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i];
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

// ── Tree Node ──

interface TreeNodeProps {
  element: Element;
  depth: number;
  selectedElement: Element | null;
  expandedSet: Set<Element>;
  onToggle: (el: Element) => void;
  onSelect: (el: Element) => void;
  onHover: (el: Element | null) => void;
}

const TreeNode = memo(function TreeNode({
  element,
  depth,
  selectedElement,
  expandedSet,
  onToggle,
  onSelect,
  onHover,
}: TreeNodeProps) {
  const children = getVisibleChildren(element);
  const hasChildren = children.length > 0;
  const isExpanded = expandedSet.has(element);
  const isSelected = element === selectedElement;
  const { tag, qualifier, component } = formatNodeLabel(element);

  return (
    <>
      <div
        className={`retune-tree-node${isSelected ? " selected" : ""}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(element);
        }}
        onPointerEnter={() => onHover(element)}
        onPointerLeave={() => onHover(null)}
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
        {component && <span className="retune-tree-component">{component}</span>}
      </div>
      {isExpanded && children.map((child, i) => (
        <TreeNode
          key={i}
          element={child}
          depth={depth + 1}
          selectedElement={selectedElement}
          expandedSet={expandedSet}
          onToggle={onToggle}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </>
  );
});

// ── Element Tree ──

export function ElementTree({ selectedElement, onSelect, onHover }: ElementTreeProps) {
  const [expandedSet, setExpandedSet] = useState<Set<Element>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevSelectedRef = useRef<Element | null>(null);

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

  const bodyChildren = typeof document !== "undefined"
    ? getVisibleChildren(document.body)
    : [];

  return (
    <div className="retune-tree" ref={scrollRef}>
      <div className="retune-tree-inner">
        {bodyChildren.map((child, i) => (
          <TreeNode
            key={i}
            element={child}
            depth={0}
            selectedElement={selectedElement}
            expandedSet={expandedSet}
            onToggle={handleToggle}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}
      </div>
    </div>
  );
}
