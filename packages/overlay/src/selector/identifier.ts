/**
 * Element identification: generates a unique CSS selector and
 * extracts React component hierarchy from the fiber tree.
 */

import { finder } from "@medv/finder";
import { parse as parseSelector } from "parsel-js";

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

export type SelectorCandidate = {
  selector: string;
  count: number;
  /** Classification verdict: semantic classes are shown, utility classes are collapsed */
  verdict: "semantic" | "utility" | "ambiguous";
};

// ---- Hashed / generated class detection (structural, framework-agnostic) ----

export function isHashedClass(name: string): boolean {
  // BEM double-underscore/double-hyphen classes are human-authored, not hashed
  if (name.includes("__") || name.includes("--")) return false;
  if (name.startsWith("_") || name.startsWith("css-")) return true;
  if (/^[a-z]{1,3}[A-Za-z0-9_]{8,}$/.test(name)) return true;
  return false;
}

// ---- Name-based utility scoring (fallback for cross-origin sheets) ----

/** Stems that are known utility property prefixes (Tailwind, Bootstrap, etc.) */
const UTILITY_STEMS = new Set([
  // Spacing
  "m", "mx", "my", "mt", "mr", "mb", "ml", "ms", "me",
  "p", "px", "py", "pt", "pr", "pb", "pl", "ps", "pe",
  "space", "gap",
  // Sizing
  "w", "h", "min-w", "max-w", "min-h", "max-h", "size",
  // Typography
  "text", "font", "leading", "tracking", "indent",
  // Colors
  "bg", "from", "via", "to",
  // Borders
  "border", "rounded", "ring", "outline", "divide",
  // Layout
  "flex", "grid", "col", "row", "place", "items", "justify", "self",
  "order", "float", "clear", "basis", "grow", "shrink", "wrap",
  // Positioning
  "inset", "top", "right", "bottom", "left", "z",
  // Visual
  "shadow", "opacity", "blur", "brightness", "contrast", "saturate",
  "backdrop", "mix-blend",
  // Behavior
  "overflow", "overscroll", "scroll", "snap", "touch", "select",
  "cursor", "pointer-events", "resize", "appearance",
  // Transitions
  "transition", "duration", "ease", "delay", "animate",
  // Transforms
  "scale", "rotate", "translate", "skew", "origin",
  // Other
  "aspect", "columns", "break", "object", "decoration",
  "underline", "overline", "line-through", "no-underline",
  "uppercase", "lowercase", "capitalize", "normal-case", "truncate",
  "antialiased", "subpixel-antialiased",
  "whitespace", "hyphens", "content", "list", "sr", "not-sr",
  "will-change", "fill", "stroke", "caret", "accent",
  "container", "prose",
  // Single-word Tailwind utilities
  "block", "inline", "inline-block", "inline-flex", "inline-grid",
  "hidden", "visible", "invisible", "collapse",
  "static", "relative", "absolute", "fixed", "sticky",
  "isolate", "isolation",
  "table", "table-caption", "table-cell", "table-column",
  "table-row", "table-footer-group", "table-header-group",
  "table-row-group", "table-column-group",
  "contents", "flow-root",
  "line-clamp",
  "italic", "not-italic",
  // Tailwind v4 additions
  "inset-ring", "inset-shadow", "field-sizing",
  "text-wrap", "text-nowrap", "text-balance", "text-pretty",
]);

/** Stems that strongly indicate semantic/component classes */
const SEMANTIC_STEMS = new Set([
  "btn", "button", "card", "modal", "nav", "header", "footer", "sidebar",
  "hero", "section", "container-fluid", "wrapper", "layout", "page", "view",
  "panel", "dialog", "menu", "toolbar", "badge", "chip", "avatar", "icon",
  "logo", "form", "input", "item", "link", "tab",
  "accordion", "carousel", "dropdown", "tooltip", "popover", "alert",
  "toast", "banner", "widget",
]);

