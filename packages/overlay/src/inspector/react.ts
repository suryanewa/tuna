/**
 * React-specific inspection: component names, props, and source locations.
 * Re-exports the fiber-based functions from identifier.ts and adds
 * higher-level inspection utilities.
 */

export {
  getReactComponentHierarchy,
  getReactProps,
} from "../selector/identifier";

/** Check if the current page is a React application */
export function isReactApp(): boolean {
  // Check for React fiber on the root element
  const root = document.getElementById("root") || document.getElementById("__next");
  if (!root) {
    // Try any element
    return document.querySelectorAll("[data-reactroot]").length > 0 ||
      Object.keys(document.body).some((k) => k.startsWith("__reactFiber$"));
  }
  return Object.keys(root).some((k) => k.startsWith("__reactFiber$"));
}

/** Get the source location from React's __source prop (if Babel plugin is active) */
export function getSourceLocation(element: Element): { fileName: string; lineNumber: number } | null {
  const fiberKey = Object.keys(element).find((k) => k.startsWith("__reactFiber$"));
  if (!fiberKey) return null;

  const fiber = (element as any)[fiberKey];
  if (!fiber) return null;

  // Walk up to find a fiber with _debugSource
  let current = fiber;
  while (current) {
    if (current._debugSource) {
      return {
        fileName: current._debugSource.fileName,
        lineNumber: current._debugSource.lineNumber,
      };
    }
    current = current.return;
  }

  return null;
}
