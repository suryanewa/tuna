import type { Comment, CommentElementTarget } from "../../engine/comment-store";
import type { InspectedElement } from "../../types";
import { SELECTION_COLORS } from "../../ui/selection-colors";

export type CommentContentPart =
  | { type: "mention"; mention: { name: string; color: string; selector: string } }
  | { type: "text"; text: string };

export type CommentDraft = {
  position: { x: number; y: number };
  type: "element" | "area";
  selector?: string;
  anchorOffset?: { x: number; y: number };
  area?: { x: number; y: number; width: number; height: number };
  areaScroll?: { x: number; y: number };
  elementInfo?: Comment["elementInfo"];
  spanMentionCount?: number;
  /**
   * True when the draft's area was derived from the draw tool (its bounds are the
   * drawings' bounding box) rather than a drag-to-area gesture. Persisted across
   * mention edits so the dashed area outline stays suppressed even after every
   * inline mention (including the drawing) is deleted.
   */
  fromDrawing?: boolean;
};

export type ContainedCommentElement = {
  tagName: string;
  selector: string;
  componentName: string | null;
  textContent: string | null;
};

const DRAW_COLOR_ATTR = "data-tuna-draw-color";

export function getDrawingMentionName(orderIndex: number): string {
  return `Drawing ${orderIndex}`;
}

/** Visible stroke on the path — matches picker outline after selection sync. */
export function getDrawPathDisplayColor(path: SVGPathElement): string {
  return path.getAttribute("stroke")
    ?? path.getAttribute(DRAW_COLOR_ATTR)
    ?? SELECTION_COLORS[0];
}

export function getMentionColorForTarget(
  target: CommentElementTarget,
  fallbackIndex: number,
): string {
  return target.mentionColor ?? SELECTION_COLORS[fallbackIndex % SELECTION_COLORS.length];
}

type DrawingTargetInfo = NonNullable<CommentElementTarget["drawing"]>;

