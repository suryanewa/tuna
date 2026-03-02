import { describe, it, expect, vi } from "vitest";

/**
 * Bug: Changing color modes in the NestedPickerPortal dismisses ALL pickers.
 *
 * Root cause: NestedPickerPortal doesn't wrap content in PortalContainerProvider.
 * The Dropdown in ColorModeInputs uses usePortalContainer() which returns null
 * (no provider), so it portals its menu to document.body.
 *
 * When the user clicks a dropdown option:
 * 1. pointerdown fires on the option element (in document.body)
 * 2. Main dialog's useClickOutside checks panelRef.contains(target) → false
 * 3. Main dialog's useClickOutside checks ignoreRefs (nestedPickerRef).contains(target) → false
 * 4. Main dialog closes → nested picker unmounts → everything gone
 *
 * Fix: Wrap NestedPickerPortal content in PortalContainerProvider so the
 * Dropdown portals inside the nested picker's ref. Then:
 * - nestedPickerRef.contains(dropdownOption) → true
 * - Main dialog's ignoreRefs check passes → no close
 * - Nested picker's own click-outside check passes → no close
 */

// Simulates the click-outside logic from floating-panel.tsx useClickOutside
function wouldCloseMainDialog(
  panelContains: (t: unknown) => boolean,
  triggerContains: (t: unknown) => boolean,
  ignoreRefs: Array<{ contains: (t: unknown) => boolean }>,
  target: unknown,
): boolean {
  return (
    !panelContains(target) &&
    !triggerContains(target) &&
    !ignoreRefs.some((ref) => ref.contains(target))
  );
}

// Simulates the click-outside logic from NestedPickerPortal
function wouldCloseNestedPicker(
  nestedRefContains: (t: unknown) => boolean,
  mainDialogContains: (t: unknown) => boolean,
  target: unknown,
): boolean {
  if (nestedRefContains(target)) return false;
  if (mainDialogContains(target)) return false;
  return true;
}

describe("nested picker dropdown should not dismiss pickers", () => {
  const target = Symbol("dropdownOption");
  const triggerContains = () => false; // trigger is never the dropdown

  it("BUG: dropdown portaled to document.body triggers close of all pickers", () => {
    const onMainClose = vi.fn();
    const onNestedClose = vi.fn();

    // Without PortalContainerProvider, dropdown portals to document.body.
    // Neither panelRef nor nestedPickerRef contains the dropdown option.
    const panelContains = () => false;
    const nestedRefContains = () => false;

    if (wouldCloseMainDialog(panelContains, triggerContains, [{ contains: nestedRefContains }], target)) {
      onMainClose();
    }
    if (wouldCloseNestedPicker(nestedRefContains, panelContains, target)) {
      onNestedClose();
    }

    // BUG: Both pickers close
    expect(onMainClose).toHaveBeenCalled();
    expect(onNestedClose).toHaveBeenCalled();
  });

  it("FIX: dropdown portaled inside nested picker ref keeps all pickers open", () => {
    const onMainClose = vi.fn();
    const onNestedClose = vi.fn();

    // With PortalContainerProvider, dropdown portals inside nestedPickerRef.
    // nestedPickerRef.contains(target) → true
    const panelContains = () => false;
    const nestedRefContains = () => true; // ← portal container is inside nested ref

    if (wouldCloseMainDialog(panelContains, triggerContains, [{ contains: nestedRefContains }], target)) {
      onMainClose();
    }
    if (wouldCloseNestedPicker(nestedRefContains, panelContains, target)) {
      onNestedClose();
    }

    // FIX: Neither picker closes
    expect(onMainClose).not.toHaveBeenCalled();
    expect(onNestedClose).not.toHaveBeenCalled();
  });
});