/** Common keyword values used after utility stems (non-numeric suffixes) */
const UTILITY_KEYWORD_VALUES = new Set([
  // font-weight
  "thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black",
  // leading
  "none", "tight", "snug", "relaxed", "loose",
  // tracking
  "tighter", "wide", "wider", "widest",
  // overflow / visibility
  "hidden", "visible", "scroll", "auto", "clip",
  // shadow
  "inner", "outer", "inset",
  // text-align / justify / align
  "left", "center", "right", "justify", "start", "end",
  // flex direction / wrap
  "row", "col", "wrap", "nowrap", "reverse",
  // object-fit
  "cover", "contain", "fill",
  // alignment
  "baseline", "stretch", "between", "around", "evenly",
  // cursor
  "pointer", "default", "move", "grab", "grabbing", "not-allowed", "wait", "crosshair",
  // misc
  "ellipsis", "truncate", "clamp",
]);

/** All known variant prefixes (responsive, state, pseudo, etc.) */
const VARIANT_PREFIX = /^(?:sm|md|lg|xl|2xl|3xl|4xl|5xl|min-sm|min-md|min-lg|min-xl|min-2xl|max-sm|max-md|max-lg|max-xl|max-2xl|dark|light|hover|focus|focus-within|focus-visible|active|visited|target|first|last|only|odd|even|first-of-type|last-of-type|only-of-type|empty|disabled|enabled|checked|indeterminate|default|required|valid|invalid|in-range|out-of-range|placeholder-shown|autofill|read-only|open|closed|before|after|first-letter|first-line|marker|selection|file|backdrop|placeholder|group-hover|group-focus|group-active|group-first|group-last|peer-hover|peer-focus|peer-checked|peer-disabled|has|not|is|where|supports|aria|data|rtl|ltr|print|portrait|landscape|motion-safe|motion-reduce|contrast-more|contrast-less|forced-colors):/;

/**
 * Extract the "stem" from a utility class name.
 * "bg-red-500" → "bg", "mt-4" → "mt", "-translate-x-1/2" → "translate"
 */
function extractStem(name: string): string {
  // Remove variant prefix: "hover:bg-red-500" → "bg-red-500"
  const stripped = name.replace(/^.*?:/, "");
  // Remove negative prefix and bang modifiers
  const clean = stripped.replace(/^[-!]/, "");
  // Try matching multi-word stems first (e.g., "min-w", "max-h", "line-clamp")
  const multiMatch = clean.match(/^([a-z]+-[a-z]+)(?=-|$)/);
  if (multiMatch && UTILITY_STEMS.has(multiMatch[1])) return multiMatch[1];
  // Single-word stem
  return clean.split("-")[0];
}

/**
 * Score a class name on a 0-1 scale for how likely it is to be a utility class.
 * Higher = more likely utility. Uses name patterns only (no stylesheet access).
 */
