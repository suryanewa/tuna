"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronUp, ChevronDown } from "@/components/icons/editor";

export interface DropdownMenuOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  /** When true, renders a separator line above this item */
  separatorBefore?: boolean;
  /** When set, renders a heading label above this item */
  headingBefore?: string;
}

export interface DropdownMenuProps {
  options: DropdownMenuOption[];
  value?: string;
  highlightedIndex?: number;
  onSelect: (option: DropdownMenuOption) => void;
  onHighlight?: (index: number) => void;
  showCheckmark?: boolean;
  iconClassName?: string;
  className?: string;
  style?: React.CSSProperties;
  minWidth?: number;
}

const SCROLL_SPEED = 150; // px/sec

// Inject webkit scrollbar hide rule once (can't be done inline)
if (typeof document !== "undefined") {
  const id = "hide-scrollbar-style";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = ".hide-scrollbar::-webkit-scrollbar{display:none}";
    document.head.appendChild(style);
  }
}

/**
 * Reusable dropdown menu component with Figma-style dark theme.
 * Can be used for dropdowns, combo inputs, context menus, etc.
 */
export const DropdownMenu = React.forwardRef<HTMLDivElement, DropdownMenuProps>(
  (
    {
      options,
      value,
      highlightedIndex = -1,
      onSelect,
      onHighlight,
      showCheckmark = true,
      iconClassName = "w-4 h-4",
      className,
      style,
      minWidth,
    },
    ref
  ) => {
    const internalRef = React.useRef<HTMLDivElement | null>(null);
    const rafRef = React.useRef<number>(0);
    const directionRef = React.useRef<"up" | "down" | null>(null);

    const [showTop, setShowTop] = React.useState(false);
    const [showBottom, setShowBottom] = React.useState(false);
    const [internalHighlight, setInternalHighlight] = React.useState(-1);

    // Use internal highlight state when no external onHighlight is provided
    const activeHighlight = onHighlight ? highlightedIndex : internalHighlight;
    const handleHighlight = onHighlight ?? setInternalHighlight;

    // Merge forwarded ref + internal ref
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        internalRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref)
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref]
    );

    const stopScrolling = React.useCallback(() => {
      directionRef.current = null;
      cancelAnimationFrame(rafRef.current);
    }, []);

    const updateOverflow = React.useCallback(() => {
      const el = internalRef.current;
      if (!el) return;
      const newShowTop = el.scrollTop > 1;
      const newShowBottom =
        el.scrollTop + el.clientHeight < el.scrollHeight - 1;

      // Stop rAF if the indicator being scrolled toward is disappearing
      if (!newShowTop && directionRef.current === "up") stopScrolling();
      if (!newShowBottom && directionRef.current === "down") stopScrolling();

      setShowTop(newShowTop);
      setShowBottom(newShowBottom);
    }, [stopScrolling]);

    const startScrolling = React.useCallback((direction: "up" | "down") => {
      directionRef.current = direction;
      let lastTime = performance.now();
      const tick = (now: number) => {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        const el = internalRef.current;
        if (!el || !directionRef.current) return;
        el.scrollTop +=
          (directionRef.current === "down" ? 1 : -1) * SCROLL_SPEED * dt;
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, []);

    // Detect overflow on mount and when options change
    React.useLayoutEffect(() => {
      updateOverflow();
    }, [options.length, updateOverflow]);

    // Cleanup rAF on unmount
    React.useEffect(() => {
      return () => cancelAnimationFrame(rafRef.current);
    }, []);

    return (
      <div
        className={cn(
          "relative rounded-[12px] overflow-hidden select-none",
          className
        )}
        style={{
          boxShadow:
            "0px 0px 0.5px 0px rgba(0,0,0,0.12), 0px 10px 16px 0px rgba(0,0,0,0.12), 0px 2px 5px 0px rgba(0,0,0,0.15)",
          minWidth,
          ...style,
        }}
      >
        <div
          ref={setRefs}
          className="max-h-[400px] overflow-y-auto overflow-x-hidden hide-scrollbar py-2 bg-stone-900"
          role="listbox"
          aria-label="Options"
          onScroll={updateOverflow}
          style={{ scrollbarWidth: "none", overscrollBehavior: "none" }}
        >
          {options.map((option, index) => {
            const isSelected = value === option.value;
            const isHighlighted = activeHighlight === index;

            return (
              <React.Fragment key={`${index}-${option.value}`}>
                {option.separatorBefore && (
                  <div className="h-4 flex items-center">
                    <div className="w-full h-px bg-stone-800" />
                  </div>
                )}
                {option.headingBefore && (
                  <div className="px-4 py-1 text-[11px] font-[450] tracking-[0.055px] leading-[16px] text-white/40">
                    {option.headingBefore}
                  </div>
                )}
                <div className="px-2">
                  <button
                    type="button"
                    onClick={() => onSelect(option)}
                    onMouseEnter={() => handleHighlight(index)}
                    onMouseLeave={() => handleHighlight(-1)}
                    disabled={option.disabled}
                    className={cn(
                      "relative w-full flex items-center min-h-[24px] pr-2 text-[11px] font-[450] tracking-[0.055px] text-left transition-colors",
                      "text-white rounded-[5px]",
                      showCheckmark ? "pl-6" : "pl-2",
                      isHighlighted && "bg-white/10",
                      option.disabled && "opacity-50 cursor-not-allowed"
                    )}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {showCheckmark && isSelected && (
                      <Check
                        size={24}
                        className="absolute left-0 top-1/2 -translate-y-1/2 text-white"
                      />
                    )}
                    {option.icon && (
                      <option.icon className={cn(iconClassName, "mr-2 text-white")} />
                    )}
                    <span className="leading-[16px] whitespace-nowrap">
                      {option.label}
                    </span>
                    {option.shortcut && (
                      <span className="ml-auto pl-4 text-white/70 whitespace-nowrap">
                        {option.shortcut}
                      </span>
                    )}
                  </button>
                </div>
              </React.Fragment>
            );
          })}
          {options.length === 0 && (
            <div className="px-4 py-1 text-[11px] text-white/40">
              No options available
            </div>
          )}
        </div>
        {showTop && (
          <div
            className="absolute left-0 right-0 top-0 z-10 flex items-center justify-center h-6 bg-stone-900 rounded-t-[12px] cursor-default"
            onMouseEnter={() => startScrolling("up")}
            onMouseLeave={stopScrolling}
            aria-hidden="true"
            tabIndex={-1}
          >
            <ChevronUp className="w-6 h-6 text-white" />
          </div>
        )}
        {showBottom && (
          <div
            className="absolute left-0 right-0 bottom-0 z-10 flex items-center justify-center h-6 bg-stone-900 rounded-b-[12px] cursor-default"
            onMouseEnter={() => startScrolling("down")}
            onMouseLeave={stopScrolling}
            aria-hidden="true"
            tabIndex={-1}
          >
            <ChevronDown className="w-6 h-6 text-white" />
          </div>
        )}
      </div>
    );
  }
);

DropdownMenu.displayName = "DropdownMenu";
