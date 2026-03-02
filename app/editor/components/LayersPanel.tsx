"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useYjsEditor } from "./YjsEditorContext";
import { useEditorMutations, useSelectedIds, useFocusedContainerId, useIsAdmin } from "./context";
import { useContextMenu, ContextMenu, type ContextMenuItemDef } from "./ui/context-menu";
import { elementClipboard } from "./YjsEditorContext";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./ui/section-header";
import { IconButton } from "./ui/icon-button";
import { CollapseLayersSmall } from "@/components/icons/editor";
import {
  FrameVertical16,
  FrameHorizontal16,
  Text16,
  Image16,
  Rectangle16,
  Ellipse16,
  Star16,
  Line16,
  Link16,
  Shader16,
  ComponentSmall16,
  ChevronRight16,
  LockLocked16,
  LockUnlocked16,
  Visible16,
  Hidden16,
  Plus16,
  Home16,
  Page16,
} from "@/components/icons/editor-16";
import { nameToSlug } from "@/lib/playground/slug-utils";
import type { CanvasElement, ElementType } from "@/lib/playground/store";

// ─── Helpers ─────────────────────────────────────────────────────────────

function isDescendantOf(
  potentialAncestorId: string,
  targetId: string,
  elements: Record<string, CanvasElement>
): boolean {
  let current = elements[targetId];
  while (current?.parentId) {
    if (current.parentId === potentialAncestorId) return true;
    current = elements[current.parentId];
  }
  return false;
}

// ─── Drag state (module-level so all LayerRow instances share it) ────────
let draggedElementId: string | null = null;
let indicatorElement: HTMLDivElement | null = null;
let intoHighlightElement: HTMLDivElement | null = null;
let lastDropPosition: { elementId: string; position: "before" | "after" | "into" } | null = null;

// ─── Artboard layer virtual ID ──────────────────────────────────────────
import { ARTBOARD_LAYER_ID } from "@/lib/playground/store";

// ─── Layer context menu (module-level ref for LayerRow → LayersPanel) ────
const layerContextMenuRef = {
  open: null as ((x: number, y: number, elementId: string) => void) | null,
};

// ─── Page drag state (separate from element drag) ───────────────────────
let draggedPageId: string | null = null;
let pageIndicatorElement: HTMLDivElement | null = null;
let lastPageDropPosition: { pageId: string; position: "before" | "after" } | null = null;

// ─── Transparent drag image (hides browser ghost) ───────────────────────
const transparentDragImage = (() => {
  if (typeof document === "undefined") return null;
  const img = new Image();
  img.src =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  return img;
})();

// ─── Icon mapping ──────────────────────────────────────────────────────

function getLayerIcon(element: CanvasElement): React.ComponentType<{ className?: string }> {
  if (element.type === "container") {
    const dir = element.tailwindStyles?.flexDirection;
    return dir === "flex-row" || dir === "flex-row-reverse"
      ? FrameHorizontal16
      : FrameVertical16;
  }
  const map: Record<ElementType, React.ComponentType<{ className?: string }>> = {
    heading: Text16,
    text: Text16,
    image: Image16,
    button: Rectangle16,
    badge: Rectangle16,
    divider: Line16,
    sticker: Rectangle16,
    link: Link16,
    shape: Rectangle16,
    container: FrameVertical16,
    rectangle: Rectangle16,
    circle: Ellipse16,
    star: Star16,
    video: Image16,
    gif: Image16,
    component: ComponentSmall16,
    shader: Shader16,
  };
  return map[element.type] || Rectangle16;
}

// ─── LayerRow ──────────────────────────────────────────────────────────

interface LayerRowProps {
  elementId: string;
  depth: number;
  isElementCollapsed: (id: string) => boolean;
  toggleExpand: (id: string) => void;
  isDescendantOfSelected: (id: string) => boolean;
}

