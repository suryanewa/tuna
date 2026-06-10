export interface SelectEventMeta {
  shiftKey: boolean;
  altKey?: boolean;
  selectedElements: Element[];
  /** Colors aligned with selectedElements, matching picker outlines/fills. */
  selectionColors?: string[];
}

export interface PickerCallbacks {
  onHover: (element: Element, rect: DOMRect) => void;
  onSelect: (element: Element, meta?: SelectEventMeta) => void;
  /** Called when selection is cleared without deactivating the overlay. */
  onDeselect?: () => void;
  onCancel: () => void;
  /** If provided, called before processing a click. Return true to block the click entirely. */
  shouldBlockClick?: () => boolean;
  onDoubleClick?: (element: Element) => void;
  onResize?: (element: Element, property: "width" | "height", value: string) => void;
  /** Called during resize drag for live preview (updates stylesheet without recording changes). */
  onResizePreview?: (element: Element, property: "width" | "height", value: string) => void;
  /** Called when an absolute/fixed element is repositioned via drag. */
  onReposition?: (element: Element, property: "top" | "left" | "right" | "bottom", value: string) => void;
  /** Called during reposition drag for live preview. */
  onRepositionPreview?: (element: Element, property: "top" | "left" | "right" | "bottom", value: string) => void;
  /** Called when a flow element is reordered by drag among its siblings. */
  onCanvasReorder?: (element: Element, fromIndex: number, toIndex: number) => void;
  /** Called when a flow element is reparented by dragging to a different container. */
  onCanvasReparent?: (element: Element, newParent: Element, insertIndex: number) => void;
  /** Called when draw-mode paths are created, cleared, or replaced. */
  onDrawPathsChange?: (paths: SVGPathElement[]) => void;
  /** Called when select-mode drawing selection changes. */
  onDrawSelectionChange?: (paths: SVGPathElement[]) => void;
}

export interface ResizeResult {
  width: number;
  height: number;
  locked: boolean;
}
