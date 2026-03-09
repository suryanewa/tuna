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
  const candidates = getSelectorCandidates(element);
  // Return the first candidate that matches >1, or the most specific with count=1
  for (const c of candidates) {
    if (c.count > 1) return c;
  }
  return candidates.length > 0 ? candidates[0] : null;
}

export type SelectorCandidate = { selector: string; count: number };

// ---- Hashed / generated class detection (structural, framework-agnostic) ----

export function isHashedClass(name: string): boolean {
  // BEM double-underscore/double-hyphen classes are human-authored, not hashed
  if (name.includes("__") || name.includes("--")) return false;
  if (name.startsWith("_") || name.startsWith("css-")) return true;
  if (/^[a-z]{1,3}[A-Za-z0-9_]{8,}$/.test(name)) return true;
  return false;
}

// ---- Name-based utility pattern (fallback for cross-origin sheets) ----

const KNOWN_UTILITY_PATTERN = /^-?(?:m|p|w|h|text|bg|border|flex|grid|gap|space|rounded|shadow|opacity|font|leading|tracking|z|inset|top|right|bottom|left|min|max|overflow|cursor|transition|duration|ease|delay|animate|scale|rotate|translate|skew|origin|ring|outline|placeholder|divide|sr|not-sr|container|prose|aspect|columns|break|decoration|underline|overline|line-through|no-underline|antialiased|subpixel|italic|not-italic|normal-case|uppercase|lowercase|capitalize|truncate|indent|align|whitespace|hyphens|content|list|object|overflow|scroll|snap|touch|select|resize|appearance|accent|caret|will-change|fill|stroke)\b/;
const VARIANT_PREFIX = /^(sm|md|lg|xl|2xl|dark|hover|focus|active|group|peer):/;

/** Regex-only fallback for classes not found in accessible stylesheets.
 *  Used when cross-origin restrictions prevent rule analysis. */
export function isKnownUtilityPattern(name: string): boolean {
  return KNOWN_UTILITY_PATTERN.test(name) || VARIANT_PREFIX.test(name)
    || /\[.*\]/.test(name)  // arbitrary values: w-[200px]
    || /\//.test(name);     // slash values: bg-black/50
}

// ---- Stylesheet-based utility detection (framework-agnostic) ----

/** Collapse CSS longhands back into their shorthand family.
 *  e.g. padding-top, padding-right → "padding" (1 authored property, not 4). */
export function getPropertyFamily(prop: string): string {
  if (prop.startsWith("padding-")) return "padding";
  if (prop.startsWith("margin-")) return "margin";
  if (prop.endsWith("-radius") && prop.startsWith("border-")) return "border-radius";
  if (/^border-(top|right|bottom|left)-(width|style|color)$/.test(prop)) return "border";
  if (prop.startsWith("border-") && (prop.startsWith("border-block") || prop.startsWith("border-inline"))) return "border";
  if (prop.startsWith("background-")) return "background";
  if (prop.startsWith("overflow-")) return "overflow";
  if (prop === "column-gap" || prop === "row-gap") return "gap";
  if (prop.startsWith("outline-") && prop !== "outline-offset") return "outline";
  if (prop.startsWith("text-decoration-")) return "text-decoration";
  if (prop.startsWith("transition-")) return "transition";
  if (prop.startsWith("animation-") && !prop.startsWith("animation-range")) return "animation";
  if (prop.startsWith("scroll-margin-")) return "scroll-margin";
  if (prop.startsWith("scroll-padding-")) return "scroll-padding";
  if (prop.startsWith("list-style-")) return "list-style";
  if (prop.startsWith("grid-template-")) return "grid-template";
  if (prop.startsWith("grid-auto-")) return "grid-auto";
  if (prop === "flex-grow" || prop === "flex-shrink" || prop === "flex-basis") return "flex";
  if (prop === "column-count" || prop === "column-width") return "columns";
  if (prop.startsWith("place-")) return prop; // place-items, place-content are distinct
  return prop;
}

/** Count authored CSS properties by collapsing longhands into shorthand families.
 *  Skips CSS custom properties (--*) which are framework internals, not authored styling. */
