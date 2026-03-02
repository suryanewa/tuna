"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronDown } from "@/components/icons/editor";
import { DropdownMenu } from "./dropdown-menu";
import { usePortalContainer } from "@/lib/portal-container";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  separatorBefore?: boolean;
  headingBefore?: string;
}

export interface DropdownProps {
  value?: string;
  onValueChange?: (value: string) => void;
  options: DropdownOption[];
  leadIcon?: React.ComponentType<{ className?: string }>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Menu width: "trigger" to match button, "auto" for content, or number for pixels */
  menuWidth?: "trigger" | "auto" | number;
}

// Layout constants matching DropdownMenu's CSS
const ITEM_HEIGHT = 24;
const MENU_PADDING_Y = 8;
const VIEWPORT_MARGIN = 8;
const MAX_MENU_HEIGHT = 400;
const OVERFLOW_INDICATOR_HEIGHT = 24;

interface MenuPosition {
  top: number;
  left: number;
  width: number | undefined;
  minWidth: number | undefined;
  scrollTop: number;
  transformOrigin: string;
}

function calcMenuPosition(
  triggerRect: DOMRect,
  selectedIndex: number,
  optionCount: number,
  menuWidthMode: "trigger" | "auto" | number
): MenuPosition {
  const selectedItemOffset = MENU_PADDING_Y + selectedIndex * ITEM_HEIGHT;
  const menuContentHeight = MENU_PADDING_Y * 2 + optionCount * ITEM_HEIGHT;
  const menuHeight = Math.min(menuContentHeight, MAX_MENU_HEIGHT);
  const vh = window.innerHeight;

  // Ideal: selected item center aligns with trigger center
  const triggerCenter = triggerRect.top + triggerRect.height / 2;
  const idealTop = triggerCenter - selectedItemOffset - ITEM_HEIGHT / 2;

  // Clamp to viewport
  const clampedTop = Math.max(
    VIEWPORT_MARGIN,
    Math.min(idealTop, vh - VIEWPORT_MARGIN - menuHeight)
  );

  // Unified scroll: where the item needs to appear in the visible menu
  const targetVisibleOffset = triggerCenter - clampedTop - ITEM_HEIGHT / 2;
  const maxScrollTop = Math.max(0, menuContentHeight - menuHeight);
  const scrollTop = Math.max(
    0,
    Math.min(selectedItemOffset - targetVisibleOffset, maxScrollTop)
  );

  // Width — always allow menu to grow wider than trigger to avoid clipping
  const width =
    menuWidthMode === "trigger"
      ? undefined
      : menuWidthMode === "auto"
        ? undefined
        : menuWidthMode;

  const minWidth =
    menuWidthMode === "trigger"
      ? triggerRect.width
      : menuWidthMode === "auto"
        ? 120
        : undefined;

  // Transform origin (scroll-adjusted for animation)
  const originY = selectedItemOffset + ITEM_HEIGHT / 2 - scrollTop;

  return {
    top: clampedTop,
    left: triggerRect.left,
    width,
    minWidth,
    scrollTop,
    transformOrigin: `center ${originY}px`,
  };
}

