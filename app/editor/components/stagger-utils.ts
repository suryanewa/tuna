import type { CanvasElement } from "@/lib/playground/store";

/**
 * Collect all descendants of an element in depth-first order.
 * Does NOT include the root element itself — only its children and their children, recursively.
 */
export function collectAllDescendants(
  elementId: string,
  elements: Record<string, CanvasElement>,
): string[] {
  const result: string[] = [];
  const el = elements[elementId];
  if (!el?.children) return result;

  function walk(ids: string[]) {
    for (const id of ids) {
      result.push(id);
      const child = elements[id];
      if (child?.children && child.children.length > 0) {
        walk(child.children);
      }
    }
  }

  walk(el.children);
  return result;
}
