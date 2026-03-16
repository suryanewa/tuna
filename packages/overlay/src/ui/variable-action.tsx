/**
 * VariableAction — hover icon on the right side of an input for variable interactions.
 *
 * Two visible states:
 * - Available (hexagon icon, visible on parent hover): variables exist but none applied → opens picker
 * - Applied (unlink icon, visible on parent hover): variable is applied → detach shortcut
 *
 * When no variables are available for the property, renders nothing.
 *
 * The variable picker (TokenDialog) is rendered via createPortal into the
 * shadow root container to escape the panel's overflow:hidden clipping.
 *
 * NOTE: Uses native pointerdown listeners for Shadow DOM compatibility.
 */

import { useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import type { TokenMatch, UtilityToken } from "../tokens/types";
import { hasVariablesForProperty } from "../tokens/resolver";
import { TokenDialog } from "./token-dialog";
import { claimDialog, releaseDialog } from "./dialog-singleton";
import { Tooltip } from "./tooltip";

/* ── Inline SVG icons ── */

function HexagonIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12.5 11.0346C13.0522 11.0346 13.4999 11.4824 13.5 12.0346C13.5 12.5868 13.0523 13.0346 12.5 13.0346C11.9477 13.0346 11.5 12.5868 11.5 12.0346C11.5001 11.4824 11.9478 11.0346 12.5 11.0346Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M11.5 6.26795C12.1188 5.91068 12.8812 5.91068 13.5 6.26795L17 8.28846C17.6187 8.64574 18 9.30641 18 10.0209V14.0619C17.9999 14.7763 17.6187 15.4371 17 15.7943L13.5 17.8148C12.8813 18.1719 12.1187 18.1719 11.5 17.8148L8 15.7943C7.3813 15.4371 7.00013 14.7763 7 14.0619V10.0209C7 9.30641 7.38129 8.64574 8 8.28846L11.5 6.26795ZM13 7.13416C12.6906 6.95553 12.3094 6.95553 12 7.13416L8.5 9.15467L8.38965 9.22791C8.14588 9.41565 8 9.70826 8 10.0209V14.0619C8.00013 14.419 8.1907 14.7495 8.5 14.9281L12 16.9486C12.2707 17.1048 12.5965 17.1244 12.8809 17.0072L13 16.9486L16.5 14.9281C16.8093 14.7495 16.9999 14.419 17 14.0619V10.0209C17 9.70826 16.8541 9.41565 16.6104 9.22791L16.5 9.15467L13 7.13416Z" fill="currentColor" />
    </svg>
  );
}

function UnlinkIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12.3533 14.646C12.5485 14.8412 12.5484 15.1578 12.3533 15.3531L11.3534 16.353C10.3297 17.3765 8.67028 17.3766 7.64665 16.353C6.62317 15.3294 6.62317 13.6699 7.64665 12.6462L8.64654 11.6463C8.84181 11.4512 9.15844 11.4511 9.35364 11.6463C9.54883 11.8415 9.54874 12.1582 9.35364 12.3534L8.35375 13.3533C7.7208 13.9865 7.7208 15.0128 8.35375 15.6459C8.98687 16.279 10.0132 16.2789 10.6463 15.6459L11.6462 14.646C11.8414 14.451 12.1581 14.4511 12.3533 14.646ZM8.0002 9.00021C8.27634 9.00021 8.50015 9.22401 8.50015 9.50015C8.49994 9.77612 8.27622 10.0001 8.0002 10.0001H6.50036C6.22434 10.0001 6.00061 9.77612 6.00041 9.50015C6.00041 9.22401 6.22422 9.00021 6.50036 9.00021H8.0002ZM14.5002 15.5002C14.7763 15.5002 15.0001 15.724 15.0001 16.0001V17.5C15 17.776 14.7763 17.9999 14.5002 17.9999C14.2241 17.9999 14.0004 17.776 14.0002 17.5V16.0001C14.0002 15.724 14.2241 15.5002 14.5002 15.5002ZM9.50073 5.99984C9.77664 6.00011 10.0007 6.22381 10.0007 6.49978V7.99962C10.0007 8.2756 9.77664 8.4993 9.50073 8.49957C9.22459 8.49957 9.00078 8.27576 9.00078 7.99962V6.49978C9.00078 6.22364 9.22459 5.99984 9.50073 5.99984ZM17.5006 13.9997C17.7765 13.9998 18.0004 14.2237 18.0005 14.4996C18.0005 14.7757 17.7766 14.9994 17.5006 14.9996H16.0007C15.7246 14.9996 15.5008 14.7758 15.5008 14.4996C15.5009 14.2235 15.7246 13.9997 16.0007 13.9997H17.5006ZM16.3543 7.64676C17.3774 8.67043 17.3776 10.33 16.3543 11.3535L15.3544 12.3534C15.1592 12.5486 14.8426 12.5484 14.6473 12.3534C14.452 12.1582 14.452 11.8416 14.6473 11.6463L15.6472 10.6464C16.28 10.0134 16.2798 8.98702 15.6472 8.35387C15.0141 7.72075 13.9871 7.72018 13.3539 8.35317L12.354 9.35307C12.1588 9.54825 11.8422 9.54808 11.6469 9.35307C11.4519 9.15779 11.4517 8.84114 11.6469 8.64596L12.6468 7.64607C13.6705 6.62254 15.3306 6.62312 16.3543 7.64676Z" fill="currentColor" fillOpacity={0.9} />
    </svg>
  );
}

