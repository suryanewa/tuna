/**
 * Dialog singleton — ensures only one floating dialog is open at a time.
 *
 * When a TokenIndicator or ColorInput opens a dialog, it calls `claimDialog(close)`.
 * If another dialog is already open, its close callback is invoked first.
 */

let activeClose: (() => void) | null = null;

/** Claim the singleton slot. Dismisses any previously open dialog. */
export function claimDialog(close: () => void): void {
  if (activeClose && activeClose !== close) {
    activeClose();
  }
  activeClose = close;
}

/** Release the singleton slot when a dialog closes naturally. */
export function releaseDialog(close: () => void): void {
  if (activeClose === close) {
    activeClose = null;
  }
}
