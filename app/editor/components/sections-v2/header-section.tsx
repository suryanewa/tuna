"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, type DropdownMenuOption } from "../ui/dropdown-menu";
import { ChevronDown16 } from "@/components/icons/editor-16";
import { YELLOW_COLOR } from "@/lib/playground/constants";

// ============================================================================
// Types
// ============================================================================

export interface AvatarUser {
  id: string;
  color: string;
  name?: string;
  avatar?: string;
}

export type PanelTab = "design" | "animate";

export interface HeaderSectionProps {
  localUser: AvatarUser;
  others?: AvatarUser[];
  zoom: number;
  onZoomChange: (zoom: number) => void;
  viewMode?: "edit" | "preview";
  onViewModeChange?: (mode: "edit" | "preview") => void;
  panelTab?: PanelTab;
  onPanelTabChange?: (tab: PanelTab) => void;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

const getAvatarInitial = (name?: string, id?: string): string => {
  if (name) return name.charAt(0).toUpperCase();
  if (id) return id.charAt(0).toUpperCase();
  return "?";
};

const getTextColor = (bgColor: string): string =>
  bgColor === YELLOW_COLOR ? "#000000" : "#FFFFFF";

const getOverflowWidth = (count: number): number =>
  count >= 10 ? 32 : 24;

const getOverflowLabel = (count: number): string =>
  `+${count}`;

// ============================================================================
// Constants
// ============================================================================

const ZOOM_MENU_OPTIONS: DropdownMenuOption[] = [
  { value: "zoom-in", label: "Zoom in", shortcut: "⌘+" },
  { value: "zoom-out", label: "Zoom out", shortcut: "⌘−" },
  { value: "zoom-100", label: "Zoom to 100%", shortcut: "⌘0", separatorBefore: true },
  { value: "zoom-25", label: "25%", separatorBefore: true },
  { value: "zoom-50", label: "50%" },
  { value: "zoom-75", label: "75%" },
  { value: "zoom-150", label: "150%" },
  { value: "zoom-200", label: "200%" },
  { value: "zoom-400", label: "400%" },
  { value: "zoom-800", label: "800%" },
];

const PANEL_TABS: { value: PanelTab; label: string }[] = [
  { value: "design", label: "Design" },
  { value: "animate", label: "Animate" },
];

const avatarClassName =
  "w-6 h-6 rounded-full overflow-hidden border-2 border-white dark:border-stone-900 flex items-center justify-center text-[11px] leading-4 tracking-[0.055px]";

// ============================================================================
// Component
// ============================================================================

export function HeaderSection({
  localUser,
  others = [],
  zoom,
  onZoomChange,
  viewMode = "edit",
  onViewModeChange,
  panelTab = "design",
  onPanelTabChange,
  className,
}: HeaderSectionProps) {
  const [zoomMenuOpen, setZoomMenuOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);

  const remainingCount = Math.max(0, others.length - 3);

  const handleZoomMenuSelect = (option: DropdownMenuOption) => {
    switch (option.value) {
      case "zoom-in":
        onZoomChange(Math.min(1600, zoom + 10));
        break;
      case "zoom-out":
        onZoomChange(Math.max(5, zoom - 10));
        break;
      case "zoom-100":
        onZoomChange(100);
        break;
      case "zoom-25":
        onZoomChange(25);
        break;
      case "zoom-50":
        onZoomChange(50);
        break;
      case "zoom-75":
        onZoomChange(75);
        break;
      case "zoom-150":
        onZoomChange(150);
        break;
      case "zoom-200":
        onZoomChange(200);
        break;
      case "zoom-400":
        onZoomChange(400);
        break;
      case "zoom-800":
        onZoomChange(800);
        break;
    }
    setZoomMenuOpen(false);
    setHighlightedIndex(-1);
  };

  const handleZoomKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!zoomMenuOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setZoomMenuOpen(false);
      setHighlightedIndex(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < ZOOM_MENU_OPTIONS.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      handleZoomMenuSelect(ZOOM_MENU_OPTIONS[highlightedIndex]);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        "pt-2 px-2 pb-3",
        "bg-white dark:bg-stone-950",
        "border-b border-stone-200 dark:border-stone-800",
        className
      )}
    >
      {/* Row 1: Avatars + Preview */}
      <div className="flex items-center justify-between pl-1">
        {/* Avatar Stack */}
        <div className="flex items-center" style={{ isolation: "isolate" }}>
          {/* Local user */}
          <div
            className={avatarClassName}
            style={{
              backgroundColor: localUser.color,
              color: getTextColor(localUser.color),
              fontWeight: 600,
              marginRight: -6,
              zIndex: 6,
              flexShrink: 0,
            }}
            title="You"
          >
            {localUser.avatar ? (
              <img src={localUser.avatar} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              getAvatarInitial(localUser.name, localUser.id)
            )}
          </div>
          {/* Other users (max 3) */}
          {others.slice(0, 3).map((user, index) => (
            <div
              key={`${user.id}-${index}`}
              className={avatarClassName}
              style={{
                backgroundColor: user.color,
                color: getTextColor(user.color),
                fontWeight: 600,
                marginRight: -6,
                zIndex: 5 - index,
                flexShrink: 0,
              }}
              title={user.name || user.id}
            >
              {user.avatar ? (
                <img src={user.avatar} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                getAvatarInitial(user.name, user.id)
              )}
            </div>
          ))}
          {/* Overflow */}
          {remainingCount > 0 && (
            <div
              className="h-6 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden border-2 border-white dark:border-stone-900 flex items-center justify-center text-[11px] leading-4 tracking-[0.055px] text-black dark:text-foreground"
              style={{
                width: getOverflowWidth(remainingCount),
                fontWeight: 600,
                zIndex: 1,
                flexShrink: 0,
              }}
            >
              {getOverflowLabel(remainingCount)}
            </div>
          )}
        </div>

