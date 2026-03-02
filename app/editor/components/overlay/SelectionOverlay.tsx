"use client";

import { useRef, useState, useCallback, useMemo, useEffect, type RefObject } from "react";
import { flushSync } from "react-dom";
import { useYjsEditor, useHoveredId } from "../YjsEditorContext";
import {
  useEditorMutations,
  useSelectedIds,
  useEditingElementId,
  useCreationTool,
  useDevice,
  useIsAdmin,
  editorStateStore,
} from "../context";
import { useElementBounds } from "./use-element-bounds";
import { computeDragRect, type Rect } from "./drag-rect";
import { computeSmartInsertion, computeDropTarget, getRootElementIds, type DropTarget } from "../smart-insertion";
import type { CreationTool } from "@/lib/playground/editor-types";
import type { TailwindStyles } from "@/lib/playground/editor-types";
import { getEffectiveStyles } from "@/lib/playground/editor-types";
import { type CanvasElement, ARTBOARD_LAYER_ID } from "@/lib/playground/store";
import { LockSmall } from "@/components/icons/editor";
import { AiSparkle16 } from "@/components/icons/editor-16";
import { parseCSSAnimations, parseReactEffect } from "@/lib/playground/editor-types";
import type { ReactEffectState, CSSAnimation } from "@/lib/playground/editor-types";
import { collectAllDescendants } from "../stagger-utils";
import { AIPromptPopover } from "../ai/AIPromptPopover";
import { buildTreeContext } from "../ai/ai-tree-context";
import { elementContextMenuRef } from "../EditorCanvas";
import { useVisualBell } from "../visual-bell/VisualBellContext";
import {
  writeWidth,
  writeHeight,
  readPositionType,
  readSize,
  writeConstraint,
  readConstraint,
} from "../adapters/tailwind-adapters";
import { useCamera } from "../CameraContext";
import { screenToWorld } from "../camera-utils";

// ─── Constants ──────────────────────────────────────────────────────────────

const HANDLE_SIZE = 8;
const HALF = HANDLE_SIZE / 2;
const MIN_SIZE = 20;
const MIN_DRAG_DISTANCE = 5;
const SELECTION_COLOR = "#3b82f6"; // blue-500

// Shared flag to suppress the canvas click that fires after creation pointerup.
// Exported so EditorCanvas can check and reset it in handleCanvasClick.
export const creationFlag = { didCreate: false };

// Shared flag so EditorCanvas can disable HTML5 draggable during spatial reparent drag
export const spatialDragFlag = { active: false };

type HandlePosition = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLE_CURSORS: Record<HandlePosition, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

// Which axes each handle affects
const HANDLE_AXES: Record<HandlePosition, { dx: -1 | 0 | 1; dy: -1 | 0 | 1 }> = {
  nw: { dx: -1, dy: -1 },
  n:  { dx: 0,  dy: -1 },
  ne: { dx: 1,  dy: -1 },
  e:  { dx: 1,  dy: 0 },
  se: { dx: 1,  dy: 1 },
  s:  { dx: 0,  dy: 1 },
  sw: { dx: -1, dy: 1 },
  w:  { dx: -1, dy: 0 },
};

// Map creation tool to the element type for addElement
const TOOL_TO_ELEMENT_TYPE: Record<Exclude<CreationTool, 'select' | 'comment'>, string> = {
  frame: 'container',
  rectangle: 'rectangle',
  circle: 'circle',
  star: 'star',
  text: 'text',
  image: 'image',
  video: 'video',
};

// Duplicate cursor shown when Alt/Option is held over an element
export const DUPLICATE_CURSOR = `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWx0ZXI9InVybCgjZmlsdGVyMF9kXzIzOTlfNTQ4MikiPjxwYXRoIGQ9Ik0xMC45Mzk0IDIuOTM5MzhDMTEuMzU1MyAyLjUyMzQ1IDExLjk3NiAyLjM4OTAxIDEyLjUyNjcgMi41OTU1NUwyMy41MjY3IDYuNzIwNTVDMjQuMTQxNiA2Ljk1MTExIDI0LjUzNSA3LjU1NDc3IDI0LjQ5NzYgOC4yMTAzNEMyNC40NjAzIDguODY1OTIgMjQuMDAwOSA5LjQyMSAyMy4zNjM4IDkuNTgwMjZMMTkuMjM2OCAxMC42MTJMMTkuNTI2MiAxMC43MjA1QzIwLjE0MTEgMTAuOTUxMSAyMC41MzQ1IDExLjU1NDggMjAuNDk3MSAxMi4yMTAzQzIwLjQ1OTggMTIuODY1OSAyMC4wMDA0IDEzLjQyMSAxOS4zNjM0IDEzLjU4MDNMMTcuOTM3IDEzLjkzNjhMMTcuNTgwMyAxNS4zNjM4QzE3LjQyMSAxNi4wMDA5IDE2Ljg2NTkgMTYuNDYwMyAxNi4yMTAzIDE2LjQ5NzZDMTUuNTU0OCAxNi41MzUgMTQuOTUxMSAxNi4xNDE2IDE0LjcyMDUgMTUuNTI2N0wxNC42MTE2IDE1LjIzNjNMMTMuNTc5OCAxOS4zNjM4QzEzLjQyMDUgMjAuMDAwOSAxMi44NjU0IDIwLjQ2MDMgMTIuMjA5OSAyMC40OTc2QzExLjU1NDMgMjAuNTM1IDEwLjk1MDYgMjAuMTQxNiAxMC43MjAxIDE5LjUyNjdMNi41OTUwNiA4LjUyNjczQzYuMzg4NTIgNy45NzU5NyA2LjUyMjk2IDcuMzU1MzEgNi45Mzg4OSA2LjkzOTM4QzcuMzU0ODMgNi41MjM0NSA3Ljk3NTQ4IDYuMzg5MDEgOC41MjYyNCA2LjU5NTU1TDExLjgzNjkgNy44MzcwNUwxMC41OTU1IDQuNTI2NzNDMTAuMzg5IDMuOTc1OTcgMTAuNTIzNSAzLjM1NTMxIDEwLjkzOTQgMi45MzkzOFoiIGZpbGw9IndoaXRlIiBzdHlsZT0iZmlsbDp3aGl0ZTtmaWxsLW9wYWNpdHk6MTsiLz48L2c+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik03LjY0NiA3LjY0NjQ2QzcuNzg0NjUgNy41MDc4MiA3Ljk5MTUzIDcuNDYzIDguMTc1MTIgNy41MzE4NUwxOS4xNzUxIDExLjY1NjhDMTkuMzgwMSAxMS43MzM3IDE5LjUxMTIgMTEuOTM0OSAxOS40OTg3IDEyLjE1MzRDMTkuNDg2MyAxMi4zNzIgMTkuMzMzMiAxMi41NTcgMTkuMTIwOCAxMi42MTAxTDEzLjkxMTkgMTMuOTEyM0wxMi42MDk2IDE5LjEyMTNDMTIuNTU2NSAxOS4zMzM2IDEyLjM3MTUgMTkuNDg2OCAxMi4xNTMgMTkuNDk5MkMxMS45MzQ1IDE5LjUxMTcgMTEuNzMzMiAxOS4zODA1IDExLjY1NjQgMTkuMTc1Nkw3LjUzMTM5IDguMTc1NTdDNy40NjI1NSA3Ljk5MTk5IDcuNTA3MzYgNy43ODUxIDcuNjQ2IDcuNjQ2NDZaIiBmaWxsPSJibGFjayIgc3R5bGU9ImZpbGw6YmxhY2s7ZmlsbC1vcGFjaXR5OjE7Ii8+PHBhdGggZD0iTTExLjY0NjUgMy42NDY0NkMxMS43ODUxIDMuNTA3ODIgMTEuOTkyIDMuNDYzIDEyLjE3NTYgMy41MzE4NUwyMy4xNzU2IDcuNjU2ODVDMjMuMzgwNiA3LjczMzcgMjMuNTExNyA3LjkzNDkyIDIzLjQ5OTIgOC4xNTM0NUMyMy40ODY4IDguMzcxOTcgMjMuMzMzNyA4LjU1NyAyMy4xMjEzIDguNjEwMDlMMTcuOTEyNCA5LjkxMjMyTDE3Ljg2NiAxMC4wOTc5TDE2LjkyMzUgOS43NDQ1TDE3LjA4NzcgOS4wODc2OUwyMS4zMjEgOC4wMjkzN0wxMi44NTQ0IDQuODU0NEwxNC4zMjI0IDguNzY5MDlMMTMuMDc5NyA4LjMwMzA2TDExLjUzMTkgNC4xNzU1OEMxMS40NjMgMy45OTE5OSAxMS41MDc4IDMuNzg1MSAxMS42NDY1IDMuNjQ2NDZaIiBmaWxsPSJibGFjayIgc3R5bGU9ImZpbGw6YmxhY2s7ZmlsbC1vcGFjaXR5OjE7Ii8+PHBhdGggZD0iTTE1LjQyNzYgMTQuNTY0MkwxNS42NTY5IDE1LjE3NTZDMTUuNzMzNyAxNS4zODA1IDE1LjkzNSAxNS41MTE3IDE2LjE1MzUgMTUuNDk5MkMxNi4zNzIgMTUuNDg2OCAxNi41NTcgMTUuMzMzNiAxNi42MTAxIDE1LjEyMTNMMTYuODM3NSAxNC4yMTE3TDE1LjQyNzYgMTQuNTY0MloiIGZpbGw9ImJsYWNrIiBzdHlsZT0iZmlsbDpibGFjaztmaWxsLW9wYWNpdHk6MTsiLz48ZGVmcz48ZmlsdGVyIGlkPSJmaWx0ZXIwX2RfMjM5OV81NDgyIiB4PSIzLjQ5OTUxIiB5PSIwLjUiIHdpZHRoPSIyNC4wMDA1IiBoZWlnaHQ9IjI0LjAwMDEiIGZpbHRlclVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgY29sb3ItaW50ZXJwb2xhdGlvbi1maWx0ZXJzPSJzUkdCIj48ZmVGbG9vZCBmbG9vZC1vcGFjaXR5PSIwIiByZXN1bHQ9IkJhY2tncm91bmRJbWFnZUZpeCIvPjxmZUNvbG9yTWF0cml4IGluPSJTb3VyY2VBbHBoYSIgdHlwZT0ibWF0cml4IiB2YWx1ZXM9IjAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDEyNyAwIiByZXN1bHQ9ImhhcmRBbHBoYSIvPjxmZU9mZnNldCBkeT0iMSIvPjxmZUdhdXNzaWFuQmx1ciBzdGREZXZpYXRpb249IjEuNSIvPjxmZUNvbG9yTWF0cml4IHR5cGU9Im1hdHJpeCIgdmFsdWVzPSIwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwLjM1IDAiLz48ZmVCbGVuZCBtb2RlPSJub3JtYWwiIGluMj0iQmFja2dyb3VuZEltYWdlRml4IiByZXN1bHQ9ImVmZmVjdDFfZHJvcFNoYWRvd18yMzk5XzU0ODIiLz48ZmVCbGVuZCBtb2RlPSJub3JtYWwiIGluPSJTb3VyY2VHcmFwaGljIiBpbjI9ImVmZmVjdDFfZHJvcFNoYWRvd18yMzk5XzU0ODIiIHJlc3VsdD0ic2hhcGUiLz48L2ZpbHRlcj48L2RlZnM+PC9zdmc+") 8 8, default`;

