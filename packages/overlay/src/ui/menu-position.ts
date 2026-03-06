/**
 * macOS-style dropdown positioning — aligns the selected item
 * with the trigger so it appears "in place".
 */

const ITEM_HEIGHT = 28;
const MENU_PADDING_Y = 6;
const VIEWPORT_MARGIN = 8;
const MAX_MENU_HEIGHT = 400;

export interface MenuPosition {
  top: number;
  left: number;
  width: number;
  scrollTop: number;
}

export function calcMenuPosition(
  triggerRect: DOMRect,
  selectedIndex: number,
  optionCount: number,
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

  // Scroll so the selected item aligns visually with the trigger
  const targetVisibleOffset = triggerCenter - clampedTop - ITEM_HEIGHT / 2;
  const maxScrollTop = Math.max(0, menuContentHeight - menuHeight);
  const scrollTop = Math.max(
    0,
    Math.min(selectedItemOffset - targetVisibleOffset, maxScrollTop)
  );

  return {
    top: clampedTop,
    left: triggerRect.left,
    width: triggerRect.width,
    scrollTop,
  };
}
