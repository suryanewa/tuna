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
        if (/^[a-z]{1,3}[A-Za-z0-9_]{8,}$/.test(name)) return false;
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

/**
 * Find the best shared (class-based) selector for an element.
 * Returns the most specific class selector that matches >1 element,
 * or null if no good shared selector exists.
 */
export function getSharedSelector(element: Element): { selector: string; count: number } | null {
  const el = element as HTMLElement;
  if (!el.classList || el.classList.length === 0) return null;

  // Build candidate selectors from element's classes, most specific first
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList).filter((name) => {
    // Skip dynamic/hashed class names
    if (name.startsWith("_") || name.startsWith("css-")) return false;
    if (/^[a-z]{1,3}[A-Za-z0-9_]{8,}$/.test(name)) return false;
    return true;
  });

  if (classes.length === 0) return null;

  // Try combinations: all classes together, then individual classes
  const candidates: string[] = [];

  // All classes combined (most specific)
  if (classes.length > 1) {
    candidates.push(classes.map((c) => `.${c}`).join(""));
  }

  // Individual classes
  for (const c of classes) {
    candidates.push(`.${c}`);
  }

  // Pick the first candidate that matches multiple elements
  for (const selector of candidates) {
    try {
      const matches = document.querySelectorAll(selector);
      if (matches.length > 1) {
        return { selector, count: matches.length };
      }
    } catch {
      continue;
    }
  }

  // If all classes only match this one element, return the most specific with count=1
  const bestSelector = classes.length > 1
    ? classes.map((c) => `.${c}`).join("")
    : `.${classes[0]}`;
  return { selector: bestSelector, count: 1 };
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
      // Skip anonymous, framework internals, and React internals
      if (name && !isFrameworkInternal(name)) {
        components.push(name);
      }
    }
    current = current.return;
  }

  return components;
}

/** Filter framework/library internals from component hierarchy */
function isFrameworkInternal(name: string): boolean {
  // Starts with underscore
  if (name.startsWith("_")) return true;
  // React internals
  if (/^(Fragment|Suspense|StrictMode|Profiler|Lazy|Memo|Forward)/.test(name)) return true;
  // Ends with common framework suffixes
  if (/(?:Provider|Consumer|Context|Boundary|Handler|Root|Wrapper)$/.test(name)) return true;
  // Next.js specific patterns
  if (/(?:Router|Layout|Template|Loading|Segment|Fallback|Reload|Manager|Metadata|Viewport)/.test(name)) return true;
  // Generic page-level components that don't help identify specific elements
  if (/^(Home|App|Page|Main|Index|Default|View|Screen|Dashboard|Root)$/.test(name)) return true;
  // Very short single-letter or likely minified names
  if (name.length <= 2) return true;
  return false;
}

/** Get source file location from React fiber _debugSource */
export function getReactSource(element: Element): { fileName: string; lineNumber: number; columnNumber?: number } | null {
  const fiber = getFiber(element);
  if (!fiber) return null;

  // Check the fiber itself first, then walk up
  let current = fiber;
  while (current) {
    if (current._debugSource) {
      return {
        fileName: current._debugSource.fileName,
        lineNumber: current._debugSource.lineNumber,
        columnNumber: current._debugSource.columnNumber,
      };
    }
    // Also check _debugOwner for source info
    if (current._debugOwner?._debugSource) {
      return {
        fileName: current._debugOwner._debugSource.fileName,
        lineNumber: current._debugOwner._debugSource.lineNumber,
        columnNumber: current._debugOwner._debugSource.columnNumber,
      };
    }
    current = current.return;
  }

  return null;
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
