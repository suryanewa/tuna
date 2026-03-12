/**
 * TokenIndicator — dot shown on inputs for token interactions.
 *
 * Three states:
 * - Active (blue dot, always visible): token is currently applied
 * - Available (gray dot, visible on parent hover): tokens exist but none applied
 * - Disabled (returns null): no tokens available for this property
 *
 * Click opens the TokenDialog for browsing/selecting tokens.
 *
 * NOTE: React's synthetic onPointerDown doesn't work inside Shadow DOM portals
 * because event delegation attaches outside the shadow boundary. We attach a
 * native listener via a ref callback (not useEffect, per CLAUDE.md rules).
 *
 * The dialog is rendered via createPortal into the shadow root container to
 * escape the panel's overflow:hidden clipping.
 */

import { useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import type { TokenMatch, UtilityToken } from "../tokens/types";
import { hasTokensForProperty } from "../tokens/resolver";
import { TokenDialog } from "./token-dialog";
import { useScrollLock } from "./use-scroll-lock";

export interface TokenIndicatorProps {
  match?: TokenMatch;
  property: string;
  /** For shorthand inputs: all properties in the group (e.g. ["marginLeft", "marginRight"]) */
  relatedProperties?: string[];
  onTokenSelect?: (oldToken: UtilityToken, newToken: UtilityToken) => void;
  onTokenApply?: (token: UtilityToken, properties: string[]) => void;
}

export function TokenIndicator({ match, property, relatedProperties, onTokenSelect, onTokenApply }: TokenIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();
  const pickerOpenRef = useRef(false);
  pickerOpenRef.current = pickerOpen;
  const dotElRef = useRef<HTMLSpanElement | null>(null);
  useScrollLock(pickerOpen);

  const hasAvailable = useMemo(() => hasTokensForProperty(property), [property]);
  const isActive = !!match;
  const isDisabled = !isActive && !hasAvailable;

  // Ref callback: attach native pointerdown listener when element mounts.
  const dotRef = useCallback((el: HTMLSpanElement | null) => {
    if (dotElRef.current && dotElRef.current !== el) {
      dotElRef.current.removeEventListener("pointerdown", handleNativePointerDown);
    }
    dotElRef.current = el;
    if (el) {
      el.addEventListener("pointerdown", handleNativePointerDown);
    }
  }, []);

  // Store disabled state in a ref so the native handler can read it
  const isDisabledRef = useRef(isDisabled);
  isDisabledRef.current = isDisabled;

  function handleNativePointerDown(e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (isDisabledRef.current) return;
    const el = dotElRef.current;
    if (!el) return;
    if (pickerOpenRef.current) {
      setPickerOpen(false);
      return;
    }
    // Use the parent input row as anchor so the dialog appears directly below the input
    const row = el.closest(".retune-prop, .retune-color-row, .retune-row");
    const rect = row ? row.getBoundingClientRect() : el.getBoundingClientRect();
    setAnchorRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    setPickerOpen(true);
    setShowTooltip(false);
  }

  const show = useCallback(() => {
    if (pickerOpenRef.current) return;
    clearTimeout(hideTimeout.current);
    setShowTooltip(true);
  }, []);

  const hide = useCallback(() => {
    hideTimeout.current = setTimeout(() => setShowTooltip(false), 150);
  }, []);

  const handleSelect = useCallback((token: UtilityToken) => {
    if (match) {
      onTokenSelect?.(match.token, token);
    } else {
      const props = relatedProperties || [property];
      onTokenApply?.(token, props);
    }
  }, [match, property, relatedProperties, onTokenSelect, onTokenApply]);

  const handleClose = useCallback(() => {
    setPickerOpen(false);
  }, []);

  // Tooltip text
  const tooltipText = isActive
    ? `.${match.token.className}`
    : isDisabled
      ? "No tokens available"
      : "Apply token";

  // Dot class
  const dotClass = isActive
    ? "retune-token-dot retune-token-dot-active"
    : isDisabled
      ? "retune-token-dot retune-token-dot-disabled"
      : "retune-token-dot retune-token-dot-available";

  // Find the shadow root container for portaling the dialog outside the panel
  const portalTarget = dotElRef.current?.getRootNode() instanceof ShadowRoot
    ? (dotElRef.current.getRootNode() as ShadowRoot).querySelector("[data-retune-container]") as HTMLElement
    : null;

  return (
    <>
      <span
        ref={dotRef}
        className={dotClass}
        onPointerEnter={show}
        onPointerLeave={hide}
      >
        <span className="retune-token-dot-inner" />
        {showTooltip && !pickerOpen && (
          <span className="retune-token-tooltip">{tooltipText}</span>
        )}
      </span>
      {pickerOpen && anchorRect && portalTarget && createPortal(
        <TokenDialog
          property={property}
          currentToken={match?.token}
          onSelect={handleSelect}
          onClose={handleClose}
          anchorRect={anchorRect}
        />,
        portalTarget,
      )}
    </>
  );
}