export function countAuthoredProperties(style: CSSStyleDeclaration): number {
  const families = new Set<string>();
  for (let i = 0; i < style.length; i++) {
    const prop = style[i];
    if (prop.startsWith("--")) continue; // skip CSS variables
    families.add(getPropertyFamily(prop));
  }
  return families.size;
}

/** Check if a selector is a simple single-class selector (no combinators, no compound). */
function isSimpleClassSelector(selectorText: string): boolean {
  return selectorText.split(",").every(sel => {
    const s = sel.trim();
    // Remove pseudo-classes/elements for structural analysis
    const noPseudo = s.replace(/::?[\w-]+(?:\(.*?\))?/g, "");
    // Remove attribute selectors
    const cleaned = noPseudo.replace(/\[.*?\]/g, "").trim();
    // No whitespace (descendant), no > + ~ combinators
    if (/[\s>+~]/.test(cleaned)) return false;
    // Only one class reference
    const classes = cleaned.match(/\./g);
    return classes !== null && classes.length === 1;
  });
}

/**
 * Analyze an element's classes against actual stylesheet rules in a single pass.
 * Framework-agnostic: detects utility classes by their CSS structure
 * (low property count + simple selectors) rather than naming conventions.
 */
interface ClassAnalysis {
  compoundClasses: Set<string>;
  utilityClasses: Set<string>;
  classesFoundInRules: Set<string>;
}

function analyzeElementClasses(element: Element): ClassAnalysis {
  const elClasses = element.classList ? Array.from(element.classList) : [];
  const result: ClassAnalysis = {
    compoundClasses: new Set(),
    utilityClasses: new Set(),
    classesFoundInRules: new Set(),
  };

  if (elClasses.length === 0) return result;

  // Per-class tracking: max property count and selector complexity
  const maxPropCount = new Map<string, number>();
  const hasComplexSelector = new Set<string>();

  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    walkRules(rules, elClasses, element, result, maxPropCount, hasComplexSelector, null);
  }

  // Classify: utility = low property count + simple selectors + utility-looking name.
  // Requiring the name check prevents false positives on semantic classes with
  // minimal styling (e.g., .btn-lg with only font-size + padding).
  for (const [cls, maxProps] of maxPropCount) {
    if (maxProps <= 2 && !hasComplexSelector.has(cls) && isKnownUtilityPattern(cls)) {
      result.utilityClasses.add(cls);
    }
  }

  return result;
}

function walkRules(
  rules: CSSRuleList,
  elClasses: string[],
  element: Element,
  result: ClassAnalysis,
  maxPropCount: Map<string, number>,
  hasComplexSelector: Set<string>,
  layerName: string | null,
): void {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];

    // Recurse into @layer — classes in "utilities" layer are always utility
    if (typeof CSSLayerBlockRule !== "undefined" && rule instanceof CSSLayerBlockRule) {
      walkRules(rule.cssRules, elClasses, element, result, maxPropCount, hasComplexSelector, rule.name);
      continue;
    }

    // Recurse into @media, @supports, etc.
    if (rule instanceof CSSGroupingRule) {
      walkRules(rule.cssRules, elClasses, element, result, maxPropCount, hasComplexSelector, layerName);
      continue;
    }

    if (!(rule instanceof CSSStyleRule)) continue;

    const sel = rule.selectorText;

    // Extract class names from this selector
    const selectorClasses = sel.match(/\.([a-zA-Z0-9_-]+)/g)?.map((c) => c.slice(1)) || [];

    // Quick filter: skip if no overlap with element's classes
    const overlap = selectorClasses.filter((c) => elClasses.includes(c));
    if (overlap.length === 0) continue;

    // Full match check
    try { if (!element.matches(sel)) continue; } catch { continue; }

    // Mark as found in rules
    for (const c of overlap) result.classesFoundInRules.add(c);

    // Compound selector detection (2+ of element's classes in one selector)
    if (overlap.length >= 2) {
      for (const c of overlap) result.compoundClasses.add(c);
    }

    // Classes in @layer utilities are always utility
    if (layerName === "utilities") {
      for (const c of overlap) result.utilityClasses.add(c);
      continue; // skip property analysis — already classified
    }

    // Property count + selector complexity analysis
    const propCount = countAuthoredProperties(rule.style);
    const simple = isSimpleClassSelector(sel);

    for (const c of overlap) {
      const prev = maxPropCount.get(c) ?? 0;
      maxPropCount.set(c, Math.max(prev, propCount));
      if (!simple) hasComplexSelector.add(c);
    }
  }
}