        {/* Preview button — matches Exit Preview button in EditorCanvas */}
        <button
          type="button"
          onClick={() => onViewModeChange?.(viewMode === "preview" ? "edit" : "preview")}
          className="h-8 rounded-[5px] px-3 py-1 text-[11px] font-[450] leading-4 tracking-[0.055px] text-white transition-colors focus:outline-none"
          style={{ backgroundColor: "rgb(12, 10, 9)" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgb(41, 37, 36)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgb(12, 10, 9)"; }}
        >
          Preview
        </button>
      </div>

      {/* Row 2: Tabs + Zoom */}
      <div className="flex items-center justify-between">
        {/* Design / Interactions tabs */}
        <div className="flex items-center gap-1">
          {PANEL_TABS.map((tab) => {
            const isActive = tab.value === panelTab;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => onPanelTabChange?.(tab.value)}
                className={cn(
                  "h-6 px-2 rounded-[5px] text-[11px] leading-4 tracking-[0.055px]",
                  "whitespace-nowrap overflow-hidden text-ellipsis",
                  "transition-colors duration-150 focus:outline-none",
                  isActive
                    ? "bg-stone-100 dark:bg-stone-800 font-[550] text-stone-900 dark:text-stone-100"
                    : "font-[450] text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Zoom button with dropdown */}
        <Popover open={zoomMenuOpen} onOpenChange={(open) => { setZoomMenuOpen(open); setHighlightedIndex(-1); }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onKeyDown={handleZoomKeyDown}
              className={cn(
                "relative w-[60px] h-6 rounded-[5px] overflow-hidden",
                "transition-colors duration-150 focus:outline-none",
                zoomMenuOpen
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "text-stone-900 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800"
              )}
              aria-haspopup="listbox"
              aria-expanded={zoomMenuOpen}
            >
              <span className="absolute inset-y-0 left-1 right-3 flex items-center justify-center text-[11px] font-[450] leading-4 tracking-[0.055px] overflow-hidden text-ellipsis whitespace-nowrap">
                {Math.round(zoom)}%
              </span>
              <ChevronDown16 className="absolute right-0 top-1 w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="p-0 border-0 bg-transparent shadow-none"
            align="end"
            sideOffset={4}
            onOpenAutoFocus={(e) => e.preventDefault()}
            style={{
              width: "auto",
              minWidth: 150,
            }}
          >
            <DropdownMenu
              options={ZOOM_MENU_OPTIONS}
              highlightedIndex={highlightedIndex}
              onSelect={handleZoomMenuSelect}
              onHighlight={setHighlightedIndex}
              showCheckmark={false}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

HeaderSection.displayName = "HeaderSection";
