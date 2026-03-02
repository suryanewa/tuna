"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useComposer } from "@/app/editor/provider/ComposerProvider";
import { useEditorMutations, useSelectedIds, useFocusedContainerId } from "./context";
import { useContextMenu, ContextMenu, type ContextMenuItemDef } from "./ui/context-menu";
import { elementClipboard } from "./YjsEditorContext";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./ui/section-header";
import { IconButton } from "./ui/icon-button";
import { CollapseLayersSmall } from "@/components/icons/editor";
import { ComponentsBrowser } from "./ComponentsBrowser";
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
    component: ComponentSmall16,
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
  const { elements } = useComposer();
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
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleStartRename();
              }}
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
  const { elements, elementsArray, activePageId, pages, homepageId, pageStyles } = useComposer();
  const {
    clearSelection, selectElement, reparentIntoContainer,
    deleteElement: panelDeleteElement, duplicateElement: panelDuplicateElement,
    wrapInContainer, ungroupContainer: panelUngroupContainer,
    toggleVisibility: panelToggleVisibility, toggleLock: panelToggleLock,
    setActivePageId, addPage, deletePage, renamePage, duplicatePage,
    setHomepage, reorderPages, updatePage,
  } = useEditorMutations();
  const selectedIds = useSelectedIds();
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

  // Left panel tab: Layers vs Components
  const [leftTab, setLeftTab] = useState<"layers" | "components">("layers");

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
        <svg width="24" height="24" className="shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.5 19.5557L13.6645 18.883C13.9037 18.7449 14.2096 18.8268 14.3477 19.0661C14.4858 19.3052 14.4039 19.611 14.1648 19.7491L12.5002 20.711C12.1907 20.8898 11.8093 20.8898 11.4997 20.7111L9.83433 19.7491C9.59519 19.611 9.51327 19.3052 9.65133 19.066C9.78942 18.8268 10.0953 18.7448 10.3345 18.8829L11.5 19.5557V17.5C11.5 17.2239 11.7239 17 12 17C12.2761 17 12.5 17.2239 12.5 17.5V19.5557Z" fill="currentColor"/>
          <path d="M19.7949 15.9225C19.7949 16.2798 19.6042 16.61 19.2947 16.7886L17.6284 17.7501C17.3892 17.8881 17.0834 17.8061 16.9454 17.567C16.8073 17.3278 16.8893 17.0219 17.1286 16.8838L18.2949 16.2109L16.5123 15.1813C16.2735 15.0434 16.1917 14.7381 16.3295 14.4993C16.4673 14.2602 16.7729 14.1783 17.0118 14.3162L18.7949 15.3457V14C18.7949 13.7239 19.0188 13.5 19.2949 13.5C19.5711 13.5 19.7949 13.7239 19.7949 14V15.9225Z" fill="currentColor"/>
          <path d="M5.20605 15.3447L6.98714 14.3163C7.22613 14.1783 7.53173 14.2603 7.6696 14.4993C7.80734 14.7381 7.72554 15.0434 7.48682 15.1813L5.70508 16.2109L6.87075 16.8839C7.10984 17.0219 7.1917 17.3276 7.05358 17.5666C6.91556 17.8055 6.6101 17.8873 6.37117 17.7494L4.70624 16.7886C4.39673 16.61 4.20605 16.2799 4.20605 15.9225V14C4.20605 13.7239 4.42991 13.5 4.70605 13.5C4.9822 13.5 5.20605 13.7239 5.20605 14V15.3447Z" fill="currentColor"/>
          <path d="M19.2949 7.21132C19.6043 7.38996 19.7949 7.72008 19.7949 8.07733V10C19.7949 10.2761 19.5711 10.5 19.2949 10.5C19.0188 10.5 18.7949 10.2761 18.7949 10V8.65332L17.0116 9.68214C16.7727 9.81996 16.4673 9.73814 16.3293 9.49934C16.1911 9.26029 16.2731 8.95451 16.5122 8.81654L18.2949 7.78809L17.1288 7.1149C16.8899 6.97698 16.8079 6.67157 16.9456 6.43253C17.0835 6.19318 17.3894 6.11106 17.6286 6.24918L19.2949 7.21132Z" fill="currentColor"/>
          <path d="M7.05337 6.43287C7.19112 6.67171 7.10928 6.97698 6.87054 7.11488L5.70508 7.78809L7.48682 8.81644C7.72601 8.95449 7.808 9.26031 7.66993 9.49949C7.53186 9.73869 7.22601 9.82065 6.98683 9.68254L5.20605 8.6543V10C5.20605 10.2761 4.9822 10.5 4.70605 10.5C4.42991 10.5 4.20605 10.2761 4.20605 10V8.0773C4.20605 7.72006 4.39663 7.38996 4.70599 7.21131L6.37097 6.24988C6.60993 6.1119 6.91551 6.19384 7.05337 6.43287Z" fill="currentColor"/>
          <path d="M14.1636 4.24902C14.4028 4.3871 14.4848 4.69291 14.3467 4.9321C14.2086 5.1713 13.9028 5.25327 13.6636 5.11517L12.5 4.44336V6.5C12.5 6.77614 12.2761 7 12 7C11.7239 7 11.5 6.77614 11.5 6.5V4.44336L10.3339 5.1158C10.095 5.2536 9.78955 5.17174 9.65154 4.93292C9.51339 4.69386 9.59528 4.38807 9.83441 4.25004L11.5001 3.28858C11.8094 3.11 12.1906 3.11001 12.4999 3.2886L14.1636 4.24902Z" fill="currentColor"/>
          <path d="M9.40234 10.5L12.0004 12M12.0004 12L14.5985 10.5M12.0004 12L12.0001 15" stroke="currentColor" strokeLinecap="round"/>
        </svg>
        <span className="text-xs font-semibold leading-4 text-stone-900 dark:text-stone-100">
          Composer
        </span>
      </div>

      {/* ── Pages Section ── */}
      <SectionHeader
        title="Pages"
        iconButton={{
          icon: Plus16,
          onClick: addPage,
          "aria-label": "Add page",
        }}
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
              draggable
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
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingPageName(page.name);
                      setRenamingPageId(page.id);
                    }}
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

      {/* ── Layers / Components Tab ── */}
      <SectionHeader
        tabs={[
          { value: "layers", label: "Layers" },
          { value: "components", label: "Components" },
        ]}
        activeTab={leftTab}
        onTabChange={(v) => setLeftTab(v as "layers" | "components")}
        iconButton={leftTab === "layers" && hasExpandedContainers ? {
          icon: CollapseLayersSmall,
          onClick: collapseAll,
          "aria-label": "Collapse all layers",
        } : undefined}
      />

      {leftTab === "components" ? (
        <ComponentsBrowser />
      ) : (
      <>
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
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditArtboardName(artboardName);
                          setIsRenamingArtboard(true);
                        }}
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
          { type: "separator" },
          { label: "Rename", onClick: () => {
            const page = pages.find((p) => p.id === pageId);
            if (page) { setEditingPageName(page.name); setRenamingPageId(page.id); }
          }},
          { label: "Duplicate", onClick: () => duplicatePage(pageId) },
          ...(!contextPageIsHomepage ? [
            { type: "separator" } as ContextMenuItemDef,
            { label: "Set as homepage", onClick: () => setHomepage(pageId) } as ContextMenuItemDef,
          ] : []),
          { type: "separator" },
          { label: "Delete page", disabled: pages.length <= 1, onClick: () => handleDeletePage(pageId) },
        ];

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
        const isLocked = !!el.locked;

        const items: ContextMenuItemDef[] = [
          { label: "Cut", shortcut: "\u2318X", onClick: () => { snapshotToClipboard([elId]); panelDeleteElement(elId); } },
          { label: "Copy", shortcut: "\u2318C", onClick: () => { snapshotToClipboard([elId]); } },
          { label: "Duplicate", shortcut: "\u2318D", disabled: el.type === "component", onClick: () => panelDuplicateElement(elId) },
          { type: "separator" },
          { label: "Rename", onClick: () => {
            const row = document.querySelector(`[data-element-id="${elId}"]`);
            if (row) {
              const nameSpan = row.querySelector("span[class*='tracking-']");
              if (nameSpan) {
                const dblClick = new MouseEvent("dblclick", { bubbles: true });
                nameSpan.dispatchEvent(dblClick);
              }
            }
          }},
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
            disabled: isLocked || el.type === "component",
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
      </>
      )}
    </div>
  );
}

