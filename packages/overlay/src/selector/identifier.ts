/**
 * Element identification: generates a unique CSS selector and
 * extracts React component hierarchy from the fiber tree.
 */

import { finder } from "@medv/finder";

/** Generate a unique, readable CSS selector for an element */
export function getSelector(element: Element): string {
  try {
    return finder(element, {
      root: document.body,
      className: (name) => {
        // Filter out dynamic/hashed class names (CSS modules, Tailwind JIT, etc.)
        if (name.startsWith("_") || name.startsWith("css-")) return false;
        // Filter out very long hashes
        if (/^[a-z]{1,3}[A-Za-z0-9_-]{8,}$/.test(name)) return false;
        return true;
      },
      seedMinLength: 1,
      optimizedMinLength: 2,
      threshold: 1000,
    });
  } catch {
    // Fallback: build a basic selector
    return buildFallbackSelector(element);
  }
}

function buildFallbackSelector(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body) {
    let part = current.tagName.toLowerCase();
    if (current.id) {
      parts.unshift(`#${current.id}`);
      break;
    }
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        part += `:nth-of-type(${index})`;
      }
    }
    parts.unshift(part);
    current = parent;
  }

  return parts.join(" > ");
}

/** Get React fiber from a DOM element */
function getFiber(element: Element): any | null {
  const key = Object.keys(element).find((k) => k.startsWith("__reactFiber$"));
  return key ? (element as any)[key] : null;
}

/** Walk the React fiber tree to get the component hierarchy */
export function getReactComponentHierarchy(element: Element): string[] {
  const fiber = getFiber(element);
  if (!fiber) return [];

  const components: string[] = [];
  let current = fiber;

  while (current) {
    if (typeof current.type === "function" || typeof current.type === "object") {
      const name =
        current.type?.displayName ||
        current.type?.name ||
        current.elementType?.displayName ||
        current.elementType?.name;
      // Skip anonymous components and React internals
      if (name && !name.startsWith("_") && name !== "Fragment") {
        components.push(name);
      }
    }
    current = current.return;
  }

  return components;
}

/** Get props from the nearest React component */
export function getReactProps(element: Element): Record<string, unknown> | null {
  const fiber = getFiber(element);
  if (!fiber) return null;

  let current = fiber;
  while (current) {
    if (
      (typeof current.type === "function" || typeof current.type === "object") &&
      current.memoizedProps
    ) {
      const props = { ...current.memoizedProps };
      // Remove children and internal props
      delete props.children;
      delete props.ref;
      delete props.key;
      return props;
    }
    current = current.return;
  }

  return null;
}