function LayerRow({
  elementId,
  depth,
  isElementCollapsed,
  toggleExpand,
  isDescendantOfSelected,
}: LayerRowProps) {
  const { elements } = useYjsEditor();
  const {
    selectElement,
    toggleElementSelection,
    rangeSelectElements,
    setFocusedContainer,
    hoverElement,
    reorderElement,
    dropElementDirect,
    reparentIntoContainer,
    updateElement,
    toggleVisibility,
    toggleLock,
    isElementEffectivelyHidden,
    deleteElement,
    duplicateElement,
    wrapInContainer,
    ungroupContainer,
  } = useEditorMutations();
  const selectedIds = useSelectedIds();
  const focusedContainerId = useFocusedContainerId();
  const isAdmin = useIsAdmin();

  const element = elements[elementId];
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState("");

  if (!element) return null;

  const hasChildren = element.children && element.children.length > 0;
  const isSelected = selectedIds.includes(elementId);
  const isDescendant = isDescendantOfSelected(elementId);
  const isExpanded = !isElementCollapsed(elementId);
  const isEffectivelyHidden = isElementEffectivelyHidden(elementId);
  const isSelfHidden = !!element.hidden;
  const isLocked = !!element.locked;
  const hasAlwaysVisibleButton = isLocked || isSelfHidden;

  const LayerIcon = getLayerIcon(element);
  const displayName =
    element.name || element.content?.slice(0, 20) || element.type;

  // ── Drag handlers ──

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-element-id", elementId);
    if (transparentDragImage) {
      e.dataTransfer.setDragImage(transparentDragImage, 0, 0);
    }
    draggedElementId = elementId;
    if (!isSelected) {
      selectElement(elementId);
    }
  };

  const handleDragEnd = () => {
    draggedElementId = null;
    lastDropPosition = null;
    if (indicatorElement) indicatorElement.style.display = "none";
    if (intoHighlightElement) intoHighlightElement.style.display = "none";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedElementId === elementId) {
      // Hide indicators when cursor is over the dragged element itself
      if (indicatorElement) indicatorElement.style.display = "none";
      if (intoHighlightElement) intoHighlightElement.style.display = "none";
      lastDropPosition = null;
      return;
    }

    // Prevent dropping a parent into its own descendant
    if (draggedElementId && isDescendantOf(draggedElementId, elementId, elements)) {
      if (indicatorElement) indicatorElement.style.display = "none";
      if (intoHighlightElement) intoHighlightElement.style.display = "none";
      lastDropPosition = null;
      return;
    }

    e.dataTransfer.dropEffect = "move";

    const row = e.currentTarget as HTMLElement;
    const rect = row.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    const isContainer = element?.type === "container";

    let zone: "before" | "after" | "into";
    if (ratio < 0.25) zone = "before";
    else if (ratio > 0.75) zone = "after";
    else if (isContainer) zone = "into";
    else zone = ratio < 0.5 ? "before" : "after";

    lastDropPosition = { elementId, position: zone };

    if (zone === "into") {
      // Show container highlight, hide line indicator
      if (indicatorElement) indicatorElement.style.display = "none";
      if (intoHighlightElement) {
        const wrapper = intoHighlightElement.parentElement;
        if (wrapper) {
          const wrapperRect = wrapper.getBoundingClientRect();
          const y = rect.top - wrapperRect.top;
          intoHighlightElement.style.top = `${y}px`;
          intoHighlightElement.style.height = `${rect.height}px`;
          intoHighlightElement.style.display = "block";
        }
      }
    } else {
      // Show line indicator, hide container highlight
      if (intoHighlightElement) intoHighlightElement.style.display = "none";
      if (indicatorElement) {
        const wrapper = indicatorElement.parentElement;
        if (wrapper) {
          const wrapperRect = wrapper.getBoundingClientRect();
          const y = (zone === "before" ? rect.top : rect.bottom) - wrapperRect.top;
          indicatorElement.style.top = `${y - 1}px`;
          indicatorElement.style.display = "block";
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData("application/x-element-id");
    if (!draggedId || draggedId === elementId) return;
    if (isDescendantOf(draggedId, elementId, elements)) return;

    const pos = lastDropPosition?.elementId === elementId
      ? lastDropPosition.position : "after";

    if (pos === "into") {
      reparentIntoContainer(draggedId, elementId, -1); // append as last child
    } else {
      const draggedEl = elements[draggedId];
      const targetEl = elements[elementId];
      if (draggedEl?.parentId === targetEl?.parentId) {
        reorderElement(draggedId, elementId, pos);
      } else {
        dropElementDirect(draggedId, elementId, pos);
      }
    }

    if (indicatorElement) indicatorElement.style.display = "none";
    if (intoHighlightElement) intoHighlightElement.style.display = "none";
    lastDropPosition = null;
  };

  // ── Rename handlers ──

  const handleStartRename = () => {
    setEditName(displayName);
    setIsRenaming(true);
  };

  const handleSaveRename = () => {
    if (editName.trim()) {
      updateElement(elementId, { name: editName.trim() });
    }
    setIsRenaming(false);
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setEditName("");
  };

  // ── Click handler ──

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey) {
      if (e.shiftKey) {
        rangeSelectElements(elementId, true);
      } else {
        toggleElementSelection(elementId);
      }
    } else if (e.shiftKey) {
      rangeSelectElements(elementId, false);
    } else {
      selectElement(elementId);
      // Sync focus level with the clicked element's parent container
      const el = elements[elementId];
      const parentContainerId =
        el?.parentId && elements[el.parentId]?.type === "container"
          ? el.parentId
          : null;
      if (parentContainerId !== focusedContainerId) {
        setFocusedContainer(parentContainerId);
      }
    }
  };

  return (
    <div>
      {/* Row */}
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "group flex items-center h-8 cursor-default",
          isSelected && "bg-blue-100 dark:bg-blue-900/30",
          !isSelected && isDescendant && "bg-blue-50 dark:bg-blue-950/50",
          !isSelected && !isDescendant && "hover:bg-stone-100 dark:hover:bg-stone-800/50",
        )}
        style={{
          paddingLeft: `${12 + depth * 20}px`,
          userSelect: "none",
        }}
        onClick={handleClick}
        onMouseEnter={() => hoverElement(elementId)}
        onMouseLeave={() => hoverElement(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          layerContextMenuRef.open?.(e.clientX, e.clientY, elementId);
        }}
      >
        {/* Content div — gets dimmed when hidden */}
        <div
          className={cn(
            "flex items-center gap-1 flex-1",
            isEffectivelyHidden && "opacity-50"
          )}
        >
          {/* Chevron */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(elementId);
              }}
              className="flex-shrink-0 w-4 h-4 flex items-center justify-center"
            >
              <ChevronRight16
                className={cn(
                  "w-4 h-4 transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
            </button>
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}

          {/* Type icon */}
          <LayerIcon className={cn("w-4 h-4 flex-shrink-0", element.type === "component" ? "text-purple-600 dark:text-purple-400" : "text-stone-500 dark:text-stone-400", !isSelected && "opacity-50")} />

          {/* Name */}
          {isRenaming ? (
            <input
              ref={(el) => el?.focus({ preventScroll: true })}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRename();
                if (e.key === "Escape") handleCancelRename();
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] leading-4 tracking-[0.055px] font-[450] bg-white dark:bg-stone-900 shadow-[inset_0_0_0_1px_#3b82f6] rounded px-1 -mx-1 py-0.5 -my-0.5 focus:outline-none min-w-0 flex-1"
            />
          ) : (
            <span
              className={cn("text-[11px] leading-4 tracking-[0.055px] font-[450] whitespace-nowrap", element.type === "component" ? "text-purple-600 dark:text-purple-400" : "text-stone-900 dark:text-stone-100")}
              onDoubleClick={isAdmin ? (e) => {
                e.stopPropagation();
                handleStartRename();
              } : undefined}
            >
              {displayName}
            </span>
          )}
        </div>

        {/* Action buttons — sticky to right edge, gradient masks text behind */}
        {!isRenaming && (
          <div
            className={cn(
              "sticky right-0 flex-shrink-0 self-stretch flex items-center gap-0.5 pl-12 pr-2",
              // Gradient at rest for always-visible buttons (locked/hidden)
              hasAlwaysVisibleButton && "bg-gradient-to-l from-50% to-transparent",
              hasAlwaysVisibleButton && (
                isSelected ? "from-blue-100 dark:from-blue-950"
                  : isDescendant ? "from-blue-50 dark:from-blue-950"
                  : "from-white dark:from-stone-950"
              ),
              // Gradient on hover
              "group-hover:bg-gradient-to-l group-hover:from-50% group-hover:to-transparent",
              isSelected ? "group-hover:from-blue-100 dark:group-hover:from-blue-950"
                : isDescendant ? "group-hover:from-blue-50 dark:group-hover:from-blue-950"
                : "group-hover:from-stone-100 dark:group-hover:from-stone-800"
            )}
          >
            <IconButton
              size="sm"
              icon={isLocked ? LockLocked16 : LockUnlocked16}
              onClick={(e) => { e.stopPropagation(); toggleLock(elementId); }}
              className={isLocked ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
              aria-label={isLocked ? "Unlock layer" : "Lock layer"}
            />
            <IconButton
              size="sm"
              icon={isSelfHidden ? Hidden16 : Visible16}
              onClick={(e) => { e.stopPropagation(); toggleVisibility(elementId); }}
              className={isSelfHidden ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
              aria-label={isSelfHidden ? "Show layer" : "Hide layer"}
            />
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {element.children!.map((childId) => (
            <LayerRow
              key={childId}
              elementId={childId}
              depth={depth + 1}
              isElementCollapsed={isElementCollapsed}
              toggleExpand={toggleExpand}
              isDescendantOfSelected={isDescendantOfSelected}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── LayersPanel ───────────────────────────────────────────────────────

export function LayersPanel() {
  const {
    elements, elementsArray,
    // Multi-page (data from Liveblocks storage)
    activePageId, pages, homepageId, pageStyles,
  } = useYjsEditor();
  const {
    clearSelection, selectElement, reparentIntoContainer,
    deleteElement: panelDeleteElement, duplicateElement: panelDuplicateElement,
    wrapInContainer, ungroupContainer: panelUngroupContainer,
    toggleVisibility: panelToggleVisibility, toggleLock: panelToggleLock,
    setActivePageId, addPage, deletePage, renamePage, duplicatePage,
    setHomepage, reorderPages, updatePage,
  } = useEditorMutations();
  const selectedIds = useSelectedIds();
  const isAdmin = useIsAdmin();
  // Snapshot element trees into the module-level clipboard
  function snapshotToClipboard(ids: string[]) {
    const snaps: Record<string, Record<string, unknown>> = {};
    function snap(id: string) {
      const el = elements[id];
      if (!el || snaps[id]) return;
      snaps[id] = { ...el };
      if (el.children) {
        for (const childId of el.children) snap(childId);
      }
    }
    for (const id of ids) snap(id);
    elementClipboard.rootIds = ids;
    elementClipboard.snapshots = snaps;
  }

  // Page name editing (for Pages section rows)
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState("");

  // Artboard layer rename state
  const [isRenamingArtboard, setIsRenamingArtboard] = useState(false);
  const [editArtboardName, setEditArtboardName] = useState("");

  // Context menu for page rows
  const pageMenu = useContextMenu<{ pageId: string }>();

  // Context menu for layer rows
  const layerMenu = useContextMenu<{ elementId: string }>();
  layerContextMenuRef.open = (x, y, id) => layerMenu.open(x, y, { elementId: id });

  // Collapsed state (inverted: absent = expanded by default)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isElementCollapsed = useCallback(
    (id: string) => collapsedIds.has(id),
    [collapsedIds]
  );

  // Auto-expand ancestor layers when selection changes (adjust state during render)
  const [prevSelectedIds, setPrevSelectedIds] = useState(selectedIds);
  if (selectedIds !== prevSelectedIds) {
    setPrevSelectedIds(selectedIds);

    if (selectedIds.length > 0) {
      const ancestorIds = new Set<string>();
      for (const id of selectedIds) {
        // If this is an artboard element, expand the artboard row
        if (elements[id]?.placement !== "canvas") {
          ancestorIds.add(ARTBOARD_LAYER_ID);
        }
        let current = elements[id]?.parentId;
        while (current) {
          ancestorIds.add(current);
          current = elements[current]?.parentId;
        }
      }
      const hasCollapsedAncestor = ancestorIds.size > 0 && Array.from(ancestorIds).some((a) => collapsedIds.has(a));
      if (hasCollapsedAncestor) {
        const next = new Set(collapsedIds);
        ancestorIds.forEach((a) => next.delete(a));
        setCollapsedIds(next);
      }
    }
  }

  const collapseAll = useCallback(() => {
    const containerIds = new Set<string>();
    containerIds.add(ARTBOARD_LAYER_ID);
    for (const el of elementsArray) {
      if (el.children && el.children.length > 0) {
        containerIds.add(el.id);
      }
    }
    setCollapsedIds(containerIds);
  }, [elementsArray]);

  // Descendant highlight
  const descendantOfSelectedIds = useMemo(() => {
    const ids = new Set<string>();
    const addDescendants = (parentId: string) => {
      const parent = elements[parentId];
      parent?.children?.forEach((childId) => {
        ids.add(childId);
        addDescendants(childId);
      });
    };
    selectedIds.forEach(addDescendants);
    return ids;
  }, [elements, selectedIds]);

  const isDescendantOfSelected = useCallback(
    (id: string) => descendantOfSelectedIds.has(id),
    [descendantOfSelectedIds]
  );

  // Root elements — split into artboard vs canvas
  const rootElements = elementsArray.filter(
    (el) => !el.parentId || el.parentId === "root"
  );
  const artboardRoots = rootElements.filter(el => el.placement !== "canvas");
  const canvasRoots = rootElements.filter(el => el.placement === "canvas");
  const isArtboardExpanded = !collapsedIds.has(ARTBOARD_LAYER_ID);
  const isArtboardSelected = selectedIds.includes(ARTBOARD_LAYER_ID);
  const activePage = pages.find(p => p.id === activePageId);
  const artboardName = activePage?.artboardName || "Frame";

  const hasExpandedContainers =
    (artboardRoots.length > 0 && isArtboardExpanded) ||
    elementsArray.some(
      (el) => el.children && el.children.length > 0 && !collapsedIds.has(el.id)
    );

  // Page rename handlers
  const commitPageRename = useCallback(() => {
    if (renamingPageId) {
      const trimmed = editingPageName.trim();
      if (trimmed) {
        renamePage(renamingPageId, trimmed);
      }
    }
    setRenamingPageId(null);
    setEditingPageName("");
  }, [renamingPageId, editingPageName, renamePage]);

  const handleDeletePage = useCallback((pageId: string) => {
    if (pages.length <= 1) return;
    if (!window.confirm("Delete this page? All elements on it will be permanently removed.")) return;
    deletePage(pageId);
  }, [pages.length, deletePage]);


  return (
    <div data-editor-panel className="w-64 flex-shrink-0 bg-card border-r border-border flex flex-col overflow-hidden select-none">
      {/* Branding header */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border flex-shrink-0">
        <svg width="32" height="32" className="shrink-0" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16.4733 22.4177C15.4026 23.4931 10.9612 22.6054 9.24184 22.8343C9.04894 22.847 8.83153 22.8655 8.64934 22.8523C8.24414 22.8386 8.01245 22.5532 8.01092 22.1154C8.00071 21.7077 8.03133 21.2684 8.05225 20.8501C8.07777 20.2583 8.04409 19.6629 8.02112 19.0711C8.01806 18.6075 7.95886 18.2462 8.05327 17.8838C8.14156 17.6238 8.40285 17.6549 8.6422 17.6491C10.2416 17.6465 12.3253 17.6417 13.8905 17.6391C14.5044 17.6132 14.6095 17.6713 14.9489 18.1866C15.2929 18.6702 15.6511 18.627 15.6874 18.0315C15.7195 17.3643 15.1755 16.8864 14.5708 16.8189C11.5394 16.3305 8.42378 12.8811 8.10431 10.3098C8.02265 9.55347 8.04307 9.15157 8.93615 9.11781C9.62817 9.07139 10.4268 9.12256 11.1382 9.15315C12.0099 9.19903 12.781 9.18743 13.5547 9.20906C14.0451 9.22119 14.5427 9.20853 15.0316 9.1811C15.3546 9.16528 15.7205 9.16686 15.9364 9.42056C16.2334 9.68428 16.089 10.6574 16.5366 10.6896C17.2842 10.5034 16.9525 9.20167 17.8935 9.11095C19.595 8.91105 21.4133 9.03869 23.1337 9.05663C23.4077 9.06085 23.7328 9.1215 23.8747 9.35727C23.967 9.49862 24.0038 9.69852 23.9997 9.93323C23.7012 14.859 16.7045 17.9735 15.0142 12.861C14.8821 12.5709 14.7249 12.0504 14.4672 12.0256C14.2814 12.0746 14.2952 12.5894 14.3335 12.8157C14.8224 16.1264 18.5922 16.3827 21.4317 16.9829C22.0033 17.0689 22.6524 17.0884 23.174 17.2192C24.139 17.4872 23.9971 18.0246 23.9425 19.06C23.8946 19.6391 23.8446 20.3301 23.8349 20.9361C23.8736 22.6128 23.7899 23.0052 22.0349 22.9999C21.5108 22.991 20.9755 22.9377 20.4513 22.914C19.7859 22.8823 19.2444 22.9314 18.6948 22.7579C17.4945 22.4219 16.906 21.1239 16.7325 21.6133C16.6539 21.8396 16.6407 22.1666 16.4784 22.4097L16.4738 22.4166L16.4733 22.4177Z" fill="currentColor"/>
        </svg>
        <span className="text-xs font-semibold leading-4 text-stone-900 dark:text-stone-100">
          Sujan Khadgi&apos;s Portfolio
        </span>
      </div>

      {/* ── Pages Section ── */}
      <SectionHeader
        title="Pages"
        iconButton={isAdmin ? {
          icon: Plus16,
          onClick: addPage,
          "aria-label": "Add page",
        } : undefined}
      />
      <div className="relative max-h-40 overflow-y-auto overscroll-none flex-shrink-0 border-b border-stone-200 dark:border-stone-800 pb-2">
        {pages.map((page) => {
          const isActive = page.id === activePageId;
          const isRenaming = renamingPageId === page.id;
          const isHomepage = page.isHomepage ?? (page.id === homepageId);
          const slug = page.slug || nameToSlug(page.name);

          return (
            <div
              key={page.id}
              className="px-2"
              draggable={isAdmin}
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("application/x-page-id", page.id);
                if (transparentDragImage) e.dataTransfer.setDragImage(transparentDragImage, 0, 0);
                draggedPageId = page.id;
              }}
              onDragEnd={() => {
                draggedPageId = null;
                lastPageDropPosition = null;
                if (pageIndicatorElement) pageIndicatorElement.style.display = "none";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedPageId === page.id) {
                  if (pageIndicatorElement) pageIndicatorElement.style.display = "none";
                  lastPageDropPosition = null;
                  return;
                }
                e.dataTransfer.dropEffect = "move";
                const row = e.currentTarget as HTMLElement;
                const rect = row.getBoundingClientRect();
                const ratio = (e.clientY - rect.top) / rect.height;
                const zone: "before" | "after" = ratio < 0.5 ? "before" : "after";
                lastPageDropPosition = { pageId: page.id, position: zone };
                if (pageIndicatorElement) {
                  const wrapper = pageIndicatorElement.parentElement;
                  if (wrapper) {
                    const wrapperRect = wrapper.getBoundingClientRect();
                    const y = (zone === "before" ? rect.top : rect.bottom) - wrapperRect.top;
                    pageIndicatorElement.style.top = `${y - 1}px`;
                    pageIndicatorElement.style.display = "block";
                  }
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const droppedId = e.dataTransfer.getData("application/x-page-id");
                if (!droppedId || droppedId === page.id) return;
                const pos = lastPageDropPosition?.pageId === page.id ? lastPageDropPosition.position : "after";
                const currentOrder = pages.map(p => p.id);
                const fromIndex = currentOrder.indexOf(droppedId);
                if (fromIndex === -1) return;
                currentOrder.splice(fromIndex, 1);
                const toIndex = currentOrder.indexOf(page.id);
                currentOrder.splice(pos === "before" ? toIndex : toIndex + 1, 0, droppedId);
                reorderPages(currentOrder);
                if (pageIndicatorElement) pageIndicatorElement.style.display = "none";
                lastPageDropPosition = null;
              }}
              onClick={() => {
                if (!isActive) setActivePageId(page.id);
              }}
              onContextMenu={(e) => pageMenu.onContextMenu(e, { pageId: page.id })}
            >
              <div className={cn(
                "flex items-center gap-1 px-1.5 rounded-md cursor-default",
                isRenaming ? "py-1.5" : "py-2",
                isActive && "bg-stone-100 dark:bg-stone-800/50"
              )}>
                {isHomepage ? (
                  <Home16 className={cn("w-4 h-4 flex-shrink-0 text-stone-900 dark:text-stone-100", !isActive && "opacity-50")} />
                ) : (
                  <Page16 className={cn("w-4 h-4 flex-shrink-0 text-stone-900 dark:text-stone-100", !isActive && "opacity-50")} />
                )}
                {isRenaming ? (
                  <input
                    ref={(el) => el?.focus({ preventScroll: true })}
                    className="text-[11px] leading-4 tracking-[0.055px] font-[450] text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-900 outline-none shadow-[inset_0_0_0_1px_#3b82f6] rounded px-1 h-5 w-full min-w-0"
                    value={editingPageName}
                    onChange={(e) => setEditingPageName(e.target.value)}
                    onBlur={commitPageRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitPageRename();
                      if (e.key === "Escape") { setRenamingPageId(null); setEditingPageName(""); }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className={cn(
                      "text-[11px] leading-4 tracking-[0.055px] whitespace-nowrap truncate",
                      isActive ? "font-medium text-stone-900 dark:text-stone-100" : "font-medium text-stone-900 dark:text-stone-100"
                    )}
                    onDoubleClick={isAdmin ? (e) => {
                      e.stopPropagation();
                      setEditingPageName(page.name);
                      setRenamingPageId(page.id);
                    } : undefined}
                  >
                    {isHomepage ? "Home" : `/${slug}`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {/* Page drag indicator */}
        <div
          ref={(el) => { pageIndicatorElement = el; }}
          className="absolute left-0 right-0 h-0.5 bg-blue-500 z-20 pointer-events-none"
          style={{ display: "none", top: 0 }}
        />
      </div>

      {/* ── Layers Section ── */}
      <SectionHeader
        title="Layers"
        iconButton={hasExpandedContainers ? {
          icon: CollapseLayersSmall,
          onClick: collapseAll,
          "aria-label": "Collapse all layers",
        } : undefined}
      />

      {/* Layer Tree */}
      {(() => {
        const isLegacyComponentPage = !!activePage?.component && !activePage?.provider;

        if (isLegacyComponentPage) {
          return (
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <div className="flex items-center gap-2 h-8 px-1 text-[11px] text-stone-500 dark:text-stone-400">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 opacity-60">
                  <path d="M11.5 1a2.5 2.5 0 0 1 2.45 2.01L14 3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2l-.05-.01A2.5 2.5 0 0 1 11.5 15h-7A2.5 2.5 0 0 1 2.05 12.99L2 13a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2l.05.01A2.5 2.5 0 0 1 4.5 1h7ZM5 7.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5V8a.5.5 0 0 0-.5-.5H5Zm5-1a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5V7a.5.5 0 0 0-.5-.5h-1Z" fill="currentColor"/>
                </svg>
                <span>Component: {activePage?.name}</span>
              </div>
            </div>
          );
        }

        return (
          <div
            className="flex-1 overflow-y-auto overflow-x-auto overscroll-none"
            onClick={() => clearSelection()}
            onDragLeave={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              if (
                e.clientX < rect.left || e.clientX >= rect.right ||
                e.clientY < rect.top || e.clientY >= rect.bottom
              ) {
                if (indicatorElement) indicatorElement.style.display = "none";
                if (intoHighlightElement) intoHighlightElement.style.display = "none";
                lastDropPosition = null;
              }
            }}
          >
            <div className="w-max min-w-full relative">
              {/* Single drag indicator */}
              <div
                ref={(el) => { indicatorElement = el; }}
                className="absolute left-0 right-0 h-0.5 bg-blue-500 z-20 pointer-events-none"
                style={{ display: "none", top: 0 }}
              />
              {/* Container drop highlight */}
              <div
                ref={(el) => { intoHighlightElement = el; }}
                className="absolute left-0 right-0 h-8 bg-blue-500/10 border border-blue-500 rounded z-20 pointer-events-none"
                style={{ display: "none", top: 0 }}
              />

              {/* ── Artboard root layer ── */}
              <div>
                <div
                  className={cn(
                    "group flex items-center h-8 cursor-default",
                    isArtboardSelected && "bg-blue-100 dark:bg-blue-900/30",
                    !isArtboardSelected && "hover:bg-stone-100 dark:hover:bg-stone-800/50",
                  )}
                  style={{ paddingLeft: "12px", userSelect: "none" }}
                  onClick={(e) => { e.stopPropagation(); selectElement(ARTBOARD_LAYER_ID); }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = "move";
                    if (intoHighlightElement) {
                      const row = e.currentTarget;
                      const rect = row.getBoundingClientRect();
                      const wrapper = intoHighlightElement.parentElement;
                      if (wrapper) {
                        const wrapperRect = wrapper.getBoundingClientRect();
                        intoHighlightElement.style.top = `${rect.top - wrapperRect.top}px`;
                        intoHighlightElement.style.height = `${rect.height}px`;
                        intoHighlightElement.style.display = "block";
                      }
                    }
                  }}
                  onDragLeave={() => {
                    if (intoHighlightElement) intoHighlightElement.style.display = "none";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const draggedId = e.dataTransfer.getData("application/x-element-id");
                    if (!draggedId) return;
                    // Drop into artboard root level
                    reparentIntoContainer(draggedId, null, -1);
                    if (intoHighlightElement) intoHighlightElement.style.display = "none";
                  }}
                >
                  <div className="flex items-center gap-1 flex-1">
                    {artboardRoots.length > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleExpand(ARTBOARD_LAYER_ID); }}
                        className="flex-shrink-0 w-4 h-4 flex items-center justify-center"
                      >
                        <ChevronRight16
                          className={cn("w-4 h-4 transition-transform", isArtboardExpanded && "rotate-90")}
                        />
                      </button>
                    ) : (
                      <span className="w-4 flex-shrink-0" />
                    )}
                    {pageStyles?.layoutMode === "horizontal" ? (
                      <FrameHorizontal16 className={cn("w-4 h-4 flex-shrink-0 text-stone-500 dark:text-stone-400", !isArtboardSelected && "opacity-50")} />
                    ) : (
                      <FrameVertical16 className={cn("w-4 h-4 flex-shrink-0 text-stone-500 dark:text-stone-400", !isArtboardSelected && "opacity-50")} />
                    )}
                    {isRenamingArtboard ? (
                      <input
                        type="text"
                        value={editArtboardName}
                        onChange={(e) => setEditArtboardName(e.target.value)}
                        onBlur={() => {
                          if (editArtboardName.trim() && activePageId) {
                            updatePage(activePageId, { artboardName: editArtboardName.trim() });
                          }
                          setIsRenamingArtboard(false);
                          setEditArtboardName("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (editArtboardName.trim() && activePageId) {
                              updatePage(activePageId, { artboardName: editArtboardName.trim() });
                            }
                            setIsRenamingArtboard(false);
                            setEditArtboardName("");
                          }
                          if (e.key === "Escape") {
                            setIsRenamingArtboard(false);
                            setEditArtboardName("");
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        ref={(el) => el?.focus({ preventScroll: true })}
                        className="text-[11px] leading-4 tracking-[0.055px] font-[450] bg-white dark:bg-stone-900 shadow-[inset_0_0_0_1px_#3b82f6] rounded px-1 -mx-1 py-0.5 -my-0.5 focus:outline-none min-w-0 flex-1"
                      />
                    ) : (
                      <span
                        className="text-[11px] leading-4 tracking-[0.055px] font-[450] text-stone-900 dark:text-stone-100 whitespace-nowrap"
                        onDoubleClick={isAdmin ? (e) => {
                          e.stopPropagation();
                          setEditArtboardName(artboardName);
                          setIsRenamingArtboard(true);
                        } : undefined}
                      >
                        {artboardName}
                      </span>
                    )}
                  </div>
                </div>
                {/* Artboard children */}
                {isArtboardExpanded && artboardRoots.map((el) => (
                  <LayerRow
                    key={el.id}
                    elementId={el.id}
                    depth={1}
                    isElementCollapsed={isElementCollapsed}
                    toggleExpand={toggleExpand}
                    isDescendantOfSelected={isDescendantOfSelected}
                  />
                ))}
              </div>

              {/* ── Canvas elements (outside artboard) ── */}
              {canvasRoots.map((el) => (
                <LayerRow
                  key={el.id}
                  elementId={el.id}
                  depth={0}
                  isElementCollapsed={isElementCollapsed}
                  toggleExpand={toggleExpand}
                  isDescendantOfSelected={isDescendantOfSelected}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Page context menu (portal) */}
      {pageMenu.state.isOpen && pageMenu.state.meta && (() => {
        const pageId = pageMenu.state.meta.pageId;
        const contextPage = pages.find(p => p.id === pageId);
        const contextPageIsHomepage = contextPage?.isHomepage ?? (pageId === homepageId);

        const items: ContextMenuItemDef[] = [
          { label: "Copy link to page", onClick: () => navigator.clipboard.writeText(window.location.href) },
        ];
        if (isAdmin) {
          items.push({ type: "separator" });
          items.push({ label: "Rename", onClick: () => {
            const page = pages.find((p) => p.id === pageId);
            if (page) { setEditingPageName(page.name); setRenamingPageId(page.id); }
          }});
          items.push({ label: "Duplicate", onClick: () => duplicatePage(pageId) });
          if (!contextPageIsHomepage) {
            items.push({ type: "separator" });
            items.push({ label: "Set as homepage", onClick: () => setHomepage(pageId) });
          }
          items.push({ type: "separator" });
          items.push({ label: "Delete page", disabled: pages.length <= 1, onClick: () => handleDeletePage(pageId) });
        }

        return (
          <ContextMenu
            ref={pageMenu.menuRef}
            items={items}
            position={pageMenu.state.position}
            width={170}
            onClose={pageMenu.close}
          />
        );
      })()}

      {/* Layer context menu (portal) */}
      {layerMenu.state.isOpen && layerMenu.state.meta && (() => {
        const elId = layerMenu.state.meta.elementId;
        const el = elements[elId];
        if (!el) return null;
        const hasProtectedDescendant = (id: string): boolean => {
          const e = elements[id];
          if (!e) return false;
          if (e.isCore) return true;
          return e.children?.some(hasProtectedDescendant) ?? false;
        };
        const isProtected = !isAdmin && hasProtectedDescendant(elId);
        const isLocked = !!el.locked;

        const items: ContextMenuItemDef[] = [
          { label: "Cut", shortcut: "\u2318X", onClick: () => { snapshotToClipboard([elId]); panelDeleteElement(elId); } },
          { label: "Copy", shortcut: "\u2318C", onClick: () => { snapshotToClipboard([elId]); } },
          { label: "Duplicate", shortcut: "\u2318D", disabled: el.type === "component", onClick: () => panelDuplicateElement(elId) },
          { type: "separator" },
          ...(isAdmin ? [{ label: "Rename", onClick: () => {
            const row = document.querySelector(`[data-element-id="${elId}"]`);
            if (row) {
              const nameSpan = row.querySelector("span[class*='tracking-']");
              if (nameSpan) {
                const dblClick = new MouseEvent("dblclick", { bubbles: true });
                nameSpan.dispatchEvent(dblClick);
              }
            }
          }} as ContextMenuItemDef] : []),
          { label: "Frame Selection", shortcut: "\u2318G", onClick: () => wrapInContainer([elId]) },
          ...(el.type === "container" && el.children?.length ? [{
            label: "Ungroup",
            shortcut: "\u21E7\u2318G",
            onClick: () => panelUngroupContainer(elId),
          }] as ContextMenuItemDef[] : []),
          { type: "separator" },
          {
            label: el.hidden ? "Show" : "Hide",
            shortcut: "\u21E7\u2318H",
            onClick: () => panelToggleVisibility(elId),
          },
          {
            label: isLocked ? "Unlock" : "Lock",
            shortcut: "\u21E7\u2318L",
            onClick: () => panelToggleLock(elId),
          },
          { type: "separator" },
          {
            label: "Delete",
            shortcut: "\u232B",
            disabled: !!isProtected || isLocked || el.type === "component",
            onClick: () => panelDeleteElement(elId),
          },
        ];

        return (
          <ContextMenu
            ref={layerMenu.menuRef}
            items={items}
            position={layerMenu.state.position}
            width={170}
            onClose={layerMenu.close}
          />
        );
      })()}
    </div>
  );
}