// Custom black arrow cursor — matches EditorCanvas cursor
const CURSOR_SVG = `<svg width="16" height="18" viewBox="-2 -2 16 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.675576 0.0318497C0.491988 -0.0369956 0.285105 0.0078173 0.146461 0.146461C0.0078173 0.285105 -0.0369956 0.491988 0.0318497 0.675576L4.15685 11.6756C4.2337 11.8805 4.43492 12.0117 4.65345 11.9992C4.87197 11.9868 5.057 11.8336 5.11009 11.6213L6.41232 6.41232L11.6213 5.11009C11.8336 5.057 11.9868 4.87197 11.9992 4.65345C12.0117 4.43492 11.8805 4.2337 11.6756 4.15685L0.675576 0.0318497Z" fill="white" stroke="white" stroke-width="2.5" stroke-linejoin="round"/><path d="M0.675576 0.0318497C0.491988 -0.0369956 0.285105 0.0078173 0.146461 0.146461C0.0078173 0.285105 -0.0369956 0.491988 0.0318497 0.675576L4.15685 11.6756C4.2337 11.8805 4.43492 12.0117 4.65345 11.9992C4.87197 11.9868 5.057 11.8336 5.11009 11.6213L6.41232 6.41232L11.6213 5.11009C11.8336 5.057 11.9868 4.87197 11.9992 4.65345C12.0117 4.43492 11.8805 4.2337 11.6756 4.15685L0.675576 0.0318497Z" fill="black"/></svg>`;
const CUSTOM_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(CURSOR_SVG)}") 0 0, default`;

// ─── Types ──────────────────────────────────────────────────────────────────

interface DragState {
  type: "resize" | "move" | "reparent" | "canvas-move" | "canvas-resize" | "artboard-pan";
  elementId: string;
  handle?: HandlePosition;
  startMouseX: number;
  startMouseY: number;
  startWidth: number;
  startHeight: number;
  startLeft: number;
  startTop: number;
  isAbsolute: boolean;
  startRect: Rect;
  originalParentId?: string | null;
  // Canvas element fields
  startWorldX?: number;
  startWorldY?: number;
}

interface CreationDragState {
  tool: Exclude<CreationTool, 'select'>;
  elementId: string; // the created element's ID
  startClientX: number; // screen coords (clientX/Y)
  startClientY: number;
  pointerId: number;
  startWorldX: number; // world coords at creation point
  startWorldY: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface SelectionOverlayProps {
  canvasRef: RefObject<HTMLDivElement | null>;
}

export function SelectionOverlay({ canvasRef }: SelectionOverlayProps) {
  const { elements, pageStyles, activePageId } = useYjsEditor();
  const mutations = useEditorMutations();
  const selectedIds = useSelectedIds();
  const editingElementId = useEditingElementId();
  const creationTool = useCreationTool();
  const device = useDevice();
  const isAdmin = useIsAdmin();

  // Device-aware style helpers
  const updateStylesForDevice = useCallback(
    (id: string, styles: Partial<TailwindStyles>) => {
      if (device === "desktop") {
        mutations.updateStyles(id, styles);
      } else {
        mutations.updateResponsiveStyles(id, device, styles);
      }
    },
    [device, mutations]
  );

  const getStyles = useCallback(
    (el: CanvasElement) =>
      getEffectiveStyles(el.tailwindStyles ?? {} as TailwindStyles, el.responsiveStyles, device),
    [device]
  );

  // AI animation/effect popover state
  const [animationPopover, setAnimationPopover] = useState<{
    elementId: string;
    phase: "prompt" | "loading" | "review" | "error";
  } | null>(null);

  // Tree context for AI popover
  const aiTreeContext = useMemo(() => {
    if (!animationPopover) return null;
    return buildTreeContext(animationPopover.elementId, elements, getStyles);
  }, [animationPopover?.elementId, elements, getStyles]);

  // Visual bell (toast) system
  const { showBell } = useVisualBell();

  const dragRef = useRef<DragState | null>(null);
  const pendingStylesRef = useRef<Record<string, string | boolean | undefined> | null>(null);
  const [dragRect, setDragRect] = useState<{ id: string; rect: Rect } | null>(null);
  const [dropHighlight, setDropHighlight] = useState<{
    containerId: string | null;
    containerRect: Rect | null;
    lineRect: { x: number; y: number; width: number; height: number } | null;
  } | null>(null);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const canvasToArtboardTargetRef = useRef<DropTarget | null>(null);
  const isOutsideArtboardRef = useRef(false);

  // Drag ghost — visual clone that follows cursor during reparent drag
  const dragGhostRef = useRef<HTMLElement | null>(null);
  // Parent element whose height is frozen during reparent drag
  const frozenParentRef = useRef<HTMLElement | null>(null);

  // Reorder preview state — tracks snapshot of sibling positions for live preview
  const reorderPreviewRef = useRef<{
    parentId: string | null;
    insertIndex: number;
    siblingIds: string[];
    siblingRects: Map<string, DOMRect>;
    isVertical: boolean;
    gapSize: number;
  } | null>(null);

  // Creation drag state — element is added immediately on pointerdown,
  // then resized in-place during drag (no floating preview needed).
  const creationDragRef = useRef<CreationDragState | null>(null);

  // Track Space key for panning exclusion
  const isSpaceRef = useRef(false);
  // Track Cmd/Ctrl key — bounding boxes become pointer-transparent for deep select/hover
  const [isModHeld, setIsModHeld] = useState(false);
  const [isAltHeld, setIsAltHeld] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") isSpaceRef.current = true;
      if (e.metaKey || e.ctrlKey) setIsModHeld(true);
      if (e.altKey) setIsAltHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") isSpaceRef.current = false;
      if (!e.metaKey && !e.ctrlKey) setIsModHeld(false);
      if (!e.altKey) setIsAltHeld(false);
    };
    const blur = () => { setIsModHeld(false); setIsAltHeld(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const { camera, cameraRef, worldRef, applyCamera } = useCamera();
  const hoveredId = useHoveredId();
  const zoomScale = camera.zoom;
  const invZoom = 1 / zoomScale;
  const isCreationMode = creationTool !== 'select';

  // Determine the parent container to show a dashed border around.
  // In Figma, selecting an element highlights its immediate parent container.
  const parentIndicatorId = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const firstEl = elements[selectedIds[0]];
    const parentId = firstEl?.parentId;
    if (!parentId) return null;
    const parent = elements[parentId];
    if (!parent || parent.type !== "container") return null;
    return parentId;
  }, [selectedIds, elements]);

  // Collect all IDs to measure (selected + hovered + parent indicator)
  const allIds = useMemo(() => {
    const ids = [...selectedIds];
    if (hoveredId && !selectedIds.includes(hoveredId)) {
      ids.push(hoveredId);
    }
    if (parentIndicatorId && !ids.includes(parentIndicatorId)) {
      ids.push(parentIndicatorId);
    }
    return ids;
  }, [selectedIds, hoveredId, parentIndicatorId]);

  const { bounds, measure, suppressRef } = useElementBounds(canvasRef, allIds, camera, worldRef, cameraRef);

  // ── Reorder preview helpers ──

  const snapshotSiblings = useCallback(
    (parentId: string | null, draggedId: string, drag: { startHeight: number; startWidth: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      // Get sibling IDs (excluding dragged)
      const allChildren = parentId
        ? (elements[parentId]?.children || [])
        : getRootElementIds(elements, activePageId);
      const siblingIds = allChildren.filter(id => id !== draggedId);

      // Determine flex direction
      const isVertical = parentId
        ? elements[parentId]?.tailwindStyles?.flexDirection !== "flex-row"
        : true;

      // Snapshot each sibling's bounding rect
      const siblingRects = new Map<string, DOMRect>();
      for (const id of siblingIds) {
        const el = canvas.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
        if (el) siblingRects.set(id, el.getBoundingClientRect());
      }

      const gapSize = isVertical ? drag.startHeight : drag.startWidth;

      return { parentId, insertIndex: -1, siblingIds, siblingRects, isVertical, gapSize };
    },
    [canvasRef, elements, activePageId]
  );

  const computeInsertIndexFromSnapshot = useCallback(
    (snapshot: NonNullable<typeof reorderPreviewRef.current>, cursorX: number, cursorY: number) => {
      const { siblingIds, siblingRects, isVertical } = snapshot;
      let insertIndex = siblingIds.length;

      for (let i = 0; i < siblingIds.length; i++) {
        const rect = siblingRects.get(siblingIds[i]);
        if (!rect) continue;
        const center = isVertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
        const cursorPos = isVertical ? cursorY : cursorX;
        if (cursorPos < center) {
          insertIndex = i;
          break;
        }
      }
      return insertIndex;
    },
    []
  );

  const applyReorderPreview = useCallback(
    (insertIndex: number) => {
      const preview = reorderPreviewRef.current;
      if (!preview) return;
      if (preview.insertIndex === insertIndex) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const { siblingIds, isVertical, gapSize } = preview;
      for (let i = 0; i < siblingIds.length; i++) {
        const el = canvas.querySelector<HTMLElement>(`[data-element-id="${siblingIds[i]}"]`);
        if (!el) continue;
        el.style.transition = "translate 200ms cubic-bezier(0.2, 0, 0, 1)";
        if (i >= insertIndex) {
          el.style.translate = isVertical ? `0 ${gapSize}px` : `${gapSize}px 0`;
        } else {
          el.style.translate = "";
        }
      }
      preview.insertIndex = insertIndex;
    },
    [canvasRef]
  );

  const clearReorderPreview = useCallback(() => {
    const preview = reorderPreviewRef.current;
    if (!preview) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    for (const id of preview.siblingIds) {
      const el = canvas.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
      if (el) {
        el.style.translate = "";
        el.style.transition = "";
      }
    }
    reorderPreviewRef.current = null;
  }, [canvasRef]);

  // ── Escape during creation drag ──

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (creationDragRef.current) {
          // Cancel creation drag — delete the element that was already added
          const creation = creationDragRef.current;
          creationDragRef.current = null;
          mutations.deleteElement(creation.elementId);
        }
        if (dragRef.current?.type === "reparent") {
          // Cancel reparent drag — clear preview and restore element
          clearReorderPreview();
          if (dragGhostRef.current) {
            dragGhostRef.current.remove();
            dragGhostRef.current = null;
          }
          if (frozenParentRef.current) {
            frozenParentRef.current.style.minHeight = "";
            frozenParentRef.current = null;
          }
          const elementId = dragRef.current.elementId;
          const el = canvasRef.current?.querySelector<HTMLElement>(
            `[data-element-id="${elementId}"]`
          );
          if (el) {
            el.style.display = "";
            el.style.pointerEvents = "";
          }
          const overlayGroup = overlayRootRef.current?.querySelector<HTMLElement>(
            `[data-overlay-for="${elementId}"]`
          );
          if (overlayGroup) {
            overlayGroup.style.translate = "";
          }
          dragRef.current = null;
          dropTargetRef.current = null;
          spatialDragFlag.active = false;
          flushSync(() => {
            suppressRef.current = false;
            measure();
            setDragRect(null);
            setDropHighlight(null);
          });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mutations, canvasRef, measure, suppressRef, clearReorderPreview]);