function getDrawPathBounds(path: SVGPathElement): DrawingTargetInfo["bounds"] {
  const rect = path.getBoundingClientRect?.() ?? { left: 0, top: 0, width: 0, height: 0 };
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function getDrawPathPageBounds(bounds: DrawingTargetInfo["bounds"]): DrawingTargetInfo["pageBounds"] {
  return {
    x: bounds.x + (typeof window === "undefined" ? 0 : window.scrollX),
    y: bounds.y + (typeof window === "undefined" ? 0 : window.scrollY),
    width: bounds.width,
    height: bounds.height,
  };
}

export function buildDrawingCommentTarget(
  orderIndex: number,
  mentionColor?: string,
  path?: SVGPathElement,
): CommentElementTarget {
  const target: CommentElementTarget = {
    tagName: "drawing",
    selector: `tuna-drawing:${orderIndex}`,
    componentName: getDrawingMentionName(orderIndex),
    componentPath: [],
    classes: [],
    textContent: null,
    ...(mentionColor ? { mentionColor } : {}),
  };

  if (!path) return target;

  const stroke = path.getAttribute("stroke") ?? mentionColor ?? SELECTION_COLORS[0];
  const fill = path.getAttribute("fill") ?? "none";
  const bounds = getDrawPathBounds(path);
  return {
    ...target,
    drawing: {
      orderIndex,
      pathData: path.getAttribute("d") ?? "",
      stroke,
      fill,
      bounds,
      pageBounds: getDrawPathPageBounds(bounds),
    },
  };
}

export function getDrawingOrderIndex(
  path: SVGPathElement,
  drawnPathsInOrder: SVGPathElement[],
): number {
  const index = drawnPathsInOrder.indexOf(path);
  return index >= 0 ? index + 1 : drawnPathsInOrder.length + 1;
}

export function buildDrawingTargetsFromPaths(
  paths: SVGPathElement[],
  drawnPathsInOrder: SVGPathElement[],
): CommentElementTarget[] {
  const orderedPaths = [...paths].sort(
    (a, b) => drawnPathsInOrder.indexOf(a) - drawnPathsInOrder.indexOf(b),
  );
  return orderedPaths.map((path) =>
    buildDrawingCommentTarget(
      getDrawingOrderIndex(path, drawnPathsInOrder),
      getDrawPathDisplayColor(path),
      path,
    ),
  );
}

/** Picker draw selection — only selected paths become inline comment targets. */
export function resolveActiveDrawPaths(
  selectedPaths: SVGPathElement[],
): SVGPathElement[] {
  return selectedPaths;
}

export function areDraftElementTargetsEqual(
  left: CommentElementTarget[],
  right: CommentElementTarget[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((target, index) => target.selector === right[index]?.selector);
}

export function supportsLiveMentionEditing(draft: CommentDraft | null | undefined): boolean {
  return draft?.type === "element" || draft?.type === "area";
}

export function syncElementTargetsInDraft(
  draft: CommentDraft,
  inspectedElements: InspectedElement[],
): CommentDraft {
  const existing = getDraftElementTargets(draft);
  const drawingTargets = existing.filter((target) => target.tagName === "drawing");
  const elementTargets = inspectedElements.map(buildCommentTargetFromInspected);
  const allTargets = [...elementTargets, ...drawingTargets];

  if (elementTargets.length === 0) return draft;

  return applyTargetsToDraft(draft, allTargets);
}

export function syncDrawingTargetsInDraft(
  draft: CommentDraft,
  selectedPaths: SVGPathElement[],
  drawnPathsInOrder: SVGPathElement[],
): CommentDraft {
  const drawingTargets = buildDrawingTargetsFromPaths(selectedPaths, drawnPathsInOrder);
  const existing = getDraftElementTargets(draft);
  const nonDrawingTargets = existing.filter((target) => target.tagName !== "drawing");
  const allTargets = [...nonDrawingTargets, ...drawingTargets];

  return applyTargetsToDraft(draft, allTargets);
}

export function getMentionName(tagName: string, componentName: string | null): string {
  if (tagName === "drawing") {
    return componentName ?? "Drawing";
  }
  const rawName = componentName || tagName.toLowerCase();
  return componentName ? rawName : rawName.charAt(0).toUpperCase() + rawName.slice(1);
}

function getElementMentionFallbackName(target: CommentElementTarget): string {
  const text = target.textContent?.replace(/\s+/g, " ").trim();
  if (text) {
    return text.length > 48 ? `${text.slice(0, 45).trim()}...` : text;
  }
  return target.tagName.charAt(0).toUpperCase() + target.tagName.slice(1);
}

function isLikelyWrapperComponentName(name: string | null | undefined): boolean {
  return !!name && /(Boundary|Consumer|Context|Controller|Handler|Manager|Positioner|Provider|Router|Wrapper)(Old)?$/.test(name);
}

function getTargetComponentMentionName(target: CommentElementTarget): string | null {
  const path = target.componentPath ?? [];
  const preferred = [...path].reverse().find((name) => !isLikelyWrapperComponentName(name));
  if (preferred) return preferred;
  if (target.componentName && !isLikelyWrapperComponentName(target.componentName)) {
    return target.componentName;
  }
  return null;
}

export function getMentionNameForTarget(
  target: CommentElementTarget,
  peers: CommentElementTarget[] = [target],
): string {
  if (target.tagName === "drawing") {
    return getMentionName(target.tagName, target.componentName);
  }
  const targetComponentName = getTargetComponentMentionName(target);
  const componentName = targetComponentName
    ? getMentionName(target.tagName, targetComponentName)
    : getElementMentionFallbackName(target);
  const duplicateComponentName = peers.some((peer) =>
    peer !== target
    && peer.tagName !== "drawing"
    && getMentionNameForTarget(peer, [peer]) === componentName
  );
  if (!duplicateComponentName) return componentName;
  return getElementMentionFallbackName(target);
}

export function getQuickSelector(el: Element): string {
  if (el.id) return "#" + CSS.escape(el.id);
  let base: string;
  const cls = Array.from(el.classList).filter(c => !c.startsWith("_") && !/^[a-z]{1,3}[A-Za-z0-9_]{8,}$/.test(c));
  if (cls.length > 0) {
    base = "." + cls.map(c => CSS.escape(c)).join(".");
  } else {
    base = el.tagName.toLowerCase();
  }
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(s => {
      if (s === el) return true;
      if (s.id || el.id) return false;
      if (cls.length > 0) return cls.every(c => s.classList.contains(c));
      return s.tagName === el.tagName;
    });
    if (siblings.length > 1) {
      const idx = Array.from(parent.children).indexOf(el) + 1;
      base += `:nth-child(${idx})`;
    }
  }
  return base;
}

export function getQuickComponentName(el: Element): string | null {
  const key = Object.keys(el).find(k => k.startsWith("__reactFiber$"));
  if (!key) return null;
  let fiber = (el as any)[key]?.return;
  while (fiber) {
    if (typeof fiber.type === "function" || typeof fiber.type === "object") {
      const n = fiber.type?.displayName || fiber.type?.name;
      if (n && n.length > 2 && !n.startsWith("_") && !/^(Fragment|Suspense|StrictMode|Provider|Consumer|Context)/.test(n)) return n;
    }
    fiber = fiber.return;
  }
  return null;
}

export function buildCommentTargetFromInspected(inspected: InspectedElement): CommentElementTarget {
  const source = inspected.sourceFile
    ? `${inspected.sourceFile.fileName}:${inspected.sourceFile.lineNumber}${
      inspected.sourceFile.columnNumber ? `:${inspected.sourceFile.columnNumber}` : ""
    }`
    : undefined;
  const componentName = inspected.reactComponents.length > 0
    ? inspected.reactComponents[inspected.reactComponents.length - 1]
    : null;
  return {
    tagName: inspected.tagName.toLowerCase(),
    selector: inspected.selector,
    componentName,
    componentPath: inspected.reactComponents,
    classes: inspected.classes,
    textContent: inspected.textContent,
    source,
    domPath: inspected.domPath || undefined,
  };
}

export function buildElementCommentDraft(element: Element, cursor: { x: number; y: number }, inspected: InspectedElement): CommentDraft {
  const selector = getQuickSelector(element);
  const componentName = getQuickComponentName(element);
  const selectorPath: string[] = [selector];
  let ancestor = element.parentElement;
  for (let i = 0; i < 3 && ancestor && ancestor !== document.body; i++) {
    selectorPath.unshift(getQuickSelector(ancestor));
    ancestor = ancestor.parentElement;
  }
  const rect = element.getBoundingClientRect();
  return {
    position: { x: cursor.x, y: cursor.y },
    type: "element",
    selector: selectorPath.join(" > "),
    anchorOffset: { x: cursor.x - rect.left, y: cursor.y - rect.top },
    spanMentionCount: 1,
    elementInfo: {
      tagName: element.tagName.toLowerCase(),
      componentName,
      componentPath: [],
      classes: Array.from(element.classList),
      textContent: (element.textContent || "").slice(0, 80).trim() || null,
      selectedElements: [buildCommentTargetFromInspected(inspected)],
    },
  };
}

export function buildSelectionCommentDraft(
  targets: InspectedElement[],
  primary: InspectedElement,
  cursor: { x: number; y: number },
): CommentDraft {
  const selectedTargets = targets.map(buildCommentTargetFromInspected);
  const primaryTarget = buildCommentTargetFromInspected(primary);
  const selectorPath: string[] = [getQuickSelector(primary.element)];
  let ancestor = primary.element.parentElement;
  for (let i = 0; i < 3 && ancestor && ancestor !== document.body; i++) {
    selectorPath.unshift(getQuickSelector(ancestor));
    ancestor = ancestor.parentElement;
  }
  const rect = primary.element.getBoundingClientRect();
  return {
    position: { x: cursor.x, y: cursor.y },
    type: "element",
    selector: selectorPath.join(" > "),
    anchorOffset: { x: cursor.x - rect.left, y: cursor.y - rect.top },
    spanMentionCount: selectedTargets.length,
    elementInfo: {
      tagName: primaryTarget.tagName,
      componentName: primaryTarget.componentName,
      componentPath: primaryTarget.componentPath ?? [],
      classes: primaryTarget.classes,
      textContent: primaryTarget.textContent,
      source: primaryTarget.source,
      domPath: primaryTarget.domPath,
      selectedElements: selectedTargets,
    },
  };
}

export function orderTargetsBySelectors(
  targets: CommentElementTarget[],
  selectors: string[],
): CommentElementTarget[] {
  return selectors
    .map((selector) => targets.find((target) => target.selector === selector))
    .filter((target): target is CommentElementTarget => !!target);
}

export function getCommentElementTargets(
  elementInfo: Comment["elementInfo"],
  primarySelector?: string,
): CommentElementTarget[] {
  return resolveCommentElementTargets(elementInfo, primarySelector);
}

export function resolveCommentElementTargets(
  elementInfo: Comment["elementInfo"],
  fallbackSelector?: string,
): CommentElementTarget[] {
  if (!elementInfo) return [];
  if (Array.isArray(elementInfo.selectedElements)) return elementInfo.selectedElements;
  return [{
    tagName: elementInfo.tagName,
    selector: fallbackSelector ?? "",
    componentName: elementInfo.componentName,
    componentPath: elementInfo.componentPath,
    classes: elementInfo.classes,
    textContent: elementInfo.textContent,
    source: elementInfo.source,
    domPath: elementInfo.domPath,
  }];
}

export function applyTargetsToDraft(
  draft: CommentDraft,
  targets: CommentElementTarget[],
): CommentDraft {
  const primaryTarget = targets.find((target) => target.tagName !== "drawing") ?? targets[0];

  if (!primaryTarget) {
    if (!draft.elementInfo) return draft;
    return {
      ...draft,
      spanMentionCount: 0,
      elementInfo: {
        ...draft.elementInfo,
        selectedElements: [],
      },
    };
  }

  return {
    ...draft,
    spanMentionCount: targets.length,
    elementInfo: {
      ...draft.elementInfo,
      tagName: primaryTarget.tagName,
      componentName: primaryTarget.componentName,
      componentPath: primaryTarget.componentPath ?? [],
      classes: primaryTarget.classes,
      textContent: primaryTarget.textContent,
      source: primaryTarget.source,
      domPath: primaryTarget.domPath,
      selectedElements: targets,
    },
  };
}

function findNextMentionStart(
  text: string,
  from: number,
  names: string[],
  pools: Map<string, CommentElementTarget[]>,
): number {
  for (let index = from; index < text.length; index++) {
    if (text[index] !== "@") continue;
    for (const name of names) {
      if (!text.startsWith(`@${name}`, index)) continue;
      const pool = pools.get(name);
      if (pool && pool.length > 0) return index;
    }
  }
  return text.length;
}

/**
 * Legacy migration helper: reconstruct parts from plain text + targets.
 * Prefer `getDoc(comment)` / `commentToDoc` for runtime reads — do not use
 * outside the comment-doc migration layer and tests.
 */
export function parseCommentTextIntoParts(
  text: string,
  targets: CommentElementTarget[],
): CommentContentPart[] {
  if (!text) return [];
  if (targets.length === 0) return [{ type: "text", text }];

  const pools = new Map<string, CommentElementTarget[]>();
  const targetIndexBySelector = new Map<string, number>();
  for (const [index, target] of targets.entries()) {
    targetIndexBySelector.set(target.selector, index);
    const name = getMentionNameForTarget(target, targets);
    const list = pools.get(name) ?? [];
    list.push(target);
    pools.set(name, list);
  }

  const names = [...pools.keys()].sort((a, b) => b.length - a.length);
  const parts: CommentContentPart[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const mentionAt = findNextMentionStart(text, cursor, names, pools);
    if (mentionAt > cursor) {
      parts.push({ type: "text", text: text.slice(cursor, mentionAt) });
      cursor = mentionAt;
      continue;
    }
    if (mentionAt >= text.length) break;

    let matched: { name: string; target: CommentElementTarget } | null = null;
    for (const name of names) {
      if (!text.startsWith(`@${name}`, cursor)) continue;
      const pool = pools.get(name);
      if (!pool || pool.length === 0) continue;
      matched = { name, target: pool.shift()! };
      break;
    }

    if (!matched) {
      parts.push({ type: "text", text: text[cursor] });
      cursor += 1;
      continue;
    }

    const colorIndex = targetIndexBySelector.get(matched.target.selector) ?? 0;
    parts.push({
      type: "mention",
      mention: {
        name: matched.name,
        color: getMentionColorForTarget(matched.target, colorIndex),
        selector: matched.target.selector,
      },
    });
    cursor += matched.name.length + 1;
  }

  return parts;
}

export function getDraftElementTargets(draft: CommentDraft): CommentElementTarget[] {
  return resolveCommentElementTargets(draft.elementInfo, draft.selector);
}

export function scanContainedElements(area: { x: number; y: number; width: number; height: number }): ContainedCommentElement[] {
  const containedElements: ContainedCommentElement[] = [];
  const step = 20;
  const seen = new Set<Element>();
  for (let x = area.x + step / 2; x < area.x + area.width; x += step) {
    for (let y = area.y + step / 2; y < area.y + area.height; y += step) {
      const el = document.elementFromPoint(x, y);
      if (el && !seen.has(el) && !el.closest?.("[data-tuna-host]")) {
        seen.add(el);
        containedElements.push({
          tagName: el.tagName.toLowerCase(),
          selector: getQuickSelector(el),
          componentName: getQuickComponentName(el),
          textContent: (el.textContent || "").slice(0, 40).trim() || null,
        });
      }
    }
  }
  return containedElements;
}
