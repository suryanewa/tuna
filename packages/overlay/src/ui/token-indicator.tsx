/**
 * TokenIndicator — small dot shown on inputs when the current value
 * comes from a utility-class token. Click to open the token picker.
 * Hovering shows the class name tooltip.
 *
 * NOTE: React's synthetic onPointerDown doesn't work inside Shadow DOM portals
 * because event delegation attaches outside the shadow boundary. We attach a
 * native listener via a ref callback (not useEffect, per CLAUDE.md rules).
 *
 * The picker is rendered via createPortal into the shadow root container to
 * escape the panel's overflow:hidden clipping.
 */

import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { TokenMatch, UtilityToken } from "../tokens/types";
import { TokenPicker } from "./token-picker";

export interface TokenIndicatorProps {
  match: TokenMatch;
  onTokenSelect?: (oldToken: UtilityToken, newToken: UtilityToken) => void;
}

export function TokenIndicator({ match, onTokenSelect }: TokenIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();
  const pickerOpenRef = useRef(false);
  pickerOpenRef.current = pickerOpen;
  const dotElRef = useRef<HTMLSpanElement | null>(null);

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

  function handleNativePointerDown(e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    const el = dotElRef.current;
    if (!el) return;
    if (pickerOpenRef.current) {
      setPickerOpen(false);
      return;
    }
    const rect = el.getBoundingClientRect();
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

  const handleSelect = useCallback((newToken: UtilityToken) => {
    onTokenSelect?.(match.token, newToken);
  }, [match.token, onTokenSelect]);

  const handleClose = useCallback(() => {
    setPickerOpen(false);
  }, []);

  // Find the shadow root container for portaling the picker outside the panel
  const portalTarget = dotElRef.current?.getRootNode() instanceof ShadowRoot
    ? (dotElRef.current.getRootNode() as ShadowRoot).querySelector("[data-retune-container]") as HTMLElement
    : null;

  return (
    <>
      <span
        ref={dotRef}
        className="retune-token-dot"
        onPointerEnter={show}
        onPointerLeave={hide}
      >
        <span className="retune-token-dot-inner" />
        {showTooltip && !pickerOpen && (
          <span className="retune-token-tooltip">.{match.token.className}</span>
        )}
      </span>
      {pickerOpen && anchorRect && portalTarget && createPortal(
        <TokenPicker
          match={match}
          onSelect={handleSelect}
          onClose={handleClose}
          anchorRect={anchorRect}
        />,
        portalTarget,
      )}
    </>
  );
}
