/**
 * Detect layout context of an element: what kind of container it's in,
 * and what kind of container it is (if any).
 */

export interface LayoutInfo {
  /** This element's display mode */
  display: string;
  /** This element's position mode */
  position: string;
  /** If this element is a flex/grid container, its relevant properties */
  container: ContainerInfo | null;
  /** The parent's layout mode (context this element lives in) */
  parentLayout: "flex" | "grid" | "block" | "inline" | null;
}

export interface ContainerInfo {
  type: "flex" | "grid";
  direction?: string;
  wrap?: string;
  alignItems?: string;
  justifyContent?: string;
  gap?: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
}

export function getLayoutInfo(element: Element): LayoutInfo {
  const computed = window.getComputedStyle(element);
  const display = computed.display;
  const position = computed.position;

  // Determine if this element is a container
  let container: ContainerInfo | null = null;
  if (display.includes("flex")) {
    container = {
      type: "flex",
      direction: computed.flexDirection,
      wrap: computed.flexWrap,
      alignItems: computed.alignItems,
      justifyContent: computed.justifyContent,
      gap: computed.gap,
    };
  } else if (display.includes("grid")) {
    container = {
      type: "grid",
      gridTemplateColumns: computed.gridTemplateColumns,
      gridTemplateRows: computed.gridTemplateRows,
      gap: computed.gap,
      alignItems: computed.alignItems,
      justifyContent: computed.justifyContent,
    };
  }

  // Determine parent's layout
  let parentLayout: LayoutInfo["parentLayout"] = null;
  const parent = element.parentElement;
  if (parent) {
    const parentComputed = window.getComputedStyle(parent);
    const parentDisplay = parentComputed.display;
    if (parentDisplay.includes("flex")) parentLayout = "flex";
    else if (parentDisplay.includes("grid")) parentLayout = "grid";
    else if (parentDisplay.includes("inline")) parentLayout = "inline";
    else parentLayout = "block";
  }

  return { display, position, container, parentLayout };
}
