/**
 * ComboInput — number input with a dropdown for preset values.
 * Equivalent to the portfolio editor's ComboInput component.
 *
 * Supports typing numeric values (with units) and selecting
 * from a list of CSS keyword options (e.g. auto, fit-content).
 */

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DropdownMenu, type DropdownMenuOption } from "./dropdown-menu";
import { calcMenuPosition, type MenuPosition } from "./menu-position";
import { roundCssValue, inferCssUnit } from "./round-css-value";
import { ChevronDown } from "./icons";
import { useScrollLock } from "./use-scroll-lock";
import type { TokenMatch, UtilityToken } from "../tokens/types";
import { hasTokensForProperty } from "../tokens/resolver";
import { ChangeIndicator } from "./change-indicator";
import { TokenDialog } from "./token-dialog";
import { claimDialog, releaseDialog } from "./dialog-singleton";
import { Tooltip } from "./tooltip";

export interface ComboOption {
  value: string;
  label: string;
}

export interface ComboInputProps {
  label?: ReactNode;
  prop: string;
  value: string | undefined;
  options: ComboOption[];
  onChange: (prop: string, value: string) => void;
  /** Token match — shows a dot indicator when the value comes from a utility token */
  tokenMatch?: TokenMatch;
  /** CSS property name for token availability detection */
  property?: string;
  /** Callback when user picks a different token from the picker */
  onTokenSelect?: (oldToken: import("../tokens/types").UtilityToken, newToken: import("../tokens/types").UtilityToken) => void;
  /** Callback when user applies a token from scratch (no existing token) */
  onTokenApply?: (token: import("../tokens/types").UtilityToken, properties: string[]) => void;
  onTokenUnlink?: () => void;
  /** Whether this property has been changed from its original value */
  isChanged?: boolean;
  /** Reset this property to its original value */
  onReset?: () => void;
}