export interface VariableActionProps {
  match?: TokenMatch;
  property: string;
  /** For shorthand inputs: all properties in the group */
  relatedProperties?: string[];
  onTokenSelect?: (oldToken: UtilityToken, newToken: UtilityToken, properties?: string[]) => void;
  onTokenApply?: (token: UtilityToken, properties: string[]) => void;
  onTokenUnlink?: () => void;
  /** When provided, icon click calls this instead of opening the internal TokenDialog.
   *  Used by ColorInput to open the color picker to the variables tab. */
  onRequestOpen?: () => void;
  /** Ref that receives the openPicker function so parent can trigger it (e.g. on input click) */
  openPickerRef?: React.MutableRefObject<(() => void) | null>;
}

export function VariableAction({ match, property, relatedProperties, onTokenSelect, onTokenApply, onTokenUnlink, onRequestOpen, openPickerRef }: VariableActionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const pickerOpenRef = useRef(false);
  pickerOpenRef.current = pickerOpen;
  const iconElRef = useRef<HTMLSpanElement | null>(null);

  // Stable close function for the dialog singleton
  const stableCloseRef = useRef(() => setPickerOpen(false));

  const hasAvailable = useMemo(() => hasVariablesForProperty(property), [property]);
  const isActive = !!match;

  // Refs for native handler access
  const onRequestOpenRef = useRef(onRequestOpen);
  onRequestOpenRef.current = onRequestOpen;
  const onTokenUnlinkRef = useRef(onTokenUnlink);
  onTokenUnlinkRef.current = onTokenUnlink;

  // Open the variable picker dialog
  const openPicker = useCallback(() => {
    const el = iconElRef.current;
    if (!el) return;
    if (pickerOpenRef.current) {
      releaseDialog(stableCloseRef.current);
      setPickerOpen(false);
      return;
    }
    const row = el.closest(".retune-prop, .retune-color-row, .retune-row, .retune-combo");
    const rect = row ? row.getBoundingClientRect() : el.getBoundingClientRect();
    setAnchorRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    setPickerOpen(true);
    claimDialog(stableCloseRef.current);
  }, []);

  // Ref callback: attach native pointerdown for Shadow DOM compatibility
  const iconRef = useCallback((el: HTMLSpanElement | null) => {
    if (iconElRef.current && iconElRef.current !== el) {
      iconElRef.current.removeEventListener("pointerdown", handleNativePointerDown);
    }
    iconElRef.current = el;
    if (el) {
      el.addEventListener("pointerdown", handleNativePointerDown);
    }
  }, []);

  function handleNativePointerDown(e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    // For unlink icon (applied state), detach the variable — check BEFORE onRequestOpen
    const target = e.target as HTMLElement;
    if (target.closest(".retune-variable-unlink")) {
      onTokenUnlinkRef.current?.();
      return;
    }
    // Delegate to parent if requested (e.g. ColorInput)
    if (onRequestOpenRef.current) {
      onRequestOpenRef.current();
      return;
    }
    // Otherwise open the picker
    const el = iconElRef.current;
    if (!el) return;
    if (pickerOpenRef.current) {
      releaseDialog(stableCloseRef.current);
      setPickerOpen(false);
      return;
    }
    const row = el.closest(".retune-prop, .retune-color-row, .retune-row, .retune-combo");
    const rect = row ? row.getBoundingClientRect() : el.getBoundingClientRect();
    setAnchorRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    setPickerOpen(true);
    claimDialog(stableCloseRef.current);
  }

  const handleSelect = useCallback((token: UtilityToken) => {
    const props = relatedProperties || [property];
    if (match) {
      onTokenSelect?.(match.token, token, props);
    } else {
      onTokenApply?.(token, props);
    }
  }, [match, property, relatedProperties, onTokenSelect, onTokenApply]);

  const handleClose = useCallback(() => {
    releaseDialog(stableCloseRef.current);
    setPickerOpen(false);
  }, []);

  // No variables available — render nothing
  if (!isActive && !hasAvailable) return null;

  // Find the shadow root container for portaling the dialog
  const portalTarget = iconElRef.current?.getRootNode() instanceof ShadowRoot
    ? (iconElRef.current.getRootNode() as ShadowRoot).querySelector("[data-retune-container]") as HTMLElement
    : null;

  // Expose openPicker for parent components (e.g. when clicking a variable-applied input)
  if (openPickerRef) openPickerRef.current = openPicker;

  return (
    <>
      {isActive ? (
        // Variable applied: show unlink icon on hover
        <Tooltip content="Unlink variable" side="top" delay={300}>
          <span ref={iconRef} className="retune-variable-action retune-variable-unlink">
            <UnlinkIcon />
          </span>
        </Tooltip>
      ) : (
        // Variable available: show hexagon icon on hover → opens picker
        <Tooltip content="Add variable" side="top" delay={300}>
          <span ref={iconRef} className="retune-variable-action retune-variable-add">
            <HexagonIcon />
          </span>
        </Tooltip>
      )}
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