  // ── Creation handler ──
  // Native pointerdown on canvasRef so the creation tool covers the full canvas.
  // The overlay root is inside overlayWorldRef (translated for panning), so it
  // only covers the translated area — leaving gaps at the edges. Using a native
  // listener on canvasRef (same pattern as MarqueeOverlay) fixes this.
  // Pointer capture is set on the overlay root so React move/up handlers fire.

  const creationDownRef = useRef<((e: PointerEvent) => void) | null>(null);

  creationDownRef.current = (e: PointerEvent) => {
    if (!isCreationMode) return;
    if (isSpaceRef.current) return; // panning takes priority
    if (dragRef.current) return; // resize/move in progress

    e.stopPropagation();
    e.preventDefault();
    // Capture on overlay root so React move/up handlers continue
    // even after pointerEvents switches to 'none'
    if (overlayRootRef.current) {
      overlayRootRef.current.setPointerCapture(e.pointerId);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (creationTool === 'comment') return; // Comment tool handled separately
    const elementType = TOOL_TO_ELEMENT_TYPE[creationTool as Exclude<CreationTool, 'select' | 'comment'>];

    // Check if click is inside or outside the artboard
    const canvasRect = canvas.getBoundingClientRect();
    const vpX = e.clientX - canvasRect.left;
    const vpY = e.clientY - canvasRect.top;
    const world = screenToWorld(vpX, vpY, cameraRef.current);

    // Get artboard dimensions from the data-page element
    const pageEl = canvas.querySelector<HTMLElement>('[data-page]');
    const pageWidth = pageEl ? pageEl.offsetWidth : 1440;
    const pageHeight = pageEl ? pageEl.offsetHeight : 900;
    const isInsideArtboard = world.x >= 0 && world.x <= pageWidth && world.y >= 0 && world.y <= pageHeight;

    let newId: string;

    if (isInsideArtboard) {
      // Inside artboard: existing smart insertion behavior
      const { parentId, insertIndex } = computeSmartInsertion(
        e.clientX, e.clientY, canvas, elements
      );

      newId = mutations.addElement(elementType as any, parentId ?? undefined, {
        insertIndex,
      });
    } else {
      // Outside artboard: place on infinite canvas at world coordinates
      newId = mutations.addCanvasElement(elementType as any, world.x, world.y);
    }

    // addElement returns "" if creation is blocked (e.g., component page)
    if (!newId) return;

    creationDragRef.current = {
      tool: creationTool as Exclude<CreationTool, 'select'>,
      elementId: newId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      pointerId: e.pointerId,
      startWorldX: world.x,
      startWorldY: world.y,
    };

    // Suppress the click event that fires after pointerup
    creationFlag.didCreate = true;

    // Switch back to select tool (element is already selected by addElement)
    mutations.setCreationTool('select');

    // Re-measure once the new element appears in the DOM
    const tryMeasure = (attempts: number) => {
      requestAnimationFrame(() => {
        if (canvas.querySelector(`[data-element-id="${newId}"]`)) {
          measure();
        } else if (attempts > 0) {
          tryMeasure(attempts - 1);
        }
      });
    };
    tryMeasure(5);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: PointerEvent) => {
      if (e.button !== 0) return;
      creationDownRef.current?.(e);
    };
    canvas.addEventListener('pointerdown', handler);
    return () => canvas.removeEventListener('pointerdown', handler);
  }, [canvasRef]);

  const handleCreationPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const creation = creationDragRef.current;
      if (!creation) return;

      let dx = e.clientX - creation.startClientX;
      let dy = e.clientY - creation.startClientY;
      const dragDist = Math.sqrt(dx * dx + dy * dy);
      if (dragDist < MIN_DRAG_DISTANCE) return;

      // Shift key = 1:1 aspect ratio
      if (e.shiftKey) {
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        dx = size * Math.sign(dx || 1);
        dy = size * Math.sign(dy || 1);
      }

      // Update the element's dimensions in-place
      const width = Math.round(Math.abs(dx) / zoomScale);
      const height = Math.round(Math.abs(dy) / zoomScale);
      const finalWidth = Math.max(width, MIN_SIZE);
      const finalHeight = Math.max(height, MIN_SIZE);

      updateStylesForDevice(creation.elementId, {
        width: `w-[${finalWidth}px]` as any,
        height: `h-[${finalHeight}px]` as any,
      });

      // Sync store dimensions + position for canvas elements
      // (canvas wrapper uses el.width/el.height as source of truth)
      if (elements[creation.elementId]?.placement === "canvas") {
        const worldDx = dx / zoomScale;
        const worldDy = dy / zoomScale;
        mutations.updateElement(creation.elementId, {
          width: finalWidth,
          height: finalHeight,
          x: creation.startWorldX + Math.min(worldDx, 0),
          y: creation.startWorldY + Math.min(worldDy, 0),
        });
      }
    },
    [zoomScale, updateStylesForDevice, elements, mutations]
  );

  const handleCreationPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const creation = creationDragRef.current;
      if (!creation) return;

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may already be released
      }
      creationDragRef.current = null;
    },
    []
  );

  // ── Resize handler ──

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, elementId: string, handle: HandlePosition) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      suppressRef.current = true;
      mutations.pauseHistory();

      const rect = bounds.get(elementId);
      if (!rect) return;

      const el = elements[elementId];
      const styles = el ? getStyles(el) : ({} as TailwindStyles);
      const isAbsolute = el
        ? readPositionType(styles) === "absolute"
        : false;

      dragRef.current = {
        type: "resize",
        elementId,
        handle,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
        startLeft: isAbsolute
          ? readConstraint(styles, "left") ?? 0
          : 0,
        startTop: isAbsolute
          ? readConstraint(styles, "top") ?? 0
          : 0,
        isAbsolute,
        startRect: rect,
      };
    },
    [bounds, elements, zoomScale, mutations]
  );

  // Get the actual DOM element being dragged
  const getDragElement = useCallback(
    (elementId: string) => {
      return canvasRef.current?.querySelector<HTMLElement>(
        `[data-element-id="${elementId}"]`
      );
    },
    [canvasRef]
  );

  // Get the overlay group for a dragged element (selection box + handles)
  const overlayRootRef = useRef<HTMLDivElement>(null);
  const getOverlayGroup = useCallback(
    (elementId: string) => {
      return overlayRootRef.current?.querySelector<HTMLElement>(
        `[data-overlay-for="${elementId}"]`
      );
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const screenDx = e.clientX - drag.startMouseX;
      const screenDy = e.clientY - drag.startMouseY;
      const dx = screenDx / zoomScale;
      const dy = screenDy / zoomScale;

      if (drag.type === "resize" && drag.handle) {
        const axes = HANDLE_AXES[drag.handle];
        let newWidth = drag.startWidth;
        let newHeight = drag.startHeight;
        let newLeft = drag.startLeft;
        let newTop = drag.startTop;

        // Horizontal resize
        if (axes.dx === 1) {
          newWidth = Math.max(MIN_SIZE, drag.startWidth + dx);
        } else if (axes.dx === -1) {
          const delta = Math.min(dx, drag.startWidth - MIN_SIZE);
          newWidth = drag.startWidth - delta;
          if (drag.isAbsolute) {
            newLeft = drag.startLeft + delta;
          }
        }

        // Vertical resize
        if (axes.dy === 1) {
          newHeight = Math.max(MIN_SIZE, drag.startHeight + dy);
        } else if (axes.dy === -1) {
          const delta = Math.min(dy, drag.startHeight - MIN_SIZE);
          newHeight = drag.startHeight - delta;
          if (drag.isAbsolute) {
            newTop = drag.startTop + delta;
          }
        }

        // Shift = aspect ratio lock
        if (e.shiftKey && drag.startWidth > 0 && drag.startHeight > 0) {
          const ratio = drag.startWidth / drag.startHeight;
          if (axes.dx !== 0 && axes.dy !== 0) {
            const wFromH = newHeight * ratio;
            const hFromW = newWidth / ratio;
            if (newWidth / ratio < newHeight) {
              newHeight = hFromW;
            } else {
              newWidth = wFromH;
            }
          } else if (axes.dx !== 0) {
            newHeight = newWidth / ratio;
          } else {
            newWidth = newHeight * ratio;
          }
        }

        // Store pending styles for commit on pointerup (CRDT write)
        const styles: Record<string, string | boolean | undefined> = {
          ...writeWidth(String(Math.round(newWidth))),
          ...writeHeight(String(Math.round(newHeight))),
        };

        if (drag.isAbsolute) {
          if (axes.dx === -1) {
            Object.assign(styles, writeConstraint("left", Math.round(newLeft)));
          }
          if (axes.dy === -1) {
            Object.assign(styles, writeConstraint("top", Math.round(newTop)));
          }
        }

        pendingStylesRef.current = styles;

        // Write to CRDT so property panel updates in real-time
        try { updateStylesForDevice(drag.elementId, styles as Partial<TailwindStyles>); } catch {}

        // Apply inline styles directly to the DOM element for immediate visual feedback
        // (faster than waiting for Liveblocks → React re-render cycle).
        const el = getDragElement(drag.elementId);
        if (el) {
          el.style.width = `${Math.round(newWidth)}px`;
          el.style.height = `${Math.round(newHeight)}px`;
          if (drag.isAbsolute) {
            if (axes.dx === -1) el.style.left = `${Math.round(newLeft)}px`;
            if (axes.dy === -1) el.style.top = `${Math.round(newTop)}px`;
          }
        }

        // Update overlay rect in real-time during drag (world-space deltas)
        setDragRect({
          id: drag.elementId,
          rect: computeDragRect(drag.startRect, drag.handle, dx, dy, 1, e.shiftKey),
        });
      } else if (drag.type === "move") {
        const newLeft = Math.round(drag.startLeft + dx);
        const newTop = Math.round(drag.startTop + dy);

        // Store pending styles for commit on pointerup
        const moveStyles = {
          ...writeConstraint("left", newLeft),
          ...writeConstraint("top", newTop),
        };
        pendingStylesRef.current = moveStyles;

        // Write to CRDT so property panel updates in real-time
        try { updateStylesForDevice(drag.elementId, moveStyles as Partial<TailwindStyles>); } catch {}

        // Set left/top directly on the DOM element (not translate).
        // Using the same properties as extractArbitraryStyles means React's
        // eventual re-render overwrites with identical values — no clearing
        // needed, no race condition, no flash.
        const el = getDragElement(drag.elementId);
        if (el) {
          el.style.left = `${newLeft}px`;
          el.style.top = `${newTop}px`;
        }

        // Translate the overlay group (selection box + handles) in sync.
        // Uses world-space deltas since the overlay has CSS scale(zoom).
        const overlayGroup = getOverlayGroup(drag.elementId);
        if (overlayGroup) {
          overlayGroup.style.translate = `${dx}px ${dy}px`;
        }
      } else if (drag.type === "reparent") {
        spatialDragFlag.active = true;

        // Create visual ghost clone and freeze parent height before hiding (once)
        const el = getDragElement(drag.elementId);
        if (!dragGhostRef.current && el) {
          const rect = el.getBoundingClientRect();

          // Freeze parent height so it doesn't collapse when child is hidden
          const parentId = elements[drag.elementId]?.parentId;
          const parentEl = parentId
            ? canvasRef.current?.querySelector<HTMLElement>(`[data-element-id="${parentId}"]`)
            : canvasRef.current?.querySelector<HTMLElement>("[data-page]");
          if (parentEl) {
            parentEl.style.minHeight = `${parentEl.offsetHeight}px`;
            frozenParentRef.current = parentEl;
          }

          // Create ghost clone
          // The element lives inside cameraPageRef (CSS zoom: cam.zoom), so its
          // content is at world-space sizes. We set the clone to world-space
          // dimensions and use transform: scale(zoom) to shrink it to screen size.
          const clone = el.cloneNode(true) as HTMLElement;
          clone.style.position = "fixed";
          clone.style.left = `${rect.left}px`;
          clone.style.top = `${rect.top}px`;
          clone.style.width = `${rect.width / zoomScale}px`;
          clone.style.height = `${rect.height / zoomScale}px`;
          clone.style.transform = `scale(${zoomScale})`;
          clone.style.transformOrigin = "top left";
          clone.style.opacity = "0.6";
          clone.style.pointerEvents = "none";
          clone.style.zIndex = "99999";
          clone.style.margin = "0";
          clone.style.overflow = "hidden";
          clone.style.transition = "none";
          document.body.appendChild(clone);
          dragGhostRef.current = clone;
        }

        // Remove dragged element from flow so siblings collapse
        if (el) {
          el.style.display = "none";
          el.style.pointerEvents = "none";
        }

        // Take initial snapshot of sibling positions (once, after display:none)
        if (!reorderPreviewRef.current) {
          const currentParentId = elements[drag.elementId]?.parentId ?? null;
          const snapshot = snapshotSiblings(currentParentId, drag.elementId, drag);
          if (snapshot) reorderPreviewRef.current = snapshot;
        }

        // Move ghost clone to follow cursor
        if (dragGhostRef.current) {
          dragGhostRef.current.style.translate = `${screenDx}px ${screenDy}px`;
        }

        // Translate the overlay group to follow cursor (world-space deltas, overlay is scaled)
        const overlayGroup = getOverlayGroup(drag.elementId);
        if (overlayGroup) {
          overlayGroup.style.translate = `${dx}px ${dy}px`;
        }

        // Compute drop target — always hit-test first so canvas frames outside artboard work
        const canvas = canvasRef.current;
        if (canvas) {
          const canvasRect = canvas.getBoundingClientRect();
          const vpX = e.clientX - canvasRect.left;
          const vpY = e.clientY - canvasRect.top;
          const world = screenToWorld(vpX, vpY, cameraRef.current);
          const pageEl = canvas.querySelector<HTMLElement>('[data-page]');
          const pageWidth = pageEl ? pageEl.offsetWidth : 1440;
          const pageHeight = pageEl ? pageEl.offsetHeight : 900;
          const isInsideArtboard = world.x >= 0 && world.x <= pageWidth && world.y >= 0 && world.y <= pageHeight;

          // Hit-test to find drop target (runs regardless of artboard bounds)
          const target = computeDropTarget(e.clientX, e.clientY, canvas, elements, drag.elementId, activePageId);

          if (target && target.parentId !== null) {
            // Found a container (artboard container or canvas frame) — use it
            isOutsideArtboardRef.current = false;
            dropTargetRef.current = target;
          } else if (!isInsideArtboard) {
            // Root level outside artboard — will convert to canvas on drop
            isOutsideArtboardRef.current = true;
            dropTargetRef.current = null;
            clearReorderPreview();
            setDropHighlight(null);
            return;
          } else {
            // Root level inside artboard — normal artboard reparent
            isOutsideArtboardRef.current = false;
            dropTargetRef.current = target;
          }

          // Live reorder preview: shift siblings to show gap
          if (target && reorderPreviewRef.current) {
            const detectedParent = target.parentId ?? null;
            // If parent changed, re-snapshot for the new container
            if (detectedParent !== reorderPreviewRef.current.parentId) {
              clearReorderPreview();
              // Unfreeze old parent, freeze new parent
              if (frozenParentRef.current) {
                frozenParentRef.current.style.minHeight = "";
              }
              const newParentEl = detectedParent
                ? canvas.querySelector<HTMLElement>(`[data-element-id="${detectedParent}"]`)
                : canvas.querySelector<HTMLElement>("[data-page]");
              if (newParentEl) {
                newParentEl.style.minHeight = `${newParentEl.offsetHeight}px`;
                frozenParentRef.current = newParentEl;
              }
              const snapshot = snapshotSiblings(detectedParent, drag.elementId, drag);
              if (snapshot) reorderPreviewRef.current = snapshot;
            }
            if (reorderPreviewRef.current) {
              const insertIdx = computeInsertIndexFromSnapshot(reorderPreviewRef.current, e.clientX, e.clientY);
              applyReorderPreview(insertIdx);
            }
          }

          if (target) {
            // Compute visual feedback rects in world-space coordinates.
            // The drop highlight renders inside overlayZoomRef (CSS zoom),
            // so we must convert screen-space getBoundingClientRect() values
            // to world-space, matching the useElementBounds pattern.
            const wRef = worldRef.current;
            const worldRect = wRef?.getBoundingClientRect();
            const zoom = zoomScale || 1;
            let containerRect: Rect | null = null;
            let lineRect: { x: number; y: number; width: number; height: number } | null = null;

            // Container highlight
            if (target.parentId && worldRect) {
              const containerEl = canvas.querySelector<HTMLElement>(`[data-element-id="${target.parentId}"]`);
              if (containerEl) {
                const cr = containerEl.getBoundingClientRect();
                containerRect = {
                  x: (cr.left - worldRect.left) / zoom,
                  y: (cr.top - worldRect.top) / zoom,
                  width: cr.width / zoom,
                  height: cr.height / zoom,
                };
              }
            }

            // Insertion line
            if (target.siblingId && worldRect) {
              const siblingEl = canvas.querySelector<HTMLElement>(`[data-element-id="${target.siblingId}"]`);
              if (siblingEl) {
                const sr = siblingEl.getBoundingClientRect();
                const parentEl = target.parentId
                  ? canvas.querySelector<HTMLElement>(`[data-element-id="${target.parentId}"]`)
                  : canvas.querySelector<HTMLElement>('[data-page]');
                const parentRect = parentEl?.getBoundingClientRect();
                if (!parentRect) { setDropHighlight(null); return; }

                // Determine flex direction for line orientation
                const isVertical = target.parentId
                  ? elements[target.parentId]?.tailwindStyles?.flexDirection !== "flex-row"
                  : true;

                if (isVertical) {
                  const y = target.position === "before"
                    ? (sr.top - worldRect.top) / zoom
                    : (sr.bottom - worldRect.top) / zoom;
                  lineRect = {
                    x: (parentRect.left - worldRect.left) / zoom + 2,
                    y: y - 1,
                    width: parentRect.width / zoom - 4,
                    height: 2,
                  };
                } else {
                  const x = target.position === "before"
                    ? (sr.left - worldRect.left) / zoom
                    : (sr.right - worldRect.left) / zoom;
                  lineRect = {
                    x: x - 1,
                    y: (parentRect.top - worldRect.top) / zoom + 2,
                    width: 2,
                    height: parentRect.height / zoom - 4,
                  };
                }
              }
            }

            setDropHighlight({ containerId: target.parentId, containerRect, lineRect });
          } else {
            setDropHighlight(null);
          }
        }
      } else if (drag.type === "canvas-move") {
        // Canvas element move: update world x/y
        const newX = Math.round((drag.startWorldX ?? 0) + dx);
        const newY = Math.round((drag.startWorldY ?? 0) + dy);

        mutations.updateElement(drag.elementId, { x: newX, y: newY });

        // Translate the overlay group in sync (world-space deltas, overlay is scaled)
        const overlayGroup = getOverlayGroup(drag.elementId);
        if (overlayGroup) {
          overlayGroup.style.translate = `${dx}px ${dy}px`;
        }

        // Show drop highlights for canvas→artboard or canvas→canvas-frame conversion
        const canvas = canvasRef.current;
        if (canvas) {
          const canvasRect = canvas.getBoundingClientRect();
          const vpX = e.clientX - canvasRect.left;
          const vpY = e.clientY - canvasRect.top;
          const world = screenToWorld(vpX, vpY, cameraRef.current);
          const pageEl = canvas.querySelector<HTMLElement>('[data-page]');
          const pageWidth = pageEl ? pageEl.offsetWidth : 1440;
          const pageHeight = pageEl ? pageEl.offsetHeight : 900;
          const isInsideArtboard = world.x >= 0 && world.x <= pageWidth && world.y >= 0 && world.y <= pageHeight;

          // Always hit-test so canvas frames outside artboard are found
          const target = computeDropTarget(e.clientX, e.clientY, canvas, elements, drag.elementId, activePageId);

          if ((target && target.parentId !== null) || isInsideArtboard) {
            // Found a container (canvas frame or artboard container), or cursor is inside artboard
            canvasToArtboardTargetRef.current = target;
            if (target) {
              // Convert to world-space (rendered inside overlayZoomRef with CSS zoom)
              const wRef = worldRef.current;
              const wRect = wRef?.getBoundingClientRect();
              const zm = zoomScale || 1;
              let containerRect: Rect | null = null;
              let lineRect: { x: number; y: number; width: number; height: number } | null = null;
              if (target.parentId && wRect) {
                const containerEl = canvas.querySelector<HTMLElement>(`[data-element-id="${target.parentId}"]`);
                if (containerEl) {
                  const cr = containerEl.getBoundingClientRect();
                  containerRect = {
                    x: (cr.left - wRect.left) / zm,
                    y: (cr.top - wRect.top) / zm,
                    width: cr.width / zm,
                    height: cr.height / zm,
                  };
                }
              }
              if (target.siblingId && wRect) {
                const siblingEl = canvas.querySelector<HTMLElement>(`[data-element-id="${target.siblingId}"]`);
                if (siblingEl) {
                  const sr = siblingEl.getBoundingClientRect();
                  const parentEl = target.parentId ? canvas.querySelector<HTMLElement>(`[data-element-id="${target.parentId}"]`) : canvas.querySelector<HTMLElement>('[data-page]');
                  const parentRect = parentEl?.getBoundingClientRect();
                  if (parentRect) {
                    const isVertical = target.parentId ? elements[target.parentId]?.tailwindStyles?.flexDirection !== "flex-row" : true;
                    if (isVertical) {
                      const y = target.position === "before" ? (sr.top - wRect.top) / zm : (sr.bottom - wRect.top) / zm;
                      lineRect = { x: (parentRect.left - wRect.left) / zm + 2, y: y - 1, width: parentRect.width / zm - 4, height: 2 };
                    } else {
                      const x = target.position === "before" ? (sr.left - wRect.left) / zm : (sr.right - wRect.left) / zm;
                      lineRect = { x: x - 1, y: (parentRect.top - wRect.top) / zm + 2, width: 2, height: parentRect.height / zm - 4 };
                    }
                  }
                }
              }
              setDropHighlight({ containerId: target.parentId, containerRect, lineRect });
            } else {
              setDropHighlight(null);
            }
          } else {
            // Outside artboard with no container — free canvas move
            canvasToArtboardTargetRef.current = null;
            setDropHighlight(null);
          }
        }
      } else if (drag.type === "canvas-resize" && drag.handle) {
        const axes = HANDLE_AXES[drag.handle];
        let newWidth = drag.startWidth;
        let newHeight = drag.startHeight;
        let newX = drag.startWorldX ?? 0;
        let newY = drag.startWorldY ?? 0;

        if (axes.dx === 1) {
          newWidth = Math.max(MIN_SIZE, drag.startWidth + dx);
        } else if (axes.dx === -1) {
          const delta = Math.min(dx, drag.startWidth - MIN_SIZE);
          newWidth = drag.startWidth - delta;
          newX = (drag.startWorldX ?? 0) + delta;
        }

        if (axes.dy === 1) {
          newHeight = Math.max(MIN_SIZE, drag.startHeight + dy);
        } else if (axes.dy === -1) {
          const delta = Math.min(dy, drag.startHeight - MIN_SIZE);
          newHeight = drag.startHeight - delta;
          newY = (drag.startWorldY ?? 0) + delta;
        }

        // Shift = aspect ratio lock
        if (e.shiftKey && drag.startWidth > 0 && drag.startHeight > 0) {
          const ratio = drag.startWidth / drag.startHeight;
          if (axes.dx !== 0 && axes.dy !== 0) {
            const wFromH = newHeight * ratio;
            const hFromW = newWidth / ratio;
            if (newWidth / ratio < newHeight) {
              newHeight = hFromW;
            } else {
              newWidth = wFromH;
            }
          } else if (axes.dx !== 0) {
            newHeight = newWidth / ratio;
          } else {
            newWidth = newHeight * ratio;
          }
        }

        mutations.updateElement(drag.elementId, {
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newWidth),
          height: Math.round(newHeight),
        });

        // Sync tailwind dimension classes so the inner RenderElement matches
        updateStylesForDevice(drag.elementId, {
          width: `w-[${Math.round(newWidth)}px]`,
          height: `h-[${Math.round(newHeight)}px]`,
        });

        // Update overlay rect in real-time (world-space deltas)
        setDragRect({
          id: drag.elementId,
          rect: computeDragRect(drag.startRect, drag.handle, dx, dy, 1, e.shiftKey),
        });
      } else if (drag.type === "artboard-pan") {
        // Dragging the artboard moves its stored position (not the camera)
        const dx = screenDx / zoomScale;
        const dy = screenDy / zoomScale;
        mutations.updatePageStyles({ artboardX: drag.startLeft + dx, artboardY: drag.startTop + dy });
        // Update selection box in real-time
        setDragRect({
          id: ARTBOARD_LAYER_ID,
          rect: {
            x: drag.startRect.x + dx,
            y: drag.startRect.y + dy,
            width: drag.startRect.width,
            height: drag.startRect.height,
          },
        });
      }
    },
    [zoomScale, getDragElement, getOverlayGroup, canvasRef, elements, mutations, updateStylesForDevice, cameraRef, applyCamera, activePageId, snapshotSiblings, computeInsertIndexFromSnapshot, applyReorderPreview, clearReorderPreview]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    // Resume history to batch all drag mutations into a single undo entry
    mutations.resumeHistory();

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may already be released
    }
    const pendingStyles = pendingStylesRef.current;
    const elementId = drag.elementId;
    const wasMove = drag.type === "move";
    const wasCanvasMove = drag.type === "canvas-move";
    const wasCanvasResize = drag.type === "canvas-resize";
    const wasReparent = drag.type === "reparent";
    const wasArtboardPan = drag.type === "artboard-pan";

    dragRef.current = null;
    pendingStylesRef.current = null;

    // Artboard pan: clear drag rect and re-measure
    if (wasArtboardPan) {
      flushSync(() => {
        setDragRect(null);
        suppressRef.current = false;
        measure();
      });
      return;
    }

    // Canvas move/resize: clear overlay translate and re-measure
    if (wasCanvasMove || wasCanvasResize) {
      // Check if canvas element was dragged over the artboard — convert to artboard element
      const artboardTarget = canvasToArtboardTargetRef.current;
      if (wasCanvasMove && artboardTarget) {
        if (artboardTarget.siblingId) {
          // Use existing drop logic for sibling-based positioning
          mutations.convertToArtboard(elementId, artboardTarget.parentId ?? null, artboardTarget.insertIndex);
        } else if (artboardTarget.parentId !== undefined) {
          mutations.convertToArtboard(elementId, artboardTarget.parentId, artboardTarget.insertIndex);
        } else {
          // Root-level drop
          mutations.convertToArtboard(elementId, null, -1);
        }
        canvasToArtboardTargetRef.current = null;
      }

      const overlayGroup = getOverlayGroup(elementId);
      if (overlayGroup) {
        overlayGroup.style.translate = "";
      }
      flushSync(() => {
        suppressRef.current = false;
        measure();
        setDragRect(null);
        setDropHighlight(null);
      });
      return;
    }

    if (wasReparent) {
      // Remove drag ghost clone and unfreeze parent
      if (dragGhostRef.current) {
        dragGhostRef.current.remove();
        dragGhostRef.current = null;
      }
      if (frozenParentRef.current) {
        frozenParentRef.current.style.minHeight = "";
        frozenParentRef.current = null;
      }

      // Capture snapshot insert index before clearing preview
      const snapshotInsertIndex = reorderPreviewRef.current?.insertIndex ?? -1;
      const snapshotParentId = reorderPreviewRef.current?.parentId;
      const snapshotSiblingIds = reorderPreviewRef.current?.siblingIds;

      // Clear reorder preview transforms
      clearReorderPreview();

      // Restore the original element's visibility
      const el = getDragElement(elementId);
      if (el) {
        el.style.display = "";
        el.style.pointerEvents = "";
      }

      // Clear overlay translate
      const overlayGroup = getOverlayGroup(elementId);
      if (overlayGroup) {
        overlayGroup.style.translate = "";
      }

      // Apply the reparent mutation — use snapshot insert index for accuracy
      const target = dropTargetRef.current;
      if (target && snapshotInsertIndex >= 0 && snapshotSiblingIds) {
        // Use snapshot-based sibling + position for accurate drop
        if (snapshotInsertIndex < snapshotSiblingIds.length) {
          mutations.dropElementDirect(elementId, snapshotSiblingIds[snapshotInsertIndex], "before");
        } else if (snapshotSiblingIds.length > 0) {
          mutations.dropElementDirect(elementId, snapshotSiblingIds[snapshotSiblingIds.length - 1], "after");
        } else if (target.parentId !== undefined) {
          mutations.reparentIntoContainer(elementId, target.parentId, 0);
        }
      } else if (target) {
        // Fallback to original logic if no snapshot
        if (target.siblingId) {
          mutations.dropElementDirect(elementId, target.siblingId, target.position);
        } else if (target.parentId !== undefined) {
          mutations.reparentIntoContainer(elementId, target.parentId, target.insertIndex);
        }
      } else if (isOutsideArtboardRef.current) {
        // Convert artboard element to canvas element
        const canvas = canvasRef.current;
        if (canvas) {
          const canvasRect = canvas.getBoundingClientRect();
          const vpX = e.clientX - canvasRect.left;
          const vpY = e.clientY - canvasRect.top;
          const world = screenToWorld(vpX, vpY, cameraRef.current);
          const width = drag.startWidth;
          const height = drag.startHeight;
          mutations.convertToCanvas(elementId, world.x - width / 2, world.y - height / 2, width, height);
        }
      }

      dropTargetRef.current = null;
      isOutsideArtboardRef.current = false;
      spatialDragFlag.active = false;

      flushSync(() => {
        suppressRef.current = false;
        measure();
        setDragRect(null);
        setDropHighlight(null);
      });
      return;
    }

    // For move drags: check if element was moved outside its parent frame → convert to canvas
    if (wasMove && elements[elementId]?.parentId) {
      const canvas = canvasRef.current;
      if (canvas) {
        const parentEl = canvas.querySelector<HTMLElement>(`[data-element-id="${elements[elementId].parentId}"]`);
        if (parentEl) {
          const parentRect = parentEl.getBoundingClientRect();
          const elDom = getDragElement(elementId);
          if (elDom) {
            const elRect = elDom.getBoundingClientRect();
            const elCenterX = elRect.left + elRect.width / 2;
            const elCenterY = elRect.top + elRect.height / 2;
            // Element's center is outside parent frame → convert to canvas
            if (elCenterX < parentRect.left || elCenterX > parentRect.right ||
                elCenterY < parentRect.top || elCenterY > parentRect.bottom) {
              const canvasRect = canvas.getBoundingClientRect();
              const vpX = elCenterX - canvasRect.left;
              const vpY = elCenterY - canvasRect.top;
              const world = screenToWorld(vpX, vpY, cameraRef.current);
              const width = drag.startWidth;
              const height = drag.startHeight;
              mutations.convertToCanvas(elementId, world.x - width / 2, world.y - height / 2, width, height);

              const overlayGroup = getOverlayGroup(elementId);
              if (overlayGroup) overlayGroup.style.translate = "";
              flushSync(() => {
                suppressRef.current = false;
                measure();
                setDragRect(null);
              });
              return;
            }
          }
        }
      }
    }

    // Commit final styles to CRDT
    if (pendingStyles) {
      updateStylesForDevice(elementId, pendingStyles);
    }

    // Clear overlay group translate (move drag only).
    if (wasMove) {
      const overlayGroup = getOverlayGroup(elementId);
      if (overlayGroup) {
        overlayGroup.style.translate = "";
      }
    }

    // Force synchronous re-measure and overlay re-render.
    flushSync(() => {
      suppressRef.current = false;
      measure();
      setDragRect(null);
    });
  }, [measure, suppressRef, updateStylesForDevice, getOverlayGroup, getDragElement, mutations, canvasRef, cameraRef, elements, clearReorderPreview]);

  // ── Move handler (absolute elements only) ──

  const handleMovePointerDown = useCallback(
    (e: React.PointerEvent, elementId: string) => {
      // Don't move during text editing — allow text selection instead
      if (editingElementId) return;
      // Only allow move for absolute-positioned elements
      const el = elements[elementId];
      if (!el) return;
      const styles = getStyles(el);
      if (readPositionType(styles) !== "absolute") return;

      // Option+drag: leave a clone at the original position
      if (e.altKey) {
        mutations.duplicateElementForDrag(elementId);
      }

      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      suppressRef.current = true;
      mutations.pauseHistory();

      const rect = bounds.get(elementId);
      if (!rect) return;

      // Pin the element's width if it doesn't have an explicit pixel width.
      // Without this, moving right reduces available space and causes text wrap.
      const size = readSize(styles);
      const renderedWidth = Math.round(rect.width);
      if (!size.width || size.width === "auto" || size.width === "full") {
        updateStylesForDevice(elementId, writeWidth(String(renderedWidth)));
      }

      dragRef.current = {
        type: "move",
        elementId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startWidth: renderedWidth,
        startHeight: rect.height,
        startLeft: readConstraint(styles, "left") ?? 0,
        startTop: readConstraint(styles, "top") ?? 0,
        isAbsolute: true,
        startRect: rect,
      };
    },
    [bounds, elements, zoomScale, updateStylesForDevice, getStyles, editingElementId, mutations]
  );

  // ── Reparent handler (non-absolute elements) ──

  const handleReparentPointerDown = useCallback(
    (e: React.PointerEvent, elementId: string) => {
      // Don't reparent during text editing — allow text selection instead
      if (editingElementId) return;
      // Block multi-selection reparent (v1)
      if (selectedIds.length > 1) return;

      // Option+drag: leave a clone at the original position
      if (e.altKey) {
        mutations.duplicateElementForDrag(elementId);
      }

      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      suppressRef.current = true;
      mutations.pauseHistory();

      const rect = bounds.get(elementId);
      if (!rect) return;

      const el = elements[elementId];

      dragRef.current = {
        type: "reparent",
        elementId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
        startLeft: 0,
        startTop: 0,
        isAbsolute: false,
        startRect: rect,
        originalParentId: el?.parentId ?? null,
      };
    },
    [bounds, elements, zoomScale, selectedIds.length, editingElementId, mutations]
  );

  // ── Canvas element move handler ──

  const handleCanvasMovePointerDown = useCallback(
    (e: React.PointerEvent, elementId: string) => {
      // Don't move during text editing — allow text selection instead
      if (editingElementId) return;
      const el = elements[elementId];
      if (!el || el.placement !== "canvas") return;

      const rect = bounds.get(elementId);
      if (!rect) return;

      // Option+drag: leave a clone at the original position
      if (e.altKey) {
        mutations.duplicateElementForDrag(elementId);
      }

      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      suppressRef.current = true;
      mutations.pauseHistory();

      dragRef.current = {
        type: "canvas-move",
        elementId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startWidth: el.width ?? Math.round(rect.width),
        startHeight: el.height ?? Math.round(rect.height),
        startLeft: 0,
        startTop: 0,
        isAbsolute: false,
        startRect: rect,
        startWorldX: el.x,
        startWorldY: el.y,
      };
    },
    [bounds, elements, editingElementId, mutations]
  );

  // ── Canvas element resize handler ──

  const handleCanvasResizePointerDown = useCallback(
    (e: React.PointerEvent, elementId: string, handle: HandlePosition) => {
      const el = elements[elementId];
      if (!el || el.placement !== "canvas") return;

      const rect = bounds.get(elementId);
      if (!rect) return;

      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      suppressRef.current = true;
      mutations.pauseHistory();

      dragRef.current = {
        type: "canvas-resize",
        elementId,
        handle,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startWidth: el.width ?? Math.round(rect.width),
        startHeight: el.height ?? Math.round(rect.height),
        startLeft: 0,
        startTop: 0,
        isAbsolute: false,
        startRect: rect,
        startWorldX: el.x,
        startWorldY: el.y,
      };
    },
    [bounds, elements, mutations]
  );

  // ── Artboard pan handler (drag artboard = pan camera) ──

  const handleArtboardPanPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (editingElementId) return;
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      suppressRef.current = true;
      mutations.pauseHistory();

      const measured = bounds.get(ARTBOARD_LAYER_ID);
      dragRef.current = {
        type: "artboard-pan",
        elementId: ARTBOARD_LAYER_ID,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startWidth: measured?.width ?? 0,
        startHeight: measured?.height ?? 0,
        startLeft: pageStyles?.artboardX ?? 0,
        startTop: pageStyles?.artboardY ?? 0,
        isAbsolute: false,
        startRect: measured ?? { x: 0, y: 0, width: 0, height: 0 },
      };
    },
    [editingElementId, pageStyles?.artboardX, pageStyles?.artboardY, mutations, bounds]
  );

  // ── Rect lookup (dragRect overrides measured bounds during drag) ──

  const getRect = useCallback(
    (id: string) => {
      if (dragRect?.id === id) {
        // Preserve rotation from measured bounds during drag
        const measured = bounds.get(id);
        if (measured?.rotation) {
          return { ...dragRect.rect, rotation: measured.rotation };
        }
        return dragRect.rect;
      }
      return bounds.get(id);
    },
    [dragRect, bounds]
  );

  // ── Render helpers ──

  const renderHandle = (
    elementId: string,
    rect: Rect,
    position: HandlePosition,
    isCanvasElement: boolean = false,
  ) => {
    let x = rect.x;
    let y = rect.y;

    // Position handle at edge/corner
    switch (position) {
      case "nw": break; // top-left corner
      case "n":  x += rect.width / 2; break;
      case "ne": x += rect.width; break;
      case "e":  x += rect.width; y += rect.height / 2; break;
      case "se": x += rect.width; y += rect.height; break;
      case "s":  x += rect.width / 2; y += rect.height; break;
      case "sw": y += rect.height; break;
      case "w":  y += rect.height / 2; break;
    }

    return (
      <div
        key={`${elementId}-handle-${position}`}
        onPointerDown={(e) => isCanvasElement ? handleCanvasResizePointerDown(e, elementId, position) : handleResizePointerDown(e, elementId, position)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left: x - HALF * invZoom,
          top: y - HALF * invZoom,
          width: HANDLE_SIZE * invZoom,
          height: HANDLE_SIZE * invZoom,
          backgroundColor: "white",
          border: `${1.5 * invZoom}px solid ${SELECTION_COLOR}`,
          borderRadius: invZoom,
          cursor: HANDLE_CURSORS[position],
          pointerEvents: "auto",
          zIndex: 2,
        }}
      />
    );
  };

  const ALL_HANDLES: HandlePosition[] = ["nw", "ne", "se", "sw"];
  const EDGE_POSITIONS: HandlePosition[] = ["n", "s", "e", "w"];
  const EDGE_HIT_SIZE = 6; // px — invisible grab zone width

  // Render an invisible edge resize zone along one side of the bounding box
  const renderEdge = (
    elementId: string,
    rect: Rect,
    position: HandlePosition,
    isCanvasElement: boolean = false,
  ) => {
    const inset = HALF * invZoom; // avoid overlapping corner handles (zoom-invariant)
    const thickness = EDGE_HIT_SIZE * invZoom; // zoom-invariant hit zone
    let left: number, top: number, width: number, height: number;

    switch (position) {
      case "n": // top edge
        left = rect.x + inset;
        top = rect.y - thickness / 2;
        width = rect.width - inset * 2;
        height = thickness;
        break;
      case "s": // bottom edge
        left = rect.x + inset;
        top = rect.y + rect.height - thickness / 2;
        width = rect.width - inset * 2;
        height = thickness;
        break;
      case "e": // right edge
        left = rect.x + rect.width - thickness / 2;
        top = rect.y + inset;
        width = thickness;
        height = rect.height - inset * 2;
        break;
      case "w": // left edge
        left = rect.x - thickness / 2;
        top = rect.y + inset;
        width = thickness;
        height = rect.height - inset * 2;
        break;
      default:
        return null;
    }

    return (
      <div
        key={`${elementId}-edge-${position}`}
        onPointerDown={(e) => isCanvasElement ? handleCanvasResizePointerDown(e, elementId, position) : handleResizePointerDown(e, elementId, position)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left,
          top,
          width: Math.max(0, width),
          height: Math.max(0, height),
          cursor: HANDLE_CURSORS[position],
          pointerEvents: "auto",
          zIndex: 2,
        }}
      />
    );
  };

  // ── Shape outline SVG helper ──
  // Renders the shape path as a blue outline at the given position/size.
  // Used for hover outlines, selection outlines, and creation previews.
  const renderShapeOutline = (
    shapeType: string,
    x: number, y: number, w: number, h: number,
    strokeColor: string = SELECTION_COLOR
  ) => {
    let path: React.ReactNode = null;
    switch (shapeType) {
      case 'rectangle':
        path = <rect width="100" height="100" fill="none" stroke={strokeColor} strokeWidth={2 * invZoom} vectorEffect="non-scaling-stroke" />;
        break;
      case 'circle':
        path = <ellipse cx="50" cy="50" rx="49" ry="49" fill="none" stroke={strokeColor} strokeWidth={2 * invZoom} vectorEffect="non-scaling-stroke" />;
        break;
      case 'star':
        path = <polygon points="50,2 61,35 97,35 68,57 79,91 50,70 21,91 32,57 3,35 39,35" fill="none" stroke={strokeColor} strokeWidth={2 * invZoom} vectorEffect="non-scaling-stroke" />;
        break;
      default:
        return null;
    }
    return (
      <svg
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: w,
          height: h,
          pointerEvents: "none",
          overflow: "visible",
        }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {path}
      </svg>
    );
  };

  // ── Render ──

  // Multi-select union rect (exclude artboard from union computation)
  let unionRect: Rect | null = null;
  if (selectedIds.length > 1) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of selectedIds) {
      if (id === ARTBOARD_LAYER_ID) continue;
      const r = getRect(id);
      if (!r) continue;
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.width);
      maxY = Math.max(maxY, r.y + r.height);
    }
    if (minX < Infinity) {
      unionRect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
  }

  // Overlay root should capture pointer events when creation tool is active
  // (except during panning). Individual handles/boxes set their own pointerEvents.
  const overlayPointerEvents = isCreationMode && !isSpaceRef.current
    ? "auto"
    : "none";

  return (
    <div
      ref={overlayRootRef}
      onPointerMove={handleCreationPointerMove}
      onPointerUp={handleCreationPointerUp}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: overlayPointerEvents,
        cursor: isCreationMode ? "crosshair" : CUSTOM_CURSOR,
        zIndex: 40,
      }}
    >
      {/* AI selection pulse animation */}
      <style dangerouslySetInnerHTML={{ __html: "@keyframes ai-selection-pulse{0%,100%{opacity:1}50%{opacity:0}}" }} />

      {/* Hover outline (non-selected) */}
      {hoveredId && !selectedIds.includes(hoveredId) && bounds.get(hoveredId) && (() => {
        const r = bounds.get(hoveredId)!;
        const hoveredEl = elements[hoveredId];
        const hoveredType = hoveredEl?.type;
        // For shapes, show the shape outline instead of rectangular box
        if (hoveredType === 'rectangle' || hoveredType === 'circle' || hoveredType === 'star') {
          return renderShapeOutline(hoveredType, r.x, r.y, r.width, r.height);
        }
        // For rotated elements, apply rotation to hover outline
        const hoverRotation = r.rotation;
        const hoverTransform: React.CSSProperties | undefined = hoverRotation
          ? {
              transformOrigin: `${r.x + r.width / 2}px ${r.y + r.height / 2}px`,
              transform: `rotate(${hoverRotation}deg)`,
            }
          : undefined;
        return (
          <div
            style={{
              position: "absolute",
              left: r.x,
              top: r.y,
              width: r.width,
              height: r.height,
              border: `${2 * invZoom}px solid ${SELECTION_COLOR}`,
              pointerEvents: "none",
              ...hoverTransform,
            }}
          />
        );
      })()}

      {/* Multi-select union box */}
      {unionRect && (
        <div
          style={{
            position: "absolute",
            left: unionRect.x,
            top: unionRect.y,
            width: unionRect.width,
            height: unionRect.height,
            border: `${invZoom}px dashed ${SELECTION_COLOR}`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Parent container indicator (dashed border around parent of selected element) — hidden during AI mode */}
      {parentIndicatorId && !animationPopover && bounds.get(parentIndicatorId) && (() => {
        const r = bounds.get(parentIndicatorId)!;
        return (
          <svg
            style={{
              position: "absolute",
              left: r.x,
              top: r.y,
              width: r.width,
              height: r.height,
              pointerEvents: "none",
              overflow: "visible",
            }}
          >
            <rect
              x={invZoom / 2}
              y={invZoom / 2}
              width={r.width - invZoom}
              height={r.height - invZoom}
              fill="none"
              stroke={SELECTION_COLOR}
              strokeWidth={invZoom}
              strokeDasharray={`${invZoom} ${invZoom}`}
            />
          </svg>
        );
      })()}

      {/* Selection boxes + handles */}
      {selectedIds.map((id) => {
        const r = getRect(id);
        if (!r) return null;

        // Artboard: selection box only — no handles, no badges, drag = camera pan
        if (id === ARTBOARD_LAYER_ID) {
          return (
            <div key={id} data-overlay-for={id}>
              <div
                onPointerDown={handleArtboardPanPointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  // Clear artboard selection then find and select the element underneath
                  mutations.clearSelection();
                  // Temporarily hide overlay to find element below
                  const overlay = e.currentTarget as HTMLElement;
                  overlay.style.pointerEvents = 'none';
                  const elBelow = document.elementFromPoint(e.clientX, e.clientY);
                  overlay.style.pointerEvents = '';
                  // Walk up to find the nearest element with data-element-id
                  let target = elBelow;
                  while (target && target !== document.body) {
                    const elId = (target as HTMLElement).dataset?.elementId;
                    if (elId && elId !== ARTBOARD_LAYER_ID) {
                      mutations.selectElement(elId);
                      return;
                    }
                    target = target.parentElement;
                  }
                }}
                style={{
                  position: "absolute",
                  left: r.x,
                  top: r.y,
                  width: r.width,
                  height: r.height,
                  border: `${2 * invZoom}px solid ${SELECTION_COLOR}`,
                  pointerEvents: isModHeld ? "none" : "auto",
                  cursor: "inherit",
                  zIndex: 1,
                }}
              />
            </div>
          );
        }

        const elementHandles = ALL_HANDLES;
        const elementEdges = EDGE_POSITIONS;

        // For rotated elements, apply rotation to the entire overlay group
        // so the bounding box + handles follow the element's rotation.
        const overlayRotation = r.rotation;
        const overlayGroupStyle: React.CSSProperties | undefined = overlayRotation
          ? {
              transformOrigin: `${r.x + r.width / 2}px ${r.y + r.height / 2}px`,
              transform: `rotate(${overlayRotation}deg)`,
            }
          : undefined;

        const isAIActive = animationPopover?.elementId === id;
        const isAILoading = isAIActive && animationPopover?.phase === "loading";

        return (
          <div key={id} data-overlay-for={id} style={overlayGroupStyle}>
            {/* Selection bounding box — canvas-move for canvas elements, move for absolute, reparent for flow */}
            {(() => {
              // Canvas element = placement "canvas" AND no parent (free-floating).
              // If it has a parentId, it's in the artboard tree despite the flag.
              const isCanvasElement = elements[id]?.placement === "canvas" && !elements[id]?.parentId;
              const isAbsolute = !isCanvasElement && elements[id]?.tailwindStyles &&
                readPositionType(elements[id].tailwindStyles!) === "absolute";
              const normalBox: React.CSSProperties = {
                position: "absolute",
                left: r.x,
                top: r.y,
                width: r.width,
                height: r.height,
                pointerEvents: (isModHeld || editingElementId === id) ? "none" : "auto",
                cursor: isAltHeld ? DUPLICATE_CURSOR : "inherit",
                zIndex: 1,
              };
              return (
                <div
                  onPointerDown={(e) => {
                    // Shift+click: toggle this element out of selection
                    if (e.shiftKey) {
                      e.stopPropagation();
                      e.preventDefault();
                      mutations.toggleElementSelection(id);
                      return;
                    }
                    if (isCanvasElement) handleCanvasMovePointerDown(e, id);
                    else if (isAbsolute) handleMovePointerDown(e, id);
                    else handleReparentPointerDown(e, id);
                  }}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={(e) => e.stopPropagation()}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    elementContextMenuRef.open?.(e.clientX, e.clientY, id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    const el = elements[id];
                    if (!el) return;
                    if (el.type === "container") {
                      mutations.enterContainer(id);
                    } else if (["heading", "text", "button", "badge"].includes(el.type || "")) {
                      if (!el.locked && (isAdmin || !el.isCore)) {
                        mutations.setEditingElementId(id);
                      }
                    }
                  }}
                  style={{
                    ...normalBox,
                    border: editingElementId === id ? `${invZoom}px solid ${SELECTION_COLOR}` : `${2 * invZoom}px solid ${SELECTION_COLOR}`,
                    ...(isAILoading ? { animation: "ai-selection-pulse 2s ease-in-out infinite" } : {}),
                  }}
                >
                </div>
              );
            })()}
            {/* Shape outline (Figma-style: shows shape path in addition to bounding box) */}
            {!isAIActive && (() => {
              const el = elements[id];
              if (!el) return null;
              const shapeType = el.type;
              if (shapeType !== 'rectangle' && shapeType !== 'circle' && shapeType !== 'star') return null;
              return renderShapeOutline(shapeType, r.x, r.y, r.width, r.height);
            })()}
            {/* Edge resize zones + corner handles — hidden during text editing and AI mode */}
            {editingElementId !== id && !isAIActive && (
              <>
                {elementEdges.map((pos) => {
                  const isCanvas = elements[id]?.placement === "canvas" && !elements[id]?.parentId;
                  return renderEdge(id, r, pos, isCanvas);
                })}
                {elementHandles.map((pos) => {
                  const isCanvas = elements[id]?.placement === "canvas" && !elements[id]?.parentId;
                  return renderHandle(id, r, pos, isCanvas);
                })}
              </>
            )}
            {/* Dimension badge — CSS zoom counter-scale (layout-phase, no jitter) */}
            {selectedIds.length === 1 && !isAIActive && (() => {
              const el = elements[id];
              if (!el) return null;

              const isProtected = !isAdmin && (el.isCore || el.textLocked);
              const size = readSize(getStyles(el));
              const pxW = Math.round(r.width);
              const pxH = Math.round(r.height);

              const wMode = size.width === "fill" ? " Fill" : size.width === "hug" ? " Hug" : size.width === "viewport" ? " Viewport" : "";
              const hMode = size.height === "fill" ? " Fill" : size.height === "hug" ? " Hug" : size.height === "viewport" ? " Viewport" : "";
              const dimText = `${pxW}${wMode} \u00D7 ${pxH}${hMode}`;

              return (
                <div
                  style={{
                    position: "absolute",
                    left: r.x + r.width / 2,
                    top: r.y + r.height,
                    width: 0,
                    height: 0,
                    overflow: "visible",
                    pointerEvents: "none",
                    zIndex: 3,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      zoom: "var(--inv-zoom, 1)",
                      transform: "translateX(-50%)",
                    } as React.CSSProperties}
                  >
                    <div
                      style={{
                        marginTop: 8,
                        backgroundColor: "#3b82f6",
                        color: "white",
                        fontSize: 11,
                        lineHeight: "16px",
                        fontWeight: 450,
                        letterSpacing: 0.045,
                        paddingLeft: isProtected ? 1 : 4,
                        paddingRight: isProtected ? 6 : 4,
                        paddingTop: 2,
                        paddingBottom: 2,
                        borderRadius: 4,
                        whiteSpace: "nowrap",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0,
                      }}
                    >
                      {isProtected && (
                        <>
                          <LockSmall style={{ width: 24, height: 24, flexShrink: 0 }} />
                          {"Protected \u00B7 "}
                        </>
                      )}
                      {dimText}
                    </div>
                  </div>
                </div>
              );
            })()}
            {/* AI sparkle button — CSS zoom counter-scale (layout-phase, no jitter) */}
            {isAdmin && selectedIds.length === 1 && editingElementId !== id && (
              <div
                style={{
                  position: "absolute",
                  left: r.x + r.width,
                  top: r.y,
                  width: 0,
                  height: 0,
                  overflow: "visible",
                  zIndex: 3,
                }}
              >
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isAIActive) {
                      setAnimationPopover(null);
                      return;
                    }
                    setAnimationPopover({ elementId: id, phase: "prompt" });
                  }}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    zoom: "var(--inv-zoom, 1)",
                    marginLeft: 8,
                    color: isAILoading ? SELECTION_COLOR : isAIActive ? "white" : SELECTION_COLOR,
                    background: isAILoading ? "none" : isAIActive ? SELECTION_COLOR : "none",
                    border: "none",
                    borderRadius: isAIActive && !isAILoading ? 4 : 0,
                    padding: 0,
                    lineHeight: 0,
                    width: 16,
                    height: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "auto",
                    cursor: "default",
                  } as React.CSSProperties}
                >
                  {isAIActive ? (
                    <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                      <path d="M3 8C5.77778 7.16667 7.16667 5.77778 8 3C8.83333 5.77778 10.2222 7.16667 13 8C10.2222 8.83333 8.83333 10.2222 8 13C7.16667 10.2222 5.77778 8.83333 3 8Z" fill="currentColor" />
                    </svg>
                  ) : (
                    <AiSparkle16 style={{ width: 16, height: 16 }} />
                  )}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Badge — multi-selection, CSS zoom counter-scale (layout-phase, no jitter) */}
      {unionRect && selectedIds.length > 1 && (
        <div
          style={{
            position: "absolute",
            left: unionRect.x + unionRect.width / 2,
            top: unionRect.y + unionRect.height,
            width: 0,
            height: 0,
            overflow: "visible",
            pointerEvents: "none",
            zIndex: 3,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              zoom: "var(--inv-zoom, 1)",
              transform: "translateX(-50%)",
            } as React.CSSProperties}
          >
            {(() => {
              const hasProtected = !isAdmin && selectedIds.some(id => elements[id]?.isCore || elements[id]?.textLocked);
              const pxW = Math.round(unionRect.width);
              const pxH = Math.round(unionRect.height);
              const dimText = `${pxW} \u00D7 ${pxH}`;
              return (
                <div
                  style={{
                    marginTop: 8,
                    backgroundColor: "#3b82f6",
                    color: "white",
                    fontSize: 11,
                    lineHeight: "16px",
                    fontWeight: 450,
                    letterSpacing: 0.045,
                    paddingLeft: hasProtected ? 1 : 4,
                    paddingRight: hasProtected ? 4 : 4,
                    paddingTop: 2,
                    paddingBottom: 2,
                    borderRadius: 4,
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center",
                    width: "fit-content",
                    gap: 0,
                  }}
                >
                  {hasProtected && (
                    <>
                      <LockSmall style={{ width: 24, height: 24, flexShrink: 0 }} />
                      {"Protected \u00B7 "}
                    </>
                  )}
                  {dimText}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* AI Animation/Effect Popover */}
      {animationPopover && (() => {
        const el = elements[animationPopover.elementId];
        if (!el) return null;
        const r = bounds.get(animationPopover.elementId);
        if (!r) return null;
        const cssAnims = parseCSSAnimations(el);
        const existingEffect = parseReactEffect(el.reactEffect);

        // Compute popover position dynamically from current bounds (world→screen)
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        const cam = cameraRef.current;
        const sparkleX = (canvasRect?.left ?? 0) + cam.x + (r.x + r.width) * cam.zoom + 8;
        const sparkleY = (canvasRect?.top ?? 0) + cam.y + r.y * cam.zoom;
        const sparkleSize = 16;
        const GAP = 4;
        const PW = 296;
        const PH = 100;
        const M = 8;
        const leftBound = (canvasRect?.left ?? 0) + M;
        const rightBound = (canvasRect?.right ?? window.innerWidth) - M;
        let popX = sparkleX;
        let popY = sparkleY + sparkleSize + GAP;
        if (popX + PW > rightBound) {
          popX = sparkleX + sparkleSize - PW;
        }
        popX = Math.max(leftBound, Math.min(popX, rightBound - PW));
        if (popY + PH > window.innerHeight - M) {
          popY = sparkleY - GAP - PH;
        }

        const effectStyles = el.tailwindStyles
          ? getStyles(el) as unknown as Record<string, string | undefined>
          : {};

        return (
          <AIPromptPopover
            elementId={animationPopover.elementId}
            elementType={el.type}
            position={{ x: popX, y: popY }}
            onClose={() => setAnimationPopover(null)}
            treeContext={aiTreeContext}
            onPhaseChange={(phase) => {
              if (phase === "review") {
                setAnimationPopover(null);
                showBell({
                  message: "Animation applied",
                  action: { label: "Preview", onClick: () => mutations.setViewMode("preview") },
                });
              } else if (phase === "error") {
                const eid = animationPopover?.elementId;
                setAnimationPopover(null);
                showBell({
                  message: "Something went wrong",
                  variant: "error",
                  action: {
                    label: "Retry",
                    onClick: () => {
                      if (eid) setAnimationPopover({ elementId: eid, phase: "prompt" });
                    },
                  },
                  duration: 0,
                });
              } else {
                setAnimationPopover((prev) => prev ? { ...prev, phase } : null);
              }
            }}
            onApplyAnimation={(anim: CSSAnimation) => {
              // Handle stagger for keyframe animations — apply to all descendants
              if (anim.kind === "keyframe" && (anim as any).stagger) {
                const descendants = collectAllDescendants(animationPopover.elementId, elements);
                if (descendants.length > 0) {
                  const stagger = (anim as any).stagger as { delay: number };
                  const effectiveDelay = stagger.delay * descendants.length > 2000
                    ? Math.floor(2000 / descendants.length)
                    : stagger.delay;
                  descendants.forEach((childId: string, index: number) => {
                    mutations.addCSSAnimation(childId, {
                      ...anim,
                      id: `${anim.id}-${index}`,
                      delay: (anim.delay ?? 0) + effectiveDelay * index,
                    } as CSSAnimation);
                  });
                  return;
                }
              }
              mutations.addCSSAnimation(animationPopover.elementId, anim);
            }}
            onApplyEffect={(effect: ReactEffectState) => {
              mutations.updateReactEffect(animationPopover.elementId, effect);
            }}
            onApplyEffectLayer={(layer) => {
              mutations.addEffectLayer(animationPopover.elementId, layer);
            }}
            onApplyShaderElement={(system, presetKey, config, name) => {
              const newId = mutations.addCanvasElement("shader", 50, 50);
              if (newId) {
                mutations.updateElement(newId, {
                  shaderSystem: system,
                  shaderConfig: JSON.stringify(config),
                  shaderPreset: presetKey,
                  name,
                });
              }
            }}
            existingAnimations={cssAnims}
            existingEffect={existingEffect}
            existingEffectLayers={el.effectLayers}
            elementContent={el.content ?? ""}
            elementDimensions={{ width: el.width ?? 0, height: el.height ?? 0 }}
            elementStyles={effectStyles}
          />
        );
      })()}

      {/* Drop highlight during reparent drag */}
      {dropHighlight && (
        <>
          {/* Container highlight (solid border + faint fill) */}
          {dropHighlight.containerRect && (
            <div
              style={{
                position: "absolute",
                left: dropHighlight.containerRect.x,
                top: dropHighlight.containerRect.y,
                width: dropHighlight.containerRect.width,
                height: dropHighlight.containerRect.height,
                border: `${2 * invZoom}px solid ${SELECTION_COLOR}`,
                backgroundColor: "rgba(59, 130, 246, 0.06)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          )}
          {/* Insertion line */}
          {dropHighlight.lineRect && (
            <div
              style={{
                position: "absolute",
                left: dropHighlight.lineRect.x,
                top: dropHighlight.lineRect.y,
                width: dropHighlight.lineRect.width,
                height: dropHighlight.lineRect.height,
                backgroundColor: SELECTION_COLOR,
                pointerEvents: "none",
                borderRadius: 1,
                zIndex: 2,
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