export function scoreNamePattern(name: string): { score: number; confidence: number } {
  if (!name || !name.trim()) return { score: 0, confidence: 1.0 };

  // Definitive signals — these are ALWAYS utility, no ambiguity
  if (VARIANT_PREFIX.test(name)) return { score: 1.0, confidence: 0.95 };
  if (/\[.+\]/.test(name)) return { score: 1.0, confidence: 0.95 }; // arbitrary values
  if (/^[a-z][\w-]*\/\d+$/.test(name)) return { score: 1.0, confidence: 0.95 }; // slash opacity
  if (/!$/.test(name)) return { score: 0.95, confidence: 0.90 }; // Tailwind v4 trailing bang

  const stem = extractStem(name);

  // BEM patterns are always semantic (before any utility checks)
  if (name.includes("__") || /--[a-z]/.test(name)) return { score: 0.05, confidence: 0.80 };

  // Bare-word utility stems (flex, grid, hidden, block, relative, etc.)
  // Check before semantic/state to avoid false negatives on common utility keywords
  if (UTILITY_STEMS.has(name)) {
    return { score: 0.80, confidence: 0.75 };
  }

  // Check semantic stems (strong counter-signal)
  if (SEMANTIC_STEMS.has(stem)) return { score: 0.15, confidence: 0.70 };

  // State classes lean semantic (only reached for non-utility-stem words)
  if (/^(is-|has-|not-|no-|active|disabled|selected|open|closed|collapsed|expanded|loading|error|success|warning|checked|focused|pressed|dragging)$/.test(name)) {
    return { score: 0.25, confidence: 0.50 };
  }

  // Check if stem is a known utility stem
  const isUtilityStem = UTILITY_STEMS.has(stem);
  // Check for numeric/size suffix pattern (p-4, mt-8, gap-2)
  const hasValueSuffix = /-(\d+\.?\d*|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|auto|full|screen|fit|min|max|none|px|0\.5|1\.5|2\.5|3\.5|\d+\/\d+)$/.test(name);
  // Check for color pattern (bg-red-500, text-blue-200)
  const hasColorPattern = /-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white|transparent|current|inherit)-?\d*$/.test(name);
  // Check for keyword value suffix (font-bold, leading-tight, overflow-hidden)
  const suffix = name.length > stem.length ? name.slice(stem.length + 1) : "";
  const hasKeywordValue = suffix !== "" && UTILITY_KEYWORD_VALUES.has(suffix);

  if (isUtilityStem && (hasValueSuffix || hasColorPattern || hasKeywordValue)) {
    return { score: 0.85, confidence: 0.80 };
  }
  if (isUtilityStem) {
    // Stem matches but suffix doesn't look like a known value (e.g., "text-hero")
    // Could be either — don't be aggressive
    return { score: 0.50, confidence: 0.40 };
  }
  if (hasValueSuffix && !isUtilityStem) {
    // Has a value suffix but unknown stem (e.g., "spacing-4", "sz-md")
    return { score: 0.55, confidence: 0.35 };
  }

  // Short names with hyphens and numbers tend to be utility
  if (name.length <= 6 && /^[a-z]+-\d/.test(name)) {
    return { score: 0.70, confidence: 0.50 };
  }

  // Default: no strong signals
  return { score: 0.35, confidence: 0.20 };
}

/** Legacy API — kept for backward compatibility with tests.
 *  Returns true if the score exceeds the utility threshold. */
