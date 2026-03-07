/**
 * DropdownMenu — Figma-style dark dropdown menu.
 * Adapted from the portfolio editor's DropdownMenu for Shadow DOM.
 *
 * Features:
 * - Dark theme (stone-900 background)
 * - Checkmark for selected item
 * - Keyboard highlight navigation
 * - Scroll overflow indicators with smooth rAF scrolling
 * - Separator and heading support
 * - Item hover preview callback
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  forwardRef,
  type ReactNode,
  type CSSProperties,
  Fragment,
} from "react";
import { Check, ChevronUp, ChevronDown } from "./icons";

export interface DropdownMenuOption {
  value: string;
  label: string;
  disabled?: boolean;
  shortcut?: string;
  /** Renders a separator line above this item */
  separatorBefore?: boolean;
  /** Renders a heading label above this item */
  headingBefore?: string;
}

export interface DropdownMenuProps {
  options: DropdownMenuOption[];
  value?: string;
  highlightedIndex?: number;
  onSelect: (option: DropdownMenuOption) => void;
  onHighlight?: (index: number) => void;
  /** Fires on mouseEnter with option, null on mouseLeave — for live preview */
  onItemHover?: (option: DropdownMenuOption | null) => void;
  showCheckmark?: boolean;
  style?: CSSProperties;
  minWidth?: number;
  /** Initial scroll position (for macOS-style selected-item alignment) */
  initialScrollTop?: number;
  /** Custom label renderer for items */
  renderLabel?: (option: DropdownMenuOption) => ReactNode;
}

const SCROLL_SPEED = 150; // px/sec

const CheckIcon = () => <Check size={16} />;

const ChevronUpIcon = () => <ChevronUp size={20} />;
const ChevronDownIcon = () => <ChevronDown size={20} />;

export const DropdownMenu = forwardRef<HTMLDivElement, DropdownMenuProps>(
  (
    {
      options,
      value,
      highlightedIndex = -1,
      onSelect,
      onHighlight,
      onItemHover,
      showCheckmark = true,
      style,
      minWidth,
      initialScrollTop,
      renderLabel,
    },
    ref
  ) => {
    const internalRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number>(0);
    const directionRef = useRef<"up" | "down" | null>(null);

    const [showTop, setShowTop] = useState(false);
    const [showBottom, setShowBottom] = useState(false);
    const [internalHighlight, setInternalHighlight] = useState(-1);

    const activeHighlight = onHighlight ? highlightedIndex : internalHighlight;
    const handleHighlight = onHighlight ?? setInternalHighlight;

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        internalRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref)
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref]
    );

    const stopScrolling = useCallback(() => {
      directionRef.current = null;
      cancelAnimationFrame(rafRef.current);
    }, []);

    const updateOverflow = useCallback(() => {
      const el = internalRef.current;
      if (!el) return;
      const newShowTop = el.scrollTop > 1;
      const newShowBottom =
        el.scrollTop + el.clientHeight < el.scrollHeight - 1;

      if (!newShowTop && directionRef.current === "up") stopScrolling();
      if (!newShowBottom && directionRef.current === "down") stopScrolling();

      setShowTop(newShowTop);
      setShowBottom(newShowBottom);
    }, [stopScrolling]);

    const startScrolling = useCallback((direction: "up" | "down") => {
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

    useLayoutEffect(() => {
      if (initialScrollTop != null && initialScrollTop > 0 && internalRef.current) {
        internalRef.current.scrollTop = initialScrollTop;
      }
      updateOverflow();
    }, [options.length, updateOverflow, initialScrollTop]);

    useEffect(() => {
      return () => cancelAnimationFrame(rafRef.current);
    }, []);

    return (
      <div
        className="composer-menu-wrapper"
        style={{ minWidth, ...style }}
      >
        <div
          ref={setRefs}
          className="composer-menu-scroll"
          role="listbox"
          aria-label="Options"
          onScroll={updateOverflow}
        >
          {options.map((option, index) => {
            const isSelected = value === option.value;
            const isHighlighted = activeHighlight === index;

            return (
              <Fragment key={`${index}-${option.value}`}>
                {option.separatorBefore && (
                  <div className="composer-menu-separator">
                    <div className="composer-menu-separator-line" />
                  </div>
                )}
                {option.headingBefore && (
                  <div className="composer-menu-heading">
                    {option.headingBefore}
                  </div>
                )}
                <div className="composer-menu-item-wrap">
                  <button
                    type="button"
                    onClick={() => onSelect(option)}
                    onMouseEnter={() => { handleHighlight(index); onItemHover?.(option); }}
                    onMouseLeave={() => { handleHighlight(-1); onItemHover?.(null); }}
                    disabled={option.disabled}
                    className={
                      "composer-menu-item" +
                      (isHighlighted ? " highlighted" : "") +
                      (isSelected ? " selected" : "") +
                      (option.disabled ? " disabled" : "") +
                      (showCheckmark ? " has-check" : "")
                    }
                    role="option"
                    aria-selected={isSelected}
                  >
                    {showCheckmark && isSelected && (
                      <span className="composer-menu-check">
                        <CheckIcon />
                      </span>
                    )}
                    <span className="composer-menu-item-label">
                      {renderLabel ? renderLabel(option) : option.label}
                    </span>
                    {option.shortcut && (
                      <span className="composer-menu-item-shortcut">
                        {option.shortcut}
                      </span>
                    )}
                  </button>
                </div>
              </Fragment>
            );
          })}
          {options.length === 0 && (
            <div className="composer-menu-empty">No options available</div>
          )}
        </div>
        {showTop && (
          <div
            className="composer-menu-scroll-indicator top"
            onMouseEnter={() => startScrolling("up")}
            onMouseLeave={stopScrolling}
            aria-hidden="true"
            tabIndex={-1}
          >
            <ChevronUpIcon />
          </div>
        )}
        {showBottom && (
          <div
            className="composer-menu-scroll-indicator bottom"
            onMouseEnter={() => startScrolling("down")}
            onMouseLeave={stopScrolling}
            aria-hidden="true"
            tabIndex={-1}
          >
            <ChevronDownIcon />
          </div>
        )}
      </div>
    );
  }
);

DropdownMenu.displayName = "DropdownMenu";