export const Dropdown = React.forwardRef<HTMLButtonElement, DropdownProps>(
  (
    {
      value,
      onValueChange,
      options,
      leadIcon: LeadIcon,
      placeholder = "Select...",
      disabled = false,
      className,
      menuWidth = "trigger",
    },
    ref
  ) => {
    const portalContainer = usePortalContainer();
    const [open, setOpen] = React.useState(false);
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
    const [isFocused, setIsFocused] = React.useState(false);
    const [position, setPosition] = React.useState<MenuPosition | null>(null);

    const triggerRef = React.useRef<HTMLButtonElement | null>(null);
    const menuRef = React.useRef<HTMLDivElement>(null);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    // Merge forwarded ref with internal ref
    const mergeRefs = React.useCallback(
      (node: HTMLButtonElement | null) => {
        triggerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref)
          (ref as React.MutableRefObject<HTMLButtonElement | null>).current =
            node;
      },
      [ref]
    );

    const selectedIndex = React.useMemo(
      () => Math.max(0, options.findIndex((opt) => opt.value === value)),
      [options, value]
    );

    // Get display label for current value
    const displayLabel = React.useMemo(() => {
      if (!value) return placeholder;
      const option = options.find((opt) => opt.value === value);
      return option?.label || value;
    }, [value, options, placeholder]);

    const handleOptionSelect = (option: DropdownOption) => {
      if (option.disabled) return;
      onValueChange?.(option.value);
      setOpen(false);
      setHighlightedIndex(-1);
    };

    // --- Positioning on open ---
    React.useLayoutEffect(() => {
      if (!open || !triggerRef.current) return;
      const pos = calcMenuPosition(
        triggerRef.current.getBoundingClientRect(),
        selectedIndex,
        options.length,
        menuWidth
      );
      setPosition(pos);

      requestAnimationFrame(() => {
        if (scrollRef.current && pos.scrollTop > 0) {
          scrollRef.current.scrollTop = pos.scrollTop;
        }
      });
    }, [open, selectedIndex, options.length, menuWidth]);

    // --- Dismiss: click-outside ---
    React.useEffect(() => {
      if (!open) return;
      const onMouseDown = (e: MouseEvent) => {
        if (e.clientX >= document.documentElement.clientWidth) return;
        if (e.clientY >= document.documentElement.clientHeight) return;
        if (menuRef.current?.contains(e.target as Node)) return;
        if (triggerRef.current?.contains(e.target as Node)) return;
        setOpen(false);
        setHighlightedIndex(-1);
      };
      document.addEventListener("mousedown", onMouseDown);
      return () => document.removeEventListener("mousedown", onMouseDown);
    }, [open]);

    // --- Dismiss: Escape (document-level) ---
    React.useEffect(() => {
      if (!open) return;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false);
          setHighlightedIndex(-1);
          triggerRef.current?.focus();
        }
      };
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }, [open]);

    // --- Scroll-to-highlighted on keyboard nav ---
    React.useEffect(() => {
      if (!open || highlightedIndex < 0 || !scrollRef.current) return;
      const container = scrollRef.current;
      const items = container.querySelectorAll('[role="option"]');
      const item = items[highlightedIndex] as HTMLElement | undefined;
      if (!item) return;

      const wrapper = item.parentElement as HTMLElement;
      const itemTop = wrapper.offsetTop;
      const itemBottom = itemTop + wrapper.offsetHeight;

      if (itemTop < container.scrollTop + OVERFLOW_INDICATOR_HEIGHT) {
        container.scrollTop = itemTop - OVERFLOW_INDICATOR_HEIGHT;
      } else if (itemBottom > container.scrollTop + container.clientHeight - OVERFLOW_INDICATOR_HEIGHT) {
        container.scrollTop = itemBottom - container.clientHeight + OVERFLOW_INDICATOR_HEIGHT;
      }
    }, [highlightedIndex, open]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setHighlightedIndex(selectedIndex);
        } else {
          setHighlightedIndex((prev) =>
            prev < options.length - 1 ? prev + 1 : prev
          );
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (open) {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        }
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (open && highlightedIndex >= 0) {
          handleOptionSelect(options[highlightedIndex]);
        } else if (!open) {
          setOpen(true);
          setHighlightedIndex(selectedIndex);
        }
      }
    };

    const handleTriggerClick = () => {
      if (disabled) return;
      if (open) {
        setOpen(false);
        setHighlightedIndex(-1);
      } else {
        setOpen(true);
        setHighlightedIndex(selectedIndex);
      }
    };

    return (
      <>
        <button
          ref={mergeRefs}
          type="button"
          onClick={handleTriggerClick}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={(e) => {
            if (
              open &&
              !menuRef.current?.contains(e.relatedTarget as Node) &&
              !triggerRef.current?.contains(e.relatedTarget as Node)
            ) {
              setOpen(false);
              setHighlightedIndex(-1);
            }
            setIsFocused(false);
          }}
          disabled={disabled}
          className={cn(
            "relative flex items-center w-full h-6 rounded-input",
            "bg-stone-100 text-stone-900",
            "text-[11px] font-[450] tracking-[0.055px]",
            "hover:bg-stone-200 transition-colors duration-150",
            "focus-visible:outline-none",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className
          )}
          style={
            isFocused
              ? { outline: "1px solid black", outlineOffset: "-1px" }
              : undefined
          }
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          {LeadIcon && (
            <LeadIcon className="absolute left-0 w-6 h-6 text-stone-900 pointer-events-none" />
          )}
          <span
            className={cn(
              "flex-1 text-left truncate pr-6",
              LeadIcon ? "pl-6" : "pl-1.5",
              !value && "text-stone-500"
            )}
          >
            {displayLabel}
          </span>
          <ChevronDown
            className={cn(
              "absolute right-0 w-6 h-6 text-stone-900 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
        {open &&
          position &&
          createPortal(
            <div
              ref={menuRef}
              className="fixed [&_*]:[font-family:inherit]"
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
                minWidth: position.minWidth,
                transformOrigin: position.transformOrigin,
                zIndex: 60,
              }}
            >
              <DropdownMenu
                ref={scrollRef}
                options={options}
                value={value}
                highlightedIndex={highlightedIndex}
                onSelect={handleOptionSelect}
                onHighlight={setHighlightedIndex}
                showCheckmark
              />
            </div>,
            portalContainer || document.body
          )}
      </>
    );
  }
);

Dropdown.displayName = "Dropdown";