export function isKnownUtilityPattern(name: string): boolean {
  const { score } = scoreNamePattern(name);
  return score >= 0.65;
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
export function isSimpleClassSelector(selectorText: string): boolean {
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
 *
 * Returns per-class scores combining structural (stylesheet) and name signals.
 */
interface ClassAnalysis {
  compoundClasses: Set<string>;
  utilityClasses: Set<string>;
  classesFoundInRules: Set<string>;
  /** Per-class utility score (0=semantic, 1=utility) with confidence */
  scores: Map<string, { score: number; confidence: number; verdict: "semantic" | "utility" | "ambiguous" }>;
}

function analyzeElementClasses(element: Element): ClassAnalysis {
  const elClasses = element.classList ? Array.from(element.classList) : [];
  const result: ClassAnalysis = {
    compoundClasses: new Set(),
    utilityClasses: new Set(),
    classesFoundInRules: new Set(),
    scores: new Map(),
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

  // ── Score each class by combining structural + name signals ──
  const nonHashed = elClasses.filter(c => !isHashedClass(c));

  for (const cls of nonHashed) {
    // Already classified by @layer utilities — definitive
    if (result.utilityClasses.has(cls)) {
      result.scores.set(cls, { score: 1.0, confidence: 0.98, verdict: "utility" });
      continue;
    }

    const nameSignal = scoreNamePattern(cls);
    const foundInRules = result.classesFoundInRules.has(cls);

    let sheetScore: { score: number; confidence: number } | null = null;

    if (foundInRules) {
      const maxProps = maxPropCount.get(cls) ?? 0;
      const isComplex = hasComplexSelector.has(cls);

      if (maxProps <= 1 && !isComplex) {
        sheetScore = { score: 0.90, confidence: 0.85 };
      } else if (maxProps <= 2 && !isComplex) {
        sheetScore = { score: 0.75, confidence: 0.80 };
      } else if (maxProps <= 3 && !isComplex) {
        sheetScore = { score: 0.50, confidence: 0.65 };
      } else if (maxProps >= 5) {
        sheetScore = { score: 0.10, confidence: 0.85 }; // multi-property = semantic
      } else if (isComplex) {
        // Complex selectors indicate semantic/component classes
        sheetScore = { score: Math.max(0, 0.30 - maxProps * 0.05), confidence: 0.75 };
      } else {
        sheetScore = { score: 0.40, confidence: 0.60 };
      }
    }

    // Combine signals
    let finalScore: number;
    let finalConfidence: number;

    if (sheetScore) {
      // Strong disagreement: name says semantic but sheet says utility →
      // trust the name. Component variants (btn-lg, card--compact) intentionally
      // have few properties — low prop count doesn't make them utility.
      if (nameSignal.score <= 0.25 && sheetScore.score >= 0.65) {
        finalScore = nameSignal.score;
        finalConfidence = nameSignal.confidence;
      } else {
        // Both signals available — weighted average favoring stylesheet (more reliable)
        finalScore = sheetScore.score * 0.65 + nameSignal.score * 0.35;
        finalConfidence = Math.max(sheetScore.confidence, nameSignal.confidence);
        // Concordance: both agree → boost confidence
        if (Math.abs(sheetScore.score - nameSignal.score) < 0.2) {
          finalConfidence = Math.min(finalConfidence + 0.10, 1.0);
        }
      }
    } else {
      // Cross-origin: name signal only, slight confidence penalty
      finalScore = nameSignal.score;
      finalConfidence = nameSignal.confidence * 0.9;
    }

    // Context adjustment: elements with many non-hashed classes are likely utility-heavy
    if (nonHashed.length >= 10 && finalScore >= 0.35 && finalScore <= 0.65) {
      finalScore = Math.min(finalScore + 0.10, 1.0);
    } else if (nonHashed.length <= 2 && finalScore >= 0.35 && finalScore <= 0.65) {
      finalScore = Math.max(finalScore - 0.10, 0);
    }

    // Assign verdict
    let verdict: "semantic" | "utility" | "ambiguous";
    if (finalScore >= 0.65) {
      verdict = "utility";
      result.utilityClasses.add(cls);
    } else if (finalScore <= 0.35) {
      verdict = "semantic";
    } else if (finalConfidence >= 0.70) {
      verdict = finalScore >= 0.50 ? "utility" : "semantic";
      if (verdict === "utility") result.utilityClasses.add(cls);
    } else {
      verdict = "ambiguous";
    }

    result.scores.set(cls, { score: finalScore, confidence: finalConfidence, verdict });
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
 * Uses multi-signal scoring (stylesheet analysis + name patterns + context)
 * to classify each class as semantic, utility, or ambiguous.
 *
 * Returns candidates with verdicts so the UI can display them appropriately:
 * - semantic: shown as prominent selectable tags
 * - ambiguous: shown but visually distinguished
 * - utility: collapsed into a "Show N utility classes" disclosure
 */
export function getSelectorCandidates(element: Element): SelectorCandidate[] {
  const el = element as HTMLElement;
  if (!el.classList || el.classList.length === 0) return [];

  const analysis = analyzeElementClasses(element);

  const nonHashed = Array.from(el.classList).filter((name) => !isHashedClass(name));
  if (nonHashed.length === 0) return [];

  const candidates: SelectorCandidate[] = [];

  // Separate classes by verdict
  const semantic: string[] = [];
  const ambiguous: string[] = [];
  const utility: string[] = [];

  for (const name of nonHashed) {
    const info = analysis.scores.get(name);
    if (!info) {
      // No score computed (shouldn't happen, but be safe)
      ambiguous.push(name);
      continue;
    }
    // Compound selector participants are always shown as semantic
    if (analysis.compoundClasses.has(name) && info.verdict === "utility") {
      semantic.push(name);
      continue;
    }
    switch (info.verdict) {
      case "semantic": semantic.push(name); break;
      case "ambiguous": ambiguous.push(name); break;
      case "utility": utility.push(name); break;
    }
  }

  // Build candidates: individual semantic classes first, then ambiguous

  // Individual semantic classes
  for (const c of semantic) {
    const selector = `.${CSS.escape(c)}`;
    try {
      candidates.push({
        selector,
        count: document.querySelectorAll(selector).length,
        verdict: "semantic",
      });
    } catch { /* skip */ }
  }

  // Ambiguous classes (shown but may be visually distinguished)
  for (const c of ambiguous) {
    const selector = `.${CSS.escape(c)}`;
    try {
      candidates.push({
        selector,
        count: document.querySelectorAll(selector).length,
        verdict: "ambiguous",
      });
    } catch { /* skip */ }
  }

  // Utility classes (collapsed by default in UI)
  for (const c of utility) {
    const selector = `.${CSS.escape(c)}`;
    try {
      candidates.push({
        selector,
        count: document.querySelectorAll(selector).length,
        verdict: "utility",
      });
    } catch { /* skip */ }
  }

  // Sort: semantic before ambiguous before utility, then by count descending (broadest scope first)
  const verdictPriority: Record<string, number> = { semantic: 0, ambiguous: 1, utility: 2 };
  candidates.sort((a, b) => {
    const vp = verdictPriority[a.verdict] - verdictPriority[b.verdict];
    if (vp !== 0) return vp;
    return b.count - a.count;
  });

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

// ---- Ancestor scope extraction ----

export interface AncestorScope {
  /** Full CSS selector e.g. ".message-row--unread .message-row__subject" */
  fullSelector: string;
  /** Just the ancestor portion e.g. ".message-row--unread" */
  ancestorPart: string;
  /** Humanized label e.g. "Unread" */
  label: string;
  /** Number of elements matching fullSelector */
  count: number;
}

// ── ARIA attribute humanization lookup ──

const ARIA_LABELS: Record<string, Record<string, string>> = {
  "aria-expanded": { "true": "Expanded", "false": "Collapsed" },
  "aria-selected": { "true": "Selected", "false": "Deselected" },
  "aria-disabled": { "true": "Disabled" },
  "aria-checked": { "true": "Checked", "mixed": "Partially Checked" },
  "aria-pressed": { "true": "Pressed", "mixed": "Partially Pressed" },
  "aria-current": { "page": "Current Page", "step": "Current Step", "true": "Current" },
  "aria-hidden": { "true": "Hidden" },
  "aria-busy": { "true": "Loading" },
  "aria-invalid": { "true": "Invalid", "grammar": "Grammar Error", "spelling": "Spelling Error" },
  "aria-required": { "true": "Required" },
  "aria-modal": { "true": "Modal" },
};

/** Humanize an ancestor selector part for display in the Target rail */
export function humanizeAncestorPart(ancestor: string): string {
  // Try ARIA attribute: [aria-expanded="true"] → "Expanded"
  const ariaMatch = ancestor.match(/\[aria-([\w-]+)(?:="([^"]*)")?\]/);
  if (ariaMatch) {
    const [, attr, val] = ariaMatch;
    const key = `aria-${attr}`;
    if (ARIA_LABELS[key]) {
      return ARIA_LABELS[key][val || "true"] || titleCase(val || attr);
    }
    return titleCase(val || attr);
  }

  // Try data attribute with value: [data-state="open"] → "Open"
  const dataValMatch = ancestor.match(/\[data-[\w-]+=["']?([^"'\]]+)["']?\]/);
  if (dataValMatch) return titleCase(dataValMatch[1]);

  // Try boolean data attribute: [data-open] → "Open"
  const dataBoolMatch = ancestor.match(/\[data-([\w-]+)\]/);
  if (dataBoolMatch) return titleCase(dataBoolMatch[1]);

  // Try BEM modifier: .block--modifier → "Modifier"
  const bemMatch = ancestor.match(/\.([\w-]+)--([\w-]+)/);
  if (bemMatch) return titleCase(bemMatch[2]);

  // Try state prefix: .is-open → "Open", .has-error → "Error"
  const stateMatch = ancestor.match(/\.(is|has)-([\w-]+)/);
  if (stateMatch) return titleCase(stateMatch[2]);

  // Try class name: .sidebar → "Sidebar"
  const classMatch = ancestor.match(/\.([\w-]+)/);
  if (classMatch) return titleCase(classMatch[1]);

  // Fallback: return cleaned-up selector text
  return ancestor.replace(/[.\[\]="']/g, " ").trim();
}

function titleCase(s: string): string {
  return s
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Noise filtering ──

/** Filter out framework scoping attributes and CSS-in-JS hashes from ancestor parts */
function isNoiseAncestor(selectorText: string): boolean {
  // Vue scoped attributes
  if (/\[data-v-[a-f0-9]+\]/.test(selectorText)) return true;
  // Angular scoping
  if (/\[_ng(host|content)-[\w-]+\]/.test(selectorText)) return true;
  // CSS-in-JS hashed classes (e.g. .css-1a2b3c, .sc-abc123)
  if (/\.(css|sc|emotion)-[a-zA-Z0-9]{4,}/.test(selectorText) && !/[A-Z]/.test(selectorText)) return true;
  return false;
}

// ── Selector splitting via parsel-js ──

interface SplitResult {
  ancestorPart: string;
  elementPart: string;
}

/**
 * Split a CSS selector at the last top-level descendant/child combinator.
 * Returns the ancestor part and element part, or null if no split possible.
 */
function splitSelector(selectorText: string): SplitResult | null {
  let ast: any;
  try {
    ast = parseSelector(selectorText, { recursive: true });
  } catch {
    return null;
  }
  if (!ast || ast.type !== "complex") return null;

  // The rightmost part of the complex selector is the element part
  const rightContent = ast.right?.content;
  if (!rightContent) return null;

  // Everything left of the rightmost combinator is the ancestor
  const full = selectorText.trim();
  const rightIdx = full.lastIndexOf(rightContent);
  if (rightIdx <= 0) return null;

  const ancestorRaw = full.slice(0, rightIdx).trim();
  // Remove trailing combinator character (> + ~ or space)
  const ancestorPart = ancestorRaw.replace(/[>+~\s]+$/, "").trim();
  if (!ancestorPart) return null;

  return { ancestorPart, elementPart: rightContent };
}

/** Check if a selector's element part references one of the element's own classes or tag */
function elementPartMatchesElement(elementPart: string, element: Element): boolean {
  const partClasses = elementPart.match(/\.([a-zA-Z0-9_-]+)/g)?.map((c) => c.slice(1)) || [];
  if (partClasses.length === 0) {
    // Element part might be a tag selector
    const tag = elementPart.replace(/[:\[].*/g, "").trim().toLowerCase();
    return tag === element.tagName.toLowerCase();
  }
  return partClasses.some((c) => element.classList.contains(c));
}

/**
 * Extract ancestor-based compound selectors from CSS rules that match the element.
 * Returns scopes sorted by count (broadest first).
 */
export function getAncestorScopes(element: Element): AncestorScope[] {
  const seen = new Map<string, AncestorScope>();

  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    walkRulesForAncestors(rules, element, seen);
  }

  const result = Array.from(seen.values());
  result.sort((a, b) => b.count - a.count);
  return result;
}

function walkRulesForAncestors(
  rules: CSSRuleList,
  element: Element,
  seen: Map<string, AncestorScope>,
): void {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];

    if (rule instanceof CSSGroupingRule ||
        (typeof CSSLayerBlockRule !== "undefined" && rule instanceof CSSLayerBlockRule)) {
      walkRulesForAncestors((rule as CSSGroupingRule).cssRules, element, seen);
      continue;
    }

    if (!(rule instanceof CSSStyleRule)) continue;

    const sel = rule.selectorText;
    if (sel.includes(":hover") || sel.includes(":focus") || sel.includes(":active")) continue;

    try { if (!element.matches(sel)) continue; } catch { continue; }

    // Handle comma-separated selectors
    for (const part of sel.split(",")) {
      const trimmed = part.trim();

      // Quick check: skip if no whitespace or > outside parens (no combinator)
      const noParen = trimmed.replace(/\([^)]*\)/g, "");
      if (!/[\s>]/.test(noParen)) continue;

      const split = splitSelector(trimmed);
      if (!split) continue;
      if (!elementPartMatchesElement(split.elementPart, element)) continue;
      if (isNoiseAncestor(split.ancestorPart)) continue;

      const fullSelector = trimmed;
      if (seen.has(fullSelector)) continue;

      let count: number;
      try { count = document.querySelectorAll(fullSelector).length; } catch { continue; }
      if (count <= 0) continue;

      seen.set(fullSelector, {
        fullSelector,
        ancestorPart: split.ancestorPart,
        label: humanizeAncestorPart(split.ancestorPart),
        count,
      });
    }
  }
}
