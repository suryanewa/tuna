"use client";

import * as React from "react";
import { useYjsEditor } from "./YjsEditorContext";
import {
  useEditorMutations,
  useSelectedIds,
  useCreationTool,
  useDevice,
  useIsAdmin,
  editorStateStore,
} from "./context";
import { cn } from "@/lib/utils";
import {
  DesktopSmall,
  TabletSmall,
  MobileSmall,
  Move,
  FlexFrame,
  Rectangle,
  Ellipse,
  Star,
  Text,
  Comment,
  Image,
  Video,
  Gif,
  RectangleSmall,
  EllipseSmall,
  StarSmall,
  ImageSmall,
  VideoSmall,
  GifSmall,
} from "@/components/icons/editor";
import {
  ChevronDown16,
} from "@/components/icons/editor-16";
import { DropdownMenu, type DropdownMenuOption } from "./ui/dropdown-menu";
import { GifSearchPopover } from "./gif-search-popover";
import type { CreationTool } from "@/lib/playground/editor-types";
import { ARTBOARD_LAYER_ID } from "@/lib/playground/store";

// ─── Shape tools (grouped behind one button with dropdown) ─────────────

type ShapeTool = "rectangle" | "circle" | "star" | "image" | "video" | "gif";

const SHAPE_TOOLS: { tool: ShapeTool; label: string; shortcut?: string; icon: React.ComponentType<{ className?: string }>; menuIcon: React.ComponentType<{ className?: string }>; adminOnly?: boolean }[] = [
  { tool: "rectangle", label: "Rectangle", shortcut: "R", icon: Rectangle, menuIcon: RectangleSmall },
  { tool: "circle", label: "Circle", shortcut: "O", icon: Ellipse, menuIcon: EllipseSmall },
  { tool: "star", label: "Star", icon: Star, menuIcon: StarSmall },
  { tool: "image", label: "Image", icon: Image, menuIcon: ImageSmall, adminOnly: true },
  { tool: "video", label: "Video", icon: Video, menuIcon: VideoSmall, adminOnly: true },
  { tool: "gif", label: "GIF", icon: Gif, menuIcon: GifSmall },
];

// ─── Device options ────────────────────────────────────────────────────

const DEVICE_OPTIONS = [
  { value: "desktop" as const, icon: DesktopSmall },
  { value: "tablet" as const, icon: TabletSmall },
  { value: "mobile" as const, icon: MobileSmall },
];

// ─── Helpers ───────────────────────────────────────────────────────────

function isDrawableShapeTool(tool: CreationTool): boolean {
  return tool === "rectangle" || tool === "circle" || tool === "star" || tool === "image" || tool === "video";
}

const btnClass = (active: boolean) =>
  cn(
    "h-8 w-8 flex items-center justify-center",
    active
      ? "bg-blue-500 text-white"
      : "hover:bg-stone-100 text-stone-600 dark:text-stone-400 dark:hover:bg-stone-800"
  );

// ─── Component ─────────────────────────────────────────────────────────