export function ComboInput({ label, prop, value, options, onChange, tokenMatch, property, onTokenSelect, onTokenApply, onTokenUnlink, isChanged, onReset }: ComboInputProps) {
  const [localValue, setLocalValue] = useState(roundCssValue(value || ""));
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const editingRef = useRef(false);
  useScrollLock(open);

  // Variable picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const stableCloseRef = useRef(() => setPickerOpen(false));
  const hasAvailable = useMemo(() => hasTokensForProperty(property || prop), [property, prop]);

  // "Add variable" option appended to dropdown when variables are available
  const ADD_VARIABLE_VALUE = "__add_variable__";
  const allOptions = useMemo(() => {
    if (!hasAvailable || tokenMatch) return options;
    return [...options, { value: ADD_VARIABLE_VALUE, label: "Add variable", separatorBefore: true }];
  }, [options, hasAvailable, tokenMatch]);

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    // Don't overwrite what the user is typing
    if (!editingRef.current) {
      setLocalValue(roundCssValue(value || ""));
    }
  }

  const openDropdown = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const selectedIndex = Math.max(0, allOptions.findIndex((opt) => opt.value === localValue));
    const pos = calcMenuPosition(rect, selectedIndex, allOptions.length);
    setMenuPos(pos);
    setOpen(true);
    setHighlightedIndex(selectedIndex);
  }, [allOptions, localValue]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setHighlightedIndex(-1);
    setMenuPos(null);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const path = e.composedPath();
      if (!path.includes(container)) {
        closeDropdown();
      }
    };
    const root = containerRef.current?.getRootNode() as ShadowRoot | Document;
    root.addEventListener("pointerdown", handlePointerDown as EventListener);
    return () => root.removeEventListener("pointerdown", handlePointerDown as EventListener);
  }, [open, closeDropdown]);

  // Get display value: show option label if value matches an option
  const displayValue = (() => {
    const match = options.find((opt) => opt.value === localValue);
    return match ? match.label : localValue;
  })();

  // Scrub-to-adjust on label
  const scrubRef = useRef({ startX: 0, startVal: 0, active: false });

  const handleLabelPointerDown = (e: React.PointerEvent) => {
    const num = parseFloat(localValue);
    if (isNaN(num)) return;
    scrubRef.current = { startX: e.clientX, startVal: num, active: true };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleLabelPointerMove = (e: React.PointerEvent) => {
    if (!scrubRef.current.active) return;
    const delta = Math.round(e.clientX - scrubRef.current.startX);
    const unit = localValue.match(/[a-z%]+$/i)?.[0] || "";
    const raw = scrubRef.current.startVal + delta;
    // Clamp to 0 minimum for properties that shouldn't go negative (gap, size, etc.)
    const clamped = raw < 0 && !prop.includes("margin") && !prop.includes("top") && !prop.includes("right") && !prop.includes("bottom") && !prop.includes("left") && !prop.includes("indent") ? 0 : raw;
    const newVal = `${clamped}${unit}`;
    setLocalValue(newVal);
    onChange(prop, newVal);
  };

  const handleLabelPointerUp = () => {
    scrubRef.current.active = false;
  };

  // Scrub from input's left padding when there's no label
  const SCRUB_ZONE = 16; // px from left edge of input

  const handleInputPointerDown = (e: React.PointerEvent<HTMLInputElement>) => {
    if (label) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left > SCRUB_ZONE) return;
    const num = parseFloat(localValue);
    if (isNaN(num)) return;
    e.preventDefault();
    scrubRef.current = { startX: e.clientX, startVal: num, active: true };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleInputPointerMove = (e: React.PointerEvent<HTMLInputElement>) => {
    if (scrubRef.current.active) {
      const delta = Math.round(e.clientX - scrubRef.current.startX);
      const unit = localValue.match(/[a-z%]+$/i)?.[0] || "";
      const raw = scrubRef.current.startVal + delta;
      const clamped = raw < 0 && !prop.includes("margin") && !prop.includes("top") && !prop.includes("right") && !prop.includes("bottom") && !prop.includes("left") && !prop.includes("indent") ? 0 : raw;
      const newVal = `${clamped}${unit}`;
      setLocalValue(newVal);
      onChange(prop, newVal);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const inZone = e.clientX - rect.left <= SCRUB_ZONE;
    e.currentTarget.style.cursor = inZone ? "ew-resize" : "";
  };

  const handleInputPointerUp = () => {
    scrubRef.current.active = false;
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    editingRef.current = true;
    e.target.select();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    const match = options.find(
      (opt) =>
        opt.label.toLowerCase() === newValue.toLowerCase() ||
        opt.value.toLowerCase() === newValue.toLowerCase()
    );
    if (match) {
      onChange(prop, match.value);
    }
  };

  const handleBlur = () => {
    editingRef.current = false;
    const resolved = inferCssUnit(localValue, value || "", prop);
    setLocalValue(resolved);
    if (resolved !== value) {
      onChange(prop, resolved);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && highlightedIndex >= 0) {
        const opt = allOptions[highlightedIndex];
        if (opt.value === ADD_VARIABLE_VALUE) {
          closeDropdown();
          openVariablePicker();
        } else {
          setLocalValue(opt.value);
          onChange(prop, opt.value);
          closeDropdown();
        }
      } else {
        const resolved = inferCssUnit(localValue, value || "", prop);
        setLocalValue(resolved);
        onChange(prop, resolved);
        (e.target as HTMLInputElement).blur();
      }
      return;
    }

    if (e.key === "Escape") {
      closeDropdown();
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (open) {
        if (e.key === "ArrowDown") {
          setHighlightedIndex((prev) => prev < allOptions.length - 1 ? prev + 1 : prev);
        } else {
          setHighlightedIndex((prev) => prev > 0 ? prev - 1 : prev);
        }
      } else {
        const num = parseFloat(localValue);
        if (isNaN(num)) return;
        const step = e.shiftKey ? 10 : 1;
        const delta = e.key === "ArrowUp" ? step : -step;
        const unit = localValue.match(/[a-z%]+$/i)?.[0] || "";
        const newVal = `${num + delta}${unit}`;
        setLocalValue(newVal);
        onChange(prop, newVal);
      }
    }
  };

  const openVariablePicker = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPickerAnchor({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    setPickerOpen(true);
    claimDialog(stableCloseRef.current);
  }, []);

  const closeVariablePicker = useCallback(() => {
    releaseDialog(stableCloseRef.current);
    setPickerOpen(false);
  }, []);

  const handleTokenSelectInternal = useCallback((token: UtilityToken) => {
    if (tokenMatch) {
      onTokenSelect?.(tokenMatch.token, token);
    } else {
      onTokenApply?.(token, [property || prop]);
    }
  }, [tokenMatch, property, prop, onTokenSelect, onTokenApply]);

  const handleOptionSelect = (option: DropdownMenuOption) => {
    if (option.value === ADD_VARIABLE_VALUE) {
      closeDropdown();
      openVariablePicker();
      return;
    }
    setLocalValue(option.value);
    onChange(prop, option.value);
    closeDropdown();
  };

  // Ref callback for unlink icon: native pointerdown for Shadow DOM compatibility
  const onTokenUnlinkRef = useRef(onTokenUnlink);
  onTokenUnlinkRef.current = onTokenUnlink;
  const unlinkRef = useCallback((el: HTMLSpanElement | null) => {
    if (!el) return;
    const handler = (e: PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onTokenUnlinkRef.current?.();
    };
    el.addEventListener("pointerdown", handler);
  }, []);

  // Portal target for variable picker dialog
  const portalTarget = containerRef.current?.getRootNode() instanceof ShadowRoot
    ? (containerRef.current.getRootNode() as ShadowRoot).querySelector("[data-retune-container]") as HTMLElement
    : null;

  // Variable-applied transformation: render as number-input-like display
  if (tokenMatch) {
    return (
      <div className="retune-combo retune-combo-variable-applied" ref={containerRef}>
        <ChangeIndicator isChanged={isChanged ?? false} onReset={onReset ?? (() => {})} />
        {label && (
          <span
            ref={labelRef}
            className="retune-combo-label"
          >
            {label}
          </span>
        )}
        <input
          className="retune-combo-input"
          style={label ? undefined : { paddingLeft: 8 }}
          value={displayValue}
          readOnly
          onClick={openVariablePicker}
          spellCheck={false}
        />
        <Tooltip content="Unlink variable" side="top" delay={300}>
          <span ref={unlinkRef} className="retune-variable-action retune-variable-unlink">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12.3533 14.646C12.5485 14.8412 12.5484 15.1578 12.3533 15.3531L11.3534 16.353C10.3297 17.3765 8.67028 17.3766 7.64665 16.353C6.62317 15.3294 6.62317 13.6699 7.64665 12.6462L8.64654 11.6463C8.84181 11.4512 9.15844 11.4511 9.35364 11.6463C9.54883 11.8415 9.54874 12.1582 9.35364 12.3534L8.35375 13.3533C7.7208 13.9865 7.7208 15.0128 8.35375 15.6459C8.98687 16.279 10.0132 16.2789 10.6463 15.6459L11.6462 14.646C11.8414 14.451 12.1581 14.4511 12.3533 14.646ZM8.0002 9.00021C8.27634 9.00021 8.50015 9.22401 8.50015 9.50015C8.49994 9.77612 8.27622 10.0001 8.0002 10.0001H6.50036C6.22434 10.0001 6.00061 9.77612 6.00041 9.50015C6.00041 9.22401 6.22422 9.00021 6.50036 9.00021H8.0002ZM14.5002 15.5002C14.7763 15.5002 15.0001 15.724 15.0001 16.0001V17.5C15 17.776 14.7763 17.9999 14.5002 17.9999C14.2241 17.9999 14.0004 17.776 14.0002 17.5V16.0001C14.0002 15.724 14.2241 15.5002 14.5002 15.5002ZM9.50073 5.99984C9.77664 6.00011 10.0007 6.22381 10.0007 6.49978V7.99962C10.0007 8.2756 9.77664 8.4993 9.50073 8.49957C9.22459 8.49957 9.00078 8.27576 9.00078 7.99962V6.49978C9.00078 6.22364 9.22459 5.99984 9.50073 5.99984ZM17.5006 13.9997C17.7765 13.9998 18.0004 14.2237 18.0005 14.4996C18.0005 14.7757 17.7766 14.9994 17.5006 14.9996H16.0007C15.7246 14.9996 15.5008 14.7758 15.5008 14.4996C15.5009 14.2235 15.7246 13.9997 16.0007 13.9997H17.5006ZM16.3543 7.64676C17.3774 8.67043 17.3776 10.33 16.3543 11.3535L15.3544 12.3534C15.1592 12.5486 14.8426 12.5484 14.6473 12.3534C14.452 12.1582 14.452 11.8416 14.6473 11.6463L15.6472 10.6464C16.28 10.0134 16.2798 8.98702 15.6472 8.35387C15.0141 7.72075 13.9871 7.72018 13.3539 8.35317L12.354 9.35307C12.1588 9.54825 11.8422 9.54808 11.6469 9.35307C11.4519 9.15779 11.4517 8.84114 11.6469 8.64596L12.6468 7.64607C13.6705 6.62254 15.3306 6.62312 16.3543 7.64676Z" fill="currentColor" fillOpacity={0.9} />
            </svg>
          </span>
        </Tooltip>
        {pickerOpen && pickerAnchor && portalTarget && createPortal(
          <TokenDialog
            property={property || prop}
            currentToken={tokenMatch.token}
            onSelect={handleTokenSelectInternal}
            onUnlink={onTokenUnlink ? () => { onTokenUnlink(); closeVariablePicker(); } : undefined}
            onClose={closeVariablePicker}
            anchorRect={pickerAnchor}
          />,
          portalTarget,
        )}
      </div>
    );
  }

  return (
    <div className="retune-combo" ref={containerRef}>
      <ChangeIndicator isChanged={isChanged ?? false} onReset={onReset ?? (() => {})} />
      {label && (
        <span
          ref={labelRef}
          className="retune-combo-label"
          onPointerDown={handleLabelPointerDown}
          onPointerMove={handleLabelPointerMove}
          onPointerUp={handleLabelPointerUp}
        >
          {label}
        </span>
      )}
      <input
        className="retune-combo-input"
        style={label ? undefined : { paddingLeft: 8 }}
        value={displayValue}
        onPointerDown={!label ? handleInputPointerDown : undefined}
        onPointerMove={!label ? handleInputPointerMove : undefined}
        onPointerUp={!label ? handleInputPointerUp : undefined}
        onFocus={handleFocus}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
      <button
        type="button"
        className="retune-combo-trigger"
        onClick={() => { open ? closeDropdown() : openDropdown(); }}
        aria-label="Toggle options"
      >
        <ChevronDown />
      </button>
      {open && menuPos && (
        <div
          className="retune-combo-dropdown-anchor"
          style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
        >
          <DropdownMenu
            options={allOptions}
            value={localValue}
            highlightedIndex={highlightedIndex}
            onSelect={handleOptionSelect}
            onHighlight={setHighlightedIndex}
            initialScrollTop={menuPos.scrollTop}
            showCheckmark
          />
        </div>
      )}
      {pickerOpen && pickerAnchor && portalTarget && createPortal(
        <TokenDialog
          property={property || prop}
          currentToken={tokenMatch?.token}
          onSelect={handleTokenSelectInternal}
          onClose={closeVariablePicker}
          anchorRect={pickerAnchor}
        />,
        portalTarget,
      )}
    </div>
  );
}
