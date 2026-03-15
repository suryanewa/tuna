/**
 * TokenIndicator — dot shown on inputs for variable interactions.
 *
 * Three states:
 * - Active (blue dot, always visible): variable is currently applied
 * - Available (gray dot, visible on parent hover): variables exist but none applied
 * - Disabled (returns null): no variables available for this property
 *
 * Click opens the TokenDialog for browsing/selecting variables.
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
import { claimDialog, releaseDialog } from "./dialog-singleton";
import { Tooltip } from "./tooltip";

/** Format a variable className for tooltip display: var → "spacing-4", class → ".spacing-xl" */
function formatMatchName(className: string): string {
  if (className.startsWith("var(--") && className.endsWith(")")) {
    return className.slice(6, -1);
  }
  return `.${className}`;
}

export interface TokenIndicatorProps {
  match?: TokenMatch;
  property: string;
  /** For shorthand inputs: all properties in the group (e.g. ["marginLeft", "marginRight"]) */
  relatedProperties?: string[];
  onTokenSelect?: (oldToken: UtilityToken, newToken: UtilityToken) => void;
  onTokenApply?: (token: UtilityToken, properties: string[]) => void;
  onTokenUnlink?: () => void;
  /** When provided, dot click calls this instead of opening the internal TokenDialog.
   *  Used by ColorInput to open the color picker to the variables tab. */
  onRequestOpen?: () => void;
}

export function TokenIndicator({ match, property, relatedProperties, onTokenSelect, onTokenApply, onTokenUnlink, onRequestOpen }: TokenIndicatorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const pickerOpenRef = useRef(false);
  pickerOpenRef.current = pickerOpen;
  const dotElRef = useRef<HTMLSpanElement | null>(null);

  // Stable close function for the dialog singleton (called externally when another dialog opens)
  const stableCloseRef = useRef(() => setPickerOpen(false));

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
  const onRequestOpenRef = useRef(onRequestOpen);
  onRequestOpenRef.current = onRequestOpen;

  function handleNativePointerDown(e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (isDisabledRef.current) return;
    // Delegate to parent (e.g. ColorInput opens picker to variables tab)
    if (onRequestOpenRef.current) {
      onRequestOpenRef.current();
      return;
    }
    const el = dotElRef.current;
    if (!el) return;
    if (pickerOpenRef.current) {
      releaseDialog(stableCloseRef.current);
      setPickerOpen(false);
      return;
    }
    // Use the parent input row as anchor so the dialog appears directly below the input
    const row = el.closest(".retune-prop, .retune-color-row, .retune-row");
    const rect = row ? row.getBoundingClientRect() : el.getBoundingClientRect();
    setAnchorRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    setPickerOpen(true);
    claimDialog(stableCloseRef.current);
  }

  const handleSelect = useCallback((token: UtilityToken) => {
    if (match) {
      onTokenSelect?.(match.token, token);
    } else {
      const props = relatedProperties || [property];
      onTokenApply?.(token, props);
    }
  }, [match, property, relatedProperties, onTokenSelect, onTokenApply]);

  const handleClose = useCallback(() => {
    releaseDialog(stableCloseRef.current);
    setPickerOpen(false);
  }, []);

  // Tooltip text
  const tooltipText = isActive
    ? formatMatchName(match.token.className)
    : isDisabled
      ? "No variables available"
      : "Browse variables";

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
      <Tooltip content={tooltipText} side="top" delay={200}>
        <span ref={dotRef} className={dotClass}>
          <span className="retune-token-dot-inner" />
        </span>
      </Tooltip>
      {pickerOpen && anchorRect && portalTarget && createPortal(
        <TokenDialog
          property={property}
          currentToken={match?.token}
          onSelect={handleSelect}
          onUnlink={onTokenUnlink ? () => { onTokenUnlink(); handleClose(); } : undefined}
          onClose={handleClose}
          anchorRect={anchorRect}
        />,
        portalTarget,
      )}
    </>
  );
}