export function BottomToolbar() {
  const { elements } = useYjsEditor();
  const { setDevice, setCreationTool, addElement, addCanvasElement, updateElement } = useEditorMutations();
  const creationTool = useCreationTool();
  const selectedIds = useSelectedIds();
  const device = useDevice();
  const isAdmin = useIsAdmin();

  // Track which shape was last selected so it persists in the toolbar
  const [activeShape, setActiveShape] = React.useState<ShapeTool>("rectangle");
  const [shapeMenuOpen, setShapeMenuOpen] = React.useState(false);
  const [gifPopoverOpen, setGifPopoverOpen] = React.useState(false);
  const replaceTargetRef = React.useRef<string | null>(null);
  const selectionSnapshotRef = React.useRef<string[]>([]);
  const shapeMenuRef = React.useRef<HTMLDivElement>(null);
  const shapeBtnRef = React.useRef<HTMLDivElement>(null);

  // Keep activeShape in sync when user switches tool via keyboard shortcut
  React.useEffect(() => {
    if (isDrawableShapeTool(creationTool)) {
      setActiveShape(creationTool as ShapeTool);
    }
  }, [creationTool]);

  // Listen for "open-gif-search" from PropertyPanel's Replace GIF button
  React.useEffect(() => {
    const handler = (e: Event) => {
      replaceTargetRef.current = (e as CustomEvent).detail?.elementId ?? null;
      selectionSnapshotRef.current = editorStateStore.getSnapshot().selectedIds ?? [];
      setGifPopoverOpen(true);
    };
    window.addEventListener("open-gif-search", handler);
    return () => window.removeEventListener("open-gif-search", handler);
  }, []);

  // Close shape menu on click outside
  React.useEffect(() => {
    if (!shapeMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        shapeMenuRef.current && !shapeMenuRef.current.contains(target) &&
        shapeBtnRef.current && !shapeBtnRef.current.contains(target)
      ) {
        setShapeMenuOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDown);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [shapeMenuOpen]);

  const visibleShapeTools = SHAPE_TOOLS.filter(s => !s.adminOnly || isAdmin);
  const shapeMenuOptions: DropdownMenuOption[] = visibleShapeTools.map(s => ({
    value: s.tool, label: s.label, icon: s.menuIcon, shortcut: s.shortcut,
  }));
  const ActiveShapeIcon = visibleShapeTools.find(s => s.tool === activeShape)?.icon ?? Rectangle;
  const shapeActive = isDrawableShapeTool(creationTool);

  const handleShapeSelect = (option: DropdownMenuOption) => {
    const tool = option.value as ShapeTool;
    setActiveShape(tool);
    setShapeMenuOpen(false);
    if (tool === "gif") {
      // GIF uses pick-and-insert flow instead of creation tool
      selectionSnapshotRef.current = selectedIds ?? [];
      setGifPopoverOpen(true);
      return;
    }
    setCreationTool(tool);
  };

  const handleGifSelect = React.useCallback((gifUrl: string, width: number, height: number) => {
    // Scale to reasonable size (cap at 400px wide)
    const maxW = 400;
    const scale = width > maxW ? maxW / width : 1;
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const replaceId = replaceTargetRef.current;
    replaceTargetRef.current = null;

    if (replaceId && elements[replaceId]) {
      // Replace mode: just swap content, keep everything else
      updateElement(replaceId, { content: gifUrl, alt: "GIF" });
    } else {
      // Use snapshotted selection from when the popover opened
      const selectedId = selectionSnapshotRef.current[0];
      const selectedEl = selectedId ? elements[selectedId] : null;

      const gifStyles = { width: `w-[${w}px]` as any, height: `h-[${h}px]` as any };

      if (selectedId === ARTBOARD_LAYER_ID || selectedEl?.type === "container") {
        // Artboard or frame selected → insert as child (null parent = artboard root)
        const parentId = selectedId === ARTBOARD_LAYER_ID ? null : selectedId;
        const newId = addElement("gif", parentId, { styles: gifStyles });
        if (newId) updateElement(newId, { content: gifUrl, alt: "GIF" });
      } else if (selectedEl?.parentId && elements[selectedEl.parentId]) {
        // Selected has a parent → insert as sibling after it
        const parent = elements[selectedEl.parentId];
        const siblingIndex = parent.children?.indexOf(selectedId!) ?? -1;
        const newId = addElement("gif", selectedEl.parentId, {
          insertIndex: siblingIndex >= 0 ? siblingIndex + 1 : undefined,
          styles: gifStyles,
        });
        if (newId) updateElement(newId, { content: gifUrl, alt: "GIF" });
      } else {
        // No selection or root-level → place on canvas
        const newId = addCanvasElement("gif", 50, 50, { width: w, height: h });
        if (newId) updateElement(newId, { content: gifUrl, alt: "GIF" });
      }
    }
    setGifPopoverOpen(false);
  }, [elements, addElement, addCanvasElement, updateElement]);

  return (
    <div data-editor-panel className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div
        className="flex items-center bg-white/95 backdrop-blur-sm dark:bg-stone-900/95"
        style={{
          borderRadius: 14,
          boxShadow: "0px 0px 0.5px rgba(0,0,0,0.3), 0px 1px 3px rgba(0,0,0,0.15)",
        }}
      >
        {/* Tool Selection Buttons */}
        <div className="flex items-center gap-2 p-2">
          {/* Select */}
          <button
            type="button"
            title="Select (V)"
            onClick={(e) => { setCreationTool("select"); (e.currentTarget as HTMLElement).blur(); }}
            className={btnClass(creationTool === "select")}
            style={{ borderRadius: 6 }}
          >
            <Move className="w-6 h-6" />
          </button>

          {/* Frame */}
          <button
            type="button"
            title="Frame (F)"
            onClick={(e) => { setCreationTool("frame"); (e.currentTarget as HTMLElement).blur(); }}
            className={btnClass(creationTool === "frame")}
            style={{ borderRadius: 6 }}
          >
            <FlexFrame className="w-6 h-6" />
          </button>

          {/* Shape (grouped with dropdown) */}
          <div ref={shapeBtnRef} className="relative flex items-center gap-px">
            <button
              type="button"
              title={SHAPE_TOOLS.find(s => s.tool === activeShape)?.label}
              onClick={(e) => {
                if (activeShape === "gif") { selectionSnapshotRef.current = selectedIds ?? []; setGifPopoverOpen(true); }
                else { setCreationTool(activeShape); }
                (e.currentTarget as HTMLElement).blur();
              }}
              style={{ borderRadius: 6 }}
              className={cn(
                "h-8 w-8 flex items-center justify-center",
                shapeActive
                  ? "bg-blue-500 text-white"
                  : "hover:bg-stone-100 text-stone-600 dark:text-stone-400 dark:hover:bg-stone-800"
              )}
            >
              <ActiveShapeIcon className="w-6 h-6" />
            </button>
            <button
              type="button"
              title="More shapes"
              onClick={() => setShapeMenuOpen(!shapeMenuOpen)}
              style={{ borderRadius: 6 }}
              className="h-8 w-4 flex items-center justify-center hover:bg-stone-100 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"
            >
              <ChevronDown16 className="w-4 h-4" />
            </button>

            {/* Shape dropdown */}
            {shapeMenuOpen && (
              <div
                ref={shapeMenuRef}
                className="absolute bottom-full left-0 mb-2"
                style={{ zIndex: 60 }}
              >
                <DropdownMenu
                  options={shapeMenuOptions}
                  value={activeShape}
                  onSelect={handleShapeSelect}
                  showCheckmark
                  iconClassName="w-6 h-6"
                  minWidth={200}
                />
              </div>
            )}

            {/* GIF search popover — positioned relative to shape group */}
            <GifSearchPopover
              open={gifPopoverOpen}
              onOpenChange={(open) => { setGifPopoverOpen(open); if (!open) replaceTargetRef.current = null; }}
              onSelectGif={handleGifSelect}
            />
          </div>

          {/* Text */}
          {isAdmin && (
            <button
              type="button"
              title="Text (T)"
              onClick={(e) => { setCreationTool("text"); (e.currentTarget as HTMLElement).blur(); }}
              className={btnClass(creationTool === "text")}
              style={{ borderRadius: 6 }}
            >
              <Text className="w-6 h-6" />
            </button>
          )}

          {/* Comment */}
          {isAdmin && (
            <button
              type="button"
              title="Comment (C)"
              onClick={(e) => { setCreationTool("comment"); (e.currentTarget as HTMLElement).blur(); }}
              className={btnClass(creationTool === "comment")}
              style={{ borderRadius: 6 }}
            >
              <Comment className="w-6 h-6" />
            </button>
          )}

        </div>

        {/* Mode Toggle */}
        <div className="flex items-center p-2 border-l border-stone-200 dark:border-stone-700">
          <div
            className="inline-flex items-center bg-stone-100 dark:bg-stone-800"
            style={{ borderRadius: 6, padding: 2, gap: 2 }}
          >
            {DEVICE_OPTIONS.map((opt) => {
              const isActive = device === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  title={opt.value}
                  onClick={(e) => { setDevice(opt.value); (e.currentTarget as HTMLElement).blur(); }}
                  className={cn(
                    "flex items-center justify-center",
                    isActive
                      ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100"
                      : "text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
                  )}
                  style={{ width: 28, height: 28, borderRadius: 4 }}
                >
                  <Icon className="w-6 h-6" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