/**
 * Get meaningful class-based selector candidates for an element.
 * Uses stylesheet rule analysis (framework-agnostic) as the primary signal,
 * with regex pattern matching as a fallback for cross-origin sheets.
 */
export function getSelectorCandidates(element: Element): SelectorCandidate[] {
  const el = element as HTMLElement;
  if (!el.classList || el.classList.length === 0) return [];

  const analysis = analyzeElementClasses(element);

  const nonHashed = Array.from(el.classList).filter((name) => !isHashedClass(name));
  if (nonHashed.length === 0) return [];

  const classes = nonHashed.filter((name) => {
    // Always keep compound selector participants (specificity forks)
    if (analysis.compoundClasses.has(name)) return true;
    // Filter out classes detected as utility by stylesheet analysis
    if (analysis.utilityClasses.has(name)) return false;
    // For classes not found in any accessible sheet, use regex fallback
    if (!analysis.classesFoundInRules.has(name)) {
      if (isKnownUtilityPattern(name)) return false;
    }
    return true;
  });

  // If filtering removed everything, check if it was truly all utility or if we
  // were too aggressive. Only fall back to showing all when there's genuine ambiguity
  // (some classes couldn't be confirmed as utility). For pure-utility elements
  // (e.g., all Tailwind), show nothing — "This element" is sufficient.
  let surviving: string[];
  if (classes.length > 0) {
    surviving = classes;
  } else {
    const allConfirmedUtility = nonHashed.every(
      (name) =>
        analysis.utilityClasses.has(name) ||
        analysis.compoundClasses.has(name) ||
        (!analysis.classesFoundInRules.has(name) && isKnownUtilityPattern(name))
    );
    surviving = allConfirmedUtility ? [] : nonHashed;
  }

  if (surviving.length === 0) return [];

  const candidates: SelectorCandidate[] = [];

  // All classes combined (most specific) — only if multiple survived filtering
  if (surviving.length > 1) {
    const selector = surviving.map((c) => `.${CSS.escape(c)}`).join("");
    try {
      candidates.push({ selector, count: document.querySelectorAll(selector).length });
    } catch { /* skip */ }
  }

  // Individual classes
  for (const c of surviving) {
    const selector = `.${CSS.escape(c)}`;
    try {
      candidates.push({ selector, count: document.querySelectorAll(selector).length });
    } catch { /* skip */ }
  }

  return candidates;
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

/** Get the React component name only if this element is the component's root DOM node.
 *  Prevents showing "CopyButton" on every child of the CopyButton component. */
export function getDirectReactComponent(element: Element): string | null {
  const fiber = getFiber(element);
  if (!fiber) return null;

  let current = fiber.return;
  while (current) {
    if (typeof current.type === "function" || typeof current.type === "object") {
      const name =
        current.type?.displayName ||
        current.type?.name ||
        current.elementType?.displayName ||
        current.elementType?.name;
      if (name && !isFrameworkInternal(name)) {
        // Walk down from this component fiber to find its first DOM node
        const rootDom = findFirstDomFiber(current);
        return rootDom === element ? name : null;
      }
    }
    current = current.return;
  }
  return null;
}

/** Find the first DOM element rendered by a component fiber */
function findFirstDomFiber(fiber: any): Element | null {
  if (fiber.stateNode instanceof Element) return fiber.stateNode;
  let child = fiber.child;
  while (child) {
    const found = findFirstDomFiber(child);
    if (found) return found;
    child = child.sibling;
  }
  return null;
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
  if (/(?:Router|Layout|Template|Loading|Segment|Fallback|Reload|Manager|Metadata|Viewport|Head|Script|Link)/.test(name)) return true;
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
