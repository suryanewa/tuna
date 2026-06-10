import {
  isHashedClass,
  scoreNamePattern,
  type AncestorScope,
  type SelectorCandidate,
} from "../selector/identifier";

/** A pre-computed scope level in the target rail. */
export interface ScopeLevel {
  label: string;
  selector: string | null;
  count: number;
  kind?: "class" | "ancestor" | "element";
}

/** Abbreviation lookup for common CSS class name stems. */
const CLASS_ABBREVIATIONS: Record<string, string> = {
  btn: "Button",
  nav: "Navigation",
  col: "Column",
  img: "Image",
  sm: "Small",
  md: "Medium",
  lg: "Large",
  xs: "Extra Small",
  xl: "Extra Large",
  hdr: "Header",
  ftr: "Footer",
  cta: "Call to Action",
  desc: "Description",
  msg: "Message",
  info: "Information",
  bg: "Background",
  txt: "Text",
  pg: "Page",
  sec: "Section",
  el: "Element",
  opt: "Option",
  val: "Value",
  err: "Error",
  warn: "Warning",
  num: "Number",
  prev: "Previous",
  curr: "Current",
  temp: "Temporary",
};

/** Humanize a single class name segment: split on hyphens, title-case, expand abbreviations. */
function humanizeSegment(segment: string): string {
  return segment
    .split("-")
    .map((word) => CLASS_ABBREVIATIONS[word] || (word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

function humanizeScopeLabel(className: string, previousClassName?: string): string {
  if (className.includes("--")) {
    const modifier = className.split("--").pop()!;
    return humanizeSegment(modifier);
  }
  if (className.includes("__")) {
    const element = className.split("__").pop()!;
    return humanizeSegment(element);
  }
  if (previousClassName && className.startsWith(`${previousClassName}-`)) {
    const suffix = className.slice(previousClassName.length + 1);
    return humanizeSegment(suffix);
  }
  return humanizeSegment(className);
}

function buildCompoundFingerprint(element: Element): ScopeLevel | null {
  const el = element as HTMLElement;
  if (!el.classList || el.classList.length === 0) return null;

  const classes: string[] = [];
  for (const cls of el.classList) {
    if (!isHashedClass(cls)) classes.push(cls);
  }
  if (classes.length === 0) return null;

  const selector = classes.sort().map((className) => `.${CSS.escape(className)}`).join("");
  let count: number;
  try {
    count = document.querySelectorAll(selector).length;
  } catch {
    count = 0;
  }
  if (count <= 1) return null;

  return { label: "All instances", selector, count };
}

function buildParentScopeLevel(element: Element): ScopeLevel | null {
  const tag = element.tagName.toLowerCase();
  let current = element.parentElement;

  while (current && current !== document.body) {
    for (const cls of current.classList) {
      if (isHashedClass(cls)) continue;
      const { score } = scoreNamePattern(cls);
      if (score >= 0.65) continue;

      const selector = `.${CSS.escape(cls)} ${tag}`;
      let count: number;
      try {
        count = document.querySelectorAll(selector).length;
      } catch {
        count = 0;
      }
      if (count > 1 && count <= 20) {
        return { label: "All instances", selector, count };
      }
    }
    current = current.parentElement;
  }

  return null;
}

function getManifestClassInfo(
  manifest: Record<string, any> | null,
): Map<string, { propName: string; value: string; componentName: string }> {
  const map = new Map<string, { propName: string; value: string; componentName: string }>();
  if (!manifest?.components) return map;
  for (const [compName, comp] of Object.entries<any>(manifest.components)) {
    if (!comp?.props) continue;
    for (const [propName, propDef] of Object.entries<any>(comp.props)) {
      if (!propDef?.class_map) continue;
      for (const [value, className] of Object.entries<string>(propDef.class_map)) {
        map.set(className, { propName, value, componentName: compName });
      }
    }
  }
  return map;
}

export function buildScopeLevels(
  candidates: SelectorCandidate[],
  element: Element,
  ancestorScopes: AncestorScope[] = [],
  manifest?: Record<string, any> | null,
): ScopeLevel[] {
  const manifestClasses = getManifestClassInfo(manifest ?? null);
  const meaningful = candidates.filter((candidate) =>
    candidate.verdict === "semantic" || manifestClasses.has(candidate.selector.replace(/^\./, "")),
  );

  if (meaningful.length === 0) {
    const fingerprint = buildCompoundFingerprint(element);
    if (fingerprint) {
      const levels: ScopeLevel[] = [fingerprint];
      appendAncestorLevels(levels, ancestorScopes);
      levels.push({ label: "This instance", selector: null, count: 1, kind: "element" });
      return levels;
    }

    const parentLevel = buildParentScopeLevel(element);
    if (parentLevel) {
      const levels: ScopeLevel[] = [parentLevel];
      appendAncestorLevels(levels, ancestorScopes);
      levels.push({ label: "This instance", selector: null, count: 1, kind: "element" });
      return levels;
    }

    if (ancestorScopes.length > 0) {
      const levels: ScopeLevel[] = [];
      appendAncestorLevels(levels, ancestorScopes);
      levels.push({ label: "This instance", selector: null, count: 1, kind: "element" });
      return levels;
    }

    return [{ label: "This instance", selector: null, count: 1, kind: "element" }];
  }

  const levels: ScopeLevel[] = [];
  const parts: string[] = [];
  for (const candidate of meaningful) {
    const className = candidate.selector.replace(/^\./, "");
    const prevClassName = parts.length > 0 ? parts[parts.length - 1] : undefined;
    parts.push(className);
    const compound = parts.slice().sort().map((part) => `.${CSS.escape(part)}`).join("");
    let count: number;
    try {
      count = document.querySelectorAll(compound).length;
    } catch {
      count = 0;
    }
    const manifestInfo = manifestClasses.get(className);
    const label = manifestInfo
      ? humanizeSegment(manifestInfo.value)
      : humanizeScopeLabel(className, prevClassName);
    levels.push({ label, selector: compound, count, kind: "class" });
  }

  appendAncestorLevels(levels, ancestorScopes);
  levels.push({ label: "This instance", selector: null, count: 1, kind: "element" });
  return levels;
}

function appendAncestorLevels(levels: ScopeLevel[], ancestorScopes: AncestorScope[]): void {
  const narrowestClassCount = levels.length > 0 ? levels[levels.length - 1].count : Infinity;

  for (const scope of ancestorScopes) {
    if (scope.count >= narrowestClassCount) continue;
    if (scope.count <= 1) continue;
    if (levels.some((level) => level.count === scope.count && level.selector === scope.fullSelector)) continue;

    levels.push({
      label: scope.label,
      selector: scope.fullSelector,
      count: scope.count,
      kind: "ancestor",
    });
  }
}
